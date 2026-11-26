import {
  getVenues,
  getVenueBookings,
  getBookingEvents,
  createBooking,
  reviewBooking,
} from '../services/venueService.js';

export async function listVenues(req, res) {
  res.json({ data: await getVenues(req.user) });
}

export async function listVenueBookings(req, res) {
  res.json({ data: await getVenueBookings(req.params.venueId, req.user) });
}

export async function listBookingEvents(req, res) {
  res.json({ data: await getBookingEvents(req.user.id) });
}

export async function requestBooking(req, res) {
  res.status(201).json({ data: await createBooking(req.body, req.user) });
}

export async function updateBookingStatus(req, res) {
  res.json({ data: await reviewBooking(req.params.bookingId, req.body?.status, req.user) });
}
