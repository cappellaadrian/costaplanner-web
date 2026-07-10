"use client";

/**
 * /studio/pile-cap — Pilote + cabezal.
 * ACI 318-14 §13.4 + §23 · AASHTO LRFD §10.7 · CRSI §11.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computePileCapLive,
  buildPileCapSteps,
  buildPileCapChecks,
  type PileCapInput,
  type PileCapLiveResult,
  type PileCount,
} from "@/lib/pile-cap-live";

const DEFAULT: PileCapInput = {
  Pu_ton: 200,
  Mu_tonm: 20,
  n_piles: 4,
  s_m: 1.5,
  D_cm: 40,
  L_pile_m: 12,
  qp_kPa: 3000,
  fs_kPa: 40,
  bc_cm: 50,
  hc_cm: 50,
  h_cap_cm: 80,
  fc: 280,
  fy: 4200,
  r_cm: 7.5,
  zona: 3,
  seismic: false,
};

function PileCapDiagram({ r }: { r: PileCapLiveResult }) {
  const W = 460, H = 320;
  const cx = W / 2;
  // Top: plan view of pile cap
  const planY = 40;
  const planHpx = 130;
  const planCx = cx;
  const planCy = planY + planHpx / 2;
  const sPx = 50; // pixel spacing between pile centers

  // Section view at bottom
  const secY = 200;
  const secHpx = 90;

  // Compute pile positions for plan
  const positions: { x: number; y: number; P: number }[] = [];
  if (r.n_piles === 2) {
    positions.push({ x: planCx - sPx, y: planCy, P: r.pile_loads_ton[0] });
    positions.push({ x: planCx + sPx, y: planCy, P: r.pile_loads_ton[1] });
  } else if (r.n_piles === 3) {
    positions.push({ x: planCx - sPx / 2, y: planCy + sPx / 2, P: r.pile_loads_ton[0] });
    positions.push({ x: planCx + sPx / 2, y: planCy + sPx / 2, P: r.pile_loads_ton[1] });
    positions.push({ x: planCx, y: planCy - sPx / 2, P: r.pile_loads_ton[2] });
  } else {
    positions.push({ x: planCx - sPx, y: planCy - sPx / 2, P: r.pile_loads_ton[0] });
    positions.push({ x: planCx + sPx, y: planCy - sPx / 2, P: r.pile_loads_ton[1] });
    positions.push({ x: planCx + sPx, y: planCy + sPx / 2, P: r.pile_loads_ton[2] });
    positions.push({ x: planCx - sPx, y: planCy + sPx / 2, P: r.pile_loads_ton[3] });
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
      <defs>
        <pattern id="pc-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#52525b" strokeWidth="0.6" />
        </pattern>
      </defs>

      {/* Plan view */}
      <text x={20} y={20} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        Planta del cabezal — {r.n_piles} pilotes Ø{r.D.toFixed(0)} cm @ {r.s.toFixed(1)} m
      </text>
      {/* Cap outline */}
      <rect x={planCx - sPx - 25} y={planCy - sPx / 2 - 25} width={2 * sPx + 50} height={sPx + 50}
        fill="url(#pc-hatch)" stroke="#a1a1aa" strokeWidth="1.4" />
      {/* Column */}
      <rect x={planCx - 12} y={planCy - 12} width={24} height={24} fill="#f59e0b" stroke="#fb923c" strokeWidth="1.2" />
      <text x={planCx} y={planCy + 3} textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold" fontFamily="ui-monospace, monospace">
        Pu
      </text>
      {/* Piles */}
      {positions.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={12} fill="#3b82f6" stroke="#60a5fa" strokeWidth="1.2" />
          <text x={p.x} y={p.y + 3} textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold" fontFamily="ui-monospace, monospace">
            {p.P.toFixed(0)}
          </text>
          {/* Strut-tie lines */}
          <line x1={planCx} y1={planCy} x2={p.x} y2={p.y} stroke="#ef4444" strokeWidth="1" strokeDasharray="2,2" />
        </g>
      ))}

      {/* Section view */}
      <text x={20} y={secY - 10} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        Sección — h_cap = {r.h_cap.toFixed(0)} cm, d = {r.d_cap_cm.toFixed(1)} cm
      </text>
      <rect x={planCx - sPx - 25} y={secY} width={2 * sPx + 50} height={40}
        fill="url(#pc-hatch)" stroke="#a1a1aa" strokeWidth="1.4" />
      {/* Column on section */}
      <rect x={planCx - 12} y={secY - 20} width={24} height={22} fill="#f59e0b" />
      {/* Piles below */}
      <rect x={planCx - sPx - 5} y={secY + 40} width={10} height={40} fill="#3b82f6" />
      <rect x={planCx + sPx - 5} y={secY + 40} width={10} height={40} fill="#3b82f6" />
      {/* Tie bars (horizontal line near bottom of cap) */}
      <line x1={planCx - sPx - 20} y1={secY + 33} x2={planCx + sPx + 20} y2={secY + 33}
        stroke="#ef4444" strokeWidth="2" />
      <text x={planCx + sPx + 22} y={secY + 37} fill="#ef4444" fontSize="9" fontFamily="ui-monospace, monospace">
        T={r.T_tie_ton.toFixed(1)}t
      </text>
      {/* Strut compression diagonals */}
      <line x1={planCx} y1={secY + 5} x2={planCx - sPx} y2={secY + 35} stroke="#10b981" strokeWidth="1.5" />
      <line x1={planCx} y1={secY + 5} x2={planCx + sPx} y2={secY + 35} stroke="#10b981" strokeWidth="1.5" />

      <text x={20} y={H - 8} fill={r.load_ok ? "#10b981" : "#ef4444"} fontSize="10" fontFamily="ui-monospace, monospace">
        P_max/Qa = {(r.Pi_max_ton / Math.max(0.01, r.Qa_ton)).toFixed(2)} ({r.load_ok ? "OK" : "FALLA"})
      </text>
    </svg>
  );
}

export default function PileCapPage() {
  const [input, setInput] = useState<PileCapInput>(DEFAULT);
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
    }));
  }, [meta]);
  const result = useMemo(() => computePileCapLive(input), [input]);
  const steps = useMemo(() => buildPileCapSteps(result), [result]);
  const checks = useMemo(() => buildPileCapChecks(result), [result]);

  function up<K extends keyof PileCapInput>(k: K, v: PileCapInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Pilote + cabezal"
      subtitle="Strut-and-tie. ACI 318-14 §13.4 + §23 · AASHTO LRFD §10.7."
      stepPrefix="pile_cap."
      referencesBundle="footing"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Cabezal ${input.n_piles}-pilotes Ø${input.D_cm} cm`,
          elementType: "pile_cap",
          zonaSismica: input.zona,
          fc: input.fc,
          fy: input.fy,
          inputs: [
            { name: "Pu", value: input.Pu_ton, unit: "ton" },
            { name: "Mu", value: input.Mu_tonm, unit: "ton·m" },
            { name: "# pilotes", value: input.n_piles },
            { name: "s", value: input.s_m, unit: "m" },
            { name: "Ø pilote", value: input.D_cm, unit: "cm" },
            { name: "L pilote", value: input.L_pile_m, unit: "m" },
            { name: "qp", value: input.qp_kPa, unit: "kPa" },
            { name: "fs", value: input.fs_kPa, unit: "kPa" },
            { name: "Qa", value: result.Qa_ton, unit: "ton" },
            { name: "P_max pilote", value: result.Pi_max_ton, unit: "ton" },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "PC-1 — Cabezal de pilotes (planta + sección)", element: <PileCapDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="pile-cap"
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
          <InputCard label="Cargas de la columna">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Pu" unit="ton" value={input.Pu_ton} onChange={(v) => up("Pu_ton", v)} step={10} source="loads" />
              <NumberField label="Mu" unit="ton·m" value={input.Mu_tonm} onChange={(v) => up("Mu_tonm", v)} step={1} source="loads" />
            </div>
          </InputCard>

          <InputCard label="Grupo de pilotes">
            <select className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.n_piles}
              onChange={(e) => up("n_piles", parseInt(e.target.value) as PileCount)}>
              <option value={2}>2 pilotes (lineal)</option>
              <option value={3}>3 pilotes (triangular)</option>
              <option value={4}>4 pilotes (cuadrado)</option>
            </select>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <NumberField label="s separación" unit="m" value={input.s_m} onChange={(v) => up("s_m", v)} step={0.1} />
              <NumberField label="Ø pilote" unit="cm" value={input.D_cm} onChange={(v) => up("D_cm", v)} step={5} />
              <NumberField label="L pilote" unit="m" value={input.L_pile_m} onChange={(v) => up("L_pile_m", v)} step={1} />
              <NumberField label="h cabezal" unit="cm" value={input.h_cap_cm} onChange={(v) => up("h_cap_cm", v)} step={5} />
            </div>
          </InputCard>

          <InputCard label="Resistencias del suelo (kPa)">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="qp punta" unit="kPa" value={input.qp_kPa} onChange={(v) => up("qp_kPa", v)} step={100} source="soil" />
              <NumberField label="fs fuste" unit="kPa" value={input.fs_kPa} onChange={(v) => up("fs_kPa", v)} step={5} source="soil" />
            </div>
            <label className="flex items-center gap-2 mt-2 text-xs text-zinc-300">
              <input type="checkbox" checked={input.seismic}
                onChange={(e) => up("seismic", e.target.checked)} />
              Combinación sísmica (FS = 2 en vez de 3)
            </label>
          </InputCard>

          <InputCard label="Columna (cm)">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="bc" unit="cm" value={input.bc_cm} onChange={(v) => up("bc_cm", v)} step={5} />
              <NumberField label="hc" unit="cm" value={input.hc_cm} onChange={(v) => up("hc_cm", v)} step={5} />
            </div>
          </InputCard>

          <InputCard label="Materiales y zona">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="f'c" unit="kg/cm²" value={input.fc} onChange={(v) => up("fc", v)} step={5} />
              <NumberField label="fy" unit="kg/cm²" value={input.fy} onChange={(v) => up("fy", v)} step={100} />
              <NumberField label="r recub." unit="cm" value={input.r_cm} onChange={(v) => up("r_cm", v)} step={0.5} />
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
              Pilotes + cabezal + strut-tie
            </div>
            <ExpandableDiagram title="Cabezal de pilotes">
              <PileCapDiagram r={result} />
            </ExpandableDiagram>
          </div>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Refuerzo y capacidades</div>
            <div className="text-zinc-300">Capacidad pilote: Qu = {result.Qu_ton.toFixed(1)} ton / Qa = {result.Qa_ton.toFixed(1)} ton</div>
            <div className="text-zinc-300">Pilote más cargado: {result.Pi_max_ton.toFixed(1)} ton</div>
            <div className="text-zinc-300">Tirante (ambas direcciones): {result.n_tie} #{result.size_tie}</div>
            <div className="text-zinc-500 text-[10px] mt-1">As req = {result.As_tie_req.toFixed(2)}, prov = {result.As_tie_prov.toFixed(2)} cm²</div>
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>ACI 318-14 §13.4 — pilotes y cabezales.</li>
              <li>ACI 318-14 §23 — modelos strut-and-tie.</li>
              <li>AASHTO LRFD Bridge Design Spec §10.7 — capacidad de pilotes hincados.</li>
              <li>CRSI Design Handbook §11 — diseño práctico de cabezales.</li>
              <li>Das (2016) §17 — análisis y diseño de pilotes.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
