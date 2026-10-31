import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
  description: "MenuMinute is waiting for an internet connection.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main
      style={{
        alignItems: "center",
        display: "flex",
        minHeight: "100dvh",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <section
        aria-labelledby="offline-title"
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "1.5rem",
          boxShadow: "var(--shadow-floating)",
          maxWidth: "30rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            alignItems: "center",
            background: "#ff4b0a",
            borderRadius: "1.25rem",
            color: "white",
            display: "inline-flex",
            fontSize: "1.25rem",
            fontWeight: 800,
            height: "4rem",
            justifyContent: "center",
            marginBottom: "1.25rem",
            width: "4rem",
          }}
        >
          MM
        </div>
        <h1 id="offline-title" style={{ fontSize: "2rem", fontWeight: 800 }}>
          You&apos;re offline
        </h1>
        <p style={{ color: "var(--color-muted-foreground)", margin: "0.75rem 0 1.5rem" }}>
          Previously opened public menus may still be available, but prices and availability can be
          out of date. Ordering and account actions need a live connection.
        </p>
        <a
          href=""
          style={{
            background: "#ea580c",
            borderRadius: "0.75rem",
            color: "white",
            display: "inline-block",
            fontWeight: 700,
            padding: "0.75rem 1rem",
            textDecoration: "none",
          }}
        >
          Try again
        </a>
      </section>
    </main>
  );
}
