"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { Sparkles, MapPin, QrCode as QrIcon, UtensilsCrossed, Package } from "lucide-react";
import type { WizardDraft } from "../wizard-types";

interface StepLaunchProps {
  draft: WizardDraft;
  busy: boolean;
  onLaunch: () => Promise<void>;
}

export function StepLaunch({ draft, busy, onLaunch }: StepLaunchProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const previewUrl = `https://food.bababuilds.com/preview/${encodeURIComponent(draft.name || "outlet")}`;

    QRCode.toDataURL(previewUrl, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: draft.primaryColor || "#f97316",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // Fallback gracefully if QR fails
      });

    return () => {
      cancelled = true;
    };
  }, [draft.name, draft.primaryColor]);

  const handleLaunchClick = async () => {
    setCelebrating(true);
    try {
      await onLaunch();
    } finally {
      setCelebrating(false);
    }
  };

  const hasCoords = draft.latitude !== null && draft.longitude !== null;

  return (
    <div className="wizard-content">
      <div className="wizard-header">
        <span className="wizard-eyebrow">Step 05 / Ready for Launch</span>
        <h2 className="wizard-title">Review & launch your outlet.</h2>
        <p className="wizard-desc">
          Double-check your setup below. Your digital menu and table QR codes are ready to take live
          orders.
        </p>
      </div>

      <div className="wizard-review-card">
        {/* Left: Summary Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: draft.primaryColor,
                  border: "1px solid rgba(255,255,255,0.4)",
                }}
              />
              <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#fafaf9", fontWeight: 700 }}>
                {draft.name || "Untitled Outlet"}
              </h3>
            </div>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8125rem", color: "#a8a29e" }}>
              {draft.outletType.replace("_", " ").toUpperCase()} · {draft.country} ({draft.currency}
              )
            </p>
          </div>

          {draft.description && (
            <p
              style={{
                margin: 0,
                fontSize: "0.8125rem",
                color: "#d6d3d1",
                fontStyle: "italic",
                lineHeight: 1.4,
              }}
            >
              &ldquo;{draft.description}&rdquo;
            </p>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              fontSize: "0.8125rem",
              color: "#a8a29e",
            }}
          >
            {draft.addressLine1 && (
              <div>
                <strong style={{ color: "#d6d3d1" }}>Address:</strong> {draft.addressLine1}
                {draft.city ? `, ${draft.city}` : ""}
                {draft.state ? `, ${draft.state}` : ""}
              </div>
            )}

            {hasCoords && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <MapPin size={14} className="text-amber-500" />
                <span style={{ fontFamily: "monospace", color: "#fed7aa" }}>
                  {draft.latitude?.toFixed(5)}°, {draft.longitude?.toFixed(5)}°
                </span>
              </div>
            )}

            <div
              style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.25rem" }}
            >
              <span
                style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#d6d3d1" }}
              >
                <UtensilsCrossed
                  size={14}
                  className={
                    draft.fulfillmentModes.includes("dine_in") ? "text-amber-500" : "text-stone-600"
                  }
                />
                <span>
                  Dine-In: {draft.fulfillmentModes.includes("dine_in") ? "Active" : "Off"}
                </span>
              </span>
              <span
                style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#d6d3d1" }}
              >
                <Package
                  size={14}
                  className={
                    draft.fulfillmentModes.includes("pickup") ? "text-amber-500" : "text-stone-600"
                  }
                />
                <span>Pickup: {draft.fulfillmentModes.includes("pickup") ? "Active" : "Off"}</span>
              </span>
            </div>

            {draft.fulfillmentModes.includes("dine_in") && draft.tableCount > 0 && (
              <div>
                <strong style={{ color: "#d6d3d1" }}>Service Points:</strong> {draft.tableCount}{" "}
                tables ready to print
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Dynamic QR Preview */}
        <div className="wizard-qr-preview-box">
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "#fed7aa",
              textTransform: "uppercase",
            }}
          >
            Live Menu QR
          </div>
          {qrDataUrl ? (
            <div className="wizard-qr-canvas">
              <Image
                src={qrDataUrl}
                alt="Live Menu QR Preview"
                width={124}
                height={124}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                unoptimized
              />
            </div>
          ) : (
            <div
              className="wizard-qr-canvas"
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <QrIcon size={48} className="text-stone-400" />
            </div>
          )}
          <span style={{ fontSize: "0.6875rem", color: "#78716c" }}>
            Styled with {draft.primaryColor}
          </span>
        </div>
      </div>

      {celebrating && (
        <div
          style={{
            textAlign: "center",
            padding: "0.5rem",
            color: "#fed7aa",
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          <Sparkles size={18} className="animate-spin text-amber-500" />
          <span>Provisioning your organization, menus, and tables…</span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
        <button
          type="button"
          className="wizard-primary-btn wizard-launch-btn"
          disabled={busy || celebrating || draft.name.trim().length < 2}
          onClick={handleLaunchClick}
        >
          <Sparkles size={16} />
          <span>{busy || celebrating ? "Launching Outlet…" : "Confirm & Launch Outlet"}</span>
        </button>
      </div>
    </div>
  );
}
