"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
type Preview = {
  organization: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
};
export function InviteAccept({ token, accountEmail }: { token: string; accountEmail: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch("/api/invitations/" + token, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message ?? "Invitation unavailable.");
        setPreview(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Invitation unavailable."));
  }, [token]);
  return (
    <main className="product public-shell stack" style={{ maxWidth: "640px" }}>
      <Link href="/">MenuMinute</Link>
      <h1>Join your team.</h1>
      <p>
        Signed in as <strong>{accountEmail}</strong>. Invitations are bound to the verified
        recipient address.
      </p>
      {preview && (
        <section className="panel stack">
          <h2>{preview.organization}</h2>
          <p>
            Invited as {preview.role}. Expires {new Date(preview.expiresAt).toLocaleDateString()}.
          </p>
          {preview.role === "admin" && (
            <p>
              Admin access requires enrollment in{" "}
              <Link href="/account/security" className="underline">
                two-factor authentication
              </Link>
              .
            </p>
          )}
          <button
            className="ember"
            disabled={busy || preview.status !== "pending"}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await fetch("/api/invitations/" + token, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: "{}",
                });
                const data = await r.json();
                if (!r.ok) throw new Error(data.message ?? "Unable to accept invitation.");
                router.replace("/dashboard");
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to accept invitation.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Accepting…" : "Accept invitation"}
          </button>
        </section>
      )}
      {error && (
        <p role="alert" className="error">
          {error} If you have another account, sign in using the invited email.
        </p>
      )}
      <Link href="/login" className="underline">
        Switch account
      </Link>
    </main>
  );
}
