"use client";

/**
 * /studio/combined-footing — Zapata combinada para dos columnas.
 * ACI 318-14 §13.3 · Bowles §10 · Das §16.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeCombinedFootingLive,
  buildCombinedFootingSteps,
  buildCombinedFootingChecks,
  type CombinedFootingInput,
  type CombinedFootingLiveResult,
} from "@/lib/combined-footing-live";

const DEFAULT: CombinedFootingInput = {
  P1_ton: 50,
  P2_ton: 80,
  s_m: 4.0,
  a1_m: 0.5,
  B_m: 2.0,
  h_cm: 70,
  b1_cm: 40,
  h1_cm: 40,
  b2_cm: 50,
  h2_cm: 50,
  qa_ton_m2: 15,
  fc: 280,
  fy: 4200,
  r_cm: 7.5,
  zona: 3,
};

// ---------------------------------------------------------------------------
// Inline diagram — plan + section showing M(x), V(x) under the 2 columns
// ---------------------------------------------------------------------------
function CombinedFootingDiagram({ r }: { r: CombinedFootingLiveResult }) {
  const W = 480, H = 320;
  const margin = 30;
  const usable = W - 2 * margin;
  const L = Math.max(0.001, r.L_m);
  const scale = usable / L; // px per m
  const x_col1 = margin + r.a1 * scale;
  const x_col2 = x_col1 + r.s * scale;
  const yPlan = 50;
  const planH = 40;
  const ySec = 130;
  const secH = 30;
  const yM = 200;
  const yV = 270;
  const maxM = Math.max(r.M_neg_max_tonm, r.M_pos_cant_left_tonm, r.M_pos_cant_right_tonm, 0.01);
  const ampM = 30;
  // sample 40 points along the beam to draw M(x)
  const samples = 60;
  const Mpoints: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const xm = (i / samples) * L;
    const w = r.w_ton_m;
    // moment at xm in beam-on-soil model:
    let M = (w * xm * xm) / 2;
    if (xm > r.a1) M -= r.P1 * (xm - r.a1);
    if (xm > r.a1 + r.s) M -= r.P2 * (xm - r.a1 - r.s);
    // moment sign convention: positive M -> sag (acero abajo)
    const xpx = margin + (xm / L) * usable;
    const ypx = yM - (M / maxM) * ampM;
    Mpoints.push(`${xpx.toFixed(1)},${ypx.toFixed(1)}`);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
      <defs>
        <pattern id="cf-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#52525b" strokeWidth="0.6" />
        </pattern>
      </defs>

      {/* Plan (top) */}
      <text x={margin} y={20} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        Planta  L = {r.L_m.toFixed(2)} m × B = {r.B.toFixed(2)} m
      </text>
      <rect x={margin} y={yPlan} width={usable} height={planH}
        fill="url(#cf-hatch)" stroke="#a1a1aa" strokeWidth="1.2" />
      {/* Cols on plan */}
      <rect x={x_col1 - 6} y={yPlan + planH / 2 - 6} width={12} height={12} fill="#f59e0b" />
      <text x={x_col1} y={yPlan - 4} textAnchor="middle" fill="#f59e0b" fontSize="9" fontFamily="ui-monospace, monospace">
        P1={r.P1.toFixed(0)}t
      </text>
      <rect x={x_col2 - 7} y={yPlan + planH / 2 - 7} width={14} height={14} fill="#f59e0b" />
      <text x={x_col2} y={yPlan - 4} textAnchor="middle" fill="#f59e0b" fontSize="9" fontFamily="ui-monospace, monospace">
        P2={r.P2.toFixed(0)}t
      </text>

      {/* Section (middle) */}
      <text x={margin} y={ySec - 8} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        Sección con presión q = {r.q_ton_m2.toFixed(2)} ton/m²
      </text>
      <rect x={margin} y={ySec} width={usable} height={secH}
        fill="url(#cf-hatch)" stroke="#a1a1aa" strokeWidth="1.2" />
      {/* Upward arrows representing soil pressure */}
      {Array.from({ length: 14 }).map((_, i) => {
        const xa = margin + (usable * (i + 0.5)) / 14;
        return (
          <line key={i} x1={xa} y1={ySec + secH + 16} x2={xa} y2={ySec + secH + 2}
            stroke="#10b981" strokeWidth="1.2" markerEnd="url(#joint-arrow)" />
        );
      })}
      <text x={W - margin} y={ySec + secH + 24} textAnchor="end" fill="#10b981" fontSize="9" fontFamily="ui-monospace, monospace">
        w = q·B = {r.w_ton_m.toFixed(2)} ton/m
      </text>
      {/* Cols on section */}
      <rect x={x_col1 - 6} y={ySec - 14} width={12} height={14} fill="#f59e0b" />
      <rect x={x_col2 - 7} y={ySec - 16} width={14} height={16} fill="#f59e0b" />

      {/* Moment diagram */}
      <text x={margin} y={yM - ampM - 4} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        M(x) — Mmax(-) = {r.M_neg_max_tonm.toFixed(2)} t·m
      </text>
      <line x1={margin} y1={yM} x2={W - margin} y2={yM} stroke="#52525b" strokeWidth="0.6" strokeDasharray="3,3" />
      <polyline points={Mpoints.join(" ")} fill="none" stroke="#ef4444" strokeWidth="1.5" />

      {/* Shear arrows */}
      <text x={margin} y={yV - 4} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        Vmax cara col = {r.V_max_ton.toFixed(2)} ton
      </text>
      <line x1={margin} y1={yV} x2={W - margin} y2={yV} stroke="#52525b" strokeWidth="0.6" strokeDasharray="3,3" />

      <text x={20} y={H - 6} fill={r.q_ok ? "#10b981" : "#ef4444"} fontSize="10" fontFamily="ui-monospace, monospace">
        q/qa = {(r.q_ton_m2 / r.qa).toFixed(2)} ({r.q_ok ? "OK" : "FALLA"})
      </text>

      <defs>
        <marker id="joint-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#10b981" />
        </marker>
      </defs>
    </svg>
  );
}

export default function CombinedFootingPage() {
  const [input, setInput] = useState<CombinedFootingInput>(DEFAULT);
  const { meta, projectName } = useProjectContext();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!meta || prefilledRef.current) return;
    prefilledRef.current = true;
    setInput((p) => ({
      ...p,
      fc: meta.fc_default ?? p.fc,
      fy: meta.fy_default ?? p.fy,
      zona: (meta.zonaSismica as 1 | 2 | 3 | 4) ?? p.zona,
      qa_ton_m2: meta.qa_ton_m2 ?? p.qa_ton_m2,
    }));
  }, [meta]);
  const result = useMemo(() => computeCombinedFootingLive(input), [input]);
  const steps = useMemo(() => buildCombinedFootingSteps(result), [result]);
  const checks = useMemo(() => buildCombinedFootingChecks(result), [result]);

  function up<K extends keyof CombinedFootingInput>(k: K, v: CombinedFootingInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Zapata combinada"
      subtitle="Dos columnas, análisis viga-sobre-suelo. ACI 318-14 §13.3 · Bowles §10."
      stepPrefix="comb_ftg."
      referencesBundle="footing"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Zapata combinada ${result.L_m.toFixed(2)}×${input.B_m.toFixed(2)} m`,
          elementType: "combined_footing",
          zonaSismica: input.zona,
          fc: input.fc,
          fy: input.fy,
          inputs: [
            { name: "P1", value: input.P1_ton, unit: "ton" },
            { name: "P2", value: input.P2_ton, unit: "ton" },
            { name: "s entre cols", value: input.s_m, unit: "m" },
            { name: "a1 (volado)", value: input.a1_m, unit: "m" },
            { name: "B ancho", value: input.B_m, unit: "m" },
            { name: "h espesor", value: input.h_cm, unit: "cm" },
            { name: "Col 1", value: `${input.b1_cm}×${input.h1_cm}`, unit: "cm" },
            { name: "Col 2", value: `${input.b2_cm}×${input.h2_cm}`, unit: "cm" },
            { name: "qa", value: input.qa_ton_m2, unit: "ton/m²" },
            { name: "L requerida", value: result.L_m, unit: "m" },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "CF-1 — Zapata combinada en planta", element: <CombinedFootingDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="combined-footing"
          buildPayload={() => ({
            archJson: { project_name: projectName ?? "Diseño" },
            structJson: { ...input },
            resultJson: {
              ...result,
              summary: {
                total_elements: 1,
                passing: checks.every((c) => c.cumple) ? 1 : 0,
                requires_review: 0,
                with_errors: 0,
              },
            },
          })}
        />
      }
      inputs={
        <>
          <InputCard label="Cargas de columnas (ton)">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="P1" unit="ton" value={input.P1_ton} onChange={(v) => up("P1_ton", v)} step={1} source="loads" />
              <NumberField label="P2" unit="ton" value={input.P2_ton} onChange={(v) => up("P2_ton", v)} step={1} source="loads" />
            </div>
          </InputCard>

          <InputCard label="Geometría en planta">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="s (cols)" unit="m" value={input.s_m} onChange={(v) => up("s_m", v)} step={0.1} />
              <NumberField label="a1 (volado)" unit="m" value={input.a1_m} onChange={(v) => up("a1_m", v)} step={0.1} />
              <NumberField label="B (ancho)" unit="m" value={input.B_m} onChange={(v) => up("B_m", v)} step={0.1} />
              <NumberField label="h (espesor)" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} step={5} />
            </div>
          </InputCard>

          <InputCard label="Columna 1 (cm)">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="b1" unit="cm" value={input.b1_cm} onChange={(v) => up("b1_cm", v)} step={5} />
              <NumberField label="h1" unit="cm" value={input.h1_cm} onChange={(v) => up("h1_cm", v)} step={5} />
            </div>
          </InputCard>

          <InputCard label="Columna 2 (cm)">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="b2" unit="cm" value={input.b2_cm} onChange={(v) => up("b2_cm", v)} step={5} />
              <NumberField label="h2" unit="cm" value={input.h2_cm} onChange={(v) => up("h2_cm", v)} step={5} />
            </div>
          </InputCard>

          <InputCard label="Suelo y materiales">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="qa" unit="ton/m²" value={input.qa_ton_m2} onChange={(v) => up("qa_ton_m2", v)} step={1} source="soil" />
              <NumberField label="r recub." unit="cm" value={input.r_cm} onChange={(v) => up("r_cm", v)} step={0.5} />
              <NumberField label="f'c" unit="kg/cm²" value={input.fc} onChange={(v) => up("fc", v)} step={5} />
              <NumberField label="fy" unit="kg/cm²" value={input.fy} onChange={(v) => up("fy", v)} step={100} />
            </div>
            <select className="w-full mt-2 bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.zona}
              onChange={(e) => up("zona", parseInt(e.target.value) as 1 | 2 | 3 | 4)}>
              <option value={1}>Zona I</option><option value={2}>Zona II</option>
              <option value={3}>Zona III</option><option value={4}>Zona IV</option>
            </select>
          </InputCard>
        </>
      }
      steps={steps}
      checks={checks}
      reinforcement={
        <>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              Diagrama planta + M(x)
            </div>
            <ExpandableDiagram title="Zapata combinada">
              <CombinedFootingDiagram r={result} />
            </ExpandableDiagram>
          </div>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Refuerzo</div>
            <div className="text-zinc-300">Longitudinal superior (M-): {result.n_top} #{result.size_top}</div>
            <div className="text-zinc-300">Longitudinal inferior (M+): {result.n_bot} #{result.size_bot}</div>
            <div className="text-zinc-300">Banda transversal col 1: {result.n_trans1} #{result.size_trans1}</div>
            <div className="text-zinc-300">Banda transversal col 2: {result.n_trans2} #{result.size_trans2}</div>
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>ACI 318-14 §13.2 y §13.3 — fundaciones, zapatas de dos columnas.</li>
              <li>Bowles, J.E. (1996) §10 — combined footings, trapezoidal layout.</li>
              <li>Das, B.M. (2016) §16 — analysis of combined footings.</li>
              <li>ACI 318-14 §22.5 y §22.6 — cortante en una dirección y punzonamiento.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
