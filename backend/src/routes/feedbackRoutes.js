import { Router } from 'express';
import {
  getEligibleEvents,
  getEventFeedback,
  postEventFeedback,
  removeFeedback,
} from '../controllers/feedbackController.js';

const router = Router();

router.get('/feedback/eligible-events', getEligibleEvents);
router.get('/feedback/events/:eventId', getEventFeedback);
router.post('/feedback/events/:eventId', postEventFeedback);
router.delete('/feedback/:feedbackId', removeFeedback);

export default router;
