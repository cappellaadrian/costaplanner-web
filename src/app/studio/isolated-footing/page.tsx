"use client";

/**
 * /studio/isolated-footing — zapata aislada bajo columna.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import {
  IsolatedFootingDiagramSet,
  D12_PlanView, D13_ElevationX, D14_ElevationY, D16_PressureDist,
  D17_ShearL, D18_ShearS, D19_Punzonamiento, D20_FinalRebar,
} from "@/components/studio/IsolatedFootingDiagrams";
import { ReinforcementTable } from "@/components/studio/ReinforcementTable";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeIsolatedFootingLive,
  buildIsolatedFootingSteps,
  buildIsolatedFootingChecks,
  type IsolatedFootingInput,
} from "@/lib/isolated-footing-live";
import { computePunzonamientoMomentoLive } from "@/lib/punzonamiento-momento-live";

const DEFAULT: IsolatedFootingInput = {
  B_m: 1.8, L_m: 1.8, h_cm: 45,
  bc_cm: 35, lc_cm: 35, r_cm: 7.5,
  Pu_ton: 60, Mu_tonm: 4.5,
  qa_ton_m2: 15, fc: 245, fy: 4200,
  zona: 3, withSeismic: false,
};

export default function IsolatedFootingPage() {
  const [input, setInput] = useState<IsolatedFootingInput>(DEFAULT);
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
      qa_ton_m2: meta.qa_ton_m2 ?? p.qa_ton_m2,
    }));
  }, [meta]);
  const result = useMemo(() => computeIsolatedFootingLive(input), [input]);
  const steps = useMemo(() => buildIsolatedFootingSteps(result), [result]);
  const checks = useMemo(() => buildIsolatedFootingChecks(result), [result]);

  // ─── Correlation Refactor: Punzonamiento con transferencia de momento ──
  // Auto-active when Mu > 0. The parent page already computes Vu_pun (the
  // total vertical reaction outside the punching perimeter), d_cm, and the
  // column dimensions c1=bc, c2=lc. We reuse those exact values so the two
  // panels stay consistent.
  const punchingResult = useMemo(() => {
    if (!(input.Mu_tonm > 0)) return null;
    return computePunzonamientoMomentoLive({
      h_cm: input.h_cm,
      d_cm: result.d_cm,
      c1_cm: input.bc_cm,    // dirección del momento (= B short side)
      c2_cm: input.lc_cm,    // perpendicular
      Vu_ton: result.Vu_pun,
      Mu_tonm: input.Mu_tonm,
      edge: "interior",      // zapata aislada → punzonamiento perimetral interior
      fc: input.fc,
      fy: input.fy,
    });
  }, [input, result.d_cm, result.Vu_pun]);
  const showPunching = punchingResult !== null;

  function up<K extends keyof IsolatedFootingInput>(k: K, v: IsolatedFootingInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Zapata aislada"
      subtitle="ACI 318-14 §13 + §22.5 (corte) + §22.6 (punzonamiento). CSCR-10 §6 (suelo)."
      stepPrefix="iso_ftg."
      referencesBundle="footing"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Zapata aislada ${input.B_m}×${input.L_m} m`,
          elementType: "isolated_footing",
          zonaSismica: input.zona, fc: input.fc, fy: input.fy,
          inputs: [
            { name: "B", value: input.B_m, unit: "m" },
            { name: "L", value: input.L_m, unit: "m" },
            { name: "h", value: input.h_cm, unit: "cm" },
            { name: "Columna", value: `${input.bc_cm}×${input.lc_cm}`, unit: "cm" },
            { name: "Pu", value: input.Pu_ton, unit: "ton" },
            { name: "Mu", value: input.Mu_tonm, unit: "ton-m" },
            { name: "qa (estudio suelos)", value: input.qa_ton_m2, unit: "ton/m²" },
          ],
          steps, checks,
          reinforcement: {
            longitudinal: [
              { n: result.n_B, size: result.size_B, As_total: result.As_prov_B,
                position: `Dirección B, sep ${result.s_B.toFixed(1)} cm` },
              { n: result.n_L, size: result.size_L, As_total: result.As_prov_L,
                position: `Dirección L, sep ${result.s_L.toFixed(1)} cm` },
            ],
          },
          notes: [...result.warnings, ...result.errors],
          diagrams: renderDiagrams([
            { title: "D12 — Planta", element: <D12_PlanView r={result} /> },
            { title: "D13 — Elevación X", element: <D13_ElevationX r={result} /> },
            { title: "D14 — Elevación Y", element: <D14_ElevationY r={result} /> },
            { title: "D16 — Presión bajo zapata", element: <D16_PressureDist r={result} /> },
            { title: "D17 — Cortante 1-dir L", element: <D17_ShearL r={result} /> },
            { title: "D18 — Cortante 1-dir S", element: <D18_ShearS r={result} /> },
            { title: "D19 — Punzonamiento", element: <D19_Punzonamiento r={result} /> },
            { title: "D20 — Distribución de acero", element: <D20_FinalRebar r={result} /> },
          ]),
        })
      }
      warnings={[...result.warnings, ...result.errors]}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="isolated-footing"
          buildPayload={() => ({
            archJson: { project_name: projectName ?? "Diseño" },
            structJson: { ...input },
            resultJson: {
              ...result,
              summary: {
                total_elements: 1,
                passing: checks.every((c) => c.cumple) ? 1 : 0,
                requires_review: 0,
                with_errors: result.errors?.length ?? 0,
              },
            },
          })}
        />
      }
      inputs={
        <>
          <InputCard label="Geometría">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="B" unit="m" value={input.B_m} onChange={(v) => up("B_m", v)} step={0.05} />
              <NumberField label="L" unit="m" value={input.L_m} onChange={(v) => up("L_m", v)} step={0.05} />
              <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} />
              <NumberField label="recubrim." unit="cm" value={input.r_cm} onChange={(v) => up("r_cm", v)} step={0.5} />
              <NumberField label="bc col" unit="cm" value={input.bc_cm} onChange={(v) => up("bc_cm", v)} />
              <NumberField label="lc col" unit="cm" value={input.lc_cm} onChange={(v) => up("lc_cm", v)} />
            </div>
          </InputCard>
          <InputCard label="Cargas">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Pu" unit="ton" value={input.Pu_ton} onChange={(v) => up("Pu_ton", v)} step={0.5} source="loads" />
              <NumberField label="Mu" unit="ton-m" value={input.Mu_tonm} onChange={(v) => up("Mu_tonm", v)} step={0.1} source="loads" />
              <NumberField label="qa adm" unit="ton/m²" value={input.qa_ton_m2} onChange={(v) => up("qa_ton_m2", v)} step={1} source="soil" />
            </div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 mt-2 flex items-center gap-1.5">
              <input type="checkbox" checked={input.withSeismic}
                onChange={(e) => up("withSeismic", e.target.checked)} />
              Combinación sísmica
            </label>
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
          <IsolatedFootingDiagramSet r={result} />
          <ReinforcementTable
            longitudinal={[
              { n: result.n_B, size: result.size_B, As_total: result.As_prov_B,
                position: `Dirección B (corta). Sep ${result.s_B.toFixed(1)} cm` },
              { n: result.n_L, size: result.size_L, As_total: result.As_prov_L,
                position: `Dirección L (larga). Sep ${result.s_L.toFixed(1)} cm` },
            ]}
          />

          {/* Sub-panel: Punzonamiento con transferencia de momento (auto when Mu>0) */}
          {showPunching && punchingResult && (
            <details className="border border-amber-700/40 rounded-lg p-3 bg-amber-900/10 mt-3">
              <summary className="cursor-pointer text-sm text-amber-200 font-semibold">
                ⚠️ Punzonamiento con transferencia de momento (vu/φvc = {(punchingResult.vu_combined / punchingResult.phi_vc).toFixed(2)})
              </summary>
              <div className="mt-3 space-y-2 text-xs text-zinc-300">
                <div>γf = {punchingResult.gamma_f.toFixed(3)} · γv = {punchingResult.gamma_v.toFixed(3)}</div>
                <div>bo = {punchingResult.bo.toFixed(1)} cm · Jc = {punchingResult.Jc_cm4.toFixed(0)} cm⁴</div>
                <div>vu axial = {punchingResult.vu_axial.toFixed(2)} + vu momento = {punchingResult.vu_moment.toFixed(2)} = {punchingResult.vu_combined.toFixed(2)} kg/cm²</div>
                <div>φvc = {punchingResult.phi_vc.toFixed(2)} kg/cm² (controla: vc{punchingResult.vc_min_psi === punchingResult.vc1 ? "1" : punchingResult.vc_min_psi === punchingResult.vc2 ? "2" : "3"})</div>
                <div>
                  Cumple ACI §8.4.4:{" "}
                  <span className={punchingResult.shear_pass ? "text-emerald-400" : "text-red-400"}>
                    {punchingResult.shear_pass ? "Sí ✓" : "No ✗ (requiere stud-rails o capitel)"}
                  </span>
                </div>
                <a href="/studio/punzonamiento-momento" className="text-amber-400 hover:underline text-[10px] inline-block">
                  Abrir calculadora completa →
                </a>
              </div>
            </details>
          )}
        </>
      }
    />
  );
}
