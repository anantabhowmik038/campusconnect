import { getDatabasePool } from '../config/database.js';

export const userModel = {
  async createUser(fullName, email, passwordHash, role = 'student') {
    const pool = getDatabasePool();
    const query = `
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, email, role, created_at;
    `;
    const values = [fullName, email, passwordHash, role];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async findByEmail(email) {
    const pool = getDatabasePool();
    const query = `SELECT * FROM users WHERE email = $1;`;
    const result = await pool.query(query, [email]);
    return result.rows[0];
  },

  async findById(id) {
    const pool = getDatabasePool();
    const query = `SELECT id, full_name, email, role, is_active, created_at FROM users WHERE id = $1;`;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
};