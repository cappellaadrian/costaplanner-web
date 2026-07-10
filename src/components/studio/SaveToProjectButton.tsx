"use client";

/**
 * SaveToProjectButton — shared component for studio calculator pages.
 *
 * When the user enters a calculator via /studio/<x>?proyecto=<id>, this
 * button POSTs the current design to /api/designs with designProjectId set,
 * then redirects back to /proyectos/<id> so they see the updated tree.
 *
 * When opened without ?proyecto=, it shows a hint pointing to /proyectos.
 *
 * Task 4 polish: when entered with ?proyecto=<id> AND the element-type has a
 * sensible next step (per src/lib/next-step.ts), surface a small
 * "Siguiente paso: X →" link next to the save button. The link preserves
 * ?proyecto=<id> so the workflow chain stays connected.
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getNextStep } from "@/lib/next-step";

interface Props {
  elementType: string;
  buildPayload: () => {
    archJson: Record<string, unknown>;
    structJson: Record<string, unknown>;
    resultJson: Record<string, unknown>;
  };
  disabled?: boolean;
}

export function SaveToProjectButton({
  elementType,
  buildPayload,
  disabled,
}: Props) {
  const router = useRouter();
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Read ?proyecto=<id> from window after mount — avoids Next 14
  // static-prerender requirement for Suspense around useSearchParams.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("proyecto");
    setProyectoId(id);
  }, []);

  async function save() {
    setBusy(true);
    setFeedback(null);
    try {
      const payload = buildPayload();
      const body = {
        name: `${elementType} — ${new Date().toISOString().slice(0, 10)}`,
        designProjectId: proyectoId || undefined,
        ...payload,
      };
      const r = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${r.status}`);
      }
      await r.json();
      setFeedback("Guardado ✓");
      if (proyectoId) {
        // ?saved=<elementType> triggers the "Siguiente paso →" banner on
        // the project dashboard. See src/lib/next-step.ts and the dashboard
        // page for the banner mapping.
        const target = `/proyectos/${proyectoId}?saved=${encodeURIComponent(elementType)}`;
        setTimeout(() => router.push(target), 700);
      }
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (!proyectoId) {
    return (
      <div className="text-[10px] text-zinc-500 italic">
        Abre desde un proyecto para guardar →{" "}
        <a
          href="/proyectos"
          className="text-amber-400 hover:underline"
        >
          Mis proyectos
        </a>
      </div>
    );
  }

  // Resolve the suggested next step for this element type. If there's no
  // mapping (or it points to a generic "generate memoria"), we hide the hint.
  const nextStep = getNextStep(elementType);
  const nextHref = nextStep?.href
    ? `${nextStep.href}?proyecto=${proyectoId}`
    : null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={save}
        disabled={busy || disabled}
        className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-sm font-bold disabled:opacity-50 transition-colors"
      >
        {busy ? "Guardando…" : feedback ?? "💾 Guardar al proyecto"}
      </button>
      {nextStep && nextHref && (
        <Link
          href={nextHref}
          className="text-[11px] text-zinc-400 hover:text-amber-400 transition-colors whitespace-nowrap"
          title={`Saltar a la siguiente calculadora del flujo: ${nextStep.label}`}
        >
          Siguiente: {nextStep.label} →
        </Link>
      )}
    </div>
  );
}
