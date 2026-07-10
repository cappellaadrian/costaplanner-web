"use client";

/**
 * /studio/beam-column-joint — Conexión viga-columna ductil.
 * ACI 318-14 §18.7.3 + §18.8 · ACI 352R-02 · CSCR-10 §8.6.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeBeamColumnJointLive,
  buildBeamColumnJointSteps,
  buildBeamColumnJointChecks,
  type BeamColumnJointInput,
  type BeamColumnJointLiveResult,
  type JointType,
} from "@/lib/beam-column-joint-live";

const DEFAULT: BeamColumnJointInput = {
  bc: 40,
  hc: 40,
  As_top: 10.0,
  As_bot: 6.0,
  bw_beam: 30,
  SumMn_col_tonm: 60,
  SumMn_beam_tonm: 40,
  Vcol_ton: 18,
  jointType: "interior",
  confinedSides: 4,
  fc: 280,
  fy: 4200,
  zona: 3,
};

// ---------------------------------------------------------------------------
// Inline diagram — column elevation with beams + Vj + ΣMn comparison
// ---------------------------------------------------------------------------
function JointDiagram({ r }: { r: BeamColumnJointLiveResult }) {
  const W = 460, H = 320;
  const cx = W / 2;
  const cy = H / 2;
  const cw = 70;        // column width
  const ch = 220;       // column height
  const bh = 50;        // beam height
  const bw = 150;       // beam length each side
  const colX = cx - cw / 2;
  const colY = cy - ch / 2;
  const beamY = cy - bh / 2;
  const showInterior = r.jointType === "interior";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
      <defs>
        <pattern id="joint-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#52525b" strokeWidth="0.6" />
        </pattern>
        <marker id="joint-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#f59e0b" />
        </marker>
      </defs>

      {/* Column */}
      <rect x={colX} y={colY} width={cw} height={ch} fill="url(#joint-hatch)" stroke="#a1a1aa" strokeWidth="1.5" />

      {/* Left beam */}
      <rect x={colX - bw} y={beamY} width={bw} height={bh} fill="url(#joint-hatch)" stroke="#a1a1aa" strokeWidth="1.2" />
      {/* Right beam (interior only) */}
      {showInterior && (
        <rect x={colX + cw} y={beamY} width={bw} height={bh} fill="url(#joint-hatch)" stroke="#a1a1aa" strokeWidth="1.2" />
      )}

      {/* Joint highlight */}
      <rect x={colX} y={beamY} width={cw} height={bh} fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,3" />
      <text x={cx} y={beamY - 6} textAnchor="middle" fill="#f59e0b" fontSize="10" fontFamily="ui-monospace, monospace">
        Nudo Aj = {r.Aj.toFixed(0)} cm²
      </text>

      {/* Vj horizontal arrow inside joint */}
      <line x1={colX + 6} y1={cy} x2={colX + cw - 6} y2={cy}
        stroke="#f59e0b" strokeWidth="2" markerEnd="url(#joint-arrow)" />
      <text x={cx + 8} y={cy - 5} fill="#f59e0b" fontSize="10" fontFamily="ui-monospace, monospace">
        Vj = {r.Vj_demand.toFixed(1)} t
      </text>

      {/* ΣMn_col (curved arrows top + bottom of column) */}
      <text x={cx} y={colY - 6} textAnchor="middle" fill="#10b981" fontSize="10" fontFamily="ui-monospace, monospace">
        ΣMn col = {r.SumMn_col_tonm.toFixed(1)} t·m
      </text>
      <text x={cx} y={colY + ch + 14} textAnchor="middle" fill="#10b981" fontSize="10" fontFamily="ui-monospace, monospace">
        Σ ↓
      </text>

      {/* ΣMn_beam labels on beams */}
      <text x={colX - bw / 2} y={beamY - 6} textAnchor="middle" fill="#ef4444" fontSize="10" fontFamily="ui-monospace, monospace">
        Mn viga
      </text>
      {showInterior && (
        <text x={colX + cw + bw / 2} y={beamY - 6} textAnchor="middle" fill="#ef4444" fontSize="10" fontFamily="ui-monospace, monospace">
          Mn viga
        </text>
      )}

      {/* Tensile force arrows on top bars */}
      <line x1={colX + cw + 10} y1={beamY + 8} x2={colX + cw + 60} y2={beamY + 8}
        stroke="#ef4444" strokeWidth="1.5" markerEnd="url(#joint-arrow)" />
      <text x={colX + cw + 12} y={beamY + 4} fill="#ef4444" fontSize="9" fontFamily="ui-monospace, monospace">
        T = {r.T_top.toFixed(1)} t
      </text>

      {/* SCWB ratio readout */}
      <text x={20} y={H - 24} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        ΣMn_col / ΣMn_beam = {r.ratio_SCWB.toFixed(2)}  {r.scwb_pass ? "OK" : "FALLA"} (req ≥ 1.20)
      </text>
      <text x={20} y={H - 10} fill={r.shear_pass ? "#10b981" : "#ef4444"} fontSize="10" fontFamily="ui-monospace, monospace">
        Vj / φVn = {r.phi_Vn_joint > 0 ? (r.Vj_demand / r.phi_Vn_joint).toFixed(2) : "∞"} ({r.shear_pass ? "OK" : "FALLA"})
      </text>
    </svg>
  );
}

export default function BeamColumnJointPage() {
  const [input, setInput] = useState<BeamColumnJointInput>(DEFAULT);
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
  const result = useMemo(() => computeBeamColumnJointLive(input), [input]);
  const steps = useMemo(() => buildBeamColumnJointSteps(result), [result]);
  const checks = useMemo(() => buildBeamColumnJointChecks(result), [result]);

  function up<K extends keyof BeamColumnJointInput>(k: K, v: BeamColumnJointInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Conexión viga-columna"
      subtitle="Nudo dúctil. ACI 318-14 §18.7.3 + §18.8 · CSCR-10 §8.6."
      stepPrefix="joint."
      referencesBundle="column"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Nudo ${input.bc}×${input.hc} cm — ${input.jointType}`,
          elementType: "beam_column_joint",
          zonaSismica: input.zona,
          fc: input.fc,
          fy: input.fy,
          inputs: [
            { name: "bc", value: input.bc, unit: "cm" },
            { name: "hc", value: input.hc, unit: "cm" },
            { name: "bw viga", value: input.bw_beam, unit: "cm" },
            { name: "As superior", value: input.As_top, unit: "cm²" },
            { name: "As inferior", value: input.As_bot, unit: "cm²" },
            { name: "ΣMn col", value: input.SumMn_col_tonm, unit: "ton·m" },
            { name: "ΣMn viga", value: input.SumMn_beam_tonm, unit: "ton·m" },
            { name: "Vcol", value: input.Vcol_ton, unit: "ton" },
            { name: "Tipo nudo", value: input.jointType },
            { name: "Lados confinados", value: input.confinedSides },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "BCJ-1 — Junta viga-columna, fuerzas", element: <JointDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="beam-column-joint"
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
          <InputCard label="Columna (cm)">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="bc" unit="cm" value={input.bc} onChange={(v) => up("bc", v)} />
              <NumberField label="hc" unit="cm" value={input.hc} onChange={(v) => up("hc", v)} />
            </div>
          </InputCard>

          <InputCard label="Vigas convergentes">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="bw viga" unit="cm" value={input.bw_beam} onChange={(v) => up("bw_beam", v)} />
              <NumberField label="As superior" unit="cm²" value={input.As_top} onChange={(v) => up("As_top", v)} step={0.5} />
              <NumberField label="As inferior" unit="cm²" value={input.As_bot} onChange={(v) => up("As_bot", v)} step={0.5} />
            </div>
          </InputCard>

          <InputCard label="Capacidades nominales (análisis)">
            <div className="grid grid-cols-1 gap-2">
              <NumberField label="ΣMn columnas" unit="ton·m" value={input.SumMn_col_tonm}
                onChange={(v) => up("SumMn_col_tonm", v)} step={1} source="loads" />
              <NumberField label="ΣMn vigas" unit="ton·m" value={input.SumMn_beam_tonm}
                onChange={(v) => up("SumMn_beam_tonm", v)} step={1} source="loads" />
              <NumberField label="V columna" unit="ton" value={input.Vcol_ton}
                onChange={(v) => up("Vcol_ton", v)} step={1} source="loads" />
            </div>
          </InputCard>

          <InputCard label="Tipo de nudo">
            <select
              className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.jointType}
              onChange={(e) => up("jointType", e.target.value as JointType)}
            >
              <option value="interior">Interior</option>
              <option value="exterior">Exterior</option>
              <option value="corner">Esquinero</option>
            </select>
            <select
              className="w-full mt-2 bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.confinedSides}
              onChange={(e) => up("confinedSides", parseInt(e.target.value) as 2 | 3 | 4)}
            >
              <option value={4}>4 lados confinados (γ=20)</option>
              <option value={3}>3 lados (γ=15)</option>
              <option value={2}>2 lados o menos (γ=12)</option>
            </select>
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
              Diagrama del nudo
            </div>
            <ExpandableDiagram title="Junta viga-columna">
              <JointDiagram r={result} />
            </ExpandableDiagram>
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>ACI 318-14 §18.7.3.2 — columna fuerte / viga débil (6/5).</li>
              <li>ACI 318-14 §18.8 — cortante de nudo y γ por confinamiento.</li>
              <li>ACI 352R-02 — recomendaciones de diseño de nudos.</li>
              <li>CSCR-10 Rev. 2014 §8.6 — conexiones viga-columna en CR.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
