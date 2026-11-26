import { Router } from 'express';
import { getDatabasePool } from '../config/database.js';
import { createPublicEventController } from '../controllers/publicEventController.js';

const protectedEventPaths = new Set(['proposals', 'pending']);

export function createPublicEventRouter(getPool = getDatabasePool) {
  const router = Router();
  const controller = createPublicEventController(getPool);
  router.get('/', controller.list);
  router.get('/:eventId', (req, _res, next) => {
    // Match the case-insensitive static route semantics of the F04 router.
    if (protectedEventPaths.has(req.params.eventId.toLowerCase())) return next('route');
    next();
  }, controller.detail);
  router.use((error, _req, res, next) => {
    if (!(error instanceof URIError) || error.status !== 400) return next(error);
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Use valid URL encoding for the event ID.' },
    });
  });
  return router;
}
