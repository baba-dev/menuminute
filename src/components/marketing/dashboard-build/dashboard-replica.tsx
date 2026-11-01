import { useCallback, useContext, useMemo, type AnchorHTMLAttributes } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Bell,
  BellRing,
  Check,
  Ellipsis,
  ExternalLink,
  FilePenLine,
  Info,
  Plus,
  RefreshCw,
  Search,
  Sun,
  UtensilsCrossed,
  Wallet,
  Wifi,
} from "lucide-react";
import { WorkspaceIcon } from "@/app/(dashboard)/workspace-icons";
import { bottomBarItems, groupNavigation } from "@/modules/dashboard/nav-model";
import {
  REPLICA_BELL_COUNT,
  REPLICA_CAPABILITIES,
  REPLICA_DISH_COUNT,
  REPLICA_DISPATCH,
  REPLICA_HEALTH_ROWS,
  REPLICA_KPIS,
  REPLICA_OUTLET_NAME,
  REPLICA_PRIORITIES,
  REPLICA_REQUESTS,
  REPLICA_SERVICE_PERIOD,
  REPLICA_SETUP,
  REPLICA_TILL_LABEL,
  REPLICA_LOCALE,
  buildReplicaFloor,
  buildReplicaPulse,
  formatReplicaMinor,
  REPLICA_NEW_ORDER_TABLE,
} from "./dashboard-build-fixture";
import { NewOrderContext } from "./dashboard-build-beats";
import { FloorGlanceView } from "@/components/dashboard/floor/floor-glance-view";
import { TodayPulsePanel } from "@/components/dashboard/pulse/today-pulse";
import { buildFloorGlance } from "@/modules/hospitality/floor-glance";
import type { DashboardWidgetId } from "@/modules/dashboard/layout";
import { countFormats, pieceById, pieceStyle, staggerStyle } from "./dashboard-build-timeline";

/**
 * Presentational replicas of the real workspace sidebar, top bar, hero, KPI row, priorities and outlet health. They reuse the real
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
            {item.id === "orders" && (
              <span
                className="mm-bottom-badge"
                data-beat="bell"
                data-beat-from={REPLICA_DISPATCH.counters[0].value}
                data-beat-to={REPLICA_DISPATCH.counters[0].value + 1}
              >
                {REPLICA_DISPATCH.counters[0].value + 1}
              </span>
            )}
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
        <span className="mm-topbar-bell" data-beat="bell">
          <Bell size={18} aria-hidden="true" />
          <span
            className="mm-topbar-bell-badge"
            data-beat="bell"
            data-beat-from={REPLICA_BELL_COUNT}
            data-beat-to={REPLICA_BELL_COUNT + 1}
          >
            {REPLICA_BELL_COUNT + 1}
          </span>
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

const ARTWORK = "/brand/dashboard/editorial/";

/** The real editorial hero: full-bleed artwork behind the real copy (copy is the product's). */
export function ReplicaHero() {
  const piece = pieceById("hero");
  const copy = ["eyebrow", "title", "intro", "actions"];
  const stagger = (name: string) => {
    const index = copy.indexOf(name);
    return {
      "data-stagger": index,
      "data-stagger-count": copy.length,
      style: staggerStyle(0, piece, index, copy.length),
    };
  };
  return (
    <header className="mm-dashboard-hero" data-piece="hero" style={pieceStyle(0, piece)}>
      <div className="mm-dashboard-hero-copy">
        <span className="mm-dashboard-eyebrow" {...stagger("eyebrow")}>
          {REPLICA_SERVICE_PERIOD.period} · {REPLICA_SERVICE_PERIOD.greeting}
        </span>
        <h1 {...stagger("title")}>
          Make something
          <br />
          delicious today.
        </h1>
        <p {...stagger("intro")}>
          Welcome back to <strong>{REPLICA_OUTLET_NAME}</strong>.<br />
          <span className="opacity-90">{REPLICA_SERVICE_PERIOD.subtext}</span>
        </p>
        <span className="mm-dashboard-demo">Demo outlet</span>
        <div className="mm-dashboard-hero-actions" {...stagger("actions")}>
          <span className="mm-dashboard-button mm-dashboard-button--primary">
            Open Menu Studio <ArrowRight size={17} aria-hidden="true" />
          </span>
          <span className="mm-dashboard-button mm-dashboard-button--secondary">
            <UtensilsCrossed size={17} aria-hidden="true" /> Dish Availability
          </span>
        </div>
      </div>
    </header>
  );
}

/** Status is carried by an icon and a word as well as colour (mirrors the real HealthBadge). */
function ReplicaHealthBadge({ label }: { label: string }) {
  return (
    <span className="mm-dashboard-health-badge is-good">
      <Check size={13} aria-hidden="true" />
      <span className="mm-badge-text">{label}</span>
    </span>
  );
}

/** "At a glance": the real heading and six KPI cells, each its own scroll-assembled piece. */
function ReplicaGlance() {
  const heading = pieceById("glance");
  return (
    <section className="mm-dashboard-glance">
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
              {typeof value === "number" ? <span data-count-to={value}>{value}</span> : value}
            </strong>
            <span className="mm-dashboard-kpi-detail">{detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReplicaPriorities() {
  return (
    <section
      className="mm-dashboard-priorities"
      data-piece="priorities"
      style={pieceStyle(0, pieceById("priorities"))}
    >
      <div className="mm-dashboard-priorities-head">
        <div>
          <span className="mm-dashboard-eyebrow">Your next move</span>
          <h2>Today’s priorities</h2>
          <p>A few quick actions to keep {REPLICA_OUTLET_NAME} fresh, accurate and guest-ready.</p>
          <p className="mm-dashboard-chef-note">
            Chef’s note · {REPLICA_DISH_COUNT} published dishes. Check availability before service.
          </p>
        </div>
        <Image
          src={ARTWORK + "priorities-illustration.webp"}
          alt=""
          width={156}
          height={112}
          className="mm-dashboard-priorities-art"
        />
      </div>
      <ol className="mm-dashboard-priority-list">
        {REPLICA_PRIORITIES.map((item, index) => (
          <li className="mm-dashboard-priority" key={item.title}>
            <span className="mm-dashboard-priority-number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="mm-dashboard-priority-copy">
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
            <span className="mm-dashboard-priority-action">
              {item.action} <ArrowRight size={16} aria-hidden="true" />
            </span>
          </li>
        ))}
      </ol>
      <div className="mm-dashboard-publish">
        <span className="mm-dashboard-publish-icon">
          <FilePenLine size={22} aria-hidden="true" />
        </span>
        <span>
          <strong>Keep your menu fresh</strong>
          <small>Your current release is live. Edit whenever you need.</small>
        </span>
        <ArrowRight className="mm-dashboard-publish-arrow" size={22} aria-hidden="true" />
      </div>
    </section>
  );
}

function ReplicaHealth() {
  const setup = REPLICA_SETUP;
  return (
    <section
      className="mm-dashboard-health"
      data-piece="health"
      style={pieceStyle(0, pieceById("health"))}
    >
      <div className="mm-dashboard-health-head">
        <div>
          <span className="mm-dashboard-eyebrow">{REPLICA_OUTLET_NAME}</span>
          <h2>Outlet health &amp; publishing status</h2>
          <p>Your current menu is available to guests.</p>
        </div>
        <Image
          src={ARTWORK + "outlet-health-illustration.webp"}
          alt=""
          width={86}
          height={103}
          className="mm-dashboard-health-art"
        />
      </div>
      <dl className="mm-dashboard-health-rows">
        {REPLICA_HEALTH_ROWS.map(({ Icon, title, detail, badge }) => (
          <div className="mm-dashboard-health-row" key={title}>
            <Icon size={20} aria-hidden="true" />
            <div>
              <dt>{title}</dt>
              <dd>{detail}</dd>
            </div>
            <ReplicaHealthBadge label={badge} />
          </div>
        ))}
        <div className="mm-dashboard-health-row mm-dashboard-health-row--progress">
          <setup.Icon size={20} aria-hidden="true" />
          <div>
            <dt>
              Menu launch setup{" "}
              <span className="mm-dashboard-info">
                <Info size={15} aria-hidden="true" />
              </span>
            </dt>
            <dd>
              <span data-count-to={setup.completed}>{setup.completed}</span> of {setup.total}{" "}
              essentials completed
            </dd>
            <progress
              max={setup.total}
              value={setup.completed}
              data-progress-to={setup.completed}
            />
          </div>
          <strong>
            <span data-count-to={setup.percent}>{setup.percent}</span>%
          </strong>
        </div>
      </dl>
      <div className="mm-dashboard-setup-foot">
        <span>
          <Check size={15} aria-hidden="true" /> {setup.completed} verified steps
        </span>
        <span>
          Outlet settings <ArrowRight size={15} aria-hidden="true" />
        </span>
      </div>
    </section>
  );
}

/** The real "Service Dispatch" panel with sample counters. The four tiles stagger in and count up. */
function ReplicaDispatch() {
  const piece = pieceById("dispatch");
  const { counters, snapshot } = REPLICA_DISPATCH;
  return (
    <section className="mm-dashboard-operations">
      <div className="mm-dashboard-operations-heading">
        <div className="mm-dashboard-service-heading">
          <div>
            <span className="mm-dashboard-eyebrow">SERVICE ACTIVITY</span>
            <h2>The Service Dispatch</h2>
            <p>What needs attention now · From your live order ledger.</p>
          </div>
          <div className="mm-dashboard-service-art-wrap">
            <Image
              className="mm-dashboard-service-art mm-dashboard-service-art--light"
              src={ARTWORK + "service-dispatch-light.svg"}
              alt=""
              width={130}
              height={91}
            />
            <Image
              className="mm-dashboard-service-art mm-dashboard-service-art--dark"
              src={ARTWORK + "service-dispatch-dark.svg"}
              alt=""
              width={130}
              height={91}
            />
          </div>
        </div>
      </div>
      <p className="mm-dashboard-operations-freshness">
        {snapshot} · Refreshes every 30 seconds while this tab is active
      </p>
      <div className="mm-dashboard-operations-grid">
        {counters.map(({ label, value }, index) => (
          <a
            key={label}
            data-stagger={index}
            data-stagger-count={counters.length}
            data-beat={index === 0 ? "dispatch" : undefined}
            style={staggerStyle(0, piece, index, counters.length)}
          >
            <strong data-count-to={value} data-beat-add={index === 0 ? "dispatch" : undefined}>
              {index === 0 ? value + 1 : value}
            </strong>
            <span>{label}</span>
          </a>
        ))}
      </div>
      <div className="mm-dashboard-service-footer">
        <a>View all orders &rarr;</a>
        <button type="button" className="mm-dashboard-operations-refresh">
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>
    </section>
  );
}

/** A link that looks like one but goes nowhere: the preview stage is a picture. */
function PreviewLink({
  href: _href,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...rest} />;
}

/**
 * The product's own miniature dining floor (`FloorGlanceView`), fed with the demo outlet's tables.
 * While the new-order beat is on, the new order's table is highlighted and its order count goes up.
 */
function ReplicaFloor() {
  const newOrder = useContext(NewOrderContext);
  const { overview, glance } = useMemo(() => {
    const floor = buildReplicaFloor(newOrder);
    return {
      overview: floor.overview,
      glance: buildFloorGlance(floor.overview, new Map(Object.entries(floor.dueByTable))),
    };
  }, [newOrder]);
  return (
    <FloorGlanceView
      overview={overview}
      glance={glance}
      filter="all"
      refreshing={false}
      fmt={formatReplicaMinor}
      formatTime={() => ""}
      focusTableId={newOrder ? REPLICA_NEW_ORDER_TABLE : undefined}
      LinkComponent={PreviewLink}
    />
  );
}

/** Scroll-driven stand-in for the live ticker: the timeline sets the text; the final value renders first. */
function ScrollFigure({ value, format }: { value: number; format?: (n: number) => string }) {
  const fmt = format ?? String;
  const register = useCallback(
    (element: HTMLElement | null) => {
      if (element) countFormats.set(element, fmt);
    },
    [fmt]
  );
  return (
    <span ref={register} data-count-to={value}>
      {fmt(value)}
    </span>
  );
}

/** The product's own Today's pulse bento, fed with sample figures and scroll-driven numbers. */
function ReplicaToday() {
  const newOrder = useContext(NewOrderContext);
  const pulse = useMemo(() => buildReplicaPulse(newOrder), [newOrder]);
  return <TodayPulsePanel pulse={pulse} Figure={ScrollFigure} locale={REPLICA_LOCALE} />;
}

/** The real "At your service" panel with two sample guest requests. */
function ReplicaRequests() {
  const piece = pieceById("requests");
  return (
    <section className="mm-dashboard-ops-panel">
      <div className="mm-ops-head">
        <div>
          <span className="mm-dashboard-eyebrow">GUEST SERVICE</span>
          <h2>At your service</h2>
          <p>
            Staff calls, water refills and bill requests · Checked approximately every 12 seconds.
          </p>
        </div>
        <BellRing size={34} aria-hidden="true" className="mm-ops-bell" />
      </div>
      <div className="mm-ops-actions">
        <button type="button">
          <RefreshCw size={15} aria-hidden="true" /> Refresh requests
        </button>
        <a>
          Open Orders <ArrowRight size={14} aria-hidden="true" />
        </a>
      </div>
      <ul className="mm-ops-items">
        {REPLICA_REQUESTS.map((item, index) => (
          <li
            key={item.id}
            className="mm-ops-item"
            data-stagger={index}
            data-stagger-count={REPLICA_REQUESTS.length}
            style={staggerStyle(0, piece, index, REPLICA_REQUESTS.length)}
          >
            <strong>{item.title}</strong>
            <p>{item.signal}</p>
            <span>
              {item.status} · {item.time}
            </span>
            <button type="button">
              {item.status === "requested" ? "Acknowledge" : "Mark resolved"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The widgets the replica renders, in the product's order. A test compares this with
 * `dashboardWidgetIds`, so a widget added to (or reordered in) the product fails CI until the
 * replica follows.
 */
export const REPLICA_WIDGETS: readonly DashboardWidgetId[] = [
  "kpis",
  "priorities",
  "dispatch",
  "health",
  "floor",
  "serviceRequests",
  "pulse",
];

/** A product widget wrapper. Panels that fill their grid cell carry the scroll piece on the wrapper. */
function Widget({
  id,
  piece,
  autoStagger,
  children,
}: {
  id: DashboardWidgetId;
  piece?: "dispatch" | "floor" | "requests" | "today";
  autoStagger?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mm-widget"
      data-widget={id}
      data-piece={piece}
      data-stagger-auto={autoStagger}
      style={piece ? pieceStyle(0, pieceById(piece)) : undefined}
    >
      {children}
    </div>
  );
}

/**
 * The dashboard body in the product's widget order, laid out by the real `mm-widget-grid`
 * (including the rule that makes the floor span two rows beside the stacked requests and pulse).
 */
export function ReplicaBody() {
  return (
    <div className="mm-dashboard-body">
      <div className="mm-widget-grid">
        <Widget id="kpis">
          <ReplicaGlance />
        </Widget>
        <Widget id="priorities">
          <ReplicaPriorities />
        </Widget>
        <Widget id="dispatch" piece="dispatch">
          <ReplicaDispatch />
        </Widget>
        <Widget id="health">
          <ReplicaHealth />
        </Widget>
        <Widget id="floor" piece="floor" autoStagger="li">
          <ReplicaFloor />
        </Widget>
        <Widget id="serviceRequests" piece="requests">
          <ReplicaRequests />
        </Widget>
        <Widget id="pulse" piece="today">
          <ReplicaToday />
        </Widget>
      </div>
    </div>
  );
}
