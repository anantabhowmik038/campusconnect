import { getDatabasePool } from '../config/database.js';
import { ApiError } from '../middleware/apiError.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requirePool() {
  const pool = getDatabasePool();
  if (!pool) {
    throw new ApiError(503, 'Database is not configured.');
  }
  return pool;
}

function requireUuid(value, field) {
  if (!value || !uuidPattern.test(value)) {
    throw new ApiError(400, `${field} must be a valid UUID.`);
  }
  return value;
}

function requireText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new ApiError(400, `${field} is required and must be at most ${maxLength} characters.`);
  }
  return value.trim();
}

function getUserId(request) {
  if (!request.user?.id) {
    throw new ApiError(401, 'Authentication token is required.');
  }
  return requireUuid(request.user.id, 'Authenticated user ID');
}

async function getActor(pool, userId) {
  const result = await pool.query(
    'SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE',
    [userId],
  );
  if (!result.rows[0]) throw new ApiError(403, 'Active user identity is required.');
  return result.rows[0];
}

async function getAnnouncementRecipients(pool, { clubId, eventId }) {
  const result = clubId
    ? await pool.query(
      `SELECT cm.user_id
       FROM club_memberships cm
       WHERE cm.club_id = $1 AND cm.status = 'approved'`,
      [clubId],
    )
    : await pool.query(
      `SELECT er.user_id
       FROM event_registrations er
       WHERE er.event_id = $1 AND er.status = 'registered'`,
      [eventId],
    );
  return result.rows.map(({ user_id }) => user_id);
}

export async function listAnnouncements({ clubId, eventId }) {
  const values = [];
  const filters = [];
  const validClubId = clubId ? requireUuid(clubId, 'clubId') : null;
  const validEventId = eventId ? requireUuid(eventId, 'eventId') : null;
  const pool = requirePool();
  if (validClubId) filters.push(`a.club_id = $${values.push(validClubId)}`);
  if (validEventId) filters.push(`a.event_id = $${values.push(validEventId)}`);
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT a.id, a.club_id, a.event_id, a.title, a.content, a.created_by,
            a.created_at, u.full_name AS author_name,
            c.name AS club_name, e.title AS event_title
     FROM announcements a
     JOIN users u ON u.id = a.created_by
     LEFT JOIN clubs c ON c.id = a.club_id
     LEFT JOIN events e ON e.id = a.event_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT 100`,
    values,
  );
  return result.rows;
}

export async function createAnnouncement(request, input) {
  const createdBy = getUserId(request);
  const title = requireText(input.title, 'title', 200);
  const content = requireText(input.content, 'content', 5000);
  const clubId = input.clubId ? requireUuid(input.clubId, 'clubId') : null;
  const eventId = input.eventId ? requireUuid(input.eventId, 'eventId') : null;
  if ((clubId ? 1 : 0) + (eventId ? 1 : 0) !== 1) {
    throw new ApiError(400, 'Exactly one of clubId or eventId is required.');
  }
  const pool = requirePool();

  const actor = await getActor(pool, createdBy);
  if (actor.role !== 'campus_admin') {
    const ownership = clubId
      ? await pool.query('SELECT officer_user_id FROM clubs WHERE id = $1', [clubId])
      : await pool.query(
        'SELECT c.officer_user_id FROM events e JOIN clubs c ON c.id = e.club_id WHERE e.id = $1',
        [eventId],
      );
    if (!ownership.rows[0]) throw new ApiError(404, 'Announcement target was not found.');
    if (ownership.rows[0].officer_user_id !== createdBy) {
      throw new ApiError(403, 'Only the club officer or a campus administrator can publish this announcement.');
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const announcement = await client.query(
      `INSERT INTO announcements (club_id, event_id, created_by, title, content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, club_id, event_id, title, content, created_by, created_at`,
      [clubId, eventId, createdBy, title, content],
    );
    const recipients = await getAnnouncementRecipients(client, { clubId, eventId });
    for (const recipientId of recipients) {
      await client.query(
        `INSERT INTO notifications
          (user_id, title, message, type, reference_url)
         VALUES ($1, $2, $3, 'announcement', $4)`,
        [recipientId, title, content, `/announcements/${announcement.rows[0].id}`],
      );
    }
    await client.query('COMMIT');
    return { ...announcement.rows[0], notified_user_count: recipients.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listNotifications(request, { unreadOnly = false } = {}) {
  const userId = getUserId(request);
  const pool = requirePool();
  await getActor(pool, userId);
  const result = await pool.query(
    `SELECT id, title, message, type, reference_url, is_read, created_at
     FROM notifications
     WHERE user_id = $1 ${unreadOnly ? 'AND is_read = FALSE' : ''}
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId],
  );
  return result.rows;
}

export async function createTargetedNotification(request, input) {
  const senderId = getUserId(request);
  const userId = requireUuid(input.userId, 'userId');
  const title = requireText(input.title, 'title', 200);
  const message = requireText(input.message, 'message', 5000);
  const type = requireText(input.type, 'type', 40);
  const referenceUrl = input.referenceUrl == null
    ? null
    : requireText(input.referenceUrl, 'referenceUrl', 500);
  const pool = requirePool();
  const sender = await getActor(pool, senderId);
  if (sender.role !== 'campus_admin') {
    throw new ApiError(403, 'Only a campus administrator can send direct notifications.');
  }
  const result = await pool.query(
    `INSERT INTO notifications (user_id, title, message, type, reference_url)
     SELECT id, $2, $3, $4, $5
     FROM users
     WHERE id = $1 AND is_active = TRUE
     RETURNING id, user_id, title, message, type, reference_url, is_read, created_at`,
    [userId, title, message, type, referenceUrl],
  );
  if (!result.rows[0]) throw new ApiError(404, 'Notification recipient was not found.');
  return result.rows[0];
}

export async function getUnreadNotificationCount(request) {
  const userId = getUserId(request);
  const pool = requirePool();
  await getActor(pool, userId);
  const result = await pool.query(
    'SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
    [userId],
  );
  return result.rows[0].unread_count;
}

export async function markNotificationRead(request, notificationId) {
  const userId = getUserId(request);
  requireUuid(notificationId, 'notificationId');
  const pool = requirePool();
  await getActor(pool, userId);
  const result = await pool.query(
    `UPDATE notifications SET is_read = TRUE
     WHERE id = $1 AND user_id = $2
     RETURNING id, is_read`,
    [notificationId, userId],
  );
  if (!result.rows[0]) throw new ApiError(404, 'Notification was not found.');
  return result.rows[0];
}

export async function markAllNotificationsRead(request) {
  const userId = getUserId(request);
  const pool = requirePool();
  await getActor(pool, userId);
  const result = await pool.query(
    `UPDATE notifications SET is_read = TRUE
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId],
  );
  return { updated_count: result.rowCount };
}
