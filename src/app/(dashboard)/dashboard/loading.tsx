export default function DashboardLoading() {
  return (
    <div className="mm-dashboard product" role="status" aria-label="Loading restaurant overview">
      <span className="sr-only">Loading your restaurant overview…</span>
      <div className="mm-dashboard-loading-hero" aria-hidden="true">
        <div className="mm-dashboard-loading-line mm-dashboard-loading-line--heading" />
        <div className="mm-dashboard-loading-line" />
        <div className="mm-dashboard-loading-line mm-dashboard-loading-line--button" />
      </div>
      <div className="mm-dashboard-loading-body" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="mm-dashboard-loading-kpi" key={index} />
        ))}
      </div>
    </div>
  );
}
