import { useCallback, useEffect, useState } from 'react';
import EventApprovalQueuePage from './EventApprovalQueuePage.jsx';
import EventProposalsPage from './EventProposalsPage.jsx';
import { eventRequest } from './eventApi.js';
import './events.css';

function readEventView() {
  if (window.location.hash === '#/proposals') return 'officer';
  if (window.location.hash === '#/approval-queue') return 'admin';
  return null;
}

export function useEventView() {
  const [view, setView] = useState(readEventView);
  useEffect(() => {
    const update = () => setView(readEventView());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return view;
}

export default function EventWorkspace({ view, session }) {
  const requiredRole = view === 'admin' ? 'campus_admin' : 'club_officer';
  const title = view === 'admin' ? 'Admin approval queue' : 'My proposals';
  const request = useCallback((path, options) => eventRequest(session.authenticatedFetch, path, options), [session]);
  return (
    <main className="container event-workspace">
      <nav className="event-navigation" aria-label="Event proposal navigation">
        <a href="#top">Overview</a>
        <a href="#/proposals" aria-current={view === 'officer' ? 'page' : undefined}>My proposals</a>
        <a href="#/approval-queue" aria-current={view === 'admin' ? 'page' : undefined}>Admin queue</a>
      </nav>
      {!session ? (
        <section className="event-panel event-integration" role="status">
          <h1>{title}</h1>
          <p>Event proposals require verified CampusConnect sign-in. Access will be available when F01 authentication is integrated.</p>
        </section>
      ) : session.user?.role !== requiredRole ? (
        <section className="event-panel" role="status">
          <h1>{title}</h1>
          <p>{session.user ? 'Your account does not have access to this page.' : 'Sign in to access this page.'}</p>
        </section>
      ) : view === 'admin' ? (
        <EventApprovalQueuePage key={session.user.id} request={request} />
      ) : (
        <EventProposalsPage key={session.user.id} request={request} />
      )}
    </main>
  );
}
