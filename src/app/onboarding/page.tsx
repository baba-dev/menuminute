import { auth } from "@/lib/auth";
import Link from "next/link";
import { listOrganizations } from "@/modules/organizations/service";
import { SessionContinuity } from "@/components/auth/session-continuity";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./setup-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";
import { ThemedArtwork } from "@/components/onboarding/themed-artwork";
import "@/components/onboarding/onboarding-wizard.css";
export const metadata = { title: "Set up your outlet — MenuMinute" };
export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login?next=%2Fonboarding");
  const memberships = await listOrganizations({ userId: session.user.id });
  if (memberships.some((org) => org.isActive && org.role === "owner"))
    redirect("/dashboard/organization");
  return (
    <AuthShell
      eyebrow="FIRST OUTLET / SAVED AS YOU GO"
      title="Make it yours."
      description="Set up your first outlet. We save your progress to your account, so interruptions and reloads are safe."
      notice={
        session.user.emailVerified ? undefined : (
          <VerifyEmailBanner email={session.user.email} returnTo="/dashboard" />
        )
      }
    >
      <SessionContinuity />
      <p className="wizard-counter">
        <Link href="/start?choose=1">← Choose another setup path</Link>
      </p>
      <div className="wizard-welcome-media" aria-hidden="true">
        <ThemedArtwork
          name="welcome-hero-desktop"
          width={1440}
          height={960}
          className="wizard-welcome-desktop"
        />
        <ThemedArtwork
          name="welcome-hero-mobile"
          width={720}
          height={960}
          className="wizard-welcome-mobile"
        />
      </div>
      <OnboardingForm />
    </AuthShell>
  );
}
