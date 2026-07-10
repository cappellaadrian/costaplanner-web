"use client";

/**
 * /studio/fisuracion — Control de fisuración.
 * ACI 318-14 §24.3 + Frosch (1999) + Gergely-Lutz (1968).
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeFisuracionLive,
  buildFisuracionSteps,
  buildFisuracionChecks,
  type FisuracionInput,
  type FisuracionResult,
} from "@/lib/fisuracion-live";

const DEFAULT: FisuracionInput = {
  db_mm: 19,        // #6
  fy_kgcm2: 4200,
  cc_cm: 4,
  fs_service_kgcm2: 0,  // 0 → usa 2/3 fy
  s_actual_cm: 12,
  exposure: "interior",
  h_cm: 50,
  b_cm: 30,
  n_bars: 4,
};

function FisuracionDiagram({ r }: { r: FisuracionResult }) {
  const W = 480, H = 320;
  // Beam cross-section showing bars + spacing + crack
  const cx = W / 2;
  const cy = H / 2;
  const scale = Math.min((W - 80) / r.b, (H - 100) / r.h);
  const bw = r.b * scale;
  const bh = r.h * scale;
  const xL = cx - bw / 2;
  const yT = cy - bh / 2;
  // bars on tension side
  const bar_d_px = (r.db / 10) * scale; // db in cm → px
  const bar_y = yT + bh - (r.cc * scale) - bar_d_px / 2;
  const spacing_px = r.s_actual * scale;
  const total_bar_width = (r.n_bars - 1) * spacing_px;
  const start_x = cx - total_bar_width / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
      <text x={20} y={20} fill="#a1a1aa" fontSize="11" fontFamily="ui-monospace, monospace">
        Sección con barras a tracción · s vs s_max
      </text>

      {/* Section */}
      <rect x={xL} y={yT} width={bw} height={bh} fill="#27272a" stroke="#a1a1aa" strokeWidth="1.2" />

      {/* Bars on bottom */}
      {Array.from({ length: r.n_bars }).map((_, i) => {
        const x = start_x + i * spacing_px;
        return (
          <circle key={i} cx={x} cy={bar_y} r={bar_d_px / 2}
            fill="#f59e0b" stroke="#fbbf24" strokeWidth="0.8" />
        );
      })}

      {/* Spacing dimension */}
      {r.n_bars >= 2 && (
        <g stroke="#10b981" strokeWidth="0.8" fill="none">
          <line x1={start_x} y1={bar_y + bar_d_px / 2 + 14} x2={start_x + spacing_px} y2={bar_y + bar_d_px / 2 + 14} />
          <line x1={start_x} y1={bar_y + bar_d_px / 2 + 10} x2={start_x} y2={bar_y + bar_d_px / 2 + 18} />
          <line x1={start_x + spacing_px} y1={bar_y + bar_d_px / 2 + 10} x2={start_x + spacing_px} y2={bar_y + bar_d_px / 2 + 18} />
          <text x={start_x + spacing_px / 2} y={bar_y + bar_d_px / 2 + 28} fill="#10b981" textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace">
            s = {r.s_actual.toFixed(1)} cm
          </text>
        </g>
      )}

      {/* Crack going up from between bars */}
      {r.s_actual > 0 && (
        <g>
          <path d={`M ${start_x + spacing_px / 2},${bar_y - bar_d_px / 2} L ${start_x + spacing_px / 2 + 4},${bar_y - bar_d_px / 2 - 30} L ${start_x + spacing_px / 2 - 2},${bar_y - bar_d_px / 2 - 50} L ${start_x + spacing_px / 2 + 3},${bar_y - bar_d_px / 2 - 70}`}
            fill="none" stroke={r.fisura_ok ? "#fbbf24" : "#ef4444"} strokeWidth={r.fisura_ok ? "1.2" : "2"} />
          <text x={start_x + spacing_px / 2 + 6} y={bar_y - bar_d_px / 2 - 40}
            fill={r.fisura_ok ? "#fbbf24" : "#ef4444"} fontSize="9" fontFamily="ui-monospace, monospace">
            w ≈ {Math.max(r.w_frosch_mm, r.w_GL_mm).toFixed(3)} mm
          </text>
        </g>
      )}

      {/* Cover annotation */}
      <line x1={xL + bw + 5} y1={bar_y} x2={xL + bw + 5} y2={yT + bh} stroke="#a1a1aa" strokeWidth="0.6" />
      <text x={xL + bw + 10} y={bar_y + (yT + bh - bar_y) / 2 + 3} fill="#a1a1aa" fontSize="9" fontFamily="ui-monospace, monospace">
        cc = {r.cc.toFixed(1)} cm
      </text>

      {/* s_max indicator */}
      <text x={20} y={H - 60} fill="#f59e0b" fontSize="10" fontFamily="ui-monospace, monospace">
        s_max,1 = {r.s_max1_cm.toFixed(1)} cm (38·(28/fs) − 2.5·cc)
      </text>
      <text x={20} y={H - 45} fill="#f59e0b" fontSize="10" fontFamily="ui-monospace, monospace">
        s_max,2 = {r.s_max2_cm.toFixed(1)} cm (30·(28/fs))
      </text>
      <text x={20} y={H - 30} fill="#f59e0b" fontSize="10" fontFamily="ui-monospace, monospace">
        s_max = {r.s_max_cm.toFixed(1)} cm · gobernante = {r.governing_limit_cm.toFixed(1)} cm ({r.exposure})
      </text>
      <text x={20} y={H - 12} fill={r.fisura_ok ? "#10b981" : "#ef4444"} fontSize="10" fontFamily="ui-monospace, monospace">
        s_actual {r.s_actual.toFixed(1)} cm {r.fisura_ok ? "≤" : ">"} {r.governing_limit_cm.toFixed(1)} cm → {r.fisura_ok ? "OK" : "FALLA"}
      </text>
    </svg>
  );
}

export default function FisuracionPage() {
  const [input, setInput] = useState<FisuracionInput>(DEFAULT);
  const { meta, projectName } = useProjectContext();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!meta || prefilledRef.current) return;
    prefilledRef.current = true;
    setInput((p) => ({
      ...p,
      fy_kgcm2: meta.fy_default ?? p.fy_kgcm2,
    }));
  }, [meta]);
  const result = useMemo(() => computeFisuracionLive(input), [input]);
  const steps = useMemo(() => buildFisuracionSteps(result), [result]);
  const checks = useMemo(() => buildFisuracionChecks(result), [result]);

  function up<K extends keyof FisuracionInput>(k: K, v: FisuracionInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Control de fisuración"
      subtitle="Separación máxima de barras. ACI 318-14 §24.3 · Frosch · Gergely-Lutz."
      stepPrefix="crack."
      referencesBundle="beam"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Fisuración s = ${input.s_actual_cm} cm vs s_max`,
          elementType: "crack_control",
          fc: 0,
          fy: input.fy_kgcm2,
          inputs: [
            { name: "db", value: input.db_mm, unit: "mm" },
            { name: "cc", value: input.cc_cm, unit: "cm" },
            { name: "fs servicio", value: result.fs_kgcm2, unit: "kg/cm²" },
            { name: "exposición", value: input.exposure },
            { name: "s actual", value: input.s_actual_cm, unit: "cm" },
            { name: "s_max", value: result.s_max_cm, unit: "cm" },
            { name: "s gobernante", value: result.governing_limit_cm, unit: "cm" },
            { name: "w (Frosch)", value: result.w_frosch_mm, unit: "mm" },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "FS-1 — Patrón de fisuración (ACI 224R)", element: <FisuracionDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="fisuracion"
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
          <InputCard label="Barra y materiales">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="db" unit="mm" value={input.db_mm} onChange={(v) => up("db_mm", v)} step={1} />
              <NumberField label="fy" unit="kg/cm²" value={input.fy_kgcm2} onChange={(v) => up("fy_kgcm2", v)} step={100} />
              <NumberField label="cc recubr." unit="cm" value={input.cc_cm} onChange={(v) => up("cc_cm", v)} step={0.5} />
              <NumberField label="fs servicio (0=2/3·fy)" unit="kg/cm²" value={input.fs_service_kgcm2} onChange={(v) => up("fs_service_kgcm2", v)} step={50} />
            </div>
          </InputCard>

          <InputCard label="Sección y disposición">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="b" unit="cm" value={input.b_cm} onChange={(v) => up("b_cm", v)} step={5} />
              <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} step={5} />
              <NumberField label="# barras a tracción" value={input.n_bars} onChange={(v) => up("n_bars", v)} step={1} />
              <NumberField label="s actual" unit="cm" value={input.s_actual_cm} onChange={(v) => up("s_actual_cm", v)} step={1} />
            </div>
          </InputCard>

          <InputCard label="Exposición ambiental">
            <select className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.exposure}
              onChange={(e) => up("exposure", e.target.value as FisuracionInput["exposure"])}>
              <option value="interior">Interior seco (w ≤ 0.40 mm)</option>
              <option value="exterior">Exterior húmedo (w ≤ 0.30 mm)</option>
              <option value="aggressive">Agresivo / marino (w ≤ 0.18 mm)</option>
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
              Sección — barras y fisura predicha
            </div>
            <ExpandableDiagram title="Control de fisuración">
              <FisuracionDiagram r={result} />
            </ExpandableDiagram>
          </div>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Resumen</div>
            <div className="text-zinc-300">fs = {result.fs_kgcm2.toFixed(0)} kg/cm² = {result.fs_MPa.toFixed(0)} MPa</div>
            <div className="text-zinc-300">cc = {result.cc.toFixed(1)} cm · dc = {(result.dc_mm / 10).toFixed(2)} cm</div>
            <div className="text-zinc-300">s_max gobernante = {result.governing_limit_cm.toFixed(1)} cm</div>
            <div className="text-zinc-300">w (Frosch) = {result.w_frosch_mm.toFixed(3)} mm</div>
            <div className="text-zinc-300">w (Gergely-Lutz) = {result.w_GL_mm.toFixed(3)} mm</div>
            <div className={result.fisura_ok ? "text-emerald-400" : "text-red-400"}>
              {result.fisura_ok ? "Cumple §24.3" : "FALLA — reducir s o aumentar # barras"}
            </div>
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>ACI 318-14 §24.3 — Distribución del refuerzo en tracción.</li>
              <li>ACI 318-14 §24.3.2 — Separación máxima de barras (eq. 24.3.2).</li>
              <li>ACI 224R-01 — Control of Cracking in Concrete Structures.</li>
              <li>Frosch, R.J. (1999) — Crack control reformulation, ACI SJ V.96 No.3.</li>
              <li>Gergely & Lutz (1968) — Maximum crack width formula, ACI SP-20.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
