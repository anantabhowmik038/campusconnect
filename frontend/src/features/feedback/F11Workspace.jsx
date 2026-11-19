import { useCallback, useEffect, useState } from 'react';

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, options) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Feedback request failed.');
  return payload;
}

export default function F11Workspace() {
  const [userId, setUserId] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState({ type: '', message: '' });

  const loadEligibleEvents = useCallback(async () => {
    if (!userId.trim()) {
      setEvents([]);
      return;
    }
    try {
      const result = await request('/feedback/eligible-events', {
        headers: { 'X-User-Id': userId.trim() },
      });
      setEvents(result.events);
      setStatus({ type: 'success', message: 'Eligible events loaded.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [userId]);

  const loadSummary = useCallback(async (eventId) => {
    if (!eventId) {
      setSummary(null);
      return;
    }
    try {
      setSummary(await request(`/feedback/events/${eventId}`));
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, []);

  useEffect(() => { void loadEligibleEvents(); }, [loadEligibleEvents]);
  useEffect(() => { void loadSummary(selectedEvent); }, [loadSummary, selectedEvent]);

  async function submitFeedback(event) {
    event.preventDefault();
    try {
      await request(`/feedback/events/${selectedEvent}`, {
        method: 'POST',
        headers: { 'X-User-Id': userId.trim() },
        body: JSON.stringify({ rating: Number(rating), comment }),
      });
      setStatus({ type: 'success', message: 'Feedback saved.' });
      await loadSummary(selectedEvent);
      await loadEligibleEvents();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  return (
    <section id="feedback" className="feedback workspace">
      <div className="workspace-heading">
        <div><span className="eyebrow">F11 · FEEDBACK</span><h2>Post-event feedback & ratings</h2></div>
        {status.message && <span className={`api-status ${status.type}`}>{status.message}</span>}
      </div>
      <div className="feedback-grid">
        <div className="communication-card">
          <label className="user-id-field">Current user ID
            <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="UUID from authentication" />
          </label>
          <label className="user-id-field">Attended completed event
            <select value={selectedEvent} onChange={(event) => setSelectedEvent(event.target.value)}>
              <option value="">Select an event</option>
              {events.map((event) => <option value={event.id} key={event.id}>{event.title}{event.feedback_id ? ' (reviewed)' : ''}</option>)}
            </select>
          </label>
          {!userId
            ? <p className="empty-state">Enter your user ID to find events you attended.</p>
            : events.length === 0
              ? <p className="empty-state">No completed attended events are eligible for feedback.</p>
              : <form className="feedback-form" onSubmit={submitFeedback}>
                <label className="user-id-field">Rating
                  <select value={rating} onChange={(event) => setRating(event.target.value)}>
                    {[5, 4, 3, 2, 1].map((value) => <option value={value} key={value}>{value} / 5</option>)}
                  </select>
                </label>
                <label className="user-id-field">Review
                  <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength="2000" rows="4" placeholder="Share your experience (optional)" />
                </label>
                <button type="submit" disabled={!selectedEvent}>Save feedback</button>
              </form>}
        </div>
        <div className="communication-card">
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
