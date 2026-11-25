import { Router } from 'express';

import {
  listVenues,
  listVenueBookings,
  requestBooking,
  updateBookingStatus,
} from '../controllers/venueController.js';

const router = Router();

function requireUser(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  next();
}

router.get('/venues', requireUser, listVenues);

router.get('/venues/:venueId/bookings', requireUser, listVenueBookings);

router.post('/venue-bookings', requireUser, requestBooking);

router.patch('/venue-bookings/:bookingId/review', requireUser, updateBookingStatus);

export default router;
