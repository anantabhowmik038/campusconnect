import { getDatabasePool } from '../config/database.js';
import { ApiError } from '../middleware/apiError.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requirePool() {
  const pool = getDatabasePool();
  if (!pool) throw new ApiError(503, 'Database is not configured.');
  return pool;
}

function requireUuid(value, field) {
  if (!value || !uuidPattern.test(value)) {
    throw new ApiError(400, `${field} must be a valid UUID.`);
  }
  return value;
}

async function requireActiveUser(pool, request) {
  if (!request.user?.id) throw new ApiError(401, 'Authentication is required.');
  const userId = requireUuid(request.user.id, 'authenticated user ID');
  const result = await pool.query(
    'SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE',
    [userId],
  );
  if (!result.rows[0]) throw new ApiError(403, 'Active user identity is required.');
  return result.rows[0];
}

async function requireClubAccess(pool, actor, clubId) {
  if (actor.role === 'campus_admin') return;
  if (actor.role !== 'club_officer') {
    throw new ApiError(403, 'Campus administrator or authorized club officer access is required.');
  }
  const result = await pool.query(
    'SELECT id FROM clubs WHERE id = $1 AND officer_user_id = $2',
    [clubId, actor.id],
  );
  if (!result.rows[0]) {
    throw new ApiError(403, 'You are not authorized to view analytics for this club.');
  }
}

async function requireEventAccess(pool, actor, eventId) {
  if (actor.role === 'campus_admin') return;
  if (actor.role !== 'club_officer') {
    throw new ApiError(403, 'Campus administrator or authorized club officer access is required.');
  }
  const result = await pool.query(
    `SELECT e.id
     FROM events e
     JOIN clubs c ON c.id = e.club_id
     WHERE e.id = $1 AND c.officer_user_id = $2`,
    [eventId, actor.id],
  );
  if (!result.rows[0]) {
    throw new ApiError(403, 'You are not authorized to view analytics for this event.');
  }
}

export async function getOverviewMetrics(request) {
  const pool = requirePool();
  const actor = await requireActiveUser(pool, request);
  if (actor.role !== 'campus_admin') {
    throw new ApiError(403, 'Campus administrator access is required.');
  }
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM clubs WHERE status = 'active') AS active_clubs,
       (SELECT COUNT(*)::int FROM events) AS total_events,
       (SELECT COUNT(*)::int FROM events WHERE status = 'completed') AS completed_events,
       (SELECT COUNT(*)::int FROM event_registrations WHERE status = 'registered') AS registrations,
       (SELECT COUNT(*)::int FROM event_attendance ea
          JOIN event_registrations er ON er.id = ea.registration_id
          WHERE er.status = 'registered') AS attendance,
       (SELECT COUNT(*)::int FROM event_feedback) AS feedback_count,
       (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float FROM event_feedback) AS average_rating`,
  );
  return result.rows[0];
}

export async function getClubMetrics(request, clubId) {
  const validClubId = requireUuid(clubId, 'clubId');
  const pool = requirePool();
  const actor = await requireActiveUser(pool, request);
  await requireClubAccess(pool, actor, validClubId);

  const club = await pool.query(
    'SELECT id, name, status FROM clubs WHERE id = $1',
    [validClubId],
  );
  if (!club.rows[0]) throw new ApiError(404, 'Club was not found.');

  const metrics = await pool.query(
    `WITH event_stats AS (
       SELECT COUNT(*)::int AS total_events,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_events
       FROM events WHERE club_id = $1
     ), registration_stats AS (
       SELECT COUNT(*)::int AS registrations
       FROM event_registrations er
       JOIN events e ON e.id = er.event_id
       WHERE e.club_id = $1 AND er.status = 'registered'
     ), attendance_stats AS (
       SELECT COUNT(*)::int AS attendance
       FROM event_attendance ea
       JOIN event_registrations er ON er.id = ea.registration_id
       JOIN events e ON e.id = er.event_id
       WHERE e.club_id = $1 AND er.status = 'registered'
     ), feedback_stats AS (
       SELECT COUNT(*)::int AS feedback_count,
              COALESCE(ROUND(AVG(ef.rating)::numeric, 2), 0)::float AS average_rating
       FROM event_feedback ef
       JOIN events e ON e.id = ef.event_id
       WHERE e.club_id = $1
     )
     SELECT es.total_events, es.completed_events, rs.registrations,
            ats.attendance, fs.feedback_count, fs.average_rating
     FROM event_stats es, registration_stats rs, attendance_stats ats, feedback_stats fs`,
    [validClubId],
  );
  const events = await pool.query(
    `SELECT e.id, e.title, e.status, e.start_time, e.end_time,
            (SELECT COUNT(*)::int FROM event_registrations er
             WHERE er.event_id = e.id AND er.status = 'registered') AS registrations,
            (SELECT COUNT(*)::int FROM event_attendance ea
             JOIN event_registrations er ON er.id = ea.registration_id
             WHERE er.event_id = e.id AND er.status = 'registered') AS attendance,
            (SELECT COUNT(*)::int FROM event_feedback ef WHERE ef.event_id = e.id) AS feedback_count,
            (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float
             FROM event_feedback WHERE event_id = e.id) AS average_rating
     FROM events e
     WHERE e.club_id = $1
     ORDER BY e.start_time DESC
     LIMIT 100`,
    [validClubId],
  );
  return { club: club.rows[0], metrics: metrics.rows[0] || {}, events: events.rows };
}

export async function getEventMetrics(request, eventId) {
  const validEventId = requireUuid(eventId, 'eventId');
  const pool = requirePool();
  const actor = await requireActiveUser(pool, request);
  await requireEventAccess(pool, actor, validEventId);

  const event = await pool.query(
    `SELECT e.id, e.title, e.status, e.capacity, e.start_time, e.end_time, c.id AS club_id, c.name AS club_name
     FROM events e JOIN clubs c ON c.id = e.club_id
     WHERE e.id = $1`,
    [validEventId],
  );
  if (!event.rows[0]) throw new ApiError(404, 'Event was not found.');

  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM event_registrations
        WHERE event_id = $1 AND status = 'registered') AS registrations,
       (SELECT COUNT(*)::int FROM event_registrations
        WHERE event_id = $1 AND status = 'waitlisted') AS waitlist_count,
       (SELECT COUNT(*)::int FROM event_attendance ea
        JOIN event_registrations er ON er.id = ea.registration_id
        WHERE er.event_id = $1 AND er.status = 'registered') AS attendance,
       (SELECT COUNT(*)::int FROM event_feedback WHERE event_id = $1) AS feedback_count,
       (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float
        FROM event_feedback WHERE event_id = $1) AS average_rating,
       (SELECT COUNT(*)::int FROM event_feedback WHERE event_id = $1 AND rating = 5) AS five_star_count,
       (SELECT COUNT(*)::int FROM event_feedback WHERE event_id = $1 AND rating = 4) AS four_star_count,
       (SELECT COUNT(*)::int FROM event_feedback WHERE event_id = $1 AND rating = 3) AS three_star_count,
       (SELECT COUNT(*)::int FROM event_feedback WHERE event_id = $1 AND rating = 2) AS two_star_count,
       (SELECT COUNT(*)::int FROM event_feedback WHERE event_id = $1 AND rating = 1) AS one_star_count`,
    [validEventId],
  );
  return { event: event.rows[0], metrics: result.rows[0] || {} };
}

export async function exportAnalyticsCsv(request, clubId) {
  const validClubId = clubId ? requireUuid(clubId, 'clubId') : null;
  const pool = requirePool();
  const actor = await requireActiveUser(pool, request);
  if (validClubId) await requireClubAccess(pool, actor, validClubId);
  else if (actor.role !== 'campus_admin') {
    throw new ApiError(403, 'Campus administrator access is required.');
  }

  const result = await pool.query(
    `SELECT c.name AS club_name, e.title AS event_title, e.status,
            (SELECT COUNT(*)::int FROM event_registrations er
             WHERE er.event_id = e.id AND er.status = 'registered') AS registrations,
            (SELECT COUNT(*)::int FROM event_attendance ea
             JOIN event_registrations er ON er.id = ea.registration_id
             WHERE er.event_id = e.id AND er.status = 'registered') AS attendance,
            (SELECT COUNT(*)::int FROM event_feedback ef WHERE ef.event_id = e.id) AS feedback_count,
            (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float
             FROM event_feedback WHERE event_id = e.id) AS average_rating
     FROM clubs c
     LEFT JOIN events e ON e.club_id = c.id
     ${validClubId ? 'WHERE c.id = $1' : ''}
     ORDER BY c.name, e.start_time DESC
     LIMIT 1000`,
    validClubId ? [validClubId] : [],
  );

  const escapeCsv = (value) => {
    const text = value == null ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const header = ['club_name', 'event_title', 'status', 'registrations', 'attendance', 'feedback_count', 'average_rating'];
  const rows = result.rows.map((row) =>
    header.map((column) => escapeCsv(row[column])).join(','),
  );
  return [header.join(','), ...rows].join('\r\n');
}
