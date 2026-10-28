"use client";

/**
 * The last-resort error boundary.
 *
 * It replaces the root layout entirely, so it must render its own `<html>` and
 * `<body>` — which also means **it cannot use the design system**: none of the
 * providers, fonts or token stylesheets are mounted at this point. Everything
 * here is inline and self-contained on purpose.
 *
 * If this renders, the root layout itself failed. Keep it boring.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#0f172a",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <svg width="56" height="56" viewBox="0 0 32 32" aria-hidden style={{ marginBottom: 24 }}>
            <rect width="32" height="32" rx="7" fill="#4f46e5" />
            <path
              d="M9 23.5V9.5L23 22.5V8.5"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="9" cy="23.5" r="2.75" fill="#ffffff" />
            <circle cx="23" cy="8.5" r="3.5" fill="#67e8f9" />
          </svg>

          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
            Nexivora could not load
          </h1>
          <p style={{ color: "#475569", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
            Something failed at the root of the application. Reloading usually fixes it. If it does
            not, please tell us and include the reference below.
          </p>

          <button
            onClick={reset}
            style={{
              background: "#4f46e5",
              color: "#ffffff",
              border: "none",
              borderRadius: "0.625rem",
              padding: "0.75rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>

          {error.digest ? (
            <p
              style={{
                color: "#64748b",
                fontSize: "0.75rem",
                marginTop: "2rem",
                fontFamily: "monospace",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
