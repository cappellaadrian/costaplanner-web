"use client";

/**
 * /studio/esbeltez-columna — Esbeltez + magnificación de momentos.
 * ACI 318-14 §6.2.5 + §6.6.4 · CSCR-10 §8.2.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeEsbeltezLive,
  buildEsbeltezSteps,
  buildEsbeltezChecks,
  type EsbeltezInput,
  type EsbeltezLiveResult,
  type ColumnShape,
  type FrameType,
} from "@/lib/esbeltez-columna-live";

const DEFAULT: EsbeltezInput = {
  shape: "rect",
  b_cm: 35,
  h_cm: 35,
  D_cm: 40,
  lu_m: 3.5,
  k: 1.0,
  frame: "braced",
  Pu_ton: 80,
  M1_tonm: 4,
  M2_tonm: 10,
  beta_dns: 0.6,
  fc: 280,
  fy: 4200,
};

// ---------------------------------------------------------------------------
// Inline diagram — column elevation with axial P + M1/M2 + magnified curvature
// ---------------------------------------------------------------------------
function EsbeltezDiagram({ r }: { r: EsbeltezLiveResult }) {
  const W = 460, H = 320;
  const cx = W / 2;
  const colW = 50;
  const colH = 220;
  const colX = cx - colW / 2;
  const colY = (H - colH) / 2;

  // Magnified curvature visualization: build a bezier deflection proportional to δns
  const delta = isFinite(r.delta_ns) ? Math.min(r.delta_ns, 3.0) : 3.0;
  const lateral_offset = (delta - 1) * 60; // visual exaggeration

  // Curve: from top center (with offset) through midpoint (with offset+kick) to bottom
  const path = `M ${cx + lateral_offset} ${colY}
                C ${cx + lateral_offset + 8} ${colY + colH * 0.3},
                  ${cx + lateral_offset + 12} ${colY + colH * 0.7},
                  ${cx} ${colY + colH}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
      <defs>
        <pattern id="esb-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#52525b" strokeWidth="0.6" />
        </pattern>
        <marker id="esb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#f59e0b" />
        </marker>
      </defs>

      {/* Column elevation (undeformed) */}
      <rect x={colX} y={colY} width={colW} height={colH}
        fill="url(#esb-hatch)" stroke="#a1a1aa" strokeWidth="1.4" />

      {/* Magnified deflected shape */}
      {!r.is_short && (
        <path d={path} stroke="#ef4444" strokeWidth="2" fill="none" strokeDasharray="4,3" />
      )}

      {/* Axial Pu arrow at top */}
      <line x1={cx} y1={colY - 32} x2={cx} y2={colY - 4}
        stroke="#f59e0b" strokeWidth="2" markerEnd="url(#esb-arrow)" />
      <text x={cx + 6} y={colY - 16} fill="#f59e0b" fontSize="10" fontFamily="ui-monospace, monospace">
        Pu = {r.Pu_ton.toFixed(1)} t
      </text>

      {/* M2 moment at top (curved arrow) */}
      <path d={`M ${cx - 30} ${colY - 4} A 18 18 0 0 1 ${cx - 6} ${colY + 16}`}
        stroke="#3b82f6" strokeWidth="1.8" fill="none" markerEnd="url(#esb-arrow)" />
      <text x={cx - 80} y={colY + 12} fill="#3b82f6" fontSize="9" fontFamily="ui-monospace, monospace">
        M2 = {r.M2_tonm.toFixed(1)} t·m
      </text>

      {/* M1 at bottom */}
      <path d={`M ${cx + 30} ${colY + colH + 4} A 18 18 0 0 1 ${cx + 6} ${colY + colH - 16}`}
        stroke="#3b82f6" strokeWidth="1.4" fill="none" markerEnd="url(#esb-arrow)" />
      <text x={cx + 36} y={colY + colH - 8} fill="#3b82f6" fontSize="9" fontFamily="ui-monospace, monospace">
        M1 = {r.M1_tonm.toFixed(1)} t·m
      </text>

      {/* lu dimension */}
      <line x1={colX - 14} y1={colY} x2={colX - 14} y2={colY + colH}
        stroke="#a1a1aa" strokeWidth="1" />
      <line x1={colX - 18} y1={colY} x2={colX - 10} y2={colY} stroke="#a1a1aa" strokeWidth="1" />
      <line x1={colX - 18} y1={colY + colH} x2={colX - 10} y2={colY + colH} stroke="#a1a1aa" strokeWidth="1" />
      <text x={colX - 20} y={colY + colH / 2} textAnchor="end" fill="#a1a1aa" fontSize="9"
        fontFamily="ui-monospace, monospace" transform={`rotate(-90, ${colX - 20}, ${colY + colH / 2})`}>
        lu = {r.lu_m.toFixed(1)} m
      </text>

      {/* Readout */}
      <text x={20} y={H - 38} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        klu/r = {r.klu_r.toFixed(1)} {r.is_short ? "→ CORTA" : "→ ESBELTA"}
      </text>
      <text x={20} y={H - 22} fill="#ef4444" fontSize="10" fontFamily="ui-monospace, monospace">
        δns = {isFinite(r.delta_ns) ? r.delta_ns.toFixed(2) : "∞"}
      </text>
      <text x={20} y={H - 6} fill="#10b981" fontSize="10" fontFamily="ui-monospace, monospace">
        Mc = {isFinite(r.Mc_tonm) ? r.Mc_tonm.toFixed(2) : "∞"} t·m
      </text>
    </svg>
  );
}

export default function EsbeltezColumnaPage() {
  const [input, setInput] = useState<EsbeltezInput>(DEFAULT);
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
  const result = useMemo(() => computeEsbeltezLive(input), [input]);
  const steps = useMemo(() => buildEsbeltezSteps(result), [result]);
  const checks = useMemo(() => buildEsbeltezChecks(result), [result]);

  function up<K extends keyof EsbeltezInput>(k: K, v: EsbeltezInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Esbeltez de columna"
      subtitle="Clasificación + magnificación de momentos. ACI 318-14 §6.2.5 + §6.6 · CSCR-10 §8.2."
      stepPrefix="esbeltez."
      referencesBundle="column"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Esbeltez ${input.shape === "rect" ? `${input.b_cm}×${input.h_cm}` : `Ø${input.D_cm}`} cm`,
          elementType: "esbeltez_columna",
          fc: input.fc,
          fy: input.fy,
          inputs: [
            { name: "Forma", value: input.shape },
            { name: "b", value: input.b_cm, unit: "cm" },
            { name: "h", value: input.h_cm, unit: "cm" },
            { name: "D", value: input.D_cm, unit: "cm" },
            { name: "lu", value: input.lu_m, unit: "m" },
            { name: "k", value: input.k },
            { name: "Marco", value: input.frame },
            { name: "Pu", value: input.Pu_ton, unit: "ton" },
            { name: "M1", value: input.M1_tonm, unit: "ton·m" },
            { name: "M2", value: input.M2_tonm, unit: "ton·m" },
            { name: "βdns", value: input.beta_dns },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "EC-1 — Curva P-Δ con amplificación", element: <EsbeltezDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="esbeltez-columna"
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
          <InputCard label="Forma de la columna">
            <select className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.shape}
              onChange={(e) => up("shape", e.target.value as ColumnShape)}>
              <option value="rect">Rectangular</option>
              <option value="circ">Circular</option>
            </select>
          </InputCard>

          {input.shape === "rect" ? (
            <InputCard label="Sección rectangular (cm)">
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="b" unit="cm" value={input.b_cm} onChange={(v) => up("b_cm", v)} />
                <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} />
              </div>
            </InputCard>
          ) : (
            <InputCard label="Sección circular">
              <NumberField label="D" unit="cm" value={input.D_cm} onChange={(v) => up("D_cm", v)} />
            </InputCard>
          )}

          <InputCard label="Longitud y arriostre">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="lu" unit="m" value={input.lu_m} onChange={(v) => up("lu_m", v)} step={0.1} />
              <NumberField label="k" value={input.k} onChange={(v) => up("k", v)} step={0.05} source="code" />
            </div>
            <select className="w-full mt-2 bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.frame}
              onChange={(e) => up("frame", e.target.value as FrameType)}>
              <option value="braced">Arriostrado (non-sway)</option>
              <option value="unbraced">No arriostrado (sway)</option>
            </select>
          </InputCard>

          <InputCard label="Cargas (análisis)">
            <NumberField label="Pu" unit="ton" value={input.Pu_ton}
              onChange={(v) => up("Pu_ton", v)} step={1} source="loads" />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <NumberField label="M1" unit="t·m" value={input.M1_tonm}
                onChange={(v) => up("M1_tonm", v)} step={0.5} source="loads" />
              <NumberField label="M2" unit="t·m" value={input.M2_tonm}
                onChange={(v) => up("M2_tonm", v)} step={0.5} source="loads" />
            </div>
            <div className="mt-2">
              <NumberField label="βdns" value={input.beta_dns}
                onChange={(v) => up("beta_dns", v)} step={0.05} />
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
              Curvatura magnificada
            </div>
            <ExpandableDiagram title="Esbeltez de columna">
              <EsbeltezDiagram r={result} />
            </ExpandableDiagram>
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>ACI 318-14 §6.2.5 — clasificación de columnas (corta/esbelta).</li>
              <li>ACI 318-14 §6.6.4 — magnificación de momentos (método aproximado).</li>
              <li>ACI 318-14 §6.6.4.4.4 — EI reducida con βdns.</li>
              <li>ACI 318-14 §6.6.4.5.3 — Cm para columnas arriostradas.</li>
              <li>ACI 318-14 §19.2.2.1 — Ec = 15100·√f'c.</li>
              <li>CSCR-10 Rev. 2014 §8.2 — análisis de segundo orden.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
