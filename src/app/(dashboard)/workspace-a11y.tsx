"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export const WORKSPACE_MAIN_ID = "workspace-main";

/** First focusable element in the shell: lets keyboard users bypass the sidebar. */
export function WorkspaceSkipLink() {
  return (
    <a className="mm-skip-link" href={"#" + WORKSPACE_MAIN_ID}>
      Skip to main content
    </a>
  );
}

/**
 * After a client-side navigation, move focus to the new page heading so keyboard and
 * screen-reader users land in the content instead of staying on the sidebar link.
 *
 * Many pages stream in behind a loading state that has its own heading, and the real heading
 * replaces it a moment later. The heading is therefore followed while the page settles, but
 * only for as long as the person has not moved focus themselves. Skipped for the initial
 * render so a normal page load keeps the browser's own focus.
 */
export function RouteFocus() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const main = document.getElementById(WORKSPACE_MAIN_ID);
    if (!main) return;
    let focused: HTMLElement | null = null;
    const focusHeading = () => {
      const target = main.querySelector<HTMLElement>("h1") ?? main;
      if (target === focused && target.isConnected) return;
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: false });
      focused = target;
    };
    focusHeading();
    const observer = new MutationObserver(() => {
      const active = document.activeElement;
      const untouched =
        !active || active === document.body || active === main || active === focused;
      if (!untouched) {
        observer.disconnect();
        return;
      }
      const heading = main.querySelector<HTMLElement>("h1");
      if (heading && heading !== focused) focusHeading();
    });
    observer.observe(main, { childList: true, subtree: true });
    const stop = window.setTimeout(() => observer.disconnect(), 5_000);
    return () => {
      observer.disconnect();
      window.clearTimeout(stop);
    };
  }, [pathname]);
  return null;
}
