"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";

/** One keyboard-accessible dialog contract for privileged administrative work. */
export function AdminDialog({
  title,
  onClose,
  children,
  className = "",
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  busy?: boolean;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="admin-modal-backdrop" />
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          className={`admin-modal-content fixed top-1/2 left-1/2 z-[51] max-h-[90dvh] -translate-x-1/2 -translate-y-1/2 ${className}`}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
