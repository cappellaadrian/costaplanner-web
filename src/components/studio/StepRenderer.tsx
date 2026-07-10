"use client";

/**
 * Renders one CalculationStep as a Mathcad-style block.
 *
 * Shared across all studio pages (beam, columns, footings, ...). Generic
 * over element type via the verification-prefix prop so different element
 * step IDs (flexure.verif_*, rect_col.verif_*, ...) render the right
 * accent.
 */
import { useMemo } from "react";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import type { CalculationStep } from "@/lib/beam-flexure-live";
import {
  classifyVar,
  PROVENANCE_BG,
  PROVENANCE_TEXT,
  PROVENANCE_LABEL,
  type Provenance,
} from "./colors";

interface Props {
  step: CalculationStep;
  index: number;
  highlightVar?: string;
  onVarClick?: (varName: string) => void;
  onDependencyClick?: (stepId: string) => void;
  onSelfClick?: (stepId: string) => void;
  recentlyChanged?: boolean;
  /** Prefix that marks verification steps (e.g. "flexure.verif_"). */
  verificationPrefix?: string;
  /** Optional prefix stripped from dependency labels. */
  stripPrefix?: string;
}

function formatNumber(n: number, unit: string): string {
  if (!isFinite(n)) return "∞";
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 100000) {
    return n.toLocaleString("es-CR", { maximumFractionDigits: 0 });
  }
  if (abs >= 1) {
    return n.toLocaleString("es-CR", { maximumFractionDigits: 3 });
  }
  return n.toPrecision(4);
}

export function StepRenderer({
  step,
  index,
  highlightVar,
  onVarClick,
  onDependencyClick,
  onSelfClick,
  recentlyChanged,
  verificationPrefix,
  stripPrefix,
}: Props) {
  const inputEntries = useMemo(
    () => Object.entries(step.inputs),
    [step.inputs],
  );

  const indexLabel = String(index + 1).padStart(2, "0");
  const isVerification = verificationPrefix
    ? step.id.startsWith(verificationPrefix)
    : step.id.includes(".verif_");

  return (
    <div
      id={step.id}
      onClick={() => onSelfClick?.(step.id)}
      className={[
        "group relative border rounded-lg p-4 transition-all duration-300",
        recentlyChanged
          ? "border-amber-700/60 bg-amber-500/[0.03] shadow-[0_0_0_1px_rgb(245_158_11_/_0.3)]"
          : "border-zinc-800 bg-zinc-950/40",
        isVerification ? "border-l-2 border-l-emerald-700/60" : "",
        onSelfClick ? "cursor-pointer hover:border-zinc-700" : "",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 mr-2">
            {isVerification ? "Verificación" : "Paso"} {indexLabel}
          </span>
          <span className="text-sm font-medium text-zinc-100">{step.name}</span>
        </div>
        {step.code_ref && (
          <span className="text-[10px] text-zinc-500 italic shrink-0">
            {step.code_ref}
          </span>
        )}
      </div>

      <div className="bg-zinc-950 rounded p-3 mb-3 overflow-x-auto">
        <BlockMath math={step.equation_latex} />
      </div>

      {inputEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {inputEntries.map(([name, value]) => {
            const prov: Provenance = classifyVar(name);
            const isHi = highlightVar === name;
            return (
              <button
                key={name}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onVarClick?.(name);
                }}
                title={PROVENANCE_LABEL[prov]}
                className={[
                  "text-[11px] px-2 py-0.5 rounded border font-mono",
                  PROVENANCE_BG[prov],
                  PROVENANCE_TEXT[prov],
                  isHi
                    ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-zinc-950"
                    : "",
                  onVarClick ? "hover:bg-opacity-80 cursor-pointer" : "",
                ].join(" ")}
              >
                {name} = {formatNumber(value, "")}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-baseline gap-2">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">
          ▸
        </span>
        <span className="font-mono text-zinc-200">{step.output_var}</span>
        <span className="text-zinc-500">=</span>
        <span className="font-mono text-emerald-300 text-base font-semibold tabular-nums">
          {formatNumber(step.output_value, step.output_unit)}
        </span>
        {step.output_unit && (
          <span className="text-xs text-zinc-500">{step.output_unit}</span>
        )}
      </div>

      {step.note && (
        <div className="mt-2 text-xs text-zinc-500 italic">{step.note}</div>
      )}

      {step.depends_on.length > 0 && onDependencyClick && (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
          <span className="text-zinc-600">depende de:</span>
          {step.depends_on.map((depId) => (
            <button
              key={depId}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDependencyClick(depId);
              }}
              className="text-zinc-500 hover:text-amber-300 underline-offset-2 hover:underline"
            >
              {stripPrefix
                ? depId.replace(stripPrefix, "")
                : depId}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
