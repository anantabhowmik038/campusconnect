import 'dotenv/config';
import pg from 'pg';

let pool;

/** Returns the shared PostgreSQL pool when local credentials are configured. */
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
