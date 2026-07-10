"use client";

/**
 * ReinforcementTable — pretty table of longitudinal + transversal rebar.
 * Lives on every studio page so the engineer can copy a schedule directly
 * into Hacienda paperwork. Also serialized into PDF/Excel exports.
 */

export interface RebarRow {
  n: number | string;
  size: number;
  As_total: number;
  position: string;
}

export interface StirrupRow {
  size: number;
  separacion_cm: number;
  zona: string;
  ramas: number;
}

interface Props {
  longitudinal?: RebarRow[];
  transversal?: StirrupRow[];
  title?: string;
}

export function ReinforcementTable({ longitudinal, transversal, title }: Props) {
  const hasLong = longitudinal && longitudinal.length > 0;
  const hasTrans = transversal && transversal.length > 0;
  if (!hasLong && !hasTrans) return null;

  return (
    <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {title ?? "Refuerzo de diseño"}
      </div>
      {hasLong && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-amber-400/80 mb-1">
            Longitudinal
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-1 pr-2 font-normal">#</th>
                <th className="text-left py-1 pr-2 font-normal">Tamaño</th>
                <th className="text-right py-1 pr-2 font-normal">As (cm²)</th>
                <th className="text-left py-1 font-normal">Posición</th>
              </tr>
            </thead>
            <tbody>
              {longitudinal!.map((r, i) => (
                <tr key={i} className="border-b border-zinc-800/60 last:border-b-0">
                  <td className="py-1 pr-2 text-zinc-200 font-mono">{r.n}</td>
                  <td className="py-1 pr-2 text-amber-300 font-mono">#{r.size}</td>
                  <td className="py-1 pr-2 text-right text-emerald-300 font-mono tabular-nums">
                    {r.As_total.toFixed(2)}
                  </td>
                  <td className="py-1 text-zinc-400">{r.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasTrans && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-400/80 mb-1">
            Transversal (estribos)
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-1 pr-2 font-normal">Tamaño</th>
                <th className="text-right py-1 pr-2 font-normal">Sep. (cm)</th>
                <th className="text-center py-1 pr-2 font-normal">Ramas</th>
                <th className="text-left py-1 font-normal">Zona</th>
              </tr>
            </thead>
            <tbody>
              {transversal!.map((r, i) => (
                <tr key={i} className="border-b border-zinc-800/60 last:border-b-0">
                  <td className="py-1 pr-2 text-amber-300 font-mono">#{r.size}</td>
                  <td className="py-1 pr-2 text-right text-zinc-200 font-mono tabular-nums">
                    {r.separacion_cm.toFixed(1)}
                  </td>
                  <td className="py-1 pr-2 text-center text-zinc-300">{r.ramas}</td>
                  <td className="py-1 text-zinc-400">{r.zona}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
