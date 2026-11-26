export default function AppShell({ children, eventView, eventsActive = false }) {
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Project navigation">
        <a className="brand" href="/#top"><span className="brand-icon">C</span><span>Campus<strong>Connect</strong></span></a>
        <p className="nav-label">DEVELOPMENT WORKSPACE</p>
        <nav>
          <a className={eventView || eventsActive ? undefined : 'nav-active'} href="/#top">Overview</a>
          <a className={eventView === 'officer' ? 'nav-active' : undefined} href="/#/proposals">My proposals</a>
          <a className={eventView === 'admin' ? 'nav-active' : undefined} href="/#/approval-queue">Admin approval queue</a>
          <a href="/#modules">Feature modules</a>
          <a href="/venues">Venue booking</a>
          <a href="/#communication">Announcements</a>
          <a href="/#feedback">Feedback</a>
          <a href="/#setup">Developer setup</a>
        </nav>
        <p className="sidebar-bottom">CSE451 · Four-member team</p>
      </aside>
      <div className="main-column">
        <header className="header"><b>CampusConnect</b><nav aria-label="Campus navigation"><a href="/events" aria-current={eventsActive ? 'page' : undefined}>Events</a></nav><span>Development preview</span></header>
        {children}
      </div>
    </div>
  );
}
