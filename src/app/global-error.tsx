"use client";

/**
 * Replaces the root layout when it fails, so it cannot rely on the app stylesheet, fonts or
 * theme script: everything is inline and follows the system colour scheme.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          background: "Canvas",
          color: "CanvasText",
          colorScheme: "light dark",
          display: "flex",
          fontFamily: "system-ui, sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100dvh",
          padding: "2rem",
        }}
      >
        <main role="alert" style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>
            MenuMinute didn’t load.
          </h1>
          <p style={{ lineHeight: 1.6, margin: "0.75rem 0 1.5rem", opacity: 0.75 }}>
            It’s a problem on our side, and nothing you saved has been changed. Try again in a
            moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#ea580c",
              border: 0,
              borderRadius: "0.75rem",
              color: "#fff",
              cursor: "pointer",
              font: "inherit",
              fontWeight: 700,
              minHeight: "44px",
              padding: "0.75rem 1.25rem",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
