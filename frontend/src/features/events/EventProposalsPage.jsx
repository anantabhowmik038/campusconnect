import { useState } from 'react';
import EventProposalForm from './EventProposalForm.jsx';
import { EventListStatus, EventPagination, ProposalSummary, useEventList } from './EventList.jsx';

export default function EventProposalsPage({ request }) {
  const list = useEventList(request, '/proposals');
  const [editor, setEditor] = useState(null);
  const [submitting, setSubmitting] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save(body) {
    const id = editor.proposal?.id;
    await request(id ? '/' + id : '', { method: id ? 'PATCH' : 'POST', body });
    setEditor(null);
    setMessage(id ? 'Proposal updated.' : 'Draft saved.');
    list.refresh();
  }

  async function submit(proposal) {
    setSubmitting(proposal.id);
    setError('');
    setMessage('');
    try {
      await request('/' + proposal.id + '/submit', { method: 'POST' });
      setMessage('Proposal submitted for review.');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSubmitting(null);
      list.refresh();
    }
  }

  return (
    <>
      <div className="event-page-heading">
        <h1>My proposals</h1>
        {!editor && <button type="button" disabled={submitting !== null} onClick={() => setEditor({})}>Create proposal</button>}
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p className="event-error" role="alert">{error}</p>}
      {editor ? (
        <EventProposalForm proposal={editor.proposal} onSave={save} onCancel={() => setEditor(null)} />
      ) : (
        <>
          <EventListStatus list={list} empty="Your assigned clubs have no proposals." />
          {list.data?.map((proposal) => (
            <article className="event-panel" key={proposal.id}>
              <ProposalSummary proposal={proposal} />
              {proposal.club_status === 'inactive' && <p className="muted">This club is inactive.</p>}
              {['draft', 'rejected'].includes(proposal.status) && (
                <div className="event-actions">
                  <button type="button" className="event-secondary" disabled={submitting !== null} onClick={() => setEditor({ proposal })}>Edit</button>
                  <button type="button" disabled={submitting !== null} onClick={() => void submit(proposal)}>
                    {submitting === proposal.id ? 'Submitting...' : proposal.status === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
                  </button>
                </div>
              )}
            </article>
          ))}
          <EventPagination list={list} />
        </>
      )}
    </>
  );
}
