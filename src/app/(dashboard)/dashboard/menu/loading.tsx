export default function MenuStudioLoading() {
  return (
    <div className="product studio-atelier" role="status" aria-label="Loading Menu Studio">
      <span className="sr-only">Loading your Menu Studio…</span>
      <div className="atelier-loading-hero" aria-hidden="true">
        <div /><div /><div />
      </div>
      <div className="atelier-loading-body" aria-hidden="true">
        <div /><div /><div /><div />
      </div>
    </div>
  );
}
