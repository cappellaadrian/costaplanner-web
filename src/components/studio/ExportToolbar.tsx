"use client";

/**
 * ExportToolbar — drop-in PDF + Excel + Print buttons for every studio page.
 *
 * Replaces the per-page handlers that only existed on /studio/beam. Each
 * studio page builds its DesignSnapshot from its live result and passes
 * it as a function (lazy so we don't recompute on every render).
 *
 * Uses the existing exporters lib (PDF via window.print + iframe with
 * inline KaTeX; Excel via exceljs). The buttons sit in a flex row at
 * the top of the page's right column.
 */
import { useState } from "react";
import { exportDesignAsExcel } from "@/lib/exporters/excel";
import { printDesignAsPdf } from "@/lib/exporters/pdf";
import type { DesignSnapshot } from "@/lib/exporters/types";

interface Props {
  /** Lazy snapshot builder — called only when the user clicks export. */
  buildSnapshot: () => DesignSnapshot;
}

export function ExportToolbar({ buildSnapshot }: Props) {
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function handlePdf() {
    setBusy("pdf");
    try {
      const snap = buildSnapshot();
      printDesignAsPdf(snap);
      setToast("Abriendo vista de impresión…");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setToast(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setToast(null), 5000);
    } finally {
      setBusy(null);
    }
  }

  async function handleExcel() {
    setBusy("excel");
    try {
      const snap = buildSnapshot();
      await exportDesignAsExcel(snap);
      setToast("Excel descargado");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setToast(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setToast(null), 5000);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        Exportar memoria
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePdf}
          disabled={busy !== null}
          className="flex-1 px-3 py-2 rounded bg-amber-500/10 border border-amber-700/40 text-amber-200 text-xs font-semibold hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
          title="Imprimir o guardar como PDF (memoria estilo Hacienda)"
        >
          {busy === "pdf" ? "Generando…" : "📄 PDF"}
        </button>
        <button
          type="button"
          onClick={handleExcel}
          disabled={busy !== null}
          className="flex-1 px-3 py-2 rounded bg-emerald-500/10 border border-emerald-700/40 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
          title="Descargar como hoja Excel con todos los pasos"
        >
          {busy === "excel" ? "Generando…" : "📊 Excel"}
        </button>
      </div>
      {toast && (
        <div className="text-[10px] text-zinc-400 italic">{toast}</div>
      )}
    </div>
  );
}
