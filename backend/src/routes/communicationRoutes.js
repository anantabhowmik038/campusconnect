import { Router } from 'express';
import {
  getAnnouncements,
  getNotificationCount,
  getNotifications,
  postAnnouncement,
  postNotification,
  readAllNotifications,
  readNotification,
} from '../controllers/communicationController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/announcements', getAnnouncements);
router.post('/announcements', verifyToken, postAnnouncement);
router.get('/notifications', verifyToken, getNotifications);
router.post('/notifications', verifyToken, postNotification);
router.get('/notifications/unread-count', verifyToken, getNotificationCount);
router.patch('/notifications/read-all', verifyToken, readAllNotifications);
router.patch('/notifications/:notificationId/read', verifyToken, readNotification);

export default router;
