import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function QRAttendance({ session, apiBase }) {
  const [registrations, setRegistrations] = useState([]);
  const [staffEvents, setStaffEvents] = useState([]);
  const [registrationId, setRegistrationId] = useState('');
  const [eventId, setEventId] = useState('');
  const [ticket, setTicket] = useState(null);
  const [scanToken, setScanToken] = useState('');
  const [attendance, setAttendance] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const isStaff = ['club_officer', 'campus_admin'].includes(session?.user.role);

  const request = useCallback(async (path, options) => {
    const response = await session.authenticatedFetch(apiBase + path, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Attendance request failed.');
    return payload.data;
  }, [apiBase, session]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const showError = (error) => {
      if (!controller.signal.aborted) setNotice({ error: true, text: error.message });
    };
    request('/attendance/registrations', options).then((data) => {
      if (!controller.signal.aborted) setRegistrations(data);
    }).catch(showError);
    if (isStaff) {
      request('/attendance/events', options).then((data) => {
        if (!controller.signal.aborted) setStaffEvents(data);
      }).catch(showError);
    }
    return () => controller.abort();
  }, [isStaff, request, session]);

  useEffect(() => {
    if (!scanning || !isStaff) return;
    const video = videoRef.current;
    let active = true;
    let controls;

    async function scan() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (!active) return;
        controls = await new BrowserQRCodeReader().decodeFromVideoDevice(undefined, video, (result, _error, scanner) => {
          if (!active || !result) return;
          active = false;
          scanner.stop();
          setScanToken(result.getText());
          setNotice({ text: 'QR detected. Confirm check-in.' });
          setScanning(false);
        });
        if (!active) controls.stop();
      } catch {
        if (!active) return;
        setNotice({ error: true, text: 'Could not start the camera. Check browser permissions or enter the ticket code.' });
        setScanning(false);
      }
    }

    void scan();
    return () => {
      active = false;
      controls?.stop();
    };
  }, [isStaff, scanning]);

  async function run(action) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice({ error: true, text: error.message });
    } finally {
      setBusy(false);
    }
  }

  function post(path, body) {
    return request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function generateTicket(event) {
    event.preventDefault();
    void run(async () => {
      setTicket(null);
      setTicket(await post('/attendance/tickets', { registration_id: registrationId }));
    });
  }

  async function loadRoster() {
    setAttendance(null);
    setAttendance(await request('/events/' + eventId + '/attendance'));
  }

  function confirmCheckIn(event) {
    event.preventDefault();
    setScanning(false);
    void run(async () => {
      const result = await post('/attendance/check-in', { ticket_token: scanToken.trim(), event_id: eventId });
      setScanToken('');
      setNotice({ text: 'Check-in recorded at ' + new Date(result.checked_in_at).toLocaleString() + '.' });
      setAttendance((current) => current?.map((person) => person.registration_id === result.registration_id
        ? { ...person, checked_in: true, checked_in_at: result.checked_in_at }
        : person) ?? null);
    });
  }

  const checkedIn = attendance?.filter((person) => person.checked_in).length;

  return (
    <main className="container attendance-workspace">
      <section className="hero">
        <h1>QR attendance and check-in</h1>
        <p>Get a ticket for an existing registration or check attendees in at an event.</p>
        {!session && <Link to="/login">Log in to access attendance</Link>}
      </section>

      {notice && (
        <p className={`api-status ${notice.error ? 'error' : 'success'}`}
          role={notice.error ? 'alert' : 'status'}>{notice.text}</p>
      )}

      {session && (
        <section className="setup">
          <h2>My QR ticket</h2>
          <form className="attendance-form" onSubmit={generateTicket}>
            <label>
              Registered event
              <select required value={registrationId} disabled={busy} onChange={(event) => {
                setRegistrationId(event.target.value);
                setTicket(null);
              }}>
                <option value="">{registrations.length ? 'Choose an event' : 'No eligible registrations'}</option>
                {registrations.map((entry) => <option value={entry.id} key={entry.id}>{entry.event_title}</option>)}
              </select>
            </label>
            <button disabled={!registrationId || busy}>Generate QR ticket</button>
          </form>
          {ticket && (
            <div className="attendance-ticket">
              <QRCodeSVG value={ticket.ticket_token} size={220} level="M" marginSize={4} title="Event check-in ticket" />
              <p>Expires {new Date(ticket.expires_at).toLocaleString()}. Show this code to event staff.</p>
              <details>
                <summary>Show ticket code for manual entry</summary>
                <label>Ticket code<input value={ticket.ticket_token} readOnly onFocus={(event) => event.target.select()} /></label>
              </details>
            </div>
          )}
        </section>
      )}

      {isStaff && (
        <>
          <section className="setup">
            <h2>Check in an attendee</h2>
            <form className="attendance-form" onSubmit={confirmCheckIn}>
              <label>
                Event
                <select required value={eventId} disabled={busy} onChange={(event) => {
                  setEventId(event.target.value);
                  setAttendance(null);
                  setScanToken('');
                  setScanning(false);
                }}>
                  <option value="">{staffEvents.length ? 'Choose an event' : 'No events with registrations'}</option>
                  {staffEvents.map((entry) => <option value={entry.id} key={entry.id}>{entry.title}</option>)}
                </select>
              </label>
              {scanning && <video ref={videoRef} autoPlay muted playsInline aria-label="QR scanner camera preview" />}
              <button type="button" disabled={!eventId || busy} onClick={() => setScanning(!scanning)}>
                {scanning ? 'Stop camera' : 'Start camera'}
              </button>
              <label>
                Ticket code
                <textarea rows={3} maxLength={256} value={scanToken} disabled={busy} required
                  onChange={(event) => setScanToken(event.target.value)} placeholder="Scan a QR code or paste its ticket code" />
              </label>
              <button disabled={!eventId || !scanToken.trim() || busy}>Confirm check-in</button>
            </form>
          </section>
          <section className="setup">
            <div className="attendance-roster-heading">
              <h2>Attendance roster</h2>
              <button type="button" disabled={!eventId || busy} onClick={() => void run(loadRoster)}>Load roster</button>
            </div>
            {attendance && (
              <>
                <p>{checkedIn} of {attendance.length} checked in</p>
                {attendance.length > 0 && (
                  <div className="attendance-table">
                    <table>
                      <thead><tr><th scope="col">Name</th><th scope="col">Attendance</th><th scope="col">Check-in time</th></tr></thead>
                      <tbody>
                        {attendance.map((person) => (
                          <tr key={person.registration_id}>
                            <td>{person.full_name}</td>
                            <td>{person.checked_in ? 'Present' : 'Not checked in'}</td>
                            <td>{person.checked_in_at ? new Date(person.checked_in_at).toLocaleString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
