import { createHmac, timingSafeEqual } from 'node:crypto';
import { getDatabasePool } from '../config/database.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(status, message) {
  throw Object.assign(new Error(message), {
    status,
    statusCode: status,
  });
}

function sign(value) {
  const secret = process.env.ATTENDANCE_TICKET_SECRET;

  if (!secret || Buffer.byteLength(secret) < 32) {
    fail(503, 'Ticket signing is not configured');
  }

  return createHmac('sha256', secret).update(value).digest('hex');
}

export function verifyTicket(token) {
  if (typeof token !== 'string' || token.length > 256) {
    fail(400, 'Invalid QR ticket');
  }

  const parts = token.split('.');

  if (parts.length !== 3) {
    fail(400, 'Invalid QR ticket');
  }

  const [registrationId, expiry, signature] = parts;

  if (
    !UUID.test(registrationId) ||
    !/^\d{1,12}$/.test(expiry) ||
    !/^[0-9a-f]{64}$/.test(signature)
  ) {
    fail(400, 'Invalid QR ticket');
  }

  const expected = sign(`${registrationId}.${expiry}`);

  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    fail(400, 'Invalid ticket signature');
  }

  if (Number(expiry) <= Math.floor(Date.now() / 1000)) {
    fail(400, 'QR ticket has expired');
  }

  return registrationId;
}

export async function issueTicket(registrationId, user) {
  const pool = getDatabasePool();

  const result = await pool.query(
    `
    SELECT id, user_id, status
    FROM event_registrations
    WHERE id = $1
  `,
    [registrationId],
  );

  const registration = result.rows[0];

  if (!registration) {
    fail(404, 'Registration not found');
  }

  if (registration.user_id !== user.id) {
    fail(403, 'Permission denied');
  }

  if (registration.status !== 'registered') {
    fail(409, 'Registration is not active');
  }

  const expiry = Math.floor(Date.now() / 1000) + 86400;
  const payload = `${registrationId}.${expiry}`;

  return {
    ticket_token: `${payload}.${sign(payload)}`,
    expires_at: new Date(expiry * 1000).toISOString(),
  };
}

function authorizeStaff(user, officerId) {
  if (user.role !== 'campus_admin' && !(user.role === 'club_officer' && user.id === officerId)) {
    fail(403, 'You cannot manage attendance for this event');
  }
}

export async function checkIn(ticketToken, user) {
  const registrationId = verifyTicket(ticketToken);
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
      SELECT r.id, r.status, c.officer_user_id
      FROM event_registrations r
      JOIN events e ON e.id = r.event_id
      JOIN clubs c ON c.id = e.club_id
      WHERE r.id = $1
      FOR UPDATE OF r
    `,
      [registrationId],
    );

    const registration = result.rows[0];

    if (!registration) {
      fail(404, 'Registration not found');
    }

    authorizeStaff(user, registration.officer_user_id);

    if (registration.status !== 'registered') {
      fail(409, 'Registration is not active');
    }

    const attendance = await client.query(
      `
      INSERT INTO event_attendance
        (registration_id, checked_in_by)
      VALUES ($1, $2)
      ON CONFLICT (registration_id) DO NOTHING
      RETURNING registration_id, checked_in_at
    `,
      [registrationId, user.id],
    );

    if (!attendance.rows.length) {
      fail(409, 'Attendee has already checked in');
    }

    await client.query('COMMIT');

    return attendance.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getAttendance(eventId, user) {
  const pool = getDatabasePool();

  const event = await pool.query(
    `
    SELECT c.officer_user_id
    FROM events e
    JOIN clubs c ON c.id = e.club_id
    WHERE e.id = $1
  `,
    [eventId],
  );

  if (!event.rows.length) {
    fail(404, 'Event not found');
  }

  authorizeStaff(user, event.rows[0].officer_user_id);

  const result = await pool.query(
    `
    SELECT
      r.id AS registration_id,
      r.user_id,
      u.full_name,
      r.status,
      a.checked_in_at,
      a.checked_in_by,
      (a.id IS NOT NULL) AS checked_in
    FROM event_registrations r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN event_attendance a
      ON a.registration_id = r.id
    WHERE r.event_id = $1
      AND (r.status = 'registered' OR a.id IS NOT NULL)
    ORDER BY u.full_name
  `,
    [eventId],
  );

  return result.rows;
}
