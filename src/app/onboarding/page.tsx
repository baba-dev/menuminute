import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./setup-form";
export default async function OnboardingPage() {
  if (!(await auth())?.user.id) redirect("/login");
  return (
    <main className="product public-shell stack">
      <h1 className="text-2xl font-bold">Set up your first outlet</h1>
      <p>
        Choose the settings for this location. Your account can belong to several organizations.
      </p>
      <OnboardingForm />
    </main>
  );
}
