"use client";

/**
 * /studio/geotecnica/capacidad-portante — Comparativa Meyerhof/Hansen/Vesić
 * para zapata superficial.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { computeBearingLive, type BearingInput, type MethodResult } from "@/lib/bearing-capacity-live";
import { ExportToolbar } from "@/components/studio/ExportToolbar";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import {
  ModoAprendizajeProvider,
  ModoAprendizajeToggle,
} from "@/components/studio/ModoAprendizaje";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import { BearingFailureWedgeSvg } from "@/components/studio/GeotechDiagrams";
import type { CalculationStep } from "@/lib/beam-flexure-live";

const DEFAULT_INPUT: BearingInput = {
  B_m: 1.5,
  L_m: 1.5,
  Df_m: 1.0,
  gamma_kN_m3: 18,
  phi_deg: 30,
  c_kPa: 10,
  inclinacion_deg: 0,
  water_table_m: 99,
  FS_estatico: 3,
  FS_sismico: 2,
  k_h: 0.15,
};

export default function CapacidadPortantePage() {
  const [input, setInput] = useState<BearingInput>(DEFAULT_INPUT);
  const { meta, projectName } = useProjectContext();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!meta || prefilledRef.current) return;
    prefilledRef.current = true;
    setInput((p) => ({
      ...p,
      phi_deg: meta.phi_deg ?? p.phi_deg,
      c_kPa: meta.c_kPa ?? p.c_kPa,
      gamma_kN_m3: meta.gamma_kN_m3 ?? p.gamma_kN_m3,
      water_table_m: meta.waterTable_m ?? p.water_table_m,
    }));
  }, [meta]);
  const result = useMemo(() => computeBearingLive(input), [input]);

  const setField = (field: keyof BearingInput, value: number) =>
    setInput({ ...input, [field]: value });

  function MethodCol({ m }: { m: MethodResult }) {
    return (
      <td className="border-l border-zinc-800/60 px-3 py-1.5 text-right font-mono text-zinc-300">
        {m.qu_kPa.toFixed(0)}
      </td>
    );
  }

  const snapshotBuilder = () => {
    const methodStep = (name: string, m: MethodResult, idx: number): CalculationStep => ({
      id: `bearing.${name}.${idx}`,
      name: `${name} — q_u`,
      equation_latex: `q_u = c \\cdot N_c \\cdot s_c \\cdot d_c \\cdot i_c + q_0 \\cdot N_q \\cdot s_q \\cdot d_q \\cdot i_q + 0.5 \\cdot \\gamma' \\cdot B \\cdot N_\\gamma \\cdot s_\\gamma \\cdot d_\\gamma \\cdot i_\\gamma = ${m.qu_kPa.toFixed(0)} \\text{ kPa}`,
      inputs: {
        Nc: m.Nc, Nq: m.Nq, Ngamma: m.Ngamma,
        sc: m.sc, sq: m.sq, sgamma: m.sgamma,
        dc: m.dc, dq: m.dq, dgamma: m.dgamma,
        ic: m.ic, iq: m.iq, igamma: m.igamma,
      },
      output_var: `qu_${name}`,
      output_value: m.qu_kPa,
      output_unit: "kPa",
      code_ref: name,
      depends_on: [],
      note: `q_a estático = ${m.qa_kPa.toFixed(0)} kPa · q_a sísmico = ${m.qa_sismico_kPa.toFixed(0)} kPa`,
    });
    const steps: CalculationStep[] = [
      methodStep("Meyerhof", result.meyerhof, 0),
      methodStep("Hansen", result.hansen, 1),
      methodStep("Vesic", result.vesic, 2),
    ];
    return buildSnapshot({
      title: `Capacidad portante zapata ${input.B_m}×${input.L_m} m (Df ${input.Df_m} m)`,
      elementType: "geotech_bearing",
      fc: 0,
      fy: 0,
      inputs: [
        { name: "B", value: input.B_m, unit: "m" },
        { name: "L", value: input.L_m, unit: "m" },
        { name: "Df", value: input.Df_m, unit: "m" },
        { name: "α inclinación", value: input.inclinacion_deg, unit: "°" },
        { name: "γ", value: input.gamma_kN_m3, unit: "kN/m³" },
        { name: "φ", value: input.phi_deg, unit: "°" },
        { name: "c", value: input.c_kPa, unit: "kPa" },
        { name: "Nivel freático", value: input.water_table_m, unit: "m" },
        { name: "FS estático", value: input.FS_estatico },
        { name: "FS sísmico", value: input.FS_sismico },
        { name: "k_h", value: input.k_h },
        { name: "q_0 = γ·Df", value: result.q0_kPa, unit: "kPa" },
        { name: "q_a recomendado (mín. 3)", value: result.qa_recomendado_kPa, unit: "kPa" },
      ],
      steps,
      checks: [],
      notes: [
        ...result.warnings,
        "Terzaghi (1943) — Theoretical Soil Mechanics",
        "Meyerhof (1963) — Canadian Geotech. J. 1(1)",
        "Hansen (1970) — Danish Geotech. Inst. Bull. 28",
        "Vesić (1973) — JSMFD 99(SM1)",
        "Bowles (1996) §4 · CSCR-10 Rev. 2014 §6",
      ],
      diagrams: renderDiagrams([
        { title: "Cuña de falla Prandtl-Terzaghi", element: <BearingFailureWedgeSvg r={result} /> },
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
            <h1 className="text-2xl font-semibold">🌱 Capacidad portante (Meyerhof / Hansen / Vesić)</h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Comparativa lado a lado de los tres métodos clásicos. Incluye factores
              de forma, profundidad, inclinación y reducción sísmica por k_h.
            </p>
          </div>
          <div className="w-64 shrink-0 space-y-2">
            <div className="flex justify-end"><ModoAprendizajeToggle /></div>
            <ExportToolbar buildSnapshot={snapshotBuilder} />
            <SaveToProjectButton
              elementType="capacidad-portante"
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
                  <span className="text-[10px] text-zinc-500">B (m)</span>
                  <input type="number" step={0.1} value={input.B_m}
                    onChange={(e) => setField("B_m", parseFloat(e.target.value) || 0)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">L (m)</span>
                  <input type="number" step={0.1} value={input.L_m}
                    onChange={(e) => setField("L_m", parseFloat(e.target.value) || 0)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">Df (m)</span>
                  <input type="number" step={0.1} value={input.Df_m}
                    onChange={(e) => setField("Df_m", parseFloat(e.target.value) || 0)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">α inclinación (°)</span>
                  <input type="number" step={1} value={input.inclinacion_deg}
                    onChange={(e) => setField("inclinacion_deg", parseFloat(e.target.value) || 0)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Suelo</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">γ (kN/m³)</span>
                  <input type="number" step={0.5} value={input.gamma_kN_m3}
                    onChange={(e) => setField("gamma_kN_m3", parseFloat(e.target.value) || 18)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">φ (°)</span>
                  <input type="number" step={1} value={input.phi_deg}
                    onChange={(e) => setField("phi_deg", parseFloat(e.target.value) || 0)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">c (kPa)</span>
                  <input type="number" step={5} value={input.c_kPa}
                    onChange={(e) => setField("c_kPa", parseFloat(e.target.value) || 0)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">NF (m, 99=no)</span>
                  <input type="number" step={0.5} value={input.water_table_m}
                    onChange={(e) => setField("water_table_m", parseFloat(e.target.value) || 99)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Factores de seguridad y sismo</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">FS estático</span>
                  <input type="number" step={0.5} value={input.FS_estatico}
                    onChange={(e) => setField("FS_estatico", parseFloat(e.target.value) || 3)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500">FS sísmico</span>
                  <input type="number" step={0.5} value={input.FS_sismico}
                    onChange={(e) => setField("FS_sismico", parseFloat(e.target.value) || 2)}
                    className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
                </label>
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="text-[10px] text-zinc-500">k_h (≈ 0.5·PGA/g)</span>
                  <input type="number" step={0.05} value={input.k_h}
                    onChange={(e) => setField("k_h", parseFloat(e.target.value) || 0)}
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
              <div className="text-[10px] uppercase tracking-wider text-emerald-400">Recomendación</div>
              <div className="text-xs text-zinc-300 space-y-1 font-mono">
                <div><span className="text-zinc-500">q_a recomendado (mín. 3 métodos): </span>
                  <span className="text-emerald-300 font-semibold">{result.qa_recomendado_kPa.toFixed(0)} kPa</span>
                </div>
                <div><span className="text-zinc-500">q_0 = γ·Df: </span>
                  <span className="text-zinc-300">{result.q0_kPa.toFixed(1)} kPa</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Cuña de falla</div>
              <BearingFailureWedgeSvg r={result} />
            </div>
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left py-2 px-2 font-normal">Parámetro</th>
                    <th className="text-right py-2 px-3 font-normal border-l border-zinc-800/60">Meyerhof (1963)</th>
                    <th className="text-right py-2 px-3 font-normal border-l border-zinc-800/60">Hansen (1970)</th>
                    <th className="text-right py-2 px-3 font-normal border-l border-zinc-800/60">Vesić (1973)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Nc", k: "Nc" as const, fmt: (v: number) => v.toFixed(2) },
                    { label: "Nq", k: "Nq" as const, fmt: (v: number) => v.toFixed(2) },
                    { label: "Nγ", k: "Ngamma" as const, fmt: (v: number) => v.toFixed(2) },
                    { label: "sc", k: "sc" as const, fmt: (v: number) => v.toFixed(3) },
                    { label: "sq", k: "sq" as const, fmt: (v: number) => v.toFixed(3) },
                    { label: "sγ", k: "sgamma" as const, fmt: (v: number) => v.toFixed(3) },
                    { label: "dc", k: "dc" as const, fmt: (v: number) => v.toFixed(3) },
                    { label: "dq", k: "dq" as const, fmt: (v: number) => v.toFixed(3) },
                    { label: "dγ", k: "dgamma" as const, fmt: (v: number) => v.toFixed(3) },
                    { label: "ic", k: "ic" as const, fmt: (v: number) => v.toFixed(3) },
                    { label: "iq", k: "iq" as const, fmt: (v: number) => v.toFixed(3) },
                    { label: "iγ", k: "igamma" as const, fmt: (v: number) => v.toFixed(3) },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-zinc-800/60">
                      <td className="py-1 px-2 text-zinc-400">{row.label}</td>
                      <td className="py-1 px-3 text-right text-zinc-300 font-mono border-l border-zinc-800/60">{row.fmt(result.meyerhof[row.k])}</td>
                      <td className="py-1 px-3 text-right text-zinc-300 font-mono border-l border-zinc-800/60">{row.fmt(result.hansen[row.k])}</td>
                      <td className="py-1 px-3 text-right text-zinc-300 font-mono border-l border-zinc-800/60">{row.fmt(result.vesic[row.k])}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-zinc-800/60 bg-zinc-900/40">
                    <td className="py-1.5 px-2 text-emerald-400 font-semibold">q_u (kPa)</td>
                    <MethodCol m={result.meyerhof} />
                    <MethodCol m={result.hansen} />
                    <MethodCol m={result.vesic} />
                  </tr>
                  <tr className="border-b border-zinc-800/60 bg-zinc-900/40">
                    <td className="py-1.5 px-2 text-emerald-400">q_a estático (kPa)</td>
                    <td className="border-l border-zinc-800/60 px-3 py-1.5 text-right font-mono text-emerald-300">{result.meyerhof.qa_kPa.toFixed(0)}</td>
                    <td className="border-l border-zinc-800/60 px-3 py-1.5 text-right font-mono text-emerald-300">{result.hansen.qa_kPa.toFixed(0)}</td>
                    <td className="border-l border-zinc-800/60 px-3 py-1.5 text-right font-mono text-emerald-300">{result.vesic.qa_kPa.toFixed(0)}</td>
                  </tr>
                  <tr className="bg-zinc-900/40">
                    <td className="py-1.5 px-2 text-amber-400">q_a sísmico (kPa)</td>
                    <td className="border-l border-zinc-800/60 px-3 py-1.5 text-right font-mono text-amber-300">{result.meyerhof.qa_sismico_kPa.toFixed(0)}</td>
                    <td className="border-l border-zinc-800/60 px-3 py-1.5 text-right font-mono text-amber-300">{result.hansen.qa_sismico_kPa.toFixed(0)}</td>
                    <td className="border-l border-zinc-800/60 px-3 py-1.5 text-right font-mono text-amber-300">{result.vesic.qa_sismico_kPa.toFixed(0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3 text-[11px] text-zinc-400 leading-relaxed">
              <strong className="text-zinc-200">Ecuación general (Terzaghi 1943):</strong>{" "}
              q_u = c·Nc·sc·dc·ic + q_0·Nq·sq·dq·iq + 0.5·γ&apos;·B·Nγ·sγ·dγ·iγ.{" "}
              Reducción sísmica (CSCR §6): φ_sísmico = φ − arctan(k_h).
              <br />
              <span className="text-zinc-500">γ&apos; efectivo arriba = {result.gamma_eff_top_kN_m3.toFixed(1)} kN/m³,
              γ&apos; efectivo abajo = {result.gamma_eff_bot_kN_m3.toFixed(1)} kN/m³.</span>
            </div>

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-4">
              <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-2">Fuentes</div>
              <ul className="space-y-1 text-[11px] text-zinc-400">
                <li className="pl-3 border-l border-zinc-800">Terzaghi (1943) — Theoretical Soil Mechanics</li>
                <li className="pl-3 border-l border-zinc-800">Meyerhof (1963) — Canadian Geotech. J. 1(1)</li>
                <li className="pl-3 border-l border-zinc-800">Hansen (1970) — Danish Geotech. Inst. Bull. 28</li>
                <li className="pl-3 border-l border-zinc-800">Vesić (1973) — JSMFD 99(SM1)</li>
                <li className="pl-3 border-l border-zinc-800">Bowles (1996) §4</li>
                <li className="pl-3 border-l border-zinc-800">Código Cimentaciones CR (2009) §5</li>
                <li className="pl-3 border-l border-zinc-800">CSCR-10 Rev. 2014 §6</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
    </ModoAprendizajeProvider>
  );
}
