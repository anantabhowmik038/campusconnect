import { useCallback, useEffect, useState } from 'react';

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, options) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Analytics request failed.');
  return payload;
}

function MetricCard({ label, value }) {
  return <article className="analytics-metric"><span>{label}</span><strong>{value}</strong></article>;
}

export default function F12Workspace() {
  const [token] = useState(() => localStorage.getItem('token') || '');
  const [overview, setOverview] = useState(null);
  const [clubId, setClubId] = useState('');
  const [clubAnalytics, setClubAnalytics] = useState(null);
  const [eventId, setEventId] = useState('');
  const [eventAnalytics, setEventAnalytics] = useState(null);
  const [status, setStatus] = useState({ type: 'loading', message: 'Loading analytics...' });

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const loadOverview = useCallback(async () => {
    if (!token) {
      setStatus({ type: 'error', message: 'Log in to view analytics.' });
      return;
    }
    try {
      const result = await request('/analytics/overview', { headers: authHeaders() });
      setOverview(result.analytics);
      setStatus({ type: 'success', message: 'Campus analytics loaded.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [authHeaders, token]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  async function loadClubAnalytics(event) {
    event.preventDefault();
    if (!clubId) return;
    try {
      const result = await request(`/analytics/clubs/${clubId}`, { headers: authHeaders() });
      setClubAnalytics(result.analytics);
      setStatus({ type: 'success', message: 'Club analytics loaded.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  async function loadEventAnalytics(event) {
    event.preventDefault();
    if (!eventId) return;
    try {
      const result = await request(`/analytics/events/${eventId}`, { headers: authHeaders() });
      setEventAnalytics(result.analytics);
      setStatus({ type: 'success', message: 'Event analytics loaded.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  async function exportCsv() {
    try {
      const response = await fetch(
        `${apiBase}/analytics/export${clubId ? `?clubId=${encodeURIComponent(clubId)}` : ''}`,
        { headers: authHeaders() },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'CSV export failed.');
      }
      const csv = await response.text();
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'campusconnect-analytics.csv';
      link.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Analytics CSV downloaded.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  const eventMetrics = eventAnalytics?.metrics;
  const starCounts = eventMetrics ? [
    eventMetrics.five_star_count,
    eventMetrics.four_star_count,
    eventMetrics.three_star_count,
    eventMetrics.two_star_count,
    eventMetrics.one_star_count,
  ] : [];
  const maxStars = Math.max(1, ...starCounts);

  return (
    <section id="analytics" className="analytics workspace">
      <div className="workspace-heading">
        <div><span className="eyebrow">F12 · ANALYTICS</span><h2>Club & event dashboard</h2></div>
        <span className={`api-status ${status.type}`}>{status.message}</span>
      </div>
      {!token ? (
        <div className="analytics-card"><p className="empty-state">Log in to view authorized analytics.</p></div>
      ) : (
        <>
          {overview && (
            <div className="analytics-grid">
              <MetricCard label="Active clubs" value={overview.active_clubs} />
              <MetricCard label="Total events" value={overview.total_events} />
              <MetricCard label="Completed events" value={overview.completed_events} />
              <MetricCard label="Registrations" value={overview.registrations} />
              <MetricCard label="Attendance" value={overview.attendance} />
              <MetricCard label="Feedback" value={overview.feedback_count} />
            </div>
          )}
          <div className="analytics-layout">
            <div className="analytics-card">
              <h3>Club performance</h3>
              <form className="analytics-form" onSubmit={loadClubAnalytics}>
                <input value={clubId} onChange={(event) => setClubId(event.target.value)} placeholder="Club UUID" />
                <button type="submit">View club</button>
                <button type="button" onClick={() => void exportCsv()} disabled={!clubId}>Export club CSV</button>
              </form>
              {clubAnalytics && (
                <>
                  <div className="analytics-table-heading"><strong>{clubAnalytics.club.name}</strong><span>{clubAnalytics.club.status}</span></div>
                  <div className="analytics-grid compact">
                    <MetricCard label="Events" value={clubAnalytics.metrics.total_events} />
                    <MetricCard label="Registrations" value={clubAnalytics.metrics.registrations} />
                    <MetricCard label="Attendance" value={clubAnalytics.metrics.attendance} />
                    <MetricCard label="Average rating" value={clubAnalytics.metrics.average_rating} />
                  </div>
                  <div className="analytics-table-wrap">
                    <table className="analytics-table">
                      <thead><tr><th>Event</th><th>Status</th><th>Registrations</th><th>Attendance</th><th>Rating</th></tr></thead>
                      <tbody>{clubAnalytics.events.map((item) => (
                        <tr key={item.id}>
                          <td>{item.title}</td><td>{item.status}</td><td>{item.registrations}</td><td>{item.attendance}</td><td>{item.average_rating}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="analytics-card">
              <h3>Event analytics</h3>
              <form className="analytics-form" onSubmit={loadEventAnalytics}>
                <input value={eventId} onChange={(event) => setEventId(event.target.value)} placeholder="Event UUID" />
                <button type="submit">View event</button>
              </form>
              {eventAnalytics && (
                <>
                  <div className="analytics-table-heading"><strong>{eventAnalytics.event.title}</strong><span>{eventAnalytics.event.status}</span></div>
                  <div className="analytics-grid compact">
                    <MetricCard label="Registrations" value={eventMetrics.registrations} />
                    <MetricCard label="Waitlist" value={eventMetrics.waitlist_count} />
                    <MetricCard label="Attendance" value={eventMetrics.attendance} />
                    <MetricCard label="Average rating" value={eventMetrics.average_rating} />
                  </div>
                  <div className="star-chart" aria-label="Rating distribution">
                    {[5, 4, 3, 2, 1].map((rating, index) => (
                      <div className="star-row" key={rating}>
                        <span>{rating} star</span>
                        <div className="star-track"><div style={{ width: `${(starCounts[index] / maxStars) * 100}%` }} /></div>
                        <b>{starCounts[index]}</b>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <button className="analytics-export" type="button" onClick={() => void exportCsv()}>{clubId ? 'Export club analytics' : 'Export all analytics'}</button>
        </>
      )}
    </section>
  );
}
