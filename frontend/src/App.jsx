import { useCallback, useEffect, useState } from 'react';
import AppShell from './layouts/AppShell.jsx';
import FeatureCard from './components/FeatureCard.jsx';
import { modules } from './data/modules.js';

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';

export default function App() {
  const [api, setApi] = useState({ type: 'loading', message: 'Checking API...' });

  const checkApi = useCallback(async () => {
    setApi({ type: 'loading', message: 'Checking API...' });
    try {
      const response = await fetch(`${apiBase}/health`, { cache: 'no-store' });
      if (!response.ok) throw new Error('API unavailable');
      const result = await response.json();
      setApi({ type: 'success', message: `${result.application} is running` });
    } catch {
      setApi({ type: 'error', message: 'API unavailable. Start the backend on port 5000.' });
    }
  }, []);

  useEffect(() => { void checkApi(); }, [checkApi]);

  return (
    <AppShell>
      <main id="top" className="container">
        <section className="hero">
          <span className="eyebrow">THE SHARED STARTING POINT</span>
          <h1>One campus. Every connection.</h1>
          <p>CampusConnect brings campus events, student clubs, registration and event operations into one unified platform.</p>
          <span className="hero-note">Team foundation · Not a finished product</span>
        </section>

        <section className="stats" aria-label="Project overview">
          <div className="stat"><span>Functional modules planned</span><strong>12</strong><small>Distributed across the team</small></div>
          <div className="stat"><span>Team members</span><strong>04</strong><small>Shared code and design</small></div>
          <div className="stat"><span>Current stage</span><strong className="stage">Foundation</strong><small>Feature coding starts after review</small></div>
        </section>

        <section className="api-panel" aria-live="polite">
          <div><span className="eyebrow">ENVIRONMENT CHECK</span><h2>Backend connectivity</h2><p className={`api-status ${api.type}`}>{api.message}</p></div>
          <button type="button" onClick={() => void checkApi()}>Check API</button>
        </section>

        <section id="modules" className="modules">
          <span className="eyebrow">PROJECT OWNERSHIP</span>
          <h2>Our 12 feature modules</h2>
          <p className="muted">All features below are placeholders until implemented, reviewed and tested.</p>
          {modules.map((group) => (
            <section className="group" key={group.owner}>
              <div className="group-head"><h3>{group.area}</h3><span>Owner: {group.owner}</span></div>
              <div className="grid">
                {group.features.map(([id, name]) => <FeatureCard key={id} id={id} name={name} />)}
              </div>
            </section>
          ))}
        </section>

        <section id="setup" className="setup">
          <span className="eyebrow">NEXT STEPS</span><h2>Developer handoff</h2>
          <p>Read <code>docs/SETUP.md</code> to run this project locally. The team must approve database tables, API contracts, coding conventions and UI standards before dependent feature work.</p>
          <a href="https://github.com/anantabhowmik038/campusconnect" target="_blank" rel="noreferrer">View our GitHub repository</a>
        </section>
        <footer>CampusConnect · CSE451 · Software Engineering</footer>
      </main>
    </AppShell>
  );
}
