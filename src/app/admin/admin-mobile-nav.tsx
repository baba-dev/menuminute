"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { AdminNav } from "./admin-nav";

/** Keep the full administrative directory off-screen until explicitly opened on mobile. */
export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label="Open admin navigation" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 md:hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 md:hidden" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 flex w-[min(19rem,88vw)] flex-col overflow-y-auto border-r border-stone-200 bg-white p-3 shadow-2xl md:hidden dark:border-stone-800 dark:bg-stone-900">
          <div className="mb-3 flex items-center justify-between border-b border-stone-200 px-3 pb-3 dark:border-stone-800">
            <Dialog.Title className="font-display text-base font-bold text-stone-900 dark:text-stone-100">Admin navigation</Dialog.Title>
            <Dialog.Close asChild><button type="button" aria-label="Close admin navigation" className="rounded-lg p-2 hover:bg-stone-100 dark:hover:bg-stone-800"><X className="h-5 w-5" /></button></Dialog.Close>
          </div>
          <div onClickCapture={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>
            <AdminNav />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
