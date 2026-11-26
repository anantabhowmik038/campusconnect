import { getDatabasePool } from '../config/database.js';
import { ApiError } from '../middleware/apiError.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requirePool() {
  const pool = getDatabasePool();
  if (!pool) throw new ApiError(503, 'Database is not configured.');
  return pool;
}

function requireUuid(value, field) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new ApiError(400, `${field} must be a valid UUID.`);
  }
  return value;
}

function requireRating(rating) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, 'rating must be an integer from 1 to 5.');
  }
  return rating;
}

function validateComment(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 2000) {
    throw new ApiError(400, 'comment must be at most 2000 characters.');
  }
  return value.trim() || null;
}

function getUserId(request) {
  if (!request.user?.id) throw new ApiError(401, 'Authentication is required.');
  return requireUuid(request.user.id, 'authenticated user ID');
}

export async function listEligibleEvents(request) {
  const userId = getUserId(request);
  const pool = requirePool();
  const result = await pool.query(
    `SELECT e.id, e.title, e.start_time, e.end_time, e.club_id,
            ef.id AS feedback_id, ef.rating AS existing_rating,
            ef.comment AS existing_comment
     FROM event_attendance ea
     JOIN event_registrations er ON er.id = ea.registration_id
     JOIN events e ON e.id = er.event_id
     LEFT JOIN event_feedback ef
       ON ef.event_id = e.id AND ef.user_id = er.user_id
     WHERE er.user_id = $1 AND e.status = 'completed'
     ORDER BY e.end_time DESC`,
    [userId],
  );
  return result.rows;
}

export async function getFeedbackSummary(eventId) {
  const validEventId = requireUuid(eventId, 'eventId');
  const pool = requirePool();
  const event = await pool.query(
    "SELECT id, title, status FROM events WHERE id = $1 AND status = 'completed'",
    [validEventId],
  );
  if (!event.rows[0]) throw new ApiError(404, 'Event was not found.');

  const summary = await pool.query(
    `SELECT COUNT(*)::int AS review_count,
            COALESCE(ROUND(AVG(rating)::numeric, 2), 0)::float AS average_rating,
            COUNT(*) FILTER (WHERE rating = 5)::int AS five_star_count,
            COUNT(*) FILTER (WHERE rating = 4)::int AS four_star_count,
            COUNT(*) FILTER (WHERE rating = 3)::int AS three_star_count,
            COUNT(*) FILTER (WHERE rating = 2)::int AS two_star_count,
            COUNT(*) FILTER (WHERE rating = 1)::int AS one_star_count
     FROM event_feedback
     WHERE event_id = $1`,
    [validEventId],
  );
  const reviews = await pool.query(
    `SELECT ef.id, ef.rating, ef.comment, ef.created_at, u.full_name AS reviewer_name
     FROM event_feedback ef
     JOIN users u ON u.id = ef.user_id
     WHERE ef.event_id = $1
     ORDER BY ef.created_at DESC
     LIMIT 100`,
    [validEventId],
  );
  return { event: event.rows[0], summary: summary.rows[0], reviews: reviews.rows };
}

export async function saveFeedback(request, eventId, input = {}) {
  const userId = getUserId(request);
  const validEventId = requireUuid(eventId, 'eventId');
  const rating = requireRating(input?.rating);
  const comment = validateComment(input.comment);
  const pool = requirePool();

  const eligibility = await pool.query(
    `SELECT e.status
     FROM event_attendance ea
     JOIN event_registrations er ON er.id = ea.registration_id
     JOIN events e ON e.id = er.event_id
     WHERE e.id = $1 AND er.user_id = $2`,
    [validEventId, userId],
  );
  if (!eligibility.rows[0]) {
    throw new ApiError(403, 'Feedback is available only to users who attended the event.');
  }
  if (eligibility.rows[0].status !== 'completed') {
    throw new ApiError(409, 'Feedback is available after the event is completed.');
  }

  const result = await pool.query(
    `INSERT INTO event_feedback (event_id, user_id, rating, comment)
     SELECT e.id, er.user_id, $3, $4
     FROM event_attendance ea
     JOIN event_registrations er ON er.id = ea.registration_id
     JOIN events e ON e.id = er.event_id
     WHERE e.id = $1 AND er.user_id = $2 AND e.status = 'completed'
     ON CONFLICT (event_id, user_id)
     DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
     RETURNING id, event_id, user_id, rating, comment, created_at`,
    [validEventId, userId, rating, comment],
  );
  if (!result.rows[0]) throw new ApiError(409, 'Feedback eligibility changed. Refresh eligible events and try again.');
  return result.rows[0];
}

export async function deleteFeedback(request, feedbackId) {
  const userId = getUserId(request);
  const validFeedbackId = requireUuid(feedbackId, 'feedbackId');
  const pool = requirePool();
  const result = await pool.query(
    `DELETE FROM event_feedback ef
     WHERE ef.id = $1 AND (ef.user_id = $2 OR $3 = 'campus_admin')
     RETURNING ef.id`,
    [validFeedbackId, userId, request.user.role],
  );
  if (!result.rows[0]) throw new ApiError(404, 'Feedback was not found or cannot be deleted.');
  return { deleted: true };
}
