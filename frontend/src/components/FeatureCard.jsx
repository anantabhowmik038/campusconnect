export default function FeatureCard({ id, name, implemented, description }) {
  return (
    <article className="feature-card">
      <div className="feature-meta">
        <span>{id}</span>
        <span className={implemented ? 'pill pill-implemented' : 'pill'}>
          {implemented ? 'Implemented' : 'Future Scope'}
        </span>
      </div>
      <h4>{name}</h4>
      <p>{description}</p>
    </article>
  );
}
