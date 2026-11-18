import { getDatabasePool } from '../config/database.js';
import { EventError } from '../services/eventError.js';

const editableColumns = ['title', 'description', 'category', 'image_url', 'start_time', 'end_time', 'capacity'];

function requirePool(getPool) {
  const pool = getPool();
  if (!pool) throw new EventError(503, 'DATABASE_UNAVAILABLE', 'Proposal storage is unavailable.');
  return pool;
}

export function createEventModel(getPool = getDatabasePool) {
  return {
    async transaction(work) {
      const client = await requirePool(getPool).connect();
      let discard = false;
      try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          discard = true;
        }
        throw error;
      } finally {
        client.release(discard);
      }
    },

    async lockClub(client, clubId) {
      const { rows } = await client.query(
        'SELECT id, officer_user_id, status FROM clubs WHERE id = $1 FOR SHARE', [clubId],
      );
      return rows[0];
    },

    async lockEvent(client, eventId) {
      const { rows } = await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [eventId]);
      return rows[0];
    },

    async insert(client, proposal, creatorId) {
      const { club_id, title, description, category, image_url, start_time, end_time, capacity } = proposal;
      const { rows } = await client.query(
        `INSERT INTO events (club_id, created_by, title, description, category, image_url, start_time, end_time, capacity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [club_id, creatorId, title, description, category, image_url, start_time, end_time, capacity],
      );
      return rows[0];
    },

    async updateProposal(client, eventId, changes) {
      const columns = editableColumns.filter((column) => Object.hasOwn(changes, column));
      const assignments = columns.map((column, index) => column + ' = $' + (index + 2));
      const { rows } = await client.query(
        `UPDATE events SET ${assignments.join(', ')}, updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 RETURNING *`,
        [eventId, ...columns.map((column) => changes[column])],
      );
      return rows[0];
    },

    async submit(client, eventId) {
      const { rows } = await client.query(
        `UPDATE events SET status='pending', submission_version=submission_version + 1,
         reviewed_by=NULL, reviewed_at=NULL,
         review_note=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [eventId],
      );
      return rows[0];
    },

    async review(client, eventId, reviewerId, { decision, review_note }) {
      const { rows } = await client.query(
        `UPDATE events SET status=$2, reviewed_by=$3, reviewed_at=CURRENT_TIMESTAMP,
         review_note=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
        [eventId, decision, reviewerId, review_note],
      );
      return rows[0];
    },

    async list({ officerId = null, page, limit }) {
      const { rows } = await requirePool(getPool).query(
        `WITH matching AS (
           SELECT e.*, c.name AS club_name, c.status AS club_status
           FROM events e JOIN clubs c ON c.id = e.club_id
           WHERE ($1::uuid IS NULL AND e.status = 'pending') OR c.officer_user_id = $1
         ), page_rows AS (
           SELECT * FROM matching ORDER BY start_time, id LIMIT $2 OFFSET $3
         )
         SELECT COALESCE((SELECT jsonb_agg(page_rows ORDER BY start_time, id) FROM page_rows), '[]') AS data,
                (SELECT count(*) FROM matching) AS total`,
        [officerId, limit, (page - 1) * limit],
      );
      return { data: rows[0].data, pagination: { page, limit, total: Number(rows[0].total) } };
    },
  };
}
