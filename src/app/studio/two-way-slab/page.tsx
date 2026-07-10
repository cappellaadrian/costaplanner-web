"use client";

/**
 * /studio/two-way-slab — losa en dos direcciones (Método 3 ACI 318-63).
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { TwoWaySlabDiagramSet, TWSPlan } from "@/components/studio/MoreDiagrams";
import { ReinforcementTable } from "@/components/studio/ReinforcementTable";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeTwoWaySlabLive, buildTwoWaySlabSteps, buildTwoWaySlabChecks,
  type TwoWaySlabInput,
} from "@/lib/two-way-slab-live";
import { computeDeflexionLargoPlazoLive } from "@/lib/deflexion-largo-plazo-live";
import { computeFisuracionLive } from "@/lib/fisuracion-live";

const DEFAULT: TwoWaySlabInput = {
  a_m: 4.0, b_m: 5.0, h_cm: 14, r_cm: 2,
  CP_ton_m2: 0.35, CT_ton_m2: 0.25,
  fc: 245, fy: 4200, zona: 3, caso: 2, fR: 1.0,
};

export default function TwoWaySlabPage() {
  const [input, setInput] = useState<TwoWaySlabInput>(DEFAULT);
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
  const result = useMemo(() => computeTwoWaySlabLive(input), [input]);
  const steps = useMemo(() => buildTwoWaySlabSteps(result), [result]);
  const checks = useMemo(() => buildTwoWaySlabChecks(result), [result]);

  // ─── Correlation Refactor: live sub-verifications ───────────────────────
  // Deflexión a largo plazo — siempre visible. Usamos la dirección corta
  // (controla en losas 2-dir) por franja de 1 m. Cargas: CP servicio (CP) y
  // CT como wL.
  const deflectionResult = useMemo(() => {
    return computeDeflexionLargoPlazoLive({
      tipo: "losa_1dir", // aproximación: franja en dirección corta
      L_m: input.a_m,    // dirección corta gobierna
      b_cm: 100,
      h_cm: input.h_cm,
      d_cm: result.d_a > 0 ? result.d_a : input.h_cm - input.r_cm - 0.5,
      r_cm: input.r_cm,
      fc: input.fc,
      fy: input.fy,
      As_cm2: result.As_prov_a,
      AsP_cm2: 0,
      wD_tonm: input.CP_ton_m2, // servicio CP (ton/m² por franja de 1m → ton/m)
      wL_tonm: input.CT_ton_m2,
      sustained_fraction_L: 0.30,
      age_loading_days: 5 * 365,
      limite: "L/240",
    });
  }, [input, result.d_a, result.As_prov_a]);

  // Control de fisuración — siempre visible (dirección corta).
  const crackResult = useMemo(() => {
    const dbMap: Record<number, number> = {
      3: 9.525, 4: 12.7, 5: 15.875, 6: 19.05, 7: 22.225, 8: 25.4,
    };
    const db_mm = dbMap[result.size_a] ?? 12.7;
    return computeFisuracionLive({
      db_mm,
      fy_kgcm2: input.fy,
      cc_cm: input.r_cm,
      fs_service_kgcm2: 0,
      s_actual_cm: result.s_a > 0 ? result.s_a : 15,
      exposure: "interior",
      h_cm: input.h_cm,
      b_cm: 100,
      n_bars: result.n_a > 0 ? result.n_a : 5,
    });
  }, [input, result.s_a, result.n_a, result.size_a]);

  function up<K extends keyof TwoWaySlabInput>(k: K, v: TwoWaySlabInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Losa en dos direcciones"
      subtitle="Método de coeficientes ACI 318-63 (Método 3). Caso 2 (un borde corto discontinuo)."
      stepPrefix="tw_slab."
      referencesBundle="slab"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Losa 2 dir. ${input.a_m}×${input.b_m} m`,
          elementType: "two_way_slab",
          zonaSismica: input.zona, fc: input.fc, fy: input.fy,
          inputs: [
            { name: "a (corta)", value: input.a_m, unit: "m" },
            { name: "b (larga)", value: input.b_m, unit: "m" },
            { name: "h", value: input.h_cm, unit: "cm" },
            { name: "CP", value: input.CP_ton_m2, unit: "ton/m²" },
            { name: "CT", value: input.CT_ton_m2, unit: "ton/m²" },
          ],
          steps, checks,
          reinforcement: {
            longitudinal: [
              { n: result.n_a, size: result.size_a, As_total: result.As_prov_a,
                position: `Dir. corta, sep ${result.s_a.toFixed(1)} cm` },
              { n: result.n_b, size: result.size_b, As_total: result.As_prov_b,
                position: `Dir. larga, sep ${result.s_b.toFixed(1)} cm` },
            ],
          },
          notes: [...result.warnings, ...result.errors],
          diagrams: renderDiagrams([
            { title: "TWS-1 — Planta + franjas", element: <TWSPlan r={result} /> },
          ]),
        })
      }
      warnings={[...result.warnings, ...result.errors]}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="two-way-slab"
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
              <NumberField label="a corta" unit="m" value={input.a_m} onChange={(v) => up("a_m", v)} step={0.1} />
              <NumberField label="b larga" unit="m" value={input.b_m} onChange={(v) => up("b_m", v)} step={0.1} />
              <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} />
              <NumberField label="recubrim." unit="cm" value={input.r_cm} onChange={(v) => up("r_cm", v)} step={0.5} />
            </div>
          </InputCard>
          <InputCard label="Cargas">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="CP" unit="ton/m²" value={input.CP_ton_m2} onChange={(v) => up("CP_ton_m2", v)} step={0.05} />
              <NumberField label="CT" unit="ton/m²" value={input.CT_ton_m2} onChange={(v) => up("CT_ton_m2", v)} step={0.05} />
              <NumberField label="fR" value={input.fR} onChange={(v) => up("fR", v)} step={0.05} />
            </div>
          </InputCard>
          <InputCard label="Caso (bordes)">
            <select value={input.caso}
              onChange={(e) => up("caso", parseInt(e.target.value))}
              className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-xs text-amber-200">
              <option value={2}>Caso 2 — un borde corto discontinuo</option>
              <option value={1}>Caso 1 — todos los bordes continuos (próximamente)</option>
              <option value={3}>Caso 3 — un borde largo discontinuo (próximamente)</option>
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
          <TwoWaySlabDiagramSet r={result} />
          <ReinforcementTable
            longitudinal={[
              { n: result.n_a, size: result.size_a, As_total: result.As_prov_a,
                position: `Dir. corta (abajo). Sep ${result.s_a.toFixed(1)} cm` },
              { n: result.n_b, size: result.size_b, As_total: result.As_prov_b,
                position: `Dir. larga (encima de corta). Sep ${result.s_b.toFixed(1)} cm` },
            ]}
          />

          {/* Sub-panel: Deflexión a largo plazo (siempre visible) */}
          <details className="border border-amber-700/40 rounded-lg p-3 bg-amber-900/10 mt-3">
            <summary className="cursor-pointer text-sm text-amber-200 font-semibold">
              Deflexión a largo plazo (Δ_total = {deflectionResult.delta_total_cm.toFixed(2)} cm · L/240 = {deflectionResult.limit_cm.toFixed(2)} cm)
            </summary>
            <div className="mt-3 space-y-2 text-xs text-zinc-300">
              <div>Dirección corta gobernante (L = {input.a_m.toFixed(2)} m)</div>
              <div>Δinst,L = {deflectionResult.delta_inst_L_cm.toFixed(3)} · Δlong = {deflectionResult.delta_long_cm.toFixed(3)} cm</div>
              <div>λΔ = {deflectionResult.lambda_delta.toFixed(2)}</div>
              <div>
                Cumple L/240:{" "}
                <span className={deflectionResult.limite_ok ? "text-emerald-400" : "text-red-400"}>
                  {deflectionResult.limite_ok ? "Sí ✓" : "No ✗"}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 italic">
                Aproximación 1-D en dirección corta. Para análisis 2-D usa la calculadora completa.
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
