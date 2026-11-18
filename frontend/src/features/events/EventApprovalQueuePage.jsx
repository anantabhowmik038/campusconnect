import { useState } from 'react';
import { EventListStatus, EventPagination, ProposalSummary, useEventList } from './EventList.jsx';

function ReviewForm({ onReview, busy }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function review(event) {
    event.preventDefault();
    const decision = event.nativeEvent.submitter?.value;
    if (decision !== 'approved' && decision !== 'rejected') return;
    if (decision === 'rejected' && !note.trim()) {
      setError('Enter feedback before rejecting this proposal.');
      return;
    }
    setError('');
    void onReview({ decision, review_note: note.trim() || null });
  }

  return (
    <form className="event-form" onSubmit={review}>
      <fieldset disabled={busy}>
        <label>Review feedback<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} /></label>
        <div className="event-actions">
          <button type="submit" value="approved">Approve</button>
          <button type="submit" value="rejected" className="event-secondary">Reject</button>
        </div>
      </fieldset>
      {error && <p className="event-error" role="alert">{error}</p>}
    </form>
  );
}

export default function EventApprovalQueuePage({ request }) {
  const list = useEventList(request, '/pending');
  const [reviewing, setReviewing] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function review(body) {
    setProcessing(true);
    setError('');
    setMessage('');
    try {
      await request('/' + reviewing.id + '/review', {
        method: 'PATCH',
        body: { ...body, submission_version: reviewing.submission_version },
      });
      setReviewing(null);
      setMessage('Proposal ' + body.decision + '.');
      list.refresh();
    } catch (failure) {
      if (failure.status === 409) {
        setReviewing(null);
        setError('This proposal changed while you were reviewing it. The queue is refreshing. Open the latest submission to review it.');
        list.refresh();
      } else {
        setError(failure.message);
      }
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      <div className="event-page-heading"><h1>Admin approval queue</h1></div>
      {message && <p role="status">{message}</p>}
      {error && <p className="event-error" role="alert">{error}</p>}
      <EventListStatus list={list} empty="There are no proposals awaiting review." />
      {list.data?.map((proposal) => (
        <article className="event-panel" key={proposal.id}>
          <ProposalSummary proposal={reviewing?.id === proposal.id ? reviewing : proposal} />
          {reviewing?.id === proposal.id ? (
            <>
              <ReviewForm onReview={review} busy={processing} />
              <button type="button" disabled={processing} className="event-secondary" onClick={() => { setReviewing(null); setError(''); list.refresh(); }}>Cancel review</button>
            </>
          ) : (
            <button type="button" disabled={processing} onClick={() => { setReviewing(proposal); setError(''); }}>Review proposal</button>
          )}
        </article>
      ))}
      <EventPagination list={list} />
    </>
  );
}
