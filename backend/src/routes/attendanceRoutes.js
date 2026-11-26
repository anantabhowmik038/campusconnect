import { Router } from 'express';
import { requireRole, verifyToken } from '../middleware/authMiddleware.js';
import { issueTicket, checkIn, getAttendance, listRegistrations, listStaffEvents } from '../services/attendanceService.js';

const router = Router();
const staff = requireRole('club_officer', 'campus_admin');
const noStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

router.get('/attendance/registrations', noStore, verifyToken, async (req, res) => {
  res.json({ data: await listRegistrations(req.user.id) });
});

router.get('/attendance/events', noStore, verifyToken, staff, async (req, res) => {
  res.json({ data: await listStaffEvents(req.user) });
});

router.post('/attendance/tickets', noStore, verifyToken, async (req, res) => {
  res.json({ data: await issueTicket(req.body?.registration_id, req.user) });
});

router.post('/attendance/check-in', noStore, verifyToken, staff, async (req, res) => {
  const { ticket_token, event_id } = req.body ?? {};
  res.status(201).json({ data: await checkIn(ticket_token, req.user, event_id) });
});

router.get('/events/:eventId/attendance', noStore, verifyToken, staff, async (req, res) => {
  res.json({ data: await getAttendance(req.params.eventId, req.user) });
});

export default router;
