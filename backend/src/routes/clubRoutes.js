import { Router } from 'express';
import { clubController } from '../controllers/clubController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * Attaches req.user when a Bearer token is provided, without blocking public GET requests.
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