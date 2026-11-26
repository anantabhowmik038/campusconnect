import { checkDatabase } from '../services/healthService.js';

/**
 * Reports API liveness without querying PostgreSQL.
 *
 * @param {express.Request} _req - Incoming health request.
 * @param {express.Response} res - Response used to send the application status.
 * @returns {void} Sends HTTP 200 with the application name, status, and environment.
 */
export function getHealth(_req, res) {
  res.status(200).json({
    status: 'ok',
    application: 'CampusConnect API',
    environment: process.env.NODE_ENV || 'development',
  });
}

/**
 * Reports whether PostgreSQL is configured and reachable using a sanitized response.
 *
 * @async
 * @param {express.Request} _req - Incoming database health request.
 * @param {express.Response} res - Response used to send the database status.
 * @returns {Promise<void>} Sends HTTP 200 when connected or 503 when unavailable.
 */
export async function getDatabaseHealth(_req, res) {
  const result = await checkDatabase();
  res.status(result.httpCode).json(result.payload);
}
