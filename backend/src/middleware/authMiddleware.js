import jwt from 'jsonwebtoken';
import { getDatabasePool } from '../config/database.js';
import { ApiError } from './apiError.js';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new ApiError(500, 'Authentication is not configured.');
  }
  return secret;
}

export async function verifyToken(request, _response, next) {
  try {
    const authHeader = request.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication token is missing.');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new ApiError(401, 'Authentication token is missing.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch {
      throw new ApiError(401, 'Invalid or expired authentication token.');
    }

    const pool = getDatabasePool();
    if (!pool) {
      throw new ApiError(503, 'Database is not configured.');
    }

    const result = await pool.query(
      'SELECT id, role, is_active FROM users WHERE id = $1',
      [decoded.id],
    );
    const user = result.rows[0];
    if (!user || user.is_active !== true) {
      throw new ApiError(403, 'Active user identity is required.');
    }

    request.user = {
      id: user.id,
      role: user.role,
    };
    next();
  } catch (error) {
    next(error);
  }
}
