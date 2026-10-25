"use client";
import Link from "next/link";
import { InvitationManager } from "@/components/auth/invitation-manager";
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
const inputClass = "oh-control";
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
    <label className="oh-field">
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
      className="oh-form"
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
      <h2 className="oh-subtitle">{title}</h2>
      <fieldset disabled={busy || disabled} className="oh-form-fields">
        {children}
        <button className="oh-primary oh-submit">{busy ? "Saving…" : button}</button>
      </fieldset>
      <p role="status" className="oh-small">
        {message}
      </p>
    </form>
  );
}

function RoleGrantEditor({
  detail,
  disabled,
  send,
}: {
  detail: Detail;
  disabled: boolean;
  send: (action: string, data: Record<string, unknown>) => Promise<void>;
}) {
  const eligible = detail.members.filter((member) => member.role === "member" && member.isActive);
  const [outletId, setOutletId] = useState(detail.outlets[0]?.id ?? "");
  const [memberId, setMemberId] = useState(eligible[0]?.id ?? "");
  const assignedRoles =
    detail.grants.find((grant) => grant.outletId === outletId && grant.memberId === memberId)
      ?.roles ?? [];
  const [roles, setRoles] = useState<string[]>(assignedRoles);
  useEffect(() => {
    setRoles(assignedRoles);
    // Reconcile with actual roles on pair change and server-authoritative refresh.
  }, [outletId, memberId, detail.grants]);
  return (
    <Form
      title="Outlet roles"
      button="Save outlet roles"
      disabled={disabled || !outletId || !memberId}
      onSave={(data) =>
        send("outlet.roles", {
          outletId: String(data.get("outletId")),
          memberId: String(data.get("memberId")),
          roles: data.getAll("roles"),
        })
      }
    >
      <div className="oh-two">
        <label className="oh-field">
          Outlet
          <select
            aria-label="Outlet"
            name="outletId"
            className="oh-control"
            value={outletId}
            onChange={(event) => setOutletId(event.target.value)}
          >
            {detail.outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>
        </label>
        <label className="oh-field">
          Member
          <select
            aria-label="Member"
            name="memberId"
            className="oh-control"
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
          >
            {eligible.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name} ({member.email})
              </option>
            ))}
          </select>
        </label>
      </div>
      {(!detail.outlets.length || !eligible.length) && (
        <p className="oh-hint">
          An active member and outlet are both required before assigning roles.
        </p>
      )}
      <div className="oh-role-grid">
        {(["manager", "service", "kitchen", "menu_editor"] as const).map((role) => (
          <label key={role} className="oh-role-choice">
            <input
              type="checkbox"
              aria-label={role}
              name="roles"
              value={role}
              checked={roles.includes(role)}
              onChange={(event) =>
                setRoles((old) =>
                  event.target.checked ? [...old, role] : old.filter((entry) => entry !== role)
                )
              }
            />
            <span>
              <strong>{role.replaceAll("_", " ")}</strong>
              <small>
                {role === "manager"
                  ? "Outlet administration"
                  : role === "service"
                    ? "Guest service and orders"
                    : role === "kitchen"
                      ? "Kitchen work"
                      : "Menu editing"}
              </small>
            </span>
          </label>
        ))}
      </div>
      {roles.length === 0 && (
        <label className="oh-hint">
          <input type="checkbox" required aria-label="Confirm clearing outlet roles" />
          Clear all roles to revoke this person's outlet access. Confirm before saving.
        </label>
      )}
      <p className="oh-hint">This replaces the member's entire role set for the selected outlet.</p>
    </Form>
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
    <div className="mm-organization" data-testid="hospitality-house">
      <header className="oh-hero">
        <div className="oh-hero-copy">
          <span className="oh-kicker">THE HOSPITALITY HOUSE / ORGANIZATION</span>
          <h2 className="oh-hero-meta">Organization management</h2>
          <h1>
            Everything under
            <br />
            one roof.
          </h1>
          <p>
            One beautiful home for your restaurants, people and brands. Every important decision,
            thoughtfully organized.
          </p>
          <div className="oh-hero-buttons">
            <a href="#outlets" className="oh-primary">
              Explore your outlets →
            </a>
            <a className="oh-secondary" href="#people">
              Meet your team ↗
            </a>
          </div>
        </div>
      </header>
      <div className="oh-body">
        {!organizations.length ? (
          <section className="oh-empty">
            <h2>Your hospitality house begins here.</h2>
            <p>
              Complete <Link href="/onboarding">onboarding</Link> to create your first outlet.
            </p>
          </section>
        ) : (
          <div className="oh-context">
            <label className="oh-field">
              <span>Organization</span>
              <select
                aria-label="Organization"
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
            <small>Changes here do not switch your active working restaurant.</small>
          </div>
        )}
        {error && (
          <div className="oh-error" role="alert">
            {error}{" "}
            <button type="button" onClick={() => void load()}>
              Retry
            </button>
          </div>
        )}
        {!detail && organizations.length > 0 && !error && (
          <div className="oh-empty" role="status">
            Loading your organization workspace…
          </div>
        )}
        {detail && org && (
          <>
            <div className="oh-pulse" aria-label="Organization overview">
              <div>
                <span>RESTAURANTS</span>
                <strong>{detail.outlets.length}</strong>
                <small>Outlets in your house</small>
              </div>
              <div>
                <span>TEAM</span>
                <strong>{detail.members.filter((m) => m.isActive).length}</strong>
                <small>Active members</small>
              </div>
              <div>
                <span>BRANDS</span>
                <strong>{detail.brands.length}</strong>
                <small>Shared identities</small>
              </div>
              <div>
                <span>HOUSE STATUS</span>
                <strong>{org.isActive ? "Active" : "Suspended"}</strong>
                <small>
                  {selectedOrg?.role} · Version {org.version}
                </small>
              </div>
            </div>
            <div className="oh-layout">
              <nav className="oh-nav" aria-label="Organization sections">
                <span className="oh-kicker">EXPLORE YOUR HOUSE</span>
                <a href="#overview">
                  01 <span>Overview</span>
                </a>
                <a href="#outlets">
                  02 <span>Outlet collection</span>
                </a>
                <a href="#people">
                  03 <span>Team hall</span>
                </a>
                <a href="#brands">
                  04 <span>Brand gallery</span>
                </a>
                <a href="#capabilities">
                  05 <span>Capabilities</span>
                </a>
                <a href="#activity">
                  06 <span>Activity & delivery</span>
                </a>
                <a href="#governance">
                  07 <span>Owner's office</span>
                </a>
                <p>
                  Company-wide identity, people and permissions are managed separately from your
                  working outlet.
                </p>
              </nav>
              <div className="oh-sections">
                <section id="overview" className="oh-panel" aria-label="THE HOUSE">
                  <header className="oh-panel-heading">
                    <div>
                      <span className="oh-kicker">01 / THE HOUSE</span>
                      <h2>Your organization, beautifully managed.</h2>
                      <p>Start with your business identity, then explore the spaces below.</p>
                    </div>
                    <div aria-hidden="true" className="oh-art oh-art-outlet-collection" />
                  </header>
                  <div className="oh-panel-content">
                    {" "}
                    {canAdmin && (
                      <>
                        {" "}
                        <Form
                          title="Organization name"
                          button="Save organization name"
                          disabled={!org.isActive}
                          onSave={(f) =>
                            send("organization.rename", { name: String(f.get("name")) })
                          }
                        >
                          <Field label="Organization name" name="name" defaultValue={org.name} />
                        </Form>
                      </>
                    )}
                  </div>
                </section>
                <section id="outlets" className="oh-panel" aria-label="THE OUTLET COLLECTION">
                  <header className="oh-panel-heading">
                    <div>
                      <span className="oh-kicker">02 / THE OUTLET COLLECTION</span>
                      <h2>Every restaurant. One home.</h2>
                      <p>
                        Explore your outlets and edit their operational identity without leaving
                        this workspace.
                      </p>
                    </div>
                    <div aria-hidden="true" className="oh-art oh-art-outlet-collection" />
                  </header>
                  <div className="oh-panel-content">
                    <div className="oh-tiles" aria-label="Outlet directory">
                      {detail.outlets.map((o) => (
                        <article key={o.id} className="oh-tile">
                          <span className="oh-tile-icon">⌂</span>
                          <h3>{o.name}</h3>
                          <p>
                            {o.outletType.replaceAll("_", " ")} · {o.currency} · {o.country}
                          </p>
                          <small>{o.timezone}</small>
                        </article>
                      ))}
                    </div>{" "}
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
                        <p className="oh-hint">
                          Changing currency with existing prices or orders requires a repricing
                          workflow.
                        </p>
                      </Form>
                    ))}
                  </div>
                </section>
                <section id="people" className="oh-panel" aria-label="THE TEAM HALL">
                  <header className="oh-panel-heading">
                    <div>
                      <span className="oh-kicker">03 / THE TEAM HALL</span>
                      <h2>Great service is teamwork.</h2>
                      <p>
                        People, invitations and outlet-specific permissions, in one clear workspace.
                      </p>
                    </div>
                    <div aria-hidden="true" className="oh-art oh-art-team-hall" />
                  </header>
                  <div className="oh-panel-content">
                    {" "}
                    {canAdmin && org.isActive && <InvitationManager organizationId={org.id} />}
                    <RoleGrantEditor
                      key={selected}
                      detail={detail}
                      disabled={!org.isActive}
                      send={send}
                    />
                    <section className="oh-inset">
                      <h2 className="oh-subtitle">People and outlet grants</h2>
                      <ul className="mt-2 space-y-2 text-sm">
                        {detail.members.map((m) => (
                          <li key={m.id}>
                            {m.name} · {m.email} · {m.role} · {m.isActive ? "active" : "revoked"}
                            <ul>
                              {detail.grants
                                .filter((g) => g.memberId === m.id)
                                .map((g) => (
                                  <li key={g.outletId} className="oh-muted">
                                    {detail.outlets.find((o) => o.id === g.outletId)?.name}:{" "}
                                    {g.roles.join(", ")}
                                  </li>
                                ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                </section>
                <section id="brands" className="oh-panel" aria-label="THE BRAND GALLERY">
                  <header className="oh-panel-heading">
                    <div>
                      <span className="oh-kicker">04 / THE BRAND GALLERY</span>
                      <h2>Distinct names. One family.</h2>
                      <p>Manage brand identities and link them to your outlets.</p>
                    </div>
                    <div aria-hidden="true" className="oh-art oh-art-brand-gallery" />
                  </header>
                  <div className="oh-panel-content">
                    <div className="oh-tiles" aria-label="Brand directory">
                      {detail.brands.map((b) => (
                        <article key={b.id} className="oh-tile">
                          <span className="oh-tile-icon">✦</span>
                          <h3>{b.name}</h3>
                          <p>
                            {detail.links.filter((l) => l.brandId === b.id).length} connected
                            outlets
                          </p>
                        </article>
                      ))}
                    </div>{" "}
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
                          <label className="oh-field">
                            Brand
                            <select name="brandId" className={inputClass}>
                              {detail.brands.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="oh-field">
                            Outlet
                            <select aria-label="Outlet" name="outletId" className={inputClass}>
                              {detail.outlets.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="oh-small">
                            <input type="checkbox" name="linked" defaultChecked /> Link brand to
                            outlet
                          </label>
                          <p className="oh-hint">
                            {detail.links.length} links across {detail.brands.length} brands.
                          </p>
                        </Form>
                      </>
                    )}
                  </div>
                </section>
                <section id="capabilities" className="oh-panel" aria-label="YOUR CAPABILITIES">
                  <header className="oh-panel-heading">
                    <div>
                      <span className="oh-kicker">05 / YOUR CAPABILITIES</span>
                      <h2>Everything your business can do.</h2>
                      <p>Live capability grants, independent of the restaurant menu currency.</p>
                    </div>
                    <div aria-hidden="true" className="oh-art oh-art-capabilities" />
                  </header>
                  <div className="oh-panel-content">
                    {" "}
                    {billing && (
                      <section className="oh-inset">
                        <h2 className="oh-subtitle">Billing entitlements</h2>
                        <p className="text-sm">
                          Public QR menus: free · New ordering:{" "}
                          {billing.ordering ? "enabled" : "no active grant"} · New kitchen work:{" "}
                          {billing.kitchen ? "enabled" : "no active grant"}
                        </p>
                        <p className="oh-hint">
                          Commercial plans and checkout are not available yet. Entitlement grants
                          use USD or INR billing independently of outlet currency.
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
                  </div>
                </section>
                <section id="activity" className="oh-panel" aria-label="ACTIVITY & DELIVERY">
                  <header className="oh-panel-heading">
                    <div>
                      <span className="oh-kicker">06 / ACTIVITY & DELIVERY</span>
                      <h2>Every detail in motion.</h2>
                      <p>Follow recent events and recover failed delivery with confidence.</p>
                    </div>
                    <div aria-hidden="true" className="oh-art oh-art-activity" />
                  </header>
                  <div className="oh-panel-content">
                    {" "}
                    <section>
                      <h2 className="oh-subtitle">Recent activity</h2>
                      <ul className="text-sm">
                        {detail.audit.map((a) => (
                          <li key={a.id}>
                            {a.action} · {new Date(a.createdAt).toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section className="oh-inset">
                      <div className="oh-row-head">
                        <h2 className="oh-subtitle">Background delivery</h2>
                        <button className="text-sm underline" onClick={() => void load()}>
                          Refresh status
                        </button>
                      </div>
                      <p className="text-xs">
                        Recent 30 events. Pending and dispatched events recover automatically;
                        failed events require review.
                      </p>
                      <ul className="oh-event-list">
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
                  </div>
                </section>
                <section id="governance" className="oh-panel" aria-label="THE OWNER'S OFFICE">
                  <header className="oh-panel-heading">
                    <div>
                      <span className="oh-kicker">07 / THE OWNER'S OFFICE</span>
                      <h2>Your house. Protected.</h2>
                      <p>
                        Privileged decisions require deliberate confirmation and server
                        authorization.
                      </p>
                    </div>
                    <div aria-hidden="true" className="oh-art oh-art-owners-office" />
                  </header>
                  <div className="oh-panel-content">
                    {" "}
                    {selectedOrg?.role === "owner" && (
                      <>
                        <Form
                          title="Organization status"
                          button={org.isActive ? "Suspend organization" : "Reactivate organization"}
                          onSave={() => send("organization.active", { isActive: !org.isActive })}
                        >
                          <p className="oh-small">
                            Suspension disables private access and public menus for all outlets.
                          </p>
                          <label className="oh-small">
                            <input type="checkbox" required /> Confirm organization status change
                          </label>
                        </Form>
                        <Form
                          title="Transfer ownership"
                          button="Transfer ownership"
                          disabled={!org.isActive}
                          onSave={(f) =>
                            send("owner.transfer", { memberId: String(f.get("memberId")) }).then(
                              () => window.location.reload()
                            )
                          }
                        >
                          <label className="oh-field">
                            New owner
                            <select
                              aria-label="Member"
                              name="memberId"
                              required
                              className={inputClass}
                            >
                              {detail.members
                                .filter((m) => m.role !== "owner" && m.isActive)
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} ({m.email})
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label className="oh-small">
                            <input type="checkbox" required /> I will become a member and lose owner
                            access
                          </label>
                        </Form>
                      </>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function OutletFields({ outlet }: { outlet?: Detail["outlets"][number] }) {
  const [type, setType] = useState(outlet?.outletType ?? "restaurant");
  const [modes, setModes] = useState(outlet?.fulfillmentModes ?? ["dine_in"]);
  return (
    <>
      <Field label="Outlet name" name="name" defaultValue={outlet?.name} />
      <div className="oh-two">
        <Field label="Country code" name="country" defaultValue={outlet?.country ?? "IN"} />
        <Field label="Currency" name="currency" defaultValue={outlet?.currency ?? "INR"} />
      </div>
      <Field label="Timezone" name="timezone" defaultValue={outlet?.timezone ?? "Asia/Kolkata"} />
      <label className="oh-field">
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
      <div className="oh-options">
        {["dine_in", "pickup"].map((m) => (
          <label key={m} className="oh-small">
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
