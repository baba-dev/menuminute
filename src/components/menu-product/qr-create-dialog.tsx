"use client";

import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, Copy, MapPin,
  Plus, Printer, QrCode, ShieldCheck, X,
} from "lucide-react";
import type { QR } from "./qr-studio-types";
import { qrDestination } from "./qr-studio-types";
import styles from "./qr-create-dialog.module.css";

type Purpose = "menu" | "point";

export function QrCreateDialog({
  open, onOpenChange, outletName, origin, busy, error, created,
  existingLabels, onCreate, onReset, onLibrary, onPrint,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  outletName: string;
  origin: string;
  busy: boolean;
  error: string;
  created: QR | null;
  existingLabels: string[];
  onCreate: (label: string, pointLabel?: string) => void;
  onReset: () => void;
  onLibrary: () => void;
  onPrint: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [purpose, setPurpose] = useState<Purpose>("menu");
  const [label, setLabel] = useState("");
  const [pointLabel, setPointLabel] = useState("");
  const [copyError, setCopyError] = useState("");
  useEffect(() => {
    if (open) {
      setStep(1);
      setPurpose("menu");
      setLabel("");
      setPointLabel("");
      setCopyError("");
    }
  }, [open]);

  const cleanLabel = label.trim();
  const cleanPoint = pointLabel.trim();
  const valid = Boolean(cleanLabel && (purpose === "menu" || cleanPoint));
  const duplicate = existingLabels.some((value) => value.toLowerCase() === cleanLabel.toLowerCase());
  const createdUrl = created ? qrDestination(origin, created.destinationToken) : "";

  function startAgain() {
    onReset();
    setStep(1);
    setPurpose("menu");
    setLabel("");
    setPointLabel("");
    setCopyError("");
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.dialog}
          aria-describedby="qr-create-description"
          onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}
        >
          <div className={styles.header}>
            <div>
              <span className={styles.eyebrow}>MENUMINUTE / THE CONNECTION ATELIER</span>
              <Dialog.Title className={styles.title}>
                {created ? "Your connection is ready." : "Create a permanent QR"}
              </Dialog.Title>
              <Dialog.Description id="qr-create-description" className={styles.description}>
                {created
                  ? "Your new code was confirmed by the server and added to your QR library."
                  : "An enduring connection from your restaurant to your guests."}
              </Dialog.Description>
            </div>
            <Dialog.Close className={styles.close} disabled={busy} aria-label="Close QR creator">
              <X size={20} />
            </Dialog.Close>
          </div>

          {created ? (
            <div className={styles.success}>
              <div className={styles.successArt}>
                <Image
                  src="/brand/qr-studio/tabletop-press/qr-creation-celebration.webp"
                  width={230} height={165} alt=""
                />
                <span className={styles.successPill}><CheckCircle2 size={15} /> Verified creation</span>
              </div>
              <div className={styles.successDetails}>
                <span className={styles.eyebrow}>YOUR PERMANENT DESTINATION</span>
                <h3>{created.label ?? cleanLabel}</h3>
                <p>{outletName}{created.pointLabel ? " · " + created.pointLabel : ""}</p>
                <div className={styles.realQr}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={"/api/qr/" + encodeURIComponent(created.id) + "/download?format=svg&inline=1"}
                    width={150} height={150} alt="Authenticated newly created QR code"
                  />
                </div>
                <p className={styles.destination}>{createdUrl}</p>
                <button type="button" className={styles.copy} onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(createdUrl);
                    setCopyError("");
                  } catch { setCopyError("Copy unavailable. Select the visible URL instead."); }
                }}>
                  <Copy size={15} /> Copy destination
                </button>
                {copyError && <p role="alert">{copyError}</p>}
              </div>
            </div>
          ) : (
            <>
              <div className={styles.progress} aria-label="Creation progress">
                <span aria-current={step === 1 ? "step" : undefined} data-active={step === 1}>
                  <strong>01</strong> Configure
                </span>
                <span className={styles.progressLine} aria-hidden="true" />
                <span aria-current={step === 2 ? "step" : undefined} data-active={step === 2}>
                  <strong>02</strong> Review
                </span>
                <span className={styles.progressLine} aria-hidden="true" />
                <span><strong>03</strong> Ready</span>
              </div>
              {step === 1 ? (
                <form id="qr-create-wizard-form" className={styles.form} onSubmit={(event) => {
                  event.preventDefault();
                  if (valid) setStep(2);
                }}>
                  <fieldset className={styles.purpose}>
                    <legend>Where will guests find this code?</legend>
                    <div className={styles.purposeChoices}>
                      <button type="button" aria-pressed={purpose === "menu"} onClick={() => setPurpose("menu")}>
                        <QrCode size={24} />
                        <strong>General menu</strong>
                        <small>Menus, counters and takeaway cards.</small>
                      </button>
                      <button type="button" aria-pressed={purpose === "point"} onClick={() => setPurpose("point")}>
                        <MapPin size={24} />
                        <strong>Table or counter</strong>
                        <small>A labeled location within this outlet.</small>
                      </button>
                    </div>
                  </fieldset>
                  <label className={styles.field}>
                    <span>QR label <span title="Internal name shown in your library, not a new public destination."><CircleHelp size={15} aria-label="Used to identify this code in your library" /></span></span>
                    <input autoFocus required maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Front Counter Menu" />
                  </label>
                  {purpose === "point" && (
                    <label className={styles.field}>
                      <span>Table / counter label <span title="This describes the physical service point. It does not enable ordering or prove physical presence."><CircleHelp size={15} aria-label="Service point is informational, not ordering authorization" /></span></span>
                      <input required maxLength={80} value={pointLabel} onChange={(event) => setPointLabel(event.target.value)} placeholder="Table 4" />
                    </label>
                  )}
                  {duplicate && <p className={styles.notice}>A QR with this label already exists. Choose a descriptive label to distinguish printed copies.</p>}
                  <p className={styles.hint}><ShieldCheck size={16} /> QR destinations remain valid when you update dishes. Service-point labels do not enable ordering.</p>
                </form>
              ) : (
                <div className={styles.review}>
                  <div className={styles.reviewSummary}>
                    <div className={styles.mockQr}><QrCode size={56} strokeWidth={1.3} aria-hidden="true" /></div>
                    <div>
                      <span className={styles.eyebrow}>REVIEW YOUR NEW CONNECTION</span>
                      <h3>{cleanLabel}</h3>
                      <p>{outletName}</p>
                      <p>{purpose === "point" ? "Service point · " + cleanPoint : "General menu destination"}</p>
                      <small>The actual scannable QR is issued only after creation.</small>
                    </div>
                  </div>
                  <p className={styles.hint}><ShieldCheck size={16} /> Creating this code will not revoke or change any existing printed code.</p>
                </div>
              )}
              {error && <p className={styles.error} role="alert">{error}</p>}
            </>
          )}
          <div className={styles.footer}>
            {created ? (
              <>
                <button type="button" className={styles.secondary} onClick={startAgain}><Plus size={16} /> Create another</button>
                <button type="button" className={styles.secondary} onClick={onLibrary}>View in library</button>
                <button type="button" className={styles.primary} onClick={onPrint}><Printer size={16} /> Design & Print</button>
              </>
            ) : step === 1 ? (
              <>
                <button type="button" className={styles.secondary} onClick={() => onOpenChange(false)}>Cancel</button>
                <button type="submit" form="qr-create-wizard-form" className={styles.primary} disabled={!valid}>
                  Review QR <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button type="button" className={styles.secondary} disabled={busy} onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</button>
                <button type="button" className={styles.primary} disabled={!valid || busy} onClick={() => {
                  if (valid) onCreate(cleanLabel, purpose === "point" ? cleanPoint : undefined);
                }}>
                  {busy ? "Creating…" : "Create QR code"} <Plus size={16} />
                </button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
