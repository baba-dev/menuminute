"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Bell, Ellipsis, Search, UserRound, X } from "lucide-react";
import {
  bottomBarItems,
  isNavSelected,
  moreItems,
  type ResolvedNavItem,
} from "@/modules/dashboard/nav-model";
import { useReturnFocus } from "@/lib/use-return-focus";
import { WorkspaceIcon } from "./workspace-icons";
import { useWorkspaceShell } from "./workspace-shell";

/**
 * Phone navigation: Orders, Till, Kitchen and Floor (whichever the user can use), then More.
 * Visible text is short; the accessible name stays the full label (for example "Kitchen Setup").
 */
export function WorkspaceBottomBar() {
  const pathname = usePathname();
  const returnFocus = useReturnFocus();
  const {
    capabilities,
    snapshot,
    moreOpen,
    setMoreOpen,
    setPaletteOpen,
    setDrawerOpen,
    attention,
  } = useWorkspaceShell();
  const items = bottomBarItems(capabilities);
  const more = moreItems(capabilities);
  const moreSelected = more.some((item) => isNavSelected(item, pathname));
  const pending = snapshot?.pulse.state === "ready" ? snapshot.pulse.data.pending : 0;

  const badge = (item: ResolvedNavItem) =>
    item.id === "orders" && pending > 0 ? (
      <span className="mm-bottom-badge" aria-hidden="true">
        {pending > 99 ? "99+" : pending}
      </span>
    ) : null;

  return (
    <>
      <nav className="mm-bottom-bar" aria-label="Primary">
        {items.map((item) => {
          const selected = isNavSelected(item, pathname);
          const label = item.nav.label;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={"mm-bottom-link" + (selected ? " is-active" : "")}
              aria-current={selected ? "page" : undefined}
              aria-label={
                item.id === "orders" && pending > 0 ? label + ", " + pending + " waiting" : label
              }
            >
              <span className="mm-bottom-icon">
                <WorkspaceIcon name={item.icon} size={21} />
                {badge(item)}
              </span>
              <span className="mm-bottom-label" aria-hidden="true">
                {item.id === "kitchen" && label === "Kitchen Setup" ? "Setup" : item.shortLabel}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          className={"mm-bottom-link" + (moreSelected || moreOpen ? " is-active" : "")}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <span className="mm-bottom-icon">
            <Ellipsis size={21} aria-hidden="true" />
            {attention > 0 && <span className="mm-bottom-dot" aria-hidden="true" />}
          </span>
          <span className="mm-bottom-label">More</span>
        </button>
      </nav>

      <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="mm-sheet-overlay" />
          <Dialog.Content
            className="mm-sheet mm-sheet--bottom"
            aria-describedby="mm-more-description"
            onOpenAutoFocus={returnFocus.onOpenAutoFocus}
            onCloseAutoFocus={returnFocus.onCloseAutoFocus}
          >
            <header className="mm-sheet-header">
              <div>
                <Dialog.Title className="mm-sheet-title">More</Dialog.Title>
                <Dialog.Description id="mm-more-description" className="mm-sheet-description">
                  Every other page you can use, plus search and notifications.
                </Dialog.Description>
              </div>
              <Dialog.Close className="mm-icon-button" aria-label="Close More">
                <X size={18} aria-hidden="true" />
              </Dialog.Close>
            </header>
            <div className="mm-sheet-tools">
              <button
                type="button"
                className="mm-icon-button"
                onClick={() => {
                  setMoreOpen(false);
                  setPaletteOpen(true);
                }}
              >
                <Search size={17} aria-hidden="true" /> Search
              </button>
              <button
                type="button"
                className="mm-icon-button"
                onClick={() => {
                  setMoreOpen(false);
                  setDrawerOpen(true);
                }}
              >
                <Bell size={17} aria-hidden="true" /> Notifications
                {attention > 0 && <span className="mm-sheet-count">{attention}</span>}
              </button>
            </div>
            <ul className="mm-sheet-list">
              {more.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="mm-sheet-link"
                    aria-current={isNavSelected(item, pathname) ? "page" : undefined}
                    onClick={() => setMoreOpen(false)}
                  >
                    <WorkspaceIcon name={item.icon} />
                    <span>{item.nav.label}</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/account" className="mm-sheet-link" onClick={() => setMoreOpen(false)}>
                  <UserRound size={19} strokeWidth={1.9} aria-hidden="true" />
                  <span>Account &amp; security</span>
                </Link>
              </li>
            </ul>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
