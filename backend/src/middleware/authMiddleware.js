import { authService } from '../services/authService.js';
import { userModel } from '../models/userModel.js';

export async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication token is missing.' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Authentication token is missing.' });
    }

    const decoded = authService.verifyToken(token);

    if (userModel.findById) {
      const dbUser = await userModel.findById(decoded.id);
      if (!dbUser) {
        return res.status(401).json({ error: 'User account no longer exists.' });
      }
      if (dbUser.is_active === false) {
        return res.status(403).json({
          error: 'Account is inactive. Please contact an administrator.',
        });
      }
      req.user = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
      };
    } else {
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };
    }

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired.' });
    }
    if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid or unauthorized token.' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions.' });
    }
    return next();
  };
}