"use client";

/**
 * /studio/confined-masonry — Mampostería confinada (CR).
 * CSCR-10 Rev. 2014 §10 · INTE C5:2014 · NTM (CFIA).
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeConfinedMasonryLive,
  buildConfinedMasonrySteps,
  buildConfinedMasonryChecks,
  type ConfinedMasonryInput,
  type ConfinedMasonryLiveResult,
} from "@/lib/confined-masonry-live";

const DEFAULT: ConfinedMasonryInput = {
  fm_MPa: 9.0,
  t_cm: 15,
  H_m: 3.0,
  L_m: 4.0,
  b_col_cm: 15,
  h_col_cm: 15,
  s_conf_m: 4.0,
  b_vc_cm: 15,
  h_vc_cm: 20,
  V_sismico_ton: 6,
  Pu_axial_ton: 10,
  zona: 3,
  num_pisos: 2,
};

function MasonryDiagram({ r }: { r: ConfinedMasonryLiveResult }) {
  const W = 460, H = 320;
  const margin = 30;
  const wallY = 50;
  const wallH = 220;
  const wallW = W - 2 * margin;
  // Number of confinement columns along L
  const numCols = Math.max(2, Math.ceil(r.L / r.s_conf) + 1);
  const colW = 14;
  // Horizontal reinforcement rows
  const Hcm = r.H * 100;
  const sH = 60;
  const numHorizRows = r.needs_horiz_reinf ? Math.floor(Hcm / sH) : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
      <defs>
        <pattern id="m-block" patternUnits="userSpaceOnUse" width="20" height="10">
          <rect x="0" y="0" width="20" height="10" fill="#27272a" />
          <line x1="0" y1="0" x2="20" y2="0" stroke="#3f3f46" strokeWidth="0.5" />
          <line x1="0" y1="10" x2="20" y2="10" stroke="#3f3f46" strokeWidth="0.5" />
          <line x1="10" y1="0" x2="10" y2="10" stroke="#3f3f46" strokeWidth="0.5" />
        </pattern>
      </defs>

      <text x={margin} y={25} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        Elevación — L={r.L.toFixed(1)} m × H={r.H.toFixed(1)} m, espesor {r.t} cm
      </text>

      {/* Foundation */}
      <rect x={margin - 6} y={wallY + wallH} width={wallW + 12} height={12} fill="#52525b" stroke="#71717a" strokeWidth="1" />

      {/* Wall body (blocks) */}
      <rect x={margin} y={wallY + 20} width={wallW} height={wallH - 20 - 20} fill="url(#m-block)" />

      {/* Bond beam (viga corona) on top */}
      <rect x={margin - 4} y={wallY} width={wallW + 8} height={20} fill="#f59e0b" stroke="#fb923c" strokeWidth="1.2" />
      <text x={W / 2} y={wallY + 14} textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold" fontFamily="ui-monospace, monospace">
        Viga corona {r.b_vc}×{r.h_vc}
      </text>

      {/* Confinement columns */}
      {Array.from({ length: numCols }).map((_, i) => {
        const x = margin + (wallW * i) / (numCols - 1) - colW / 2;
        return (
          <g key={i}>
            <rect x={x} y={wallY + 20} width={colW} height={wallH - 20 - 20}
              fill="#f59e0b" stroke="#fb923c" strokeWidth="1" />
          </g>
        );
      })}
      <text x={W / 2} y={wallY + wallH - 30} textAnchor="middle" fill="#f59e0b" fontSize="9" fontFamily="ui-monospace, monospace">
        Col. confinamiento {r.b_col}×{r.h_col} cm @ {r.s_conf.toFixed(1)} m
      </text>

      {/* Intermediate beam (solera) if H > 3.5m */}
      {r.needs_intermediate_beam && (
        <>
          <rect x={margin} y={wallY + wallH / 2 - 5} width={wallW} height={10} fill="#10b981" stroke="#34d399" strokeWidth="1" />
          <text x={W - margin - 4} y={wallY + wallH / 2 - 7} textAnchor="end" fill="#10b981" fontSize="9" fontFamily="ui-monospace, monospace">
            Solera intermedia
          </text>
        </>
      )}

      {/* Horizontal reinforcement (red dashed lines) — zone III/IV */}
      {Array.from({ length: numHorizRows }).map((_, i) => {
        const y = wallY + 20 + ((wallH - 40) * (i + 1)) / (numHorizRows + 1);
        return (
          <line key={i} x1={margin + 4} y1={y} x2={W - margin - 4} y2={y}
            stroke="#ef4444" strokeWidth="1" strokeDasharray="4,2" />
        );
      })}
      {numHorizRows > 0 && (
        <text x={margin + 6} y={wallY + 40} fill="#ef4444" fontSize="8" fontFamily="ui-monospace, monospace">
          2#3 c/ 60 cm
        </text>
      )}

      {/* Seismic load arrow */}
      <line x1={margin - 14} y1={wallY + 10} x2={margin + 6} y2={wallY + 10}
        stroke="#3b82f6" strokeWidth="2" markerEnd="url(#mas-arrow)" />
      <text x={margin - 22} y={wallY + 6} fill="#3b82f6" fontSize="9" textAnchor="end" fontFamily="ui-monospace, monospace">
        Vs={r.V_sismico.toFixed(1)}t
      </text>

      <defs>
        <marker id="mas-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#3b82f6" />
        </marker>
      </defs>

      <text x={20} y={H - 8} fill={r.shear_ok ? "#10b981" : "#ef4444"} fontSize="10" fontFamily="ui-monospace, monospace">
        Vs/φVm = {(r.V_sismico / Math.max(0.01, r.phi_Vm_ton)).toFixed(2)} ({r.shear_ok ? "OK" : "FALLA"})  ·  H/t = {r.slenderness_ratio.toFixed(1)}
      </text>
    </svg>
  );
}

export default function ConfinedMasonryPage() {
  const [input, setInput] = useState<ConfinedMasonryInput>(DEFAULT);
  const { meta, projectName } = useProjectContext();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!meta || prefilledRef.current) return;
    prefilledRef.current = true;
    setInput((p) => ({
      ...p,
      zona: (meta.zonaSismica as 1 | 2 | 3 | 4) ?? p.zona,
    }));
  }, [meta]);
  const result = useMemo(() => computeConfinedMasonryLive(input), [input]);
  const steps = useMemo(() => buildConfinedMasonrySteps(result), [result]);
  const checks = useMemo(() => buildConfinedMasonryChecks(result), [result]);

  function up<K extends keyof ConfinedMasonryInput>(k: K, v: ConfinedMasonryInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Mampostería confinada"
      subtitle="Muro con columnas y vigas de confinamiento. CSCR-10 §10 · INTE C5:2014."
      stepPrefix="masonry."
      referencesBundle="wall"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Muro confinado ${input.L_m}×${input.H_m} m`,
          elementType: "confined_masonry",
          zonaSismica: input.zona,
          fc: input.fm_MPa * 10.197, // approximate f'_m → fc-equivalent for export
          fy: 4200,
          inputs: [
            { name: "f'_m", value: input.fm_MPa, unit: "MPa" },
            { name: "t pared", value: input.t_cm, unit: "cm" },
            { name: "H", value: input.H_m, unit: "m" },
            { name: "L", value: input.L_m, unit: "m" },
            { name: "Col confin", value: `${input.b_col_cm}×${input.h_col_cm}`, unit: "cm" },
            { name: "s confin", value: input.s_conf_m, unit: "m" },
            { name: "V sísmico", value: input.V_sismico_ton, unit: "ton" },
            { name: "Pu axial", value: input.Pu_axial_ton, unit: "ton" },
            { name: "# pisos", value: input.num_pisos },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "CM-1 — Muro con confinamientos", element: <MasonryDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="confined-masonry"
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
          <InputCard label="Material y geometría">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="f'_m" unit="MPa" value={input.fm_MPa} onChange={(v) => up("fm_MPa", v)} step={0.5} source="code" />
              <NumberField label="t pared" unit="cm" value={input.t_cm} onChange={(v) => up("t_cm", v)} step={2.5} />
              <NumberField label="H altura" unit="m" value={input.H_m} onChange={(v) => up("H_m", v)} step={0.1} />
              <NumberField label="L longitud" unit="m" value={input.L_m} onChange={(v) => up("L_m", v)} step={0.5} />
            </div>
          </InputCard>

          <InputCard label="Columnas de confinamiento (cm)">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="b col" unit="cm" value={input.b_col_cm} onChange={(v) => up("b_col_cm", v)} step={5} />
              <NumberField label="h col" unit="cm" value={input.h_col_cm} onChange={(v) => up("h_col_cm", v)} step={5} />
              <NumberField label="s separación" unit="m" value={input.s_conf_m} onChange={(v) => up("s_conf_m", v)} step={0.5} />
            </div>
          </InputCard>

          <InputCard label="Viga corona (cm)">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="b vc" unit="cm" value={input.b_vc_cm} onChange={(v) => up("b_vc_cm", v)} step={5} />
              <NumberField label="h vc" unit="cm" value={input.h_vc_cm} onChange={(v) => up("h_vc_cm", v)} step={5} />
            </div>
          </InputCard>

          <InputCard label="Cargas">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="V sísmico" unit="ton" value={input.V_sismico_ton} onChange={(v) => up("V_sismico_ton", v)} step={0.5} source="loads" />
              <NumberField label="Pu axial" unit="ton" value={input.Pu_axial_ton} onChange={(v) => up("Pu_axial_ton", v)} step={1} source="loads" />
            </div>
          </InputCard>

          <InputCard label="Configuración">
            <NumberField label="# pisos" unit="" value={input.num_pisos} onChange={(v) => up("num_pisos", v)} step={1} />
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
              Elevación + confinamiento
            </div>
            <ExpandableDiagram title="Mampostería confinada">
              <MasonryDiagram r={result} />
            </ExpandableDiagram>
          </div>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Detalles obligatorios</div>
            <div className="text-zinc-300">Cada columna: 4 #4 + estribos #2 @ 20 cm</div>
            <div className="text-zinc-300">Viga corona en cada nivel</div>
            {result.needs_horiz_reinf && (
              <div className="text-amber-300">Refuerzo horizontal: 2 #3 @ 60 cm (zona {result.zona})</div>
            )}
            {result.needs_intermediate_beam && (
              <div className="text-amber-300">Solera intermedia (H &gt; 3.5 m)</div>
            )}
            <div className="text-zinc-500 text-[10px] mt-1">f'_m = {result.fm_kgcm2.toFixed(1)} kg/cm²; √f'_m = {Math.sqrt(result.fm_kgcm2).toFixed(2)}.</div>
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>CSCR-10 Rev. 2014 §10 — mampostería confinada en Costa Rica.</li>
              <li>INTE C5:2014 — bloques de concreto, resistencia mínima.</li>
              <li>NTM-Mampostería (CFIA) — detallado constructivo.</li>
              <li>TMS 402-13 / ACI 530 — alternativa con malla electrosoldada.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
