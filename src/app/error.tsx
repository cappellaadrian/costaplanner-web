"use client";

/**
 * App-router error boundary — Next.js looks for this file and uses it
 * when ANY page throws a client-side exception. Without this file, users
 * see the useless "Application error: a client-side exception has
 * occurred" message with no recovery option.
 *
 * Here we show the actual error message + stack snippet + a retry button
 * + a link back to /studio. This is critical for diagnosing crashes in
 * production without asking the user to open DevTools.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console so DevTools shows the real error
    console.error("[Costaplanner runtime error]", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-5">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-400 mb-2">
            Error en la página
          </div>
          <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
            Algo se cayó en el cliente
          </h1>
          <p className="text-sm text-zinc-400">
            Esto NO es un error en tu diseño — es un bug en Costaplanner.
            El mensaje técnico abajo nos ayuda a diagnosticarlo.
          </p>
        </div>

        <div className="border border-red-900/40 bg-red-950/20 rounded-lg p-4 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-red-400">
            Mensaje
          </div>
          <pre className="text-xs text-red-200 font-mono whitespace-pre-wrap break-words">
            {error.message || "Error sin mensaje"}
          </pre>
          {error.digest && (
            <div className="text-[11px] text-zinc-500 pt-2 border-t border-red-900/40">
              <span className="text-zinc-600">ID:</span>{" "}
              <code className="text-zinc-400 font-mono">{error.digest}</code>
            </div>
          )}
          {error.stack && (
            <details className="pt-2">
              <summary className="text-[11px] text-zinc-500 cursor-pointer hover:text-zinc-300">
                Mostrar stack trace técnico
              </summary>
              <pre className="text-[10px] text-zinc-500 font-mono mt-2 max-h-48 overflow-auto bg-zinc-950 p-2 rounded border border-zinc-800">
                {error.stack}
              </pre>
            </details>
          )}
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-semibold transition-colors"
          >
            Reintentar
          </button>
          <Link
            href="/studio"
            className="px-4 py-2 rounded-lg border border-zinc-700 hover:border-amber-700 text-zinc-200 text-sm transition-colors"
          >
            Volver a Studio
          </Link>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="px-4 py-2 rounded-lg border border-zinc-700 hover:border-amber-700 text-zinc-200 text-sm transition-colors"
          >
            Recargar página
          </button>
        </div>

        <div className="text-[11px] text-zinc-600 pt-4 border-t border-zinc-900">
          Si estás viendo este mensaje porque <code>/codigo</code> falla:
          probablemente el navegador está usando una versión cacheada del JS.
          Prueba <kbd className="px-1 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-zinc-400">Ctrl + Shift + R</kbd>{" "}
          o abre la página en modo incógnito.
        </div>
      </div>
    </main>
  );
}
