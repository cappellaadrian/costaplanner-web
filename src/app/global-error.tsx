"use client";

/**
 * Global error boundary — Next.js looks for global-error.tsx for errors
 * that escape the route-segment error.tsx (e.g. errors in the root
 * layout, errors during the initial render before any segment mounts).
 *
 * This file MUST include its own <html> and <body> tags because at the
 * point it renders, the root layout has failed and is not available.
 */

import { useEffect } from "react";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Costaplanner global error]", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#09090b",
          color: "#e4e4e7",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "640px", width: "100%" }}>
          <div
            style={{
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#f87171",
              marginBottom: "0.5rem",
            }}
          >
            Error global
          </div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              margin: "0 0 1rem",
            }}
          >
            Costaplanner se cayó completamente
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#a1a1aa", margin: "0 0 1.5rem" }}>
            Un error escapó del límite de la página y rompió la aplicación
            entera. Esto es siempre un bug nuestro.
          </p>
          <div
            style={{
              border: "1px solid rgba(127,29,29,0.4)",
              background: "rgba(69,10,10,0.2)",
              borderRadius: "0.5rem",
              padding: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#f87171",
                marginBottom: "0.5rem",
              }}
            >
              Mensaje técnico
            </div>
            <pre
              style={{
                fontSize: "0.75rem",
                color: "#fecaca",
                fontFamily: "ui-monospace, monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
              }}
            >
              {error.message || "Error sin mensaje"}
            </pre>
            {error.digest && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "#71717a",
                  marginTop: "0.5rem",
                  paddingTop: "0.5rem",
                  borderTop: "1px solid rgba(127,29,29,0.4)",
                }}
              >
                <span style={{ color: "#52525b" }}>ID: </span>
                <code style={{ color: "#a1a1aa", fontFamily: "ui-monospace, monospace" }}>
                  {error.digest}
                </code>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                background: "#f59e0b",
                color: "#09090b",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                background: "transparent",
                color: "#e4e4e7",
                fontSize: "0.875rem",
                border: "1px solid #3f3f46",
                cursor: "pointer",
              }}
            >
              Recargar
            </button>
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "#52525b",
              marginTop: "1.5rem",
              paddingTop: "1rem",
              borderTop: "1px solid #18181b",
            }}
          >
            ¿Cache vieja? Prueba <kbd>Ctrl + Shift + R</kbd> o abre en modo
            incógnito.
          </div>
        </div>
      </body>
    </html>
  );
}
