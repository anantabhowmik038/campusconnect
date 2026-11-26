
import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';

import AppShell from './layouts/AppShell.jsx';
import FeatureCard from './components/FeatureCard.jsx';
import F10Workspace from './features/communication/F10Workspace.jsx';
import F11Workspace from './features/feedback/F11Workspace.jsx';
import VenueBooking from './features/VenueBooking.jsx';
import QRAttendance from './features/QRAttendance.jsx';
import { modules } from './data/modules.js';

import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ClubsPage from './pages/ClubsPage.jsx';

import PublicEvents from './features/events/PublicEvents.jsx';
import EventWorkspace, {
  useEventView,
} from './features/events/EventWorkspace.jsx';

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';

function readSession() {
  const token = localStorage.getItem('token');

  if (!token) return null;

  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    if (!user?.id || !user?.role) return null;

    return {
      user,
      authenticatedFetch: (url, options = {}) =>
        fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
          },
        }),
    };
  } catch {
    return null;
  }
}

function EventWorkspaceRoute({ view }) {
  const [session, setSession] = useState(readSession);

  useEffect(() => {
    const refreshSession = () => setSession(readSession());

    window.addEventListener('storage', refreshSession);
    window.addEventListener('focus', refreshSession);

    return () => {
      window.removeEventListener('storage', refreshSession);
      window.removeEventListener('focus', refreshSession);
    };
  }, []);

  return (
    <AppShell eventView={view}>
      <EventWorkspace view={view} session={session} />
    </AppShell>
  );
}

function VenueBookingRoute() {
  const [session] = useState(readSession);
  return <VenueBooking session={session} apiBase={apiBase} />;
}

function AttendanceRoute() {
  const [session] = useState(readSession);
  return <QRAttendance session={session} apiBase={apiBase} />;
}

function HomePage() {
  const [session] = useState(readSession);
  const [api, setApi] = useState({
    type: 'loading',
    message: 'Checking API...',
  });

  const checkApi = useCallback(async () => {
    setApi({
      type: 'loading',
      message: 'Checking API...',
    });

    try {
      const response = await fetch(`${apiBase}/health`, {
        cache: 'no-store',
      });

      if (!response.ok) throw new Error('API unavailable');

      const result = await response.json();

      setApi({
        type: 'success',
        message: result.application
          ? `${result.application} is running`
          : 'API is running',
      });
    } catch {
      setApi({
        type: 'error',
        message: 'API unavailable. Ensure backend is running on port 5000.',
      });
    }
  }, []);

  useEffect(() => {
    void checkApi();
  }, [checkApi]);

  return (
    <main id="top" className="container">
      <section className="hero">
        <span className="eyebrow">
          THE SHARED STARTING POINT
        </span>

        <h1>One campus. Every connection.</h1>

        <p>
          CampusConnect brings campus events, student clubs,
          registration and event operations into one unified platform.
        </p>

        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            gap: '15px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
          <Link to="/clubs">Browse Clubs</Link>
          <Link to="/events">Browse Events</Link>
          <Link to="/venues">Venue booking</Link>
          <Link to="/attendance">QR attendance</Link>
          <a href="/#communication">Announcements</a>
          <a href="/#feedback">Feedback</a>
        </div>

        <span className="hero-note">
          CampusConnect development workspace
        </span>
      </section>

      <section className="stats" aria-label="Project overview">
        <div className="stat">
          <span>Functional modules planned</span>
          <strong>12</strong>
          <small>Distributed across the team</small>
        </div>

        <div className="stat">
          <span>Team members</span>
          <strong>04</strong>
          <small>Shared code and design</small>
        </div>
      </section>

      <section className="api-panel" aria-live="polite">
        <div>
          <span className="eyebrow">ENVIRONMENT CHECK</span>
          <h2>Backend connectivity</h2>
          <p className={`api-status ${api.type}`}>
            {api.message}
          </p>
        </div>

        <button type="button" onClick={() => void checkApi()}>
          Check API
        </button>
      </section>

      <section id="modules" className="modules">
        <span className="eyebrow">PROJECT OWNERSHIP</span>
        <h2>Our 12 feature modules</h2>

        <nav className="event-entry" aria-label="Event proposals">
          <a href="/#/proposals">My proposals</a>
          <a href="/#/approval-queue">Admin approval queue</a>
        </nav>

        {modules.map((group) => (
          <section className="group" key={group.owner}>
            <div className="group-head">
              <h3>{group.area}</h3>
              <span>Owner: {group.owner}</span>
            </div>

            <div className="grid">
              {group.features.map(([id, name]) => (
                <FeatureCard key={id} id={id} name={name} />
              ))}
            </div>
          </section>
        ))}
      </section>

      <F10Workspace />
      <F11Workspace session={session} />

      <section id="setup" className="setup">
        <span className="eyebrow">DEVELOPER SETUP</span>
        <h2>Developer handoff</h2>

        <p>
          Read <code>docs/SETUP.md</code> for local development
          instructions.
        </p>

        <a
          href="https://github.com/anantabhowmik038/campusconnect"
          target="_blank"
          rel="noreferrer"
        >
          View our GitHub repository
        </a>
      </section>

      <footer>
        CampusConnect · CSE451 · Software Engineering
      </footer>
    </main>
  );
}

function AppContent() {
  const location = useLocation();
  const eventView = useEventView();

  if (location.pathname === '/' && eventView) {
    return <EventWorkspaceRoute view={eventView} />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/clubs" element={<ClubsPage />} />
        <Route path="/venues" element={<VenueBookingRoute />} />
        <Route path="/attendance" element={<AttendanceRoute />} />

        <Route
          path="/events"
          element={<PublicEvents />}
        />

        <Route
          path="/events/:eventId"
          element={
            <PublicEvents
              eventId={location.pathname.split('/')[2]}
            />
          }
        />

        <Route path="*" element={<HomePage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return <AppContent />;
}
