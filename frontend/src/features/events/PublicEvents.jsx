import { useEffect, useState } from 'react';
import EventCard from './EventCard.jsx';
import EventFilters from './EventFilters.jsx';
import { requestPublicEvents } from './publicEventApi.js';
import './eventDiscovery.css';

function EventPagination({ pagination, search }) {
  const { page, limit, total } = pagination;
  const lastPage = Math.ceil(total / limit);
  if (lastPage <= 1 && page === 1) return null;
  function pageUrl(nextPage) {
    const query = new URLSearchParams(search);
    query.set('page', nextPage);
    return '/events?' + query;
  }
  return (
    <nav className="discovery-actions" aria-label="Event pages">
      {page > 1 && <a href={pageUrl(Math.max(1, Math.min(page - 1, lastPage)))}>Previous</a>}
      <span>{page > lastPage ? 'Page ' + page : 'Page ' + page + ' of ' + lastPage}</span>
      {page < lastPage && <a href={pageUrl(page + 1)}>Next</a>}
    </nav>
  );
}

export default function PublicEvents({ eventId }) {
  const search = window.location.search;
  const path = eventId ? '/' + eventId : search;
  const [result, setResult] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    requestPublicEvents(path, controller.signal)
      .then((payload) => { if (!controller.signal.aborted) setResult(payload); })
      .catch((error) => { if (!controller.signal.aborted) setResult({ error }); });
    return () => controller.abort();
  }, [path, attempt]);

  function retry() {
    setResult({ loading: true });
    setAttempt((previous) => previous + 1);
  }

  const unavailable = eventId && [400, 404].includes(result.error?.status);
  return (
    <main className="container discovery">
      {eventId ? <a href={'/events' + search}>Back to events</a> : (
        <>
          <section className="hero">
            <h1>Campus events</h1>
            <p>Find published events from campus clubs. Dates and times are shown in Bangladesh time.</p>
          </section>
          <EventFilters query={new URLSearchParams(search)} />
        </>
      )}
      {result.loading && <p role="status">Loading {eventId ? 'event' : 'events'}…</p>}
      {unavailable && <section><h1>Event unavailable</h1><p>This event could not be found.</p></section>}
      {result.error && !unavailable && (
        <div role="alert" className="discovery-error">
          <p>{result.error.message}</p>
          {result.error.status !== 400 && <button type="button" onClick={retry}>Retry</button>}
        </div>
      )}
      {result.data && (eventId ? <EventCard event={result.data} /> : (
        <>
          <p role="status">{result.pagination.total} {result.pagination.total === 1 ? 'event' : 'events'} found</p>
          {result.data.length ? (
            <div className="grid">
              {result.data.map((event) => <EventCard key={event.id} event={event} href={'/events/' + event.id + search} />)}
            </div>
          ) : <p>{result.pagination.total ? 'There are no events on this page.' : 'No events match these filters.'}</p>}
          <EventPagination pagination={result.pagination} search={search} />
        </>
      ))}
    </main>
  );
}
