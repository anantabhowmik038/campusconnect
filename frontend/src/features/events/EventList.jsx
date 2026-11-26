import { useCallback, useEffect, useState } from 'react';

export function useEventList(request, path) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ loading: true });
  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  useEffect(() => {
    let current = true;
    setResult({ loading: true });
    request(path + '?page=' + page)
      .then((payload) => {
        if (!current) return;
        if (page > 1 && !payload.data.length) setPage(page - 1);
        else setResult(payload);
      })
      .catch((error) => {
        if (current) setResult({ error: error.message });
      });
    return () => { current = false; };
  }, [request, path, page, revision]);
  return { ...result, setPage, refresh };
}

export function EventListStatus({ list, empty }) {
  if (list.loading) return <p role="status">Loading proposals...</p>;
  if (list.error) return <p className="event-error" role="alert">{list.error} <button type="button" onClick={list.refresh}>Retry</button></p>;
  if (list.data?.length === 0) return <p role="status">{empty}</p>;
  return null;
}

export function EventPagination({ list }) {
  const { page, limit, total } = list.pagination ?? {};
  if (!(total > limit)) return null;
  return (
    <nav className="event-actions" aria-label="Proposal pages">
      <button type="button" className="event-secondary" disabled={page === 1} onClick={() => list.setPage(page - 1)}>Previous</button>
      <span>Page {page} of {Math.ceil(total / limit)}</span>
      <button type="button" className="event-secondary" disabled={page * limit >= total} onClick={() => list.setPage(page + 1)}>Next</button>
    </nav>
  );
}

export function ProposalSummary({ proposal }) {
  return (
    <>
      <div className="event-card-heading">
        <h2>{proposal.title}</h2>
        <span className={'event-status event-status-' + proposal.status}>{proposal.status}</span>
      </div>
      <p className="muted">{proposal.club_name} &middot; {new Date(proposal.start_time).toLocaleString()} &ndash; {new Date(proposal.end_time).toLocaleString()}</p>
      <p className="muted">Capacity {proposal.capacity}{proposal.category && ' | ' + proposal.category}</p>
      <p className="event-description">{proposal.description}</p>
      {proposal.review_note && <p className="event-feedback"><strong>Review feedback</strong> {proposal.review_note}</p>}
    </>
  );
}
