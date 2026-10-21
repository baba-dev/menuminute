"use client";
import { ImagePlus } from "lucide-react";
import { displayToMinor } from "@/lib/money";
import type { MenuDocument } from "@/modules/menu-product/contracts";
import type { menuDetail } from "@/modules/menu-product/service";

type Detail = Awaited<ReturnType<typeof menuDetail>>;
type Media = { id: string; status: string; approvedAt: string | null; lastError: string | null };
type Run = (work: () => Promise<void>) => void;
type Command = (action: string, data?: Record<string, unknown>) => Promise<unknown>;

/** Private photo lifecycle: processing and approval never publish a menu automatically. */
export function StudioMediaTab({
  media, outletId, busy, run, json, refreshMedia, setMessage
}: {
  media:Media[]; outletId:string; busy:boolean; run:Run;
  json:(url:string,options?:RequestInit)=>Promise<unknown>;
  refreshMedia:()=>Promise<void>; setMessage:(text:string)=>void;
}) {
  const headers = { "content-type": "application/json", "x-outlet-id": outletId };
  return (
<section className="panel stack">
                      <h2>Dish photography</h2>
                      <p>
                        Upload your own JPEG, PNG or WebP (up to 5 MiB / 10 megapixels). Photos stay
                        private until processed, approved and published.
                      </p>
                      <form
                        className="stack"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          const file = f.get("photo");
                          void run(async () => {
                            if (!(file instanceof File) || !file.size) {
                              throw new Error("Choose a JPEG, PNG or WebP photograph.");
                            }
                            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                              throw new Error("Use a JPEG, PNG or WebP photograph.");
                            }
                            if (file.size > 5 * 1024 * 1024) {
                              throw new Error("Photo exceeds 5 MiB. Choose a smaller file.");
                            }
                            await json("/api/media", {
                              method: "POST",
                              headers: {
                                "x-outlet-id": outletId,
                                "content-type": file.type,
                                "x-media-rights": encodeURIComponent(String(f.get("rights"))),
                              },
                              body: file,
                            });
                            await refreshMedia();
                            setMessage(
                              "Photo queued privately. Refresh after processing to review it."
                            );
                          });
                        }}
                      >
                        <label className="field">
                          Dish photograph
                          <input
                            type="file"
                            name="photo"
                            accept="image/jpeg,image/png,image/webp"
                            required
                          />
                        </label>
                        <label className="field">
                          Rights or source confirmation
                          <input
                            name="rights"
                            placeholder="I own this restaurant photograph"
                            minLength={5}
                            maxLength={500}
                            required
                          />
                        </label>
                        <button className="ember" disabled={busy}>
                          <ImagePlus size={16} />
                          Upload photo
                        </button>
                      </form>
                      <button type="button" onClick={() => void run(refreshMedia)}>
                        Refresh photo status
                      </button>
                      {media.map((a) => (
                        <div key={a.id} className="panel stack">
                          <strong>
                            {a.status === "ready"
                              ? "Ready for review"
                              : a.status === "failed"
                                ? "Photo processing failed"
                                : "Processing photo"}
                          </strong>

                          <p>
                            {a.approvedAt
                              ? "Approved for selection in Menu Studio. Publish the draft to update the guest view."
                              : a.status === "ready"
                                ? "Private preview only. Approval does not publish your menu."
                                : "The existing guest menu and photographs are unchanged."}
                          </p>
                          {a.lastError && <p role="status">{a.lastError}</p>}
                          {a.status === "ready" && (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/media/${a.id}`}
                                alt="Uploaded dish preview"
                                width={240}
                                height={180}
                                style={{ objectFit: "contain" }}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  void run(async () => {
                                    await json(`/api/media/${a.id}`, {
                                      method: "PATCH",
                                      headers,
                                      body: JSON.stringify({
                                        action: a.approvedAt ? "unapprove" : "approve",
                                      }),
                                    });
                                    await refreshMedia();
                                    setMessage(
                                      a.approvedAt
                                        ? "Photo approval removed"
                                        : "Photo approved. Choose it in a dish’s photo selector, then publish."
                                    );
                                  })
                                }
                              >
                                {a.approvedAt ? "Remove approval" : "Approve photo"}
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </section>
  );
}

/** Shared menu assignment and outlet-local overrides keep the existing command API. */
export function StudioAssignmentsTab({
  doc, detail, outletId, outletChoices, brandChoices, busy, run, command, load, setMessage
}: {
  doc:MenuDocument; detail:Detail; outletId:string;
  outletChoices:{id:string;name:string;currency:string}[];
  brandChoices:{id:string;name:string}[];
  busy:boolean; run:Run; command:Command;
  load:(id:string)=>Promise<void>; setMessage:(text:string)=>void;
}) {
  return (
<section className="panel stack">
                      <h2>Shared outlets & local changes</h2>
                      <p>
                        Assign this menu to another outlet with the same currency. Brand assignments
                        must use an existing brand–outlet link. You need editing permission at all
                        shared outlets.
                      </p>
                      <form
                        className="stack"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void run(async () => {
                            await command("assign", {
                              outletId: f.get("outletId"),
                              brandId: f.get("brandId") || null,
                              assigned: f.get("assigned") === "on",
                            });
                            await load(detail.id);
                            setMessage("Menu assignment saved");
                          });
                        }}
                      >
                        <label className="field">
                          Outlet
                          <select name="outletId" required>
                            {outletChoices.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name} ({o.currency})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          Brand (optional)
                          <select name="brandId">
                            <option value="">No brand</option>
                            {brandChoices.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <input type="checkbox" name="assigned" defaultChecked />
                          Assigned to this outlet
                        </label>
                        <button type="submit" disabled={busy || !detail.canWrite}>
                          Save assignment
                        </button>
                      </form>
                      <ul>
                        {detail.assignments.map((a) => (
                          <li
                            key={
                              outletChoices.find((o) => o.id === a.outletId)?.name ??
                              "Assigned outlet"
                            }
                          >
                            {outletChoices.find((o) => o.id === a.outletId)?.name ??
                              "Assigned outlet"}
                            {a.brandId
                              ? ` · ${brandChoices.find((b) => b.id === a.brandId)?.name ?? "Brand"}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                      <h3>Local price / sold-out override</h3>
                      <p>
                        Local prices apply to dishes without variants. For dishes with variants,
                        leave price blank and edit shared variant prices in Dishes. Clear local
                        prices before adding variants.
                      </p>
                      <form
                        className="stack"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void run(async () => {
                            const amount = String(f.get("price"));
                            await command("override", {
                              outletId: outletId,
                              dishId: f.get("dishId"),
                              priceMinor: amount ? displayToMinor(amount, doc.currency) : null,
                              soldOut:
                                f.get("availability") === "inherit"
                                  ? null
                                  : f.get("availability") === "soldout",
                            });
                            await load(detail.id);
                            setMessage("Local override saved");
                          });
                        }}
                      >
                        <label className="field">
                          Dish
                          <select name="dishId">
                            {doc.categories.flatMap((c) =>
                              c.items.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name}
                                </option>
                              ))
                            )}
                          </select>
                        </label>
                        <label className="field">
                          Local price ({doc.currency}; blank inherits)
                          <input name="price" inputMode="decimal" />
                        </label>
                        <label className="field">
                          Local availability
                          <select name="availability">
                            <option value="inherit">Inherit menu</option>
                            <option value="soldout">Sold out</option>
                            <option value="available">Available</option>
                          </select>
                        </label>
                        <button disabled={busy}>Save local override</button>
                      </form>
                      <div className="row">
                        {(["unpublish", "archive", "restore"] as const).map((action) => (
                          <button
                            type="button"
                            key={action}
                            disabled={busy || !detail.canWrite}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `${action} this menu? Printed QR links are retained.`
                                )
                              )
                                void run(async () => {
                                  await command(action);
                                  await load(detail.id);
                                  setMessage(`Menu ${action} completed`);
                                });
                            }}
                          >
                            {action[0]!.toUpperCase() + action.slice(1)} menu
                          </button>
                        ))}
                      </div>
                    </section>
  );
}
