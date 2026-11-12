import { checkDatabase } from '../services/healthService.js';

/** Returns an application health response, even when PostgreSQL is not configured. */
export function getHealth(_req, res) {
  res.status(200).json({
    status: 'ok',
    application: 'CampusConnect API',
    environment: process.env.NODE_ENV || 'development',
  });
}

/** Returns the database connectivity status without exposing credentials. */
export async function getDatabaseHealth(_req, res) {
  const result = await checkDatabase();
  res.status(result.httpCode).json(result.payload);
}
