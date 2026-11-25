import { useState } from 'react';

export default function VolunteerManagement({ user, token, apiBase = '/api' }) {
  const [eventId, setEventId] = useState('');
  const [shifts, setShifts] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedShift, setSelectedShift] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isOfficer = ['club_officer', 'campus_admin'].includes(user?.role);

  const isStudent = user?.role === 'student';

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
    setError('');
    setMessage('');

    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadShifts() {
    if (!eventId.trim()) {
      throw new Error('Enter an event ID');
    }

    const data = await request(`/events/${eventId.trim()}/volunteer-shifts`);

    setShifts(data);
    setApplications([]);
    setSelectedShift('');
  }

  async function createShift(e) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);

    await run(async () => {
      await request(`/events/${eventId.trim()}/volunteer-shifts`, 'POST', {
        title: form.get('title'),
        start_time: new Date(form.get('start_time')).toISOString(),
        end_time: new Date(form.get('end_time')).toISOString(),
        required_volunteers: Number(form.get('required_volunteers')),
      });

      await loadShifts();
      setMessage('Volunteer shift created.');
    });
  }

  async function apply(shiftId) {
    await run(async () => {
      await request(`/volunteer-shifts/${shiftId}/applications`, 'POST', {});

      setMessage('Application submitted successfully.');
    });
  }

  async function loadApplications(shiftId) {
    const data = await request(`/volunteer-shifts/${shiftId}/applications`);

    setApplications(data);
    setSelectedShift(shiftId);
  }

  async function review(applicationId, status) {
    await run(async () => {
      await request(`/volunteer-applications/${applicationId}/review`, 'PATCH', { status });

      await loadApplications(selectedShift);
      setMessage(`Application ${status}.`);
    });
  }

  const card = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
  };

  const input = {
    display: 'block',
    width: '100%',
    padding: '12px',
    margin: '8px 0 16px',
    border: '1px solid #cbd5e1',
    borderRadius: '7px',
    boxSizing: 'border-box',
    background: '#fff',
    color: '#0f172a',
  };

  const button = {
    background: '#2563eb',
    color: '#fff',
    padding: '10px 18px',
    border: 'none',
    borderRadius: '7px',
    cursor: 'pointer',
    margin: '4px',
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
      <h1>Volunteer Management</h1>
      <p>Discover opportunities and manage event volunteers.</p>

      {!user && <p>Sign in to access volunteer services.</p>}

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
        <h2>Find Volunteer Opportunities</h2>

        <label>Event ID</label>

        <input
          style={input}
          value={eventId}
          placeholder="Enter event UUID"
          onChange={(e) => {
            setEventId(e.target.value);
            setShifts([]);
            setApplications([]);
            setSelectedShift('');
          }}
        />

        <button style={button} disabled={!user || busy} onClick={() => run(loadShifts)}>
          Find Shifts
        </button>
      </section>

      <section style={card}>
        <h2>Available Shifts</h2>

        {!shifts.length && <p>No shifts loaded.</p>}

        {shifts.map((shift) => (
          <article key={shift.id} style={card}>
            <h3>{shift.title}</h3>

            <p>Start: {new Date(shift.start_time).toLocaleString()}</p>

            <p>End: {new Date(shift.end_time).toLocaleString()}</p>

            <p>
              Volunteers: {shift.accepted_volunteers || 0}
              {' / '}
              {shift.required_volunteers}
            </p>

            {isStudent && (
              <button style={button} disabled={busy} onClick={() => apply(shift.id)}>
                Apply Now
              </button>
            )}

            {isOfficer && (
              <button
                style={button}
                disabled={busy}
                onClick={() => run(() => loadApplications(shift.id))}
              >
                View Applications
              </button>
            )}
          </article>
        ))}
      </section>

      {(isOfficer || !user) && (
        <section style={card}>
          <h2>Create Volunteer Shift</h2>

          <form onSubmit={createShift}>
            <fieldset disabled={!isOfficer || busy || !eventId} style={{ border: 0, padding: 0 }}>
              <label>Shift Title</label>
              <input name="title" style={input} placeholder="Event Support Team" required />

              <label>Start Time</label>
              <input name="start_time" type="datetime-local" style={input} required />

              <label>End Time</label>
              <input name="end_time" type="datetime-local" style={input} required />

              <label>Required Volunteers</label>
              <input name="required_volunteers" type="number" min="1" style={input} required />

              <button style={button} type="submit">
                Create Shift
              </button>
            </fieldset>
          </form>
        </section>
      )}

      {(isOfficer || !user) && (
        <section style={card}>
          <h2>Manage Applications</h2>

          {!applications.length && <p>No applications loaded.</p>}

          {applications.map((application) => (
            <article key={application.id} style={card}>
              <h3>{application.full_name}</h3>
              <p>Status: {application.status}</p>

              {application.status === 'pending' && (
                <>
                  <button
                    disabled={busy}
                    style={{
                      ...button,
                      background: '#16a34a',
                    }}
                    onClick={() => review(application.id, 'accepted')}
                  >
                    Accept
                  </button>

                  <button
                    disabled={busy}
                    style={{
                      ...button,
                      background: '#dc2626',
                    }}
                    onClick={() => review(application.id, 'rejected')}
                  >
                    Reject
                  </button>
                </>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
