import { Router } from 'express';
import { requireRole, verifyToken } from '../middleware/authMiddleware.js';
import {
  listVenues,
  listVenueBookings,
  listBookingEvents,
  requestBooking,
  updateBookingStatus,
} from '../controllers/venueController.js';

const router = Router();

router.get('/venues', verifyToken, listVenues);
router.get('/venues/:venueId/bookings', verifyToken, listVenueBookings);
router.get('/venue-bookings/events', verifyToken, requireRole('club_officer'), listBookingEvents);
router.post('/venue-bookings', verifyToken, requireRole('club_officer'), requestBooking);
router.patch('/venue-bookings/:bookingId/review', verifyToken, requireRole('campus_admin'), updateBookingStatus);

export default router;
