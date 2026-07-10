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
import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
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
import { SaveModal } from "./SaveModal";
import { exportDesignAsExcel } from "@/lib/exporters/excel";
import { printDesignAsPdf } from "@/lib/exporters/pdf";
import type { DesignSnapshot } from "@/lib/exporters/types";
import { ElementDiagram } from "@/components/studio/ElementDiagram";
import { ReinforcementTable } from "@/components/studio/ReinforcementTable";
import {
  BeamDiagramSet, BM1_SectionApoyo, BM2_SectionCentro, BM3_Elevation, BM4_Moments, BM5_Shear,
} from "@/components/studio/BeamDiagrams";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  ModoAprendizajeBlock,
  ModoAprendizajeProvider,
  ModoAprendizajeToggle,
  VariableChip,
} from "@/components/studio/ModoAprendizaje";
import { ReferencesFooter } from "@/components/studio/ReferencesFooter";
import { computeTorsionVigaLive } from "@/lib/torsion-viga-live";
import { computeDeflexionLargoPlazoLive } from "@/lib/deflexion-largo-plazo-live";
import { computeFisuracionLive } from "@/lib/fisuracion-live";

/**
 * Hand-authored "¿Qué? + ¿Por qué? + intuición" explanations for the first
 * five flexure steps. Renders inside <ModoAprendizajeBlock> alongside the
 * auto-generated step-driven block. Keys are the CalculationStep.id values
 * emitted by computeBeamFlexureWithSteps. Steps without an entry get a
 * generic "Explicación pendiente — Avanzado disponible" fallback so the
 * user never sees an empty learning block.
 */
const BEAM_LEARNING_BLOCKS: Record<
  string,
  { what: ReactNode; why: ReactNode; intuition: ReactNode }
> = {
  "flexure.step_01_Mu_kgcm": {
    what: (
      <>
        Convertimos el <VariableChip symbol="Mu" /> que viene del análisis
        estructural (ton·m) a kilogramos-centímetro, que es la unidad en la
        que están <VariableChip symbol="fc" />, <VariableChip symbol="fy" /> y{" "}
        <VariableChip symbol="d" />.
      </>
    ),
    why: (
      <>
        Si mezclamos unidades el resultado puede salir 100 ó 1,000 veces más
        grande o más pequeño y nadie se da cuenta. Forzar una sola familia de
        unidades es la regla #1 de un cálculo Mathcad limpio.
      </>
    ),
    intuition: (
      <>
        Piénsalo como pasar pulgadas a centímetros antes de cortar madera:
        siempre se mide con una sola cinta para no equivocarse.
      </>
    ),
  },
  "flexure.step_02_phi": {
    what: (
      <>
        Fijamos <VariableChip symbol="phi" /> = 0.90. Este φ multiplicará a la
        capacidad nominal <VariableChip symbol="Mn" /> al final del cálculo.
      </>
    ),
    why: (
      <>
        La capacidad teórica del concreto y del acero NUNCA se cumple al 100%:
        el material varía un poco, la viga no se construye perfecta, las
        cargas también varían. φ es un castigo que cubre todas esas
        incertidumbres a la vez.
      </>
    ),
    intuition: (
      <>
        En flexión dúctil φ es alto (0.90) porque la falla avisa: la viga se
        deflecta y se agrieta antes de romperse. En columnas en cambio φ ≈ 0.65
        porque el colapso es súbito y se lleva el edificio entero.
      </>
    ),
  },
  "flexure.step_03_phi_bd2": {
    what: (
      <>
        Calculamos φ·<VariableChip symbol="b" />·<VariableChip symbol="d" />².
        Es el denominador que aparece al despejar la cuantía a partir de la
        ecuación de flexión.
      </>
    ),
    why: (
      <>
        Al combinar la ecuación de equilibrio (T = C) con la del momento (M =
        T·brazo) y sustituir <VariableChip symbol="As" /> = ρ·b·d, aparece este
        producto geométrico-de-resistencia. Lo separamos para tener una
        expresión limpia de <VariableChip symbol="Rn" />.
      </>
    ),
    intuition: (
      <>
        b·d² es la 'medida estructural' de la viga: ancho que reparte, peralte
        al cuadrado que multiplica el brazo. Doblar b duplica la capacidad;
        doblar d la cuadruplica.
      </>
    ),
  },
  "flexure.step_04_Rn": {
    what: (
      <>
        Obtenemos <VariableChip symbol="Mu" /> ÷ (φ·b·d²). Este número, llamado
        Rn, es la "demanda específica" por unidad de área de la viga.
      </>
    ),
    why: (
      <>
        Rn condensa toda la información (cuánto momento, qué tamaño, qué φ) en
        un solo número que permite buscar ρ directamente en la ecuación
        cuadrática siguiente.
      </>
    ),
    intuition: (
      <>
        Es como medir la presión: la fuerza dividida entre el área dice qué
        tan estresado está el material. Rn dice qué tan estresada está esta
        sección de viga.
      </>
    ),
  },
  "flexure.step_05_m": {
    what: (
      <>
        Calculamos m = <VariableChip symbol="fy" /> ÷ (0.85·
        <VariableChip symbol="fc" />). Es la relación entre la resistencia del
        acero y la del concreto (con un factor 0.85 que reduce f'c al valor
        promedio del bloque de Whitney).
      </>
    ),
    why: (
      <>
        Acero y concreto trabajan en pareja: el acero halando, el concreto
        comprimiendo. m mide cuánto más fuerte es el acero que el concreto, y
        sale dentro de la ecuación cuadrática de ρ.
      </>
    ),
    intuition: (
      <>
        Si m crece (acero muy fuerte o concreto débil), un poquito de acero ya
        equilibra mucho concreto comprimido: la viga necesita poca cuantía.
      </>
    ),
  },
};

function PendingLearningBlock() {
  return (
    <p className="italic text-zinc-500">
      Explicación pendiente — Modo Avanzado disponible. (Este paso aún no tiene
      texto narrado; el cálculo y la fórmula son correctos.)
    </p>
  );
}

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
  return (
    <ModoAprendizajeProvider>
      <BeamStudioPageInner />
    </ModoAprendizajeProvider>
  );
}

function BeamStudioPageInner() {
  const [input, setInput] = useState<BeamStudioInput>(DEFAULT_BEAM_INPUT);
  const [mode, setMode] = useState<"live" | "official">("live");
  const [aprendizaje, setAprendizaje] = useState(false);
  const [official, setOfficial] = useState<OfficialState>(emptyOfficial());
  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [highlightVar, setHighlightVar] = useState<string | undefined>();
  const [changedStepIds, setChangedStepIds] = useState<Set<string>>(new Set());
  const [showSave, setShowSave] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  // Auxiliary input for torsión (Tu). 0 hides the torsion sub-panel.
  const [Tu_tonm, setTu] = useState(0);

  // ─── Phase 1: project pre-fill ──────────────────────────────────────────
  // When opened via /studio/beam?proyecto=<id>, read the project's metaJson
  // and seed materials + zona once. Guarded so user edits aren't blown away.
  const { meta, projectName } = useProjectContext();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!meta || prefilledRef.current) return;
    prefilledRef.current = true;
    const patch: Partial<BeamStudioInput> = {};
    if (typeof meta.fc_default === "number") patch.fc = meta.fc_default;
    if (typeof meta.fy_default === "number") patch.fy = meta.fy_default;
    // Map 1|2|3|4 → BeamStudioInput's "II"|"III"|"IV". Zone I falls back to
    // "II" since the form doesn't model zone I yet.
    if (meta.zonaSismica) {
      const map: Record<1 | 2 | 3 | 4, "II" | "III" | "IV"> = {
        1: "II",
        2: "II",
        3: "III",
        4: "IV",
      };
      patch.zona_sismica = map[meta.zonaSismica];
    }
    if (projectName) patch.project_name = projectName;
    if (meta.canton) patch.canton = meta.canton;
    if (Object.keys(patch).length > 0) {
      setInput((curr) => ({ ...curr, ...patch }));
    }
  }, [meta, projectName]);

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

  // ─── Correlation Refactor: live sub-verifications ───────────────────────
  // Torsión en viga — auto-active when Tu > 0. Engine takes b/h/d/r and
  // existing flexure steel (we pass liveCompute.result.As_diseno as the
  // baseline longitudinal). Estribos asumidos #3 @ 15 cm 2-leg (typical).
  const torsionResult = useMemo(() => {
    if (!(Tu_tonm > 0)) return null;
    return computeTorsionVigaLive({
      b_cm: input.b,
      h_cm: input.h,
      d_cm: input.d,
      r_cm: input.recubrimiento,
      Tu_tonm: Tu_tonm,
      Vu_ton: input.Vu_ton,
      Mu_tonm: input.Mu_tonm,
      fc: input.fc,
      fy_long: input.fy,
      fy_transv: input.fy,
      As_long_existing: liveCompute.result.As_diseno,
      Av_existing_cm2: 2 * 0.71, // 2 ramas #3 (estribos típicos)
      s_existing_cm: 15,
      isEquilibrium: false,
    });
  }, [input, Tu_tonm, liveCompute.result.As_diseno]);
  const showTorsion = torsionResult !== null;

  // Deflexión a largo plazo — siempre visible. Necesita cargas en ton/m;
  // las derivamos del Mu de servicio asumiendo viga simplemente apoyada
  // (M = w·L²/8 → w = 8·M/L²). Esto es una aproximación pedagógica: el
  // ingeniero puede usar la calculadora completa para entradas precisas.
  const deflectionResult = useMemo(() => {
    const L_m = input.L_cm / 100;
    const L_safe = Math.max(0.1, L_m);
    // Convert Mu (ultimate) to service: divide by ~1.4 (conservative average
    // load factor). Then split 60% DL / 40% LL (typical residential).
    const Mu_service_tonm = (input.Mu_tonm + input.Mu_pos_tonm) / 2 / 1.4;
    const w_total = (8 * Mu_service_tonm) / (L_safe * L_safe);
    const wD = 0.6 * w_total;
    const wL = 0.4 * w_total;
    return computeDeflexionLargoPlazoLive({
      tipo: "viga_simple",
      L_m: L_safe,
      b_cm: input.b,
      h_cm: input.h,
      d_cm: input.d,
      r_cm: input.recubrimiento,
      fc: input.fc,
      fy: input.fy,
      As_cm2: liveCompute.result.As_diseno,
      AsP_cm2: 0.5 * liveCompute.result.As_diseno, // típico As' ≈ 0.5·As
      wD_tonm: wD,
      wL_tonm: wL,
      sustained_fraction_L: 0.30,
      age_loading_days: 5 * 365,
      limite: "L/240",
    });
  }, [input, liveCompute.result.As_diseno]);

  // Control de fisuración — siempre visible. Asumimos barras #5 distribuidas
  // a lo largo del ancho con el recubrimiento dado.
  const crackResult = useMemo(() => {
    const db_mm = 15.875; // #5 ≈ 15.875 mm
    const nBars = Math.max(2, Math.ceil(liveCompute.result.As_diseno / 1.99));
    const s_actual_cm =
      nBars > 1 ? (input.b - 2 * input.recubrimiento) / (nBars - 1) : input.b;
    return computeFisuracionLive({
      db_mm,
      fy_kgcm2: input.fy,
      cc_cm: input.recubrimiento,
      fs_service_kgcm2: 0, // → engine uses 2/3·fy
      s_actual_cm,
      exposure: "interior",
      h_cm: input.h,
      b_cm: input.b,
      n_bars: nBars,
    });
  }, [input, liveCompute.result.As_diseno]);

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

  const handleSave = useCallback(
    async (args: { name: string; designProjectId: string | null; projectId: string | null }) => {
      const { arch, struct } = buildPair(input);
      // result must exist for save to make sense; if not, run a quick
      // validate first so we have a canonical resultJson to persist.
      let resultJson: Record<string, unknown>;
      if (official.finalResult) {
        // Use the canonical result if we already validated officially
        resultJson = {
          project: official.meta?.project ?? {},
          materials: official.meta?.materials ?? {},
          results: [{
            element_id: "V-1",
            checks: official.finalResult.checks,
            refuerzo: official.finalResult.refuerzo,
            memorando_md: official.finalResult.memorando_md,
            requires_review: official.finalResult.requires_review,
            warnings: official.finalResult.warnings,
            errors: official.finalResult.errors,
            steps: official.steps,
          }],
          summary: official.summary ?? {},
        };
      } else {
        // No official run yet — fetch one inline so the saved record has a
        // canonical structural design payload.
        const r = await fetch("/api/structural/design-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ arch, struct }),
        });
        if (!r.ok) {
          throw new Error(`No se pudo computar oficialmente: HTTP ${r.status}`);
        }
        resultJson = await r.json();
      }
      const saveRes = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: args.name,
          designProjectId: args.designProjectId,
          projectId: args.projectId,
          archJson: arch,
          structJson: struct,
          resultJson,
        }),
      });
      const saved = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saved.error ?? `HTTP ${saveRes.status}`);
      }
      setSavedToast(`Guardado: ${saved.name}`);
      setTimeout(() => setSavedToast(null), 4000);
    },
    [input, official],
  );

  // Snapshot the current design (live or official) into the export-shaped
  // DesignSnapshot, then hand it to the PDF/Excel writers.
  const buildSnapshot = useCallback((): DesignSnapshot => {
    const usingOfficial =
      mode === "official" && official.steps.length > 0 && official.finalResult;
    const steps = usingOfficial ? official.steps : liveCompute.steps;
    const checks = usingOfficial
      ? official.finalResult!.checks.map((c) => ({
          nombre: c.nombre,
          requerido: c.requerido,
          disponible: c.disponible,
          unidad: c.unidad,
          cumple: c.cumple,
          referencia: c.referencia,
        }))
      : [
          {
            nombre: "rho_diseno <= rho_max",
            requerido: liveCompute.result.rho_max_val,
            disponible: liveCompute.result.rho_diseno,
            unidad: "",
            cumple:
              liveCompute.result.rho_diseno <= liveCompute.result.rho_max_val,
            referencia: "ACI §9.3.3.1",
          },
          {
            nombre: "Seccion controlada por traccion (eps_s >= 0.005)",
            requerido: 0.005,
            disponible: liveCompute.result.eps_s,
            unidad: "",
            cumple: liveCompute.result.tension_controlled,
            referencia: "ACI §21.2.2",
          },
        ];

    return {
      title: `Viga V-1 — ${input.project_name}`,
      elementType: "beam",
      project: {
        name: input.project_name,
        canton: input.canton,
        zona_sismica: input.zona_sismica,
      },
      materials: {
        fc: input.fc,
        fy: input.fy,
        acero_norma: input.acero_norma,
      },
      inputs: [
        { name: "b", value: input.b, unit: "cm" },
        { name: "h", value: input.h, unit: "cm" },
        { name: "d", value: input.d, unit: "cm" },
        { name: "recubrimiento", value: input.recubrimiento, unit: "cm" },
        { name: "L", value: input.L_cm, unit: "cm" },
        { name: "Mu (neg)", value: input.Mu_tonm, unit: "ton-m" },
        { name: "Mu (pos)", value: input.Mu_pos_tonm, unit: "ton-m" },
        { name: "Vu", value: input.Vu_ton, unit: "ton" },
        { name: "f'c", value: input.fc, unit: "kg/cm^2" },
        { name: "fy", value: input.fy, unit: "kg/cm^2" },
        { name: "Zona sismica", value: input.zona_sismica },
      ],
      steps,
      checks,
      reinforcement: usingOfficial
        ? {
            longitudinal: official.finalResult!.refuerzo.longitudinal,
            transversal: official.finalResult!.refuerzo.transversal,
          }
        : undefined,
      notes: usingOfficial
        ? [
            ...official.finalResult!.warnings,
            ...official.finalResult!.errors,
          ]
        : liveCompute.result.error
          ? [liveCompute.result.error]
          : [],
      diagrams: renderDiagrams([
        { title: "BM-1 — Sección en apoyo", element: <BM1_SectionApoyo input={input} liveResult={liveCompute.result} /> },
        { title: "BM-2 — Sección en centro", element: <BM2_SectionCentro input={input} liveResult={liveCompute.result} /> },
        { title: "BM-3 — Elevación con aros", element: <BM3_Elevation input={input} liveResult={liveCompute.result} /> },
        { title: "BM-4 — Diagrama de momentos", element: <BM4_Moments input={input} liveResult={liveCompute.result} /> },
        { title: "BM-5 — Diagrama de cortante", element: <BM5_Shear input={input} liveResult={liveCompute.result} /> },
      ]),
    };
  }, [input, mode, official, liveCompute]);

  const handleExportExcel = useCallback(async () => {
    await exportDesignAsExcel(buildSnapshot());
  }, [buildSnapshot]);

  const handleExportPdf = useCallback(() => {
    printDesignAsPdf(buildSnapshot());
  }, [buildSnapshot]);

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
      <div className="max-w-[1600px] mx-auto p-3 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 no-print flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">
              Modo estudio — Viga
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Diseño en vivo estilo Mathcad. Cada fórmula se recalcula al editar
              cualquier entrada. CSCR-10 Rev. 2014 + ACI 318-14.
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Link href="/studio">
              <Button variant="ghost">← Studio</Button>
            </Link>
            <Button
              variant="ghost"
              onClick={handleExportExcel}
              disabled={streaming}
              title="Descargar como Excel"
            >
              Excel
            </Button>
            <Button
              variant="ghost"
              onClick={handleExportPdf}
              disabled={streaming}
              title="Imprimir / guardar como PDF"
            >
              PDF
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowSave(true)}
              disabled={streaming}
            >
              Guardar
            </Button>
            <SaveToProjectButton
              elementType="beam"
              disabled={streaming}
              buildPayload={() => {
                const { arch, struct } = buildPair(input);
                return {
                  archJson: arch,
                  structJson: struct,
                  resultJson: {
                    project: {
                      name: input.project_name,
                      canton: input.canton,
                      zona_sismica: input.zona_sismica,
                    },
                    materials: {
                      fc: input.fc,
                      fy: input.fy,
                      acero_norma: input.acero_norma,
                    },
                    results: [
                      {
                        element_id: "V-1",
                        live: liveCompute.result,
                        steps: liveCompute.steps,
                      },
                    ],
                    summary: {
                      total_elements: 1,
                      passing: liveCompute.result.tension_controlled ? 1 : 0,
                      requires_review: liveCompute.result.tension_controlled ? 0 : 1,
                      with_errors: liveCompute.result.error ? 1 : 0,
                    },
                  },
                };
              }}
            />
            <Button
              onClick={handleValidateOfficially}
              disabled={streaming}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950"
            >
              {streaming ? "Validando..." : "Validar oficialmente"}
            </Button>
            <ModoAprendizajeToggle value={aprendizaje} onChange={setAprendizaje} />
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
            {stepsToRender.map((step, i) => {
              const learning = BEAM_LEARNING_BLOCKS[step.id];
              return (
                <div key={step.id}>
                  <StepRenderer
                    step={step}
                    index={i}
                    highlightVar={highlightVar}
                    onVarClick={handleVarClick}
                    onDependencyClick={handleDependencyClick}
                    recentlyChanged={changedStepIds.has(step.id)}
                  />
                  {/* Hand-authored narrative block (¿Qué? + ¿Por qué? + intuición) */}
                  <ModoAprendizajeBlock enabled={aprendizaje}>
                    {learning ? (
                      <>
                        <p>
                          <span className="text-emerald-300 font-semibold">¿Qué calculas en este paso? </span>
                          {learning.what}
                        </p>
                        <p>
                          <span className="text-amber-300 font-semibold">¿Por qué esta fórmula? </span>
                          {learning.why}
                        </p>
                        <p className="text-zinc-400 italic">
                          <span className="not-italic text-sky-300 font-semibold">Intuición: </span>
                          {learning.intuition}
                        </p>
                      </>
                    ) : (
                      <PendingLearningBlock />
                    )}
                  </ModoAprendizajeBlock>
                  {/* Auto-generated step-driven block (interactive variable chips per step) */}
                  <ModoAprendizajeBlock step={step} enabled={aprendizaje} />
                </div>
              );
            })}
          </main>

          {/* Right: Diagrams + Verifications */}
          <aside className="space-y-3">
            <BeamDiagramSet input={input} liveResult={liveCompute.result} />
            {official.finalResult?.refuerzo && (
              <ReinforcementTable
                longitudinal={official.finalResult.refuerzo.longitudinal?.map((b) => ({
                  n: b.n,
                  size: b.size,
                  As_total: b.As_total,
                  position: b.position,
                }))}
                transversal={official.finalResult.refuerzo.transversal?.map((s) => ({
                  size: s.size,
                  separacion_cm: s.separacion,
                  zona: s.zona,
                  ramas: s.ramas,
                }))}
              />
            )}
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

            {/* ── Correlation Refactor sub-panels ────────────────────────── */}
            {/* Tu opcional input (controls torsion panel visibility) */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 no-print">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Tu (ton-m) — opcional
                </span>
                <input
                  type="number"
                  step={0.1}
                  value={Tu_tonm}
                  onChange={(e) => setTu(parseFloat(e.target.value) || 0)}
                  className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
                />
              </label>
              <p className="text-[10px] text-zinc-500 mt-1">
                Si Tu &gt; 0, se activa verificación de torsión.
              </p>
            </div>

            {/* Sub-panel: Torsión (auto when Tu > 0) */}
            {showTorsion && torsionResult && (
              <details className="border border-amber-700/40 rounded-lg p-3 bg-amber-900/10">
                <summary className="cursor-pointer text-sm text-amber-200 font-semibold">
                  ⚠️ Torsión en viga (Tu = {torsionResult.Tu.toFixed(2)} ton-m)
                </summary>
                <div className="mt-3 space-y-2 text-xs text-zinc-300">
                  <div>Tcr = {torsionResult.Tcr_tonm.toFixed(2)} · Tth = {torsionResult.Tth_tonm.toFixed(2)} ton-m</div>
                  <div>Sección adecuada (combinado): <span className={torsionResult.section_ok ? "text-emerald-400" : "text-red-400"}>{torsionResult.section_ok ? "Sí ✓" : "No ✗"}</span></div>
                  <div>At/s = {torsionResult.At_over_s_cm2cm.toFixed(4)} · Av/s + 2·At/s = {torsionResult.combined_av_at_cm2cm.toFixed(4)} cm²/cm</div>
                  <div>Al diseño = {torsionResult.Al_design_cm2.toFixed(2)} cm² (long. adicional por torsión)</div>
                  <a href="/studio/torsion-viga" className="text-amber-400 hover:underline text-[10px] inline-block">
                    Abrir calculadora completa →
                  </a>
                </div>
              </details>
            )}

            {/* Sub-panel: Deflexión a largo plazo (siempre visible) */}
            <details className="border border-amber-700/40 rounded-lg p-3 bg-amber-900/10">
              <summary className="cursor-pointer text-sm text-amber-200 font-semibold">
                Deflexión a largo plazo (Δ_total = {deflectionResult.delta_total_cm.toFixed(2)} cm · límite L/240 = {deflectionResult.limit_cm.toFixed(2)} cm)
              </summary>
              <div className="mt-3 space-y-2 text-xs text-zinc-300">
                <div>Δinst,L = {deflectionResult.delta_inst_L_cm.toFixed(3)} · Δlong = {deflectionResult.delta_long_cm.toFixed(3)} cm</div>
                <div>λΔ = {deflectionResult.lambda_delta.toFixed(2)} · ρ' = {(deflectionResult.rho_prime * 100).toFixed(2)}%</div>
                <div>Ie,sus = {deflectionResult.Ie_sus.toFixed(0)} · Icr = {deflectionResult.Icr_cm4.toFixed(0)} cm⁴</div>
                <div>
                  Cumple L/240:{" "}
                  <span className={deflectionResult.limite_ok ? "text-emerald-400" : "text-red-400"}>
                    {deflectionResult.limite_ok ? "Sí ✓" : "No ✗"}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 italic">
                  wD/wL derivadas de Mu (viga simple, M=wL²/8). Usa la calculadora completa para cargas precisas.
                </p>
                <a href="/studio/deflexion-largo-plazo" className="text-amber-400 hover:underline text-[10px] inline-block">
                  Abrir calculadora completa →
                </a>
              </div>
            </details>

            {/* Sub-panel: Control de fisuración (siempre visible) */}
            <details className="border border-amber-700/40 rounded-lg p-3 bg-amber-900/10">
              <summary className="cursor-pointer text-sm text-amber-200 font-semibold">
                Control de fisuración (s = {crackResult.s_actual.toFixed(1)} cm · s_max = {crackResult.governing_limit_cm.toFixed(1)} cm)
              </summary>
              <div className="mt-3 space-y-2 text-xs text-zinc-300">
                <div>n_barras estimadas = {crackResult.n_bars} (#5) · fs = {crackResult.fs_kgcm2.toFixed(0)} kg/cm² ({crackResult.fs_MPa.toFixed(0)} MPa)</div>
                <div>s_max₁ (ACI 24.3.2) = {crackResult.s_max1_cm.toFixed(1)} · s_max₂ = {crackResult.s_max2_cm.toFixed(1)} cm</div>
                <div>w_Frosch = {crackResult.w_frosch_mm.toFixed(3)} mm · w_Gergely-Lutz = {crackResult.w_GL_mm.toFixed(3)} mm</div>
                <div>
                  Cumple ACI §24.3.2:{" "}
                  <span className={crackResult.fisura_ok ? "text-emerald-400" : "text-red-400"}>
                    {crackResult.fisura_ok ? "Sí ✓" : "No ✗"}
                  </span>
                </div>
                <a href="/studio/fisuracion" className="text-amber-400 hover:underline text-[10px] inline-block">
                  Abrir calculadora completa →
                </a>
              </div>
            </details>
          </aside>
        </div>

        <ReferencesFooter bundle="beam" />
      </div>

      <SaveModal
        open={showSave}
        onClose={() => setShowSave(false)}
        defaultName={`${input.project_name} - ${new Date().toISOString().slice(0, 10)}`}
        onSave={handleSave}
      />

      {savedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-900/90 border border-emerald-700 text-emerald-100 rounded-lg px-4 py-3 text-sm shadow-2xl">
          {savedToast}
        </div>
      )}
    </div>
  );
}
