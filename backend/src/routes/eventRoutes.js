import { Router, json } from 'express';
import { createEventController } from '../controllers/eventController.js';
import { EventError } from '../services/eventError.js';
import { createEventService, requireEventActor } from '../services/eventService.js';

function authorize(role) {
  return (req, _res, next) => {
    // Only verified authentication middleware mounted upstream may populate req.user.
    requireEventActor(req.user, role);
    next();
  };
}

export function createEventRouter(service = createEventService()) {
  const router = Router();
  const controller = createEventController(service);
  const officer = authorize('club_officer');
  const admin = authorize('campus_admin');
  const parseBody = json({ limit: '1mb' });

  router.post('/', officer, parseBody, controller.create);
  router.get('/proposals', officer, controller.listProposals);
  router.get('/pending', admin, controller.listPending);
  router.patch('/:eventId', officer, parseBody, controller.edit);
  router.post('/:eventId/submit', officer, parseBody, controller.submit);
  router.patch('/:eventId/review', admin, parseBody, controller.review);

  router.use((error, _req, res, next) => {
    if (error instanceof EventError) {
      return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    }
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large' ||
        error.type === 'charset.unsupported' || error.type === 'encoding.unsupported') {
      return res.status(error.status).json({
        error: { code: 'INVALID_BODY', message: 'Send a supported JSON body within the size limit.' },
      });
    }
    next(error);
  });

  return router;
}
