"use client";

/**
 * /studio/shear-wall — muro de corte. ACI §18.10.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { ShearWallDiagramSet, ShearWallElevation } from "@/components/studio/MoreDiagrams";
import { ReinforcementTable } from "@/components/studio/ReinforcementTable";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeShearWallLive, buildShearWallSteps, buildShearWallChecks,
  type ShearWallInput,
} from "@/lib/shear-wall-live";
import { computeFisuracionLive } from "@/lib/fisuracion-live";

const DEFAULT: ShearWallInput = {
  lw_m: 3.5, hw_m: 6.0, t_cm: 20,
  Pu_ton: 80, Vu_ton: 30, Mu_tonm: 90,
  fc: 245, fy: 4200, zona: 3,
};

export default function ShearWallPage() {
  const [input, setInput] = useState<ShearWallInput>(DEFAULT);
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
  const result = useMemo(() => computeShearWallLive(input), [input]);
  const steps = useMemo(() => buildShearWallSteps(result), [result]);
  const checks = useMemo(() => buildShearWallChecks(result), [result]);

  // ─── Correlation Refactor: Control de fisuración (siempre visible) ─────
  // Muros: refuerzo vertical típico #4 @ 20 cm. Recubrimiento mínimo 2.5 cm
  // para muros (ACI §20.6.1.3, exposición interior).
  const crackResult = useMemo(() => {
    const db_mm = 12.7; // #4
    const s_actual_cm = 20;
    const cc_cm = 2.5;
    return computeFisuracionLive({
      db_mm,
      fy_kgcm2: input.fy,
      cc_cm,
      fs_service_kgcm2: 0,
      s_actual_cm,
      exposure: "interior",
      h_cm: input.t_cm,
      b_cm: input.lw_m * 100,
      n_bars: Math.floor((input.lw_m * 100) / s_actual_cm),
    });
  }, [input]);

  function up<K extends keyof ShearWallInput>(k: K, v: ShearWallInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Muro de corte"
      subtitle="ACI 318-14 §18.10. Diseño por corte con cuantías mínimas y verificación de límites."
      stepPrefix="wall."
      referencesBundle="wall"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Muro de corte lw=${input.lw_m} m × hw=${input.hw_m} m`,
          elementType: "shear_wall",
          zonaSismica: input.zona, fc: input.fc, fy: input.fy,
          inputs: [
            { name: "lw", value: input.lw_m, unit: "m" },
            { name: "hw", value: input.hw_m, unit: "m" },
            { name: "t", value: input.t_cm, unit: "cm" },
            { name: "Pu", value: input.Pu_ton, unit: "ton" },
            { name: "Vu", value: input.Vu_ton, unit: "ton" },
            { name: "Mu", value: input.Mu_tonm, unit: "ton-m" },
          ],
          steps, checks,
          reinforcement: {
            longitudinal: [{ n: 0, size: 4, As_total: result.As_vert_min,
              position: `Vertical ρ=${(result.rho_min * 100).toFixed(3)}%, ${result.dos_cortinas ? "doble cortina" : "una cortina"}` }],
            transversal: [{ size: 4, separacion_cm: 20,
              zona: `Horizontal ρ=${(result.rho_min * 100).toFixed(3)}%`,
              ramas: result.dos_cortinas ? 2 : 1 }],
          },
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "SW-1 — Elevación con cortinas", element: <ShearWallElevation r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="shear-wall"
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
          <InputCard label="Geometría">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="lw" unit="m" value={input.lw_m} onChange={(v) => up("lw_m", v)} step={0.1} />
              <NumberField label="hw" unit="m" value={input.hw_m} onChange={(v) => up("hw_m", v)} step={0.1} />
              <NumberField label="t" unit="cm" value={input.t_cm} onChange={(v) => up("t_cm", v)} />
            </div>
          </InputCard>
          <InputCard label="Cargas">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Pu" unit="ton" value={input.Pu_ton} onChange={(v) => up("Pu_ton", v)} step={1} />
              <NumberField label="Vu" unit="ton" value={input.Vu_ton} onChange={(v) => up("Vu_ton", v)} step={0.5} />
              <NumberField label="Mu" unit="ton-m" value={input.Mu_tonm} onChange={(v) => up("Mu_tonm", v)} step={1} />
            </div>
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
          <ShearWallDiagramSet r={result} />
          <ReinforcementTable
            longitudinal={[
              { n: "ρ_min", size: 4, As_total: result.As_vert_min,
                position: `Vertical (cm²/m). ${result.dos_cortinas ? "Doble cortina" : "Una cortina"}` },
            ]}
            transversal={[
              { size: 4, separacion_cm: 20,
                zona: `Horizontal · ρ = ${(result.rho_min * 100).toFixed(3)}%`,
                ramas: result.dos_cortinas ? 2 : 1 },
            ]}
          />

          {/* Sub-panel: Control de fisuración (siempre visible) */}
          <details className="border border-amber-700/40 rounded-lg p-3 bg-amber-900/10 mt-3">
            <summary className="cursor-pointer text-sm text-amber-200 font-semibold">
              Control de fisuración (s = {crackResult.s_actual.toFixed(1)} cm · s_max = {crackResult.governing_limit_cm.toFixed(1)} cm)
            </summary>
            <div className="mt-3 space-y-2 text-xs text-zinc-300">
              <div>db = {crackResult.db.toFixed(1)} mm (#4 vertical típico) · fs ≈ {crackResult.fs_kgcm2.toFixed(0)} kg/cm²</div>
              <div>s_max₁ (ACI 24.3.2) = {crackResult.s_max1_cm.toFixed(1)} · s_max₂ = {crackResult.s_max2_cm.toFixed(1)} cm</div>
              <div>w_Frosch = {crackResult.w_frosch_mm.toFixed(3)} mm</div>
              <div>
                Cumple ACI §24.3.2:{" "}
                <span className={crackResult.fisura_ok ? "text-emerald-400" : "text-red-400"}>
                  {crackResult.fisura_ok ? "Sí ✓" : "No ✗"}
                </span>
              </div>
              <a href="/studio/fisuracion" className="text-amber-400 hover:underline text-[10px] inline-block">
                Abrir calculadora completa →
              </a>
            </div>
          </details>
        </>
      }
    />
  );
}
