import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChefHat,
  FilePenLine,
  ExternalLink,
  Globe2,
  Layers3,
  Plus,
  QrCode,
  UtensilsCrossed,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { dashboardMenuRows, dashboardPublicProjection, dashboardQrRows } from "@/modules/menu-product/dashboard-data";
import {
  dashboardSetup,
  dashboardSummary,
  preferredMenuQr,
} from "@/modules/menu-product/dashboard-summary";
import { DashboardTooltip } from "./dashboard-tooltip";
import { dashboardPulseSnapshot } from "@/modules/menu-product/dashboard-optional-pulse";
import { DashboardServicePulse } from "./dashboard-service-pulse";

export const metadata: Metadata = {
  title: "Restaurant overview",
  description: "Your private, outlet-specific menu and publishing workspace.",
  robots: { index: false, follow: false },
};

const artwork = "/brand/dashboard/editorial/";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const actor = { userId: session.user.id };
  const outlet = await getDefaultOrActiveRestaurant(actor.userId, session.activeOutletId);

  if (!outlet) {
    return (
      <div className="mm-dashboard mm-dashboard-empty">
        <span className="mm-dashboard-eyebrow">Welcome to MenuMinute</span>
        <h1>Make something delicious today.</h1>
        <p>Create your first outlet to build and share its permanent QR menu.</p>
        <Link href="/onboarding" className="mm-dashboard-button mm-dashboard-button--primary">
          Set up an outlet <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  // Only canonical, outlet-scoped rows and the immutable guest-facing projection
  // contribute to these values. Unsaved editor state is deliberately excluded.
  const [menus, codes] = await Promise.all([
    dashboardMenuRows(actor.userId, outlet.id),
    dashboardQrRows(actor.userId, outlet.id),
  ]);
  const primaryQr = preferredMenuQr(codes);
  const publicProjection = primaryQr ? await dashboardPublicProjection(primaryQr.destinationToken) : null;
  const stats = dashboardSummary(menus, codes, publicProjection);
  const hasSavedMenu = menus.some((menu) => !menu.archived);
  const setup = dashboardSetup({
    hasOutlet: Boolean(outlet.name && outlet.currency && outlet.timezone),
    hasSavedMenu,
    hasPublicMenu: stats.hasPublicMenu,
    hasActiveQr: stats.activeQrCount > 0,
  });
  // Operational counters are optional. A failed order query must never hide the
  // independent menu, publishing and QR workspace for this authorized outlet.
  const operations = await dashboardPulseSnapshot(actor, outlet.organizationId, outlet.id);
  const publicHref =
    stats.hasPublicMenu && primaryQr
      ? "/m/" + encodeURIComponent(primaryQr.destinationToken)
      : null;
  const kpis = [
    {
      label: "Published menus",
      value: stats.publishedMenuCount,
      detail: "Guest-visible releases",
      explanation:
        "Only committed menus in the currently accessible public release. Private drafts are excluded.",
      Icon: BookOpen,
    },
    {
      label: "Categories",
      value: stats.publishedCategoryCount,
      detail: "In your live menu",
      explanation:
        "Categories included in the current public release, excluding archived categories.",
      Icon: Layers3,
    },
    {
      label: "Dishes",
      value: stats.publishedDishCount,
      detail: "Published and visible",
      explanation: "Non-archived dishes in the published release, not unpublished editor changes.",
      Icon: ChefHat,
    },
    {
      label: "Active QR codes",
      value: stats.activeQrCount,
      detail: "Permanent menu links",
      explanation:
        "Active menu-purpose QR identities for this outlet. Revoked links and order QR codes are excluded.",
      Icon: QrCode,
    },
    {
      label: "Menus to publish",
      value: stats.draftCount,
      detail: "With unpublished edits",
      explanation:
        "Counts menus with saved changes awaiting publication—not the number of individual edits.",
      Icon: FilePenLine,
    },
    {
      label: "Public menu status",
      value: stats.hasPublicMenu ? "Live" : "Not live",
      detail: stats.hasPublicMenu ? "Available to guests" : "Publish to go live",
      explanation:
        "Live means an active menu QR currently resolves to a committed guest-facing menu.",
      Icon: Globe2,
      positive: stats.hasPublicMenu,
    },
  ];
  const priorities = stats.hasPublicMenu
    ? [
        {
          title: "Add a new dish",
          detail: "Grow your menu with something special.",
          action: "Add dish",
          href: "/dashboard/menu",
          Icon: Plus,
        },
        {
          title: "Refine your menu",
          detail: "Update descriptions, prices or availability.",
          action: "Edit menu",
          href: "/dashboard/menu",
          Icon: UtensilsCrossed,
        },
        {
          title: "Share your QR",
          detail: "Download or print a permanent menu link.",
          action: "View QR",
          href: "/dashboard/qr-codes",
          Icon: QrCode,
        },
      ]
    : [
        {
          title: hasSavedMenu ? "Continue your saved menu" : "Create your first menu",
          detail: hasSavedMenu
            ? "Review your draft before publication."
            : "Add categories, dishes and prices.",
          action: hasSavedMenu ? "Continue draft" : "Menu Studio",
          href: "/dashboard/menu",
          Icon: Plus,
        },
        {
          title: "Prepare your QR codes",
          detail: "Check the links you will share with guests.",
          action: "View QR",
          href: "/dashboard/qr-codes",
          Icon: QrCode,
        },
        {
          title: "Preview and publish",
          detail: "Make your saved menu available to guests.",
          action: "Publish menu",
          href: "/dashboard/menu",
          Icon: CheckCircle2,
        },
      ];

  return (
    <div className="mm-dashboard product" data-testid="editorial-dashboard">
      <header className="mm-dashboard-hero">
        <div className="mm-dashboard-hero-copy">
          <span className="mm-dashboard-eyebrow">
            A little more than a dashboard <span aria-hidden="true">—</span>
          </span>
          <h1>
            Make something
            <br />
            delicious today.
          </h1>
          <p>
            Welcome back to <strong>{outlet.name}</strong>.<br />
            {stats.hasPublicMenu
              ? "Your menu is ready to shine."
              : "Your next great menu starts here."}
          </p>
          {outlet.isDemoData && <span className="mm-dashboard-demo">Demo outlet</span>}
          <div className="mm-dashboard-hero-actions">
            <Link
              href="/dashboard/menu"
              className="mm-dashboard-button mm-dashboard-button--primary"
            >
              Open Menu Studio <ArrowRight size={17} aria-hidden="true" />
            </Link>
            {publicHref && (
              <Link
                href={publicHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mm-dashboard-button mm-dashboard-button--secondary"
              >
                View public menu <ExternalLink size={15} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mm-dashboard-body">
        <section className="mm-dashboard-glance" aria-labelledby="mm-glance-title">
          <div className="mm-dashboard-section-heading">
            <h2 id="mm-glance-title" className="mm-dashboard-eyebrow">
              At a glance
            </h2>
            <span className="mm-dashboard-data-note">Published menu data · Current outlet</span>
          </div>
          <div className="mm-dashboard-kpis">
            {kpis.map(({ label, value, detail, explanation, Icon, ...rest }) => (
              <div className="mm-dashboard-kpi" key={label}>
                <div className="mm-dashboard-kpi-top">
                  <span className="mm-dashboard-kpi-icon">
                    <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <span className="mm-dashboard-kpi-label">{label}</span>
                  <DashboardTooltip label={label}>{explanation}</DashboardTooltip>
                </div>
                <strong
                  className={
                    "mm-dashboard-kpi-value" +
                    ("positive" in rest && rest.positive ? " is-positive" : "")
                  }
                >
                  {typeof value === "number" ? new Intl.NumberFormat("en").format(value) : value}
                </strong>
                <span className="mm-dashboard-kpi-detail">{detail}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="mm-dashboard-lower">
          <section className="mm-dashboard-priorities" aria-labelledby="mm-priorities-title">
            <div className="mm-dashboard-priorities-head">
              <div>
                <span className="mm-dashboard-eyebrow">Your next move</span>
                <h2 id="mm-priorities-title">Today’s priorities</h2>
                <p>A few quick actions to keep {outlet.name} fresh, accurate and guest-ready.</p>
              </div>
              <Image
                src={artwork + "priorities-illustration.webp"}
                alt=""
                width={156}
                height={112}
                className="mm-dashboard-priorities-art"
              />
            </div>
            <ol className="mm-dashboard-priority-list">
              {priorities.map((item, index) => (
                <li className="mm-dashboard-priority" key={item.title}>
                  <span className="mm-dashboard-priority-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="mm-dashboard-priority-copy">
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <Link href={item.href} className="mm-dashboard-priority-action">
                    {item.action} <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ol>
            <Link href="/dashboard/menu" className="mm-dashboard-publish">
              <span className="mm-dashboard-publish-icon">
                <FilePenLine size={22} aria-hidden="true" />
              </span>
              <span>
                <strong>
                  {stats.draftCount > 0
                    ? "Review & publish changes"
                    : stats.hasPublicMenu
                      ? "Keep your menu fresh"
                      : "Create & publish your menu"}
                </strong>
                <small>
                  {stats.draftCount > 0
                    ? stats.draftCount +
                      (stats.draftCount === 1 ? " menu has" : " menus have") +
                      " unpublished changes."
                    : stats.hasPublicMenu
                      ? "Your current release is live. Edit whenever you need."
                      : "Create your first guest-facing release."}
                </small>
              </span>
              <ArrowRight className="mm-dashboard-publish-arrow" size={22} aria-hidden="true" />
            </Link>
          </section>

          <DashboardServicePulse
            key={outlet.id}
            outletId={outlet.id}
            initial={operations}
          />

          <section className="mm-dashboard-health" aria-labelledby="mm-health-title">
            <div className="mm-dashboard-health-head">
              <div>
                <span className="mm-dashboard-eyebrow">{outlet.name}</span>
                <h2 id="mm-health-title">Outlet health &amp; publishing status</h2>
                <p>
                  {stats.hasPublicMenu
                    ? "Your current menu is available to guests."
                    : "Finish publishing to make your menu available to guests."}
                </p>
              </div>
              <Image
                src={artwork + "outlet-health-illustration.webp"}
                alt=""
                width={86}
                height={103}
                className="mm-dashboard-health-art"
              />
            </div>
            <dl className="mm-dashboard-health-rows">
              <div className="mm-dashboard-health-row">
                <BookOpen size={20} aria-hidden="true" />
                <div>
                  <dt>Menu publish status</dt>
                  <dd>
                    {stats.hasPublicMenu
                      ? "A committed public release is available"
                      : "No public release available yet"}
                  </dd>
                </div>
                <span
                  className={"mm-dashboard-health-badge" + (stats.hasPublicMenu ? " is-good" : "")}
                >
                  {stats.hasPublicMenu ? "Live" : "Pending"}
                </span>
              </div>
              <div className="mm-dashboard-health-row">
                <QrCode size={20} aria-hidden="true" />
                <div>
                  <dt>QR codes</dt>
                  <dd>
                    {stats.activeQrCount +
                      (stats.activeQrCount === 1
                        ? " active permanent link"
                        : " active permanent links")}
                  </dd>
                </div>
                <span
                  className={
                    "mm-dashboard-health-badge" + (stats.activeQrCount > 0 ? " is-good" : "")
                  }
                >
                  {stats.activeQrCount > 0 ? "Active" : "None active"}
                </span>
              </div>
              <div className="mm-dashboard-health-row">
                <Globe2 size={20} aria-hidden="true" />
                <div>
                  <dt>Menu visibility</dt>
                  <dd>
                    {stats.hasPublicMenu
                      ? "Accessible through your active menu link"
                      : "Private until publication"}
                  </dd>
                </div>
                <span
                  className={"mm-dashboard-health-badge" + (stats.hasPublicMenu ? " is-good" : "")}
                >
                  {stats.hasPublicMenu ? "Public" : "Private"}
                </span>
              </div>
              <div className="mm-dashboard-health-row mm-dashboard-health-row--progress">
                <CheckCircle2 size={20} aria-hidden="true" />
                <div>
                  <dt>
                    Menu launch setup{" "}
                    <DashboardTooltip label="Setup completion">
                      Outlet configured, menu created, public release and active QR code. This does not measure ordering, staff or payment readiness. Each
                      verified step counts equally.
                    </DashboardTooltip>
                  </dt>
                  <dd>
                    {setup.completed} of {setup.total} essentials completed
                  </dd>
                  <progress
                    max={setup.total}
                    value={setup.completed}
                    aria-label="Outlet setup progress"
                  />
                </div>
                <strong>{setup.percent}%</strong>
              </div>
            </dl>
            <div className="mm-dashboard-setup-foot">
              <span>
                <Check size={15} aria-hidden="true" />{" "}
                {setup.checks.filter((check) => check.complete).length} verified steps
              </span>
              <Link href="/dashboard/settings">
                Outlet settings <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
