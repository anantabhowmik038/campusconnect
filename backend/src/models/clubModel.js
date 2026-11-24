import { getDatabasePool } from '../config/database.js';

function getPoolOrThrow() {
  const pool = getDatabasePool();
  if (!pool) {
    throw new Error('DATABASE_URL is not configured.');
  }
  return pool;
}

function buildClubSelectQuery({ whereClause = '', includeMembershipJoin = true } = {}) {
  const membershipCountExpr = includeMembershipJoin
    ? `COALESCE(m.approved_members_count, 0)::int AS enrolled_members_count`
    : `0::int AS enrolled_members_count`;

  const membershipJoinClause = includeMembershipJoin
    ? `
      LEFT JOIN (
        SELECT
          club_id,
          COUNT(*)::int AS approved_members_count
        FROM club_memberships
        WHERE LOWER(COALESCE(status, '')) = 'approved'
        GROUP BY club_id
      ) m ON m.club_id = c.id
    `
    : '';

  return `
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
      ${membershipCountExpr}
    FROM clubs c
    LEFT JOIN users u ON u.id = c.officer_user_id
    ${membershipJoinClause}
    ${whereClause}
  `;
}

function isMissingSchemaObjectError(err) {
  return err?.code === '42P01' || err?.code === '42703';
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
      conditions.push(
        `(c.name ILIKE $${params.length} OR COALESCE(c.description, '') ILIKE $${params.length})`
      );
    }

    if (category) {
      params.push(category);
      conditions.push(`LOWER(COALESCE(c.category, '')) = LOWER($${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = 'ORDER BY c.created_at DESC NULLS LAST, c.id DESC';

    try {
      const query = `${buildClubSelectQuery({ whereClause, includeMembershipJoin: true })} ${orderClause}`;
      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      if (!isMissingSchemaObjectError(err)) {
        throw err;
      }
      const fallbackQuery = `${buildClubSelectQuery({ whereClause, includeMembershipJoin: false })} ${orderClause}`;
      const { rows } = await pool.query(fallbackQuery, params);
      return rows;
    }
  },

  async findById(id) {
    const pool = getPoolOrThrow();
    const whereClause = 'WHERE c.id = $1';
    const limitClause = 'LIMIT 1';

    try {
      const query = `${buildClubSelectQuery({ whereClause, includeMembershipJoin: true })} ${limitClause}`;
      const { rows } = await pool.query(query, [id]);
      return rows[0] || null;
    } catch (err) {
      if (!isMissingSchemaObjectError(err)) {
        throw err;
      }
      const fallbackQuery = `${buildClubSelectQuery({ whereClause, includeMembershipJoin: false })} ${limitClause}`;
      const { rows } = await pool.query(fallbackQuery, [id]);
      return rows[0] || null;
    }
  },

  async findMembersByClubId(clubId) {
    const pool = getPoolOrThrow();
    const query = `
      SELECT
        cm.id AS membership_id,
        u.id AS user_id,
        u.full_name,
        u.email,
        cm.role AS club_role,
        cm.status,
        cm.joined_at
      FROM club_memberships cm
      INNER JOIN users u ON u.id = cm.user_id
      WHERE cm.club_id = $1
        AND LOWER(COALESCE(cm.status, '')) = 'approved'
      ORDER BY cm.joined_at ASC NULLS LAST, u.full_name ASC
    `;

    try {
      const { rows } = await pool.query(query, [clubId]);
      return rows;
    } catch (err) {
      if (isMissingSchemaObjectError(err)) {
        return [];
      }
      throw err;
    }
  },

  async create({
    name,
    description = '',
    category = '',
    logo_url = null,
    officer_user_id,
    status = 'active',
  }) {
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
    const allowedFields = [
      'name',
      'description',
      'category',
      'logo_url',
      'status',
      'officer_user_id',
    ];
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