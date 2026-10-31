"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

/** Sign-out remains discoverable after removing the redundant workspace sidebar footer. */
export function AccountSignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out was not confirmed. Please retry.");
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Couldn't sign out. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="grid justify-items-start gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => void signOut()}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:cursor-wait disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-800"
      >
        <LogOut size={17} aria-hidden="true" />
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
