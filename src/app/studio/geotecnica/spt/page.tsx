"use client";

/**
 * /studio/geotecnica/spt — Interpretación SPT.
 *
 * Entradas: lecturas de N de campo a varias profundidades + parámetros del
 * equipo CR (energía del martillo, diámetro, varillas, agua).
 *
 * Salidas: por cada capa, N60, (N1)60, φ, Dr, cu, qa estimada — con la
 * fuente de cada correlación impresa al lado. Promedio ponderado para usar
 * como default en la calculadora de zapata aislada.
 */
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  computeSPTLive,
  type SPTInput,
  type SPTReading,
} from "@/lib/spt-live";
import { ExportToolbar } from "@/components/studio/ExportToolbar";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import {
  ModoAprendizajeProvider,
  ModoAprendizajeToggle,
} from "@/components/studio/ModoAprendizaje";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import { SPTProfileSvg } from "@/components/studio/GeotechDiagrams";
import type { CalculationStep } from "@/lib/beam-flexure-live";

const DEFAULT_READINGS: SPTReading[] = [
  { depth_m: 1.5, N_field: 8, soil: "arena_arcillosa", below_water: false },
  { depth_m: 3.0, N_field: 14, soil: "arena", below_water: false },
  { depth_m: 4.5, N_field: 22, soil: "arena", below_water: true },
  { depth_m: 6.0, N_field: 35, soil: "grava", below_water: true },
];

const DEFAULT_INPUT: SPTInput = {
  readings: DEFAULT_READINGS,
  gamma_kN_m3: 18,
  water_table_m: 3.5,
  energy_ratio: 0.55,
  borehole_diameter_mm: 100,
  liner_removed: true,
  rod_length_m: 6,
};

export default function SPTPage() {
  const [input, setInput] = useState<SPTInput>(DEFAULT_INPUT);
  const { projectName } = useProjectContext();
  const result = useMemo(() => computeSPTLive(input), [input]);

  function updateReading(i: number, field: keyof SPTReading, value: SPTReading[keyof SPTReading]) {
    const next = [...input.readings];
    next[i] = { ...next[i], [field]: value };
    setInput({ ...input, readings: next });
  }

  function addReading() {
    const last = input.readings[input.readings.length - 1];
    setInput({
      ...input,
      readings: [
        ...input.readings,
        { depth_m: last.depth_m + 1.5, N_field: 20, soil: "arena", below_water: last.below_water },
      ],
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
      id: `spt.layer.${i}`,
      name: `Capa @ ${l.depth_m.toFixed(1)} m`,
      equation_latex: `N_{60} = N \\cdot C_E \\cdot C_R \\cdot C_B \\cdot C_S = ${l.N60.toFixed(1)}; \\quad (N_1)_{60} = N_{60} \\cdot C_N = ${l.N1_60.toFixed(1)}`,
      inputs: {
        depth_m: l.depth_m,
        sigma_v_eff_kPa: l.sigma_v_eff_kPa,
        C_N: l.C_N, C_E: l.C_E, C_R: l.C_R, C_B: l.C_B, C_S: l.C_S,
      },
      output_var: `qa_${i}`,
      output_value: l.qa_kPa,
      output_unit: "kPa",
      code_ref: l.notes.join(" · "),
      depends_on: [],
      note: `φ=${l.phi_deg?.toFixed(1) ?? "—"}° · Dr=${l.Dr_pct?.toFixed(0) ?? "—"}% · cu=${l.cu_kPa?.toFixed(0) ?? "—"} kPa`,
    }));
    return buildSnapshot({
      title: `Interpretación SPT — ${input.readings.length} profundidades`,
      elementType: "geotech_spt",
      fc: 0,
      fy: 0,
      inputs: [
        { name: "γ suelo", value: input.gamma_kN_m3, unit: "kN/m³" },
        { name: "Nivel freático", value: input.water_table_m, unit: "m" },
        { name: "Energía relativa ER", value: input.energy_ratio },
        { name: "∅ barreno", value: input.borehole_diameter_mm, unit: "mm" },
        { name: "L varillas", value: input.rod_length_m, unit: "m" },
        { name: "Sin liners", value: input.liner_removed ? "sí" : "no" },
        { name: "# lecturas", value: input.readings.length },
        { name: "qa promedio", value: result.qa_avg_kPa, unit: "kPa" },
        { name: "φ promedio", value: result.phi_avg_deg ?? 0, unit: "°" },
        { name: "Capa más débil", value: result.weakest_layer_depth_m, unit: "m" },
      ],
      steps,
      checks: [],
      notes: [...result.warnings, ...result.citations],
      diagrams: renderDiagrams([
        { title: "Perfil SPT — N₆₀ por capa", element: <SPTProfileSvg r={result} input={input} /> },
      ]),
    });
  };

  return (
    <ModoAprendizajeProvider>
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-widest text-emerald-400 mb-1">
              <Link href="/studio/geotecnica" className="hover:text-emerald-300">
                ← Geotecnia
              </Link>
            </div>
            <h1 className="text-2xl font-semibold">🌱 Interpretación SPT</h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Convierte lecturas de campo del Ensayo de Penetración Estándar
              (ASTM D1586) en parámetros utilizables para diseño de
              cimentaciones: φ, Dr, cu, q_a.
            </p>
          </div>
          <div className="w-full sm:w-64 sm:shrink-0 space-y-2">
            <div className="flex justify-start sm:justify-end"><ModoAprendizajeToggle /></div>
            <ExportToolbar buildSnapshot={snapshotBuilder} />
            <SaveToProjectButton
              elementType="spt"
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
          {/* Inputs */}
          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                Equipo y suelo
              </div>
              <label className="flex flex-col gap-1 mb-2">
                <span className="text-[10px] text-zinc-500">
                  γ suelo arriba (kN/m³){" "}
                  <span className="text-zinc-600">[default 18]</span>
                </span>
                <input
                  type="number"
                  step={0.5}
                  value={input.gamma_kN_m3}
                  onChange={(e) =>
                    setInput({ ...input, gamma_kN_m3: parseFloat(e.target.value) || 18 })
                  }
                  className="bg-emerald-500/10 border border-emerald-700/40 rounded px-2 py-1 text-sm text-emerald-200 font-mono"
                />
              </label>
              <label className="flex flex-col gap-1 mb-2">
                <span className="text-[10px] text-zinc-500">
                  Nivel freático (m, 99 = no hay)
                </span>
                <input
                  type="number"
                  step={0.5}
                  value={input.water_table_m}
                  onChange={(e) =>
                    setInput({ ...input, water_table_m: parseFloat(e.target.value) || 99 })
                  }
                  className="bg-emerald-500/10 border border-emerald-700/40 rounded px-2 py-1 text-sm text-emerald-200 font-mono"
                />
              </label>
              <label className="flex flex-col gap-1 mb-2">
                <span className="text-[10px] text-zinc-500">
                  Energía relativa ER del martillo (Skempton 1986)
                  <br />
                  <span className="text-zinc-600">
                    Donut CR: 0.45-0.60 · Automatic trip: 0.85-0.95
                  </span>
                </span>
                <input
                  type="number"
                  step={0.05}
                  min={0.3}
                  max={1.0}
                  value={input.energy_ratio}
                  onChange={(e) =>
                    setInput({ ...input, energy_ratio: parseFloat(e.target.value) || 0.55 })
                  }
                  className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">∅ barreno (mm)</span>
                  <input
                    type="number"
                    step={5}
                    value={input.borehole_diameter_mm}
                    onChange={(e) =>
                      setInput({
                        ...input,
                        borehole_diameter_mm: parseFloat(e.target.value) || 100,
                      })
                    }
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">L varillas (m)</span>
                  <input
                    type="number"
                    step={0.5}
                    value={input.rod_length_m}
                    onChange={(e) =>
                      setInput({
                        ...input,
                        rod_length_m: parseFloat(e.target.value) || 6,
                      })
                    }
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-400 mt-2">
                <input
                  type="checkbox"
                  checked={input.liner_removed}
                  onChange={(e) =>
                    setInput({ ...input, liner_removed: e.target.checked })
                  }
                />
                Sin liners (CR estándar)
              </label>
            </div>

            {result.warnings.length > 0 && (
              <div className="border border-amber-900/40 bg-amber-950/20 rounded-lg p-3 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                  Advertencias
                </div>
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-200/80">
                    {w}
                  </p>
                ))}
              </div>
            )}

            <div className="border border-emerald-900/40 bg-emerald-950/20 rounded-lg p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400">
                Resultados para diseño
              </div>
              <div className="text-xs text-zinc-300 space-y-1 font-mono">
                <div>
                  <span className="text-zinc-500">q_a promedio: </span>
                  <span className="text-emerald-300 font-semibold">
                    {result.qa_avg_kPa.toFixed(0)} kPa
                  </span>
                  <span className="text-zinc-600">
                    {" "}(≈ {(result.qa_avg_kPa / 98.07).toFixed(2)} kg/cm²)
                  </span>
                </div>
                {result.phi_avg_deg && (
                  <div>
                    <span className="text-zinc-500">φ promedio (arenas): </span>
                    <span className="text-emerald-300 font-semibold">
                      {result.phi_avg_deg.toFixed(1)}°
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-zinc-500">Capa más débil: </span>
                  <span className="text-amber-300">
                    {result.weakest_layer_depth_m.toFixed(1)} m
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-emerald-400/80 italic pt-1 border-t border-emerald-900/40">
                Estos valores pueden usarse directamente como input en{" "}
                <Link href="/studio/isolated-footing" className="underline">
                  zapata aislada
                </Link>{" "}
                y{" "}
                <Link href="/studio/retaining-wall" className="underline">
                  muro de contención
                </Link>
                .
              </div>
            </div>
          </div>

          {/* Readings table + results */}
          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                Perfil SPT
              </div>
              <SPTProfileSvg r={result} input={input} />
            </div>
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30">
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Lecturas del SPT
                </div>
                <button
                  type="button"
                  onClick={addReading}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  + Agregar profundidad
                </button>
              </div>
              {/* Mobile fix: 11-column table is too wide for 375px; allow
                  horizontal scroll on small viewports while keeping the
                  natural layout on desktop. */}
              <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left py-2 px-2 font-normal">Prof. (m)</th>
                    <th className="text-right py-2 px-2 font-normal">N campo</th>
                    <th className="text-left py-2 px-2 font-normal">Suelo</th>
                    <th className="text-center py-2 px-2 font-normal">Bajo NF</th>
                    <th className="text-right py-2 px-2 font-normal">N60</th>
                    <th className="text-right py-2 px-2 font-normal">(N1)60</th>
                    <th className="text-right py-2 px-2 font-normal">φ (°)</th>
                    <th className="text-right py-2 px-2 font-normal">Dr (%)</th>
                    <th className="text-right py-2 px-2 font-normal">cu (kPa)</th>
                    <th className="text-right py-2 px-2 font-normal">q_a (kPa)</th>
                    <th className="py-2 px-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {input.readings.map((r, i) => {
                    const layer = result.layers[i];
                    return (
                      <tr key={i} className="border-b border-zinc-800/60">
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            step={0.5}
                            value={r.depth_m}
                            onChange={(e) =>
                              updateReading(i, "depth_m", parseFloat(e.target.value) || 0)
                            }
                            className="w-16 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            step={1}
                            value={r.N_field}
                            onChange={(e) =>
                              updateReading(i, "N_field", parseInt(e.target.value) || 0)
                            }
                            className="w-14 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <select
                            value={r.soil}
                            onChange={(e) =>
                              updateReading(i, "soil", e.target.value as SPTReading["soil"])
                            }
                            className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-zinc-200"
                          >
                            <option value="arena">arena</option>
                            <option value="arena_arcillosa">arena arcillosa</option>
                            <option value="arcilla">arcilla</option>
                            <option value="limo">limo</option>
                            <option value="grava">grava</option>
                          </select>
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={r.below_water}
                            onChange={(e) =>
                              updateReading(i, "below_water", e.target.checked)
                            }
                          />
                        </td>
                        <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">
                          {layer?.N60.toFixed(1) ?? "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">
                          {layer?.N1_60.toFixed(1) ?? "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right text-emerald-300 font-mono">
                          {layer?.phi_deg?.toFixed(1) ?? "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right text-emerald-300 font-mono">
                          {layer?.Dr_pct?.toFixed(0) ?? "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right text-emerald-300 font-mono">
                          {layer?.cu_kPa?.toFixed(0) ?? "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right text-emerald-300 font-mono font-semibold">
                          {layer?.qa_kPa.toFixed(0) ?? "—"}
                        </td>
                        <td className="py-1.5 px-1">
                          <button
                            type="button"
                            onClick={() => removeReading(i)}
                            className="text-zinc-600 hover:text-red-400"
                            title="Eliminar"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>

            {/* Per-layer correction breakdown */}
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                Correcciones aplicadas por capa
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono min-w-[480px]">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left py-1 px-2 font-normal">Prof. (m)</th>
                    <th className="text-right py-1 px-2 font-normal">σ'_v (kPa)</th>
                    <th className="text-right py-1 px-2 font-normal">C_N</th>
                    <th className="text-right py-1 px-2 font-normal">C_E</th>
                    <th className="text-right py-1 px-2 font-normal">C_R</th>
                    <th className="text-right py-1 px-2 font-normal">C_B</th>
                    <th className="text-right py-1 px-2 font-normal">C_S</th>
                  </tr>
                </thead>
                <tbody>
                  {result.layers.map((l, i) => (
                    <tr key={i} className="border-b border-zinc-800/60">
                      <td className="py-1 px-2 text-zinc-300">{l.depth_m.toFixed(1)}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.sigma_v_eff_kPa.toFixed(1)}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.C_N.toFixed(3)}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.C_E.toFixed(3)}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.C_R.toFixed(2)}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.C_B.toFixed(2)}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.C_S.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="text-[10px] text-zinc-500 mt-3 leading-relaxed">
                <strong className="text-zinc-400">N60 = N_campo · C_E · C_R · C_B · C_S</strong>{" "}
                — corrección a 60% de energía. <strong>(N1)60 = N60 · C_N</strong> —
                normalizado a 1 atm de sobrecarga efectiva.
              </div>
            </div>

            {/* References */}
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-4">
              <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-2">
                Fuentes de las correlaciones
              </div>
              <ul className="space-y-1 text-[11px] text-zinc-400">
                {result.citations.map((c, i) => (
                  <li key={i} className="pl-3 border-l border-zinc-800">
                    {c}
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-zinc-800 text-[10px] text-zinc-500 leading-relaxed">
                Cada fila de resultado se calcula con la fórmula del autor indicado.
                Sin invenciones, sin extrapolaciones fuera del rango calibrado.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    </ModoAprendizajeProvider>
  );
}
