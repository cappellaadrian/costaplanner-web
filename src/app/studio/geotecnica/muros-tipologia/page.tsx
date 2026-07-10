"use client";

/**
 * /studio/geotecnica/muros-tipologia — selección de tipo de muro.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  computeWallSelection,
  type WallInput,
  type SuelosAtras,
  type Presupuesto,
  type ZonaSismica,
} from "@/lib/muros-tipologia-live";
import { ExportToolbar } from "@/components/studio/ExportToolbar";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import {
  ModoAprendizajeProvider,
  ModoAprendizajeToggle,
} from "@/components/studio/ModoAprendizaje";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import { WallTypologyComparisonSvg } from "@/components/studio/GeotechDiagrams";
import type { CalculationStep } from "@/lib/beam-flexure-live";

const DEFAULT_INPUT: WallInput = {
  H_m: 5,
  suelo_atras: "arena",
  espacio_atras_m: 2,
  presupuesto: "medium",
  zona_sismica: 3,
  agua_freatica: false,
};

export default function MurosTipologiaPage() {
  const [input, setInput] = useState<WallInput>(DEFAULT_INPUT);
  const { meta, projectName } = useProjectContext();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!meta || prefilledRef.current) return;
    prefilledRef.current = true;
    setInput((p) => ({
      ...p,
      zona_sismica: (meta.zonaSismica as ZonaSismica) ?? p.zona_sismica,
    }));
  }, [meta]);
  const result = useMemo(() => computeWallSelection(input), [input]);

  const snapshotBuilder = () => {
    const steps: CalculationStep[] = result.ranking.map((r, i): CalculationStep => ({
      id: `wall.${r.tipo}`,
      name: `#${i + 1} ${r.nombre}${i === 0 ? " (recomendado)" : ""}`,
      equation_latex: `\\text{Score} = 0.25 \\cdot S_H + 0.15 \\cdot S_{suelo} + 0.20 \\cdot S_{esp} + 0.15 \\cdot S_{\\$} + 0.15 \\cdot S_{sismo} + 0.10 \\cdot S_{agua} = ${r.score.toFixed(2)}`,
      inputs: {
        altura: r.breakdown.altura,
        suelo: r.breakdown.suelo,
        espacio: r.breakdown.espacio,
        costo: r.breakdown.costo,
        sismo: r.breakdown.sismo,
        agua: r.breakdown.agua,
      },
      output_var: `score_${r.tipo}`,
      output_value: r.score,
      output_unit: "/10",
      code_ref: r.refs.join(" · "),
      depends_on: [],
      note: [r.descripcion, ...r.justificacion].join(" | "),
    }));
    return buildSnapshot({
      title: `Tipología de muro recomendada — ${result.recomendacion.nombre}`,
      elementType: "geotech_wall_selection",
      fc: 0,
      fy: 0,
      inputs: [
        { name: "Altura H", value: input.H_m, unit: "m" },
        { name: "Espacio atrás", value: input.espacio_atras_m, unit: "m" },
        { name: "Suelo retenido", value: input.suelo_atras },
        { name: "Presupuesto", value: input.presupuesto },
        { name: "Zona sísmica", value: input.zona_sismica },
        { name: "Agua freática", value: input.agua_freatica ? "sí" : "no" },
        { name: "Recomendado", value: result.recomendacion.nombre },
        { name: "Score recomendado", value: result.recomendacion.score },
      ],
      steps,
      checks: [],
      notes: [...result.warnings, ...result.citations],
      diagrams: renderDiagrams([
        { title: "Tipologías de muro — top 3", element: <WallTypologyComparisonSvg r={result} /> },
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
            <h1 className="text-2xl font-semibold">🌱 Selección de tipología de muro</h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Decisor multi-criterio entre voladizo, contrafuertes, gravedad,
              gaviones, anclado y tierra armada. Score 0-10 por altura, suelo,
              espacio, costo, sismo y agua. Recomendación con justificación.
            </p>
          </div>
          <div className="w-64 shrink-0 space-y-2">
            <div className="flex justify-end"><ModoAprendizajeToggle /></div>
            <ExportToolbar buildSnapshot={snapshotBuilder} />
            <SaveToProjectButton
              elementType="muros-tipologia"
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
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">Altura H (m)</span>
                <input type="number" step={0.5} value={input.H_m}
                  onChange={(e) => setInput({ ...input, H_m: parseFloat(e.target.value) || 0 })}
                  className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">Espacio disponible atrás (m)</span>
                <input type="number" step={0.1} value={input.espacio_atras_m}
                  onChange={(e) => setInput({ ...input, espacio_atras_m: parseFloat(e.target.value) || 0 })}
                  className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200 font-mono" />
              </label>
            </div>

            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Condiciones del sitio</div>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">Suelo retenido</span>
                <select value={input.suelo_atras}
                  onChange={(e) => setInput({ ...input, suelo_atras: e.target.value as SuelosAtras })}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200">
                  <option value="arena">Arena / arena limosa</option>
                  <option value="arcilla">Arcilla</option>
                  <option value="granular_grueso">Granular grueso (grava)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">Presupuesto</span>
                <select value={input.presupuesto}
                  onChange={(e) => setInput({ ...input, presupuesto: e.target.value as Presupuesto })}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200">
                  <option value="low">Bajo</option>
                  <option value="medium">Medio</option>
                  <option value="high">Alto</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-zinc-500">Zona sísmica CR</span>
                <select value={input.zona_sismica}
                  onChange={(e) => setInput({ ...input, zona_sismica: parseInt(e.target.value) as ZonaSismica })}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200">
                  <option value={1}>Zona 1 (baja)</option>
                  <option value={2}>Zona 2</option>
                  <option value={3}>Zona 3</option>
                  <option value={4}>Zona 4 (alta)</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-300 mt-2">
                <input type="checkbox" checked={input.agua_freatica}
                  onChange={(e) => setInput({ ...input, agua_freatica: e.target.checked })} />
                Agua freática detrás del muro
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
              <div className="text-[10px] uppercase tracking-wider text-emerald-400">Recomendación</div>
              <div className="text-base text-emerald-300 font-semibold">{result.recomendacion.nombre}</div>
              <div className="text-xs text-zinc-400">{result.recomendacion.descripcion}</div>
              <div className="text-xs font-mono text-emerald-300 pt-2 border-t border-emerald-900/40">
                Score: {result.recomendacion.score.toFixed(2)} / 10
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Top 3 tipologías</div>
              <WallTypologyComparisonSvg r={result} />
            </div>
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left py-2 px-2 font-normal">Ranking</th>
                    <th className="text-left py-2 px-2 font-normal">Tipo</th>
                    <th className="text-right py-2 px-2 font-normal">Score</th>
                    <th className="text-right py-2 px-2 font-normal">Altura</th>
                    <th className="text-right py-2 px-2 font-normal">Suelo</th>
                    <th className="text-right py-2 px-2 font-normal">Espacio</th>
                    <th className="text-right py-2 px-2 font-normal">Costo</th>
                    <th className="text-right py-2 px-2 font-normal">Sismo</th>
                    <th className="text-right py-2 px-2 font-normal">Agua</th>
                  </tr>
                </thead>
                <tbody>
                  {result.ranking.map((r, i) => (
                    <tr key={r.tipo} className={`border-b border-zinc-800/60 ${i === 0 ? "bg-emerald-950/20" : ""}`}>
                      <td className="py-1.5 px-2 text-zinc-500">{i + 1}{i === 0 ? " ★" : ""}</td>
                      <td className="py-1.5 px-2 text-zinc-200">{r.nombre}</td>
                      <td className={`py-1.5 px-2 text-right font-mono font-semibold ${i === 0 ? "text-emerald-300" : "text-zinc-300"}`}>
                        {r.score.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-right text-zinc-400 font-mono">{r.breakdown.altura.toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-right text-zinc-400 font-mono">{r.breakdown.suelo.toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-right text-zinc-400 font-mono">{r.breakdown.espacio.toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-right text-zinc-400 font-mono">{r.breakdown.costo.toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-right text-zinc-400 font-mono">{r.breakdown.sismo.toFixed(1)}</td>
                      <td className="py-1.5 px-2 text-right text-zinc-400 font-mono">{r.breakdown.agua.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {result.ranking.slice(0, 3).map((r, i) => (
                <div key={r.tipo} className={`border rounded-lg p-3 ${i === 0 ? "border-emerald-700 bg-emerald-950/20" : "border-zinc-800 bg-zinc-900/30"}`}>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">#{i + 1} {i === 0 ? "★ Recomendado" : ""}</div>
                  <div className="text-sm font-semibold text-zinc-100 mb-1">{r.nombre}</div>
                  <div className="text-xs text-zinc-400 mb-3">{r.descripcion}</div>
                  <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">Justificación</div>
                  <ul className="space-y-0.5 mb-3">
                    {r.justificacion.map((j, k) => (
                      <li key={k} className="text-[11px] text-zinc-400 pl-2 border-l border-zinc-800">{j}</li>
                    ))}
                  </ul>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Referencias</div>
                  <ul className="space-y-0.5">
                    {r.refs.map((ref, k) => (
                      <li key={k} className="text-[10px] text-zinc-500 pl-2 border-l border-zinc-800">{ref}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-3 text-[11px] text-zinc-400 leading-relaxed">
              <strong className="text-zinc-200">Pesos del score multi-criterio:</strong>{" "}
              Altura 25% · Suelo 15% · Espacio 20% · Costo 15% · Sismo 15% · Agua 10%.
              Cada dimensión se puntúa 0-10. Para zonas IV CR (Nicoya/Quepos/Limón) los
              tipos con mayor robustez sísmica (tierra armada, anclado, contrafuertes) reciben bonus.
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
