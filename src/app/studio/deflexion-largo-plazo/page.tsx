"use client";

/**
 * /studio/deflexion-largo-plazo — Deflexiones inmediata + largo plazo.
 * ACI 318-14 §24.2 + Table 24.2.2 · Branson (1965) · ACI 435.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeDeflexionLargoPlazoLive,
  buildDeflexionLargoPlazoSteps,
  buildDeflexionLargoPlazoChecks,
  type DeflexionLargoPlazoInput,
  type DeflexionLargoPlazoResult,
} from "@/lib/deflexion-largo-plazo-live";

const DEFAULT: DeflexionLargoPlazoInput = {
  tipo: "viga_simple",
  L_m: 6.0,
  b_cm: 25,
  h_cm: 50,
  d_cm: 44,
  r_cm: 4,
  fc: 280,
  fy: 4200,
  As_cm2: 7.0,
  AsP_cm2: 2.0,
  wD_tonm: 1.2,
  wL_tonm: 1.8,
  sustained_fraction_L: 0.30,
  age_loading_days: 1825, // 5 años
  limite: "L/360",
};

function DeflexionDiagram({ r }: { r: DeflexionLargoPlazoResult }) {
  const W = 480, H = 320;
  const margin = 40;
  const beamY = 70;
  const Lpx = W - 2 * margin;
  // Beam line
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
      <text x={margin} y={20} fill="#a1a1aa" fontSize="11" fontFamily="ui-monospace, monospace">
        Elemento {r.tipo.replace("_", " ")} L = {r.L.toFixed(2)} m
      </text>
      {/* Top: undeformed beam */}
      <line x1={margin} y1={beamY} x2={W - margin} y2={beamY} stroke="#52525b" strokeWidth="2" strokeDasharray="3,3" />
      {r.tipo === "volado" ? (
        <rect x={margin - 6} y={beamY - 30} width={12} height={40} fill="url(#defl-hatch)" stroke="#a1a1aa" />
      ) : (
        <>
          <polygon points={`${margin},${beamY} ${margin - 6},${beamY + 12} ${margin + 6},${beamY + 12}`} fill="#a1a1aa" />
          <polygon points={`${W - margin},${beamY} ${W - margin - 6},${beamY + 12} ${W - margin + 6},${beamY + 12}`} fill="#a1a1aa" />
        </>
      )}
      <defs>
        <pattern id="defl-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#a1a1aa" strokeWidth="0.6" />
        </pattern>
      </defs>

      {/* Load arrows on top */}
      {Array.from({ length: 14 }).map((_, i) => {
        const xa = margin + (Lpx * (i + 0.5)) / 14;
        return (
          <line key={i} x1={xa} y1={beamY - 18} x2={xa} y2={beamY - 2}
            stroke="#ef4444" strokeWidth="1.2" markerEnd="url(#defl-arrow)" />
        );
      })}
      <text x={W - margin} y={beamY - 22} textAnchor="end" fill="#ef4444" fontSize="9" fontFamily="ui-monospace, monospace">
        wD + wL = {(r.wD + r.wL).toFixed(2)} ton/m
      </text>

      {/* Instantaneous deflection (yellow) — parabolic */}
      <polyline
        points={Array.from({ length: 30 }, (_, i) => {
          const f = i / 29;
          const x = margin + f * Lpx;
          let dy = 0;
          if (r.tipo === "volado") {
            dy = r.delta_inst_DL_cm * Math.pow(f, 2);
          } else {
            dy = r.delta_inst_DL_cm * 4 * f * (1 - f);
          }
          // px scale: 1 cm real = 12 px
          return `${x},${beamY + dy * 12}`;
        }).join(" ")}
        fill="none" stroke="#fbbf24" strokeWidth="1.5"
      />
      {/* Long-term deflection (red) */}
      <polyline
        points={Array.from({ length: 30 }, (_, i) => {
          const f = i / 29;
          const x = margin + f * Lpx;
          let dy = 0;
          if (r.tipo === "volado") {
            dy = r.delta_total_cm * Math.pow(f, 2);
          } else {
            dy = r.delta_total_cm * 4 * f * (1 - f);
          }
          return `${x},${beamY + dy * 12}`;
        }).join(" ")}
        fill="none" stroke="#ef4444" strokeWidth="2"
      />

      {/* Legend / values */}
      <text x={margin} y={H - 70} fill="#fbbf24" fontSize="10" fontFamily="ui-monospace, monospace">
        Δinst,L = {r.delta_inst_L_cm.toFixed(3)} cm
      </text>
      <text x={margin} y={H - 55} fill="#ef4444" fontSize="10" fontFamily="ui-monospace, monospace">
        Δtotal = Δinst,L + λΔ·Δsus = {r.delta_total_cm.toFixed(3)} cm
      </text>
      <text x={margin} y={H - 40} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        λΔ = ξ/(1+50ρ') = {r.lambda_delta.toFixed(2)} (ξ = {r.xi.toFixed(1)})
      </text>
      <text x={margin} y={H - 25} fill={r.limite_ok ? "#10b981" : "#ef4444"} fontSize="10" fontFamily="ui-monospace, monospace">
        Límite {r.limite} = {r.limit_cm.toFixed(2)} cm → {r.limite_ok ? "OK" : "FALLA"}
      </text>
      <text x={margin} y={H - 10} fill="#a1a1aa" fontSize="9" fontFamily="ui-monospace, monospace">
        Ie_DL = {r.Ie_DL.toFixed(0)} cm⁴ (Ig = {r.Ig_cm4.toFixed(0)}, Icr = {r.Icr_cm4.toFixed(0)})
      </text>

      <defs>
        <marker id="defl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#ef4444" />
        </marker>
      </defs>
    </svg>
  );
}

export default function DeflexionLargoPlazoPage() {
  const [input, setInput] = useState<DeflexionLargoPlazoInput>(DEFAULT);
  const { meta, projectName } = useProjectContext();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!meta || prefilledRef.current) return;
    prefilledRef.current = true;
    setInput((p) => ({
      ...p,
      fc: meta.fc_default ?? p.fc,
      fy: meta.fy_default ?? p.fy,
    }));
  }, [meta]);
  const result = useMemo(() => computeDeflexionLargoPlazoLive(input), [input]);
  const steps = useMemo(() => buildDeflexionLargoPlazoSteps(result), [result]);
  const checks = useMemo(() => buildDeflexionLargoPlazoChecks(result), [result]);

  function up<K extends keyof DeflexionLargoPlazoInput>(k: K, v: DeflexionLargoPlazoInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Deflexión a largo plazo"
      subtitle="Branson Ie + λΔ. ACI 318-14 §24.2 + Table 24.2.2 · ACI 435."
      stepPrefix="deflex."
      referencesBundle="beam"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Deflexión ${input.tipo} L ${input.L_m} m`,
          elementType: "deflection",
          fc: input.fc,
          fy: input.fy,
          inputs: [
            { name: "Tipo", value: input.tipo },
            { name: "L", value: input.L_m, unit: "m" },
            { name: "b", value: input.b_cm, unit: "cm" },
            { name: "h", value: input.h_cm, unit: "cm" },
            { name: "d", value: input.d_cm, unit: "cm" },
            { name: "As", value: input.As_cm2, unit: "cm²" },
            { name: "As'", value: input.AsP_cm2, unit: "cm²" },
            { name: "wD", value: input.wD_tonm, unit: "ton/m" },
            { name: "wL", value: input.wL_tonm, unit: "ton/m" },
            { name: "Δtotal", value: result.delta_total_cm, unit: "cm" },
            { name: "Límite", value: result.limit_cm, unit: "cm" },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "DF-1 — Deflexión inmediata + diferida", element: <DeflexionDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="deflexion-largo-plazo"
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
          <InputCard label="Tipo de elemento">
            <select className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.tipo}
              onChange={(e) => up("tipo", e.target.value as DeflexionLargoPlazoInput["tipo"])}>
              <option value="viga_simple">Viga simplemente apoyada</option>
              <option value="viga_continua">Viga continua</option>
              <option value="losa_1dir">Losa 1 dirección</option>
              <option value="volado">Volado</option>
            </select>
            <select className="w-full mt-2 bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.limite}
              onChange={(e) => up("limite", e.target.value as DeflexionLargoPlazoInput["limite"])}>
              <option value="L/240">L/240 (techos)</option>
              <option value="L/360">L/360 (pisos no sensibles)</option>
              <option value="L/480">L/480 (frágiles / vidrio)</option>
              <option value="L/180">L/180 (volados)</option>
            </select>
          </InputCard>

          <InputCard label="Geometría">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="L" unit="m" value={input.L_m} onChange={(v) => up("L_m", v)} step={0.25} />
              <NumberField label="b" unit="cm" value={input.b_cm} onChange={(v) => up("b_cm", v)} step={5} />
              <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} step={5} />
              <NumberField label="d" unit="cm" value={input.d_cm} onChange={(v) => up("d_cm", v)} step={1} />
              <NumberField label="r" unit="cm" value={input.r_cm} onChange={(v) => up("r_cm", v)} step={0.5} />
            </div>
          </InputCard>

          <InputCard label="Refuerzo (servicio)">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="As traccionado" unit="cm²" value={input.As_cm2} onChange={(v) => up("As_cm2", v)} step={0.5} />
              <NumberField label="As' compresión" unit="cm²" value={input.AsP_cm2} onChange={(v) => up("AsP_cm2", v)} step={0.5} />
            </div>
          </InputCard>

          <InputCard label="Cargas de servicio">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="wD" unit="ton/m" value={input.wD_tonm} onChange={(v) => up("wD_tonm", v)} step={0.1} source="loads" />
              <NumberField label="wL" unit="ton/m" value={input.wL_tonm} onChange={(v) => up("wL_tonm", v)} step={0.1} source="loads" />
              <NumberField label="Frac. sostenida de L" value={input.sustained_fraction_L} onChange={(v) => up("sustained_fraction_L", v)} step={0.05} />
              <NumberField label="Edad carga sost." unit="días" value={input.age_loading_days} onChange={(v) => up("age_loading_days", v)} step={30} />
            </div>
          </InputCard>

          <InputCard label="Materiales">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="f'c" unit="kg/cm²" value={input.fc} onChange={(v) => up("fc", v)} step={5} />
              <NumberField label="fy" unit="kg/cm²" value={input.fy} onChange={(v) => up("fy", v)} step={100} />
            </div>
          </InputCard>
        </>
      }
      steps={steps}
      checks={checks}
      reinforcement={
        <>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              Diagrama de deflexión inmediata + largo plazo
            </div>
            <ExpandableDiagram title="Deflexión a largo plazo">
              <DeflexionDiagram r={result} />
            </ExpandableDiagram>
          </div>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Resumen</div>
            <div className="text-zinc-300">Ec = {result.Ec_kgcm2.toFixed(0)} kg/cm² · n = {result.n_ratio.toFixed(2)}</div>
            <div className="text-zinc-300">fr = {result.fr_kgcm2.toFixed(1)} kg/cm² · Mcr = {result.Mcr_tonm.toFixed(2)} ton·m</div>
            <div className="text-zinc-300">Ig = {result.Ig_cm4.toFixed(0)} cm⁴ · Icr = {result.Icr_cm4.toFixed(0)} cm⁴</div>
            <div className="text-zinc-300">Ie_DL = {result.Ie_DL.toFixed(0)} cm⁴</div>
            <div className="text-zinc-300">Δinst,D = {result.delta_inst_D_cm.toFixed(3)} cm</div>
            <div className="text-zinc-300">Δinst,L = {result.delta_inst_L_cm.toFixed(3)} cm</div>
            <div className="text-zinc-300">Δinst,sus = {result.delta_inst_sus_cm.toFixed(3)} cm</div>
            <div className="text-zinc-300">λΔ = {result.lambda_delta.toFixed(2)} · ρ' = {(result.rho_prime * 100).toFixed(2)}%</div>
            <div className="text-zinc-300">Δlargo plazo = {result.delta_long_cm.toFixed(3)} cm</div>
            <div className={result.limite_ok ? "text-emerald-400" : "text-red-400"}>
              Δtotal = {result.delta_total_cm.toFixed(3)} cm vs límite {result.limit_cm.toFixed(2)} cm
            </div>
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>ACI 318-14 §24.2 — Deflexión inmediata y diferida.</li>
              <li>ACI 318-14 Table 24.2.2 — Límites L/240, L/360, L/480, L/180.</li>
              <li>ACI 318-14 §24.2.4 — Multiplicador λΔ = ξ/(1+50ρ').</li>
              <li>Branson, D.E. (1965) — Ie efectivo.</li>
              <li>ACI Committee 435 (1991) — Deflexiones bajo cargas de servicio.</li>
              <li>MacGregor (2009), Reinforced Concrete §9.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
