import { getDatabasePool } from '../config/database.js';
import { ApiError } from '../middleware/apiError.js';
import { isUuid } from '../validation/eventValidation.js';

const timestamp = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function requirePool() {
  const pool = getDatabasePool();
  if (!pool) throw new ApiError(503, 'Database is not configured.');
  return pool;
}

function requireId(value, field) {
  if (!isUuid(value)) throw new ApiError(400, field + ' must be a valid UUID.');
  return value;
}

function bookingTime(value, field) {
  if (typeof value !== 'string' || !timestamp.test(value) || value.startsWith('0000')) {
    throw new ApiError(400, field + ' must be a timestamp with a timezone.');
  }
  const day = new Date(value.slice(0, 10) + 'T00:00:00Z');
  const time = new Date(value);
  if (!Number.isFinite(+time) || !Number.isFinite(+day) || day.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    throw new ApiError(400, field + ' must be a valid calendar date and time.');
  }
  return time;
}

async function inTransaction(operation) {
  const client = await requirePool().connect();
  try {
    // Recheck availability in a new statement snapshot after taking the venue lock.
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function lockVenue(client, venueId) {
  const { rows: [venue] } = await client.query(
    'SELECT is_active FROM venues WHERE id = $1 FOR NO KEY UPDATE',
    [venueId],
  );
  return venue?.is_active;
}

async function checkAvailability(client, venueId, start, end) {
  const { rows } = await client.query(
    `SELECT 1 FROM venue_bookings
     WHERE venue_id = $1 AND status = 'approved'
       AND start_time < $3 AND end_time > $2
     LIMIT 1`,
    [venueId, start, end],
  );
  if (rows.length) throw new ApiError(409, 'Venue booking time conflict.');
}

export async function getVenues(user) {
  const { rows } = await requirePool().query(
    'SELECT id, name, location, capacity, is_active FROM venues WHERE is_active OR $1 ORDER BY is_active DESC, name, id',
    [user.role === 'campus_admin'],
  );
  return rows;
}

export async function getBookingEvents(userId) {
  const { rows } = await requirePool().query(
    `SELECT e.id, e.title, e.start_time, e.end_time
     FROM events e JOIN clubs c ON c.id = e.club_id
     WHERE c.officer_user_id = $1 AND c.status = 'active'
     ORDER BY e.start_time, e.id`,
    [userId],
  );
  return rows;
}

export async function getVenueBookings(venueId, user) {
  requireId(venueId, 'venueId');
  const pool = requirePool();
  const admin = user.role === 'campus_admin';
  const { rowCount } = await pool.query(
    'SELECT 1 FROM venues WHERE id = $1 AND (is_active OR $2)',
    [venueId, admin],
  );
  if (!rowCount) throw new ApiError(404, 'Venue not found.');

  const { rows } = await pool.query(
    `SELECT b.id, b.venue_id, b.start_time, b.end_time, b.status,
            CASE WHEN $3 OR c.officer_user_id = $2 OR e.status IN ('published', 'completed')
                 THEN e.id END AS event_id,
            CASE WHEN $3 OR c.officer_user_id = $2 OR e.status IN ('published', 'completed')
                 THEN e.title END AS event_title
     FROM venue_bookings b
     JOIN events e ON e.id = b.event_id
     JOIN clubs c ON c.id = e.club_id
     WHERE b.venue_id = $1
       AND ($3 OR b.status = 'approved' OR ($4 AND c.officer_user_id = $2))
     ORDER BY b.start_time, b.end_time, b.id`,
    [venueId, user.id, admin, user.role === 'club_officer'],
  );
  return rows;
}

export async function createBooking(data, user) {
  const eventId = requireId(data?.event_id, 'event_id');
  const venueId = requireId(data?.venue_id, 'venue_id');
  const start = bookingTime(data?.start_time, 'start_time');
  const end = bookingTime(data?.end_time, 'end_time');
  if (end <= start) throw new ApiError(400, 'end_time must be after start_time.');

  return inTransaction(async (client) => {
    const { rows: [event] } = await client.query(
      `SELECT c.officer_user_id, c.status FROM events e
       JOIN clubs c ON c.id = e.club_id WHERE e.id = $1
       FOR SHARE OF e, c`,
      [eventId],
    );
    if (!event) throw new ApiError(404, 'Event not found.');
    if (event.officer_user_id !== user.id || event.status !== 'active') {
      throw new ApiError(403, 'Only the assigned officer of an active club can book for this event.');
    }
    if (!await lockVenue(client, venueId)) throw new ApiError(404, 'Active venue not found.');
    await checkAvailability(client, venueId, start, end);

    const { rows: [booking] } = await client.query(
      `INSERT INTO venue_bookings (event_id, venue_id, requested_by, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, status`,
      [eventId, venueId, user.id, start, end],
    );
    return booking;
  });
}

export async function reviewBooking(bookingId, status, user) {
  requireId(bookingId, 'bookingId');
  if (!['approved', 'rejected'].includes(status)) throw new ApiError(400, 'Invalid review status.');

  return inTransaction(async (client) => {
    const { rows: [booking] } = await client.query(
      `SELECT venue_id, status, start_time::text, end_time::text
       FROM venue_bookings WHERE id = $1 FOR UPDATE`,
      [bookingId],
    );
    if (!booking) throw new ApiError(404, 'Booking not found.');
    if (booking.status !== 'pending') throw new ApiError(409, 'Booking has already been reviewed.');

    if (status === 'approved') {
      if (!await lockVenue(client, booking.venue_id)) throw new ApiError(409, 'Venue is inactive.');
      await checkAvailability(client, booking.venue_id, booking.start_time, booking.end_time);
    }

    const { rows: [updated] } = await client.query(
      'UPDATE venue_bookings SET status = $1, reviewed_by = $2 WHERE id = $3 RETURNING *',
      [status, user.id, bookingId],
    );
    return updated;
  });
}
