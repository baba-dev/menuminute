"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2 } from "lucide-react";
import { WizardMediaSlot, type WizardStepId } from "./wizard-media-slot";
import { StepIdentity } from "./wizard-steps/step-identity";
import { StepLocation } from "./wizard-steps/step-location";
import { StepOperations } from "./wizard-steps/step-operations";
import { StepContactTables } from "./wizard-steps/step-contact-tables";
import { StepLaunch } from "./wizard-steps/step-launch";
import { initialWizardDraft, type WizardDraft } from "./wizard-types";
import "./onboarding-wizard.css";

const STEPS: { id: WizardStepId; label: string; number: number }[] = [
  { id: "identity", label: "Identity", number: 1 },
  { id: "location", label: "Location", number: 2 },
  { id: "operations", label: "Operations", number: 3 },
  { id: "contact", label: "Service Points", number: 4 },
  { id: "launch", label: "Launch", number: 5 },
];

interface OnboardingWizardProps {
  onSuccess?: (outletId: string) => void;
}

export function OnboardingWizard({ onSuccess }: OnboardingWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [draft, setDraft] = useState<WizardDraft>(initialWizardDraft);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const reconciliation = useRef(false);

  // Reconcile and restore server-owned draft
  const reconcile = useCallback(async () => {
    if (reconciliation.current) return;
    reconciliation.current = true;
    try {
      const res = await fetch("/api/onboarding", { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to load saved progress.");
      const data = await res.json();

      if (data.status === "completed" && data.outletId) {
        if (onSuccess) {
          onSuccess(data.outletId);
        } else {
          router.replace("/dashboard/menu");
          router.refresh();
        }
        return;
      }

      if (data.draft && Object.keys(data.draft).length > 0) {
        setDraft((prev) => ({
          ...initialWizardDraft,
          ...data.draft,
          // Ensure arrays are preserved
          fulfillmentModes: data.draft.fulfillmentModes || prev.fulfillmentModes,
        }));
        setPersisted(true);
        setStatusMessage("Restored your saved progress.");
      }
      setReady(true);
    } catch {
      setErrorMessage("Unable to restore saved progress. You can still proceed.");
      setReady(true);
    } finally {
      reconciliation.current = false;
    }
  }, [router, onSuccess]);

  useEffect(() => {
    void Promise.resolve().then(reconcile);
  }, [reconcile]);

  // Debounced auto-save function
  const save = useCallback((data: WizardDraft) => {
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
        setPersisted(true);
      });
    queue.current = operation;
    return operation;
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timeout = window.setTimeout(() => {
      void save(draft).catch((e) =>
        setErrorMessage(e instanceof Error ? e.message : "Unable to save.")
      );
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [draft, ready, save]);

  const updateDraft = <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => {
    setPersisted(false);
    setErrorMessage("");
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = async () => {
    setErrorMessage("");
    // Step-specific validations
    if (currentStep === 0 && draft.name.trim().length < 2) {
      setErrorMessage("Please enter an outlet name of at least 2 characters.");
      return;
    }
    if (currentStep === 2 && draft.fulfillmentModes.length === 0) {
      setErrorMessage("Please select at least one fulfillment channel (Dine-In or Pickup).");
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
    if (busy) return;
    setBusy(true);
    setErrorMessage("");

    try {
      if (draft.name.trim().length < 2) {
        throw new Error("Please enter a valid outlet name.");
      }
      if (!draft.fulfillmentModes.length) {
        throw new Error("Choose at least one fulfillment mode.");
      }

      await save(draft);

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
          router.replace("/dashboard/menu");
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
                disabled={!ready || busy || idx > currentStep}
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

        {/* Step Views */}
        {currentStep === 0 && <StepIdentity draft={draft} onChange={updateDraft} />}
        {currentStep === 1 && <StepLocation draft={draft} onChange={updateDraft} />}
        {currentStep === 2 && <StepOperations draft={draft} onChange={updateDraft} />}
        {currentStep === 3 && <StepContactTables draft={draft} onChange={updateDraft} />}
        {currentStep === 4 && <StepLaunch draft={draft} busy={busy} onLaunch={handleLaunch} />}

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
                  disabled={!ready || busy || (currentStep === 0 && draft.name.trim().length < 2)}
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
