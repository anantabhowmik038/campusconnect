import { createHmac, timingSafeEqual } from 'node:crypto';
import { getDatabasePool } from '../config/database.js';
import { ApiError } from '../middleware/apiError.js';
import { isUuid } from '../validation/eventValidation.js';

const ticketLifetimeSeconds = 24 * 60 * 60;

function requirePool() {
  const pool = getDatabasePool();
  if (!pool) throw new ApiError(503, 'Database is not configured.');
  return pool;
}

function requireId(value, field) {
  if (!isUuid(value)) throw new ApiError(400, field + ' must be a valid UUID.');
  return value.toLowerCase();
}

function sign(value) {
  const secret = process.env.ATTENDANCE_TICKET_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret) < 32 || secret === process.env.JWT_SECRET?.trim()) {
    throw new ApiError(503, 'Ticket signing is not configured.');
  }
  return createHmac('sha256', secret).update(value).digest();
}

export function verifyTicket(token) {
  if (typeof token !== 'string' || token.length > 256) throw new ApiError(400, 'Invalid QR ticket.');
  const [registrationId, expiry, signature, ...extra] = token.split('.');
  if (extra.length || !isUuid(registrationId) || !/^\d{1,12}$/.test(expiry) || !/^[a-f0-9]{64}$/.test(signature)) {
    throw new ApiError(400, 'Invalid QR ticket.');
  }

  if (!timingSafeEqual(Buffer.from(signature, 'hex'), sign(`${registrationId}.${expiry}`))) {
    throw new ApiError(400, 'Invalid ticket signature.');
  }
  const expiresAt = Number(expiry);
  requireUnexpired(expiresAt);
  return { registrationId, expiresAt };
}

function requireUnexpired(expiresAt) {
  if (expiresAt <= Math.floor(Date.now() / 1000)) throw new ApiError(400, 'QR ticket has expired.');
}

export async function listRegistrations(userId) {
  const { rows } = await requirePool().query(
    `SELECT r.id, e.title AS event_title, e.start_time
     FROM event_registrations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN event_attendance a ON a.registration_id = r.id
     WHERE r.user_id = $1 AND r.status = 'registered' AND a.id IS NULL
     ORDER BY e.start_time, r.id`,
    [userId],
  );
  return rows;
}

export async function listStaffEvents(user) {
  const { rows } = await requirePool().query(
    `SELECT e.id, e.title, e.start_time
     FROM events e JOIN clubs c ON c.id = e.club_id
     WHERE ($2 OR c.officer_user_id = $1)
       AND EXISTS (SELECT 1 FROM event_registrations r WHERE r.event_id = e.id)
     ORDER BY e.start_time, e.id`,
    [user.id, user.role === 'campus_admin'],
  );
  return rows;
}

/**
 * Issues a signed ticket valid for 24 hours for the authenticated owner of a current registration.
 * A registration that is inactive or already checked in cannot receive a ticket.
 *
 * @async
 * @param {string} registrationId - Registration UUID.
 * @param {AuthenticatedUser} user - User supplied by authentication middleware.
 * @returns {Promise<{ticket_token: string, expires_at: string}>} Signed token and expiration as an ISO timestamp.
 * @throws {ApiError} Invalid UUID, missing or unowned registration, ineligible registration, or unavailable configuration.
 */
export async function issueTicket(registrationId, user) {
  const id = requireId(registrationId, 'registration_id');
  const { rows: [registration] } = await requirePool().query(
    `SELECT r.id, r.status, (a.id IS NOT NULL) AS checked_in
     FROM event_registrations r
     LEFT JOIN event_attendance a ON a.registration_id = r.id
     WHERE r.id = $1 AND r.user_id = $2`,
    [id, user.id],
  );
  if (!registration) throw new ApiError(404, 'Registration not found.');
  if (registration.status !== 'registered') throw new ApiError(409, 'Registration is not active.');
  if (registration.checked_in) throw new ApiError(409, 'Attendee has already checked in.');

  const expiry = Math.floor(Date.now() / 1000) + ticketLifetimeSeconds;
  const payload = `${registration.id}.${expiry}`;
  return {
    ticket_token: `${payload}.${sign(payload).toString('hex')}`,
    expires_at: new Date(expiry * 1000).toISOString(),
  };
}

function authorizeStaff(user, officerId) {
  if (user.role !== 'campus_admin' && !(user.role === 'club_officer' && user.id === officerId)) {
    throw new ApiError(403, 'You cannot manage attendance for this event.');
  }
}

/**
 * Checks in a registered attendee using a valid signed ticket. The assigned club officer
 * or a campus administrator may check in the attendee. A transaction locks the registration
 * and the database uniqueness constraint prevents duplicate check-ins.
 *
 * @async
 * @param {string} ticketToken - Signed, unexpired attendance ticket.
 * @param {AuthenticatedUser} user - Authenticated staff member.
 * @param {string} [eventId] - Selected event UUID, which must match the ticket's registration when supplied.
 * @returns {Promise<{registration_id: string, checked_in_at: Date}>} The recorded registration and check-in time.
 * @throws {ApiError} Invalid or expired ticket, unauthorized actor, missing registration, event mismatch, ineligible registration, duplicate check-in, or unavailable configuration.
 */
export async function checkIn(ticketToken, user, eventId) {
  const selectedEvent = eventId === undefined ? null : requireId(eventId, 'event_id');
  const { registrationId, expiresAt } = verifyTicket(ticketToken);
  const client = await requirePool().connect();

  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    // Lock the registration and its ownership chain until the attendance write commits.
    const { rows: [registration] } = await client.query(
      `SELECT r.event_id, r.status, c.officer_user_id
       FROM event_registrations r
       JOIN events e ON e.id = r.event_id
       JOIN clubs c ON c.id = e.club_id
       WHERE r.id = $1
       FOR UPDATE OF r FOR SHARE OF e, c`,
      [registrationId],
    );
    if (!registration) throw new ApiError(404, 'Registration not found.');
    authorizeStaff(user, registration.officer_user_id);
    if (selectedEvent && registration.event_id !== selectedEvent) {
      throw new ApiError(409, 'QR ticket belongs to another event.');
    }
    if (registration.status !== 'registered') throw new ApiError(409, 'Registration is not active.');
    requireUnexpired(expiresAt);

    const { rows: [attendance] } = await client.query(
      `INSERT INTO event_attendance (registration_id, checked_in_by)
       VALUES ($1, $2)
       ON CONFLICT (registration_id) DO NOTHING
       RETURNING registration_id, checked_in_at`,
      [registrationId, user.id],
    );
    if (!attendance) throw new ApiError(409, 'Attendee has already checked in.');

    await client.query('COMMIT');
    return attendance;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getAttendance(eventId, user) {
  const id = requireId(eventId, 'eventId');
  const { rows } = await requirePool().query(
    `SELECT c.officer_user_id, roster.*
     FROM events e
     JOIN clubs c ON c.id = e.club_id
     LEFT JOIN LATERAL (
       SELECT r.id AS registration_id, r.user_id, u.full_name, r.status,
              a.checked_in_at, a.checked_in_by, (a.id IS NOT NULL) AS checked_in
       FROM event_registrations r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN event_attendance a ON a.registration_id = r.id
       WHERE r.event_id = e.id AND (r.status = 'registered' OR a.id IS NOT NULL)
         AND ($3 OR c.officer_user_id = $2)
     ) roster ON TRUE
     WHERE e.id = $1
     ORDER BY roster.full_name, roster.registration_id`,
    [id, user.id, user.role === 'campus_admin'],
  );
  if (!rows.length) throw new ApiError(404, 'Event not found.');
  authorizeStaff(user, rows[0].officer_user_id);
  return rows.filter((row) => row.registration_id).map(({ officer_user_id, ...row }) => row);
}
