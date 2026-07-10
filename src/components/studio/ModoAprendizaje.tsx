"use client";

/**
 * Modo Aprendizaje — pedagogical wrapper that expands every studio step with
 * plain-Spanish explanations + clickable variable definitions, so a non-engineer
 * client (or a second-year civil engineering student) can READ a Costaplanner
 * page and actually UNDERSTAND the method, not just see formulas.
 *
 * Public API:
 *   <ModoAprendizajeProvider>...</ModoAprendizajeProvider>
 *   useModoAprendizaje() -> { mode, setMode, enabled }
 *   <ModoAprendizajeToggle />            (context-driven, no props)
 *   <ModoAprendizajeToggle value onChange /> (controlled, legacy form)
 *   <VariableChip symbol="Mu" />         (click to open glossary popover)
 *   <ModoAprendizajeBlock>...</ModoAprendizajeBlock>   (children, only renders in aprendizaje)
 *   <ModoAprendizajeBlock step={step} enabled={bool} /> (legacy step-driven form)
 *
 * The toggle persists context state between "avanzado" (default) and
 * "aprendizaje". Wrap the top-level page in ModoAprendizajeProvider and any
 * descendant component can read/toggle the mode.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CalculationStep } from "@/lib/beam-flexure-live";
import {
  GLOSSARY,
  STEP_EXPLANATIONS,
  getPlainDefinition,
  getTypicalValue,
  type GlossaryEntry,
} from "@/lib/glossary";
import { getStepNarrative } from "@/lib/learning-content";

// ───────────────────────────────────────────────────────────
// Context
// ───────────────────────────────────────────────────────────

export type ModoAprendizajeMode = "avanzado" | "aprendizaje";

interface ModoAprendizajeContextValue {
  mode: ModoAprendizajeMode;
  setMode: (m: ModoAprendizajeMode) => void;
  /** Convenience boolean: true when mode === "aprendizaje". */
  enabled: boolean;
}

const ModoAprendizajeContext = createContext<ModoAprendizajeContextValue | null>(null);

export function ModoAprendizajeProvider({
  children,
  defaultMode = "avanzado",
}: {
  children: ReactNode;
  defaultMode?: ModoAprendizajeMode;
}) {
  const [mode, setMode] = useState<ModoAprendizajeMode>(defaultMode);
  return (
    <ModoAprendizajeContext.Provider
      value={{ mode, setMode, enabled: mode === "aprendizaje" }}
    >
      {children}
    </ModoAprendizajeContext.Provider>
  );
}

/** Hook to read/set the current mode. Safe to call without a provider — falls back to "avanzado" + no-op setter. */
export function useModoAprendizaje(): ModoAprendizajeContextValue {
  const ctx = useContext(ModoAprendizajeContext);
  if (ctx) return ctx;
  // Graceful fallback so legacy uses without a provider keep working.
  return {
    mode: "avanzado",
    setMode: () => {},
    enabled: false,
  };
}

// ───────────────────────────────────────────────────────────
// Toggle button (supports both controlled + context-driven modes)
// ───────────────────────────────────────────────────────────

interface ToggleProps {
  /** Controlled value. If omitted, falls back to the surrounding context. */
  value?: boolean;
  /** Controlled change handler. If omitted, falls back to the surrounding context. */
  onChange?: (v: boolean) => void;
}

export function ModoAprendizajeToggle({ value, onChange }: ToggleProps = {}) {
  const ctx = useModoAprendizaje();
  const isControlled = value !== undefined && onChange !== undefined;
  const enabled = isControlled ? (value as boolean) : ctx.enabled;
  const toggle = useCallback(() => {
    if (isControlled) {
      onChange!(!enabled);
    } else {
      ctx.setMode(ctx.enabled ? "avanzado" : "aprendizaje");
    }
  }, [isControlled, onChange, enabled, ctx]);

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
        enabled
          ? "bg-emerald-500/20 text-emerald-200 border border-emerald-700"
          : "bg-zinc-900 text-zinc-400 border border-zinc-700 hover:border-emerald-700/60 hover:text-emerald-300"
      }`}
      title="Activa explicaciones detalladas + glosario interactivo de cada variable"
      aria-pressed={enabled}
    >
      <span className="text-base" aria-hidden>📚</span>
      <span>{enabled ? "Modo Aprendizaje ✓" : "Modo Aprendizaje"}</span>
    </button>
  );
}

// ───────────────────────────────────────────────────────────
// VariableChip — click to open glossary popover
// ───────────────────────────────────────────────────────────

interface VariableChipProps {
  /** The variable symbol/key to look up in the glossary, e.g. "Mu" or "f'c". */
  symbol: string;
  /** Optional override label (defaults to the symbol). */
  children?: ReactNode;
  /** When true, force-render even if the symbol is not in the glossary. */
  alwaysRender?: boolean;
}

/**
 * Inline chip you can drop into any explanation text. Click to open an inline
 * popover with the glossary entry. The chip is keyboard-accessible and
 * dismisses on outside click or Escape.
 */
export function VariableChip({ symbol, children, alwaysRender = false }: VariableChipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const entry: GlossaryEntry | undefined = GLOSSARY[symbol];
  const known = !!entry;

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!known && !alwaysRender) {
    // Unknown symbol → fall back to inline mono text so authors see the gap.
    return <code className="font-mono text-zinc-300">{children ?? symbol}</code>;
  }

  const label = children ?? symbol;

  return (
    <span ref={rootRef} className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center font-mono text-[11px] px-1.5 py-0.5 rounded border transition-colors ${
          known
            ? "bg-emerald-500/10 border-emerald-700/40 text-emerald-300 hover:bg-emerald-500/20 cursor-help"
            : "bg-zinc-800/30 border-zinc-700/40 text-zinc-400 cursor-default"
        } ${open ? "ring-2 ring-emerald-400" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {label}
      </button>
      {open && entry && (
        <span
          role="dialog"
          aria-label={`Glosario: ${entry.full_name}`}
          className="absolute z-20 left-0 top-full mt-1 w-72 border border-emerald-700/40 bg-zinc-950/95 backdrop-blur-sm shadow-2xl rounded-lg p-3 space-y-1.5 text-left"
        >
          <span className="block text-xs text-emerald-300 font-semibold">
            {entry.symbol ?? symbol} — {entry.full_name}
          </span>
          <span className="block text-xs text-zinc-200 leading-relaxed">
            {getPlainDefinition(entry)}
          </span>
          {entry.unit && (
            <span className="block text-[11px] text-zinc-400">
              <span className="text-zinc-500">Unidad: </span>
              {entry.unit}
            </span>
          )}
          {getTypicalValue(entry) && (
            <span className="block text-[11px] text-zinc-400">
              <span className="text-zinc-500">Valor típico: </span>
              {getTypicalValue(entry)}
            </span>
          )}
          {entry.reference && (
            <span className="block text-[11px] text-zinc-500 italic">
              {entry.reference}
            </span>
          )}
          {entry.why && (
            <span className="block text-[11px] text-amber-300/90 italic mt-1">
              {entry.why}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

// ───────────────────────────────────────────────────────────
// ModoAprendizajeBlock — two API shapes
//   1. Legacy: <ModoAprendizajeBlock step={s} enabled={b} />
//      Renders the auto-generated explanation for that step. Used by
//      StudioShell and existing studio pages.
//   2. New (per spec): <ModoAprendizajeBlock>...</ModoAprendizajeBlock>
//      Renders arbitrary children, but ONLY when mode === "aprendizaje"
//      (resolved from context if `enabled` prop is not given).
// ───────────────────────────────────────────────────────────

type BlockProps =
  | {
      step: CalculationStep;
      enabled?: boolean;
      children?: never;
    }
  | {
      step?: never;
      enabled?: boolean;
      children: ReactNode;
    };

export function ModoAprendizajeBlock(props: BlockProps) {
  const ctx = useModoAprendizaje();
  const enabled = props.enabled ?? ctx.enabled;

  // Form 2: arbitrary content wrapper
  if (!("step" in props) || !props.step) {
    if (!enabled) return null;
    return (
      <div className="mt-3 border-t border-emerald-800/40 pt-3 space-y-2 text-xs text-zinc-300 leading-relaxed">
        <div className="text-[10px] uppercase tracking-wider text-amber-400">
          Modo Aprendizaje
        </div>
        {props.children}
      </div>
    );
  }

  // Form 1: step-driven auto-explanation (legacy)
  return <StepDrivenBlock step={props.step} enabled={enabled} />;
}

function StepDrivenBlock({ step, enabled }: { step: CalculationStep; enabled: boolean }) {
  const [activeVar, setActiveVar] = useState<string | null>(null);
  if (!enabled) return null;

  // First priority: hand-authored narrative in STEP_NARRATIVES (learning-content.ts).
  // These are written for non-engineers (architects, contractors, owners) and
  // include intuition hooks + code references. When present they completely
  // replace the auto-generated "¿Qué? / ¿Por qué?" stub.
  const narrative = getStepNarrative(step.id);
  const inputVars = Object.keys(step.inputs);
  const activeEntry: GlossaryEntry | undefined = activeVar ? GLOSSARY[activeVar] : undefined;

  if (narrative) {
    return (
      <div className="mt-3 border-t border-emerald-800/40 pt-3 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-emerald-400">
          Modo Aprendizaje
        </div>
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/10 p-3 space-y-2 text-xs text-zinc-300 leading-relaxed">
          <div>
            <span className="font-semibold text-emerald-300">¿Qué calculas en este paso? </span>
            {narrative.que}
          </div>
          <div>
            <span className="font-semibold text-amber-300">¿Por qué esta fórmula? </span>
            {narrative.porque}
          </div>
          <div className="italic text-sky-300/80">
            <span aria-hidden>💡 </span>
            {narrative.intuicion}
          </div>
        </div>

        {inputVars.length > 0 && (
          <div className="text-xs">
            <span className="text-zinc-500">
              Haz clic en cada variable para entender qué significa:{" "}
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {inputVars.map((v) => {
                const known = !!GLOSSARY[v];
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setActiveVar(activeVar === v ? null : v)}
                    className={`text-[11px] px-2 py-0.5 rounded border font-mono transition-colors ${
                      known
                        ? "bg-emerald-500/10 border-emerald-700/40 text-emerald-300 hover:bg-emerald-500/20"
                        : "bg-zinc-800/30 border-zinc-700/40 text-zinc-500 cursor-default"
                    } ${activeVar === v ? "ring-2 ring-emerald-400" : ""}`}
                    disabled={!known}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeEntry && (
          <div className="border border-emerald-700/40 bg-emerald-900/15 rounded p-3 mt-2 space-y-1">
            <div className="text-xs text-emerald-300 font-semibold">
              {activeVar} — {activeEntry.full_name}
            </div>
            <div className="text-xs text-zinc-200 leading-relaxed">
              {getPlainDefinition(activeEntry)}
            </div>
            {activeEntry.unit && (
              <div className="text-[11px] text-zinc-400">
                <span className="text-zinc-500">Unidad: </span>
                {activeEntry.unit}
              </div>
            )}
            {getTypicalValue(activeEntry) && (
              <div className="text-[11px] text-zinc-400">
                <span className="text-zinc-500">Valor típico: </span>
                {getTypicalValue(activeEntry)}
              </div>
            )}
            {activeEntry.reference && (
              <div className="text-[11px] text-zinc-500 italic">
                {activeEntry.reference}
              </div>
            )}
            {activeEntry.why && (
              <div className="text-[11px] text-amber-300/90 italic mt-1">
                {activeEntry.why}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Fallback path: use STEP_EXPLANATIONS (legacy glossary.ts) or generic stubs.
  const stepExp = STEP_EXPLANATIONS[step.id];
  const fallbackWhat = step.note || `Este paso calcula ${step.output_var} usando la fórmula mostrada.`;
  const fallbackWhy = "Es uno de los pasos del procedimiento estándar para el diseño de este elemento estructural.";

  const what = stepExp?.what ?? fallbackWhat;
  const why = stepExp?.why ?? fallbackWhy;

  return (
    <div className="mt-3 border-t border-zinc-800 pt-3 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-amber-400">
        Modo Aprendizaje
      </div>
      <div className="text-xs text-zinc-300 leading-relaxed">
        <span className="text-emerald-300 font-semibold">¿Qué calculas? </span>
        {what}
      </div>
      <div className="text-xs text-zinc-300 leading-relaxed">
        <span className="text-amber-300 font-semibold">¿Por qué? </span>
        {why}
      </div>

      {inputVars.length > 0 && (
        <div className="text-xs">
          <span className="text-zinc-500">Haz clic en cada variable para entender qué significa: </span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {inputVars.map((v) => {
              const known = !!GLOSSARY[v];
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setActiveVar(activeVar === v ? null : v)}
                  className={`text-[11px] px-2 py-0.5 rounded border font-mono transition-colors ${
                    known
                      ? "bg-emerald-500/10 border-emerald-700/40 text-emerald-300 hover:bg-emerald-500/20"
                      : "bg-zinc-800/30 border-zinc-700/40 text-zinc-500 cursor-default"
                  } ${activeVar === v ? "ring-2 ring-emerald-400" : ""}`}
                  disabled={!known}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeEntry && (
        <div className="border border-emerald-700/40 bg-emerald-900/15 rounded p-3 mt-2 space-y-1">
          <div className="text-xs text-emerald-300 font-semibold">
            {activeVar} — {activeEntry.full_name}
          </div>
          <div className="text-xs text-zinc-200 leading-relaxed">
            {getPlainDefinition(activeEntry)}
          </div>
          {activeEntry.unit && (
            <div className="text-[11px] text-zinc-400">
              <span className="text-zinc-500">Unidad: </span>
              {activeEntry.unit}
            </div>
          )}
          {getTypicalValue(activeEntry) && (
            <div className="text-[11px] text-zinc-400">
              <span className="text-zinc-500">Valor típico: </span>
              {getTypicalValue(activeEntry)}
            </div>
          )}
          {activeEntry.reference && (
            <div className="text-[11px] text-zinc-500 italic">
              {activeEntry.reference}
            </div>
          )}
          {activeEntry.why && (
            <div className="text-[11px] text-amber-300/90 italic mt-1">
              {activeEntry.why}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
