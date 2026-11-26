import { findPublicEvent, listPublicEvents } from '../models/publicEventModel.js';
import { isPublicEventId, readPublicEventQuery, validatePublicEventQuery } from '../validation/publicEventValidation.js';

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

export function createPublicEventController(getPool) {
  return {
    async list(req, res) {
      const parsed = readPublicEventQuery(req.originalUrl);
      if (parsed.error) return sendError(res, 400, 'VALIDATION_ERROR', parsed.error);
      const { filters, error } = validatePublicEventQuery(parsed.query);
      if (error) return sendError(res, 400, 'VALIDATION_ERROR', error);
      const pool = getPool();
      if (!pool) return sendError(res, 503, 'DATABASE_UNAVAILABLE', 'Event storage is unavailable.');
      return res.json(await listPublicEvents(pool, filters));
    },

    async detail(req, res) {
      const { eventId } = req.params;
      const { query, error } = readPublicEventQuery(req.originalUrl);
      if (error) return sendError(res, 400, 'VALIDATION_ERROR', error);
      if (!isPublicEventId(eventId) || Object.keys(query).length) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Use a valid event UUID without query parameters.');
      }
      const pool = getPool();
      if (!pool) return sendError(res, 503, 'DATABASE_UNAVAILABLE', 'Event storage is unavailable.');
      const event = await findPublicEvent(pool, eventId);
      if (!event) return sendError(res, 404, 'EVENT_NOT_FOUND', 'Event not found.');
      return res.json({ data: event });
    },
  };
}
