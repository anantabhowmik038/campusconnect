
import { authService } from '../services/authService.js';
import { userModel } from '../models/userModel.js';

function sendAuthError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message },
  });
}

export async function verifyEventToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return sendAuthError(
      res, 401, 'UNAUTHENTICATED',
      'Verified sign-in is required.'
    );
  }

  const token = header.slice(7).trim();

  if (!token) {
    return sendAuthError(
      res, 401, 'UNAUTHENTICATED',
      'Verified sign-in is required.'
    );
  }

  let decoded;

  try {
    decoded = authService.verifyToken(token);
  } catch {
    return sendAuthError(
      res, 401, 'UNAUTHENTICATED',
      'Invalid or expired authentication token.'
    );
  }

  try {
    if (!decoded?.id) {
      return sendAuthError(
        res, 401, 'UNAUTHENTICATED',
        'Invalid authentication token.'
      );
    }

    const user = await userModel.findById(decoded.id);

    if (!user) {
      return sendAuthError(
        res, 401, 'UNAUTHENTICATED',
        'User account not found.'
      );
    }

    if (user.is_active === false) {
      return sendAuthError(
        res, 403, 'FORBIDDEN',
        'User account is inactive.'
      );
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
