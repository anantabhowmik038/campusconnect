import {
  exportAnalyticsCsv,
  getClubMetrics,
  getEventMetrics,
  getOverviewMetrics,
} from '../services/analyticsService.js';

export async function getOverviewAnalytics(req, res, next) {
  try {
    res.json({ analytics: await getOverviewMetrics(req) });
  } catch (error) {
    next(error);
  }
}

export async function getClubAnalytics(req, res, next) {
  try {
    res.json({ analytics: await getClubMetrics(req, req.params.clubId) });
  } catch (error) {
    next(error);
  }
}

export async function getEventAnalytics(req, res, next) {
  try {
    res.json({ analytics: await getEventMetrics(req, req.params.eventId) });
  } catch (error) {
    next(error);
  }
}

export async function exportAnalytics(req, res, next) {
  try {
    const csv = await exportAnalyticsCsv(req, req.query.clubId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="campusconnect-analytics.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}
