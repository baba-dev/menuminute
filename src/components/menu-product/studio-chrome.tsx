"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  ChefHat,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Eye,
  FilePenLine,
  ImagePlus,
  QrCode,
  Save,
  Send,
} from "lucide-react";
import type { MenuDocument } from "@/modules/menu-product/contracts";
import { currencyExponent } from "@/lib/money";

const art = "/brand/menu-studio/recipe-atelier/";

export type StudioImport = {
  id: string;
  status: string;
  revision: number;
  updatedAt: Date | string;
};
export type StudioMenu = { id: string; document: unknown; archived: boolean };

export function StudioHero({
  outlet,
}: {
  outlet: { name: string; currency: string; outletType: string };
}) {
  return (
    <header className="atelier-hero">
      <div className="atelier-hero-copy">
        <span className="atelier-eyebrow">THE CREATIVE KITCHEN / MENU STUDIO</span>
        <h1>Menu Studio</h1>
        <p className="atelier-hero-headline">
          Every great menu
          <br />
          starts here.
        </p>
        <p className="atelier-hero-intro">
          Build, refine and preview {outlet.name}&apos;s menu. Your guests only see what you
          explicitly publish.
        </p>
        <div className="atelier-hero-links">
          <Link href="/dashboard/menu/import" className="atelier-hero-primary">
            <ImagePlus size={18} aria-hidden="true" /> Import from photos
          </Link>
          <Link href="/dashboard/qr-codes" className="atelier-hero-secondary">
            <QrCode size={17} aria-hidden="true" /> Permanent QR
          </Link>
        </div>
      </div>
      <span className="atelier-hero-credit" aria-hidden="true">
        {outlet.outletType.replaceAll("_", " ")} · {outlet.currency}
      </span>
    </header>
  );
}

const metricDetails = [
  "Active sections in the selected editable draft. Archived sections do not count.",
  "Active dishes in your selected draft. This is not the public-menu dish count until you publish.",
  "Photo/PDF imports awaiting human review; imported candidates never publish themselves.",
  "Your selected menu's committed public-release state. Local edits and saved drafts are separate.",
] as const;

export function StudioOverview({
  doc,
  imports,
  publishedRevision,
  revision,
  dirty,
}: {
  doc: MenuDocument | null;
  imports: StudioImport[];
  publishedRevision: number | null | undefined;
  revision: number | undefined;
  dirty: boolean;
}) {
  const sections = doc?.categories.filter((c) => !c.archived) ?? [];
  const metrics = [
    { label: "Sections", count: sections.length, note: "In your editable draft", Icon: BookOpen },
    {
      label: "Dishes",
      count: sections.reduce((sum, c) => sum + c.items.filter((d) => !d.archived).length, 0),
      note: "Across active sections",
      Icon: ChefHat,
    },
    {
      label: "Source imports",
      count: imports.filter((i) => ["needs_review", "ready"].includes(i.status)).length,
      note: "Awaiting human review",
      Icon: ClipboardList,
    },
    {
      label: "Publication",
      count: !publishedRevision
        ? "Draft"
        : dirty || (revision ?? 0) > publishedRevision
          ? "Live + draft"
          : "Live",
      note: dirty
        ? "Local changes unsaved"
        : publishedRevision
          ? "Guest release exists"
          : "Explicit publish only",
      Icon: CheckCircle2,
    },
  ];
  return (
    <section className="atelier-metrics" aria-label="Menu Studio overview">
      <div className="atelier-metrics-heading">
        <h2 className="atelier-eyebrow">THIS MENU AT A GLANCE</h2>
        <span>Current outlet · Private draft</span>
      </div>
      <div className="atelier-metrics-grid">
        {metrics.map(({ label, count, note, Icon }, index) => (
          <div className="atelier-metric" key={label}>
            <div className="atelier-metric-label">
              <span className="atelier-metric-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <strong>{label}</strong>
              <details className="atelier-hint">
                <summary aria-label={"About " + label}>
                  <CircleHelp size={15} aria-hidden="true" />
                </summary>
                <p>{metricDetails[index]}</p>
              </details>
            </div>
            <span className="atelier-metric-value">{count}</span>
            <span className="atelier-metric-note">{note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StudioImportNotice({ imports }: { imports: StudioImport[] }) {
  const pending = imports.filter((i) => ["needs_review", "ready"].includes(i.status));
  if (!pending.length) return null;
  return (
    <section aria-label="Pending human review" className="atelier-import-notice">
      <div>
        <span className="atelier-eyebrow">YOUR IMPORTS NEED A HUMAN EYE</span>
        <h2>
          {pending.length} {pending.length === 1 ? "import awaits" : "imports await"} your review
        </h2>
        <p>
          Compare the source photos, correct dish names and prices, then explicitly apply changes to
          a private draft.
        </p>
      </div>
      <div className="atelier-import-links">
        {pending.slice(0, 3).map((item) => (
          <Link
            key={item.id}
            href={"/dashboard/menu/import/" + encodeURIComponent(item.id) + "/review"}
          >
            {item.status === "ready" ? "Apply reviewed draft" : "Continue source review"} →
          </Link>
        ))}
      </div>
    </section>
  );
}

export function StudioActions({
  archived,
  writable,
  busy,
  pending,
  dirty,
  revision,
  publishedRevision,
  preview,
  onPreview,
  onSave,
  onPublish,
}: {
  archived: boolean;
  writable: boolean;
  busy: boolean;
  pending: boolean;
  dirty: boolean;
  revision: number;
  publishedRevision: number | null | undefined;
  preview: boolean;
  onPreview: () => void;
  onSave: () => void;
  onPublish: () => void;
}) {
  const disabled = busy || archived || !writable || pending || preview;
  return (
    <div className="atelier-actionbar" role="group" aria-label="Draft and publication actions">
      <div className="atelier-save-state" aria-live="polite">
        <span className={"atelier-state-dot" + (dirty ? " is-dirty" : "")} aria-hidden="true" />
        <strong>{archived ? "Archived" : dirty ? "Unsaved changes" : "Draft saved"}</strong>
        <small>
          Revision {revision} ·{" "}
          {publishedRevision ? "Public release " + publishedRevision : "Not published"}
        </small>
        {pending && <small>Review selected Composer dishes first</small>}
        {preview && <small>Return to edit before saving or publishing</small>}
      </div>
      <div className="atelier-actionbuttons">
        <button
          type="button"
          className="atelier-preview-trigger"
          onClick={onPreview}
          aria-pressed={preview}
        >
          <Eye size={16} aria-hidden="true" /> {preview ? "Back to edit" : "Preview draft"}
        </button>
        <button type="button" className="ember" disabled={disabled} onClick={onSave}>
          <Save size={16} aria-hidden="true" />
          Save draft
        </button>
        <button type="button" className="ember ink-press" disabled={disabled} onClick={onPublish}>
          <Send size={16} aria-hidden="true" />
          Publish menu
        </button>
      </div>
    </div>
  );
}

export function StudioEmpty() {
  return (
    <section className="atelier-empty" aria-labelledby="atelier-empty-title">
      <Image src={art + "first-menu-empty-illustration.webp"} width={350} height={300} alt="" />
      <div>
        <span className="atelier-eyebrow">YOUR FIRST MENU</span>
        <h2 id="atelier-empty-title">A delicious beginning.</h2>
        <p>
          Create a draft, add your own dishes or import a menu photo, then publish when you are
          ready. Nothing is shared with guests automatically.
        </p>
        <Link href="/dashboard/menu/import">Or start by importing your menu →</Link>
      </div>
    </section>
  );
}

export function StudioMilestone({ dismiss }: { dismiss: () => void }) {
  return (
    <section className="atelier-milestone" aria-labelledby="atelier-milestone-title">
      <Image src={art + "publication-celebration.webp"} alt="" width={170} height={128} />
      <div>
        <span className="atelier-eyebrow">PUBLISHED SUCCESSFULLY</span>
        <h2 id="atelier-milestone-title">Your menu is live.</h2>
        <p>
          The server confirmed publication. Your existing printed QR stays the same; guests can see
          the new release.
        </p>
        <Link href="/dashboard/qr-codes">Manage permanent QR codes →</Link>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss publication success">
        Dismiss
      </button>
    </section>
  );
}

export function StudioPreview({
  doc,
  currency,
  timezone,
}: {
  doc: MenuDocument;
  currency: string;
  timezone: string;
}) {
  const exponent = currencyExponent(currency) ?? 2;
  const allSections = doc.categories.filter((c) => !c.archived);
  const sections = allSections.slice(0, 4);
  return (
    <aside className="atelier-preview-panel no-print" aria-label="Integrated private draft preview">
      <div className="atelier-preview-top">
        <span className="atelier-eyebrow">PRIVATE DRAFT PREVIEW</span>
        <span>LIVE EDITS</span>
      </div>
      <div className="atelier-preview-window">
        <div className="atelier-preview-cover">
          <span>FROM OUR KITCHEN</span>
          <h2>{doc.name || "Your menu"}</h2>
          <small>
            {currency} · {timezone}
          </small>
        </div>
        <p className="atelier-preview-disclaimer">
          Draft outline only. Guests see your last explicitly published release. Use Preview draft to inspect the complete projected menu.
        </p>
        {sections.length ? (
          sections.map((cat) => (
            <section key={cat.id} className="atelier-preview-category">
              <h3>{cat.name}</h3>
              {cat.items
                .filter((i) => !i.archived)
                .slice(0, 8)
                .map((dish) => (
                  <div key={dish.id} className="atelier-preview-dish">
                    <div>
                      <strong>{dish.name || "Untitled dish"}</strong>
                      {dish.description && <small>{dish.description}</small>}
                      {dish.soldOut && <em>Sold out</em>}
                    </div>
                    <b>
                      {(dish.priceMinor / 10 ** exponent).toFixed(exponent)} {currency}
                    </b>
                  </div>
                ))}
            </section>
          ))
        ) : (
          <div className="atelier-preview-blank">
            <FilePenLine size={24} aria-hidden="true" />
            <p>Add your first section to begin the private preview.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
