import {
  deleteFeedback,
  getFeedbackSummary,
  listEligibleEvents,
  saveFeedback,
} from '../services/feedbackService.js';

export async function getEligibleEvents(req, res, next) {
  try {
    res.json({ events: await listEligibleEvents(req) });
  } catch (error) {
    next(error);
  }
}

export async function getEventFeedback(req, res, next) {
  try {
    res.json(await getFeedbackSummary(req.params.eventId));
  } catch (error) {
    next(error);
  }
}

export async function postEventFeedback(req, res, next) {
  try {
    res.status(201).json({
      feedback: await saveFeedback(req, req.params.eventId, req.body),
    });
  } catch (error) {
    next(error);
  }
}

export async function removeFeedback(req, res, next) {
  try {
    res.json(await deleteFeedback(req, req.params.feedbackId));
  } catch (error) {
    next(error);
  }
}
