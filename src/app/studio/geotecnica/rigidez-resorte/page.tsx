"use client";

/**
 * /studio/geotecnica/rigidez-resorte — módulo de balasto k para
 * análisis Winkler en SAP/ETABS.
 */
import { useState, useMemo } from "react";
import Link from "next/link";
import { computeSpringLive, type SpringInput, type SoilType } from "@/lib/rigidez-resorte-live";
import { ExportToolbar } from "@/components/studio/ExportToolbar";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import {
  ModoAprendizajeProvider,
  ModoAprendizajeToggle,
} from "@/components/studio/ModoAprendizaje";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import { SubgradeSpringSvg } from "@/components/studio/GeotechDiagrams";
import type { CalculationStep } from "@/lib/beam-flexure-live";

const DEFAULT_INPUT: SpringInput = {
  qa_kPa: 200,
  asentamiento_adm_cm: 2.5,
  B_m: 1.5,
  L_m: 1.5,
  soil_type: "arena_media",
  E_MPa: 30,
  mu: 0.3,
  Ef_MPa: 0,
  If_m4: 0,
};

const SOIL_TYPES: { value: SoilType; label: string }[] = [
  { value: "arena_suelta", label: "Arena suelta" },
  { value: "arena_media", label: "Arena media" },
  { value: "arena_densa", label: "Arena densa" },
  { value: "arcilla_blanda", label: "Arcilla blanda" },
  { value: "arcilla_media", label: "Arcilla media" },
  { value: "arcilla_dura", label: "Arcilla dura" },
];

export default function RigidezResortePage() {
  const [input, setInput] = useState<SpringInput>(DEFAULT_INPUT);
  const { projectName } = useProjectContext();
  const result = useMemo(() => computeSpringLive(input), [input]);

  const setField = <K extends keyof SpringInput>(field: K, value: SpringInput[K]) =>
    setInput({ ...input, [field]: value });

  const snapshotBuilder = () => {
    const mkStep = (id: string, name: string, value: number, ref: string, eq: string): CalculationStep => ({
      id, name, equation_latex: eq, inputs: {}, output_var: id, output_value: value,
      output_unit: "kN/m³", code_ref: ref, depends_on: [], note: `= ${(value / 1000).toFixed(2)} MN/m³`,
    });
    const steps: CalculationStep[] = [
      mkStep("k_qa", "k = q_a / δ", result.k_qa_kN_m3, "Terzaghi (1955), Bowles §16",
        `k = q_a / \\delta_{adm} = ${input.qa_kPa.toFixed(0)} / ${(input.asentamiento_adm_cm / 100).toFixed(4)} = ${result.k_qa_kN_m3.toFixed(0)} \\text{ kN/m}^3`),
      mkStep("k_vesic", "Vesić elástico", result.k_vesic_kN_m3, "Vesić (1961) JEMD 87(EM2)",
        `k_v = 0.65 \\cdot \\frac{E_s}{B(1-\\mu^2)} \\cdot \\sqrt[12]{\\frac{E_s \\cdot B^4}{E_f \\cdot I_f}}`),
      mkStep("k_terzaghi", "Terzaghi tabulado (B=0.3 m)", result.k_terzaghi_ref_kN_m3, "Terzaghi (1955) tabla",
        `k_{ref}`),
      mkStep("k_bowles", "Bowles corregido por tamaño", result.k_corregido_kN_m3, `Bowles (1996) §16, factor=${result.shape_factor.toFixed(3)}`,
        `k = k_1 \\cdot \\left(\\frac{B+0.3}{2B}\\right)^2`),
      mkStep("k_rec", "Recomendado (√(qa·Vesić))", result.k_recomendado_kN_m3, "media geométrica",
        `k_{rec} = \\sqrt{k_{qa} \\cdot k_{vesic}}`),
    ];
    return buildSnapshot({
      title: `Módulo de balasto k — zapata ${input.B_m}×${input.L_m} m`,
      elementType: "geotech_spring",
      fc: 0,
      fy: 0,
      inputs: [
        { name: "q_a", value: input.qa_kPa, unit: "kPa" },
        { name: "δ admisible", value: input.asentamiento_adm_cm, unit: "cm" },
        { name: "B", value: input.B_m, unit: "m" },
        { name: "L", value: input.L_m, unit: "m" },
        { name: "Tipo suelo", value: input.soil_type },
        { name: "Es", value: input.E_MPa, unit: "MPa" },
        { name: "μ", value: input.mu },
        { name: "Ef", value: input.Ef_MPa, unit: "MPa" },
        { name: "If", value: input.If_m4, unit: "m⁴" },
        { name: "Área A", value: result.A_m2, unit: "m²" },
        { name: "k recomendado", value: result.k_recomendado_kN_m3, unit: "kN/m³" },
        { name: "K = k·A", value: result.K_spring_kN_m, unit: "kN/m" },
      ],
      steps,
      checks: [],
      notes: [...result.warnings, ...result.citations],
      diagrams: renderDiagrams([
        { title: "Modelo Winkler — resorte equivalente", element: <SubgradeSpringSvg r={result} input={input} /> },
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
            <h1 className="text-2xl font-semibold">🌱 Módulo de balasto / Resorte equivalente</h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Convierte la capacidad portante admisible y el asentamiento tolerable
              en un módulo k para análisis Winkler. Compara métodos qa/δ, Vesić
              elástico y Terzaghi tabulado con corrección por tamaño (Bowles).
            </p>
          </div>
          <div className="w-64 shrink-0 space-y-2">
            <div className="flex justify-end"><ModoAprendizajeToggle /></div>
            <ExportToolbar buildSnapshot={snapshotBuilder} />
            <SaveToProjectButton
              elementType="rigidez-resorte"
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
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Capacidad y servicio</div>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">q_a (kPa)</span>
                <input type="number" step={10} value={input.qa_kPa}
                  onChange={(e) => setField("qa_kPa", parseFloat(e.target.value) || 0)}
                  className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">δ admisible (cm)</span>
                <input type="number" step={0.1} value={input.asentamiento_adm_cm}
                  onChange={(e) => setField("asentamiento_adm_cm", parseFloat(e.target.value) || 0.1)}
                  className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
              </label>
            </div>

            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Zapata</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">B (m)</span>
                  <input type="number" step={0.1} value={input.B_m}
                    onChange={(e) => setField("B_m", parseFloat(e.target.value) || 0.1)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">L (m)</span>
                  <input type="number" step={0.1} value={input.L_m}
                    onChange={(e) => setField("L_m", parseFloat(e.target.value) || 0.1)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Suelo</div>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">Tipo</span>
                <select value={input.soil_type}
                  onChange={(e) => setField("soil_type", e.target.value as SoilType)}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200">
                  {SOIL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">Es (MPa)</span>
                  <input type="number" step={1} value={input.E_MPa}
                    onChange={(e) => setField("E_MPa", parseFloat(e.target.value) || 1)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">μ</span>
                  <input type="number" step={0.05} value={input.mu}
                    onChange={(e) => setField("mu", parseFloat(e.target.value) || 0)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Rigidez estructural (opcional)</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">Ef (MPa)</span>
                  <input type="number" step={500} value={input.Ef_MPa}
                    onChange={(e) => setField("Ef_MPa", parseFloat(e.target.value) || 0)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">If (m⁴)</span>
                  <input type="number" step={0.001} value={input.If_m4}
                    onChange={(e) => setField("If_m4", parseFloat(e.target.value) || 0)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
              </div>
              <div className="text-[10px] text-zinc-500">0 = zapata flexible (default).</div>
            </div>

            {result.warnings.length > 0 && (
              <div className="border border-amber-900/40 bg-amber-950/20 rounded-lg p-3 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Advertencias</div>
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-200/80">{w}</p>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Modelo Winkler</div>
              <SubgradeSpringSvg r={result} input={input} />
            </div>
            <div className="border border-emerald-900/40 bg-emerald-950/20 rounded-lg p-4 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400">Resultado recomendado</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-zinc-500">Módulo de balasto k</div>
                  <div className="text-xl font-mono text-emerald-300 font-semibold">
                    {(result.k_recomendado_kN_m3 / 1000).toFixed(1)} <span className="text-sm text-emerald-400/70">MN/m³</span>
                  </div>
                  <div className="text-[10px] text-zinc-600">= {result.k_recomendado_kN_m3.toFixed(0)} kN/m³</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">Resorte equivalente K = k·A</div>
                  <div className="text-xl font-mono text-emerald-300 font-semibold">
                    {(result.K_spring_kN_m / 1000).toFixed(1)} <span className="text-sm text-emerald-400/70">MN/m</span>
                  </div>
                  <div className="text-[10px] text-zinc-600">A = {result.A_m2.toFixed(2)} m²</div>
                </div>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Comparativa de métodos</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left py-2 px-2 font-normal">Método</th>
                    <th className="text-right py-2 px-2 font-normal">k (kN/m³)</th>
                    <th className="text-right py-2 px-2 font-normal">k (MN/m³)</th>
                    <th className="text-left py-2 px-2 font-normal">Fuente</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-800/60">
                    <td className="py-1.5 px-2 text-zinc-200">k = q_a / δ</td>
                    <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">{result.k_qa_kN_m3.toFixed(0)}</td>
                    <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">{(result.k_qa_kN_m3 / 1000).toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-zinc-500 text-[10px]">Terzaghi (1955), Bowles §16</td>
                  </tr>
                  <tr className="border-b border-zinc-800/60">
                    <td className="py-1.5 px-2 text-zinc-200">Vesić elástico</td>
                    <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">{result.k_vesic_kN_m3.toFixed(0)}</td>
                    <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">{(result.k_vesic_kN_m3 / 1000).toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-zinc-500 text-[10px]">Vesić (1961) JEMD 87(EM2)</td>
                  </tr>
                  <tr className="border-b border-zinc-800/60">
                    <td className="py-1.5 px-2 text-zinc-200">Terzaghi tabulado (B=0.3m)</td>
                    <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">{result.k_terzaghi_ref_kN_m3.toFixed(0)}</td>
                    <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">{(result.k_terzaghi_ref_kN_m3 / 1000).toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-zinc-500 text-[10px]">Terzaghi (1955) tabla</td>
                  </tr>
                  <tr className="border-b border-zinc-800/60">
                    <td className="py-1.5 px-2 text-zinc-200">Bowles corregido por tamaño</td>
                    <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">{result.k_corregido_kN_m3.toFixed(0)}</td>
                    <td className="py-1.5 px-2 text-right text-zinc-300 font-mono">{(result.k_corregido_kN_m3 / 1000).toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-zinc-500 text-[10px]">Bowles (1996) §16, factor={result.shape_factor.toFixed(3)}</td>
                  </tr>
                  <tr className="bg-emerald-950/20">
                    <td className="py-1.5 px-2 text-emerald-300 font-semibold">Recomendado (√(qa·Vesić))</td>
                    <td className="py-1.5 px-2 text-right text-emerald-300 font-mono font-semibold">{result.k_recomendado_kN_m3.toFixed(0)}</td>
                    <td className="py-1.5 px-2 text-right text-emerald-300 font-mono font-semibold">{(result.k_recomendado_kN_m3 / 1000).toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-emerald-400/80 text-[10px]">media geométrica</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3 text-[11px] text-zinc-400 leading-relaxed">
              <strong className="text-zinc-200">Vesić (1961):</strong>{" "}
              k = 0.65·Es/(B(1-μ²)) · ¹²√(Es·B⁴/(Ef·If)).{" "}
              Si zapata flexible (Ef·If = 0) se reduce a k = 0.65·Es/(B(1-μ²)).{" "}
              <strong className="text-zinc-200">Bowles tamaño arena:</strong>{" "}
              k = k₁·((B+0.3)/(2B))². <strong className="text-zinc-200">Arcilla:</strong> k = k₁·(0.3/B).{" "}
              Para uso en SAP2000/ETABS: definir &quot;Area Spring&quot; con esta k o&quot;Point Spring&quot; con K = k·A.
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
