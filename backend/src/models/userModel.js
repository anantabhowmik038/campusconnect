import { getDatabasePool } from '../config/database.js';

function getPoolOrThrow() {
  const pool = getDatabasePool();
  if (!pool) {
    throw new Error('DATABASE_URL is not configured.');
  }
  return pool;
}

export const userModel = {
  async findByEmail(email) {
    const pool = getPoolOrThrow();
    const query = `
      SELECT id, full_name, email, password_hash, role, is_active, created_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const pool = getPoolOrThrow();
    const query = `
      SELECT id, full_name, email, role, is_active, created_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0] || null;
  },

  async createUser(fullName, email, passwordHash, role = 'student') {
    const pool = getPoolOrThrow();
    const query = `
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, email, role, is_active, created_at
    `;
    const { rows } = await pool.query(query, [fullName, email, passwordHash, role]);
    return rows[0];
  },
};