import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function localInputValue(value) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function VenueBooking({ session, apiBase }) {
  const [venues, setVenues] = useState([]);
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [venueId, setVenueId] = useState('');
  const [eventId, setEventId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [revision, setRevision] = useState(0);
  const isAdmin = session?.user.role === 'campus_admin';
  const isOfficer = session?.user.role === 'club_officer';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const request = useCallback(async (path, options) => {
    const response = await session.authenticatedFetch(apiBase + path, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Venue booking request failed.');
    return payload.data;
  }, [apiBase, session]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const showError = (error) => {
      if (!controller.signal.aborted) setNotice({ error: true, text: error.message });
    };
    request('/venues', options).then((data) => {
      if (controller.signal.aborted) return;
      setVenues(data);
      setVenueId(data[0]?.id ?? '');
    }).catch(showError);
    if (isOfficer) {
      request('/venue-bookings/events', options).then((data) => {
        if (!controller.signal.aborted) setEvents(data);
      }).catch(showError);
    }
    return () => controller.abort();
  }, [session, isOfficer, request]);

  useEffect(() => {
    if (!venueId) return;
    const controller = new AbortController();
    setLoadingCalendar(true);
    request('/venues/' + venueId + '/bookings', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setBookings(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setNotice({ error: true, text: error.message });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCalendar(false);
      });
    return () => controller.abort();
  }, [request, revision, venueId]);

  function selectEvent(id) {
    const event = events.find((item) => item.id === id);
    setEventId(id);
    setStartTime(event ? localInputValue(event.start_time) : '');
    setEndTime(event ? localInputValue(event.end_time) : '');
  }

  async function mutate(path, method, body, message) {
    setBusy(true);
    setNotice(null);
    try {
      await request(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setNotice({ text: message });
    } catch (error) {
      setNotice({ error: true, text: error.message });
    } finally {
      setRevision((value) => value + 1);
      setBusy(false);
    }
  }

  function submitBooking(event) {
    event.preventDefault();
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start) {
      setNotice({ error: true, text: 'Enter a valid start time and a later end time.' });
      return;
    }
    void mutate('/venue-bookings', 'POST', {
      event_id: eventId, venue_id: venueId,
      start_time: start.toISOString(), end_time: end.toISOString(),
    }, 'Booking requested.');
  }

  return (
    <main className="container venue-workspace">
      <section className="hero">
        <h1>Venue booking</h1>
        <p>Find campus venues, check their schedules, and manage event bookings.</p>
        {!session && <Link to="/login">Log in to view venues</Link>}
      </section>

      {notice && (
        <p className={`api-status ${notice.error ? 'error' : 'success'}`}
          role={notice.error ? 'alert' : 'status'}>
          {notice.text}
        </p>
      )}

      {session && (
        <>
          <section className="setup">
            <h2>Venues</h2>
            <label className="venue-field">
              Venue
              <select value={venueId} disabled={busy} onChange={(event) => {
                setBookings([]);
                setVenueId(event.target.value);
                setNotice(null);
              }}>
                <option value="" disabled>{venues.length ? 'Choose a venue' : 'No venues available'}</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name} · {venue.location} · Capacity {venue.capacity}{venue.is_active ? '' : ' · Inactive'}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {isOfficer && (
            <section className="setup">
              <h2>Request a booking</h2>
              <form className="venue-form" onSubmit={submitBooking}>
                <label className="venue-field">
                  Club event
                  <select required value={eventId} disabled={busy} onChange={(event) => selectEvent(event.target.value)}>
                    <option value="">{events.length ? 'Choose an event' : 'No club events available'}</option>
                    {events.map((event) => <option value={event.id} key={event.id}>{event.title}</option>)}
                  </select>
                </label>
                <label className="venue-field">
                  Start time
                  <input type="datetime-local" value={startTime} required disabled={busy}
                    onChange={(event) => setStartTime(event.target.value)} />
                </label>
                <label className="venue-field">
                  End time
                  <input type="datetime-local" value={endTime} required disabled={busy}
                    onChange={(event) => setEndTime(event.target.value)} />
                </label>
                <button type="submit" disabled={busy || !venueId || !eventId}>Request booking</button>
              </form>
            </section>
          )}

          <section className="setup">
            <div className="venue-calendar-heading">
              <div><h2>Booking calendar</h2><p className="muted">Times shown in {timezone}.</p></div>
              <button type="button" disabled={!venueId || busy || loadingCalendar}
                onClick={() => setRevision((value) => value + 1)}>Refresh</button>
            </div>
            {loadingCalendar && <p role="status">Loading schedule…</p>}
            {!loadingCalendar && bookings.length === 0 && (
              <p>{venueId ? 'No bookings to display.' : 'Choose a venue to view its schedule.'}</p>
            )}
            {bookings.length > 0 && (
              <div className="venue-table-scroll">
                <table>
                  <thead><tr><th scope="col">Event</th><th scope="col">Start</th><th scope="col">End</th>
                    <th scope="col">Status</th>{isAdmin && <th scope="col">Review</th>}</tr></thead>
                  <tbody>
                    {bookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>{booking.event_title || 'Reserved'}</td>
                        <td>{new Date(booking.start_time).toLocaleString()}</td>
                        <td>{new Date(booking.end_time).toLocaleString()}</td>
                        <td>{booking.status}</td>
                        {isAdmin && (
                          <td>{booking.status === 'pending' && (
                            <div className="venue-review">
                              <button type="button" disabled={busy || loadingCalendar} onClick={() =>
                                void mutate('/venue-bookings/' + booking.id + '/review', 'PATCH',
                                  { status: 'approved' }, 'Booking approved.')}>Approve</button>
                              <button type="button" disabled={busy || loadingCalendar} onClick={() =>
                                void mutate('/venue-bookings/' + booking.id + '/review', 'PATCH',
                                  { status: 'rejected' }, 'Booking rejected.')}>Reject</button>
                            </div>
                          )}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
