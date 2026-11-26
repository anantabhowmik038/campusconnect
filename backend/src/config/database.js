import 'dotenv/config';
import pg from 'pg';

let pool;

/**
 * Returns the process-wide PostgreSQL pool, creating it on the first configured call.
 * Later calls reuse the same pool.
 *
 * @returns {?pg.Pool} The shared pool, or null when no database URL is configured.
 */
export function getDatabasePool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    pool.on('error', (error) => {
      console.error('PostgreSQL pool error:', error.message);
    });
  }
  return pool;
}
