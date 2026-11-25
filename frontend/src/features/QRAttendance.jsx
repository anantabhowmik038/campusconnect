import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BrowserQRCodeReader } from '@zxing/browser';

export default function QRAttendance({ user, token, apiBase = '/api' }) {
  const [registrationId, setRegistrationId] = useState('');
  const [eventId, setEventId] = useState('');
  const [ticket, setTicket] = useState(null);
  const [scanToken, setScanToken] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  const videoRef = useRef(null);

  const isStaff = ['club_officer', 'campus_admin'].includes(user?.role);

  async function request(path, method = 'GET', body) {
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
  }

  async function run(action) {
    setBusy(true);
    setMessage('');
    setError('');

    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function generateTicket(e) {
    e.preventDefault();

    await run(async () => {
      setTicket(null);

      const data = await request('/attendance/tickets', 'POST', {
        registration_id: registrationId.trim(),
      });

      setTicket(data);
      setMessage('QR ticket generated successfully.');
    });
  }

  useEffect(() => {
    if (!scanning || !isStaff) return;

    let active = true;
    let controls;

    const reader = new BrowserQRCodeReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err, scanner) => {
        if (result && active) {
          setScanToken(result.getText());
          setMessage('QR detected. Confirm check-in.');
          scanner.stop();
          setScanning(false);
        }
      })
      .then((scanner) => {
        controls = scanner;

        if (!active) controls.stop();
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Camera unavailable');
          setScanning(false);
        }
      });

    return () => {
      active = false;
      controls?.stop();
    };
  }, [scanning, isStaff]);

  async function checkIn(e) {
    e.preventDefault();

    await run(async () => {
      const data = await request('/attendance/check-in', 'POST', {
        ticket_token: scanToken.trim(),
      });

      setMessage(`Attendance recorded at ${new Date(data.checked_in_at).toLocaleString()}`);

      setScanToken('');
    });
  }

  async function loadAttendance() {
    await run(async () => {
      const data = await request(`/events/${eventId.trim()}/attendance`);

      setAttendance(data);
    });
  }

  const card = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '24px',
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
    background: '#2563eb',
    color: '#ffffff',
    padding: '10px 18px',
    border: 'none',
    borderRadius: '7px',
    cursor: 'pointer',
    margin: '4px',
  };

  const checkedIn = attendance.filter((person) => person.checked_in).length;

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
      <h1>QR Attendance & Check-in</h1>
      <p>Generate event tickets and manage attendance.</p>

      {!user && <p>Sign in to access attendance services.</p>}

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
        <h2>My QR Ticket</h2>

        <form onSubmit={generateTicket}>
          <label>Registration ID</label>

          <input
            style={input}
            value={registrationId}
            placeholder="Enter registration UUID"
            onChange={(e) => setRegistrationId(e.target.value)}
            required
          />

          <button style={button} disabled={!user || busy} type="submit">
            Generate QR Ticket
          </button>
        </form>

        {ticket && (
          <div
            style={{
              textAlign: 'center',
              padding: '20px',
            }}
          >
            <QRCodeSVG value={ticket.ticket_token} size={240} level="M" marginSize={4} />

            <p>Expires: {new Date(ticket.expires_at).toLocaleString()}</p>

            <p>Show this QR code to event staff.</p>
          </div>
        )}
      </section>

      {(isStaff || !user) && (
        <section style={card}>
          <h2>Scan QR Ticket</h2>

          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              display: scanning ? 'block' : 'none',
              width: '100%',
              maxWidth: '480px',
              borderRadius: '10px',
            }}
          />

          <button style={button} disabled={!isStaff || busy} onClick={() => setScanning((v) => !v)}>
            {scanning ? 'Stop Camera' : 'Start Camera'}
          </button>

          <form onSubmit={checkIn}>
            <label>QR Ticket Token</label>

            <textarea
              style={input}
              rows={3}
              value={scanToken}
              onChange={(e) => setScanToken(e.target.value)}
              placeholder="Scan a QR or paste ticket token"
              required
            />

            <button type="submit" style={button} disabled={!isStaff || busy}>
              Confirm Check-in
            </button>
          </form>
        </section>
      )}

      {(isStaff || !user) && (
        <section style={card}>
          <h2>Attendance Roster</h2>

          <label>Event ID</label>

          <input
            style={input}
            value={eventId}
            placeholder="Enter event UUID"
            onChange={(e) => {
              setEventId(e.target.value);
              setAttendance([]);
            }}
          />

          <button
            style={button}
            disabled={!isStaff || busy || !eventId.trim()}
            onClick={loadAttendance}
          >
            Load Attendance
          </button>

          <p>Total Attendees: {attendance.length}</p>
          <p>Checked In: {checkedIn}</p>
          <p>Not Checked In: {attendance.length - checkedIn}</p>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                textAlign: 'left',
              }}
            >
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Attendance</th>
                  <th>Check-in Time</th>
                </tr>
              </thead>

              <tbody>
                {attendance.map((person) => (
                  <tr key={person.registration_id}>
                    <td>{person.full_name}</td>
                    <td
                      style={{
                        color: person.checked_in ? 'green' : '#64748b',
                      }}
                    >
                      {person.checked_in ? 'Present' : 'Not checked in'}
                    </td>
                    <td>
                      {person.checked_in_at ? new Date(person.checked_in_at).toLocaleString() : '-'}
                    </td>
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
