import { ApiError } from './apiError.js';

/**
 * Handles uncaught API errors. Known ApiError client statuses retain their messages.
 * Server errors return a generic message.
 *
 * @param {Error} error - Error passed by Express.
 * @param {express.Request} _req - Request associated with the error.
 * @param {express.Response} res - Response used to send the error JSON.
 * @param {express.NextFunction} _next - Express error-middleware continuation.
 * @returns {void} Sends an HTTP response with an error message.
 */
export function errorHandler(error, _req, res, _next) {
  console.error('API error:', error.message);
  const status = error instanceof ApiError ? error.status : 500;
  const message = status >= 500 ? 'Internal server error' : error.message;
  res.status(status).json({ error: message });
}
