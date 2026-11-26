import {
  createAnnouncement,
  createTargetedNotification,
  getUnreadNotificationCount,
  listAnnouncements,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/communicationService.js';

export async function getAnnouncements(req, res, next) {
  try {
    res.json({ announcements: await listAnnouncements(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function postAnnouncement(req, res, next) {
  try {
    res.status(201).json({ announcement: await createAnnouncement(req, req.body) });
  } catch (error) {
    next(error);
  }
}

export async function getNotifications(req, res, next) {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    res.json({ notifications: await listNotifications(req, { unreadOnly }) });
  } catch (error) {
    next(error);
  }
}

export async function postNotification(req, res, next) {
  try {
    res.status(201).json({ notification: await createTargetedNotification(req, req.body) });
  } catch (error) {
    next(error);
  }
}

export async function getNotificationCount(req, res, next) {
  try {
    res.json({ unread_count: await getUnreadNotificationCount(req) });
  } catch (error) {
    next(error);
  }
}

export async function readNotification(req, res, next) {
  try {
    res.json({ notification: await markNotificationRead(req, req.params.notificationId) });
  } catch (error) {
    next(error);
  }
}

export async function readAllNotifications(req, res, next) {
  try {
    res.json(await markAllNotificationsRead(req));
  } catch (error) {
    next(error);
  }
}
