"use client";

/**
 * /studio/geotecnica/perfil — Perfil estratigráfico builder.
 */
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  computeProfileLive,
  DEFAULT_VALLE_CENTRAL,
  type ProfileInput,
  type SoilLayer,
} from "@/lib/perfil-live";
import { ExportToolbar } from "@/components/studio/ExportToolbar";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import {
  ModoAprendizajeProvider,
  ModoAprendizajeToggle,
} from "@/components/studio/ModoAprendizaje";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import { SoilProfileLayersSvg } from "@/components/studio/GeotechDiagrams";
import type { CalculationStep } from "@/lib/beam-flexure-live";

const DEFAULT_INPUT: ProfileInput = {
  layers: DEFAULT_VALLE_CENTRAL,
  water_table_m: 99,
};

export default function PerfilPage() {
  const [input, setInput] = useState<ProfileInput>(DEFAULT_INPUT);
  const { projectName } = useProjectContext();
  const result = useMemo(() => computeProfileLive(input), [input]);

  function updateLayer<K extends keyof SoilLayer>(i: number, field: K, value: SoilLayer[K]) {
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
        depth_bot_m: last.depth_bot_m + 2,
        soil_name: "Capa nueva",
        color: "#5a4734",
        gamma_kN_m3: 18,
        phi_deg: 30,
        c_kPa: 10,
        water: false,
        notes: "",
      }],
    });
  }
  function removeLayer(i: number) {
    if (input.layers.length <= 1) return;
    const next = [...input.layers];
    next.splice(i, 1);
    setInput({ ...input, layers: next });
  }

  // Compute visual scale
  const max_depth = result.total_depth_m > 0 ? result.total_depth_m : 10;
  const px_per_m = 40;

  const snapshotBuilder = () => {
    const steps: CalculationStep[] = result.layers.map((l, i) => ({
      id: `profile.layer.${i}`,
      name: `${l.layer.soil_name} (${l.layer.depth_top_m.toFixed(2)}–${l.layer.depth_bot_m.toFixed(2)} m)`,
      equation_latex: `\\sigma_v(\\text{fondo}) = ${l.sigma_v_bot_kPa.toFixed(1)} \\text{ kPa}; \\quad \\sigma'_v(\\text{fondo}) = ${l.sigma_v_eff_bot_kPa.toFixed(1)} \\text{ kPa}`,
      inputs: {
        depth_top_m: l.layer.depth_top_m,
        depth_bot_m: l.layer.depth_bot_m,
        thickness_m: l.thickness_m,
        gamma_kN_m3: l.layer.gamma_kN_m3,
        phi_deg: l.layer.phi_deg,
        c_kPa: l.layer.c_kPa,
        sigma_v_top: l.sigma_v_top_kPa,
        sigma_v_bot: l.sigma_v_bot_kPa,
      },
      output_var: `sigma_eff_${i}`,
      output_value: l.sigma_v_eff_bot_kPa,
      output_unit: "kPa",
      code_ref: "Terzaghi efectivo",
      depends_on: [],
      note: l.layer.notes || "",
    }));
    return buildSnapshot({
      title: `Perfil estratigráfico — ${result.total_depth_m.toFixed(1)} m`,
      elementType: "geotech_profile",
      fc: 0,
      fy: 0,
      inputs: [
        { name: "# capas", value: input.layers.length },
        { name: "Profundidad total", value: result.total_depth_m, unit: "m" },
        { name: "Nivel freático", value: input.water_table_m, unit: "m" },
        { name: "γ promedio", value: result.gamma_avg_kN_m3, unit: "kN/m³" },
        { name: "φ promedio", value: result.phi_avg_deg, unit: "°" },
        { name: "c promedio", value: result.c_avg_kPa, unit: "kPa" },
        { name: "NF inferido", value: result.water_table_m < 99 ? result.water_table_m : 0, unit: "m" },
      ],
      steps,
      checks: [],
      notes: [
        ...result.validations.map((v) => `${v.level.toUpperCase()}: ${v.message}`),
        ...result.citations,
      ],
      diagrams: renderDiagrams([
        { title: "Perfil estratigráfico", element: <SoilProfileLayersSvg r={result} /> },
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
            <h1 className="text-2xl font-semibold">🌱 Perfil estratigráfico</h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Construye el perfil de suelo, valida gaps/solapes, calcula esfuerzos
              verticales (totales y efectivos) y promedios ponderados de γ, φ y c
              por profundidad.
            </p>
          </div>
          <div className="w-64 shrink-0 space-y-2">
            <div className="flex justify-end"><ModoAprendizajeToggle /></div>
            <ExportToolbar buildSnapshot={snapshotBuilder} />
            <SaveToProjectButton
              elementType="perfil"
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

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Nivel freático global</div>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">NF (m, 99 = no detectado)</span>
                <input type="number" step={0.5} value={input.water_table_m}
                  onChange={(e) => setInput({ ...input, water_table_m: parseFloat(e.target.value) || 99 })}
                  className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
              </label>
            </div>

            {result.validations.length > 0 && (
              <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Validación</div>
                {result.validations.map((v, i) => (
                  <p key={i} className={`text-[11px] ${
                    v.level === "error" ? "text-red-300" :
                    v.level === "warning" ? "text-amber-300" : "text-emerald-300/80"
                  }`}>
                    {v.level === "error" ? "✗" : v.level === "warning" ? "⚠" : "ℹ"} {v.message}
                  </p>
                ))}
              </div>
            )}

            <div className="border border-emerald-900/40 bg-emerald-950/20 rounded-lg p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400">Promedios ponderados</div>
              <div className="text-xs text-zinc-300 space-y-1 font-mono">
                <div><span className="text-zinc-500">Profundidad total: </span><span className="text-emerald-300">{result.total_depth_m.toFixed(2)} m</span></div>
                <div><span className="text-zinc-500">γ promedio: </span><span className="text-emerald-300">{result.gamma_avg_kN_m3.toFixed(1)} kN/m³</span></div>
                <div><span className="text-zinc-500">φ promedio: </span><span className="text-emerald-300">{result.phi_avg_deg.toFixed(1)}°</span></div>
                <div><span className="text-zinc-500">c promedio: </span><span className="text-emerald-300">{result.c_avg_kPa.toFixed(1)} kPa</span></div>
                <div><span className="text-zinc-500">NF inferido: </span><span className="text-emerald-300">{result.water_table_m < 99 ? `${result.water_table_m.toFixed(2)} m` : "no detectado"}</span></div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Perfil estratigráfico (SVG)</div>
              <SoilProfileLayersSvg r={result} />
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-4">
              {/* Visual */}
              <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-2">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 text-center">Perfil</div>
                <div className="relative" style={{ height: max_depth * px_per_m + 20 }}>
                  {result.layers.map((lr, i) => {
                    const top = lr.layer.depth_top_m * px_per_m;
                    const h = lr.thickness_m * px_per_m;
                    return (
                      <div key={i}
                        style={{ top, height: h, backgroundColor: lr.layer.color }}
                        className="absolute left-0 right-0 border-y border-zinc-700/50 flex items-center justify-center text-[9px] text-zinc-900 font-semibold overflow-hidden">
                        {lr.layer.depth_top_m.toFixed(1)}-{lr.layer.depth_bot_m.toFixed(1)}m
                      </div>
                    );
                  })}
                  {input.water_table_m < 99 && input.water_table_m < max_depth && (
                    <div className="absolute left-0 right-0 border-t-2 border-dashed border-blue-400"
                      style={{ top: input.water_table_m * px_per_m }}>
                      <span className="absolute -top-3 right-0 text-[9px] text-blue-300">NF ▽</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Editor */}
              <div className="border border-zinc-800 rounded-lg bg-zinc-900/30">
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Capas</div>
                  <button onClick={addLayer} className="text-xs text-emerald-400 hover:text-emerald-300">+ Capa</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zinc-500 border-b border-zinc-800">
                        <th className="text-left py-2 px-1 font-normal">Nombre</th>
                        <th className="text-right py-2 px-1 font-normal">Top</th>
                        <th className="text-right py-2 px-1 font-normal">Fondo</th>
                        <th className="text-right py-2 px-1 font-normal">γ</th>
                        <th className="text-right py-2 px-1 font-normal">φ</th>
                        <th className="text-right py-2 px-1 font-normal">c</th>
                        <th className="text-center py-2 px-1 font-normal">Color</th>
                        <th className="text-center py-2 px-1 font-normal">Agua</th>
                        <th className="py-2 px-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {input.layers.map((l, i) => (
                        <tr key={i} className="border-b border-zinc-800/60">
                          <td className="py-1.5 px-1">
                            <input type="text" value={l.soil_name}
                              onChange={(e) => updateLayer(i, "soil_name", e.target.value)}
                              className="w-32 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-zinc-200 text-[11px]" />
                          </td>
                          <td className="py-1.5 px-1">
                            <input type="number" step={0.1} value={l.depth_top_m}
                              onChange={(e) => updateLayer(i, "depth_top_m", parseFloat(e.target.value) || 0)}
                              className="w-12 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          </td>
                          <td className="py-1.5 px-1">
                            <input type="number" step={0.1} value={l.depth_bot_m}
                              onChange={(e) => updateLayer(i, "depth_bot_m", parseFloat(e.target.value) || 0)}
                              className="w-12 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          </td>
                          <td className="py-1.5 px-1">
                            <input type="number" step={0.5} value={l.gamma_kN_m3}
                              onChange={(e) => updateLayer(i, "gamma_kN_m3", parseFloat(e.target.value) || 18)}
                              className="w-12 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          </td>
                          <td className="py-1.5 px-1">
                            <input type="number" step={1} value={l.phi_deg}
                              onChange={(e) => updateLayer(i, "phi_deg", parseFloat(e.target.value) || 0)}
                              className="w-10 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          </td>
                          <td className="py-1.5 px-1">
                            <input type="number" step={1} value={l.c_kPa}
                              onChange={(e) => updateLayer(i, "c_kPa", parseFloat(e.target.value) || 0)}
                              className="w-12 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                          </td>
                          <td className="py-1.5 px-1 text-center">
                            <input type="color" value={l.color}
                              onChange={(e) => updateLayer(i, "color", e.target.value)}
                              className="w-6 h-5 bg-transparent border border-zinc-700 rounded cursor-pointer" />
                          </td>
                          <td className="py-1.5 px-1 text-center">
                            <input type="checkbox" checked={l.water}
                              onChange={(e) => updateLayer(i, "water", e.target.checked)} />
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
            </div>

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Perfil de esfuerzos verticales</div>
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left py-1 px-2 font-normal">Capa</th>
                    <th className="text-right py-1 px-2 font-normal">e (m)</th>
                    <th className="text-right py-1 px-2 font-normal">σv top (kPa)</th>
                    <th className="text-right py-1 px-2 font-normal">σv fondo (kPa)</th>
                    <th className="text-right py-1 px-2 font-normal">σ&apos;v fondo (kPa)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.layers.map((l, i) => (
                    <tr key={i} className="border-b border-zinc-800/60">
                      <td className="py-1 px-2 text-zinc-300">{l.layer.soil_name}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.thickness_m.toFixed(2)}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.sigma_v_top_kPa.toFixed(1)}</td>
                      <td className="py-1 px-2 text-right text-zinc-300">{l.sigma_v_bot_kPa.toFixed(1)}</td>
                      <td className="py-1 px-2 text-right text-emerald-300">{l.sigma_v_eff_bot_kPa.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Notas por capa</div>
              <div className="space-y-2">
                {input.layers.map((l, i) => (
                  <div key={i} className="text-[11px] text-zinc-400 pl-3 border-l border-zinc-800">
                    <span className="text-zinc-200 font-medium">{l.soil_name}</span>
                    <span className="text-zinc-600"> ({l.depth_top_m}-{l.depth_bot_m} m)</span>
                    <textarea value={l.notes}
                      onChange={(e) => updateLayer(i, "notes", e.target.value)}
                      rows={2}
                      placeholder="Notas (descripción, recomendaciones, ensayos)…"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 mt-1 text-[11px] text-zinc-300" />
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-4">
              <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-2">Fuentes</div>
              <ul className="space-y-1 text-[11px] text-zinc-400">
                {result.citations.map((c, i) => (
                  <li key={i} className="pl-3 border-l border-zinc-800">{c}</li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-zinc-800 text-[10px] text-zinc-500 leading-relaxed">
                Default cargado: perfil típico Valle Central (arcilla expansiva 0-1.5m, ceniza volcánica densa 1.5-5m, toba alterada 5-10m).
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    </ModoAprendizajeProvider>
  );
}
