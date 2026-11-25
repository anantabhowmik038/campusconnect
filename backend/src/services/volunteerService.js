import { getDatabasePool } from '../config/database.js';

function fail(status, message) {
  throw Object.assign(new Error(message), {
    status,
    statusCode: status,
  });
}

function authorizeOfficer(user, officerId) {
  if (user.role !== 'campus_admin' && !(user.role === 'club_officer' && user.id === officerId)) {
    fail(403, 'Permission denied');
  }
}

async function transaction(work) {
  const client = await getDatabasePool().connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function checkShiftConflict(client, userId, shiftId) {
  const result = await client.query(
    `
    SELECT a.id
    FROM volunteer_applications a
    JOIN volunteer_shifts s ON s.id = a.shift_id
    JOIN volunteer_shifts target ON target.id = $2
    WHERE a.user_id = $1
      AND a.status = 'accepted'
      AND s.id <> target.id
      AND s.start_time < target.end_time
      AND s.end_time > target.start_time
  `,
    [userId, shiftId],
  );

  if (result.rows.length) {
    fail(409, 'Volunteer shift time conflict');
  }
}

export async function getShifts(eventId) {
  const pool = getDatabasePool();

  const result = await pool.query(
    `
    SELECT s.*,
      (
        SELECT COUNT(*)::int
        FROM volunteer_applications a
        WHERE a.shift_id = s.id
          AND a.status = 'accepted'
      ) AS accepted_volunteers
    FROM volunteer_shifts s
    WHERE s.event_id = $1
    ORDER BY s.start_time
  `,
    [eventId],
  );

  return result.rows;
}

export async function createShift(eventId, data, user) {
  const pool = getDatabasePool();

  const { title, start_time, end_time, required_volunteers } = data;

  if (
    typeof title !== 'string' ||
    !title.trim() ||
    title.trim().length > 150 ||
    !Number.isInteger(required_volunteers) ||
    required_volunteers <= 0 ||
    required_volunteers > 2147483647
  ) {
    fail(400, 'Invalid shift details');
  }

  if (
    typeof start_time !== 'string' ||
    typeof end_time !== 'string' ||
    !Number.isFinite(Date.parse(start_time)) ||
    !Number.isFinite(Date.parse(end_time)) ||
    new Date(end_time) <= new Date(start_time)
  ) {
    fail(400, 'Invalid shift time');
  }

  const event = await pool.query(
    `
    SELECT e.id, c.officer_user_id
    FROM events e
    JOIN clubs c ON c.id = e.club_id
    WHERE e.id = $1
  `,
    [eventId],
  );

  if (!event.rows.length) {
    fail(404, 'Event not found');
  }

  authorizeOfficer(user, event.rows[0].officer_user_id);

  const result = await pool.query(
    `
    INSERT INTO volunteer_shifts
      (event_id, title, start_time, end_time,
       required_volunteers)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `,
    [eventId, title.trim(), start_time, end_time, required_volunteers],
  );

  return result.rows[0];
}

export async function applyForShift(shiftId, user) {
  if (user.role !== 'student') {
    fail(403, 'Only students can apply');
  }

  return transaction(async (client) => {
    const shift = await client.query(
      `
      SELECT id
      FROM volunteer_shifts
      WHERE id = $1
      FOR UPDATE
    `,
      [shiftId],
    );

    if (!shift.rows.length) {
      fail(404, 'Volunteer shift not found');
    }

    await client.query(
      `
      SELECT id FROM users
      WHERE id = $1
      FOR NO KEY UPDATE
    `,
      [user.id],
    );

    await checkShiftConflict(client, user.id, shiftId);

    const existing = await client.query(
      `
      SELECT id
      FROM volunteer_applications
      WHERE shift_id = $1 AND user_id = $2
    `,
      [shiftId, user.id],
    );

    if (existing.rows.length) {
      fail(409, 'You have already applied');
    }

    const result = await client.query(
      `
      INSERT INTO volunteer_applications
        (shift_id, user_id, status)
      VALUES ($1, $2, 'pending')
      RETURNING *
    `,
      [shiftId, user.id],
    );

    return result.rows[0];
  });
}

export async function reviewApplication(applicationId, status, user) {
  if (!['accepted', 'rejected'].includes(status)) {
    fail(400, 'Invalid application status');
  }

  return transaction(async (client) => {
    const initial = await client.query(
      `
      SELECT shift_id
      FROM volunteer_applications
      WHERE id = $1
    `,
      [applicationId],
    );

    if (!initial.rows.length) {
      fail(404, 'Application not found');
    }

    const shiftId = initial.rows[0].shift_id;

    const shifts = await client.query(
      `
      SELECT s.*, c.officer_user_id
      FROM volunteer_shifts s
      JOIN events e ON e.id = s.event_id
      JOIN clubs c ON c.id = e.club_id
      WHERE s.id = $1
      FOR UPDATE OF s
    `,
      [shiftId],
    );

    const shift = shifts.rows[0];

    if (!shift) {
      fail(404, 'Volunteer shift not found');
    }

    authorizeOfficer(user, shift.officer_user_id);

    const result = await client.query(
      `
      SELECT *
      FROM volunteer_applications
      WHERE id = $1 AND shift_id = $2
      FOR UPDATE
    `,
      [applicationId, shiftId],
    );

    const application = result.rows[0];

    if (!application) {
      fail(404, 'Application not found');
    }

    if (application.status !== 'pending') {
      fail(409, 'Application already reviewed');
    }

    if (status === 'accepted') {
      await client.query(
        `
        SELECT id FROM users
        WHERE id = $1
        FOR NO KEY UPDATE
      `,
        [application.user_id],
      );

      await checkShiftConflict(client, application.user_id, shiftId);

      const count = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM volunteer_applications
        WHERE shift_id = $1
          AND status = 'accepted'
      `,
        [shiftId],
      );

      if (count.rows[0].total >= shift.required_volunteers) {
        fail(409, 'Volunteer shift is full');
      }
    }

    const updated = await client.query(
      `
      UPDATE volunteer_applications
      SET status = $1, reviewed_by = $2
      WHERE id = $3
      RETURNING *
    `,
      [status, user.id, applicationId],
    );

    return updated.rows[0];
  });
}
