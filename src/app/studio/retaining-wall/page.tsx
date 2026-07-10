"use client";

/**
 * /studio/retaining-wall — Muro de Contención en Voladizo.
 *
 * Ported from Luis Maldonado / Structural Tech PDF (15 pages, with 11
 * hand-drawn engineering diagrams). Every diagram is reactive: edit any
 * input → the cross-section, pressure triangles, vector arrows, force
 * tables, factor-of-safety badges and reinforcement schedule all redraw.
 *
 * 20 calculation steps, 9 verifications, 11 diagrams.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import {
  RetainingWallDiagramSet,
  D1_CrossSection, D3_EmpujeActivo, D4_EmpujeSobrecarga, D5_EmpujePasivo,
  D6_SectionWeights, D7_Vuelco, D8_Deslizamiento, D9_PressureDistribution,
  D10_PantallaBendingShear, D11_FinalReinforcement,
} from "@/components/studio/RetainingWallDiagrams";
import { ReinforcementTable } from "@/components/studio/ReinforcementTable";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeRetainingWallLive,
  buildRetainingWallSteps,
  buildRetainingWallChecks,
  type RetainingWallInput,
} from "@/lib/retaining-wall-live";

const DEFAULT_INPUT: RetainingWallInput = {
  c_m: 0.30,
  ct_m: 0.50,
  b_m: 0.90,
  H_m: 5.10,
  Hz_m: 0.40,
  Bp_m: 2.30,
  D_m: 0.80,
  gamma_r: 16,    // kN/m³ (= 1600 kg/m³)
  phi_deg: 35,
  cohesion: 0,
  qSC: 10,        // kN/m² (= 1000 kg/m²)
  qadm: 200,      // kPa (= 2 kg/cm²)
  fc: 210,        // kg/cm²
  fy: 4200,
  gamma_c: 24,    // kN/m³ (= 2400 kg/m³)
  mu_ct: 0.55,
  phi_flexion: 0.90,
  phi_corte: 0.75,
  recubrimiento_cm: 7.5,
  zonaSismica: 3,
};

export default function RetainingWallPage() {
  const [input, setInput] = useState<RetainingWallInput>(DEFAULT_INPUT);
  const { meta, projectName } = useProjectContext();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!meta || prefilledRef.current) return;
    prefilledRef.current = true;
    setInput((p) => ({
      ...p,
      fc: meta.fc_default ?? p.fc,
      fy: meta.fy_default ?? p.fy,
      zonaSismica: (meta.zonaSismica as 1 | 2 | 3 | 4) ?? p.zonaSismica,
      // qa_ton_m2 in meta → input.qadm (kPa). 1 ton/m² ≈ 9.807 kPa.
      qadm: meta.qa_ton_m2 != null ? meta.qa_ton_m2 * 9.807 : p.qadm,
      phi_deg: meta.phi_deg ?? p.phi_deg,
      cohesion: meta.c_kPa ?? p.cohesion,
      gamma_r: meta.gamma_kN_m3 ?? p.gamma_r,
    }));
  }, [meta]);
  const result = useMemo(() => computeRetainingWallLive(input), [input]);
  const steps = useMemo(() => buildRetainingWallSteps(result), [result]);
  const checks = useMemo(() => buildRetainingWallChecks(result), [result]);

  function up<K extends keyof RetainingWallInput>(k: K, v: RetainingWallInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Muro de Contención en Voladizo"
      subtitle={`B = ${result.B_m.toFixed(2)} m · Htot = ${result.H_total_m.toFixed(2)} m · Ka = ${result.Ka.toFixed(3)} · Kp = ${result.Kp.toFixed(2)}`}
      stepPrefix="rw."
      referencesBundle="retaining"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Muro de contención H=${input.H_m} m`,
          elementType: "retaining_wall",
          zonaSismica: input.zonaSismica, fc: input.fc, fy: input.fy,
          inputs: [
            { name: "H pantalla", value: input.H_m, unit: "m" },
            { name: "Hz zapata", value: input.Hz_m, unit: "m" },
            { name: "B base", value: result.B_m, unit: "m" },
            { name: "γ_r relleno (suelos)", value: input.gamma_r, unit: "kN/m³" },
            { name: "φ relleno (suelos)", value: input.phi_deg, unit: "°" },
            { name: "qa fundación (suelos)", value: input.qadm, unit: "kPa" },
            { name: "q sobrecarga", value: input.qSC, unit: "kN/m²" },
          ],
          steps, checks,
          reinforcement: {
            longitudinal: [
              { n: 0, size: result.As_pantalla_size, As_total: result.As_pantalla_diseno_cm2,
                position: `Pantalla interior @ ${result.As_pantalla_sep_cm.toFixed(0)} cm` },
              { n: 0, size: result.As_talonPost_size, As_total: result.As_talonPost_diseno_cm2,
                position: `Talón posterior @ ${result.As_talonPost_sep_cm.toFixed(0)} cm` },
              { n: 0, size: result.As_talonDel_size, As_total: result.As_talonDel_diseno_cm2,
                position: `Talón delantero @ ${result.As_talonDel_sep_cm.toFixed(0)} cm` },
            ],
          },
          notes: [...result.warnings, ...result.errors],
          diagrams: renderDiagrams([
            { title: "D1 — Sección con cargas", element: <D1_CrossSection r={result} /> },
            { title: "D6 — Pesos por sección", element: <D6_SectionWeights r={result} /> },
            { title: "D3 — Empuje activo", element: <D3_EmpujeActivo r={result} /> },
            { title: "D4 — Empuje sobrecarga", element: <D4_EmpujeSobrecarga r={result} /> },
            { title: "D5 — Empuje pasivo", element: <D5_EmpujePasivo r={result} /> },
            { title: "D7 — Vuelco", element: <D7_Vuelco r={result} /> },
            { title: "D8 — Deslizamiento", element: <D8_Deslizamiento r={result} /> },
            { title: "D9 — Distribución de presión", element: <D9_PressureDistribution r={result} /> },
            { title: "D10 — Flexión + cortante pantalla", element: <D10_PantallaBendingShear r={result} /> },
            { title: "D11 — Armadura final", element: <D11_FinalReinforcement r={result} /> },
          ]),
        })
      }
      warnings={[...result.warnings, ...result.errors]}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="retaining-wall"
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
          <InputCard label="Geometría del muro">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="c (corona)" unit="m" value={input.c_m} onChange={(v) => up("c_m", v)} step={0.05} />
              <NumberField label="ct (base pantalla)" unit="m" value={input.ct_m} onChange={(v) => up("ct_m", v)} step={0.05} />
              <NumberField label="b (punta)" unit="m" value={input.b_m} onChange={(v) => up("b_m", v)} step={0.05} />
              <NumberField label="Bp (talón post.)" unit="m" value={input.Bp_m} onChange={(v) => up("Bp_m", v)} step={0.05} />
              <NumberField label="H (altura pant.)" unit="m" value={input.H_m} onChange={(v) => up("H_m", v)} step={0.1} />
              <NumberField label="Hz (zapata)" unit="m" value={input.Hz_m} onChange={(v) => up("Hz_m", v)} step={0.05} />
              <NumberField label="D (desplante)" unit="m" value={input.D_m} onChange={(v) => up("D_m", v)} step={0.05} />
              <NumberField label="recubrim." unit="cm" value={input.recubrimiento_cm} onChange={(v) => up("recubrimiento_cm", v)} step={0.5} />
            </div>
          </InputCard>
          <InputCard label="Suelo de relleno">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="γ_r" unit="kN/m³" value={input.gamma_r} onChange={(v) => up("gamma_r", v)} step={0.5} source="soil" />
              <NumberField label="φ" unit="°" value={input.phi_deg} onChange={(v) => up("phi_deg", v)} step={1} source="soil" />
              <NumberField label="cohesión" unit="kN/m²" value={input.cohesion} onChange={(v) => up("cohesion", v)} step={1} source="soil" />
              <NumberField label="sobrecarga q" unit="kN/m²" value={input.qSC} onChange={(v) => up("qSC", v)} step={1} source="loads" />
            </div>
          </InputCard>
          <InputCard label="Suelo de fundación">
            <NumberField label="q adm" unit="kPa" value={input.qadm} onChange={(v) => up("qadm", v)} step={10} source="soil" />
          </InputCard>
          <InputCard label="Materiales">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="f'c" unit="kg/cm²" value={input.fc} onChange={(v) => up("fc", v)} step={5} />
              <NumberField label="fy" unit="kg/cm²" value={input.fy} onChange={(v) => up("fy", v)} step={100} />
              <NumberField label="γ_c" unit="kN/m³" value={input.gamma_c} onChange={(v) => up("gamma_c", v)} step={0.5} />
              <NumberField label="μ concreto-suelo" value={input.mu_ct} onChange={(v) => up("mu_ct", v)} step={0.05} />
            </div>
          </InputCard>
          <InputCard label="Zona sísmica">
            <select value={input.zonaSismica}
              onChange={(e) => up("zonaSismica", parseInt(e.target.value) as 1 | 2 | 3 | 4)}
              className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200">
              <option value={1}>Zona I</option>
              <option value={2}>Zona II</option>
              <option value={3}>Zona III</option>
              <option value={4}>Zona IV</option>
            </select>
          </InputCard>
        </>
      }
      steps={steps}
      checks={checks}
      reinforcement={
        <>
          <RetainingWallDiagramSet r={result} />
          <ReinforcementTable
            title="Resumen de armadura"
            longitudinal={[
              {
                n: `~${Math.ceil(100 / result.As_pantalla_sep_cm)}/m`,
                size: result.As_pantalla_size,
                As_total: result.As_pantalla_diseno_cm2,
                position: `Pantalla — vertical interior @ ${result.As_pantalla_sep_cm.toFixed(0)} cm`,
              },
              {
                n: `~${Math.ceil(100 / result.As_pantalla_ext_sep_cm)}/m`,
                size: result.As_pantalla_ext_size,
                As_total: result.As_pantalla_ext_cm2,
                position: `Pantalla — vertical exterior @ ${result.As_pantalla_ext_sep_cm.toFixed(0)} cm`,
              },
              {
                n: `~${Math.ceil(100 / result.As_talonPost_sep_cm)}/m`,
                size: result.As_talonPost_size,
                As_total: result.As_talonPost_diseno_cm2,
                position: `Zapata — talón posterior superior @ ${result.As_talonPost_sep_cm.toFixed(0)} cm`,
              },
              {
                n: `~${Math.ceil(100 / result.As_talonDel_sep_cm)}/m`,
                size: result.As_talonDel_size,
                As_total: result.As_talonDel_diseno_cm2,
                position: `Zapata — talón delantero inferior @ ${result.As_talonDel_sep_cm.toFixed(0)} cm`,
              },
            ]}
          />
        </>
      }
    />
  );
}
