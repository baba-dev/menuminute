import { Bell, Ellipsis, ExternalLink, Info, Plus, Search, Sun, Wallet, Wifi } from "lucide-react";
import { WorkspaceIcon } from "@/app/(dashboard)/workspace-icons";
import { bottomBarItems, groupNavigation } from "@/modules/dashboard/nav-model";
import {
  REPLICA_BELL_COUNT,
  REPLICA_CAPABILITIES,
  REPLICA_KPIS,
  REPLICA_TILL_LABEL,
} from "./dashboard-build-fixture";
import { pieceById, pieceStyle, staggerStyle } from "./dashboard-build-timeline";

/**
 * Presentational replicas of the real workspace sidebar, top bar and KPI row. They reuse the real
 * class names (workspace.css, workspace-delight.css), the real nav model and the real icons, so the
 * markup tracks the product. Static and inert: no links, no state, no data fetching, no actions.
 * Each element server-renders its exploded (p = 0) pose; the client timeline moves it from there.
 */

const sidebarPiece = pieceById("sidebar");

export function ReplicaSidebar() {
  const grouped = groupNavigation(REPLICA_CAPABILITIES);
  const links = [grouped.overview, ...grouped.groups.flatMap((group) => group.items)];
  const count = links.length;
  const indexOf = (id: string) => links.findIndex((item) => item.id === id);

  const row = (item: (typeof links)[number]) => (
    <span
      key={item.id}
      className={"mm-workspace-nav-link" + (item.id === "overview" ? " is-active" : "")}
      data-stagger={indexOf(item.id)}
      data-stagger-count={count}
      style={staggerStyle(0, sidebarPiece, indexOf(item.id), count)}
    >
      <WorkspaceIcon name={item.icon} strokeWidth={1.9} />
      <span>{item.nav.label}</span>
    </span>
  );

  return (
    <div
      className="db-replica-sidebar mm-workspace-sidebar"
      data-piece="sidebar"
      style={pieceStyle(0, sidebarPiece)}
    >
      <div className="mm-workspace-brand">
        <span className="mm-workspace-brand-link">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVGs, as in the real sidebar */}
          <img
            src="/brand/logos/logo-horizontal-light.svg"
            alt=""
            width={175}
            height={43}
            className="mm-workspace-brand-light"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logos/logo-horizontal-dark.svg"
            alt=""
            width={175}
            height={43}
            className="mm-workspace-brand-dark"
          />
        </span>
      </div>
      <div className="mm-workspace-nav">
        <div className="mm-workspace-nav-items">{row(grouped.overview)}</div>
        {grouped.groups.map((group) => (
          <div className="mm-workspace-nav-group" key={group.id}>
            <span className="mm-workspace-nav-label">{group.label}</span>
            <div className="mm-workspace-nav-items">{group.items.map(row)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Phone navigation: the real bottom bar replaces the sidebar, as in the product. */
export function ReplicaBottomBar() {
  const items = bottomBarItems(REPLICA_CAPABILITIES);
  return (
    <div
      className="db-replica-bottombar mm-bottom-bar"
      data-piece="sidebar"
      style={pieceStyle(0, sidebarPiece)}
    >
      {items.map((item) => (
        <span key={item.id} className="mm-bottom-link">
          <span className="mm-bottom-icon">
            <WorkspaceIcon name={item.icon} size={21} />
          </span>
          <span className="mm-bottom-label">{item.shortLabel}</span>
        </span>
      ))}
      <span className="mm-bottom-link">
        <span className="mm-bottom-icon">
          <Ellipsis size={21} aria-hidden="true" />
        </span>
        <span className="mm-bottom-label">More</span>
      </span>
    </div>
  );
}

export function ReplicaTopbar() {
  return (
    <div
      className="db-replica-topbar mm-dashboard-topbar mm-shared-topbar"
      data-piece="topbar"
      style={pieceStyle(0, pieceById("topbar"))}
    >
      <div className="mm-dashboard-breadcrumb">
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <span>Restaurant overview</span>
      </div>
      <div className="mm-dashboard-top-actions">
        <span className="mm-topbar-search">
          <Search size={16} aria-hidden="true" />
          <span className="mm-topbar-search-label">Search or run a command</span>
          <kbd className="mm-topbar-kbd">Ctrl K</kbd>
        </span>
        <span className="mm-topbar-new">
          <Plus size={16} aria-hidden="true" />
          <span className="mm-topbar-new-label">New</span>
        </span>
        <span className="mm-topbar-chip" data-state="open">
          <Wallet size={15} aria-hidden="true" />
          <span>{REPLICA_TILL_LABEL}</span>
        </span>
        <span className="mm-topbar-connection" data-state="live">
          <span className="mm-connection-dot">
            <Wifi size={12} aria-hidden="true" />
          </span>
          <span className="mm-topbar-connection-label">Live</span>
        </span>
        <span className="mm-topbar-bell">
          <Bell size={18} aria-hidden="true" />
          <span className="mm-topbar-bell-badge">{REPLICA_BELL_COUNT}</span>
        </span>
        <span className="mm-dashboard-preview">
          Public menu <ExternalLink size={14} aria-hidden="true" />
        </span>
        <span className="mm-theme-toggle">
          <Sun size={18} aria-hidden="true" />
        </span>
        <span className="mm-dashboard-user">SR</span>
      </div>
    </div>
  );
}

/** "At a glance": the real heading and six KPI cells, each its own scroll-assembled piece. */
export function ReplicaGlance() {
  const heading = pieceById("glance");
  return (
    <section className="db-replica-glance mm-dashboard mm-dashboard-glance">
      <div
        className="mm-dashboard-section-heading"
        data-piece="glance"
        style={pieceStyle(0, heading)}
      >
        <span className="mm-dashboard-eyebrow">At a glance</span>
        <span className="mm-dashboard-data-note">Published menu data · Current outlet</span>
      </div>
      <div className="mm-dashboard-kpis">
        {REPLICA_KPIS.map(({ id, label, detail, Icon, value, positive }) => (
          <div
            className="mm-dashboard-kpi"
            key={id}
            data-piece={id}
            style={pieceStyle(0, pieceById(id))}
          >
            <div className="mm-dashboard-kpi-top">
              <span className="mm-dashboard-kpi-icon">
                <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span className="mm-dashboard-kpi-label">{label}</span>
              <span className="mm-dashboard-info">
                <Info size={15} aria-hidden="true" />
              </span>
            </div>
            <strong className={"mm-dashboard-kpi-value" + (positive ? " is-positive" : "")}>
              {typeof value === "number" ? <span data-count-to={value}>0</span> : value}
            </strong>
            <span className="mm-dashboard-kpi-detail">{detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
