"use client";

/**
 * StudioShell — generic 3-column layout shared by every element studio.
 *
 * Header (title + status badge + back link) + left sidebar (caller's inputs)
 * + center (steps) + right (verifications/reinforcement). Used by all 11
 * /studio/* pages so we don't reinvent the layout per element.
 */
import Link from "next/link";
import { type ReactNode } from "react";
import { StepRenderer } from "@/components/studio/StepRenderer";
import { CHECK_BADGE } from "@/components/studio/colors";
import {
  ModoAprendizajeBlock,
  ModoAprendizajeProvider,
  ModoAprendizajeToggle,
  useModoAprendizaje,
} from "@/components/studio/ModoAprendizaje";
import { ReferencesFooter } from "@/components/studio/ReferencesFooter";
import { ExportToolbar } from "@/components/studio/ExportToolbar";
import type { CalculationStep } from "@/lib/beam-flexure-live";
import type { DesignSnapshot } from "@/lib/exporters/types";

export type ReferencesBundle =
  | "beam" | "column" | "footing" | "slab" | "wall"
  | "retaining" | "stair" | "lintel";

export interface StudioCheck {
  nombre: string;
  requerido: number;
  disponible: number;
  unidad: string;
  cumple: boolean;
  referencia: string;
  critical?: boolean;
}

interface Props {
  title: string;
  subtitle?: string;
  inputs: ReactNode;
  steps: CalculationStep[];
  checks: StudioCheck[];
  reinforcement?: ReactNode;
  warnings?: string[];
  stepPrefix?: string;
  /** Which canned references to show in the footer. */
  referencesBundle?: ReferencesBundle;
  /** Lazy DesignSnapshot builder; if present, shows PDF/Excel export buttons. */
  buildSnapshot?: () => DesignSnapshot;
  /** Optional slot rendered directly below the ExportToolbar in the right
   *  column. Phase 2 uses this for the SaveToProjectButton so the user can
   *  push the current calc back to its design project. */
  extraToolbarSlot?: ReactNode;
}

export function StudioShell(props: Props) {
  // Wrap in ModoAprendizajeProvider so the toggle + every nested
  // ModoAprendizajeBlock + VariableChip read from one shared source of truth.
  // Every StudioShell-based page (25 of them) inherits this for free.
  return (
    <ModoAprendizajeProvider>
      <StudioShellInner {...props} />
    </ModoAprendizajeProvider>
  );
}

function StudioShellInner({
  title,
  subtitle,
  inputs,
  steps,
  checks,
  reinforcement,
  warnings = [],
  stepPrefix,
  referencesBundle,
  buildSnapshot: buildSnap,
  extraToolbarSlot,
}: Props) {
  const allPass = checks.every((c) => (c.critical ?? true) ? c.cumple : true);
  const { enabled: aprendizaje } = useModoAprendizaje();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-widest text-amber-400 mb-1">
              <Link href="/studio" className="hover:text-amber-300">
                ← Studio
              </Link>
            </div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle && (
              <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Context-driven toggle: reads/writes the provider above. */}
            <ModoAprendizajeToggle />
            <span
              className={`shrink-0 px-3 py-1 rounded text-xs uppercase tracking-wider ${
                allPass ? CHECK_BADGE.ok : CHECK_BADGE.review
              }`}
            >
              {allPass ? "OK" : "Revisión"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_320px] gap-4">
          <div className="space-y-4">
            {inputs}
            {warnings.length > 0 && (
              <div className="border border-amber-900/40 bg-amber-950/20 rounded-lg p-3 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                  Advertencias
                </div>
                {warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-200/80">
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={s.id}>
                <StepRenderer
                  step={s}
                  index={i}
                  stripPrefix={stepPrefix}
                />
                <ModoAprendizajeBlock step={s} enabled={aprendizaje} />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {buildSnap && <ExportToolbar buildSnapshot={buildSnap} />}
            {extraToolbarSlot}
            {reinforcement}
            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                Verificaciones
              </div>
              <div className="space-y-2">
                {checks.map((c, i) => {
                  const critical = c.critical ?? true;
                  const badgeCls = c.cumple
                    ? CHECK_BADGE.ok
                    : critical
                      ? CHECK_BADGE.fail
                      : CHECK_BADGE.review;
                  return (
                    <div
                      key={i}
                      className="text-xs border-b border-zinc-800/60 pb-2 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-zinc-200">{c.nombre}</span>
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${badgeCls}`}
                        >
                          {c.cumple ? "OK" : critical ? "FAIL" : "REV"}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-1 font-mono">
                        req {c.requerido.toFixed(2)} {c.unidad} · disp{" "}
                        {c.disponible.toFixed(2)} {c.unidad}
                      </div>
                      <div className="text-[10px] text-zinc-600 italic">
                        {c.referencia}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {referencesBundle && <ReferencesFooter bundle={referencesBundle} />}
      </div>
    </main>
  );
}

export function NumberField({
  label,
  unit,
  value,
  onChange,
  step = 1,
  source,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  /** Tag this input as derived from a separate study. The badge is rendered
   *  next to the label so the engineer immediately knows the number must
   *  come from the right source, not be invented. */
  source?: "soil" | "loads" | "geometry" | "code";
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
        {label}
        {unit && <span className="text-zinc-600">({unit})</span>}
        {source === "soil" && (
          <span
            title="Este valor debe venir del estudio de suelos"
            className="px-1 py-0 rounded text-[8px] uppercase tracking-wider bg-emerald-900/40 text-emerald-300 border border-emerald-800 font-semibold"
          >
            🌱 Suelos
          </span>
        )}
        {source === "loads" && (
          <span
            title="Valor del análisis de cargas / análisis estructural"
            className="px-1 py-0 rounded text-[8px] uppercase tracking-wider bg-red-900/40 text-red-300 border border-red-800 font-semibold"
          >
            ⚙ Análisis
          </span>
        )}
        {source === "code" && (
          <span
            title="Valor prescrito por el código"
            className="px-1 py-0 rounded text-[8px] uppercase tracking-wider bg-blue-900/40 text-blue-300 border border-blue-800 font-semibold"
          >
            § Código
          </span>
        )}
      </span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        className={`border rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-amber-500 ${
          source === "soil"
            ? "bg-emerald-500/5 border-emerald-800/40 text-emerald-200"
            : "bg-amber-500/10 border-amber-700/40 text-amber-200"
        }`}
      />
    </label>
  );
}

export function InputCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}
