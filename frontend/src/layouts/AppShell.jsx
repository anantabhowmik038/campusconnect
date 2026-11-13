export default function AppShell({ children }) {
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Project navigation">
        <a className="brand" href="#top"><span className="brand-icon">C</span><span>Campus<strong>Connect</strong></span></a>
        <p className="nav-label">DEVELOPMENT WORKSPACE</p>
        <nav>
          <a className="nav-active" href="#top">Overview</a>
          <a href="#modules">Feature modules</a>
          <a href="#setup">Developer setup</a>
        </nav>
        <p className="sidebar-bottom">CSE451 · Four-member team</p>
      </aside>
      <div className="main-column">
        <header className="header"><b>CampusConnect</b><span>Development preview</span></header>
        {children}
      </div>
    </div>
  );
}
