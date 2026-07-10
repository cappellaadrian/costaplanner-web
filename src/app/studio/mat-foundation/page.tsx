"use client";

/**
 * /studio/mat-foundation — Losa de fundación (mat / platea).
 * ACI 318-14 §13.3.4 · ACI 336.2R-88 · Bowles §16.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeMatFoundationLive,
  buildMatFoundationSteps,
  buildMatFoundationChecks,
  type MatFoundationInput,
  type MatFoundationLiveResult,
  type MatColumnLoad,
} from "@/lib/mat-foundation-live";

const DEFAULT: MatFoundationInput = {
  L_m: 12,
  B_m: 10,
  h_cm: 50,
  columns: [
    { x_m: 2, y_m: 2, P_ton: 60, bc_cm: 40, hc_cm: 40 },
    { x_m: 10, y_m: 2, P_ton: 60, bc_cm: 40, hc_cm: 40 },
    { x_m: 2, y_m: 8, P_ton: 80, bc_cm: 40, hc_cm: 40 },
    { x_m: 10, y_m: 8, P_ton: 80, bc_cm: 40, hc_cm: 40 },
  ],
  qa_ton_m2: 12,
  k_kg_cm3: 4,
  fc: 280,
  fy: 4200,
  r_cm: 7.5,
  zona: 3,
};

function MatDiagram({ r, columns }: { r: MatFoundationLiveResult; columns: MatColumnLoad[] }) {
  const W = 460, H = 320;
  const margin = 30;
  const pad = 40;
  // Fit L×B inside (W-2margin) × (H-2margin-pad)
  const avail_w = W - 2 * margin;
  const avail_h = H - 2 * margin - pad;
  const scale = Math.min(avail_w / r.L, avail_h / r.B);
  const planW = r.L * scale;
  const planH = r.B * scale;
  const x0 = margin + (avail_w - planW) / 2;
  const y0 = margin + 10;

  // Pressure intensity color: q_max -> red, q_min -> teal
  const qrange = Math.max(0.01, r.q_max - r.q_min);
  const corner = (x: number, y: number) =>
    r.q_max - ((r.q_max - r.q_min) * 0); // placeholder

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
      <defs>
        <pattern id="mat-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#52525b" strokeWidth="0.6" />
        </pattern>
        <linearGradient id="mat-press" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      <text x={margin} y={20} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        Planta {r.L.toFixed(1)} × {r.B.toFixed(1)} m, espesor {r.h.toFixed(0)} cm
      </text>

      {/* Slab outline filled with pressure gradient */}
      <rect x={x0} y={y0} width={planW} height={planH} fill="url(#mat-press)" stroke="#a1a1aa" strokeWidth="1.4" />

      {/* Columns */}
      {columns.map((c, i) => {
        const cx = x0 + (c.x_m / r.L) * planW;
        const cy = y0 + ((r.B - c.y_m) / r.B) * planH;
        return (
          <g key={i}>
            <rect x={cx - 5} y={cy - 5} width={10} height={10} fill="#f59e0b" />
            <text x={cx + 7} y={cy + 4} fill="#f59e0b" fontSize="8" fontFamily="ui-monospace, monospace">
              {c.P_ton.toFixed(0)}t
            </text>
          </g>
        );
      })}

      {/* Centroid */}
      <circle cx={x0 + (r.xR_m / r.L) * planW} cy={y0 + ((r.B - r.yR_m) / r.B) * planH} r={4}
        fill="#10b981" stroke="#0f172a" strokeWidth="1" />
      <text x={x0 + (r.xR_m / r.L) * planW + 6}
            y={y0 + ((r.B - r.yR_m) / r.B) * planH - 6}
            fill="#10b981" fontSize="8" fontFamily="ui-monospace, monospace">
        R
      </text>

      {/* Corner pressure labels */}
      <text x={x0 - 4} y={y0 + planH + 12} fill="#f59e0b" fontSize="9" textAnchor="end" fontFamily="ui-monospace, monospace">
        q1={r.q_corner1.toFixed(1)}
      </text>
      <text x={x0 + planW + 4} y={y0 + planH + 12} fill="#f59e0b" fontSize="9" fontFamily="ui-monospace, monospace">
        q2={r.q_corner2.toFixed(1)}
      </text>
      <text x={x0 + planW + 4} y={y0 - 4} fill="#f59e0b" fontSize="9" fontFamily="ui-monospace, monospace">
        q3={r.q_corner3.toFixed(1)}
      </text>
      <text x={x0 - 4} y={y0 - 4} fill="#f59e0b" fontSize="9" textAnchor="end" fontFamily="ui-monospace, monospace">
        q4={r.q_corner4.toFixed(1)}
      </text>

      <text x={20} y={H - 22} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        ΣP = {r.SumP_ton.toFixed(1)} ton · ex = {r.ex_m.toFixed(3)} m · ey = {r.ey_m.toFixed(3)} m
      </text>
      <text x={20} y={H - 8} fill={r.q_ok ? "#10b981" : "#ef4444"} fontSize="10" fontFamily="ui-monospace, monospace">
        q_max/qa = {(r.q_max / r.qa).toFixed(2)} · δ = {r.delta_max_cm.toFixed(2)} cm
      </text>
    </svg>
  );
}

export default function MatFoundationPage() {
  const [input, setInput] = useState<MatFoundationInput>(DEFAULT);
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
  const result = useMemo(() => computeMatFoundationLive(input), [input]);
  const steps = useMemo(() => buildMatFoundationSteps(result), [result]);
  const checks = useMemo(() => buildMatFoundationChecks(result), [result]);

  function up<K extends keyof MatFoundationInput>(k: K, v: MatFoundationInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }
  function updateColumn(i: number, patch: Partial<MatColumnLoad>) {
    setInput((p) => ({
      ...p,
      columns: p.columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));
  }
  function addColumn() {
    setInput((p) => ({
      ...p,
      columns: [...p.columns, { x_m: input.L_m / 2, y_m: input.B_m / 2, P_ton: 50, bc_cm: 40, hc_cm: 40 }],
    }));
  }
  function removeColumn(i: number) {
    setInput((p) => ({ ...p, columns: p.columns.filter((_, idx) => idx !== i) }));
  }

  return (
    <StudioShell
      title="Losa de fundación (mat)"
      subtitle="Método rígido. ACI 318-14 §13.3.4 · ACI 336.2R-88 · Bowles §16."
      stepPrefix="mat."
      referencesBundle="footing"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Losa de fundación ${input.L_m}×${input.B_m} m`,
          elementType: "mat_foundation",
          zonaSismica: input.zona,
          fc: input.fc,
          fy: input.fy,
          inputs: [
            { name: "L", value: input.L_m, unit: "m" },
            { name: "B", value: input.B_m, unit: "m" },
            { name: "h", value: input.h_cm, unit: "cm" },
            { name: "# columnas", value: input.columns.length },
            { name: "ΣP", value: result.SumP_ton, unit: "ton" },
            { name: "qa", value: input.qa_ton_m2, unit: "ton/m²" },
            { name: "k balasto", value: input.k_kg_cm3, unit: "kg/cm³" },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "MF-1 — Losa de cimentación, contornos M/V", element: <MatDiagram r={result} columns={input.columns} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="mat-foundation"
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
          <InputCard label="Geometría de la losa">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="L" unit="m" value={input.L_m} onChange={(v) => up("L_m", v)} step={0.5} />
              <NumberField label="B" unit="m" value={input.B_m} onChange={(v) => up("B_m", v)} step={0.5} />
              <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} step={5} />
              <NumberField label="r recub." unit="cm" value={input.r_cm} onChange={(v) => up("r_cm", v)} step={0.5} />
            </div>
          </InputCard>

          <InputCard label="Columnas (planta)">
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {input.columns.map((c, i) => (
                <div key={i} className="border border-zinc-800 rounded p-2 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] uppercase text-zinc-500">Col {i + 1}</span>
                    <button onClick={() => removeColumn(i)} className="text-[10px] text-red-400 hover:text-red-300">eliminar</button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <NumberField label="x" unit="m" value={c.x_m} onChange={(v) => updateColumn(i, { x_m: v })} step={0.5} />
                    <NumberField label="y" unit="m" value={c.y_m} onChange={(v) => updateColumn(i, { y_m: v })} step={0.5} />
                    <NumberField label="P" unit="ton" value={c.P_ton} onChange={(v) => updateColumn(i, { P_ton: v })} step={5} source="loads" />
                  </div>
                </div>
              ))}
              <button onClick={addColumn} className="w-full text-xs text-amber-300 border border-amber-700/40 rounded py-1 hover:bg-amber-500/10">
                + agregar columna
              </button>
            </div>
          </InputCard>

          <InputCard label="Suelo">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="qa" unit="ton/m²" value={input.qa_ton_m2} onChange={(v) => up("qa_ton_m2", v)} step={1} source="soil" />
              <NumberField label="k balasto" unit="kg/cm³" value={input.k_kg_cm3} onChange={(v) => up("k_kg_cm3", v)} step={0.5} source="soil" />
            </div>
          </InputCard>

          <InputCard label="Materiales y zona">
            <div className="grid grid-cols-2 gap-2">
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
              Distribución de presiones
            </div>
            <ExpandableDiagram title="Losa de fundación">
              <MatDiagram r={result} columns={input.columns} />
            </ExpandableDiagram>
          </div>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Refuerzo (cada cara)</div>
            <div className="text-zinc-300">Dirección X: #{result.size_x} @ {result.s_x_cm.toFixed(0)} cm</div>
            <div className="text-zinc-300">Dirección Y: #{result.size_y} @ {result.s_y_cm.toFixed(0)} cm</div>
            <div className="text-zinc-500 text-[10px] mt-1">As_min = {result.As_min_cm2_per_m.toFixed(2)} cm²/m (ambas caras combinadas)</div>
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>ACI 318-14 §13.3.4 — losas de fundación.</li>
              <li>ACI 336.2R-88 — análisis y diseño de zapatas combinadas y plateas.</li>
              <li>Bowles (1996) §16 — métodos rígido y elástico.</li>
              <li>Das (2016) §17 — diseño de mats.</li>
              <li>Terzaghi (1955) — módulo de balasto y modelo Winkler.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
