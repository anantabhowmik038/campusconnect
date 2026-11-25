import { getDatabasePool } from '../config/database.js';

function fail(status, message) {
  throw Object.assign(new Error(message), { status, statusCode: status });
}

export async function getVenues() {
  const pool = getDatabasePool();

  const result = await pool.query(`
    SELECT id, name, location, capacity, is_active
    FROM venues
    WHERE is_active = TRUE
    ORDER BY name
  `);

  return result.rows;
}

export async function getVenueBookings(venueId) {
  const pool = getDatabasePool();

  const result = await pool.query(
    `
    SELECT id, venue_id, event_id,
           start_time, end_time, status
    FROM venue_bookings
    WHERE venue_id = $1
    ORDER BY start_time
  `,
    [venueId],
  );

  return result.rows;
}

export async function createBooking(data, user) {
  const pool = getDatabasePool();

  const { event_id, venue_id, start_time, end_time } = data;

  if (!user?.id) {
    fail(401, 'Authentication required');
  }

  if (user.role !== 'club_officer') {
    fail(403, 'Permission denied');
  }

  if (!event_id || !venue_id || !start_time || !end_time) {
    fail(400, 'All booking fields are required');
  }

  if (
    !Number.isFinite(Date.parse(start_time)) ||
    !Number.isFinite(Date.parse(end_time)) ||
    new Date(end_time) <= new Date(start_time)
  ) {
    fail(400, 'Invalid booking time');
  }

  const event = await pool.query(
    `
    SELECT e.id, c.officer_user_id
    FROM events e
    JOIN clubs c ON e.club_id = c.id
    WHERE e.id = $1
  `,
    [event_id],
  );

  if (!event.rows.length) {
    fail(404, 'Event not found');
  }

  if (event.rows[0].officer_user_id !== user.id) {
    fail(403, 'You cannot manage this event');
  }

  const venue = await pool.query(
    `
    SELECT id FROM venues
    WHERE id = $1 AND is_active = TRUE
  `,
    [venue_id],
  );

  if (!venue.rows.length) {
    fail(404, 'Active venue not found');
  }

  const result = await pool.query(
    `
    INSERT INTO venue_bookings
      (event_id, venue_id, requested_by,
       start_time, end_time, status)
    VALUES ($1, $2, $3, $4, $5, 'pending')
    RETURNING id, status
  `,
    [event_id, venue_id, user.id, start_time, end_time],
  );

  return result.rows[0];
}

export async function reviewBooking(bookingId, status, user) {
  if (!user?.id) {
    fail(401, 'Authentication required');
  }

  if (user.role !== 'campus_admin') {
    fail(403, 'Admin permission required');
  }

  if (!['approved', 'rejected'].includes(status)) {
    fail(400, 'Invalid review status');
  }

  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
      SELECT *
      FROM venue_bookings
      WHERE id = $1
      FOR UPDATE
    `,
      [bookingId],
    );

    if (!result.rows.length) {
      fail(404, 'Booking not found');
    }

    const booking = result.rows[0];

    if (booking.status !== 'pending') {
      fail(409, 'Booking has already been reviewed');
    }

    if (status === 'approved') {
      const venue = await client.query(
        `
        SELECT id, is_active FROM venues
        WHERE id = $1
        FOR UPDATE
      `,
        [booking.venue_id],
      );

      if (!venue.rows[0]?.is_active) {
        fail(409, 'Venue is inactive');
      }

      const conflict = await client.query(
        `
        SELECT id
        FROM venue_bookings
        WHERE venue_id = $1
          AND status = 'approved'
          AND start_time < $2
          AND end_time > $3
          AND id <> $4
      `,
        [booking.venue_id, booking.end_time, booking.start_time, bookingId],
      );

      if (conflict.rows.length > 0) {
        fail(409, 'Venue booking time conflict');
      }
    }

    const updated = await client.query(
      `
      UPDATE venue_bookings
      SET status = $1, reviewed_by = $2
      WHERE id = $3
      RETURNING *
    `,
      [status, user.id, bookingId],
    );

    await client.query('COMMIT');

    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
