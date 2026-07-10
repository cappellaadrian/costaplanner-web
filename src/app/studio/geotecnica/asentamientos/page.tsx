"use client";

/**
 * /studio/geotecnica/asentamientos — Schmertmann + Terzaghi 1D + Mesri.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  computeSettlementLive,
  type SettlementInput,
  type SettlementLayer,
  type LayerType,
} from "@/lib/asentamientos-live";
import { ExportToolbar } from "@/components/studio/ExportToolbar";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import {
  ModoAprendizajeProvider,
  ModoAprendizajeToggle,
} from "@/components/studio/ModoAprendizaje";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import { SettlementProfileSvg } from "@/components/studio/GeotechDiagrams";
import type { CalculationStep } from "@/lib/beam-flexure-live";

const DEFAULT_LAYERS: SettlementLayer[] = [
  { depth_top_m: 0, depth_bot_m: 1.0, type: "sand", gamma_kN_m3: 17, E_MPa: 15 },
  { depth_top_m: 1.0, depth_bot_m: 3.5, type: "sand", gamma_kN_m3: 18, E_MPa: 25 },
  { depth_top_m: 3.5, depth_bot_m: 7.0, type: "clay", gamma_kN_m3: 17, Cc: 0.22, Cr: 0.04, e0: 0.85, OCR: 1.2, C_alpha: 0.006 },
];

const DEFAULT_INPUT: SettlementInput = {
  B_m: 2.0,
  L_m: 2.0,
  Df_m: 1.0,
  q_neta_kPa: 150,
  layers: DEFAULT_LAYERS,
  water_table_m: 4.0,
  t_years: 25,
  tp_years: 1,
};

export default function AsentamientosPage() {
  const [input, setInput] = useState<SettlementInput>(DEFAULT_INPUT);
  const { meta, projectName } = useProjectContext();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!meta || prefilledRef.current) return;
    prefilledRef.current = true;
    setInput((p) => ({
      ...p,
      water_table_m: meta.waterTable_m ?? p.water_table_m,
    }));
  }, [meta]);
  const result = useMemo(() => computeSettlementLive(input), [input]);

  function updateLayer<K extends keyof SettlementLayer>(i: number, field: K, value: SettlementLayer[K]) {
    const next = [...input.layers];
    next[i] = { ...next[i], [field]: value };
    setInput({ ...input, layers: next });
  }
  function addLayer() {
    const last = input.layers[input.layers.length - 1];
    setInput({
      ...input,
      layers: [...input.layers, {
        depth_top_m: last.depth_bot_m,
        depth_bot_m: last.depth_bot_m + 1.5,
        type: "sand",
        gamma_kN_m3: 18,
        E_MPa: 20,
      }],
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
      id: `sett.layer.${i}`,
      name: `Capa ${l.depth_top_m.toFixed(1)}–${l.depth_bot_m.toFixed(1)} m (${l.type})`,
      equation_latex: l.type === "sand"
        ? `S_{imm} = C_1 \\cdot C_2 \\cdot q_{neta} \\cdot \\frac{I_z}{E} \\cdot dz`
        : `S_{cons} = \\frac{C_c \\cdot H}{1+e_0} \\cdot \\log\\left(\\frac{\\sigma_f}{\\sigma_0}\\right)`,
      inputs: {
        z_mid_m: l.z_mid_m,
        sigma_v0_kPa: l.sigma_v0_kPa,
        delta_sigma_kPa: l.delta_sigma_kPa,
        Iz: l.Iz ?? 0,
      },
      output_var: `S_${i}`,
      output_value: (l.S_imm_mm ?? 0) + (l.S_cons_mm ?? 0) + (l.S_sec_mm ?? 0),
      output_unit: "mm",
      code_ref: l.notes.join(" · "),
      depends_on: [],
      note: `S_imm=${l.S_imm_mm?.toFixed(2) ?? "—"} · S_cons=${l.S_cons_mm?.toFixed(2) ?? "—"} · S_sec=${l.S_sec_mm?.toFixed(2) ?? "—"} mm`,
    }));
    return buildSnapshot({
      title: `Asentamientos zapata ${input.B_m}×${input.L_m} m — q ${input.q_neta_kPa} kPa`,
      elementType: "geotech_settlement",
      fc: 0,
      fy: 0,
      inputs: [
        { name: "B", value: input.B_m, unit: "m" },
        { name: "L", value: input.L_m, unit: "m" },
        { name: "Df", value: input.Df_m, unit: "m" },
        { name: "q_neta", value: input.q_neta_kPa, unit: "kPa" },
        { name: "Nivel freático", value: input.water_table_m, unit: "m" },
        { name: "t", value: input.t_years, unit: "años" },
        { name: "tp", value: input.tp_years, unit: "años" },
        { name: "# capas", value: input.layers.length },
        { name: "S inmediato", value: result.S_imm_total_mm, unit: "mm" },
        { name: "S consolidación", value: result.S_cons_total_mm, unit: "mm" },
        { name: "S secundario", value: result.S_sec_total_mm, unit: "mm" },
        { name: "S total", value: result.S_total_mm, unit: "mm" },
        { name: "C1 Schmertmann", value: result.C1 },
        { name: "C2 Schmertmann", value: result.C2 },
      ],
      steps,
      checks: [],
      notes: [...result.warnings, ...result.citations],
      diagrams: renderDiagrams([
        { title: "Perfil de asentamientos", element: <SettlementProfileSvg r={result} input={input} /> },
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
            <h1 className="text-2xl font-semibold">🌱 Asentamientos</h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Asentamiento inmediato en arenas (Schmertmann 1978), consolidación
              primaria en arcillas (Terzaghi 1D) y secundaria (Mesri).
            </p>
          </div>
          <div className="w-64 shrink-0 space-y-2">
            <div className="flex justify-end"><ModoAprendizajeToggle /></div>
            <ExportToolbar buildSnapshot={snapshotBuilder} />
            <SaveToProjectButton
              elementType="asentamientos"
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
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Zapata</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">B (m)</span>
                  <input type="number" step={0.1} value={input.B_m}
                    onChange={(e) => setInput({ ...input, B_m: parseFloat(e.target.value) || 1 })}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">L (m)</span>
                  <input type="number" step={0.1} value={input.L_m}
                    onChange={(e) => setInput({ ...input, L_m: parseFloat(e.target.value) || 1 })}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">Df (m)</span>
                  <input type="number" step={0.1} value={input.Df_m}
                    onChange={(e) => setInput({ ...input, Df_m: parseFloat(e.target.value) || 0 })}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">q_neta (kPa)</span>
                  <input type="number" step={10} value={input.q_neta_kPa}
                    onChange={(e) => setInput({ ...input, q_neta_kPa: parseFloat(e.target.value) || 0 })}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">NF (m)</span>
                  <input type="number" step={0.5} value={input.water_table_m}
                    onChange={(e) => setInput({ ...input, water_table_m: parseFloat(e.target.value) || 99 })}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">t (años)</span>
                  <input type="number" step={1} value={input.t_years}
                    onChange={(e) => setInput({ ...input, t_years: parseFloat(e.target.value) || 1 })}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
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

            <div className="border border-emerald-900/40 bg-emerald-950/20 rounded-lg p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400">Asentamiento total</div>
              <div className="text-xs text-zinc-300 space-y-1 font-mono">
                <div><span className="text-zinc-500">S inmediato (arenas): </span><span className="text-emerald-300">{result.S_imm_total_mm.toFixed(1)} mm</span></div>
                <div><span className="text-zinc-500">S consolidación: </span><span className="text-emerald-300">{result.S_cons_total_mm.toFixed(1)} mm</span></div>
                <div><span className="text-zinc-500">S secundario: </span><span className="text-emerald-300">{result.S_sec_total_mm.toFixed(1)} mm</span></div>
                <div className="pt-1 border-t border-emerald-900/40">
                  <span className="text-zinc-500">S total: </span>
                  <span className="text-emerald-300 font-semibold text-sm">{result.S_total_mm.toFixed(1)} mm</span>
                </div>
                <div className="pt-1 text-[10px] text-zinc-500">
                  C1 = {result.C1.toFixed(3)} · C2 = {result.C2.toFixed(3)} (Schmertmann)
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Perfil de asentamientos</div>
              <SettlementProfileSvg r={result} input={input} />
            </div>
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30">
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Estratos</div>
                <button onClick={addLayer} className="text-xs text-emerald-400 hover:text-emerald-300">+ Capa</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-2 px-2 font-normal">Techo (m)</th>
                      <th className="text-left py-2 px-2 font-normal">Fondo (m)</th>
                      <th className="text-left py-2 px-2 font-normal">Tipo</th>
                      <th className="text-right py-2 px-2 font-normal">γ</th>
                      <th className="text-right py-2 px-2 font-normal">E (MPa)</th>
                      <th className="text-right py-2 px-2 font-normal">Cc</th>
                      <th className="text-right py-2 px-2 font-normal">Cr</th>
                      <th className="text-right py-2 px-2 font-normal">e0</th>
                      <th className="text-right py-2 px-2 font-normal">OCR</th>
                      <th className="text-right py-2 px-2 font-normal">Cα</th>
                      <th className="py-2 px-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {input.layers.map((l, i) => (
                      <tr key={i} className="border-b border-zinc-800/60">
                        <td className="py-1.5 px-2">
                          <input type="number" step={0.1} value={l.depth_top_m}
                            onChange={(e) => updateLayer(i, "depth_top_m", parseFloat(e.target.value) || 0)}
                            className="w-14 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono" />
                        </td>
                        <td className="py-1.5 px-2">
                          <input type="number" step={0.1} value={l.depth_bot_m}
                            onChange={(e) => updateLayer(i, "depth_bot_m", parseFloat(e.target.value) || 0)}
                            className="w-14 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono" />
                        </td>
                        <td className="py-1.5 px-2">
                          <select value={l.type}
                            onChange={(e) => updateLayer(i, "type", e.target.value as LayerType)}
                            className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-zinc-200">
                            <option value="sand">arena</option>
                            <option value="clay">arcilla</option>
                          </select>
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <input type="number" step={0.5} value={l.gamma_kN_m3}
                            onChange={(e) => updateLayer(i, "gamma_kN_m3", parseFloat(e.target.value) || 18)}
                            className="w-12 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {l.type === "sand" ? (
                            <input type="number" step={1} value={l.E_MPa ?? 20}
                              onChange={(e) => updateLayer(i, "E_MPa", parseFloat(e.target.value) || 20)}
                              className="w-14 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          ) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {l.type === "clay" ? (
                            <input type="number" step={0.01} value={l.Cc ?? 0.2}
                              onChange={(e) => updateLayer(i, "Cc", parseFloat(e.target.value) || 0.2)}
                              className="w-14 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          ) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {l.type === "clay" ? (
                            <input type="number" step={0.01} value={l.Cr ?? 0.04}
                              onChange={(e) => updateLayer(i, "Cr", parseFloat(e.target.value) || 0.04)}
                              className="w-14 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          ) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {l.type === "clay" ? (
                            <input type="number" step={0.05} value={l.e0 ?? 0.8}
                              onChange={(e) => updateLayer(i, "e0", parseFloat(e.target.value) || 0.8)}
                              className="w-14 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          ) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {l.type === "clay" ? (
                            <input type="number" step={0.1} value={l.OCR ?? 1}
                              onChange={(e) => updateLayer(i, "OCR", parseFloat(e.target.value) || 1)}
                              className="w-14 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          ) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {l.type === "clay" ? (
                            <input type="number" step={0.001} value={l.C_alpha ?? 0.005}
                              onChange={(e) => updateLayer(i, "C_alpha", parseFloat(e.target.value) || 0.005)}
                              className="w-14 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          ) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="py-1.5 px-1">
                          <button onClick={() => removeLayer(i)} className="text-zinc-600 hover:text-red-400">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Resultado por capa</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-1 px-2 font-normal">z med (m)</th>
                      <th className="text-right py-1 px-2 font-normal">σv0&apos; (kPa)</th>
                      <th className="text-right py-1 px-2 font-normal">Δσ (kPa)</th>
                      <th className="text-right py-1 px-2 font-normal">Iz</th>
                      <th className="text-right py-1 px-2 font-normal">S_imm (mm)</th>
                      <th className="text-right py-1 px-2 font-normal">S_cons (mm)</th>
                      <th className="text-right py-1 px-2 font-normal">S_sec (mm)</th>
                      <th className="text-left py-1 px-2 font-normal">Fuente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.layers.map((l, i) => (
                      <tr key={i} className="border-b border-zinc-800/60">
                        <td className="py-1 px-2 text-zinc-300">{l.z_mid_m.toFixed(2)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{l.sigma_v0_kPa.toFixed(1)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{l.delta_sigma_kPa.toFixed(1)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{l.Iz?.toFixed(3) ?? "—"}</td>
                        <td className="py-1 px-2 text-right text-emerald-300">{l.S_imm_mm?.toFixed(2) ?? "—"}</td>
                        <td className="py-1 px-2 text-right text-emerald-300">{l.S_cons_mm?.toFixed(2) ?? "—"}</td>
                        <td className="py-1 px-2 text-right text-emerald-300">{l.S_sec_mm?.toFixed(2) ?? "—"}</td>
                        <td className="py-1 px-2 text-zinc-500 text-[10px]">{l.notes.join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-zinc-500 mt-3 leading-relaxed">
                <strong className="text-zinc-400">Schmertmann (arenas):</strong> S = C1·C2·q_neta·Σ(Iz/E)·dz.{" "}
                <strong className="text-zinc-400">Terzaghi (arcillas NC):</strong> S = Cc·H/(1+e0)·log(σf/σ0).{" "}
                <strong className="text-zinc-400">Mesri (secundaria):</strong> S = Cα·H/(1+e0)·log(t/tp).
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
