"use client";

/**
 * /studio/geotecnica/licuefaccion — Potencial de licuefacción Seed-Idriss.
 */
import { useState, useMemo } from "react";
import Link from "next/link";
import { computeLiquefactionLive, type LiqInput, type LiqLayer } from "@/lib/licuefaccion-live";
import { ExportToolbar } from "@/components/studio/ExportToolbar";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import {
  ModoAprendizajeProvider,
  ModoAprendizajeToggle,
} from "@/components/studio/ModoAprendizaje";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import { LiquefactionProfileSvg } from "@/components/studio/GeotechDiagrams";
import type { CalculationStep } from "@/lib/beam-flexure-live";

const DEFAULT_LAYERS: LiqLayer[] = [
  { depth_m: 2, N60: 8, soil_type: "arena", fines_pct: 8, gamma_kN_m3: 17 },
  { depth_m: 4, N60: 10, soil_type: "arena_limosa", fines_pct: 20, gamma_kN_m3: 18 },
  { depth_m: 6, N60: 15, soil_type: "arena", fines_pct: 5, gamma_kN_m3: 18 },
  { depth_m: 8, N60: 22, soil_type: "arena", fines_pct: 5, gamma_kN_m3: 19 },
  { depth_m: 10, N60: 35, soil_type: "arena", fines_pct: 3, gamma_kN_m3: 19 },
];

const DEFAULT_INPUT: LiqInput = {
  layers: DEFAULT_LAYERS,
  water_table_m: 1.5,
  a_max_g: 0.30,
  Mw: 7.0,
};

export default function LiquefaccionPage() {
  const [input, setInput] = useState<LiqInput>(DEFAULT_INPUT);
  const { projectName } = useProjectContext();
  const result = useMemo(() => computeLiquefactionLive(input), [input]);

  function updateLayer<K extends keyof LiqLayer>(i: number, field: K, value: LiqLayer[K]) {
    const next = [...input.layers];
    next[i] = { ...next[i], [field]: value };
    setInput({ ...input, layers: next });
  }
  function addLayer() {
    const last = input.layers[input.layers.length - 1];
    setInput({
      ...input,
      layers: [...input.layers, { depth_m: last.depth_m + 2, N60: 20, soil_type: "arena", fines_pct: 5, gamma_kN_m3: 18 }],
    });
  }
  function removeLayer(i: number) {
    if (input.layers.length <= 1) return;
    const next = [...input.layers];
    next.splice(i, 1);
    setInput({ ...input, layers: next });
  }

  const snapshotBuilder = () => {
    const steps: CalculationStep[] = result.layers.map((l, i) => ({
      id: `liq.layer.${i}`,
      name: `Capa @ ${l.depth_m.toFixed(1)} m`,
      equation_latex: `CSR = 0.65 \\cdot (a_{max}/g) \\cdot (\\sigma_v/\\sigma'_v) \\cdot r_d = ${l.CSR.toFixed(3)}; \\quad FS = CRR \\cdot MSF / CSR = ${l.FS_liq > 99 ? "n/a" : l.FS_liq.toFixed(2)}`,
      inputs: {
        depth_m: l.depth_m,
        sigma_v_kPa: l.sigma_v_kPa,
        sigma_v_eff_kPa: l.sigma_v_eff_kPa,
        rd: l.rd, C_N: l.C_N,
        N1_60: l.N1_60, delta_N: l.delta_N,
        CRR_75: l.CRR_75, MSF: l.MSF,
      },
      output_var: `FS_${i}`,
      output_value: l.FS_liq > 99 ? 99 : l.FS_liq,
      output_unit: "",
      code_ref: "Seed-Idriss · Youd 2001 · Idriss-Boulanger 2008",
      depends_on: [],
      note: `${l.licuable ? "LICUA" : (l.reason ?? "OK")} · (N1)60cs=${l.N1_60cs.toFixed(1)} · CRR_M=${l.CRR_M.toFixed(3)}`,
    }));
    return buildSnapshot({
      title: `Licuefacción — a_max ${input.a_max_g}g, Mw ${input.Mw}`,
      elementType: "geotech_liquefaction",
      fc: 0,
      fy: 0,
      inputs: [
        { name: "a_max", value: input.a_max_g, unit: "g" },
        { name: "Mw", value: input.Mw },
        { name: "Nivel freático", value: input.water_table_m, unit: "m" },
        { name: "# capas", value: input.layers.length },
        { name: "Hay licuación", value: result.hay_licuacion ? "sí" : "no" },
        { name: "FS mínimo", value: result.FS_min ?? 0 },
        { name: "Capa crítica", value: result.critical_depth_m ?? 0, unit: "m" },
      ],
      steps,
      checks: [],
      notes: [...result.warnings, ...result.citations],
      diagrams: renderDiagrams([
        { title: "Licuefacción — FS por profundidad", element: <LiquefactionProfileSvg r={result} input={input} /> },
      ]),
    });
  };

  return (
    <ModoAprendizajeProvider>
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-emerald-400 mb-1">
              <Link href="/studio/geotecnica" className="hover:text-emerald-300">← Geotecnia</Link>
            </div>
            <h1 className="text-2xl font-semibold">🌱 Potencial de licuefacción</h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Procedimiento simplificado Seed-Idriss (1971), actualizado por
              Youd & Idriss (2001) e Idriss & Boulanger (2008). Resultado: FS por
              capa = CRR·MSF / CSR.
            </p>
          </div>
          <div className="w-64 shrink-0 space-y-2">
            <div className="flex justify-end"><ModoAprendizajeToggle /></div>
            <ExportToolbar buildSnapshot={snapshotBuilder} />
            <SaveToProjectButton
              elementType="licuefaccion"
              buildPayload={() => ({
                archJson: { project_name: projectName ?? "Diseño" },
                structJson: { ...input },
                resultJson: {
                  ...result,
                  summary: {
                    total_elements: 1,
                    passing: 1,
                    requires_review: 0,
                    with_errors: 0,
                  },
                },
              })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Demanda sísmica</div>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">a_max (g)</span>
                <input type="number" step={0.05} value={input.a_max_g}
                  onChange={(e) => setInput({ ...input, a_max_g: parseFloat(e.target.value) || 0 })}
                  className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">Mw (magnitud)</span>
                <input type="number" step={0.1} value={input.Mw}
                  onChange={(e) => setInput({ ...input, Mw: parseFloat(e.target.value) || 7 })}
                  className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">Nivel freático (m)</span>
                <input type="number" step={0.5} value={input.water_table_m}
                  onChange={(e) => setInput({ ...input, water_table_m: parseFloat(e.target.value) || 99 })}
                  className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
              </label>
              <div className="text-[10px] text-zinc-500 leading-relaxed pt-2 border-t border-zinc-800/60">
                Zonas CR de alto riesgo: <span className="text-amber-400">Nicoya, Quepos, Limón</span> — a_max ≈ 0.30-0.40g, Mw esperado 7.0-7.5.
              </div>
            </div>

            {result.warnings.length > 0 && (
              <div className="border border-amber-900/40 bg-amber-950/20 rounded-lg p-3 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Advertencias</div>
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-200/80">{w}</p>
                ))}
              </div>
            )}

            <div className={`border rounded-lg p-3 space-y-2 ${result.hay_licuacion ? "border-red-900/40 bg-red-950/20" : "border-emerald-900/40 bg-emerald-950/20"}`}>
              <div className={`text-[10px] uppercase tracking-wider ${result.hay_licuacion ? "text-red-400" : "text-emerald-400"}`}>
                {result.hay_licuacion ? "RIESGO DE LICUACIÓN" : "Sin riesgo de licuación"}
              </div>
              <div className="text-xs text-zinc-300 space-y-1 font-mono">
                {result.FS_min !== null && (
                  <div><span className="text-zinc-500">FS mínimo: </span>
                    <span className={result.hay_licuacion ? "text-red-300 font-semibold" : "text-emerald-300 font-semibold"}>
                      {result.FS_min.toFixed(2)}
                    </span>
                  </div>
                )}
                {result.critical_depth_m !== null && (
                  <div><span className="text-zinc-500">Capa crítica: </span><span className="text-amber-300">{result.critical_depth_m.toFixed(1)} m</span></div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">FS vs profundidad</div>
              <LiquefactionProfileSvg r={result} input={input} />
            </div>
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30">
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Capas (SPT)</div>
                <button onClick={addLayer} className="text-xs text-emerald-400 hover:text-emerald-300">+ Capa</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-2 px-2 font-normal">z (m)</th>
                      <th className="text-right py-2 px-2 font-normal">N60</th>
                      <th className="text-left py-2 px-2 font-normal">Suelo</th>
                      <th className="text-right py-2 px-2 font-normal">FC %</th>
                      <th className="text-right py-2 px-2 font-normal">γ</th>
                      <th className="text-right py-2 px-2 font-normal">CSR</th>
                      <th className="text-right py-2 px-2 font-normal">(N1)60cs</th>
                      <th className="text-right py-2 px-2 font-normal">CRR·MSF</th>
                      <th className="text-right py-2 px-2 font-normal">FS</th>
                      <th className="text-left py-2 px-2 font-normal">Estado</th>
                      <th className="py-2 px-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {input.layers.map((l, i) => {
                      const r = result.layers[i];
                      const lic = r?.licuable;
                      return (
                        <tr key={i} className={`border-b border-zinc-800/60 ${lic ? "bg-red-950/20" : ""}`}>
                          <td className="py-1.5 px-2">
                            <input type="number" step={0.5} value={l.depth_m}
                              onChange={(e) => updateLayer(i, "depth_m", parseFloat(e.target.value) || 0)}
                              className="w-14 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono" />
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <input type="number" step={1} value={l.N60}
                              onChange={(e) => updateLayer(i, "N60", parseFloat(e.target.value) || 0)}
                              className="w-12 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          </td>
                          <td className="py-1.5 px-2">
                            <select value={l.soil_type}
                              onChange={(e) => updateLayer(i, "soil_type", e.target.value as LiqLayer["soil_type"])}
                              className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-zinc-200 text-[10px]">
                              <option value="arena">arena</option>
                              <option value="arena_limosa">arena_limosa</option>
                              <option value="limo">limo</option>
                              <option value="arcilla">arcilla</option>
                            </select>
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <input type="number" step={1} value={l.fines_pct}
                              onChange={(e) => updateLayer(i, "fines_pct", parseFloat(e.target.value) || 0)}
                              className="w-12 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <input type="number" step={0.5} value={l.gamma_kN_m3}
                              onChange={(e) => updateLayer(i, "gamma_kN_m3", parseFloat(e.target.value) || 18)}
                              className="w-12 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          </td>
                          <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">{r?.CSR.toFixed(3) ?? "—"}</td>
                          <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">{r?.N1_60cs.toFixed(1) ?? "—"}</td>
                          <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">{r?.CRR_M.toFixed(3) ?? "—"}</td>
                          <td className={`py-1.5 px-2 text-right font-mono font-semibold ${lic ? "text-red-300" : "text-emerald-300"}`}>
                            {r?.FS_liq === undefined ? "—" : (r.FS_liq > 99 ? "n/a" : r.FS_liq.toFixed(2))}
                          </td>
                          <td className="py-1.5 px-2 text-[10px]">
                            {r?.licuable ? (
                              <span className="text-red-300">⚠ LICUA</span>
                            ) : r?.reason ? (
                              <span className="text-zinc-500">{r.reason}</span>
                            ) : (
                              <span className="text-emerald-400">OK</span>
                            )}
                          </td>
                          <td className="py-1.5 px-1">
                            <button onClick={() => removeLayer(i)} className="text-zinc-600 hover:text-red-400">✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Cálculo detallado por capa</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-1 px-2 font-normal">z (m)</th>
                      <th className="text-right py-1 px-2 font-normal">σv</th>
                      <th className="text-right py-1 px-2 font-normal">σ&apos;v</th>
                      <th className="text-right py-1 px-2 font-normal">rd</th>
                      <th className="text-right py-1 px-2 font-normal">C_N</th>
                      <th className="text-right py-1 px-2 font-normal">(N1)60</th>
                      <th className="text-right py-1 px-2 font-normal">Δ(N)</th>
                      <th className="text-right py-1 px-2 font-normal">CRR7.5</th>
                      <th className="text-right py-1 px-2 font-normal">MSF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.layers.map((l, i) => (
                      <tr key={i} className="border-b border-zinc-800/60">
                        <td className="py-1 px-2 text-zinc-300">{l.depth_m.toFixed(1)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{l.sigma_v_kPa.toFixed(1)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{l.sigma_v_eff_kPa.toFixed(1)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{l.rd.toFixed(3)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{l.C_N.toFixed(3)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{l.N1_60.toFixed(1)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{l.delta_N.toFixed(1)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{l.CRR_75.toFixed(3)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{l.MSF.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-zinc-500 mt-3 leading-relaxed">
                <strong className="text-zinc-400">CSR = 0.65·(a_max/g)·(σv/σ&apos;v)·rd</strong>{" "}
                — Seed & Idriss (1971). <strong className="text-zinc-400">rd</strong> Liao & Whitman (1986).{" "}
                <strong className="text-zinc-400">CRR_7.5</strong> Youd (2001).{" "}
                <strong className="text-zinc-400">MSF = 10^2.24 / Mw^2.56</strong>.{" "}
                <strong className="text-zinc-400">Δ(N1)60</strong> por finos: Idriss & Boulanger (2008).{" "}
                FS_liq = CRR·MSF / CSR.
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-4">
              <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-2">Fuentes</div>
              <ul className="space-y-1 text-[11px] text-zinc-400">
                {result.citations.map((c, i) => (
                  <li key={i} className="pl-3 border-l border-zinc-800">{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
    </ModoAprendizajeProvider>
  );
}
