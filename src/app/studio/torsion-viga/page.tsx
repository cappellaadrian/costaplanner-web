"use client";

/**
 * /studio/torsion-viga — Torsión combinada con cortante y momento.
 * ACI 318-14 §22.7 + §9.5.4 + §9.6.4. Hsu & Mo (2010).
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeTorsionVigaLive,
  buildTorsionVigaSteps,
  buildTorsionVigaChecks,
  type TorsionVigaInput,
  type TorsionVigaResult,
} from "@/lib/torsion-viga-live";

const DEFAULT: TorsionVigaInput = {
  b_cm: 30,
  h_cm: 60,
  d_cm: 54,
  r_cm: 4,
  Tu_tonm: 3.5,
  Vu_ton: 15,
  Mu_tonm: 12,
  fc: 280,
  fy_long: 4200,
  fy_transv: 4200,
  As_long_existing: 12.0,
  Av_existing_cm2: 1.42,  // 2 ramas #4
  s_existing_cm: 15,
  isEquilibrium: true,
};

function TorsionDiagram({ r }: { r: TorsionVigaResult }) {
  const W = 480, H = 320;
  // 3D-isometric of beam showing T arrow + closed stirrups + shear flow
  const margin = 30;
  const beamL = W - 2 * margin;
  const cy = H / 2;
  const beamH = 100;
  const beamW = 50; // depth in iso
  // top face quad
  const x0 = margin, x1 = margin + beamL;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
      <text x={margin} y={20} fill="#a1a1aa" fontSize="11" fontFamily="ui-monospace, monospace">
        Viga 3D — T, V, flujo de cortante, estribo cerrado
      </text>
      {/* Beam isometric (simplified) */}
      <polygon points={`${x0},${cy - beamH/2} ${x1},${cy - beamH/2} ${x1 + beamW},${cy - beamH/2 - beamW/2} ${x0 + beamW},${cy - beamH/2 - beamW/2}`}
        fill="#27272a" stroke="#a1a1aa" strokeWidth="1" />
      <polygon points={`${x1},${cy - beamH/2} ${x1 + beamW},${cy - beamH/2 - beamW/2} ${x1 + beamW},${cy + beamH/2 - beamW/2} ${x1},${cy + beamH/2}`}
        fill="#1c1c1f" stroke="#a1a1aa" strokeWidth="1" />
      <rect x={x0} y={cy - beamH/2} width={beamL} height={beamH} fill="#27272a" stroke="#a1a1aa" strokeWidth="1.2" />

      {/* Closed stirrups inside */}
      {[0.2, 0.4, 0.6, 0.8].map((f, i) => {
        const xs = x0 + f * beamL;
        return (
          <g key={i}>
            <rect x={xs - 30} y={cy - beamH/2 + 6} width={60} height={beamH - 12} fill="none" stroke="#10b981" strokeWidth="1" />
            <text x={xs} y={cy + beamH/2 + 14} textAnchor="middle" fill="#10b981" fontSize="8" fontFamily="ui-monospace, monospace">
              s = {r.s_existing_cm}cm
            </text>
          </g>
        );
      })}

      {/* T arrow (helical) at left end */}
      <path d={`M ${x0 + 30} ${cy - 40} a 30 30 0 1 1 30 30`} fill="none" stroke="#f59e0b" strokeWidth="2"
        markerEnd="url(#torsion-arr)" />
      <text x={x0 + 5} y={cy - 60} fill="#f59e0b" fontSize="11" fontFamily="ui-monospace, monospace">
        Tu = {r.Tu.toFixed(2)} t·m
      </text>

      {/* V arrow */}
      <line x1={x0 + beamL/2} y1={cy - beamH/2 - 20} x2={x0 + beamL/2} y2={cy - beamH/2} stroke="#ef4444"
        strokeWidth="2" markerEnd="url(#torsion-arr-r)" />
      <text x={x0 + beamL/2 + 4} y={cy - beamH/2 - 22} fill="#ef4444" fontSize="10" fontFamily="ui-monospace, monospace">
        Vu = {r.Vu.toFixed(1)} t
      </text>

      {/* Shear flow arrows on top face */}
      {[0.25, 0.5, 0.75].map((f, i) => {
        const xa = x0 + 20 + f * (beamL - 40);
        return (
          <line key={`sf-${i}`} x1={xa - 12} y1={cy - beamH/2 + 6} x2={xa + 12} y2={cy - beamH/2 + 6}
            stroke="#fbbf24" strokeWidth="1.2" markerEnd="url(#torsion-arr)" />
        );
      })}
      <text x={x0 + beamL/2} y={cy - beamH/2 - 4} textAnchor="middle" fill="#fbbf24" fontSize="9" fontFamily="ui-monospace, monospace">
        Flujo de cortante q = T/(2Ao)
      </text>

      {/* Summary text */}
      <text x={margin} y={H - 30} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        Tcr = {r.Tcr_tonm.toFixed(2)} t·m · At/s = {r.At_over_s_cm2cm.toFixed(4)} cm²/cm
      </text>
      <text x={margin} y={H - 14} fill={r.section_ok ? "#10b981" : "#ef4444"} fontSize="10" fontFamily="ui-monospace, monospace">
        Sección {r.section_ok ? "OK" : "FALLA"} · smax = {r.s_max_cm.toFixed(1)} cm · Al = {r.Al_design_cm2.toFixed(2)} cm²
      </text>

      <defs>
        <marker id="torsion-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#f59e0b" />
        </marker>
        <marker id="torsion-arr-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#ef4444" />
        </marker>
      </defs>
    </svg>
  );
}

export default function TorsionVigaPage() {
  const [input, setInput] = useState<TorsionVigaInput>(DEFAULT);
  const { meta, projectName } = useProjectContext();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!meta || prefilledRef.current) return;
    prefilledRef.current = true;
    setInput((p) => ({
      ...p,
      fc: meta.fc_default ?? p.fc,
      fy_long: meta.fy_default ?? p.fy_long,
      fy_transv: meta.fy_default ?? p.fy_transv,
    }));
  }, [meta]);
  const result = useMemo(() => computeTorsionVigaLive(input), [input]);
  const steps = useMemo(() => buildTorsionVigaSteps(result), [result]);
  const checks = useMemo(() => buildTorsionVigaChecks(result), [result]);

  function up<K extends keyof TorsionVigaInput>(k: K, v: TorsionVigaInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Torsión en viga"
      subtitle="V + T + M combinados. ACI 318-14 §22.7 + §9.5.4 · Hsu & Mo Unified Theory."
      stepPrefix="torsion."
      referencesBundle="beam"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Torsión viga ${input.b_cm}×${input.h_cm} — Tu ${input.Tu_tonm.toFixed(2)} t·m`,
          elementType: "torsion_beam",
          fc: input.fc,
          fy: input.fy_long,
          inputs: [
            { name: "b", value: input.b_cm, unit: "cm" },
            { name: "h", value: input.h_cm, unit: "cm" },
            { name: "d", value: input.d_cm, unit: "cm" },
            { name: "Tu", value: input.Tu_tonm, unit: "ton·m" },
            { name: "Vu", value: input.Vu_ton, unit: "ton" },
            { name: "Mu", value: input.Mu_tonm, unit: "ton·m" },
            { name: "Tcr", value: result.Tcr_tonm, unit: "ton·m" },
            { name: "At/s req", value: result.At_over_s_cm2cm, unit: "cm²/cm" },
            { name: "Al req", value: result.Al_design_cm2, unit: "cm²" },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "TV-1 — Sección con estribos cerrados", element: <TorsionDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="torsion-viga"
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
          <InputCard label="Geometría (cm)">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="b" unit="cm" value={input.b_cm} onChange={(v) => up("b_cm", v)} step={5} />
              <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} step={5} />
              <NumberField label="d" unit="cm" value={input.d_cm} onChange={(v) => up("d_cm", v)} step={1} />
              <NumberField label="r recubr." unit="cm" value={input.r_cm} onChange={(v) => up("r_cm", v)} step={0.5} />
            </div>
          </InputCard>

          <InputCard label="Solicitaciones últimas">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Tu" unit="ton·m" value={input.Tu_tonm} onChange={(v) => up("Tu_tonm", v)} step={0.1} source="loads" />
              <NumberField label="Vu" unit="ton" value={input.Vu_ton} onChange={(v) => up("Vu_ton", v)} step={1} source="loads" />
              <NumberField label="Mu" unit="ton·m" value={input.Mu_tonm} onChange={(v) => up("Mu_tonm", v)} step={0.5} source="loads" />
            </div>
            <label className="flex items-center gap-2 mt-2 text-xs text-zinc-300">
              <input type="checkbox" checked={input.isEquilibrium}
                onChange={(e) => up("isEquilibrium", e.target.checked)} />
              Torsión por equilibrio (no compatibilidad)
            </label>
          </InputCard>

          <InputCard label="Materiales">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="f'c" unit="kg/cm²" value={input.fc} onChange={(v) => up("fc", v)} step={5} />
              <NumberField label="fyl" unit="kg/cm²" value={input.fy_long} onChange={(v) => up("fy_long", v)} step={100} />
              <NumberField label="fyt" unit="kg/cm²" value={input.fy_transv} onChange={(v) => up("fy_transv", v)} step={100} />
            </div>
          </InputCard>

          <InputCard label="Refuerzo existente (verificación)">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="As long. exist." unit="cm²" value={input.As_long_existing} onChange={(v) => up("As_long_existing", v)} step={0.5} />
              <NumberField label="Av estribo" unit="cm²" value={input.Av_existing_cm2} onChange={(v) => up("Av_existing_cm2", v)} step={0.1} />
              <NumberField label="s estribo" unit="cm" value={input.s_existing_cm} onChange={(v) => up("s_existing_cm", v)} step={1} />
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
              Diagrama 3D — torsión + flujo de cortante
            </div>
            <ExpandableDiagram title="Torsión en viga">
              <TorsionDiagram r={result} />
            </ExpandableDiagram>
          </div>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Refuerzo</div>
            <div className="text-zinc-300">At/s (torsión, 1 rama) = {result.At_over_s_cm2cm.toFixed(4)} cm²/cm</div>
            <div className="text-zinc-300">Av/s (cortante, 2 ramas) = {result.Av_over_s_cm2cm.toFixed(4)} cm²/cm</div>
            <div className="text-zinc-300">Combinado Av/s + 2·At/s = {result.combined_av_at_cm2cm.toFixed(4)} cm²/cm</div>
            <div className="text-zinc-300">s_max = {result.s_max_cm.toFixed(1)} cm</div>
            <div className="text-zinc-300">Al (long. por torsión) = {result.Al_design_cm2.toFixed(2)} cm²</div>
            <div className="text-zinc-300">As long. total = {result.As_long_total_req_cm2.toFixed(2)} cm²</div>
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>ACI 318-14 §22.7 — Torsional strength (Tcr, Tn, combined V+T).</li>
              <li>ACI 318-14 §9.5.4 — Longitudinal reinforcement for torsion.</li>
              <li>ACI 318-14 §9.6.4 — Minimum transverse + longitudinal reinforcement.</li>
              <li>Hsu, T.T.C. and Mo, Y.L. (2010), Unified Theory of Concrete Structures.</li>
              <li>MacGregor (2009), Reinforced Concrete §7.</li>
              <li>CSCR-10 §8.6 — Torsión y cortante combinado.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
