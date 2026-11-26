import { ApiError } from './apiError.js';

/** Final catch-all error response. Do not expose internal error details to API clients. */
export function errorHandler(error, _req, res, _next) {
  console.error('API error:', error.message);
  const status = error instanceof ApiError ? error.status : 500;
  const message = status >= 500 ? 'Internal server error' : error.message;
  res.status(status).json({ error: message });
}
