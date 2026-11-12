/** Final catch-all error response. Do not expose internal error details to API clients. */
export function errorHandler(error, _req, res, _next) {
  console.error('API error:', error.message);
  res.status(500).json({ error: 'Internal server error' });
}
