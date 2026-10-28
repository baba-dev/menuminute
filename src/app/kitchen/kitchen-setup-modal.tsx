"use client";

import { useMemo, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  CircleCheck,
  CircleHelp,
  Flame,
  LayoutGrid,
  Plus,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { KitchenSnapshot } from "@/modules/kitchen/service";

type Dish = { id: string; name: string };
type Step = "stations" | "people" | "routes" | "review";
type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  outletName: string;
  snapshot: KitchenSnapshot;
  dishes: Dish[];
  onCommand: (action: string, data: Record<string, string>) => Promise<void>;
};

const steps: Array<{ id: Step; title: string; subtitle: string }> = [
  { id: "stations", title: "Stations", subtitle: "Where dishes are prepared" },
  { id: "people", title: "Your team", subtitle: "Who prepares each order" },
  { id: "routes", title: "Dish routing", subtitle: "What goes where" },
  { id: "review", title: "Ready check", subtitle: "Review your kitchen" },
];
const templates = ["Main Kitchen", "Grill", "Tandoor", "Beverages", "Desserts"];

export function kitchenSetupProgress(snapshot: KitchenSnapshot, dishes: Dish[]) {
  const stations = snapshot.stations.filter((station) => station.active);
  const members = snapshot.members.filter((member) => member.eligible === true);
  const staffed = new Set(
    members.flatMap((member) => member.stationIds).filter((id) => stations.some((s) => s.id === id))
  );
  const routes = snapshot.routes.filter((route) => stations.some((s) => s.id === route.stationId));
  const missing = dishes.filter((dish) => !routes.some((route) => route.dishId === dish.id));
  const unstaffed = new Set(
    routes.map((route) => route.stationId).filter((id) => !staffed.has(id))
  );
  const hasStaff = staffed.size > 0;
  return {
    stations: stations.length,
    assigned: members.filter((member) => member.stationIds.some((id) => staffed.has(id))).length,
    missing,
    unstaffed: unstaffed.size,
    complete:
      stations.length > 0 &&
      hasStaff &&
      dishes.length > 0 &&
      missing.length === 0 &&
      unstaffed.size === 0,
  };
}

export function KitchenSetupModal({
  open,
  onOpenChange,
  outletName,
  snapshot,
  dishes,
  onCommand,
}: Props) {
  const [step, setStep] = useState<Step>("stations");
  const [stationName, setStationName] = useState("");
  const [selectedMember, setSelectedMember] = useState("");
  const [staffStation, setStaffStation] = useState("");
  const [routeStation, setRouteStation] = useState("");
  const [selectedDish, setSelectedDish] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [batchDone, setBatchDone] = useState(0);
  const progress = useMemo(() => kitchenSetupProgress(snapshot, dishes), [snapshot, dishes]);
  const station =
    snapshot.stations.find((s) => s.id === staffStation && s.active) ??
    snapshot.stations.find((s) => s.active);
  const target =
    snapshot.stations.find((s) => s.id === routeStation && s.active) ??
    snapshot.stations.find((s) => s.active);
  const eligible = snapshot.members.filter((m) => m.eligible === true);
  const currentIndex = steps.findIndex((item) => item.id === step);
  const passed = [
    progress.stations > 0,
    progress.assigned > 0,
    progress.missing.length === 0 && dishes.length > 0 && progress.unstaffed === 0,
  ];
  const percent = Math.round((passed.filter(Boolean).length / passed.length) * 100);

  async function execute(action: string, data: Record<string, string>) {
    setBusy(true);
    setMessage("");
    try {
      await onCommand(action, data);
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The change was not confirmed. Refresh and retry."
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createStation(e: FormEvent) {
    e.preventDefault();
    if (!stationName.trim()) return;
    if (await execute("station.create", { name: stationName.trim() })) {
      setStationName("");
      setMessage("Station saved. You can create another or continue to your team.");
    }
  }

  async function assignStaff(e: FormEvent) {
    e.preventDefault();
    const memberId = selectedMember || (eligible.length === 1 ? eligible[0]!.id : "");
    if (!station || !memberId) return;
    if (await execute("member.assign", { memberId, stationId: station.id }))
      setMessage("Teammate assigned. Station permissions are enforced by the server.");
  }

  async function routeDish(e: FormEvent) {
    e.preventDefault();
    const dishId = selectedDish || dishes[0]?.id;
    if (!target || !dishId || busy) return;
    if (await execute("route.assign", { dishId, stationId: target.id })) {
      setMessage("Dish route saved. You can route a dish to more than one station.");
    }
  }

  async function removeDishRoute(dishId: string, stationId: string) {
    if (busy) return;
    const ok = await execute("route.remove", { dishId, stationId });
    if (ok) setMessage("Dish route removed. Review readiness before activating.");
  }

  async function removeStaff(memberId: string, stationId: string) {
    if (busy) return;
    const ok = await execute("member.remove", { memberId, stationId });
    if (ok) setMessage("Station assignment removed. Readiness has been recalculated.");
  }

  async function routeAll() {
    if (!target || !progress.missing.length) return;
    setBusy(true);
    setMessage("");
    setBatchDone(0);
    let count = 0;
    try {
      // Each operation remains a separately authorized, committed kitchen command.
      // A failed request stops the batch; committed routes survive and can be retried.
      for (const dish of progress.missing) {
        await onCommand("route.assign", { dishId: dish.id, stationId: target.id });
        count++;
        setBatchDone(count);
      }
      setMessage("Routes saved. Check the readiness review before requesting a pilot.");
    } catch (error) {
      setMessage(
        `${count} routes saved; remaining routes were not confirmed. ${error instanceof Error ? error.message : "Refresh and retry."}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) {
          setMessage("");
          setBatchDone(0);
          setStep("stations");
        }
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="kk-setup-overlay" />
        <Dialog.Content
          className="kk-setup-dialog"
          aria-describedby="kk-setup-description"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="kk-setup-heading">
            <div className="kk-setup-overline">
              <Sparkles size={14} /> MENUMINUTE / KITCHEN ATELIER
            </div>
            <Dialog.Title className="kk-setup-title">Build your kitchen, beautifully.</Dialog.Title>
            <Dialog.Description id="kk-setup-description" className="kk-setup-description">
              Three simple steps to get {outletName} ready for its first ticket. Set up freely;
              Kitchen Pro sales activation remains separately approved.
            </Dialog.Description>
            <div className="kk-setup-spark" aria-hidden="true">
              <ChefHat size={69} strokeWidth={1.2} />
            </div>
            <Dialog.Close
              className="kk-setup-close"
              disabled={busy}
              aria-label="Close kitchen setup"
            >
              <X size={20} />
            </Dialog.Close>
          </div>

          <div className="kk-setup-progress-wrap">
            <div className="kk-setup-progress-label">
              <span>YOUR KITCHEN SETUP</span>
              <strong>{percent}% complete</strong>
            </div>
            <div className="kk-setup-track">
              <span style={{ width: `${percent}%` }} />
            </div>
          </div>
          <div className="kk-setup-layout">
            <nav className="kk-setup-nav" aria-label="Kitchen setup steps">
              {steps.map((item, i) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    if (!busy) {
                      setStep(item.id);
                      setMessage("");
                    }
                  }}
                  aria-current={step === item.id ? "step" : undefined}
                  className={`kk-setup-nav-item ${step === item.id ? "is-current" : ""}`}
                  disabled={busy}
                >
                  <span className="kk-setup-step-icon">
                    {i < 3 && passed[i] ? (
                      <Check size={18} />
                    ) : i === 0 ? (
                      <LayoutGrid size={18} />
                    ) : i === 1 ? (
                      <Users size={18} />
                    ) : i === 2 ? (
                      <Route size={18} />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                </button>
              ))}
              <div className="kk-setup-note">
                <CircleHelp size={18} />
                <span>
                  Already taking orders? Your merchant board continues working. Setup does not
                  switch on kitchen processing.
                </span>
              </div>
            </nav>

            <div className="kk-setup-main">
              {step === "stations" && (
                <section aria-labelledby="kk-stations-title" className="kk-setup-stage">
                  <p className="kk-setup-kicker">01 / ORGANIZE THE PASS</p>
                  <h3 id="kk-stations-title">Where does the magic happen?</h3>
                  <p>
                    Create a preparation station for each working area. Start with one; add more
                    whenever needed.
                  </p>
                  <div className="kk-setup-templates" aria-label="Suggested station names">
                    {templates.map((name) => (
                      <button
                        key={name}
                        type="button"
                        disabled={busy}
                        className={stationName === name ? "is-selected" : ""}
                        onClick={() => setStationName(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={(e) => void createStation(e)} className="kk-setup-fieldgroup">
                    <label htmlFor="kk-new-station">Station name</label>
                    <div className="kk-setup-inline">
                      <input
                        id="kk-new-station"
                        value={stationName}
                        onChange={(e) => setStationName(e.target.value)}
                        minLength={2}
                        maxLength={64}
                        required
                        placeholder="e.g. Main Stove"
                      />
                      <button
                        type="submit"
                        className="kk-setup-action"
                        disabled={busy || stationName.trim().length < 2}
                      >
                        <Plus size={18} /> Add station
                      </button>
                    </div>
                  </form>
                  <div className="kk-setup-collection">
                    <h4>
                      Your stations <span>{progress.stations}</span>
                    </h4>
                    {snapshot.stations
                      .filter((s) => s.active)
                      .map((s) => (
                        <div key={s.id} className="kk-setup-collection-row">
                          <Flame size={18} />
                          <strong>{s.name}</strong>
                          <span>Active</span>
                        </div>
                      ))}
                    {!progress.stations && (
                      <p className="kk-setup-empty">Your first station will appear here.</p>
                    )}
                  </div>
                </section>
              )}
              {step === "people" && (
                <section aria-labelledby="kk-people-title" className="kk-setup-stage">
                  <p className="kk-setup-kicker">02 / PEOPLE AT THE PASS</p>
                  <h3 id="kk-people-title">Bring your team aboard.</h3>
                  <p>
                    Owners and organization admins can operate their own stations. Other members
                    need a kitchen or manager role for this outlet.
                  </p>
                  <form onSubmit={(e) => void assignStaff(e)} className="kk-setup-fieldgroup">
                    <label htmlFor="kk-member-select">Organization member</label>
                    <select
                      id="kk-member-select"
                      required
                      disabled={busy}
                      value={selectedMember || (eligible.length === 1 ? eligible[0]!.id : "")}
                      onChange={(e) => setSelectedMember(e.target.value)}
                    >
                      <option value="">Select a member</option>
                      {snapshot.members.map((member) => (
                        <option key={member.id} value={member.id} disabled={!member.eligible}>
                          {member.name} · {member.role ?? "member"}
                          {member.eligible ? "" : " — outlet kitchen role required"}
                        </option>
                      ))}
                    </select>
                    {eligible.length === 1 && (
                      <div className="kk-setup-tip">
                        <CircleCheck size={16} /> Your only eligible teammate is preselected.
                      </div>
                    )}
                    {!eligible.length && (
                      <div role="alert" className="kk-setup-warning">
                        No member has kitchen permissions. Organization owners and admins are
                        automatically eligible; grant other staff a kitchen or manager outlet role
                        from Team settings.
                      </div>
                    )}
                    <label htmlFor="kk-staff-station">Assign to station</label>
                    <select
                      id="kk-staff-station"
                      value={station?.id ?? ""}
                      disabled={busy}
                      onChange={(e) => setStaffStation(e.target.value)}
                    >
                      <option value="">Choose a station</option>
                      {snapshot.stations
                        .filter((s) => s.active)
                        .map((s) => (
                          <option value={s.id} key={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="submit"
                      className="kk-setup-action"
                      disabled={busy || !station || !eligible.length}
                    >
                      <Users size={18} /> Assign teammate
                    </button>
                  </form>
                  <div className="kk-setup-collection">
                    <h4>
                      Your roster <span>{snapshot.members.length} active members</span>
                    </h4>
                    {snapshot.members.map((m) => (
                      <div className="kk-setup-collection-row" key={m.id}>
                        <span className="kk-setup-avatar">{m.name.slice(0, 1).toUpperCase()}</span>
                        <strong>{m.name}</strong>
                        <div className="kk-setup-memberships">
                          {m.stationIds.length ? (
                            m.stationIds.map((stationId) => (
                              <button
                                type="button"
                                key={stationId}
                                disabled={busy}
                                className="kk-setup-mini-button"
                                onClick={() => void removeStaff(m.id, stationId)}
                                aria-label={`Remove ${m.name} from ${snapshot.stations.find((st) => st.id === stationId)?.name ?? "station"}`}
                              >
                                {snapshot.stations.find((st) => st.id === stationId)?.name ??
                                  "Station"}
                                <X size={13} aria-hidden="true" />
                              </button>
                            ))
                          ) : (
                            <span>{m.eligible ? "Available" : "Needs role"}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {!snapshot.members.length && (
                      <p className="kk-setup-empty">
                        No active organization members were returned.
                      </p>
                    )}
                  </div>
                </section>
              )}
              {step === "routes" && (
                <section aria-labelledby="kk-routes-title" className="kk-setup-stage">
                  <p className="kk-setup-kicker">03 / FROM MENU TO STOVE</p>
                  <h3 id="kk-routes-title">Make every dish find its way.</h3>
                  <p>
                    Assign missing dishes together, or configure individual dish routes for
                    different preparation stations. Changes save immediately.
                  </p>
                  <div className="kk-setup-fieldgroup">
                    <label htmlFor="kk-route-station">Destination station</label>
                    <select
                      id="kk-route-station"
                      value={target?.id ?? ""}
                      disabled={busy}
                      onChange={(e) => setRouteStation(e.target.value)}
                    >
                      <option value="">Select destination</option>
                      {snapshot.stations
                        .filter((s) => s.active)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="kk-setup-action"
                      disabled={busy || !target || !progress.missing.length}
                      onClick={() => void routeAll()}
                    >
                      <Route size={18} />{" "}
                      {busy
                        ? `Saving routes… ${batchDone}/${progress.missing.length}`
                        : `Route ${progress.missing.length} unassigned dish${progress.missing.length === 1 ? "" : "es"}`}
                    </button>
                  </div>
                  <form
                    className="kk-setup-fieldgroup kk-setup-route-individual"
                    onSubmit={(e) => void routeDish(e)}
                  >
                    <h4>Route a specific dish</h4>
                    <label htmlFor="kk-individual-dish">Published dish</label>
                    <select
                      id="kk-individual-dish"
                      value={selectedDish || dishes[0]?.id || ""}
                      onChange={(e) => setSelectedDish(e.target.value)}
                      disabled={busy}
                    >
                      <option value="">Choose a dish</option>
                      {dishes.map((dish) => (
                        <option value={dish.id} key={dish.id}>
                          {dish.name}
                        </option>
                      ))}
                    </select>
                    <p className="kk-setup-field-help">
                      Uses the destination station selected above. A dish may be routed to multiple
                      stations.
                    </p>
                    <button
                      type="submit"
                      className="kk-setup-secondary"
                      disabled={busy || !target || !dishes.length}
                    >
                      <Plus size={16} aria-hidden="true" /> Add dish route
                    </button>
                  </form>
                  <div className="kk-setup-collection kk-setup-dishes">
                    <h4>
                      Published dishes{" "}
                      <span>
                        {dishes.length - progress.missing.length}/{dishes.length} routed
                      </span>
                    </h4>
                    {dishes.map((dish) => {
                      const done = !progress.missing.some((d) => d.id === dish.id);
                      return (
                        <div className="kk-setup-collection-row" key={dish.id}>
                          {done ? (
                            <CircleCheck size={18} className="kk-setup-good" />
                          ) : (
                            <span className="kk-setup-unrouted" />
                          )}
                          <strong>{dish.name}</strong>
                          <div className="kk-setup-route-tags">
                            {snapshot.routes
                              .filter((route) => route.dishId === dish.id)
                              .map((route) => (
                                <button
                                  key={route.stationId}
                                  type="button"
                                  disabled={busy}
                                  className="kk-setup-mini-button"
                                  onClick={() => void removeDishRoute(dish.id, route.stationId)}
                                  aria-label={`Remove ${dish.name} route to ${snapshot.stations.find((st) => st.id === route.stationId)?.name ?? "station"}`}
                                >
                                  {snapshot.stations.find((st) => st.id === route.stationId)
                                    ?.name ?? "Inactive station"}
                                  <X size={13} aria-hidden="true" />
                                </button>
                              ))}
                            {!done && <span>Needs route</span>}
                          </div>
                        </div>
                      );
                    })}
                    {!dishes.length && (
                      <p className="kk-setup-empty">
                        Publish a menu with dishes before configuring routes.
                      </p>
                    )}
                  </div>
                </section>
              )}
              {step === "review" && (
                <section aria-labelledby="kk-review-title" className="kk-setup-stage">
                  <p className="kk-setup-kicker">04 / FINAL CHECK</p>
                  <h3 id="kk-review-title">
                    {progress.complete ? "Your kitchen is configured." : "Almost ready to cook."}
                  </h3>
                  <p>
                    These checks reflect saved station configuration. Activation requires a separate
                    approved Kitchen Pro release and entitlement.
                  </p>
                  <div className="kk-setup-review">
                    {[
                      {
                        name: "Preparation stations",
                        detail: `${progress.stations} active`,
                        ok: progress.stations > 0,
                      },
                      {
                        name: "Assigned kitchen staff",
                        detail: `${progress.assigned} eligible member(s)`,
                        ok: progress.assigned > 0,
                      },
                      {
                        name: "Published dishes",
                        detail: `${dishes.length} dishes`,
                        ok: dishes.length > 0,
                      },
                      {
                        name: "Routes missing",
                        detail: `${progress.missing.length} missing`,
                        ok: progress.missing.length === 0,
                      },
                      {
                        name: "Unstaffed routed stations",
                        detail: `${progress.unstaffed} need attention`,
                        ok: progress.unstaffed === 0,
                      },
                    ].map((row) => (
                      <div key={row.name} className="kk-setup-review-row">
                        {row.ok ? (
                          <CircleCheck size={20} className="kk-setup-good" />
                        ) : (
                          <CircleHelp size={20} className="kk-setup-warn" />
                        )}
                        <strong>{row.name}</strong>
                        <span>{row.detail}</span>
                      </div>
                    ))}
                  </div>
                  <div className="kk-setup-separation">
                    <ShieldCheck size={21} />
                    <span>
                      Setup is not activation. Your existing order board stays authoritative until
                      an approved Kitchen Pro pilot or commercial launch.
                    </span>
                  </div>
                </section>
              )}
              {message && (
                <div className="kk-setup-feedback" role="status">
                  {message}
                </div>
              )}
            </div>
          </div>
          <div className="kk-setup-footer">
            <span>
              <Check size={15} /> Saved directly to your restaurant
            </span>
            <div className="kk-setup-footer-actions">
              {currentIndex > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  className="kk-setup-secondary"
                  onClick={() => {
                    setStep(steps[currentIndex - 1]!.id);
                    setMessage("");
                  }}
                >
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              {currentIndex < steps.length - 1 ? (
                <button
                  type="button"
                  disabled={busy}
                  className="kk-setup-action"
                  onClick={() => {
                    setStep(steps[currentIndex + 1]!.id);
                    setMessage("");
                  }}
                >
                  Continue <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className="kk-setup-action"
                  onClick={() => {
                    setStep("stations");
                    setMessage("");
                    setBatchDone(0);
                    onOpenChange(false);
                  }}
                >
                  {progress.complete ? "Finish setup" : "Close and finish later"}{" "}
                  <Check size={17} />
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
