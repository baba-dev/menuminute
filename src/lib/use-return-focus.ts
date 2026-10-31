"use client";

import { useCallback, useRef } from "react";

/**
 * Radix Dialog returns focus to its own Trigger when it closes. A sheet that is opened from
 * several places (a button, a shortcut, another menu) has no single Trigger, so focus would be
 * dropped on the page body and a keyboard user would lose their place. This remembers whatever
 * had focus when the sheet opened and puts it back on close, if it is still on the page.
 */
export function useReturnFocus() {
  const origin = useRef<HTMLElement | null>(null);
  const onOpenAutoFocus = useCallback(() => {
    const active = document.activeElement;
    origin.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, []);
  const onCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    const element = origin.current;
    origin.current = null;
    if (element?.isConnected) element.focus();
  }, []);
  return { onOpenAutoFocus, onCloseAutoFocus };
}
