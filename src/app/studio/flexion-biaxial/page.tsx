"use client";

/**
 * /studio/flexion-biaxial — Flexión biaxial de columna.
 * ACI 318-14 §22.4 · Bresler (1960) · PCA Notes §12.7.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeFlexionBiaxialLive,
  buildFlexionBiaxialSteps,
  buildFlexionBiaxialChecks,
  type FlexionBiaxialInput,
  type FlexionBiaxialResult,
} from "@/lib/flexion-biaxial-live";

const DEFAULT: FlexionBiaxialInput = {
  shape: "rect",
  b_cm: 40,
  h_cm: 40,
  D_cm: 50,
  r_cm: 4,
  nBars: 8,
  barSize: 7,
  dist: "perimetro",
  fc: 280,
  fy: 4200,
  Pu_ton: 100,
  Mux_tonm: 10,
  Muy_tonm: 6,
};

function BiaxialDiagram({ r }: { r: FlexionBiaxialResult }) {
  const W = 480, H = 320;
  const margin = 50;
  const cx = W / 2;
  const cy = H / 2 + 20;
  const Mxmax = Math.max(r.phiMnx0_tonm, r.Mux, 0.001);
  const Mymax = Math.max(r.phiMny0_tonm, r.Muy, 0.001);
  const scale = (W / 2 - margin) / Math.max(Mxmax, Mymax);
  // contour curve: (Mx/phiMnx0)^α + (My/phiMny0)^α = 1
  const pts: string[] = [];
  const N = 80;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * (Math.PI / 2);
    // Param: Mx = phiMnx0 · cos²/α(t) ... use brute force solve along contour
    // Use polar param: Mx = phiMnx0·u^(1/α), My = phiMny0·(1-u)^(1/α)
    const u = i / N;
    const Mx_norm = Math.pow(u, 1 / r.alpha);
    const My_norm = Math.pow(1 - u, 1 / r.alpha);
    const Mx = Mx_norm * r.phiMnx0_tonm;
    const My = My_norm * r.phiMny0_tonm;
    const px = cx + Mx * scale;
    const py = cy - My * scale;
    pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const xPt = cx + r.Mux * scale;
  const yPt = cy - r.Muy * scale;
  const inside = r.contour_value <= 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
      <text x={margin} y={20} fill="#a1a1aa" fontSize="11" fontFamily="ui-monospace, monospace">
        Bresler load contour — α = {r.alpha.toFixed(3)}
      </text>
      {/* axes */}
      <line x1={margin} y1={cy} x2={W - margin} y2={cy} stroke="#52525b" strokeWidth="0.6" />
      <line x1={cx} y1={margin} x2={cx} y2={H - margin} stroke="#52525b" strokeWidth="0.6" />
      <text x={W - margin - 4} y={cy - 6} fill="#a1a1aa" fontSize="10">Mux</text>
      <text x={cx + 6} y={margin + 4} fill="#a1a1aa" fontSize="10">Muy</text>
      {/* envelope */}
      <polyline points={pts.join(" ")} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
      {/* axis caps */}
      <text x={cx + r.phiMnx0_tonm * scale + 4} y={cy + 14} fill="#f59e0b" fontSize="9" fontFamily="ui-monospace, monospace">
        φMnx0 = {r.phiMnx0_tonm.toFixed(1)}
      </text>
      <text x={cx + 6} y={cy - r.phiMny0_tonm * scale} fill="#f59e0b" fontSize="9" fontFamily="ui-monospace, monospace">
        φMny0 = {r.phiMny0_tonm.toFixed(1)}
      </text>
      {/* load point */}
      <circle cx={xPt} cy={yPt} r={5} fill={inside ? "#10b981" : "#ef4444"} stroke="#fff" strokeWidth="1" />
      <text x={xPt + 8} y={yPt + 4} fill={inside ? "#10b981" : "#ef4444"} fontSize="10" fontFamily="ui-monospace, monospace">
        (Mux={r.Mux.toFixed(1)}, Muy={r.Muy.toFixed(1)})
      </text>
      <text x={margin} y={H - 12} fill={inside ? "#10b981" : "#ef4444"} fontSize="10" fontFamily="ui-monospace, monospace">
        contour = {r.contour_value.toFixed(3)} {inside ? "≤ 1 OK" : "> 1 FALLA"}
      </text>
      <text x={W - margin} y={H - 12} textAnchor="end" fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
        Bresler recíproco: φPn = {r.phiPn_recip_ton.toFixed(1)} ton
      </text>
    </svg>
  );
}

export default function FlexionBiaxialPage() {
  const [input, setInput] = useState<FlexionBiaxialInput>(DEFAULT);
  const { meta, projectName } = useProjectContext();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!meta || prefilledRef.current) return;
    prefilledRef.current = true;
    setInput((p) => ({
      ...p,
      fc: meta.fc_default ?? p.fc,
      fy: meta.fy_default ?? p.fy,
    }));
  }, [meta]);
  const result = useMemo(() => computeFlexionBiaxialLive(input), [input]);
  const steps = useMemo(() => buildFlexionBiaxialSteps(result), [result]);
  const checks = useMemo(() => buildFlexionBiaxialChecks(result), [result]);

  function up<K extends keyof FlexionBiaxialInput>(k: K, v: FlexionBiaxialInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Flexión biaxial — columna"
      subtitle="Bresler recíproco + load contour. ACI 318-14 §22.4 · PCA Notes §12.7."
      stepPrefix="biaxial."
      referencesBundle="column"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Flexión biaxial ${input.shape} ${input.shape === "rect" ? `${input.b_cm}×${input.h_cm}` : `Ø${input.D_cm}`} cm`,
          elementType: "biaxial_column",
          fc: input.fc,
          fy: input.fy,
          inputs: [
            { name: "Sección", value: input.shape },
            { name: "b", value: input.b_cm, unit: "cm" },
            { name: "h", value: input.h_cm, unit: "cm" },
            { name: "D", value: input.D_cm, unit: "cm" },
            { name: "# barras", value: input.nBars },
            { name: "tamaño", value: `#${input.barSize}` },
            { name: "Pu", value: input.Pu_ton, unit: "ton" },
            { name: "Mux", value: input.Mux_tonm, unit: "ton·m" },
            { name: "Muy", value: input.Muy_tonm, unit: "ton·m" },
            { name: "φPn0", value: result.phiPn0_ton, unit: "ton" },
            { name: "φPn (recip)", value: result.phiPn_recip_ton, unit: "ton" },
            { name: "contour", value: result.contour_value },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "FB-1 — Diagrama de interacción Mx-My", element: <BiaxialDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="flexion-biaxial"
          buildPayload={() => ({
            archJson: { project_name: projectName ?? "Diseño" },
            structJson: { ...input },
            resultJson: {
              ...result,
              summary: {
                total_elements: 1,
                passing: checks.every((c) => c.cumple) ? 1 : 0,
                requires_review: 0,
                with_errors: 0,
              },
            },
          })}
        />
      }
      inputs={
        <>
          <InputCard label="Tipo de columna">
            <select className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.shape}
              onChange={(e) => up("shape", e.target.value as "rect" | "circ")}>
              <option value="rect">Rectangular</option>
              <option value="circ">Circular</option>
            </select>
          </InputCard>

          {input.shape === "rect" ? (
            <InputCard label="Geometría rectangular (cm)">
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="b" unit="cm" value={input.b_cm} onChange={(v) => up("b_cm", v)} step={5} />
                <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} step={5} />
                <NumberField label="r recubr." unit="cm" value={input.r_cm} onChange={(v) => up("r_cm", v)} step={0.5} />
              </div>
            </InputCard>
          ) : (
            <InputCard label="Geometría circular (cm)">
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="D" unit="cm" value={input.D_cm} onChange={(v) => up("D_cm", v)} step={5} />
                <NumberField label="r recubr." unit="cm" value={input.r_cm} onChange={(v) => up("r_cm", v)} step={0.5} />
              </div>
            </InputCard>
          )}

          <InputCard label="Refuerzo longitudinal">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="# barras" value={input.nBars} onChange={(v) => up("nBars", v)} step={1} />
              <NumberField label="tamaño (#)" value={input.barSize} onChange={(v) => up("barSize", v)} step={1} />
            </div>
            <select className="w-full mt-2 bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.dist}
              onChange={(e) => up("dist", e.target.value as FlexionBiaxialInput["dist"])}>
              <option value="perimetro">Distribuido perímetro</option>
              <option value="esquinas">Solo 4 esquinas</option>
              <option value="distribuida">Distribuida en caras</option>
            </select>
          </InputCard>

          <InputCard label="Solicitaciones últimas">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Pu" unit="ton" value={input.Pu_ton} onChange={(v) => up("Pu_ton", v)} step={5} source="loads" />
              <NumberField label="Mux" unit="ton·m" value={input.Mux_tonm} onChange={(v) => up("Mux_tonm", v)} step={0.5} source="loads" />
              <NumberField label="Muy" unit="ton·m" value={input.Muy_tonm} onChange={(v) => up("Muy_tonm", v)} step={0.5} source="loads" />
            </div>
          </InputCard>

          <InputCard label="Materiales">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="f'c" unit="kg/cm²" value={input.fc} onChange={(v) => up("fc", v)} step={5} />
              <NumberField label="fy" unit="kg/cm²" value={input.fy} onChange={(v) => up("fy", v)} step={100} />
            </div>
          </InputCard>
        </>
      }
      steps={steps}
      checks={checks}
      reinforcement={
        <>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              Diagrama de interacción biaxial (corte Mx-My a Pu fijo)
            </div>
            <ExpandableDiagram title="Flexión biaxial">
              <BiaxialDiagram r={result} />
            </ExpandableDiagram>
          </div>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Resumen</div>
            <div className="text-zinc-300">Pn0 = {result.Pn0_ton.toFixed(1)} ton · φPn0 = {result.phiPn0_ton.toFixed(1)} ton</div>
            <div className="text-zinc-300">φMnx0 = {result.phiMnx0_tonm.toFixed(2)} ton·m (a Pu)</div>
            <div className="text-zinc-300">φMny0 = {result.phiMny0_tonm.toFixed(2)} ton·m (a Pu)</div>
            <div className="text-zinc-300">ρg = {(result.rho_g * 100).toFixed(2)}%</div>
            <div className="text-zinc-300">ex = {result.ex_cm.toFixed(1)} cm · ey = {result.ey_cm.toFixed(1)} cm</div>
            <div className={result.bresler_recip_ok ? "text-emerald-400" : "text-red-400"}>
              Bresler recíproco: {result.bresler_recip_ok ? "OK" : "FALLA"}
            </div>
            <div className={result.bresler_contour_ok ? "text-emerald-400" : "text-red-400"}>
              Bresler contour: {result.bresler_contour_ok ? "OK" : "FALLA"} ({result.contour_value.toFixed(3)})
            </div>
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>ACI 318-14 §22.4 — Axial strength of compression members.</li>
              <li>ACI 318-14 §10.3.6.2 — Biaxial bending in compression members.</li>
              <li>Bresler, B. (1960) — Reciprocal load + load contour methods.</li>
              <li>PCA Notes on ACI 318 §12.7 — α from As/Ag ratio.</li>
              <li>Park & Paulay (1975), Reinforced Concrete Structures §5.4.</li>
              <li>MacGregor (2009), Reinforced Concrete §11.6.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
