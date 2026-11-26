import { authService } from '../services/authService.js';
import { userModel } from '../models/userModel.js';

/**
 * The identity made available by authentication middleware.
 * @typedef {object} AuthenticatedUser
 * @property {string} id - User UUID.
 * @property {string} role - Current account role.
 * @property {string} [email] - Account email, when supplied.
 */

/**
 * Verifies a bearer JWT and attaches the authenticated user to the request.
 * When the user lookup is available, the database supplies the role and inactive accounts are denied.
 *
 * @async
 * @param {express.Request} req - Request carrying the bearer token.
 * @param {express.Response} res - Response used for authentication failures.
 * @param {express.NextFunction} next - Continues the middleware chain after verification.
 * @returns {Promise<express.Response|void>} Continues on success, sends 401 for invalid or missing identity, or 403 for an inactive account.
 */
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

/**
 * Builds an authorization guard to follow authentication.
 * The guard sends 401 when identity is absent and 403 when the role is outside the allowed list.
 *
 * @param {...string} allowedRoles - Role names permitted to call the route.
 * @returns {express.RequestHandler} Express middleware that checks the authenticated request role.
 */
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