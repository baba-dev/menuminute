import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./setup-form";
export const metadata = { title: "Set up your outlet — MenuMinute" };
export default async function OnboardingPage() {
  if (!(await auth())?.user.id) redirect("/login?next=%2Fonboarding");
  return (
    <main className="product public-shell stack">
      <h1>Make it yours.</h1>
      <p>
        Set up your first outlet. Progress is saved to your verified account, not a single browser
        tab.
      </p>
      <OnboardingForm />
    </main>
  );
}
