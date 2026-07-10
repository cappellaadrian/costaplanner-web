"use client";

/**
 * /studio/rectangular-column — columna rectangular con confinamiento sísmico.
 * ACI 318-14 §10/§18.7 + CSCR-10 §18.7.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import {
  RectColumnDiagramSet, RC1_Seccion, RC2_Elevacion, RC3_Empalmes, RC4_Hook135, RC5_PM_Diagram,
} from "@/components/studio/ColumnDiagrams";
import { ReinforcementTable } from "@/components/studio/ReinforcementTable";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeRectangularColumnLive,
  buildRectangularColumnSteps,
  buildRectangularColumnChecks,
  type RectColumnInput,
} from "@/lib/rectangular-column-live";
import { computeEsbeltezLive } from "@/lib/esbeltez-columna-live";
import { computeFlexionBiaxialLive } from "@/lib/flexion-biaxial-live";

const DEFAULT: RectColumnInput = {
  b: 35, h: 35, L: 280, recubrimiento: 4,
  Pu_ton: 120, Mu_max_tonm: 2.5,
  fc: 245, fy: 4200, zona: 3,
  nBarsTentative: 8, sizeBarTentative: 7,
};

export default function RectangularColumnPage() {
  const [input, setInput] = useState<RectColumnInput>(DEFAULT);
  // Auxiliary input for biaxial verification (Muy on the perpendicular axis).
  // Kept out of RectColumnInput so it doesn't bleed into the existing PDF
  // snapshot. When 0, the biaxial sub-panel stays hidden.
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
  const result = useMemo(() => computeRectangularColumnLive(input), [input]);
  const steps = useMemo(() => buildRectangularColumnSteps(result), [result]);
  const checks = useMemo(() => buildRectangularColumnChecks(result), [result]);

  // ─── Correlation Refactor: live sub-verifications ───────────────────────
  // Esbeltez de columna — auto-active when klu/r > 22 (ACI §6.2.5 short-column
  // limit for unbraced frames). Engine takes the same b/h/L/Pu/Mu/fc/fy that
  // the parent page already collects. L is in cm here, engine wants m → /100.
  // We run the engine pre-emptively (cheap, ~µs) so we can read klu_r to
  // decide whether to mount the panel.
  const slendernessResult = useMemo(
    () =>
      computeEsbeltezLive({
        shape: "rect",
        b_cm: input.b,
        h_cm: input.h,
        D_cm: 0,
        lu_m: input.L / 100,
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

  // Flexión biaxial — auto-active when both Mux (= Mu_max) and Muy are > 0.
  // Uses the column's existing tentative bar selection so the engine has a
  // real ρg to work with.
  const biaxialResult = useMemo(() => {
    if (!(input.Mu_max_tonm > 0 && Muy_tonm > 0)) return null;
    return computeFlexionBiaxialLive({
      shape: "rect",
      b_cm: input.b,
      h_cm: input.h,
      D_cm: 0,
      r_cm: input.recubrimiento,
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

  function up<K extends keyof RectColumnInput>(k: K, v: RectColumnInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Columna rectangular — Compresión axial"
      subtitle="ACI 318-14 §10 / §22.4.2 + CSCR-10 §18.7. Diseño simplificado válido cuando e/h ≤ 0.10."
      stepPrefix="rect_col."
      referencesBundle="column"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Columna rectangular ${input.b}×${input.h} cm`,
          elementType: "rectangular_column",
          zonaSismica: input.zona,
          fc: input.fc, fy: input.fy,
          aceroNorma: input.zona >= 3 ? "A706" : "A615",
          inputs: [
            { name: "b", value: input.b, unit: "cm" },
            { name: "h", value: input.h, unit: "cm" },
            { name: "L libre", value: input.L, unit: "cm" },
            { name: "recubrimiento", value: input.recubrimiento, unit: "cm" },
            { name: "Pu", value: input.Pu_ton, unit: "ton" },
            { name: "Mu_max", value: input.Mu_max_tonm, unit: "ton-m" },
            { name: "f'c", value: input.fc, unit: "kg/cm²" },
            { name: "fy", value: input.fy, unit: "kg/cm²" },
            { name: "Zona sísmica", value: input.zona },
          ],
          steps, checks,
          reinforcement: {
            longitudinal: [{
              n: result.n_bars, size: result.size, As_total: result.As_prov,
              position: `Perimetral. ρ = ${(result.rho * 100).toFixed(2)}%`,
            }],
            transversal: [
              { size: 4, separacion_cm: result.s_conf,
                zona: `Confinada (lo = ${result.lo_confinamiento.toFixed(0)} cm)`, ramas: 2 },
              { size: 4, separacion_cm: result.s_central, zona: "Central", ramas: 2 },
            ],
          },
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "RC-1 — Sección transversal", element: <RC1_Seccion r={result} /> },
            { title: "RC-2 — Elevación con aros", element: <RC2_Elevacion r={result} /> },
            { title: "RC-3 — Empalmes", element: <RC3_Empalmes r={result} /> },
            { title: "RC-4 — Gancho sísmico 135°", element: <RC4_Hook135 r={result} /> },
            { title: "RC-5 — Diagrama P-M", element: <RC5_PM_Diagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="rectangular-column"
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
              <NumberField label="b" unit="cm" value={input.b} onChange={(v) => up("b", v)} />
              <NumberField label="h" unit="cm" value={input.h} onChange={(v) => up("h", v)} />
              <NumberField label="L libre" unit="cm" value={input.L} onChange={(v) => up("L", v)} />
              <NumberField label="recubrim." unit="cm" value={input.recubrimiento}
                onChange={(v) => up("recubrimiento", v)} step={0.5} />
            </div>
          </InputCard>
          <InputCard label="Cargas">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Pu" unit="ton" value={input.Pu_ton}
                onChange={(v) => up("Pu_ton", v)} step={1} />
              <NumberField label="Mu max (= Mux)" unit="ton-m" value={input.Mu_max_tonm}
                onChange={(v) => up("Mu_max_tonm", v)} step={0.1} />
              <NumberField label="Muy (opcional)" unit="ton-m" value={Muy_tonm}
                onChange={(v) => setMuy(v)} step={0.1} />
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
                onChange={(v) => up("nBarsTentative", Math.max(4, Math.round(v)))} />
              <NumberField label="tamaño" value={input.sizeBarTentative}
                onChange={(v) => up("sizeBarTentative", Math.round(v))} />
            </div>
          </InputCard>
          <InputCard label="Zona sísmica">
            <select value={input.zona}
              onChange={(e) => up("zona", parseInt(e.target.value) as 1 | 2 | 3 | 4)}
              className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200">
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
          <RectColumnDiagramSet r={result} />
          <ReinforcementTable
            longitudinal={[
              { n: result.n_bars, size: result.size, As_total: result.As_prov,
                position: `Perimetral. ρ = ${(result.rho * 100).toFixed(2)}%` },
            ]}
            transversal={[
              { size: 4, separacion_cm: result.s_conf,
                zona: `Confinada (lo = ${result.lo_confinamiento.toFixed(0)} cm)`, ramas: 2 },
              { size: 4, separacion_cm: result.s_central,
                zona: "Central", ramas: 2 },
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
