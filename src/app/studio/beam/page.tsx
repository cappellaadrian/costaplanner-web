"use client";

/**
 * /structural/beam-studio — Mathcad/Excel-style live walkthrough for a beam.
 *
 * Live mode (default): edit any input, all 19 steps recompute in <16ms via
 * the TypeScript port of the Python flexure procedure. Verifications flip
 * pass/fail in real time.
 *
 * Official mode: click "Validar oficialmente" → opens an SSE stream against
 * costaplanner /design/structural/stream. Each step + final canonical
 * Check[] arrives one at a time and animates in.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  computeBeamFlexureWithSteps,
  type CalculationStep,
} from "@/lib/beam-flexure-live";
import {
  InputEditor,
  DEFAULT_BEAM_INPUT,
  type BeamStudioInput,
} from "./InputEditor";
import { StepRenderer } from "./StepRenderer";
import { VerificationPanel, type OfficialCheck } from "./VerificationPanel";

interface OfficialState {
  meta?: {
    project: { name: string; canton: string; zona_sismica: number };
    materials: { fc: number; fy: number; acero_norma: string };
    element_count: number;
  };
  steps: CalculationStep[];
  finalResult?: {
    checks: OfficialCheck[];
    refuerzo: {
      longitudinal: Array<{ n: number; size: number; As_total: number; position: string }>;
      transversal: Array<{ size: number; separacion: number; ramas: number; zona: string }>;
    };
    memorando_md: string;
    requires_review: boolean;
    warnings: string[];
    errors: string[];
  };
  summary?: {
    total_elements: number;
    passing: number;
    requires_review: number;
    with_errors: number;
  };
  done: boolean;
}

function emptyOfficial(): OfficialState {
  return { steps: [], done: false };
}

// Build the (arch, struct) JSON pair from the form state.
function buildPair(input: BeamStudioInput) {
  const arch = {
    project: {
      name: input.project_name,
      location: {
        province: "San Jose",
        canton: input.canton,
        district: "_",
        seismic_zone: input.zona_sismica,
      },
      occupancy_type: "vivienda_unifamiliar",
    },
    units: { length: "mm", area: "m2", angle: "degrees", coordinate_system: "CRTM05" },
    levels: [
      { id: "L1", name: "Planta Baja", elevation_mm: 0, floor_to_floor_mm: 2800 },
    ],
    elements: {
      beams: [
        {
          id: "V-1",
          level_id: "L1",
          start: [0, 0],
          end: [input.L_cm * 10, 0],
          section: { width_mm: input.b * 10, depth_mm: input.h * 10 },
          material: "concreto_armado",
        },
      ],
    },
  };
  const struct = {
    building_ref: "studio.json",
    materials: {
      fc: input.fc,
      fy: input.fy,
      gamma_concreto: 2400,
      acero_norma: input.acero_norma,
    },
    loads_by_element: {
      "V-1": {
        source: "manual",
        CP: 0,
        CT: 0,
        fR: 1.0,
        f1: 0.5,
        CS: {
          Mu_neg_izq: input.Mu_tonm,
          Mu_neg_der: input.Mu_tonm,
          Mu_pos_izq: input.Mu_pos_tonm,
          Mu_pos_der: input.Mu_pos_tonm,
        },
        Vu_ton: input.Vu_ton,
        reinforcement: {
          tipo: "ductil",
          bc_columna_izq: 40,
          bc_columna_der: 40,
        },
      },
    },
    structural_elements: [],
  };
  return { arch, struct };
}

export default function BeamStudioPage() {
  const [input, setInput] = useState<BeamStudioInput>(DEFAULT_BEAM_INPUT);
  const [mode, setMode] = useState<"live" | "official">("live");
  const [official, setOfficial] = useState<OfficialState>(emptyOfficial());
  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [highlightVar, setHighlightVar] = useState<string | undefined>();
  const [changedStepIds, setChangedStepIds] = useState<Set<string>>(new Set());

  // Live computation: re-run TS port on any input change
  const liveCompute = useMemo(
    () => computeBeamFlexureWithSteps({
      b: input.b,
      d: input.d,
      h: input.h,
      Mu_tonm: input.Mu_tonm,
      fc: input.fc,
      fy: input.fy,
    }),
    [input.b, input.d, input.h, input.Mu_tonm, input.fc, input.fy],
  );

  // Track which step output values changed since last render — used for the
  // brief amber-pulse animation on the affected StepRenderer.
  const prevStepValuesRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const next = new Map(liveCompute.steps.map((s) => [s.id, s.output_value]));
    const changed = new Set<string>();
    next.forEach((v, id) => {
      const prev = prevStepValuesRef.current.get(id);
      if (prev !== undefined && prev !== v) changed.add(id);
    });
    prevStepValuesRef.current = next;
    if (changed.size > 0) {
      setChangedStepIds(changed);
      const timer = setTimeout(() => setChangedStepIds(new Set()), 500);
      return () => clearTimeout(timer);
    }
  }, [liveCompute.steps]);

  // Which steps to render: official (from SSE) when available, otherwise live
  const stepsToRender =
    mode === "official" && official.steps.length > 0
      ? official.steps
      : liveCompute.steps;

  // Run official validation: POST to /api/structural/design and parse the
  // result. We don't use the SSE endpoint here yet because the live page's
  // existing /api/structural/design proxy already returns the full step list
  // for beams (the SSE endpoint is a future enhancement when we want true
  // mid-build streaming). Will switch to SSE in Phase D once the parser is
  // proven against the static-response path.
  const handleValidateOfficially = useCallback(async () => {
    setStreaming(true);
    setStreamError(null);
    setOfficial(emptyOfficial());
    try {
      const { arch, struct } = buildPair(input);
      const r = await fetch("/api/structural/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arch, struct }),
      });
      const body = await r.json();
      if (!r.ok) {
        setStreamError(`HTTP ${r.status}: ${body.error ?? "unknown"}`);
        return;
      }
      // Pick the V-1 result
      const v1 = body.results?.find(
        (x: { element_id: string }) => x.element_id === "V-1",
      );
      if (!v1) {
        setStreamError("Resultado V-1 no encontrado en la respuesta.");
        return;
      }
      setOfficial({
        meta: {
          project: body.project,
          materials: body.materials,
          element_count: body.summary?.total_elements ?? 1,
        },
        steps: (v1.steps as CalculationStep[]) ?? [],
        finalResult: {
          checks: v1.checks,
          refuerzo: v1.refuerzo,
          memorando_md: v1.memorando_md,
          requires_review: v1.requires_review,
          warnings: v1.warnings,
          errors: v1.errors,
        },
        summary: body.summary,
        done: true,
      });
      setMode("official");
    } catch (e) {
      setStreamError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(false);
    }
  }, [input]);

  // Click a variable pill in a step → highlight + scroll to the step that
  // defines that variable (its output_var matches the clicked name).
  const handleVarClick = useCallback(
    (varName: string) => {
      setHighlightVar(varName);
      const sourceStep = liveCompute.steps.find((s) => s.output_var === varName);
      if (sourceStep) {
        document
          .getElementById(sourceStep.id)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setTimeout(() => setHighlightVar(undefined), 1500);
    },
    [liveCompute.steps],
  );

  // Click a dependency chip → scroll to that step
  const handleDependencyClick = useCallback((stepId: string) => {
    document
      .getElementById(stepId)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // Verification panel clicked → highlight + scroll to source steps
  const handleCheckClick = useCallback((sourceStepIds: string[]) => {
    if (sourceStepIds.length === 0) return;
    document
      .getElementById(sourceStepIds[0])
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-[1600px] mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 no-print">
          <div>
            <h1 className="text-2xl font-semibold">
              Modo estudio — Viga
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Diseño en vivo estilo Mathcad. Cada fórmula se recalcula al editar
              cualquier entrada. CSCR-10 Rev. 2014 + ACI 318-14.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Link href="/structural">
              <Button variant="ghost">← Volver</Button>
            </Link>
            <Button
              onClick={handleValidateOfficially}
              disabled={streaming}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950"
            >
              {streaming ? "Validando..." : "Validar oficialmente"}
            </Button>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 items-center no-print">
          <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
            <button
              onClick={() => setMode("live")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                mode === "live"
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Vivo
            </button>
            <button
              onClick={() => setMode("official")}
              disabled={official.steps.length === 0}
              className={`px-3 py-1 text-xs rounded-md transition-colors disabled:opacity-40 ${
                mode === "official"
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Oficial {official.steps.length > 0 && "✓"}
            </button>
          </div>
          <div className="text-[11px] text-zinc-500">
            {mode === "live"
              ? "Modo vivo: edita y observa propagar. Sin red."
              : "Modo oficial: resultados desde costaplanner.vercel.app."}
          </div>
        </div>

        {streamError && (
          <div className="text-xs text-red-400 font-mono whitespace-pre-wrap border border-red-900/40 bg-red-950/20 rounded p-3">
            {streamError}
          </div>
        )}

        {/* 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4">
          {/* Left: Inputs */}
          <aside className="space-y-2 no-print">
            <InputEditor value={input} onChange={setInput} disabled={streaming} />
          </aside>

          {/* Center: Steps */}
          <main className="space-y-3">
            {liveCompute.result.error && (
              <div className="text-xs text-amber-300 border border-amber-700/40 bg-amber-500/5 rounded p-3">
                ⚠ {liveCompute.result.error}
              </div>
            )}
            {stepsToRender.map((step, i) => (
              <StepRenderer
                key={step.id}
                step={step}
                index={i}
                highlightVar={highlightVar}
                onVarClick={handleVarClick}
                onDependencyClick={handleDependencyClick}
                recentlyChanged={changedStepIds.has(step.id)}
              />
            ))}
          </main>

          {/* Right: Verifications */}
          <aside className="space-y-2">
            <VerificationPanel
              liveResult={mode === "live" ? liveCompute.result : undefined}
              officialChecks={
                mode === "official" ? official.finalResult?.checks : undefined
              }
              officialRefuerzo={
                mode === "official" ? official.finalResult?.refuerzo : undefined
              }
              onCheckClick={handleCheckClick}
              L_cm={input.L_cm}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
