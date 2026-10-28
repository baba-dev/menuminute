"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2 } from "lucide-react";
import { ChefStickyNote } from "@/components/ui/tactile-elements";
import { WizardMediaSlot, type WizardStepId } from "./wizard-media-slot";
import { StepIdentity } from "./wizard-steps/step-identity";
import { StepLocation } from "./wizard-steps/step-location";
import { StepOperations } from "./wizard-steps/step-operations";
import { StepContactTables } from "./wizard-steps/step-contact-tables";
import { StepLaunch } from "./wizard-steps/step-launch";
import { initialWizardDraft, type WizardDraft } from "./wizard-types";
import { canonicalOutletTimezone } from "@/lib/outlet-timezones";
import { regions } from "@/modules/onboarding/locales";
import { scheduleSchema } from "@/modules/menu-product/contracts";
import "./onboarding-wizard.css";

const STEPS: { id: WizardStepId; label: string; number: number; subtitle: string }[] = [
  {
    id: "identity",
    label: "Identity",
    number: 1,
    subtitle: "Hang the Shingle · Your restaurant identity and branding",
  },
  {
    id: "location",
    label: "Location",
    number: 2,
    subtitle: "The Neighborhood · Your real operating location and local settings",
  },
  {
    id: "operations",
    label: "Operations",
    number: 3,
    subtitle: "Service Style · Choose how guests can order and collect food",
  },
  {
    id: "contact",
    label: "Service Points",
    number: 4,
    subtitle: "Setting the Tables · Configure guest access and service points",
  },
  {
    id: "launch",
    label: "Launch",
    number: 5,
    subtitle: "Opening Night · Review your details before creating the outlet",
  },
];

function validateStep(step: number, draft: WizardDraft): string | null {
  if (step === 0) {
    if (draft.name.trim().length < 2 || draft.name.trim().length > 100)
      return "Enter a restaurant name between 2 and 100 characters.";
    if (draft.description.length > 500) return "The restaurant description is too long.";
    if (![draft.primaryColor, draft.secondaryColor].every((c) => /^#[0-9a-fA-F]{6}$/.test(c)))
      return "Use valid six-digit HEX brand colors.";
  }
  if (step === 1) {
    if (!regions.includes(draft.country)) return "Select a supported outlet country.";
    if ((draft.latitude === null) !== (draft.longitude === null))
      return "Enter both latitude and longitude, or leave both empty.";
    if (
      draft.latitude !== null &&
      (!Number.isFinite(draft.latitude) || draft.latitude < -90 || draft.latitude > 90)
    )
      return "Latitude must be between -90 and 90.";
    if (
      draft.longitude !== null &&
      (!Number.isFinite(draft.longitude) || draft.longitude < -180 || draft.longitude > 180)
    )
      return "Longitude must be between -180 and 180.";
  }
  if (step === 2) {
    if (!draft.fulfillmentModes.length) return "Choose at least one fulfillment mode.";
    if (draft.operatingHours && !scheduleSchema.safeParse(draft.operatingHours).success)
      return "Review your opening hours.";
    if (draft.serviceHours && !scheduleSchema.safeParse(draft.serviceHours).success)
      return "Review your service hours.";
    if (!Intl.supportedValuesOf("currency").includes(draft.currency))
      return "Choose a supported currency.";
    try {
      new Intl.DateTimeFormat("en", { timeZone: canonicalOutletTimezone(draft.timezone) });
    } catch {
      return "Choose a valid operating timezone.";
    }
    if (
      !Number.isInteger(draft.pickupLeadMinutes) ||
      draft.pickupLeadMinutes < 0 ||
      draft.pickupLeadMinutes > 240 ||
      !Number.isInteger(draft.pickupSlotMinutes) ||
      draft.pickupSlotMinutes < 5 ||
      draft.pickupSlotMinutes > 120 ||
      !Number.isInteger(draft.pickupAdvanceDays) ||
      draft.pickupAdvanceDays < 1 ||
      draft.pickupAdvanceDays > 30
    )
      return "Check the pickup scheduling limits.";
  }
  if (step === 3) {
    if (!Number.isInteger(draft.tableCount) || draft.tableCount < 0 || draft.tableCount > 50)
      return "The number of tables must be between 0 and 50.";
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email))
      return "Enter a valid contact email address.";
    if (
      draft.operationsContactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.operationsContactEmail)
    )
      return "Enter a valid internal operations email address.";
    if (draft.website) {
      try {
        if (!["http:", "https:"].includes(new URL(draft.website).protocol))
          return "Use an HTTP or HTTPS website URL.";
      } catch {
        return "Enter a valid website URL.";
      }
    }
  }
  return null;
}

interface OnboardingWizardProps {
  onSuccess?: (outletId: string) => void;
}

export function OnboardingWizard({ onSuccess }: OnboardingWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [draft, setDraft] = useState<WizardDraft>(initialWizardDraft);
  const [ready, setReady] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [inaccessible, setInaccessible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const draftRevision = useRef(0);
  const timezoneTouched = useRef(false);
  const reconciliation = useRef(false);
  const progressStorageKey = useRef("menuminute.first-outlet.step");

  // Reconcile and restore server-owned draft
  const reconcile = useCallback(async () => {
    if (reconciliation.current) return;
    reconciliation.current = true;
    try {
      const res = await fetch("/api/onboarding", { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to load saved progress.");
      const data = await res.json();
      if (typeof data.userId === "string")
        progressStorageKey.current = "menuminute.first-outlet.step." + data.userId;

      if (data.status === "inaccessible") {
        setInaccessible(true);
        setReady(false);
        setErrorMessage(
          "This previously created outlet is no longer accessible. Contact its administrator."
        );
        return;
      }
      if (data.status === "completed" && data.outletId) {
        if (onSuccess) {
          onSuccess(data.outletId);
        } else {
          try {
            window.sessionStorage.removeItem(progressStorageKey.current);
          } catch {
            /* Storage may be unavailable. */
          }
          router.replace("/dashboard/get-started");
          router.refresh();
        }
        return;
      }

      setRestoreFailed(false);
      setProvisioning(data.status === "provisioning");
      if (data.status === "provisioning") setCurrentStep(STEPS.length - 1);
      if (data.draft && Object.keys(data.draft).length > 0) {
        // Restored drafts must not be overwritten by a country suggestion.
        if (typeof data.draft.timezone === "string") timezoneTouched.current = true;
        setDraft((prev) => ({
          ...initialWizardDraft,
          ...data.draft,
          // Ensure arrays are preserved
          fulfillmentModes: data.draft.fulfillmentModes || prev.fulfillmentModes,
        }));
        setPersisted(true);
        setStatusMessage("Restored your saved progress.");
      }
      let storedStep = Number.NaN;
      try {
        const savedStep = window.sessionStorage.getItem(progressStorageKey.current);
        if (savedStep !== null) storedStep = Number(savedStep);
      } catch {
        /* Private browsing or blocked storage. */
      }
      if (
        data.status !== "provisioning" &&
        Number.isInteger(storedStep) &&
        storedStep >= 0 &&
        storedStep < STEPS.length
      )
        setCurrentStep(storedStep);
      setReady(true);
    } catch {
      // Do not enable autosave with unverified defaults: a failed GET must
      // never replace a durable draft with empty form values.
      setRestoreFailed(true);
      setReady(false);
      setErrorMessage(
        "Saved progress could not be loaded. Reconnect and retry; nothing was overwritten."
      );
    } finally {
      reconciliation.current = false;
    }
  }, [router, onSuccess]);

  useEffect(() => {
    void Promise.resolve().then(reconcile);
  }, [reconcile]);

  useEffect(() => {
    if (ready) {
      try {
        window.sessionStorage.setItem(progressStorageKey.current, String(currentStep));
      } catch {
        /* Storage disabled; server draft remains authoritative. */
      }
    }
  }, [ready, currentStep]);
  // Debounced auto-save function
  const save = useCallback((data: WizardDraft, revision = draftRevision.current) => {
    const operation = queue.current
      .catch(() => undefined)
      .then(async () => {
        const result = await fetch("/api/onboarding", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!result.ok) {
          if (result.status === 409) {
            throw new Error("A previous provisioning request is pending. Refresh to synchronize.");
          }
          throw new Error("Unable to save draft changes.");
        }
        if (draftRevision.current === revision) setPersisted(true);
      });
    queue.current = operation;
    return operation;
  }, []);

  useEffect(() => {
    if (!ready || provisioning) return;
    // While a field is temporarily incomplete (HEX, email, time), keep its
    // unsaved local value rather than sending a known-invalid partial draft.
    if (STEPS.some((_, index) => index < STEPS.length - 1 && validateStep(index, draft))) return;
    const timeout = window.setTimeout(() => {
      void save(draft).catch((e) =>
        setErrorMessage(e instanceof Error ? e.message : "Unable to save.")
      );
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [draft, ready, provisioning, save]);

  const updateDraft = <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => {
    if (!ready || provisioning) return;
    draftRevision.current += 1;
    setPersisted(false);
    setErrorMessage("");
    if (key === "timezone") timezoneTouched.current = true;
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = async () => {
    setErrorMessage("");
    const problem = validateStep(currentStep, draft);
    if (problem) {
      setErrorMessage(problem);
      return;
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setErrorMessage("");
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleLaunch = async () => {
    if (busy || !ready || restoreFailed || inaccessible) return;
    setBusy(true);
    setErrorMessage("");

    try {
      for (let step = 0; step < STEPS.length - 1; step++) {
        const problem = validateStep(step, draft);
        if (problem) {
          setCurrentStep(step);
          throw new Error(problem);
        }
      }

      // A prior POST may have committed while its response was lost.
      // Never rewrite the durable draft of a provisioning operation.
      if (!provisioning) await save(draft);

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });

      const value = await response.json();
      if (!response.ok) {
        throw new Error(value.message || "Provisioning did not complete. Check previous attempts.");
      }

      if (value.status === "completed") {
        if (onSuccess) {
          onSuccess(value.outletId);
        } else {
          try {
            window.sessionStorage.removeItem(progressStorageKey.current);
          } catch {
            /* Storage may be unavailable. */
          }
          router.replace("/dashboard/get-started");
          router.refresh();
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to launch outlet.");
      await reconcile();
    } finally {
      setBusy(false);
    }
  };

  const activeStepMeta = STEPS[currentStep]!;

  return (
    <div className="wizard-container" aria-busy={busy || !ready}>
      {restoreFailed && (
        <div className="wizard-error-banner" role="alert">
          Saved progress could not be verified. Editing is paused to protect your data.
          <button type="button" className="wizard-back-btn" onClick={() => void reconcile()}>
            Retry loading saved progress
          </button>
        </div>
      )}
      {inaccessible && (
        <p role="alert">
          Your previous outlet is no longer accessible. Please contact its administrator or{" "}
          <a href="/account">review your account</a>.
        </p>
      )}
      {provisioning && (
        <p role="status">
          A previous creation request is being reconciled. The existing request will be reused.
        </p>
      )}
      {/* Stepper Progress Bar */}
      <nav className="wizard-stepper" aria-label="Onboarding Progress">
        {STEPS.map((step, idx) => {
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;
          return (
            <div
              key={step.id}
              style={{
                display: "flex",
                alignItems: "center",
                flex: idx === STEPS.length - 1 ? "none" : 1,
              }}
            >
              <button
                type="button"
                className={`wizard-step-node ${isActive ? "wizard-step-node--active" : ""} ${isCompleted ? "wizard-step-node--completed" : ""}`}
                disabled={!ready || busy || provisioning || idx > currentStep}
                onClick={() => setCurrentStep(idx)}
              >
                <span className="wizard-step-badge">
                  {isCompleted ? <Check size={14} /> : step.number}
                </span>
                <span className="wizard-step-label">{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <div
                  className={`wizard-step-divider ${idx < currentStep ? "wizard-step-divider--filled" : ""}`}
                />
              )}
            </div>
          );
        })}
      </nav>

      {/* Main Wizard Card */}
      <div className="wizard-card">
        {/* Mediawork Vector / Asset Slot */}
        <WizardMediaSlot
          step={activeStepMeta.id}
          alt={`Illustration for ${activeStepMeta.label}`}
        />

        <div className="wizard-content" style={{ paddingTop: "0.5rem", paddingBottom: "0.25rem" }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="wizard-mobile-step-pill">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <p
              className="font-display text-sm font-semibold text-amber-900 dark:text-amber-200"
              aria-live="polite"
              data-testid="wizard-milestone"
            >
              {activeStepMeta.subtitle}
            </p>
          </div>
        </div>
        {currentStep === 4 && (
          <div style={{ padding: "0 2.25rem" }}>
            <ChefStickyNote
              author="Opening Night Checklist"
              text="Review your outlet details before launch. Publishing a menu and activating online ordering are separate steps."
            />
          </div>
        )}

        {/* Step Views */}
        {currentStep === 0 && <StepIdentity draft={draft} onChange={updateDraft} />}
        {currentStep === 1 && (
          <StepLocation
            draft={draft}
            onChange={updateDraft}
            onTimezoneSuggestion={(timezone) => {
              if (!timezoneTouched.current) {
                draftRevision.current += 1;
                setDraft((prev) => ({ ...prev, timezone }));
              }
            }}
          />
        )}
        {currentStep === 2 && <StepOperations draft={draft} onChange={updateDraft} />}
        {currentStep === 3 && <StepContactTables draft={draft} onChange={updateDraft} />}
        {currentStep === 4 && (
          <StepLaunch
            key={draft.timezone}
            draft={draft}
            busy={busy || !ready}
            onLaunch={handleLaunch}
          />
        )}

        {/* Error and Status Banner */}
        {errorMessage && (
          <div style={{ padding: "0 2.25rem 1rem 2.25rem" }}>
            <div className="wizard-error-banner" role="alert">
              {errorMessage}
            </div>
          </div>
        )}

        {/* Step Navigation Footer */}
        <div className="wizard-content" style={{ paddingTop: 0 }}>
          <div className="wizard-footer">
            <div>
              {currentStep > 0 ? (
                <button
                  type="button"
                  className="wizard-back-btn"
                  onClick={handleBack}
                  disabled={busy}
                >
                  <ArrowLeft size={16} />
                  <span>Back</span>
                </button>
              ) : (
                <span className="wizard-status-pill">
                  {!ready ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> Restoring…
                    </>
                  ) : persisted ? (
                    <span
                      className="wizard-status-pill--saved"
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                    >
                      <CheckCircle2 size={12} /> Saved to account
                    </span>
                  ) : (
                    statusMessage
                  )}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              {currentStep > 0 && currentStep < STEPS.length - 1 && (
                <span className="wizard-status-pill">
                  {persisted && (
                    <span
                      className="wizard-status-pill--saved"
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                    >
                      <CheckCircle2 size={12} /> Auto-saved
                    </span>
                  )}
                </span>
              )}

              {currentStep < STEPS.length - 1 ? (
                <button
                  type="button"
                  className="wizard-primary-btn"
                  onClick={handleNext}
                  disabled={
                    !ready ||
                    busy ||
                    provisioning ||
                    (currentStep === 0 && draft.name.trim().length < 2)
                  }
                >
                  <span>Continue</span>
                  <ArrowRight size={16} />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
