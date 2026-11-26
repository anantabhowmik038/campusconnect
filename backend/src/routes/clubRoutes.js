import { Router } from 'express';
import { clubController } from '../controllers/clubController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * Allows anonymous club reads and delegates supplied bearer credentials to F01.
 * A bearer credential that fails verification is handled by the shared verifier.
 *
 * @param {express.Request} req - Request that may contain an Authorization header.
 * @param {express.Response} res - Response used by the verifier if a token is rejected.
 * @param {express.NextFunction} next - Continues the route after optional authentication.
 * @returns {void|Promise<express.Response|void>} Continues anonymously or returns the verifier result.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  return verifyToken(req, res, next);
}

// Public / Directory routes
router.get('/', optionalAuth, clubController.listClubs);
router.get('/:id', optionalAuth, clubController.getClubById);

// Protected routes (authentication required; role checks handled in controller)
router.post('/', verifyToken, clubController.createClub);
router.patch('/:id', verifyToken, clubController.updateClub);

export default router;