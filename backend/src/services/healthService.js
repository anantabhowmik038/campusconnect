import { getDatabasePool } from '../config/database.js';

/**
 * Runs a minimal PostgreSQL query and returns a safe health payload.
 * An absent pool or failed query produces a 503 result.
 *
 * @async
 * @returns {Promise<{httpCode: number, payload: {status: string, message: (string|undefined)}}>} HTTP status and a connectivity payload.
 */
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
