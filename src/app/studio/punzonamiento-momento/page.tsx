"use client";

/**
 * /studio/punzonamiento-momento — Punzonamiento + momento desbalanceado.
 * ACI 318-14 §8.4.4 + §22.6.5 · CRSI Design Handbook §8.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computePunzonamientoMomentoLive,
  buildPunzonamientoMomentoSteps,
  buildPunzonamientoMomentoChecks,
  type PunzonamientoMomentoInput,
  type PunzonamientoMomentoLiveResult,
  type EdgeCondition,
} from "@/lib/punzonamiento-momento-live";

const DEFAULT: PunzonamientoMomentoInput = {
  h_cm: 25,
  d_cm: 20,
  c1_cm: 40,
  c2_cm: 40,
  Vu_ton: 60,
  Mu_tonm: 8,
  edge: "interior",
  fc: 280,
  fy: 4200,
};

// ---------------------------------------------------------------------------
// Inline diagram — plan view: column + critical perimeter + Vu + Mu + stress
// ---------------------------------------------------------------------------
function PunzonamientoMomentoDiagram({ r }: { r: PunzonamientoMomentoLiveResult }) {
  const W = 460, H = 320;
  const cx = W / 2;
  const cy = H / 2 - 10;
  const scale = 2.5;
  const colW = r.c1 * scale * 0.4;
  const colH = r.c2 * scale * 0.4;
  const periW = r.b1 * scale * 0.4;
  const periH = r.b2 * scale * 0.4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
      <defs>
        <pattern id="punz-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#52525b" strokeWidth="0.6" />
        </pattern>
        <marker id="punz-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#f59e0b" />
        </marker>
        <marker id="punz-arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#ef4444" />
        </marker>
      </defs>

      {/* Slab (background) */}
      <rect x={50} y={40} width={W - 100} height={H - 130} fill="#0a0a0a" stroke="#27272a" strokeWidth="1" />

      {/* Critical perimeter at d/2 from column face */}
      <rect x={cx - periW / 2} y={cy - periH / 2}
        width={periW} height={periH}
        fill="none" stroke="#f59e0b" strokeWidth="1.6" strokeDasharray="6,3" />
      <text x={cx + periW / 2 + 4} y={cy - periH / 2 - 4} fill="#f59e0b" fontSize="9" fontFamily="ui-monospace, monospace">
        bo = {r.bo.toFixed(1)} cm
      </text>

      {/* Column */}
      <rect x={cx - colW / 2} y={cy - colH / 2}
        width={colW} height={colH}
        fill="url(#punz-hatch)" stroke="#a1a1aa" strokeWidth="1.4" />
      <text x={cx} y={cy + 4} textAnchor="middle" fill="#a1a1aa" fontSize="9" fontFamily="ui-monospace, monospace">
        {r.c1}×{r.c2}
      </text>

      {/* Vu — downward arrow into column */}
      <line x1={cx} y1={cy - 80} x2={cx} y2={cy - colH / 2 - 2}
        stroke="#f59e0b" strokeWidth="2" markerEnd="url(#punz-arrow)" />
      <text x={cx + 6} y={cy - 60} fill="#f59e0b" fontSize="10" fontFamily="ui-monospace, monospace">
        Vu = {r.Vu.toFixed(1)} t
      </text>

      {/* Mu — curved rotation arrow */}
      <path d={`M ${cx + colW / 2 + 30} ${cy - 25}
                A 30 30 0 0 1 ${cx + colW / 2 + 30} ${cy + 25}`}
        stroke="#ef4444" strokeWidth="2" fill="none" markerEnd="url(#punz-arrow-red)" />
      <text x={cx + colW / 2 + 36} y={cy + 4} fill="#ef4444" fontSize="10" fontFamily="ui-monospace, monospace">
        Mu = {r.Mu.toFixed(1)} t·m
      </text>

      {/* Stress distribution sketch — trapezoidal on top edge */}
      <line x1={cx - periW / 2} y1={cy - periH / 2 - 18} x2={cx + periW / 2} y2={cy - periH / 2 - 32}
        stroke="#3b82f6" strokeWidth="2" />
      <line x1={cx - periW / 2} y1={cy - periH / 2 - 18} x2={cx - periW / 2} y2={cy - periH / 2 - 6}
        stroke="#3b82f6" strokeWidth="1.2" />
      <line x1={cx + periW / 2} y1={cy - periH / 2 - 32} x2={cx + periW / 2} y2={cy - periH / 2 - 6}
        stroke="#3b82f6" strokeWidth="1.2" />
      <text x={cx} y={cy - periH / 2 - 38} textAnchor="middle" fill="#3b82f6" fontSize="9" fontFamily="ui-monospace, monospace">
        Distribución de esfuerzo trapezoidal
      </text>

      {/* Readout */}
      <text x={20} y={H - 50} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        γv = {r.gamma_v.toFixed(3)},  vu_axial = {r.vu_axial.toFixed(2)},  vu_M = {r.vu_moment.toFixed(2)} kg/cm²
      </text>
      <text x={20} y={H - 34} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        vu combinado = {r.vu_combined.toFixed(2)} kg/cm²,  φvc = {r.phi_vc.toFixed(2)} kg/cm²
      </text>
      <text x={20} y={H - 14} fill={r.shear_pass ? "#10b981" : "#ef4444"} fontSize="11" fontFamily="ui-monospace, monospace">
        vu / φvc = {r.phi_vc > 0 ? (r.vu_combined / r.phi_vc).toFixed(2) : "∞"} ({r.shear_pass ? "OK" : "FALLA — stud rails"})
      </text>
    </svg>
  );
}

export default function PunzonamientoMomentoPage() {
  const [input, setInput] = useState<PunzonamientoMomentoInput>(DEFAULT);
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
  const result = useMemo(() => computePunzonamientoMomentoLive(input), [input]);
  const steps = useMemo(() => buildPunzonamientoMomentoSteps(result), [result]);
  const checks = useMemo(() => buildPunzonamientoMomentoChecks(result), [result]);

  function up<K extends keyof PunzonamientoMomentoInput>(k: K, v: PunzonamientoMomentoInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Punzonamiento con momento"
      subtitle="Transferencia combinada Vu + Mu en losa-columna. ACI 318-14 §8.4.4 + §22.6.5."
      stepPrefix="punz_mom."
      referencesBundle="footing"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Punzonamiento ${input.c1_cm}×${input.c2_cm} cm (${input.edge})`,
          elementType: "punzonamiento_momento",
          fc: input.fc,
          fy: input.fy,
          inputs: [
            { name: "h", value: input.h_cm, unit: "cm" },
            { name: "d", value: input.d_cm, unit: "cm" },
            { name: "c1", value: input.c1_cm, unit: "cm" },
            { name: "c2", value: input.c2_cm, unit: "cm" },
            { name: "Vu", value: input.Vu_ton, unit: "ton" },
            { name: "Mu", value: input.Mu_tonm, unit: "ton·m" },
            { name: "Posición", value: input.edge },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "PM-1 — Perímetro crítico de punzonamiento", element: <PunzonamientoMomentoDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="punzonamiento-momento"
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
          <InputCard label="Losa / zapata">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} />
              <NumberField label="d (efectivo)" unit="cm" value={input.d_cm} onChange={(v) => up("d_cm", v)} />
            </div>
          </InputCard>

          <InputCard label="Columna">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="c1 (dir Mu)" unit="cm" value={input.c1_cm} onChange={(v) => up("c1_cm", v)} />
              <NumberField label="c2" unit="cm" value={input.c2_cm} onChange={(v) => up("c2_cm", v)} />
            </div>
            <select className="w-full mt-2 bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.edge}
              onChange={(e) => up("edge", e.target.value as EdgeCondition)}>
              <option value="interior">Interior (αs=40)</option>
              <option value="edge">Borde (αs=30)</option>
              <option value="corner">Esquina (αs=20)</option>
            </select>
          </InputCard>

          <InputCard label="Cargas (análisis)">
            <NumberField label="Vu" unit="ton" value={input.Vu_ton}
              onChange={(v) => up("Vu_ton", v)} step={1} source="loads" />
            <div className="mt-2">
              <NumberField label="Mu desbalanceado" unit="t·m" value={input.Mu_tonm}
                onChange={(v) => up("Mu_tonm", v)} step={0.5} source="loads" />
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
              Perímetro crítico + esfuerzos
            </div>
            <ExpandableDiagram title="Punzonamiento con momento">
              <PunzonamientoMomentoDiagram r={result} />
            </ExpandableDiagram>
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>ACI 318-14 §8.4.4 — transferencia de momento en losa-columna.</li>
              <li>ACI 318-14 §8.4.2.3.2 — fracción γf transferida por flexión.</li>
              <li>ACI 318-14 §22.6.5.2 — capacidad nominal a punzonamiento.</li>
              <li>ACI 318-14 R8.4.4 — comentario con Jc para columnas interiores.</li>
              <li>ACI 421.1R-08 — diseño de stud rails (refuerzo de punzonamiento).</li>
              <li>CRSI Design Handbook §8 — γv y momento polar Jc.</li>
              <li>CSCR-10 Rev. 2014 §8.4 — cortante bidireccional.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
