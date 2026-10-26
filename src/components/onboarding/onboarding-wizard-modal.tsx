"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { OnboardingWizard } from "./onboarding-wizard";
import "./onboarding-wizard.css";

interface OnboardingWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (outletId: string) => void;
}

export function OnboardingWizardModal({
  open,
  onOpenChange,
  onSuccess,
}: OnboardingWizardModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="wizard-modal-overlay" />
        <Dialog.Content className="wizard-modal-content" aria-describedby="wizard-dialog-desc">
          <Dialog.Title className="sr-only">Complete First Outlet Setup</Dialog.Title>
          <Dialog.Description id="wizard-dialog-desc" className="sr-only">
            Wizard for setting up your first outlet, including identity, physical address, and
            service settings.
          </Dialog.Description>
          <Dialog.Close asChild>
            <button className="wizard-modal-close" aria-label="Close dialog">
              <X size={16} />
            </button>
          </Dialog.Close>
          <div style={{ padding: "1.5rem" }}>
            <OnboardingWizard
              onSuccess={(outletId) => {
                onOpenChange(false);
                if (onSuccess) onSuccess(outletId);
              }}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
