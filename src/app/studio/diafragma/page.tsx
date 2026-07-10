"use client";

/**
 * /studio/diafragma — Diafragma + colectores + cordones.
 * ACI 318-14 §18.12 · ASCE 7-16 §12.10 · CSCR-10 §8.7.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeDiafragmaLive,
  buildDiafragmaSteps,
  buildDiafragmaChecks,
  type DiafragmaInput,
  type DiafragmaLiveResult,
} from "@/lib/diafragma-live";

const DEFAULT: DiafragmaInput = {
  t_cm: 12,
  Ld_m: 20,
  Bd_m: 10,
  Fpx_ton: 50,
  Lcoll_m: 4,
  num_muros_dir: 2,
  fc: 245,
  fy: 4200,
  zona: 3,
};

// ---------------------------------------------------------------------------
// Inline diagram — plan view: slab + chord arrows + collector + walls
// ---------------------------------------------------------------------------
function DiafragmaDiagram({ r }: { r: DiafragmaLiveResult }) {
  const W = 460, H = 280;
  const padding = 50;
  const slabW = W - 2 * padding;
  const slabH = (r.Bd / r.Ld) * slabW;
  const slabHshown = Math.min(Math.max(slabH, 80), 140);
  const x0 = padding;
  const y0 = (H - slabHshown) / 2 - 10;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
      <defs>
        <pattern id="diaf-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(0)">
          <line x1="0" y1="4" x2="8" y2="4" stroke="#3f3f46" strokeWidth="0.6" />
        </pattern>
        <marker id="diaf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#f59e0b" />
        </marker>
        <marker id="diaf-arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#ef4444" />
        </marker>
        <marker id="diaf-arrow-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#10b981" />
        </marker>
      </defs>

      {/* Slab plan */}
      <rect x={x0} y={y0} width={slabW} height={slabHshown}
        fill="url(#diaf-hatch)" stroke="#a1a1aa" strokeWidth="1.4" />

      {/* Shear walls — drawn as bold lines at left and right ends */}
      <rect x={x0 - 8} y={y0} width={8} height={slabHshown} fill="#10b981" />
      <rect x={x0 + slabW} y={y0} width={8} height={slabHshown} fill="#10b981" />
      <text x={x0 - 8} y={y0 - 4} fill="#10b981" fontSize="9" fontFamily="ui-monospace, monospace">Muro</text>
      <text x={x0 + slabW + 4} y={y0 - 4} fill="#10b981" fontSize="9" fontFamily="ui-monospace, monospace">Muro</text>

      {/* Fpx — distributed lateral load arrows from top */}
      {Array.from({ length: 5 }).map((_, i) => {
        const xa = x0 + (slabW / 5) * (i + 0.5);
        return (
          <line key={i} x1={xa} y1={y0 - 24} x2={xa} y2={y0 - 4}
            stroke="#f59e0b" strokeWidth="1.5" markerEnd="url(#diaf-arrow)" />
        );
      })}
      <text x={W / 2} y={y0 - 30} textAnchor="middle" fill="#f59e0b" fontSize="10" fontFamily="ui-monospace, monospace">
        Fpx = {r.Fpx.toFixed(1)} ton
      </text>

      {/* Chord tension — top edge */}
      <line x1={x0 + 10} y1={y0 + 10} x2={x0 + slabW - 10} y2={y0 + 10}
        stroke="#ef4444" strokeWidth="2" markerStart="url(#diaf-arrow-red)" markerEnd="url(#diaf-arrow-red)" />
      <text x={W / 2} y={y0 + 6} textAnchor="middle" fill="#ef4444" fontSize="9" fontFamily="ui-monospace, monospace">
        T cordón = {r.Tu_chord_ton.toFixed(1)} t  (As = {r.As_chord_cm2.toFixed(2)} cm²)
      </text>

      {/* Chord compression — bottom edge */}
      <line x1={x0 + slabW - 10} y1={y0 + slabHshown - 10} x2={x0 + 10} y2={y0 + slabHshown - 10}
        stroke="#3b82f6" strokeWidth="2" markerStart="url(#diaf-arrow)" markerEnd="url(#diaf-arrow)" />
      <text x={W / 2} y={y0 + slabHshown - 14} textAnchor="middle" fill="#3b82f6" fontSize="9" fontFamily="ui-monospace, monospace">
        C cordón = {r.Tu_chord_ton.toFixed(1)} t
      </text>

      {/* Collector — dashed line near wall */}
      <line x1={x0 + slabW * 0.6} y1={y0 + slabHshown / 2}
        x2={x0 + slabW} y2={y0 + slabHshown / 2}
        stroke="#10b981" strokeWidth="2.5" strokeDasharray="5,3" markerEnd="url(#diaf-arrow-green)" />
      <text x={x0 + slabW * 0.62} y={y0 + slabHshown / 2 - 4} fill="#10b981" fontSize="9" fontFamily="ui-monospace, monospace">
        Colector F = {r.Fcoll_ton.toFixed(1)} t
      </text>

      {/* Dimensions */}
      <text x={W / 2} y={H - 26} textAnchor="middle" fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        Ld = {r.Ld.toFixed(1)} m × Bd = {r.Bd.toFixed(1)} m, t = {r.t} cm
      </text>
      <text x={W / 2} y={H - 10} textAnchor="middle" fill={r.shear_pass ? "#10b981" : "#ef4444"} fontSize="10" fontFamily="ui-monospace, monospace">
        vu / φVn = {r.phi_vn_kgcm2 > 0 ? (r.vu_kgcm2 / r.phi_vn_kgcm2).toFixed(2) : "∞"} ({r.shear_pass ? "OK" : "FALLA"})
      </text>
    </svg>
  );
}

export default function DiafragmaPage() {
  const [input, setInput] = useState<DiafragmaInput>(DEFAULT);
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
  const result = useMemo(() => computeDiafragmaLive(input), [input]);
  const steps = useMemo(() => buildDiafragmaSteps(result), [result]);
  const checks = useMemo(() => buildDiafragmaChecks(result), [result]);

  function up<K extends keyof DiafragmaInput>(k: K, v: DiafragmaInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Diafragma"
      subtitle="Losa actuando como viga horizontal. Cordones + colectores. ACI §18.12 · ASCE 7 §12.10."
      stepPrefix="diafragma."
      referencesBundle="slab"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Diafragma ${input.Ld_m}×${input.Bd_m} m`,
          elementType: "diafragma",
          zonaSismica: input.zona,
          fc: input.fc,
          fy: input.fy,
          inputs: [
            { name: "t", value: input.t_cm, unit: "cm" },
            { name: "Ld", value: input.Ld_m, unit: "m" },
            { name: "Bd", value: input.Bd_m, unit: "m" },
            { name: "Fpx", value: input.Fpx_ton, unit: "ton" },
            { name: "L colector", value: input.Lcoll_m, unit: "m" },
            { name: "# muros", value: input.num_muros_dir },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "DA-1 — Diafragma rígido / fuerzas inerciales", element: <DiafragmaDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="diafragma"
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
          <InputCard label="Geometría del diafragma">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="t losa" unit="cm" value={input.t_cm} onChange={(v) => up("t_cm", v)} />
              <NumberField label="Ld luz" unit="m" value={input.Ld_m} onChange={(v) => up("Ld_m", v)} step={0.5} />
              <NumberField label="Bd ancho" unit="m" value={input.Bd_m} onChange={(v) => up("Bd_m", v)} step={0.5} />
            </div>
          </InputCard>

          <InputCard label="Cargas sísmicas (ASCE §12.10)">
            <NumberField label="Fpx (fuerza piso)" unit="ton" value={input.Fpx_ton}
              onChange={(v) => up("Fpx_ton", v)} step={1} source="loads" />
            <div className="mt-2">
              <NumberField label="L colector" unit="m" value={input.Lcoll_m}
                onChange={(v) => up("Lcoll_m", v)} step={0.5} />
            </div>
          </InputCard>

          <InputCard label="Sistema de muros">
            <NumberField label="# muros en dirección" value={input.num_muros_dir}
              onChange={(v) => up("num_muros_dir", v)} step={1} />
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
              Plan del diafragma
            </div>
            <ExpandableDiagram title="Diafragma">
              <DiafragmaDiagram r={result} />
            </ExpandableDiagram>
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>ACI 318-14 §18.12 — diafragmas estructurales especiales.</li>
              <li>ACI 318-14 §18.12.7.5 — cordones (chord forces).</li>
              <li>ACI 318-14 §18.12.7.6 — colectores y elementos transferidores.</li>
              <li>ACI 318-14 §18.12.9 — resistencia a cortante del diafragma.</li>
              <li>ASCE 7-16 §12.10.1 / §12.10.2 — Fpx y fuerza en colectores.</li>
              <li>CSCR-10 Rev. 2014 §8.7 — diafragmas en Costa Rica.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
