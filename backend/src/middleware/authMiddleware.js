import jwt from 'jsonwebtoken';
import { getDatabasePool } from '../config/database.js';
import { ApiError } from './apiError.js';

export async function verifyToken(request, _response, next) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new ApiError(500, 'Authentication is not configured.');

    const authorization = request.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication token is missing.');
    }

    const token = authorization.slice(7).trim();
    if (!token) throw new ApiError(401, 'Authentication token is missing.');

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      throw new ApiError(401, 'Invalid or expired authentication token.');
    }

    const pool = getDatabasePool();
    if (!pool) throw new ApiError(503, 'Database is not configured.');

    const result = await pool.query(
      'SELECT id, role, is_active FROM users WHERE id = $1',
      [decoded.id],
    );
    const user = result.rows[0];
    if (!user || user.is_active !== true) {
      throw new ApiError(403, 'Active user identity is required.');
    }

    request.user = { id: user.id, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}
