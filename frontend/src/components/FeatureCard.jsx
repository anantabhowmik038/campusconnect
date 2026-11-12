/** Reusable placeholder card. Replace planned modules only after implementing them. */
export default function FeatureCard({ id, name }) {
  return (
    <article className="feature-card">
      <div className="feature-meta"><span>{id}</span><span className="pill">Planned</span></div>
      <h4>{name}</h4>
      <p>Ready for implementation by the assigned team member.</p>
    </article>
  );
}
