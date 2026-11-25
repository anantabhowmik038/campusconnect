import {
  getVenues,
  getVenueBookings,
  createBooking,
  reviewBooking,
} from '../services/venueService.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function handleError(error, res, next) {
  const status = error.statusCode || error.status;

  if ([400, 401, 403, 404, 409, 422].includes(status)) {
    return res.status(status).json({
      error: error.message,
    });
  }

  return next(error);
}

export async function listVenues(req, res, next) {
  try {
    const venues = await getVenues();
    res.status(200).json({ data: venues });
  } catch (error) {
    handleError(error, res, next);
  }
}

export async function listVenueBookings(req, res, next) {
  try {
    if (!UUID.test(req.params.venueId)) {
      return res.status(400).json({
        error: 'Invalid venue ID',
      });
    }

    const bookings = await getVenueBookings(req.params.venueId);

    res.status(200).json({ data: bookings });
  } catch (error) {
    handleError(error, res, next);
  }
}

export async function requestBooking(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const data = req.body || {};

    if (!UUID.test(data.event_id || '') || !UUID.test(data.venue_id || '')) {
      return res.status(400).json({
        error: 'Invalid event or venue ID',
      });
    }

    const booking = await createBooking(data, req.user);

    res.status(201).json({ data: booking });
  } catch (error) {
    handleError(error, res, next);
  }
}

export async function updateBookingStatus(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    if (!UUID.test(req.params.bookingId)) {
      return res.status(400).json({
        error: 'Invalid booking ID',
      });
    }

    const booking = await reviewBooking(req.params.bookingId, req.body?.status, req.user);

    res.status(200).json({ data: booking });
  } catch (error) {
    handleError(error, res, next);
  }
}
