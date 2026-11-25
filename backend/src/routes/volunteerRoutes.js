import { Router } from 'express';

import {
  getShifts,
  createShift,
  applyForShift,
  reviewApplication,
} from '../services/volunteerService.js';
import { getApplications } from '../services/volunteerService.js';

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

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Permission denied',
      });
    }

    next();
  };
}

function validateId(id) {
  if (!UUID.test(id || '')) {
    throw Object.assign(new Error('Invalid ID'), {
      status: 400,
    });
  }
}

function handleError(error, res, next) {
  const status = error.statusCode || error.status;

  if ([400, 401, 403, 404, 409, 422].includes(status)) {
    return res.status(status).json({
      error: error.message,
    });
  }

  next(error);
}

router.get('/events/:eventId/volunteer-shifts', requireUser, async (req, res, next) => {
  try {
    validateId(req.params.eventId);

    const shifts = await getShifts(req.params.eventId);

    res.status(200).json({ data: shifts });
  } catch (error) {
    handleError(error, res, next);
  }
});

router.post(
  '/events/:eventId/volunteer-shifts',
  requireUser,
  requireRole('club_officer', 'campus_admin'),
  async (req, res, next) => {
    try {
      validateId(req.params.eventId);

      const shift = await createShift(req.params.eventId, req.body || {}, req.user);

      res.status(201).json({ data: shift });
    } catch (error) {
      handleError(error, res, next);
    }
  },
);

router.post(
  '/volunteer-shifts/:shiftId/applications',
  requireUser,
  requireRole('student'),
  async (req, res, next) => {
    try {
      validateId(req.params.shiftId);

      const application = await applyForShift(req.params.shiftId, req.user);

      res.status(201).json({ data: application });
    } catch (error) {
      handleError(error, res, next);
    }
  },
);

router.patch(
  '/volunteer-applications/:applicationId/review',
  requireUser,
  requireRole('club_officer', 'campus_admin'),
  async (req, res, next) => {
    try {
      validateId(req.params.applicationId);

      const application = await reviewApplication(
        req.params.applicationId,
        req.body?.status,
        req.user,
      );

      res.status(200).json({ data: application });
    } catch (error) {
      handleError(error, res, next);
    }
  },
);
router.get(
  '/volunteer-shifts/:shiftId/applications',
  requireUser,
  requireRole('club_officer', 'campus_admin'),
  async (req, res, next) => {
    try {
      validateId(req.params.shiftId);

      const data = await getApplications(req.params.shiftId, req.user);

      res.status(200).json({ data });
    } catch (error) {
      handleError(error, res, next);
    }
  },
);
export default router;
