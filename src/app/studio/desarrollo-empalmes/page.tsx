"use client";

/**
 * /studio/desarrollo-empalmes — Longitudes de desarrollo y empalmes.
 * ACI 318-14 §25.4 + §25.5 · CSCR-10 §8.2.1.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeDesarrolloLive,
  buildDesarrolloSteps,
  buildDesarrolloChecks,
  type DesarrolloInput,
  type DesarrolloLiveResult,
  type CaseType,
} from "@/lib/desarrollo-empalmes-live";

const DEFAULT: DesarrolloInput = {
  bar_size: 6,
  fy: 4200,
  fc: 280,
  caseType: "straight_tension",
  c_cover_cm: 4,
  s_spacing_cm: 15,
  Ktr: 0,
  epoxi: false,
  topBar: false,
  lightweight: false,
  seismic_zone: 3,
};

function BarDiagram({ r }: { r: DesarrolloLiveResult }) {
  const W = 460, H = 320;
  const cx = W / 2;
  const cy = H / 2;
  const barColor = "#f59e0b";

  // Draw different shapes based on caseType
  const renderShape = () => {
    if (r.caseType === "hook_90") {
      // L-shape: horizontal then 90° down
      return (
        <g>
          <line x1={cx - 140} y1={cy} x2={cx + 60} y2={cy} stroke={barColor} strokeWidth="5" />
          <line x1={cx + 60} y1={cy} x2={cx + 60} y2={cy + 60} stroke={barColor} strokeWidth="5" />
          <text x={cx - 70} y={cy - 10} fill="#a1a1aa" fontSize="11" textAnchor="middle" fontFamily="ui-monospace, monospace">
            ℓdh = {r.ldh_cm.toFixed(1)} cm
          </text>
          <text x={cx + 75} y={cy + 40} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
            12·db
          </text>
        </g>
      );
    }
    if (r.caseType === "hook_180") {
      // U-shape (180 hook)
      return (
        <g>
          <line x1={cx - 140} y1={cy + 25} x2={cx + 60} y2={cy + 25} stroke={barColor} strokeWidth="5" />
          <path d={`M ${cx + 60} ${cy + 25} A 20 25 0 0 0 ${cx + 60} ${cy - 25}`}
            stroke={barColor} strokeWidth="5" fill="none" />
          <line x1={cx + 60} y1={cy - 25} x2={cx + 40} y2={cy - 25} stroke={barColor} strokeWidth="5" />
          <text x={cx - 70} y={cy + 50} fill="#a1a1aa" fontSize="11" textAnchor="middle" fontFamily="ui-monospace, monospace">
            ℓdh = {r.ldh_cm.toFixed(1)} cm
          </text>
        </g>
      );
    }
    if (r.caseType === "compression") {
      return (
        <g>
          <line x1={cx - 150} y1={cy} x2={cx + 150} y2={cy} stroke={barColor} strokeWidth="5" />
          <text x={cx} y={cy - 12} fill="#a1a1aa" fontSize="11" textAnchor="middle" fontFamily="ui-monospace, monospace">
            ℓdc = {r.ldc_cm.toFixed(1)} cm
          </text>
          <line x1={cx - 150} y1={cy + 20} x2={cx - 130} y2={cy + 20} stroke="#10b981" strokeWidth="2" markerEnd="url(#dev-arrow-r)" />
          <line x1={cx + 150} y1={cy + 20} x2={cx + 130} y2={cy + 20} stroke="#10b981" strokeWidth="2" markerEnd="url(#dev-arrow-l)" />
          <text x={cx} y={cy + 30} fill="#10b981" fontSize="10" textAnchor="middle" fontFamily="ui-monospace, monospace">
            Compresión
          </text>
        </g>
      );
    }
    if (r.caseType === "splice_A" || r.caseType === "splice_B") {
      // Two parallel bars overlapping
      return (
        <g>
          <line x1={cx - 150} y1={cy - 8} x2={cx + 60} y2={cy - 8} stroke={barColor} strokeWidth="5" />
          <line x1={cx - 60} y1={cy + 8} x2={cx + 150} y2={cy + 8} stroke="#fb923c" strokeWidth="5" />
          {/* Overlap region (highlighted) */}
          <rect x={cx - 60} y={cy - 16} width={120} height={32} fill="#ef4444" fillOpacity="0.2" stroke="#ef4444" strokeDasharray="3,3" />
          <text x={cx} y={cy - 22} fill="#ef4444" fontSize="11" textAnchor="middle" fontFamily="ui-monospace, monospace">
            ℓst = {(r.caseType === "splice_A" ? r.splice_A_cm : r.splice_B_cm).toFixed(1)} cm
          </text>
          <text x={cx} y={cy + 40} fill="#a1a1aa" fontSize="10" textAnchor="middle" fontFamily="ui-monospace, monospace">
            Clase {r.caseType === "splice_A" ? "A (1.0·ℓd)" : "B (1.3·ℓd)"}
          </text>
        </g>
      );
    }
    // Default: straight tension bar
    return (
      <g>
        <line x1={cx - 150} y1={cy} x2={cx + 150} y2={cy} stroke={barColor} strokeWidth="5" />
        <text x={cx} y={cy - 12} fill="#a1a1aa" fontSize="11" textAnchor="middle" fontFamily="ui-monospace, monospace">
          ℓd = {r.ld_general_cm.toFixed(1)} cm  (simpl. {r.ld_simple_cm.toFixed(1)} cm)
        </text>
        <line x1={cx - 150} y1={cy + 20} x2={cx - 130} y2={cy + 20} stroke="#ef4444" strokeWidth="2" markerEnd="url(#dev-arrow-r)" />
        <text x={cx} y={cy + 30} fill="#ef4444" fontSize="10" textAnchor="middle" fontFamily="ui-monospace, monospace">
          Tracción
        </text>
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
      <defs>
        <marker id="dev-arrow-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#10b981" />
        </marker>
        <marker id="dev-arrow-l" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#10b981" />
        </marker>
      </defs>

      <text x={20} y={22} fill="#a1a1aa" fontSize="11" fontFamily="ui-monospace, monospace">
        Barra #{r.bar_size} (db = {r.db_cm.toFixed(2)} cm) · f'c = {r.fc} · fy = {r.fy} kg/cm²
      </text>

      {renderShape()}

      <text x={20} y={H - 22} fill="#10b981" fontSize="10" fontFamily="ui-monospace, monospace">
        ℓd (general) = {r.ld_general_cm.toFixed(1)} cm  |  ℓdh = {r.ldh_cm.toFixed(1)} cm  |  ℓdc = {r.ldc_cm.toFixed(1)} cm
      </text>
      <text x={20} y={H - 8} fill="#f59e0b" fontSize="11" fontFamily="ui-monospace, monospace">
        Caso seleccionado: ℓ_final = {r.ld_final_cm.toFixed(1)} cm
      </text>
    </svg>
  );
}

export default function DesarrolloEmpalmesPage() {
  const [input, setInput] = useState<DesarrolloInput>(DEFAULT);
  const { meta, projectName } = useProjectContext();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!meta || prefilledRef.current) return;
    prefilledRef.current = true;
    setInput((p) => ({
      ...p,
      fc: meta.fc_default ?? p.fc,
      fy: meta.fy_default ?? p.fy,
      seismic_zone: (meta.zonaSismica as 1 | 2 | 3 | 4) ?? p.seismic_zone,
    }));
  }, [meta]);
  const result = useMemo(() => computeDesarrolloLive(input), [input]);
  const steps = useMemo(() => buildDesarrolloSteps(result), [result]);
  const checks = useMemo(() => buildDesarrolloChecks(result), [result]);

  function up<K extends keyof DesarrolloInput>(k: K, v: DesarrolloInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Desarrollo y empalmes"
      subtitle="ℓd, ℓdh, ℓdc, ℓst. ACI 318-14 §25.4 + §25.5 · CSCR-10 §8.2.1."
      stepPrefix="develop."
      referencesBundle="beam"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Desarrollo #${input.bar_size} — ${input.caseType}`,
          elementType: "development_length",
          zonaSismica: input.seismic_zone,
          fc: input.fc,
          fy: input.fy,
          inputs: [
            { name: "Barra #", value: input.bar_size },
            { name: "db", value: result.db_cm, unit: "cm" },
            { name: "Caso", value: input.caseType },
            { name: "c recubrim.", value: input.c_cover_cm, unit: "cm" },
            { name: "s entre barras", value: input.s_spacing_cm, unit: "cm" },
            { name: "Ktr", value: input.Ktr },
            { name: "ψt", value: result.psi_t },
            { name: "ψe", value: result.psi_e },
            { name: "λ", value: result.lambda },
            { name: "ℓ final", value: result.ld_final_cm, unit: "cm" },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "DE-1 — Longitudes de desarrollo y traslapo", element: <BarDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="desarrollo-empalmes"
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
          <InputCard label="Barra y caso">
            <select className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 mb-2"
              value={input.bar_size}
              onChange={(e) => up("bar_size", parseInt(e.target.value))}>
              {[3, 4, 5, 6, 7, 8, 9, 10, 11].map((s) => (
                <option key={s} value={s}>Barra #{s}</option>
              ))}
            </select>
            <select className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.caseType}
              onChange={(e) => up("caseType", e.target.value as CaseType)}>
              <option value="straight_tension">Barra recta — tracción</option>
              <option value="hook_90">Gancho 90°</option>
              <option value="hook_180">Gancho 180°</option>
              <option value="splice_A">Empalme Clase A</option>
              <option value="splice_B">Empalme Clase B</option>
              <option value="compression">Compresión</option>
            </select>
          </InputCard>

          <InputCard label="Materiales">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="f'c" unit="kg/cm²" value={input.fc} onChange={(v) => up("fc", v)} step={5} />
              <NumberField label="fy" unit="kg/cm²" value={input.fy} onChange={(v) => up("fy", v)} step={100} />
            </div>
          </InputCard>

          <InputCard label="Geometría / confinamiento">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="c recubrim." unit="cm" value={input.c_cover_cm} onChange={(v) => up("c_cover_cm", v)} step={0.5} />
              <NumberField label="s entre barras" unit="cm" value={input.s_spacing_cm} onChange={(v) => up("s_spacing_cm", v)} step={1} />
              <NumberField label="Ktr" unit="" value={input.Ktr} onChange={(v) => up("Ktr", v)} step={0.5} />
            </div>
          </InputCard>

          <InputCard label="Factores ψ y λ">
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" checked={input.topBar}
                onChange={(e) => up("topBar", e.target.checked)} />
              Barra superior (ψt = 1.3)
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-300 mt-1">
              <input type="checkbox" checked={input.epoxi}
                onChange={(e) => up("epoxi", e.target.checked)} />
              Recubrimiento epóxico (ψe = 1.5)
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-300 mt-1">
              <input type="checkbox" checked={input.lightweight}
                onChange={(e) => up("lightweight", e.target.checked)} />
              Concreto liviano (λ = 0.75)
            </label>
            <select className="w-full mt-2 bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.seismic_zone}
              onChange={(e) => up("seismic_zone", parseInt(e.target.value) as 1 | 2 | 3 | 4)}>
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
              Diagrama de la barra
            </div>
            <ExpandableDiagram title="Longitudes de desarrollo">
              <BarDiagram r={result} />
            </ExpandableDiagram>
          </div>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Resumen de longitudes</div>
            <div className="text-zinc-300">ℓd simplificada: {result.ld_simple_cm.toFixed(1)} cm</div>
            <div className="text-zinc-300">ℓd general: {result.ld_general_cm.toFixed(1)} cm</div>
            <div className="text-zinc-300">ℓdh (gancho 90°/180°): {result.ldh_cm.toFixed(1)} cm</div>
            <div className="text-zinc-300">ℓdc compresión: {result.ldc_cm.toFixed(1)} cm</div>
            <div className="text-zinc-300">Empalme A: {result.splice_A_cm.toFixed(1)} cm · B: {result.splice_B_cm.toFixed(1)} cm</div>
            <div className="text-zinc-300">Ext. gancho 135°: {result.hook_extension_135_cm.toFixed(1)} cm</div>
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>ACI 318-14 §25.4 — desarrollo de refuerzo.</li>
              <li>ACI 318-14 §25.5 — empalmes por solapado, Clase A y B.</li>
              <li>ACI 318-14 §25.4.3 — ganchos estándar 90° y 180°.</li>
              <li>ACI 318-14 §25.4.9 — desarrollo en compresión.</li>
              <li>CSCR-10 §8.2.1 — ganchos sísmicos 135°, extensión mín. 6db.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
