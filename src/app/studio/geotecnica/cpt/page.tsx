"use client";

/**
 * /studio/geotecnica/cpt — Interpretación CPT (Robertson 1990/2009).
 */
import { useState, useMemo } from "react";
import Link from "next/link";
import { computeCPTLive, type CPTInput, type CPTReading } from "@/lib/cpt-live";
import { ExportToolbar } from "@/components/studio/ExportToolbar";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import {
  ModoAprendizajeProvider,
  ModoAprendizajeToggle,
} from "@/components/studio/ModoAprendizaje";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import { CPTProfileSvg } from "@/components/studio/GeotechDiagrams";
import type { CalculationStep } from "@/lib/beam-flexure-live";

const DEFAULT_READINGS: CPTReading[] = [
  { depth_m: 1.0, qc_MPa: 2.5, fs_kPa: 40, u2_kPa: 0 },
  { depth_m: 2.5, qc_MPa: 5.0, fs_kPa: 50, u2_kPa: 10 },
  { depth_m: 4.0, qc_MPa: 8.0, fs_kPa: 60, u2_kPa: 25 },
  { depth_m: 6.0, qc_MPa: 1.2, fs_kPa: 35, u2_kPa: 60 },
  { depth_m: 8.0, qc_MPa: 12.0, fs_kPa: 80, u2_kPa: 80 },
];

const DEFAULT_INPUT: CPTInput = {
  readings: DEFAULT_READINGS,
  water_table_m: 3.0,
  gamma_kN_m3: 18,
  Nk: 15,
};

export default function CPTPage() {
  const [input, setInput] = useState<CPTInput>(DEFAULT_INPUT);
  const { projectName } = useProjectContext();
  const result = useMemo(() => computeCPTLive(input), [input]);

  function updateReading(i: number, field: keyof CPTReading, value: number) {
    const next = [...input.readings];
    next[i] = { ...next[i], [field]: value };
    setInput({ ...input, readings: next });
  }
  function addReading() {
    const last = input.readings[input.readings.length - 1];
    setInput({
      ...input,
      readings: [...input.readings, { depth_m: last.depth_m + 1, qc_MPa: 5, fs_kPa: 50, u2_kPa: 20 }],
    });
  }
  function removeReading(i: number) {
    if (input.readings.length <= 1) return;
    const next = [...input.readings];
    next.splice(i, 1);
    setInput({ ...input, readings: next });
  }

  const snapshotBuilder = () => {
    const steps: CalculationStep[] = result.layers.map((l, i) => ({
      id: `cpt.layer.${i}`,
      name: `Capa @ ${l.depth_m.toFixed(1)} m — ${l.SBT_name}`,
      equation_latex: `Q_{tn} = ${l.Qtn.toFixed(1)}; \\quad F_r = ${l.Fr_pct.toFixed(2)}\\%; \\quad I_c = ${l.Ic.toFixed(2)}`,
      inputs: {
        depth_m: l.depth_m, qc_MPa: l.qc_MPa, fs_kPa: l.fs_kPa,
        sigma_v_kPa: l.sigma_v_kPa, sigma_v_eff_kPa: l.sigma_v_eff_kPa,
        Rf_pct: l.Rf_pct, Qtn: l.Qtn, Fr_pct: l.Fr_pct, Ic: l.Ic, SBT_zone: l.SBT_zone,
      },
      output_var: `Ic_${i}`,
      output_value: l.Ic,
      output_unit: "",
      code_ref: l.notes.join(" · "),
      depends_on: [],
      note: `φ=${l.phi_deg?.toFixed(1) ?? "—"}° · Dr=${l.Dr_pct?.toFixed(0) ?? "—"}% · su=${l.su_kPa?.toFixed(0) ?? "—"} kPa`,
    }));
    return buildSnapshot({
      title: `Interpretación CPT (Robertson) — ${input.readings.length} profundidades`,
      elementType: "geotech_cpt",
      fc: 0,
      fy: 0,
      inputs: [
        { name: "γ promedio", value: input.gamma_kN_m3, unit: "kN/m³" },
        { name: "Nivel freático", value: input.water_table_m, unit: "m" },
        { name: "Nk (cone factor)", value: input.Nk },
        { name: "# registros", value: input.readings.length },
        { name: "SBT predominante", value: result.predominant_SBT },
        { name: "φ promedio", value: result.phi_avg_deg ?? 0, unit: "°" },
        { name: "su promedio", value: result.su_avg_kPa ?? 0, unit: "kPa" },
      ],
      steps,
      checks: [],
      notes: [...result.warnings, ...result.citations],
      diagrams: renderDiagrams([
        { title: "Perfil CPT — SBT + qc + Ic", element: <CPTProfileSvg r={result} input={input} /> },
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
            <h1 className="text-2xl font-semibold">🌱 Interpretación CPT (Robertson)</h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Convierte registros del Cono Penetrómetro (qc, fs, u2) en clasificación
              SBT (Soil Behaviour Type) y parámetros para diseño: φ, Dr, su.
            </p>
          </div>
          <div className="w-64 shrink-0 space-y-2">
            <div className="flex justify-end"><ModoAprendizajeToggle /></div>
            <ExportToolbar buildSnapshot={snapshotBuilder} />
            <SaveToProjectButton
              elementType="cpt"
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
            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Parámetros del sitio</div>
              <label className="flex flex-col gap-1 mb-2">
                <span className="text-[10px] text-zinc-500">γ promedio (kN/m³)</span>
                <input type="number" step={0.5} value={input.gamma_kN_m3}
                  onChange={(e) => setInput({ ...input, gamma_kN_m3: parseFloat(e.target.value) || 18 })}
                  className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
              </label>
              <label className="flex flex-col gap-1 mb-2">
                <span className="text-[10px] text-zinc-500">Nivel freático (m)</span>
                <input type="number" step={0.5} value={input.water_table_m}
                  onChange={(e) => setInput({ ...input, water_table_m: parseFloat(e.target.value) || 99 })}
                  className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">Nk (cone factor, arcillas)</span>
                <input type="number" step={1} value={input.Nk}
                  onChange={(e) => setInput({ ...input, Nk: parseFloat(e.target.value) || 15 })}
                  className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
              </label>
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
              <div className="text-[10px] uppercase tracking-wider text-emerald-400">Resultados promedio</div>
              <div className="text-xs text-zinc-300 space-y-1 font-mono">
                <div><span className="text-zinc-500">SBT predominante: </span><span className="text-emerald-300">{result.predominant_SBT}</span></div>
                {result.phi_avg_deg !== null && (
                  <div><span className="text-zinc-500">φ promedio: </span><span className="text-emerald-300 font-semibold">{result.phi_avg_deg.toFixed(1)}°</span></div>
                )}
                {result.su_avg_kPa !== null && (
                  <div><span className="text-zinc-500">su promedio: </span><span className="text-emerald-300 font-semibold">{result.su_avg_kPa.toFixed(0)} kPa</span></div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Perfil CPT</div>
              <CPTProfileSvg r={result} input={input} />
            </div>
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30">
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Registros CPT</div>
                <button onClick={addReading} className="text-xs text-emerald-400 hover:text-emerald-300">+ Agregar</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-2 px-2 font-normal">z (m)</th>
                      <th className="text-right py-2 px-2 font-normal">qc (MPa)</th>
                      <th className="text-right py-2 px-2 font-normal">fs (kPa)</th>
                      <th className="text-right py-2 px-2 font-normal">u2 (kPa)</th>
                      <th className="text-right py-2 px-2 font-normal">Rf %</th>
                      <th className="text-right py-2 px-2 font-normal">Ic</th>
                      <th className="text-left py-2 px-2 font-normal">SBT</th>
                      <th className="text-right py-2 px-2 font-normal">φ°</th>
                      <th className="text-right py-2 px-2 font-normal">Dr%</th>
                      <th className="text-right py-2 px-2 font-normal">su (kPa)</th>
                      <th className="py-2 px-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {input.readings.map((r, i) => {
                      const lyr = result.layers[i];
                      return (
                        <tr key={i} className="border-b border-zinc-800/60">
                          <td className="py-1.5 px-2">
                            <input type="number" step={0.5} value={r.depth_m}
                              onChange={(e) => updateReading(i, "depth_m", parseFloat(e.target.value) || 0)}
                              className="w-14 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono" />
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <input type="number" step={0.5} value={r.qc_MPa}
                              onChange={(e) => updateReading(i, "qc_MPa", parseFloat(e.target.value) || 0)}
                              className="w-16 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <input type="number" step={5} value={r.fs_kPa}
                              onChange={(e) => updateReading(i, "fs_kPa", parseFloat(e.target.value) || 0)}
                              className="w-16 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <input type="number" step={5} value={r.u2_kPa}
                              onChange={(e) => updateReading(i, "u2_kPa", parseFloat(e.target.value) || 0)}
                              className="w-16 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          </td>
                          <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">{lyr?.Rf_pct.toFixed(2) ?? "—"}</td>
                          <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">{lyr?.Ic.toFixed(2) ?? "—"}</td>
                          <td className="py-1.5 px-2 text-emerald-300 text-[11px]">{lyr?.SBT_name ?? "—"}</td>
                          <td className="py-1.5 px-2 text-right text-emerald-300 font-mono">{lyr?.phi_deg?.toFixed(1) ?? "—"}</td>
                          <td className="py-1.5 px-2 text-right text-emerald-300 font-mono">{lyr?.Dr_pct?.toFixed(0) ?? "—"}</td>
                          <td className="py-1.5 px-2 text-right text-emerald-300 font-mono">{lyr?.su_kPa?.toFixed(0) ?? "—"}</td>
                          <td className="py-1.5 px-1">
                            <button onClick={() => removeReading(i)} className="text-zinc-600 hover:text-red-400">✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Parámetros normalizados (Robertson 2009)</div>
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left py-1 px-2 font-normal">z (m)</th>
                    <th className="text-right py-1 px-2 font-normal">σv (kPa)</th>
                    <th className="text-right py-1 px-2 font-normal">σ&apos;v (kPa)</th>
                    <th className="text-right py-1 px-2 font-normal">Qtn</th>
                    <th className="text-right py-1 px-2 font-normal">Fr %</th>
                    <th className="text-right py-1 px-2 font-normal">Ic</th>
                    <th className="text-left py-1 px-2 font-normal">Fuente</th>
                  </tr>
                </thead>
                <tbody>
                  {result.layers.map((l, i) => (
                    <tr key={i} className="border-b border-zinc-800/60">
                      <td className="py-1 px-2 text-zinc-300">{l.depth_m.toFixed(1)}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.sigma_v_kPa.toFixed(1)}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.sigma_v_eff_kPa.toFixed(1)}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.Qtn.toFixed(1)}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.Fr_pct.toFixed(2)}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.Ic.toFixed(2)}</td>
                      <td className="py-1 px-2 text-zinc-500 text-[10px]">{l.notes.join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] text-zinc-500 mt-3 leading-relaxed">
                <strong className="text-zinc-400">Qtn = ((qt - σv)/Pa) · (Pa/σ&apos;v)^n</strong> con n=0.5. <strong>Ic = √((3.47-log Qtn)² + (log Fr + 1.22)²)</strong> — Robertson (2009).
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
