export default function Loading() {
  return (
    <div className="bp" aria-busy="true" aria-label="Loading billing">
      <div className="bp-skeleton bp-skeleton--hero" />
      <div className="bp-skeleton-grid">
        <div className="bp-skeleton" />
        <div className="bp-skeleton" />
      </div>
    </div>
  );
}
