import { Router } from 'express';
import {
  getEligibleEvents,
  getEventFeedback,
  postEventFeedback,
  removeFeedback,
} from '../controllers/feedbackController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/feedback/eligible-events', verifyToken, getEligibleEvents);
router.get('/feedback/events/:eventId', getEventFeedback);
router.post('/feedback/events/:eventId', verifyToken, postEventFeedback);
router.delete('/feedback/:feedbackId', verifyToken, removeFeedback);

export default router;
