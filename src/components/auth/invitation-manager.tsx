"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
type Invitation = { id: string; email: string; role: string; status: string; expiresAt: string };
export function InvitationManager({ organizationId }: { organizationId: string }) {
  const [items, setItems] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const key = useRef(crypto.randomUUID());
  const load = useCallback(async () => {
    const r = await fetch("/api/organizations/" + organizationId + "/invitations", {
      cache: "no-store",
    });
    if (!r.ok) throw new Error("Unable to load invitations.");
    setItems(await r.json());
  }, [organizationId]);
  useEffect(() => {
    void load().catch(() => setMessage("Unable to load invitations."));
  }, [load]);
  return (
    <section className="product panel stack">
      <h2>Invite a teammate</h2>
      <p>
        We email an expiring invitation. Access is granted only after its intended recipient signs
        in with a verified matching address and accepts it.
      </p>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setMessage("");
          try {
            const r = await fetch("/api/organizations/" + organizationId + "/invitations", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email, role, key: key.current }),
            });
            const body = await r.json();
            if (!r.ok) throw new Error(body.message ?? "Unable to send invitation.");
            setMessage("Invitation sent. The same request can be retried safely.");
            key.current = crypto.randomUUID();
            setEmail("");
            await load();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Unable to send invitation.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Recipient email
          <input
            type="email"
            required
            autoComplete="off"
            value={email}
            maxLength={254}
            onChange={(e) => {
              setEmail(e.target.value);
              key.current = crypto.randomUUID();
            }}
          />
        </label>
        <label className="field">
          Organization role
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as "member" | "admin");
              key.current = crypto.randomUUID();
            }}
          >
            <option value="member">Member — scoped access</option>
            <option value="admin">Admin — organization access</option>
          </select>
        </label>
        {role === "admin" && (
          <p>
            Admin invitations require a fresh confirmation in{" "}
            <Link href="/account/security" className="underline">
              Account security
            </Link>{" "}
            before sending. Recipients must enroll MFA before accepting.
          </p>
        )}
        <button disabled={busy || !email} className="ember">
          {busy ? "Sending…" : "Send invitation"}
        </button>
      </form>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <h3>Invitation history</h3>
      {!items.length ? (
        <p>No invitations yet.</p>
      ) : (
        <ul className="stack">
          {items.map((item) => (
            <li key={item.id} className="panel row between">
              <div className="min-w-0">
                <strong className="break-all">{item.email}</strong>
                <p>
                  {item.role} · {item.status} · expires{" "}
                  {new Date(item.expiresAt).toLocaleDateString()}
                </p>
              </div>
              {item.status === "pending" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setMessage("");
                    try {
                      const r = await fetch(
                        "/api/organizations/" + organizationId + "/invitations",
                        {
                          method: "DELETE",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ id: item.id }),
                        }
                      );
                      if (!r.ok) throw new Error("Could not revoke invitation.");
                      await load();
                      setMessage("Invitation revoked.");
                    } catch (e) {
                      setMessage(e instanceof Error ? e.message : "Unable to revoke.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
