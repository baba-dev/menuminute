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
 * Skipped for the initial render so a normal page load keeps the browser's own focus.
 */
export function RouteFocus() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const main = document.getElementById(WORKSPACE_MAIN_ID);
    if (!main) return;
    const heading = main.querySelector<HTMLElement>("h1");
    const target = heading ?? main;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: false });
  }, [pathname]);
  return null;
}
