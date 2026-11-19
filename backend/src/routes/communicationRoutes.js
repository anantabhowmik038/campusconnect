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

const router = Router();

router.get('/announcements', getAnnouncements);
router.post('/announcements', postAnnouncement);
router.get('/notifications', getNotifications);
router.post('/notifications', postNotification);
router.get('/notifications/unread-count', getNotificationCount);
router.patch('/notifications/read-all', readAllNotifications);
router.patch('/notifications/:notificationId/read', readNotification);

export default router;
