import { useState } from 'react';

function localDateTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 23);
}

function formValues(event) {
  return {
    club_id: event?.club_id ?? '',
    title: event?.title ?? '',
    description: event?.description ?? '',
    category: event?.category ?? '',
    image_url: event?.image_url ?? '',
    start_time: localDateTime(event?.start_time),
    end_time: localDateTime(event?.end_time),
    capacity: event?.capacity?.toString() ?? '',
  };
}

function toTimestamp(value) {
  const date = new Date(value);
  // Date can silently normalize local times in a daylight-saving gap.
  if (!Number.isFinite(+date) || !localDateTime(date).startsWith(value)) {
    throw new Error('Choose a valid time in your local timezone.');
  }
  return date.toISOString();
}

export default function EventProposalForm({ proposal, onSave, onCancel }) {
  const [initial] = useState(() => formValues(proposal));
  const [values, setValues] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const input = (name) => ({
    name,
    value: values[name],
    onChange: ({ target }) => setValues((current) => ({ ...current, [name]: target.value })),
  });

  async function save(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const start = values.start_time === initial.start_time && proposal ? proposal.start_time : toTimestamp(values.start_time);
      const end = values.end_time === initial.end_time && proposal ? proposal.end_time : toTimestamp(values.end_time);
      if (+new Date(end) <= +new Date(start)) throw new Error('End time must be after start time.');
      const payload = {
        ...values,
        start_time: start,
        end_time: end,
        capacity: Number(values.capacity),
        category: values.category.trim() || null,
        image_url: values.image_url.trim() || null,
      };
      if (!values.title.trim() || !values.description.trim()) throw new Error('Enter a title and description.');
      if (proposal) {
        for (const key of Object.keys(payload)) {
          if (key === 'club_id' || values[key] === initial[key]) delete payload[key];
        }
        if (Object.keys(payload).length === 0) throw new Error('Change at least one field before saving.');
      }
      await onSave(payload);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="event-panel event-form" onSubmit={save}>
      <h2>{proposal ? 'Edit proposal' : 'Create proposal'}</h2>
      {proposal?.review_note && <p className="event-feedback"><strong>Review feedback</strong> {proposal.review_note}</p>}
      <fieldset disabled={busy}>
        {!proposal && <label>Assigned club ID<input {...input('club_id')} required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" /></label>}
        <label>Title<input {...input('title')} required maxLength={200} /></label>
        <label>Description<textarea {...input('description')} required maxLength={10000} rows={4} /></label>
        <div className="event-fields">
          <label>Category<input {...input('category')} maxLength={80} /></label>
          <label>Capacity<input {...input('capacity')} type="number" required min={1} max={2147483647} /></label>
        </div>
        <div className="event-fields">
          <label>Start (local time)<input {...input('start_time')} type="datetime-local" required step="0.001" /></label>
          <label>End (local time)<input {...input('end_time')} type="datetime-local" required step="0.001" /></label>
        </div>
        <label>Image URL<input {...input('image_url')} type="url" maxLength={2048} /></label>
        <div className="event-actions">
          <button type="submit">{busy ? 'Saving...' : proposal ? 'Save changes' : 'Save draft'}</button>
          <button type="button" className="event-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </fieldset>
      {error && <p className="event-error" role="alert">{error}</p>}
    </form>
  );
}
