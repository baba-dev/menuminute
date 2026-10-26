import { auth } from "@/lib/auth";
import { SessionContinuity } from "@/components/auth/session-continuity";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./setup-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { ThemedArtwork } from "@/components/onboarding/themed-artwork";
import "@/components/onboarding/onboarding-wizard.css";
export const metadata = { title: "Set up your outlet — MenuMinute" };
export default async function OnboardingPage() {
  if (!(await auth())?.user.id) redirect("/login?next=%2Fonboarding");
  return (
    <AuthShell
      eyebrow="FIRST OUTLET / SAVED AS YOU GO"
      title="Make it yours."
      description="Set up your first outlet. We save your progress to your verified account, so interruptions and reloads are safe."
    >
      <SessionContinuity />
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
