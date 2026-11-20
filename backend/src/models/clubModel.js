import { getDatabasePool } from '../config/database.js';

function getPoolOrThrow() {
  const pool = getDatabasePool();
  if (!pool) {
    throw new Error('DATABASE_URL is not configured.');
  }
  return pool;
}

export const clubModel = {
  async findAll({ search = '', category = '', includeAll = false } = {}) {
    const pool = getPoolOrThrow();
    const conditions = [];
    const params = [];

    if (!includeAll) {
      params.push('active');
      conditions.push(`c.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(c.name ILIKE $${params.length} OR COALESCE(c.description, '') ILIKE $${params.length})`);
    }

    if (category) {
      params.push(category);
      conditions.push(`LOWER(COALESCE(c.category, '')) = LOWER($${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        c.id,
        c.name,
        c.description,
        c.category,
        c.logo_url,
        c.status,
        c.officer_user_id,
        c.created_at,
        c.updated_at,
        u.full_name AS officer_name,
        0::int AS enrolled_members_count
      FROM clubs c
      LEFT JOIN users u ON u.id = c.officer_user_id
      ${whereClause}
      ORDER BY c.created_at DESC NULLS LAST, c.id DESC
    `;

    const { rows } = await pool.query(query, params);
    return rows;
  },

  async findById(id) {
    const pool = getPoolOrThrow();
    const query = `
      SELECT
        c.id,
        c.name,
        c.description,
        c.category,
        c.logo_url,
        c.status,
        c.officer_user_id,
        c.created_at,
        c.updated_at,
        u.full_name AS officer_name,
        0::int AS enrolled_members_count
      FROM clubs c
      LEFT JOIN users u ON u.id = c.officer_user_id
      WHERE c.id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  },

  async create({ name, description = '', category = '', logo_url = null, officer_user_id, status = 'active' }) {
    const pool = getPoolOrThrow();
    const query = `
      INSERT INTO clubs (name, description, category, logo_url, officer_user_id, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, description, category, logo_url, status, officer_user_id, created_at, updated_at
    `;
    const { rows } = await pool.query(query, [
      name,
      description,
      category,
      logo_url,
      officer_user_id,
      status,
    ]);
    return rows[0];
  },

  async updateById(id, updates) {
    const pool = getPoolOrThrow();
    const allowedFields = ['name', 'description', 'category', 'logo_url', 'status', 'officer_user_id'];
    const setClauses = [];
    const values = [];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        values.push(updates[field]);
        setClauses.push(`${field} = $${values.length}`);
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE clubs
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING id, name, description, category, logo_url, status, officer_user_id, created_at, updated_at
    `;

    const { rows } = await pool.query(query, values);
    return rows[0] || null;
  },
};