"use client";

/**
 * /studio/geotecnica/taludes — Estabilidad de taludes (Bishop + Fellenius).
 */
import { useState, useMemo } from "react";
import Link from "next/link";
import { computeSlopeLive, type SlopeInput, type SlopeLayer } from "@/lib/taludes-live";
import { ExportToolbar } from "@/components/studio/ExportToolbar";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import {
  ModoAprendizajeProvider,
  ModoAprendizajeToggle,
} from "@/components/studio/ModoAprendizaje";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import { SlopeStabilityCircleSvg } from "@/components/studio/GeotechDiagrams";
import type { CalculationStep } from "@/lib/beam-flexure-live";

const DEFAULT_LAYERS: SlopeLayer[] = [
  { z_top_m: 0, gamma_kN_m3: 17, c_kPa: 15, phi_deg: 25 },
  { z_top_m: 3, gamma_kN_m3: 18, c_kPa: 20, phi_deg: 30 },
];

const DEFAULT_INPUT: SlopeInput = {
  height_m: 8,
  angle_deg: 35,
  layers: DEFAULT_LAYERS,
  water_table_m: 99,
  k_h: 0.15,
  grid_n: 6,
  slices_n: 15,
};

export default function TaludesPage() {
  const [input, setInput] = useState<SlopeInput>(DEFAULT_INPUT);
  const { projectName } = useProjectContext();
  const result = useMemo(() => computeSlopeLive(input), [input]);

  function updateLayer<K extends keyof SlopeLayer>(i: number, field: K, value: SlopeLayer[K]) {
    const next = [...input.layers];
    next[i] = { ...next[i], [field]: value };
    setInput({ ...input, layers: next });
  }
  function addLayer() {
    const last = input.layers[input.layers.length - 1];
    setInput({
      ...input,
      layers: [...input.layers, { z_top_m: last.z_top_m + 3, gamma_kN_m3: 18, c_kPa: 20, phi_deg: 30 }],
    });
  }
  function removeLayer(i: number) {
    if (input.layers.length <= 1) return;
    const next = [...input.layers];
    next.splice(i, 1);
    setInput({ ...input, layers: next });
  }

  const snapshotBuilder = () => {
    const crit = result.critical;
    const steps: CalculationStep[] = [
      {
        id: "slope.critical",
        name: "Círculo crítico",
        equation_latex: `\\text{Centro } (${crit.xc_m.toFixed(2)}, ${crit.yc_m.toFixed(2)}) \\text{ m}; \\quad R = ${crit.R_m.toFixed(2)} \\text{ m}`,
        inputs: { xc: crit.xc_m, yc: crit.yc_m, R: crit.R_m },
        output_var: "FS_bishop",
        output_value: crit.FS_bishop,
        output_unit: "",
        code_ref: "Bishop (1955) simplificado",
        depends_on: [],
        note: `FS Fellenius = ${crit.FS_fellenius.toFixed(3)} · FS Bishop = ${crit.FS_bishop.toFixed(3)} · FS sísmico = ${result.FS_sismico_bishop.toFixed(3)}`,
      },
      ...result.all_circles.slice(0, 10).map((c, i): CalculationStep => ({
        id: `slope.circle.${i}`,
        name: `Círculo #${i + 1}${i === 0 ? " (crítico)" : ""}`,
        equation_latex: `FS_{Bishop} = ${c.FS_bishop.toFixed(3)}; \\quad FS_{Fellenius} = ${c.FS_fellenius.toFixed(3)}`,
        inputs: { xc: c.xc_m, yc: c.yc_m, R: c.R_m },
        output_var: `FS_${i}`,
        output_value: c.FS_bishop,
        output_unit: "",
        code_ref: "Bishop / Fellenius",
        depends_on: [],
        note: `Centro (${c.xc_m.toFixed(2)}, ${c.yc_m.toFixed(2)}), R = ${c.R_m.toFixed(2)} m`,
      })),
    ];
    return buildSnapshot({
      title: `Talud H ${input.height_m} m, α ${input.angle_deg}°`,
      elementType: "geotech_slope",
      fc: 0,
      fy: 0,
      inputs: [
        { name: "H", value: input.height_m, unit: "m" },
        { name: "α", value: input.angle_deg, unit: "°" },
        { name: "Nivel freático", value: input.water_table_m, unit: "m" },
        { name: "k_h", value: input.k_h },
        { name: "Grilla NxN", value: input.grid_n },
        { name: "Dovelas", value: input.slices_n },
        { name: "# capas", value: input.layers.length },
        { name: "FS Fellenius", value: crit.FS_fellenius },
        { name: "FS Bishop", value: crit.FS_bishop },
        { name: "FS sísmico", value: result.FS_sismico_bishop },
      ],
      steps,
      checks: [],
      notes: [...result.warnings, ...result.citations],
      diagrams: renderDiagrams([
        { title: "Círculo crítico de estabilidad", element: <SlopeStabilityCircleSvg r={result} input={input} /> },
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
            <h1 className="text-2xl font-semibold">🌱 Estabilidad de taludes</h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Análisis de equilibrio límite con dovelas: Fellenius (closed form)
              y Bishop simplificado (iterativo). Búsqueda automática del círculo
              crítico en una grilla de centros.
            </p>
          </div>
          <div className="w-64 shrink-0 space-y-2">
            <div className="flex justify-end"><ModoAprendizajeToggle /></div>
            <ExportToolbar buildSnapshot={snapshotBuilder} />
            <SaveToProjectButton
              elementType="taludes"
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
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Geometría</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">H (m)</span>
                  <input type="number" step={0.5} value={input.height_m}
                    onChange={(e) => setInput({ ...input, height_m: parseFloat(e.target.value) || 1 })}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">α (°)</span>
                  <input type="number" step={1} value={input.angle_deg}
                    onChange={(e) => setInput({ ...input, angle_deg: parseFloat(e.target.value) || 1 })}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">NF (m)</span>
                  <input type="number" step={0.5} value={input.water_table_m}
                    onChange={(e) => setInput({ ...input, water_table_m: parseFloat(e.target.value) || 99 })}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">k_h sismo</span>
                  <input type="number" step={0.05} value={input.k_h}
                    onChange={(e) => setInput({ ...input, k_h: parseFloat(e.target.value) || 0 })}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Resolución del análisis</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">Grilla centros (NxN)</span>
                  <input type="number" step={1} min={3} max={10} value={input.grid_n}
                    onChange={(e) => setInput({ ...input, grid_n: parseInt(e.target.value) || 5 })}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">Dovelas / círculo</span>
                  <input type="number" step={1} min={5} max={50} value={input.slices_n}
                    onChange={(e) => setInput({ ...input, slices_n: parseInt(e.target.value) || 15 })}
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
              <div className="text-[10px] uppercase tracking-wider text-emerald-400">Círculo crítico</div>
              <div className="text-xs text-zinc-300 space-y-1 font-mono">
                <div><span className="text-zinc-500">FS Fellenius: </span><span className="text-emerald-300 font-semibold">{result.critical.FS_fellenius.toFixed(3)}</span></div>
                <div><span className="text-zinc-500">FS Bishop: </span><span className="text-emerald-300 font-semibold">{result.critical.FS_bishop.toFixed(3)}</span></div>
                <div><span className="text-zinc-500">FS sísmico (k_h): </span><span className="text-amber-300 font-semibold">{result.FS_sismico_bishop.toFixed(3)}</span></div>
                <div className="pt-1 text-[10px] text-zinc-500 border-t border-emerald-900/40">
                  Centro: ({result.critical.xc_m.toFixed(2)}, {result.critical.yc_m.toFixed(2)}) m
                  <br />
                  Radio: {result.critical.R_m.toFixed(2)} m
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Círculo crítico</div>
              <SlopeStabilityCircleSvg r={result} input={input} />
            </div>
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30">
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Estratos del talud</div>
                <button onClick={addLayer} className="text-xs text-emerald-400 hover:text-emerald-300">+ Capa</button>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left py-2 px-2 font-normal">z_top (m)</th>
                    <th className="text-right py-2 px-2 font-normal">γ (kN/m³)</th>
                    <th className="text-right py-2 px-2 font-normal">c (kPa)</th>
                    <th className="text-right py-2 px-2 font-normal">φ (°)</th>
                    <th className="py-2 px-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {input.layers.map((l, i) => (
                    <tr key={i} className="border-b border-zinc-800/60">
                      <td className="py-1.5 px-2">
                        <input type="number" step={0.5} value={l.z_top_m}
                          onChange={(e) => updateLayer(i, "z_top_m", parseFloat(e.target.value) || 0)}
                          className="w-16 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono" />
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <input type="number" step={0.5} value={l.gamma_kN_m3}
                          onChange={(e) => updateLayer(i, "gamma_kN_m3", parseFloat(e.target.value) || 18)}
                          className="w-16 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <input type="number" step={1} value={l.c_kPa}
                          onChange={(e) => updateLayer(i, "c_kPa", parseFloat(e.target.value) || 0)}
                          className="w-16 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <input type="number" step={1} value={l.phi_deg}
                          onChange={(e) => updateLayer(i, "phi_deg", parseFloat(e.target.value) || 0)}
                          className="w-16 bg-amber-500/10 border border-amber-700/40 rounded px-1 py-0.5 text-amber-200 font-mono text-right" />
                      </td>
                      <td className="py-1.5 px-1">
                        <button onClick={() => removeLayer(i)} className="text-zinc-600 hover:text-red-400">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                Top {result.all_circles.length} círculos evaluados (orden FS Bishop ascendente)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-1 px-2 font-normal">#</th>
                      <th className="text-right py-1 px-2 font-normal">xc</th>
                      <th className="text-right py-1 px-2 font-normal">yc</th>
                      <th className="text-right py-1 px-2 font-normal">R</th>
                      <th className="text-right py-1 px-2 font-normal">FS Fellenius</th>
                      <th className="text-right py-1 px-2 font-normal">FS Bishop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.all_circles.slice(0, 10).map((c, i) => (
                      <tr key={i} className={`border-b border-zinc-800/60 ${i === 0 ? "bg-emerald-950/20" : ""}`}>
                        <td className="py-1 px-2 text-zinc-400">{i + 1}{i === 0 ? " ★" : ""}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{c.xc_m.toFixed(2)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{c.yc_m.toFixed(2)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{c.R_m.toFixed(2)}</td>
                        <td className="py-1 px-2 text-right text-zinc-300">{c.FS_fellenius.toFixed(3)}</td>
                        <td className={`py-1 px-2 text-right font-semibold ${i === 0 ? "text-emerald-300" : "text-zinc-300"}`}>
                          {c.FS_bishop.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {result.critical.slices && result.critical.slices.length > 0 && (
              <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Dovelas del círculo crítico</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] font-mono">
                    <thead>
                      <tr className="text-zinc-500 border-b border-zinc-800">
                        <th className="text-left py-1 px-2 font-normal">#</th>
                        <th className="text-right py-1 px-2 font-normal">x</th>
                        <th className="text-right py-1 px-2 font-normal">W (kN/m)</th>
                        <th className="text-right py-1 px-2 font-normal">α (°)</th>
                        <th className="text-right py-1 px-2 font-normal">L base (m)</th>
                        <th className="text-right py-1 px-2 font-normal">c (kPa)</th>
                        <th className="text-right py-1 px-2 font-normal">φ (°)</th>
                        <th className="text-right py-1 px-2 font-normal">u (kPa)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.critical.slices.map((s, i) => (
                        <tr key={i} className="border-b border-zinc-800/60">
                          <td className="py-1 px-2 text-zinc-500">{i + 1}</td>
                          <td className="py-1 px-2 text-right text-zinc-300">{s.x.toFixed(2)}</td>
                          <td className="py-1 px-2 text-right text-zinc-300">{s.W_kN_m.toFixed(1)}</td>
                          <td className="py-1 px-2 text-right text-zinc-300">{(s.alpha_rad * 180 / Math.PI).toFixed(1)}</td>
                          <td className="py-1 px-2 text-right text-zinc-300">{s.L_base_m.toFixed(2)}</td>
                          <td className="py-1 px-2 text-right text-zinc-300">{s.c_kPa.toFixed(0)}</td>
                          <td className="py-1 px-2 text-right text-zinc-300">{s.phi_deg.toFixed(0)}</td>
                          <td className="py-1 px-2 text-right text-zinc-300">{s.u_kPa.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3 text-[11px] text-zinc-400 leading-relaxed">
              <strong className="text-zinc-200">Fellenius (1936):</strong>{" "}
              FS = Σ(c·L + (W·cosα − u·L)·tan φ) / Σ(W·sinα).{" "}
              <strong className="text-zinc-200">Bishop (1955) simplificado:</strong>{" "}
              FS = Σ((c·b + (W − u·b)·tan φ)/m_α) / Σ(W·sinα), con m_α = cosα + tan φ·sinα/FS (iterativo).{" "}
              <strong className="text-zinc-200">Sismo:</strong> pseudo-estático con k_h ≈ 0.5·PGA/g (Hynes-Griffin & Franklin 1984).
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
