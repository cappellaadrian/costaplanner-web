"use client";

/**
 * /studio/one-way-slab — losa en una dirección por franja de 1 m.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { OneWaySlabDiagramSet, OWSSection, OWSMomentDiagram } from "@/components/studio/MoreDiagrams";
import { ReinforcementTable } from "@/components/studio/ReinforcementTable";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeOneWaySlabLive, buildOneWaySlabSteps, buildOneWaySlabChecks,
  type OneWaySlabInput, type OneWayCondition, ACI_COEFF_1WAY,
} from "@/lib/one-way-slab-live";
import { computeDeflexionLargoPlazoLive } from "@/lib/deflexion-largo-plazo-live";
import { computeFisuracionLive } from "@/lib/fisuracion-live";

const DEFAULT: OneWaySlabInput = {
  Lcorto_m: 3.5, Llargo_m: 7.0, h_cm: 12, r_cm: 2,
  Ln_m: 3.5, wu_ton_m2: 0.85,
  condicion: "first_span_pos",
  fc: 245, fy: 4200, zona: 3,
};

const CONDITION_LABELS: Record<OneWayCondition, string> = {
  first_exterior_simple: "Apoyo exterior simple",
  first_exterior_fixed: "Apoyo exterior empotrado",
  first_interior_2spans: "Primer interior (2 luces)",
  first_interior_3plus: "Primer interior (3+ luces)",
  other_interior: "Otros interiores",
  first_span_pos: "Primer claro (positivo)",
  interior_span_pos: "Claros interiores (positivo)",
};

export default function OneWaySlabPage() {
  const [input, setInput] = useState<OneWaySlabInput>(DEFAULT);
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
  const result = useMemo(() => computeOneWaySlabLive(input), [input]);
  const steps = useMemo(() => buildOneWaySlabSteps(result), [result]);
  const checks = useMemo(() => buildOneWaySlabChecks(result), [result]);

  // ─── Correlation Refactor: live sub-verifications ───────────────────────
  // Deflexión a largo plazo — siempre visible. wu (ton/m²) por franja de 1 m
  // → ton/m. Split 60/40 DL/LL. Service ≈ wu/1.4.
  const deflectionResult = useMemo(() => {
    const wu_service_per_m = input.wu_ton_m2 / 1.4; // ton/m (franja de 1 m)
    const wD = 0.6 * wu_service_per_m;
    const wL = 0.4 * wu_service_per_m;
    return computeDeflexionLargoPlazoLive({
      tipo: "losa_1dir",
      L_m: input.Ln_m,
      b_cm: 100, // franja de 1 m
      h_cm: input.h_cm,
      d_cm: result.d_cm,
      r_cm: input.r_cm,
      fc: input.fc,
      fy: input.fy,
      As_cm2: result.As_prov,
      AsP_cm2: 0, // losa: típicamente sin acero a compresión
      wD_tonm: wD,
      wL_tonm: wL,
      sustained_fraction_L: 0.30,
      age_loading_days: 5 * 365,
      limite: "L/240",
    });
  }, [input, result.d_cm, result.As_prov]);

  // Control de fisuración — siempre visible. Espaciamiento real = result.s.
  const crackResult = useMemo(() => {
    // Map ACI bar number to mm (#4 ≈ 12.7, #5 ≈ 15.875, etc.)
    const dbMap: Record<number, number> = {
      3: 9.525, 4: 12.7, 5: 15.875, 6: 19.05, 7: 22.225, 8: 25.4,
    };
    const db_mm = dbMap[result.size] ?? 12.7;
    return computeFisuracionLive({
      db_mm,
      fy_kgcm2: input.fy,
      cc_cm: input.r_cm,
      fs_service_kgcm2: 0,
      s_actual_cm: result.s,
      exposure: "interior",
      h_cm: input.h_cm,
      b_cm: 100,
      n_bars: result.n,
    });
  }, [input, result.s, result.n, result.size]);

  function up<K extends keyof OneWaySlabInput>(k: K, v: OneWaySlabInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Losa en una dirección"
      subtitle="Por franja de 1 m. ACI 318-14 §7-8. Coeficientes §6.5.2."
      stepPrefix="ow_slab."
      referencesBundle="slab"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Losa 1 dir. L=${input.Lcorto_m} m`,
          elementType: "one_way_slab",
          zonaSismica: input.zona, fc: input.fc, fy: input.fy,
          inputs: [
            { name: "Lcorto", value: input.Lcorto_m, unit: "m" },
            { name: "Llargo", value: input.Llargo_m, unit: "m" },
            { name: "h", value: input.h_cm, unit: "cm" },
            { name: "wu", value: input.wu_ton_m2, unit: "ton/m²" },
            { name: "Condición", value: input.condicion },
          ],
          steps, checks,
          reinforcement: {
            longitudinal: [
              { n: result.n, size: result.size, As_total: result.As_prov,
                position: `Principal sep ${result.s.toFixed(1)} cm` },
              { n: result.n_temp, size: result.size_temp, As_total: result.As_temp_prov,
                position: `Temperatura sep ${result.s_temp.toFixed(1)} cm` },
            ],
          },
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "OWS-1 — Sección por metro", element: <OWSSection r={result} /> },
            { title: "OWS-2 — Diagrama de momento", element: <OWSMomentDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="one-way-slab"
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
              <NumberField label="L corto" unit="m" value={input.Lcorto_m} onChange={(v) => up("Lcorto_m", v)} step={0.1} />
              <NumberField label="L largo" unit="m" value={input.Llargo_m} onChange={(v) => up("Llargo_m", v)} step={0.1} />
              <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} />
              <NumberField label="recubrim." unit="cm" value={input.r_cm} onChange={(v) => up("r_cm", v)} step={0.5} />
              <NumberField label="Ln (luz lib.)" unit="m" value={input.Ln_m} onChange={(v) => up("Ln_m", v)} step={0.1} />
            </div>
          </InputCard>
          <InputCard label="Cargas">
            <NumberField label="wu" unit="ton/m²" value={input.wu_ton_m2}
              onChange={(v) => up("wu_ton_m2", v)} step={0.05} />
          </InputCard>
          <InputCard label="Condición ACI">
            <select value={input.condicion}
              onChange={(e) => up("condicion", e.target.value as OneWayCondition)}
              className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-xs text-amber-200">
              {(Object.keys(ACI_COEFF_1WAY) as OneWayCondition[]).map((k) => (
                <option key={k} value={k}>{CONDITION_LABELS[k]}</option>
              ))}
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
          <OneWaySlabDiagramSet r={result} />
          <ReinforcementTable
            longitudinal={[
              { n: result.n, size: result.size, As_total: result.As_prov,
                position: `Principal corta (por m). Sep ${result.s.toFixed(1)} cm` },
              { n: result.n_temp, size: result.size_temp, As_total: result.As_temp_prov,
                position: `Temperatura larga (por m). Sep ${result.s_temp.toFixed(1)} cm` },
            ]}
          />

          {/* Sub-panel: Deflexión a largo plazo (siempre visible) */}
          <details className="border border-amber-700/40 rounded-lg p-3 bg-amber-900/10 mt-3">
            <summary className="cursor-pointer text-sm text-amber-200 font-semibold">
              Deflexión a largo plazo (Δ_total = {deflectionResult.delta_total_cm.toFixed(2)} cm · L/240 = {deflectionResult.limit_cm.toFixed(2)} cm)
            </summary>
            <div className="mt-3 space-y-2 text-xs text-zinc-300">
              <div>Δinst,L = {deflectionResult.delta_inst_L_cm.toFixed(3)} · Δlong = {deflectionResult.delta_long_cm.toFixed(3)} cm</div>
              <div>λΔ = {deflectionResult.lambda_delta.toFixed(2)} · ρ' = {(deflectionResult.rho_prime * 100).toFixed(2)}%</div>
              <div>
                Cumple L/240:{" "}
                <span className={deflectionResult.limite_ok ? "text-emerald-400" : "text-red-400"}>
                  {deflectionResult.limite_ok ? "Sí ✓" : "No ✗"}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 italic">
                wD/wL derivadas de wu (60% DL / 40% LL, factor 1.4 → servicio). Usa la calculadora completa para precisión.
              </p>
              <a href="/studio/deflexion-largo-plazo" className="text-amber-400 hover:underline text-[10px] inline-block">
                Abrir calculadora completa →
              </a>
            </div>
          </details>

          {/* Sub-panel: Control de fisuración (siempre visible) */}
          <details className="border border-amber-700/40 rounded-lg p-3 bg-amber-900/10 mt-3">
            <summary className="cursor-pointer text-sm text-amber-200 font-semibold">
              Control de fisuración (s = {crackResult.s_actual.toFixed(1)} cm · s_max = {crackResult.governing_limit_cm.toFixed(1)} cm)
            </summary>
            <div className="mt-3 space-y-2 text-xs text-zinc-300">
              <div>db = {crackResult.db.toFixed(1)} mm · fs ≈ {crackResult.fs_kgcm2.toFixed(0)} kg/cm²</div>
              <div>s_max₁ = {crackResult.s_max1_cm.toFixed(1)} · s_max₂ = {crackResult.s_max2_cm.toFixed(1)} cm</div>
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
