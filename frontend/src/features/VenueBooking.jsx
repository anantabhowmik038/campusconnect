import { useState, useEffect, useCallback } from 'react';

export default function VenueBooking({ user, token, apiBase = '/api' }) {
  const [venues, setVenues] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [venueId, setVenueId] = useState('');
  const [eventId, setEventId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const role = user?.role;
  const isAdmin = role === 'campus_admin';
  const isOfficer = role === 'club_officer';
  const canViewCalendar = isAdmin || isOfficer;

  const request = useCallback(
    async (path, method = 'GET', body) => {
      const response = await fetch(`${apiBase}${path}`, {
        method,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || result.error || 'Request failed');
      }

      return result.data;
    },
    [apiBase, token],
  );

  useEffect(() => {
    if (!user && !token) return;

    let active = true;

    request('/venues')
      .then((data) => {
        if (active) setVenues(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [request, user, token]);

  useEffect(() => {
    setBookings([]);

    if (!venueId || !canViewCalendar) return;

    let active = true;

    request(`/venues/${venueId}/bookings`)
      .then((data) => {
        if (active) setBookings(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [venueId, canViewCalendar, request, refresh]);

  async function submitBooking(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);

    try {
      if (new Date(endTime) <= new Date(startTime)) {
        throw new Error('End time must be after start time');
      }

      await request('/venue-bookings', 'POST', {
        event_id: eventId.trim(),
        venue_id: venueId,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
      });

      setMessage('Booking requested successfully.');
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reviewBooking(id, status) {
    setError('');
    setMessage('');
    setBusy(true);

    try {
      await request(`/venue-bookings/${id}/review`, 'PATCH', { status });

      setMessage(`Booking ${status} successfully.`);
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const card = {
    background: '#ffffff',
    padding: '24px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    marginBottom: '20px',
  };

  const input = {
    width: '100%',
    padding: '12px',
    margin: '8px 0 16px',
    border: '1px solid #cbd5e1',
    borderRadius: '7px',
    boxSizing: 'border-box',
    background: '#ffffff',
    color: '#0f172a',
  };

  const button = {
    padding: '10px 18px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '7px',
    cursor: 'pointer',
  };

  return (
    <main
      style={{
        maxWidth: '1100px',
        margin: '30px auto',
        padding: '20px',
        color: '#0f172a',
        textAlign: 'left',
      }}
    >
      <h1>Venue Booking</h1>
      <p>Find campus venues and manage event bookings.</p>

      {!user && <p style={{ color: '#92400e' }}>Sign in to access venue booking services.</p>}

      {message && (
        <p role="status" style={{ color: 'green' }}>
          {message}
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      )}

      <section style={card}>
        <h2>Available Venues</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
          }}
        >
          {venues.map((venue) => (
            <article key={venue.id} style={card}>
              <h3>{venue.name}</h3>
              <p>Location: {venue.location}</p>
              <p>Capacity: {venue.capacity}</p>

              <button style={button} onClick={() => setVenueId(venue.id)}>
                Select Venue
              </button>
            </article>
          ))}
        </div>

        {!venues.length && <p>No venues loaded.</p>}
      </section>

      {(isOfficer || !user) && (
        <section style={card}>
          <h2>Request a Booking</h2>

          <form onSubmit={submitBooking}>
            <fieldset disabled={!isOfficer || busy} style={{ border: 0, padding: 0 }}>
              <label>Select Venue</label>
              <select
                style={input}
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                required
              >
                <option value="">Choose a venue</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>

              <label>Event ID</label>
              <input
                style={input}
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="Enter event UUID"
                required
              />

              <label>Start Date and Time</label>
              <input
                type="datetime-local"
                style={input}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />

              <label>End Date and Time</label>
              <input
                type="datetime-local"
                style={input}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />

              <button style={button} type="submit">
                Request Booking
              </button>
            </fieldset>
          </form>
        </section>
      )}

      {(canViewCalendar || !user) && (
        <section style={card}>
          <h2>Booking Calendar</h2>

          {!venueId && <p>Select a venue first.</p>}

          {venueId && !bookings.length && <p>No bookings found.</p>}

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                textAlign: 'left',
              }}
            >
              <thead>
                <tr>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Status</th>
                  {isAdmin && <th>Action</th>}
                </tr>
              </thead>

              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{new Date(booking.start_time).toLocaleString()}</td>

                    <td>{new Date(booking.end_time).toLocaleString()}</td>

                    <td>{booking.status}</td>

                    {isAdmin && (
                      <td>
                        {booking.status === 'pending' && (
                          <>
                            <button
                              disabled={busy}
                              style={{
                                ...button,
                                background: '#16a34a',
                              }}
                              onClick={() => reviewBooking(booking.id, 'approved')}
                            >
                              Approve
                            </button>

                            <button
                              disabled={busy}
                              style={{
                                ...button,
                                background: '#dc2626',
                                marginLeft: '8px',
                              }}
                              onClick={() => reviewBooking(booking.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
