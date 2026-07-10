"use client";

/**
 * /studio/strut-tie — Strut-and-tie completo (ménsula + viga profunda + cabezal).
 * ACI 318-14 §23 + §16.5 (corbel) + §9.9 (deep beam) + §13.4 (pile cap).
 * Schlaich Schäfer Jennewein (1987). MacGregor §17.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { ExpandableDiagram } from "@/components/studio/DiagramExpand";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeStrutTieLive,
  buildStrutTieSteps,
  buildStrutTieChecks,
  type StrutTieInput,
  type StrutTieResult,
} from "@/lib/strut-tie-live";

const DEFAULT: StrutTieInput = {
  tipo: "corbel",
  b_cm: 40,
  h_cm: 50,
  d_cm: 44,
  avu_cm: 15,
  Vu_corbel_ton: 30,
  Nu_corbel_ton: 6,
  Ln_m: 2.5,
  Pu_top_ton: 80,
  a_load_m: 0.8,
  Pu_col_ton: 200,
  pile_spacing_m: 1.5,
  n_piles: 2,
  fc: 280,
  fy: 4200,
};

function StrutTieDiagram({ r }: { r: StrutTieResult }) {
  const W = 480, H = 340;
  // Three sub-diagrams depending on tipo
  const cx = W / 2;
  if (r.tipo === "corbel") {
    // Column on left + corbel cantilever on right
    const colW = 60, colH = 200;
    const colX = 80, colY = 60;
    const corbelW = r.avu * 2;
    const corbelH = 80;
    const corbelX = colX + colW;
    const corbelY = colY + 30;
    const loadX = corbelX + corbelW - 10;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
        <text x={20} y={20} fill="#a1a1aa" fontSize="11" fontFamily="ui-monospace, monospace">
          Ménsula (corbel) — ACI 318-14 §16.5 + §23
        </text>
        {/* Column */}
        <rect x={colX} y={colY} width={colW} height={colH} fill="#27272a" stroke="#a1a1aa" strokeWidth="1.2" />
        {/* Corbel */}
        <polygon points={`${corbelX},${corbelY} ${corbelX + corbelW},${corbelY} ${corbelX + corbelW},${corbelY + corbelH * 0.6} ${corbelX},${corbelY + corbelH}`}
          fill="#27272a" stroke="#a1a1aa" strokeWidth="1.2" />
        {/* Tie (top horizontal) */}
        <line x1={colX + 5} y1={corbelY + 12} x2={corbelX + corbelW - 6} y2={corbelY + 12}
          stroke="#10b981" strokeWidth="3" />
        <text x={(colX + corbelX + corbelW) / 2} y={corbelY + 6} textAnchor="middle" fill="#10b981" fontSize="10" fontFamily="ui-monospace, monospace">
          Tirante T = {r.F_tie_ton.toFixed(1)} t
        </text>
        {/* Strut (diagonal from load to bottom of column) */}
        <line x1={loadX} y1={corbelY + 15} x2={colX + colW - 10} y2={colY + colH - 30}
          stroke="#f59e0b" strokeWidth="3" />
        <text x={loadX - 60} y={(corbelY + colY + colH) / 2 + 10} fill="#f59e0b" fontSize="10" fontFamily="ui-monospace, monospace">
          Puntal {r.F_strut_ton.toFixed(1)} t
        </text>
        {/* Load arrow */}
        <line x1={loadX} y1={corbelY - 30} x2={loadX} y2={corbelY + 10}
          stroke="#ef4444" strokeWidth="2" markerEnd="url(#st-arr)" />
        <text x={loadX + 4} y={corbelY - 18} fill="#ef4444" fontSize="11" fontFamily="ui-monospace, monospace">
          Vu = {r.Vu_corbel.toFixed(0)} t
        </text>
        {/* theta */}
        <text x={colX + colW + 6} y={corbelY + corbelH + 18} fill="#fbbf24" fontSize="10" fontFamily="ui-monospace, monospace">
          θ = {r.theta_deg.toFixed(1)}°
        </text>
        {/* CCT node label */}
        <circle cx={colX + colW - 5} cy={corbelY + 12} r={6} fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="2,2" />
        <text x={colX - 8} y={corbelY + 4} fill="#10b981" fontSize="9" fontFamily="ui-monospace, monospace">
          Nodo {r.node_type}
        </text>

        <text x={20} y={H - 30} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
          φFns = {r.phi_Fns_ton.toFixed(1)} t · φFnn = {r.phi_Fnn_ton.toFixed(1)} t · As tirante = {r.As_tie_req_cm2.toFixed(2)} cm²
        </text>
        <text x={20} y={H - 14} fill={r.strut_ok && r.node_ok ? "#10b981" : "#ef4444"} fontSize="11" fontFamily="ui-monospace, monospace">
          {r.strut_ok && r.node_ok ? "OK" : "FALLA"} · Avf shear-friction = {r.Avf_cm2.toFixed(2)} cm²
        </text>
        <defs>
          <marker id="st-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#ef4444" />
          </marker>
        </defs>
      </svg>
    );
  } else if (r.tipo === "deep_beam") {
    const beamX = 50, beamY = 80, beamL = W - 100, beamH = 180;
    const a_norm = r.a_load / r.Ln;
    const loadX = beamX + a_norm * beamL;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
        <text x={20} y={20} fill="#a1a1aa" fontSize="11" fontFamily="ui-monospace, monospace">
          Viga profunda — ACI 318-14 §9.9 + §23
        </text>
        <rect x={beamX} y={beamY} width={beamL} height={beamH} fill="#27272a" stroke="#a1a1aa" strokeWidth="1.2" />
        {/* Bottom tie */}
        <line x1={beamX + 5} y1={beamY + beamH - 15} x2={beamX + beamL - 5} y2={beamY + beamH - 15}
          stroke="#10b981" strokeWidth="3" />
        <text x={beamX + beamL / 2} y={beamY + beamH - 18} textAnchor="middle" fill="#10b981" fontSize="10" fontFamily="ui-monospace, monospace">
          Tirante T = {r.F_tie_ton.toFixed(1)} t
        </text>
        {/* Struts: from load point down to each support */}
        <line x1={loadX} y1={beamY + 10} x2={beamX + 10} y2={beamY + beamH - 12}
          stroke="#f59e0b" strokeWidth="3" />
        <line x1={loadX} y1={beamY + 10} x2={beamX + beamL - 10} y2={beamY + beamH - 12}
          stroke="#f59e0b" strokeWidth="3" />
        <text x={beamX + 30} y={beamY + beamH / 2 + 15} fill="#f59e0b" fontSize="10" fontFamily="ui-monospace, monospace">
          Puntal {r.F_strut_ton.toFixed(1)} t
        </text>
        {/* Load */}
        <line x1={loadX} y1={beamY - 30} x2={loadX} y2={beamY + 6}
          stroke="#ef4444" strokeWidth="2" markerEnd="url(#st-arr)" />
        <text x={loadX + 4} y={beamY - 18} fill="#ef4444" fontSize="11" fontFamily="ui-monospace, monospace">
          Pu = {r.Pu_top.toFixed(0)} t
        </text>
        {/* Supports */}
        <polygon points={`${beamX + 5},${beamY + beamH} ${beamX - 5},${beamY + beamH + 12} ${beamX + 15},${beamY + beamH + 12}`} fill="#a1a1aa" />
        <polygon points={`${beamX + beamL - 5},${beamY + beamH} ${beamX + beamL - 15},${beamY + beamH + 12} ${beamX + beamL + 5},${beamY + beamH + 12}`} fill="#a1a1aa" />
        <text x={beamX} y={H - 60} fill="#fbbf24" fontSize="10" fontFamily="ui-monospace, monospace">
          Ln/d = {((r.Ln * 100) / r.d).toFixed(2)} (deep si {"<"} 4) · θ = {r.theta_deg.toFixed(1)}°
        </text>
        <text x={20} y={H - 30} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
          φFns = {r.phi_Fns_ton.toFixed(1)} t · As tirante = {r.As_tie_req_cm2.toFixed(2)} cm² · ρv min 0.25%
        </text>
        <text x={20} y={H - 14} fill={r.strut_ok && r.node_ok ? "#10b981" : "#ef4444"} fontSize="11" fontFamily="ui-monospace, monospace">
          {r.strut_ok && r.node_ok ? "OK" : "FALLA"} · θ = {r.theta_deg.toFixed(1)}°
        </text>
        <defs>
          <marker id="st-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#ef4444" />
          </marker>
        </defs>
      </svg>
    );
  } else {
    // pile cap
    const capX = 70, capY = 80, capW = W - 140, capH = 120;
    const colW = 50;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950 rounded">
        <text x={20} y={20} fill="#a1a1aa" fontSize="11" fontFamily="ui-monospace, monospace">
          Cabezal de pilotes — ACI 318-14 §13.4 + §23
        </text>
        {/* Cap */}
        <rect x={capX} y={capY} width={capW} height={capH} fill="#27272a" stroke="#a1a1aa" strokeWidth="1.2" />
        {/* Column on top */}
        <rect x={cx - colW / 2} y={capY - 60} width={colW} height={60} fill="#3f3f46" stroke="#a1a1aa" strokeWidth="1.2" />
        <line x1={cx} y1={capY - 90} x2={cx} y2={capY - 70} stroke="#ef4444" strokeWidth="2" markerEnd="url(#st-arr)" />
        <text x={cx + 4} y={capY - 76} fill="#ef4444" fontSize="11" fontFamily="ui-monospace, monospace">
          Pu = {r.Pu_col.toFixed(0)} t
        </text>
        {/* Piles */}
        {Array.from({ length: r.n_piles }).map((_, i) => {
          const px = capX + (i + 1) * (capW / (r.n_piles + 1));
          return (
            <g key={i}>
              <rect x={px - 15} y={capY + capH} width={30} height={80} fill="#52525b" stroke="#a1a1aa" strokeWidth="1" />
              <line x1={cx} y1={capY + 20} x2={px} y2={capY + capH - 5}
                stroke="#f59e0b" strokeWidth="3" />
              <text x={px} y={capY + capH + 60} textAnchor="middle" fill="#a1a1aa" fontSize="9" fontFamily="ui-monospace, monospace">
                R = {(r.Pu_col / r.n_piles).toFixed(1)} t
              </text>
            </g>
          );
        })}
        {/* Tirante en la base del cabezal */}
        <line x1={capX + 10} y1={capY + capH - 15} x2={capX + capW - 10} y2={capY + capH - 15}
          stroke="#10b981" strokeWidth="3" />
        <text x={cx} y={capY + capH - 22} textAnchor="middle" fill="#10b981" fontSize="10" fontFamily="ui-monospace, monospace">
          T = {r.F_tie_ton.toFixed(1)} t
        </text>
        <text x={cx} y={capY + capH / 2 - 20} textAnchor="middle" fill="#f59e0b" fontSize="10" fontFamily="ui-monospace, monospace">
          Puntal {r.F_strut_ton.toFixed(1)} t (cada pilote)
        </text>
        <text x={20} y={H - 30} fill="#a1a1aa" fontSize="10" fontFamily="ui-monospace, monospace">
          φFns = {r.phi_Fns_ton.toFixed(1)} t · As tirante = {r.As_tie_req_cm2.toFixed(2)} cm² · θ = {r.theta_deg.toFixed(1)}°
        </text>
        <text x={20} y={H - 14} fill={r.strut_ok && r.node_ok ? "#10b981" : "#ef4444"} fontSize="11" fontFamily="ui-monospace, monospace">
          {r.strut_ok && r.node_ok ? "OK" : "FALLA"}
        </text>
        <defs>
          <marker id="st-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#ef4444" />
          </marker>
        </defs>
      </svg>
    );
  }
}

export default function StrutTiePage() {
  const [input, setInput] = useState<StrutTieInput>(DEFAULT);
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
  const result = useMemo(() => computeStrutTieLive(input), [input]);
  const steps = useMemo(() => buildStrutTieSteps(result), [result]);
  const checks = useMemo(() => buildStrutTieChecks(result), [result]);

  function up<K extends keyof StrutTieInput>(k: K, v: StrutTieInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Strut-and-tie completo"
      subtitle="Ménsula + viga profunda + cabezal de pilotes. ACI 318-14 §23 · Schlaich et al. (1987)."
      stepPrefix="strut."
      referencesBundle="beam"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Strut-tie ${input.tipo}`,
          elementType: "strut_and_tie",
          fc: input.fc,
          fy: input.fy,
          inputs: [
            { name: "Tipo", value: input.tipo },
            { name: "b", value: input.b_cm, unit: "cm" },
            { name: "h", value: input.h_cm, unit: "cm" },
            { name: "d", value: input.d_cm, unit: "cm" },
            { name: "θ", value: result.theta_deg, unit: "°" },
            { name: "F strut", value: result.F_strut_ton, unit: "ton" },
            { name: "T tie", value: result.F_tie_ton, unit: "ton" },
            { name: "As tie", value: result.As_tie_req_cm2, unit: "cm²" },
            { name: "φFns", value: result.phi_Fns_ton, unit: "ton" },
            { name: "φFnn", value: result.phi_Fnn_ton, unit: "ton" },
          ],
          steps,
          checks,
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "ST-1 — Modelo de bielas y tirantes", element: <StrutTieDiagram r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="strut-tie"
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
          <InputCard label="Tipo de elemento">
            <select className="w-full bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.tipo}
              onChange={(e) => up("tipo", e.target.value as StrutTieInput["tipo"])}>
              <option value="corbel">Ménsula (corbel)</option>
              <option value="deep_beam">Viga profunda</option>
              <option value="pile_cap">Cabezal de pilotes</option>
            </select>
          </InputCard>

          <InputCard label="Geometría (cm)">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="b" unit="cm" value={input.b_cm} onChange={(v) => up("b_cm", v)} step={5} />
              <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} step={5} />
              <NumberField label="d" unit="cm" value={input.d_cm} onChange={(v) => up("d_cm", v)} step={1} />
            </div>
          </InputCard>

          {input.tipo === "corbel" && (
            <InputCard label="Ménsula">
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="avu (proy.)" unit="cm" value={input.avu_cm} onChange={(v) => up("avu_cm", v)} step={1} />
                <NumberField label="Vu" unit="ton" value={input.Vu_corbel_ton} onChange={(v) => up("Vu_corbel_ton", v)} step={1} source="loads" />
                <NumberField label="Nu (horizontal)" unit="ton" value={input.Nu_corbel_ton} onChange={(v) => up("Nu_corbel_ton", v)} step={0.5} source="loads" />
              </div>
            </InputCard>
          )}

          {input.tipo === "deep_beam" && (
            <InputCard label="Viga profunda">
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Ln" unit="m" value={input.Ln_m} onChange={(v) => up("Ln_m", v)} step={0.25} />
                <NumberField label="Pu (top)" unit="ton" value={input.Pu_top_ton} onChange={(v) => up("Pu_top_ton", v)} step={5} source="loads" />
                <NumberField label="a (cara-carga)" unit="m" value={input.a_load_m} onChange={(v) => up("a_load_m", v)} step={0.1} />
              </div>
            </InputCard>
          )}

          {input.tipo === "pile_cap" && (
            <InputCard label="Cabezal">
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Pu col." unit="ton" value={input.Pu_col_ton} onChange={(v) => up("Pu_col_ton", v)} step={5} source="loads" />
                <NumberField label="s pilotes" unit="m" value={input.pile_spacing_m} onChange={(v) => up("pile_spacing_m", v)} step={0.1} />
                <NumberField label="# pilotes" value={input.n_piles} onChange={(v) => up("n_piles", v)} step={1} />
              </div>
            </InputCard>
          )}

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
              Modelo strut-and-tie
            </div>
            <ExpandableDiagram title="Strut-and-tie">
              <StrutTieDiagram r={result} />
            </ExpandableDiagram>
          </div>
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Refuerzo</div>
            <div className="text-zinc-300">θ del puntal = {result.theta_deg.toFixed(1)}°</div>
            <div className="text-zinc-300">F puntal = {result.F_strut_ton.toFixed(1)} ton · F tirante = {result.F_tie_ton.toFixed(1)} ton</div>
            <div className="text-zinc-300">As tirante (req) = {result.As_tie_req_cm2.toFixed(2)} cm²</div>
            <div className="text-zinc-300">φFns puntal = {result.phi_Fns_ton.toFixed(1)} ton (βs = {result.beta_s})</div>
            <div className="text-zinc-300">φFnn nodo = {result.phi_Fnn_ton.toFixed(1)} ton ({result.node_type}, βn = {result.beta_n})</div>
            <div className="text-zinc-300">ρv min = 0.25% · ρh min = 0.15%</div>
            {result.tipo === "corbel" && (
              <div className="text-zinc-300">Avf shear-friction = {result.Avf_cm2.toFixed(2)} cm² (μ = 1.4)</div>
            )}
          </div>
          <details className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30 text-xs text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">Referencias</summary>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>ACI 318-14 §23 — Strut-and-tie method (struts, ties, nodes, βs, βn).</li>
              <li>ACI 318-14 §16.5 — Brackets and corbels (Avf shear-friction).</li>
              <li>ACI 318-14 §9.9 — Deep beams (Ln/d {"<"} 4).</li>
              <li>ACI 318-14 §13.4 — Pile caps and footings on piles.</li>
              <li>Schlaich, Schäfer, Jennewein (1987), PCI Journal V.32 No.3.</li>
              <li>MacGregor (2009), Reinforced Concrete §17.</li>
              <li>ACI 445R-99 — Shear in structural concrete.</li>
            </ul>
          </details>
        </>
      }
    />
  );
}
