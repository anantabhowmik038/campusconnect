import { Router } from 'express';

import { issueTicket, checkIn, getAttendance } from '../services/attendanceService.js';

const router = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUser(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  next();
}

function requireStaff(req, res, next) {
  if (!['club_officer', 'campus_admin'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Permission denied',
    });
  }

  next();
}

function handleError(error, res, next) {
  const status = error.statusCode || error.status;

  if ([400, 401, 403, 404, 409, 503].includes(status)) {
    return res.status(status).json({
      error: error.message,
    });
  }

  next(error);
}

router.post('/attendance/tickets', requireUser, async (req, res, next) => {
  try {
    const registrationId = req.body?.registration_id;

    if (!UUID.test(registrationId || '')) {
      return res.status(400).json({
        error: 'Invalid registration ID',
      });
    }

    const ticket = await issueTicket(registrationId, req.user);

    res.set('Cache-Control', 'no-store');
    res.status(200).json({ data: ticket });
  } catch (error) {
    handleError(error, res, next);
  }
});

router.post('/attendance/check-in', requireUser, requireStaff, async (req, res, next) => {
  try {
    const attendance = await checkIn(req.body?.ticket_token, req.user);

    res.status(201).json({
      data: attendance,
    });
  } catch (error) {
    handleError(error, res, next);
  }
});

router.get('/events/:eventId/attendance', requireUser, requireStaff, async (req, res, next) => {
  try {
    if (!UUID.test(req.params.eventId)) {
      return res.status(400).json({
        error: 'Invalid event ID',
      });
    }

    const attendance = await getAttendance(req.params.eventId, req.user);

    res.status(200).json({
      data: attendance,
    });
  } catch (error) {
    handleError(error, res, next);
  }
});

export default router;
