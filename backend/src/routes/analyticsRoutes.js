import { Router } from 'express';
import {
  exportAnalytics,
  getClubAnalytics,
  getEventAnalytics,
  getOverviewAnalytics,
} from '../controllers/analyticsController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/overview', verifyToken, getOverviewAnalytics);
router.get('/clubs/:clubId', verifyToken, getClubAnalytics);
router.get('/events/:eventId', verifyToken, getEventAnalytics);
router.get('/export', verifyToken, exportAnalytics);

export default router;
