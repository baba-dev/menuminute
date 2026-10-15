"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
type Organization = { id: string; name: string; role: string; version: number; isActive: boolean };
type Detail = {
  organization: Organization;
  members: { id: string; name: string; email: string; role: string; isActive: boolean }[];
  outlets: {
    id: string;
    name: string;
    country: string;
    currency: string;
    timezone: string;
    outletType: string;
    fulfillmentModes: string[];
  }[];
  brands: { id: string; name: string }[];
  links: { brandId: string; outletId: string }[];
  grants: { memberId: string; outletId: string; roles: string[] }[];
  audit: { id: string; action: string; createdAt: string }[];
  jobs: { id: string; status: string; attempts: number; lastError: string | null }[];
  projection: { version: number } | null;
};
const inputClass = "w-full rounded-md border border-stone-300 bg-white p-2 text-sm";
function Field({
  label,
  name,
  defaultValue = "",
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input className={inputClass} name={name} type={type} defaultValue={defaultValue} required />
    </label>
  );
}
function Form({
  title,
  button,
  children,
  onSave,
  disabled = false,
}: {
  title: string;
  button: string;
  children: ReactNode;
  onSave: (data: FormData) => Promise<void>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className="space-y-3 rounded-xl border border-stone-200 bg-white p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setMessage("");
        try {
          await onSave(data);
          setMessage("Saved");
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Unable to save");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-bold">{title}</h2>
      <fieldset disabled={busy || disabled} className="space-y-3">
        {children}
        <button className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : button}
        </button>
      </fieldset>
      <p role="status" className="text-sm">
        {message}
      </p>
    </form>
  );
}
export function OrganizationManager({ organizations }: { organizations: Organization[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(organizations[0]?.id ?? "");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [billing, setBilling] = useState<{
    freeMenu: boolean;
    ordering: boolean;
    kitchen: boolean;
    grants: {
      id: string;
      capability: string;
      billingCurrency: string;
      endsAt: string;
      revokedAt: string | null;
    }[];
  } | null>(null);
  const activeSelection = useRef(selected);
  const requestGeneration = useRef(0);
  const selectedOrg = organizations.find((o) => o.id === selected);
  const load = useCallback(async () => {
    if (activeSelection.current !== selected) return;
    const generation = ++requestGeneration.current;
    const res = await fetch(`/api/organizations/${selected}`);
    const body = await res.json();
    if (generation !== requestGeneration.current || activeSelection.current !== selected) return;
    setError("");
    if (!res.ok) {
      setDetail(null);
      setBilling(null);
      setError(body.message ?? "Unable to load organization");
      return;
    }
    setDetail(body);
    if (selectedOrg?.role === "owner") {
      const b = await fetch(`/api/organizations/${selected}/billing`);
      const value = b.ok ? await b.json() : null;
      if (generation === requestGeneration.current && activeSelection.current === selected)
        setBilling(value);
    } else setBilling(null);
  }, [selected, selectedOrg?.role]);
  useEffect(() => {
    if (selected)
      void Promise.resolve()
        .then(load)
        .catch(() => {
          if (activeSelection.current === selected)
            setError("Unable to load organization. Try refreshing.");
        });
  }, [selected, load]);
  async function send(action: string, data: Record<string, unknown>) {
    if (!detail || detail.organization.id !== selected || activeSelection.current !== selected)
      throw new Error("Refresh organization first");
    const r = await fetch(`/api/organizations/${selected}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: crypto.randomUUID(),
        expectedVersion: detail.organization.version,
        command: { action, data },
      }),
    });
    if (!r.ok) {
      const e = await r.json();
      if (r.status === 409) await load();
      throw new Error(e.message ?? "Change failed");
    }
    if (activeSelection.current === selected) {
      await load();
      router.refresh();
    }
  }
  const org = detail?.organization.id === selected ? detail.organization : undefined;
  const canAdmin = selectedOrg?.role === "owner" || selectedOrg?.role === "admin";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Organization management</h1>
        <p className="text-sm text-stone-600">
          Manage outlets, people and access across your organization.
        </p>
      </div>
      {!organizations.length ? (
        <p>
          No organization yet.{" "}
          <a href="/onboarding" className="underline">
            Create your first outlet
          </a>
          .
        </p>
      ) : (
        <label className="block max-w-md text-sm">
          Organization
          <select
            aria-label="Organization"
            className={inputClass}
            value={selected}
            onChange={(e) => {
              if (e.target.value === selected) return;
              activeSelection.current = e.target.value;
              requestGeneration.current++;
              setDetail(null);
              setBilling(null);
              setSelected(e.target.value);
            }}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.role})
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      {detail && org && (
        <>
          <p className="text-sm">
            {org.isActive ? "Active" : "Suspended"} · Version {org.version} · Projection{" "}
            {detail.projection?.version ?? "waiting for worker"}
          </p>
          <div key={selected} className="grid gap-4 lg:grid-cols-2">
            {canAdmin && (
              <>
                {" "}
                <Form
                  title="Organization name"
                  button="Save organization name"
                  disabled={!org.isActive}
                  onSave={(f) => send("organization.rename", { name: String(f.get("name")) })}
                >
                  <Field label="Organization name" name="name" defaultValue={org.name} />
                </Form>
              </>
            )}
            {canAdmin && (
              <>
                {" "}
                <Form
                  title="Existing-account member"
                  button="Save member"
                  disabled={!org.isActive}
                  onSave={(f) =>
                    send("member.save", {
                      email: String(f.get("email")),
                      role: String(f.get("role")),
                      isActive: f.get("active") === "on",
                    })
                  }
                >
                  <Field label="Member email" name="email" type="email" />
                  <label className="block text-sm">
                    Organization role
                    <select name="role" className={inputClass}>
                      <option value="member">Member — scoped outlet access</option>
                      <option value="admin">Admin — organization management</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <input type="checkbox" name="active" defaultChecked /> Membership active
                  </label>
                  <p className="text-xs text-stone-500">
                    The person must already have an account. Saving a member sends no invitation.
                  </p>
                </Form>
              </>
            )}
            {canAdmin && (
              <>
                {" "}
                <Form
                  title="Create outlet"
                  button="Create outlet"
                  disabled={!org.isActive}
                  onSave={(f) =>
                    send("outlet.create", {
                      name: String(f.get("name")),
                      country: String(f.get("country")),
                      currency: String(f.get("currency")),
                      timezone: String(f.get("timezone")),
                      outletType: String(f.get("outletType")),
                      fulfillmentModes: f.getAll("modes"),
                    })
                  }
                >
                  <OutletFields />
                </Form>
              </>
            )}
            <Form
              title="Outlet roles"
              button="Save outlet roles"
              disabled={!org.isActive}
              onSave={(f) =>
                send("outlet.roles", {
                  outletId: String(f.get("outletId")),
                  memberId: String(f.get("memberId")),
                  roles: f.getAll("roles"),
                })
              }
            >
              <label className="block text-sm">
                Outlet
                <select aria-label="Outlet" name="outletId" className={inputClass}>
                  {detail.outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Member
                <select aria-label="Member" name="memberId" className={inputClass}>
                  {detail.members
                    .filter((m) => m.role === "member" && m.isActive)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-3">
                {["manager", "service", "kitchen", "menu_editor"].map((r) => (
                  <label key={r} className="text-sm">
                    <input type="checkbox" name="roles" value={r} /> {r}
                  </label>
                ))}
              </div>
              <p className="text-xs">
                This replaces the member’s roles at the selected outlet. Clear all roles to revoke
                that outlet.
              </p>
            </Form>
            {canAdmin && (
              <>
                {" "}
                <Form
                  title="Create brand"
                  button="Create brand"
                  disabled={!org.isActive}
                  onSave={(f) => send("brand.create", { name: String(f.get("name")) })}
                >
                  <Field label="Brand name" name="name" />
                </Form>
              </>
            )}
            {canAdmin && (
              <>
                {" "}
                <Form
                  title="Brand outlets"
                  button="Save brand link"
                  disabled={!org.isActive}
                  onSave={(f) =>
                    send("brand.link", {
                      brandId: String(f.get("brandId")),
                      outletId: String(f.get("outletId")),
                      linked: f.get("linked") === "on",
                    })
                  }
                >
                  <label className="block text-sm">
                    Brand
                    <select name="brandId" className={inputClass}>
                      {detail.brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Outlet
                    <select aria-label="Outlet" name="outletId" className={inputClass}>
                      {detail.outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <input type="checkbox" name="linked" defaultChecked /> Link brand to outlet
                  </label>
                  <p className="text-xs">
                    {detail.links.length} links across {detail.brands.length} brands.
                  </p>
                </Form>
              </>
            )}
            {detail.outlets.map((outlet) => (
              <Form
                key={outlet.id}
                title={`Settings: ${outlet.name}`}
                button="Save outlet settings"
                disabled={!org.isActive}
                onSave={(f) =>
                  send("outlet.update", {
                    outletId: outlet.id,
                    name: String(f.get("name")),
                    country: String(f.get("country")),
                    currency: String(f.get("currency")),
                    timezone: String(f.get("timezone")),
                    outletType: String(f.get("outletType")),
                    fulfillmentModes: f.getAll("modes"),
                  })
                }
              >
                <OutletFields outlet={outlet} />
                <p className="text-xs">
                  Changing currency with existing prices or orders requires a repricing workflow.
                </p>
              </Form>
            ))}
            {selectedOrg?.role === "owner" && (
              <>
                <Form
                  title="Organization status"
                  button={org.isActive ? "Suspend organization" : "Reactivate organization"}
                  onSave={() => send("organization.active", { isActive: !org.isActive })}
                >
                  <p className="text-sm">
                    Suspension disables private access and public menus for all outlets.
                  </p>
                  <label className="text-sm">
                    <input type="checkbox" required /> Confirm organization status change
                  </label>
                </Form>
                <Form
                  title="Transfer ownership"
                  button="Transfer ownership"
                  disabled={!org.isActive}
                  onSave={(f) =>
                    send("owner.transfer", { memberId: String(f.get("memberId")) }).then(() =>
                      window.location.reload()
                    )
                  }
                >
                  <label className="block text-sm">
                    New owner
                    <select aria-label="Member" name="memberId" required className={inputClass}>
                      {detail.members
                        .filter((m) => m.role !== "owner" && m.isActive)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.email})
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <input type="checkbox" required /> I will become a member and lose owner access
                  </label>
                </Form>
              </>
            )}
          </div>
          <section className="rounded-xl border bg-white p-4">
            <h2 className="font-bold">People and outlet grants</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {detail.members.map((m) => (
                <li key={m.id}>
                  {m.name} · {m.email} · {m.role} · {m.isActive ? "active" : "revoked"}
                  <ul>
                    {detail.grants
                      .filter((g) => g.memberId === m.id)
                      .map((g) => (
                        <li key={g.outletId} className="text-stone-500">
                          {detail.outlets.find((o) => o.id === g.outletId)?.name}:{" "}
                          {g.roles.join(", ")}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
          {billing && (
            <section className="rounded-xl border bg-white p-4">
              <h2 className="font-bold">Billing entitlements</h2>
              <p className="text-sm">
                Public QR menus: free · New ordering:{" "}
                {billing.ordering ? "enabled" : "no active grant"} · New kitchen work:{" "}
                {billing.kitchen ? "enabled" : "no active grant"}
              </p>
              <p className="mt-2 text-sm text-stone-500">
                Commercial plans and checkout are not available yet. Entitlement grants use USD or
                INR billing independently of outlet currency.
              </p>
              <ul className="text-sm">
                {billing.grants.map((g) => (
                  <li key={g.id}>
                    {g.capability} · {g.billingCurrency} · ends {g.endsAt}{" "}
                    {g.revokedAt ? "· revoked" : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Background delivery</h2>
              <button className="text-sm underline" onClick={() => void load()}>
                Refresh status
              </button>
            </div>
            <p className="text-xs">
              Recent 30 events. Pending and dispatched events recover automatically; failed events
              require review.
            </p>
            <ul className="space-y-2 text-sm">
              {detail.jobs.map((j) => (
                <li key={j.id} className="break-all">
                  {j.id.slice(0, 8)} · {j.status} · attempts {j.attempts}{" "}
                  {j.lastError && `· ${j.lastError}`}{" "}
                  {j.status === "failed" && (
                    <button
                      className="ml-2 underline"
                      onClick={async () => {
                        const r = await fetch(`/api/organizations/${selected}/jobs`, {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ eventId: j.id }),
                        });
                        if (!r.ok) setError((await r.json()).message);
                        await load();
                      }}
                    >
                      Retry failed event
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="font-bold">Recent activity</h2>
            <ul className="text-sm">
              {detail.audit.map((a) => (
                <li key={a.id}>
                  {a.action} · {new Date(a.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
function OutletFields({ outlet }: { outlet?: Detail["outlets"][number] }) {
  const [type, setType] = useState(outlet?.outletType ?? "restaurant");
  const [modes, setModes] = useState(outlet?.fulfillmentModes ?? ["dine_in"]);
  return (
    <>
      <Field label="Outlet name" name="name" defaultValue={outlet?.name} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Country code" name="country" defaultValue={outlet?.country ?? "IN"} />
        <Field label="Currency" name="currency" defaultValue={outlet?.currency ?? "INR"} />
      </div>
      <Field label="Timezone" name="timezone" defaultValue={outlet?.timezone ?? "Asia/Kolkata"} />
      <label className="block text-sm">
        Outlet type
        <select
          name="outletType"
          className={inputClass}
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setModes(
              ["cafe", "takeout", "cloud_kitchen"].includes(e.target.value)
                ? ["pickup"]
                : ["dine_in"]
            );
          }}
        >
          {["restaurant", "cafe", "takeout", "cloud_kitchen", "hotel", "mixed"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-3">
        {["dine_in", "pickup"].map((m) => (
          <label key={m} className="text-sm">
            <input
              type="checkbox"
              name="modes"
              value={m}
              checked={modes.includes(m)}
              disabled={m === "dine_in" && ["takeout", "cloud_kitchen"].includes(type)}
              onChange={(e) =>
                setModes(e.target.checked ? [...modes, m] : modes.filter((value) => value !== m))
              }
            />{" "}
            {m === "dine_in" ? "Dine-in" : "Pickup"}
          </label>
        ))}
      </div>
    </>
  );
}
