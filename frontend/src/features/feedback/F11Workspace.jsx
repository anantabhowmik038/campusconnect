import { useCallback, useEffect, useState } from 'react';

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, options, fetcher = fetch) {
  const response = await fetcher(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Feedback request failed.');
  return payload;
}

export default function F11Workspace({ session }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [summary, setSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  const [summaryRevision, setSummaryRevision] = useState(0);
  const [status, setStatus] = useState({ type: '', message: '' });

  const loadEligibleEvents = useCallback(async () => {
    if (!session) {
      setEvents([]);
      return;
    }
    try {
      const result = await request('/feedback/eligible-events', undefined, session.authenticatedFetch);
      setEvents(result.events);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [session]);

  const loadSummary = useCallback(async (eventId, signal) => {
    if (!eventId) {
      setSummary(null);
      return;
    }
    try {
      setSummary(await request(`/feedback/events/${eventId}`, { signal }));
    } catch (error) {
      if (error.name === 'AbortError') return;
      setStatus({ type: 'error', message: error.message });
    }
  }, []);

  useEffect(() => { void loadEligibleEvents(); }, [loadEligibleEvents]);
  useEffect(() => {
    const controller = new AbortController();
    void loadSummary(selectedEvent, controller.signal);
    return () => controller.abort();
  }, [loadSummary, selectedEvent, summaryRevision]);

  const selected = events.find((event) => event.id === selectedEvent);

  function selectEvent(eventId) {
    const choice = events.find((event) => event.id === eventId);
    setSelectedEvent(eventId);
    setSummary(null);
    setRating(String(choice?.existing_rating ?? 5));
    setComment(choice?.existing_comment ?? '');
  }

  async function submitFeedback(event) {
    event.preventDefault();
    if (!session || !selected || saving) return;
    setSaving(true);
    try {
      await request(`/feedback/events/${selectedEvent}`, {
        method: 'POST',
        body: JSON.stringify({ rating: Number(rating), comment }),
      }, session.authenticatedFetch);
      setStatus({ type: 'success', message: 'Feedback saved.' });
      setSummaryRevision((revision) => revision + 1);
      await loadEligibleEvents();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteReview() {
    if (!session || !selected?.feedback_id || saving) return;
    setSaving(true);
    try {
      await request(`/feedback/${selected.feedback_id}`, { method: 'DELETE' }, session.authenticatedFetch);
      setRating('5');
      setComment('');
      setStatus({ type: 'success', message: 'Feedback deleted.' });
      setSummaryRevision((revision) => revision + 1);
      await loadEligibleEvents();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="feedback" className="feedback">
      <div className="workspace-heading">
        <div><span className="eyebrow">F11 · FEEDBACK</span><h2>Post-event feedback & ratings</h2></div>
        {status.message && <span className={`api-status ${status.type}`}>{status.message}</span>}
      </div>
      <div className="feedback-grid">
        <div className="feedback-card">
          <label className="feedback-field">Attended completed event
            <select value={selectedEvent} disabled={saving || !session} onChange={(event) => selectEvent(event.target.value)}>
              <option value="">Select an event</option>
              {events.map((event) => <option value={event.id} key={event.id}>{event.title}{event.feedback_id ? ' (reviewed)' : ''}</option>)}
            </select>
          </label>
          {!session
            ? <p className="empty-state">Log in to find events you attended.</p>
            : events.length === 0
              ? <p className="empty-state">No completed attended events are eligible for feedback.</p>
              : <form className="feedback-form" onSubmit={submitFeedback}>
                <label className="feedback-field">Rating
                  <select value={rating} disabled={saving} onChange={(event) => setRating(event.target.value)}>
                    {[5, 4, 3, 2, 1].map((value) => <option value={value} key={value}>{value} / 5</option>)}
                  </select>
                </label>
                <label className="feedback-field">Review
                  <textarea value={comment} disabled={saving} onChange={(event) => setComment(event.target.value)} maxLength="2000" rows="4" placeholder="Share your experience (optional)" />
                </label>
                <button type="submit" disabled={!selected || saving}>Save feedback</button>
                {selected?.feedback_id && <button type="button" disabled={saving} onClick={() => void deleteReview()}>Delete feedback</button>}
              </form>}
        </div>
        <div className="feedback-card">
          <h3>Feedback summary</h3>
          {!summary
            ? <p className="empty-state">Select an event to view its rating summary.</p>
            : <div className="feedback-summary">
              <div className="rating-total"><strong>{summary.summary.average_rating}</strong><span>out of 5<br />{summary.summary.review_count} review(s)</span></div>
              <div className="rating-breakdown">
                {[5, 4, 3, 2, 1].map((value) => <span key={value}>{value} stars: {summary.summary[`${['zero', 'one', 'two', 'three', 'four', 'five'][value]}_star_count`]}</span>)}
              </div>
              <div className="review-list">{summary.reviews.map((review) => <article className="review" key={review.id}><strong>{review.rating}/5 · {review.reviewer_name}</strong><p>{review.comment || 'No written comment.'}</p></article>)}</div>
            </div>}
        </div>
      </div>
    </section>
  );
}
