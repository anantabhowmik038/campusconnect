import { getDatabasePool } from '../config/database.js';

/** Verifies connectivity without returning private database details. */
export async function checkDatabase() {
  const pool = getDatabasePool();
  if (!pool) {
    return {
      httpCode: 503,
      payload: { status: 'not_configured', message: 'Configure DATABASE_URL in backend/.env.' },
    };
  }
  try {
    await pool.query('SELECT 1');
    return { httpCode: 200, payload: { status: 'connected' } };
  } catch {
    return {
      httpCode: 503,
      payload: { status: 'unavailable', message: 'PostgreSQL connection failed.' },
    };
  }
}
