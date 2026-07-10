"use client";

/**
 * /studio/circular-column — columna circular con espiral.
 * Aplica ACI §10 + §25.7.3 (espiral). Diseño axial simplificado.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import {
  CircularColumnDiagramSet, CC1_Seccion, CC2_Elevacion, CC3_TraslapeEspiral,
} from "@/components/studio/ColumnDiagrams";
import { ReinforcementTable } from "@/components/studio/ReinforcementTable";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeCircularColumnLive,
  buildCircularColumnSteps,
  buildCircularColumnChecks,
  type CircColumnInput,
} from "@/lib/circular-column-live";
import { computeEsbeltezLive } from "@/lib/esbeltez-columna-live";
import { computeFlexionBiaxialLive } from "@/lib/flexion-biaxial-live";

const DEFAULT_INPUT: CircColumnInput = {
  D_cm: 40, L_cm: 280, r_cm: 4,
  Pu_ton: 120, Mu_max_tonm: 1.5,
  fc: 245, fy: 4200, zona: 3,
  nBarsTentative: 8, sizeBarTentative: 7, sizeEspiral: 3,
};

export default function CircularColumnPage() {
  const [input, setInput] = useState<CircColumnInput>(DEFAULT_INPUT);
  // Auxiliary input for biaxial (Muy on perpendicular axis). 0 hides panel.
  const [Muy_tonm, setMuy] = useState(0);
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
  const result = useMemo(() => computeCircularColumnLive(input), [input]);
  const steps = useMemo(() => buildCircularColumnSteps(result), [result]);
  const checks = useMemo(() => buildCircularColumnChecks(result), [result]);

  // ─── Correlation Refactor: live sub-verifications ───────────────────────
  // Esbeltez — auto-active when klu/r > 22. For circular columns r = 0.25·D.
  // L is in cm here; engine wants lu_m so divide by 100.
  const slendernessResult = useMemo(
    () =>
      computeEsbeltezLive({
        shape: "circ",
        b_cm: 0,
        h_cm: 0,
        D_cm: input.D_cm,
        lu_m: input.L_cm / 100,
        k: 1.0,
        frame: "braced",
        Pu_ton: input.Pu_ton,
        M1_tonm: 0,
        M2_tonm: input.Mu_max_tonm,
        beta_dns: 0.6,
        fc: input.fc,
        fy: input.fy,
      }),
    [input],
  );
  const showSlenderness = slendernessResult.klu_r > 22;

  // Flexión biaxial — auto-active when Mux > 0 AND Muy > 0.
  const biaxialResult = useMemo(() => {
    if (!(input.Mu_max_tonm > 0 && Muy_tonm > 0)) return null;
    return computeFlexionBiaxialLive({
      shape: "circ",
      b_cm: 0,
      h_cm: 0,
      D_cm: input.D_cm,
      r_cm: input.r_cm,
      nBars: result.n_bars,
      barSize: result.size,
      dist: "perimetro",
      fc: input.fc,
      fy: input.fy,
      Pu_ton: input.Pu_ton,
      Mux_tonm: input.Mu_max_tonm,
      Muy_tonm: Muy_tonm,
    });
  }, [input, Muy_tonm, result.n_bars, result.size]);
  const showBiaxial = biaxialResult !== null;

  function up<K extends keyof CircColumnInput>(k: K, v: CircColumnInput[K]) {
    setInput((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <StudioShell
      title="Columna circular — Compresión axial + espiral"
      subtitle="ACI 318-14 §10 + §25.7.3. Diseño simplificado válido cuando e/D ≤ 0.10."
      stepPrefix="circ_col."
      referencesBundle="column"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Columna circular Ø${input.D_cm} cm`,
          elementType: "circular_column",
          zonaSismica: input.zona,
          fc: input.fc, fy: input.fy,
          aceroNorma: input.zona >= 3 ? "A706" : "A615",
          inputs: [
            { name: "D", value: input.D_cm, unit: "cm" },
            { name: "L libre", value: input.L_cm, unit: "cm" },
            { name: "Pu", value: input.Pu_ton, unit: "ton" },
            { name: "f'c", value: input.fc, unit: "kg/cm²" },
            { name: "fy", value: input.fy, unit: "kg/cm²" },
          ],
          steps, checks,
          reinforcement: {
            longitudinal: [{ n: result.n_bars, size: result.size,
              As_total: result.As_prov, position: `Perimetral circular. ρ = ${(result.rho * 100).toFixed(2)}%` }],
            transversal: [{ size: input.sizeEspiral, separacion_cm: result.s_espiral,
              zona: `Espiral continua, lo = ${result.lo.toFixed(0)} cm`, ramas: 1 }],
          },
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "CC-1 — Sección con espiral", element: <CC1_Seccion r={result} /> },
            { title: "CC-2 — Elevación con espiral", element: <CC2_Elevacion r={result} /> },
            { title: "CC-3 — Traslape de espiral", element: <CC3_TraslapeEspiral r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="circular-column"
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
              <NumberField label="D" unit="cm" value={input.D_cm} onChange={(v) => up("D_cm", v)} />
              <NumberField label="L libre" unit="cm" value={input.L_cm} onChange={(v) => up("L_cm", v)} />
              <NumberField label="recubrim." unit="cm" value={input.r_cm} onChange={(v) => up("r_cm", v)} step={0.5} />
            </div>
          </InputCard>
          <InputCard label="Cargas">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Pu" unit="ton" value={input.Pu_ton} onChange={(v) => up("Pu_ton", v)} />
              <NumberField label="Mu max (= Mux)" unit="ton-m" value={input.Mu_max_tonm} onChange={(v) => up("Mu_max_tonm", v)} step={0.1} />
              <NumberField label="Muy (opcional)" unit="ton-m" value={Muy_tonm} onChange={(v) => setMuy(v)} step={0.1} />
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              Si Muy &gt; 0, se activa la verificación de flexión biaxial.
            </p>
          </InputCard>
          <InputCard label="Materiales">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="f'c" unit="kg/cm²" value={input.fc} onChange={(v) => up("fc", v)} step={5} />
              <NumberField label="fy" unit="kg/cm²" value={input.fy} onChange={(v) => up("fy", v)} step={100} />
            </div>
          </InputCard>
          <InputCard label="Refuerzo tentativo">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="# barras" value={input.nBarsTentative}
                onChange={(v) => up("nBarsTentative", Math.max(6, Math.round(v)))} />
              <NumberField label="tamaño long." value={input.sizeBarTentative}
                onChange={(v) => up("sizeBarTentative", Math.round(v))} />
              <NumberField label="tamaño espiral" value={input.sizeEspiral}
                onChange={(v) => up("sizeEspiral", Math.round(v))} />
            </div>
          </InputCard>
          <InputCard label="Zona sísmica">
            <select value={input.zona}
              onChange={(e) => up("zona", parseInt(e.target.value) as 1 | 2 | 3 | 4)}
              className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200">
              <option value={1}>I</option><option value={2}>II</option>
              <option value={3}>III</option><option value={4}>IV</option>
            </select>
          </InputCard>
        </>
      }
      steps={steps}
      checks={checks}
      reinforcement={
        <>
          <CircularColumnDiagramSet r={result} />
          <ReinforcementTable
            longitudinal={[
              { n: result.n_bars, size: result.size, As_total: result.As_prov,
                position: `Perimetral. ρ = ${(result.rho * 100).toFixed(2)}%` },
            ]}
            transversal={[
              { size: input.sizeEspiral, separacion_cm: result.s_espiral,
                zona: `Espiral continua. lo = ${result.lo.toFixed(0)} cm`, ramas: 1 },
            ]}
          />

          {/* Sub-panel: Esbeltez (auto-active when klu/r > 22) */}
          {showSlenderness && (
            <details className="border border-amber-700/40 rounded-lg p-3 bg-amber-900/10 mt-3">
              <summary className="cursor-pointer text-sm text-amber-200 font-semibold">
                ⚠️ Verificación de esbeltez (klu/r = {slendernessResult.klu_r.toFixed(1)})
              </summary>
              <div className="mt-3 space-y-2 text-xs text-zinc-300">
                <div>r = {slendernessResult.r_cm.toFixed(2)} cm · límite corto = {slendernessResult.limit_short.toFixed(1)}</div>
                <div>δns = {isFinite(slendernessResult.delta_ns) ? slendernessResult.delta_ns.toFixed(2) : "∞"} · Pc = {slendernessResult.Pc_ton.toFixed(1)} ton</div>
                <div>Mc = {isFinite(slendernessResult.Mc_tonm) ? slendernessResult.Mc_tonm.toFixed(2) : "∞"} ton-m (M2 magnificado)</div>
                <div>
                  Cumple ACI §6.6.4:{" "}
                  <span className={slendernessResult.is_short || (isFinite(slendernessResult.Mc_tonm) && slendernessResult.one_minus_term > 0) ? "text-emerald-400" : "text-red-400"}>
                    {slendernessResult.is_short
                      ? "Sí ✓ (columna corta)"
                      : isFinite(slendernessResult.Mc_tonm) && slendernessResult.one_minus_term > 0
                        ? "Sí ✓ (esbelta, magnificada)"
                        : "No ✗ (pandeo)"}
                  </span>
                </div>
                <a href="/studio/esbeltez-columna" className="text-amber-400 hover:underline text-[10px] inline-block">
                  Abrir calculadora completa →
                </a>
              </div>
            </details>
          )}

          {/* Sub-panel: Flexión biaxial (auto-active when Mux > 0 AND Muy > 0) */}
          {showBiaxial && biaxialResult && (
            <details className="border border-amber-700/40 rounded-lg p-3 bg-amber-900/10 mt-3">
              <summary className="cursor-pointer text-sm text-amber-200 font-semibold">
                ⚠️ Verificación de flexión biaxial (Bresler ratio = {biaxialResult.contour_value.toFixed(3)})
              </summary>
              <div className="mt-3 space-y-2 text-xs text-zinc-300">
                <div>Mux = {biaxialResult.Mux.toFixed(2)} ton-m · Muy = {biaxialResult.Muy.toFixed(2)} ton-m</div>
                <div>φMnx0 = {biaxialResult.phiMnx0_tonm.toFixed(2)} · φMny0 = {biaxialResult.phiMny0_tonm.toFixed(2)} ton-m</div>
                <div>α = {biaxialResult.alpha.toFixed(3)} · ρg = {(biaxialResult.rho_g * 100).toFixed(2)}%</div>
                <div>(Mux/φMnx0)^α + (Muy/φMny0)^α = {biaxialResult.contour_value.toFixed(3)}</div>
                <div>
                  Cumple Bresler:{" "}
                  <span className={biaxialResult.bresler_contour_ok && biaxialResult.bresler_recip_ok ? "text-emerald-400" : "text-red-400"}>
                    {biaxialResult.bresler_contour_ok && biaxialResult.bresler_recip_ok ? "Sí ✓" : "No ✗"}
                  </span>
                </div>
                <a href="/studio/flexion-biaxial" className="text-amber-400 hover:underline text-[10px] inline-block">
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
