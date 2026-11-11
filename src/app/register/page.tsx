import { Suspense } from "react";
import { env } from "@/lib/config/env";
import { RegistrationForm } from "./register-form";

export const metadata = {
  title: "Create an account — MenuMinute",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <Suspense>
      <RegistrationForm googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)} />
    </Suspense>
  );
}
