"use client";
import { useCallback, useRef } from "react";
import Script from "next/script";
declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        }
      ) => string;
    };
  }
}
export function RegistrationChallenge({ onToken }: { onToken: (token: string) => void }) {
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const render = useCallback(() => {
    if (!sitekey || !container.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(container.current, {
      sitekey,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
  }, [sitekey, onToken]);
  if (!sitekey) return null;
  return (
    <div className="grid gap-2">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={render}
      />
      <div ref={container} aria-label="Human verification" />
    </div>
  );
}
