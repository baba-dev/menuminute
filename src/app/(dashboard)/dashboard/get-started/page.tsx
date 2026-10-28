import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, CircleDashed, ClipboardList } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { outletSetupReadiness } from "@/modules/onboarding/readiness";
import { ThemedArtwork } from "@/components/onboarding/themed-artwork";
import "@/components/onboarding/onboarding-wizard.css";
import "./get-started.css";

export const metadata = {
  title: "Your restaurant setup checklist | MenuMinute",
  robots: { index: false, follow: false },
};

export default async function GetStartedPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet) redirect("/start");
  const readiness = await outletSetupReadiness(
    { userId: session.user.id, sessionId: session.session.id },
    outlet
  );
  const next = readiness.checks.find((item) => !item.complete);
  return (
    <main className="mm-setup-page">
      <section className="wizard-completion-hero">
        <div>
          <span className="wizard-eyebrow">RESTAURANT CREATED · YOUR NEXT MILESTONES</span>
          <h1>Welcome, {outlet.name}.</h1>
          <p>
            Your workspace is ready. Only completed, verified steps earn credit; creating a draft
            never means your menu is public.
          </p>
          <p className="wizard-counter">
            Goal: {outlet.onboardingGoal.replaceAll("_", " ")} · {outlet.currency} ·{" "}
            {outlet.timezone}
          </p>
        </div>
        <ThemedArtwork name="celebration-overlay" width={1000} height={600} />
      </section>
      <section className="mm-readiness-section" aria-labelledby="mm-readiness-title">
        <div className="mm-readiness-heading">
          <div>
            <h2 id="mm-readiness-title">
              <ClipboardList size={21} aria-hidden="true" /> Your live launch checklist
            </h2>
            <p>
              Progress is calculated from saved dishes, published releases, QR readiness, and
              applicable operational status.
            </p>
          </div>
          <strong>
            {readiness.completed} of {readiness.total} verified
          </strong>
        </div>
        <progress
          max={readiness.total}
          value={readiness.completed}
          aria-label="Verified setup progress"
        />
        <div className="wizard-next-grid">
          {readiness.checks.map((check) => (
            <Link key={check.id} href={check.href} className="wizard-next-card mm-readiness-card">
              {check.complete ? (
                <CheckCircle2 size={24} color="#159765" aria-hidden="true" />
              ) : (
                <CircleDashed size={24} aria-hidden="true" />
              )}
              <strong>{check.label}</strong>
              <span>{check.description}</span>
              <span className="mm-readiness-status">
                {check.complete ? "Verified complete" : "Needs action"}
              </span>
              <span className="wizard-next-link">
                {check.complete ? "Review" : "Continue setup"}{" "}
                <ArrowRight size={15} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
        {next ? (
          <p className="mm-readiness-hint">
            Recommended next step: <Link href={next.href}>{next.label}</Link>.
          </p>
        ) : (
          <p className="mm-readiness-hint" role="status">
            All steps for your selected goal are verified. Keep your menu current!
          </p>
        )}
      </section>
      <nav className="mm-readiness-actions" aria-label="Continue your restaurant setup">
        <Link href="/dashboard/menu" className="wizard-primary-btn">
          Open Menu Studio <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link href="/dashboard" className="wizard-back-btn">
          Go to dashboard
        </Link>
        <Link href="/start" className="wizard-back-btn">
          Manage another journey
        </Link>
      </nav>
    </main>
  );
}
