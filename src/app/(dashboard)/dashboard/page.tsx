import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, ExternalLink, Layers, Plus, QrCode, UtensilsCrossed } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant, getRestaurantQrCodes } from "@/modules/restaurants/service";
import { listMenus, publicProduct } from "@/modules/menu-product/service";
import { dashboardSummary, preferredMenuQr } from "@/modules/menu-product/dashboard-summary";
import { ServiceCard } from "@/components/menu-product/phase4-primitives";

export const metadata = {
  title: "Restaurant overview — MenuMinute",
  description: "Published menus, drafts and permanent QR codes for your selected outlet",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const actor = { userId: session.user.id };
  const outlet = await getDefaultOrActiveRestaurant(actor.userId, session.activeOutletId);
  if (!outlet) {
    return (
      <div className="product">
        <ServiceCard className="grid gap-3">
          <h1>No outlet selected</h1>
          <p>Create your first outlet to begin a free permanent QR menu.</p>
          <Link href="/onboarding" className="mm-action mm-action--press w-fit">
            Set up an outlet
          </Link>
        </ServiceCard>
      </div>
    );
  }

  // Only canonical scoped menu rows and active public QR identities count toward the overview.
  // Draft document contents must never masquerade as the immutable published release.
  const [menus, codes] = await Promise.all([
    listMenus(actor, outlet.id),
    getRestaurantQrCodes(actor, outlet.id),
  ]);
  const primaryQr = preferredMenuQr(codes);
  const publicProjection = primaryQr ? await publicProduct(primaryQr.destinationToken) : null;
  const stats = dashboardSummary(menus, codes, publicProjection);
  const menuHref = primaryQr ? `/m/${encodeURIComponent(primaryQr.destinationToken)}` : null;
  const cards = [
    {
      label: "Published menus",
      value: stats.publishedMenuCount,
      hint: "Guest-visible releases",
      Icon: BookOpen,
    },
    {
      label: "Published categories",
      value: stats.publishedCategoryCount,
      hint: "From current releases",
      Icon: Layers,
    },
    {
      label: "Published dishes",
      value: stats.publishedDishCount,
      hint: "Not unsaved edits",
      Icon: UtensilsCrossed,
    },
    {
      label: "Active menu QR codes",
      value: stats.activeQrCount,
      hint: "Permanent menu links",
      Icon: QrCode,
    },
  ];

  return (
    <div className="product grid gap-6">
      <header className="mm-service-card grid gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="grid min-w-0 gap-2">
          <span className="eyebrow">Your selected outlet</span>
          <h1 className="break-words">{outlet.name}</h1>
          <p>{[outlet.city, outlet.currency, outlet.timezone].filter(Boolean).join(" · ")}</p>
          {outlet.isDemoData && <span className="badge w-fit">Demo outlet</span>}
        </div>
        <Link href="/dashboard/menu" className="mm-action mm-action--flow shrink-0">
          <Plus size={18} aria-hidden="true" /> Manage menu
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Published menu overview">
        {cards.map(({ label, value, hint, Icon }) => (
          <ServiceCard key={label} className="grid gap-2">
            <Icon size={20} aria-hidden="true" />
            <span className="text-sm font-semibold">{label}</span>
            <strong className="text-3xl font-extrabold tabular-nums">{value}</strong>
            <small>{hint}</small>
          </ServiceCard>
        ))}
      </div>

      <ServiceCard className="grid gap-4">
        {stats.hasPublicMenu ? (
          <>
            <div>
              <span className="eyebrow">Ready for guests</span>
              <h2>Published menu ready</h2>
              <p>
                Guests see the committed published release. Saving a draft will not change it until
                you publish again.
              </p>
            </div>
            <div className="row">
              {menuHref && (
                <Link
                  href={menuHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mm-action mm-action--press"
                >
                  View public menu <ExternalLink size={16} aria-hidden="true" />
                </Link>
              )}
              <Link href="/dashboard/menu" className="mm-action mm-action--quiet">
                Edit or publish changes
              </Link>
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="eyebrow">Your next step</span>
              <h2>No published menu yet</h2>
              <p>
                {stats.draftCount > 0
                  ? "Your saved drafts remain private. Preview and publish a menu to let guests browse it."
                  : "Start your menu with a category and a dish, then preview and publish it."}
                {primaryQr && " Your existing printed QR identity stays the same."}
              </p>
            </div>
            <Link href="/dashboard/menu" className="mm-action mm-action--press w-fit">
              {stats.draftCount > 0 ? "Continue your menu" : "Create your first menu"}
            </Link>
          </>
        )}
      </ServiceCard>

      <div className="grid gap-3 md:grid-cols-2">
        <ServiceCard className="grid content-between gap-3">
          <div>
            <h2>Menu Studio</h2>
            <p>
              {stats.draftCount > 0
                ? `${stats.draftCount} menu draft${stats.draftCount === 1 ? "" : "s"} waiting for publication.`
                : "Manage categories, dishes, schedules and approved photos."}
            </p>
          </div>
          <Link href="/dashboard/menu" className="mm-action mm-action--quiet w-fit">
            Open Menu Studio
          </Link>
        </ServiceCard>
        <ServiceCard className="grid content-between gap-3">
          <div>
            <h2>Permanent QR codes</h2>
            <p>
              Download PNG/SVG or print service-point codes. Printed links survive menu edits; only
              explicit revocation/regeneration changes their identity.
            </p>
          </div>
          <Link href="/dashboard/qr-codes" className="mm-action mm-action--quiet w-fit">
            Manage QR codes
          </Link>
        </ServiceCard>
      </div>
    </div>
  );
}
