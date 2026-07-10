"use client";

/**
 * /studio/lintel — dintel sobre vano.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { LintelDiagramSet, LintelElevation } from "@/components/studio/MoreDiagrams";
import { ReinforcementTable } from "@/components/studio/ReinforcementTable";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeLintelLive, buildLintelSteps, buildLintelChecks,
  type LintelInput,
} from "@/lib/lintel-live";

const DEFAULT: LintelInput = {
  a_cm: 120, b_cm: 15, h_cm: 25,
  Mu_tonm: 0.45, Vu_ton: 0.9,
  fc: 245, fy: 4200, zona: 3, r_cm: 4,
};

export default function LintelPage() {
  const [input, setInput] = useState<LintelInput>(DEFAULT);
  const { meta, projectName } = useProjectContext();
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!meta || prefilledRef.current) return;
    prefilledRef.current = true;
    setInput((p) => ({
      ...p,
      fc: meta.fc_default ?? p.fc,
      fy: meta.fy_default ?? p.fy,
      zona: (meta.zonaSismica as 1 | 2 | 3 | 4) ?? p.zona,
    }));
  }, [meta]);
  const result = useMemo(() => computeLintelLive(input), [input]);
  const steps = useMemo(() => buildLintelSteps(result), [result]);
  const checks = useMemo(() => buildLintelChecks(result), [result]);

  function up<K extends keyof LintelInput>(k: K, v: LintelInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Dintel"
      subtitle="Viga pequeña sobre vano. Si a/d < 2 → viga profunda (puntal-tensor)."
      stepPrefix="lintel."
      referencesBundle="lintel"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Dintel a=${input.a_cm} cm`,
          elementType: "lintel",
          zonaSismica: input.zona, fc: input.fc, fy: input.fy,
          inputs: [
            { name: "a (luz)", value: input.a_cm, unit: "cm" },
            { name: "b", value: input.b_cm, unit: "cm" },
            { name: "h", value: input.h_cm, unit: "cm" },
            { name: "Mu", value: input.Mu_tonm, unit: "ton-m" },
            { name: "Vu", value: input.Vu_ton, unit: "ton" },
          ],
          steps, checks,
          reinforcement: result.deepBeam ? undefined : {
            longitudinal: [
              { n: result.n, size: result.size, As_total: result.As_prov, position: "Inferior" },
              { n: 2, size: 4, As_total: 2 * 1.27, position: "Superior mínimo" },
            ],
            transversal: [{ size: 3, separacion_cm: 15, zona: "Toda la longitud", ramas: 2 }],
          },
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "LT-1 — Elevación sobre vano", element: <LintelElevation r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="lintel"
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
          <InputCard label="Geometría">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="a (luz)" unit="cm" value={input.a_cm} onChange={(v) => up("a_cm", v)} />
              <NumberField label="b" unit="cm" value={input.b_cm} onChange={(v) => up("b_cm", v)} />
              <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} />
              <NumberField label="recubrim." unit="cm" value={input.r_cm}
                onChange={(v) => up("r_cm", v)} step={0.5} />
            </div>
          </InputCard>
          <InputCard label="Cargas">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Mu" unit="ton-m" value={input.Mu_tonm}
                onChange={(v) => up("Mu_tonm", v)} step={0.05} />
              <NumberField label="Vu" unit="ton" value={input.Vu_ton}
                onChange={(v) => up("Vu_ton", v)} step={0.05} />
            </div>
          </InputCard>
          <InputCard label="Materiales y zona">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="f'c" unit="kg/cm²" value={input.fc} onChange={(v) => up("fc", v)} step={5} />
              <NumberField label="fy" unit="kg/cm²" value={input.fy} onChange={(v) => up("fy", v)} step={100} />
            </div>
            <select className="w-full mt-2 bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
              value={input.zona}
              onChange={(e) => up("zona", parseInt(e.target.value) as 1 | 2 | 3 | 4)}>
              <option value={1}>Zona I</option><option value={2}>Zona II</option>
              <option value={3}>Zona III</option><option value={4}>Zona IV</option>
            </select>
          </InputCard>
        </>
      }
      steps={steps}
      checks={checks}
      reinforcement={
        <>
          <LintelDiagramSet r={result} />
          {!result.deepBeam && (
            <ReinforcementTable
              longitudinal={[
                { n: result.n, size: result.size, As_total: result.As_prov,
                  position: "Inferior" },
                { n: 2, size: 4, As_total: 2 * 1.27, position: "Superior mínimo" },
              ]}
              transversal={[
                { size: 3, separacion_cm: 15, zona: "Toda la longitud", ramas: 2 },
              ]}
            />
          )}

          {/* Sub-banner: Deep beam detection (Ln/d < 4 per spec) */}
          {result.a_d_ratio < 4 && result.a_d_ratio > 0 && (
            <div className="border border-red-700/60 rounded-lg p-3 bg-red-900/20 mt-3 flex items-center justify-between gap-3">
              <div className="text-sm text-red-200">
                <div className="font-semibold">
                  ⚠️ Esta viga es profunda — Ln/d = {result.a_d_ratio.toFixed(2)} &lt; 4
                </div>
                <div className="text-xs text-red-300/80 mt-1">
                  El modelo flexural convencional no captura la transferencia de carga por puntales. Usar modelo strut-and-tie (ACI §23).
                </div>
              </div>
              <a
                href="/studio/strut-tie"
                className="shrink-0 text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-zinc-50 font-bold whitespace-nowrap"
              >
                Usar strut-and-tie →
              </a>
            </div>
          )}
        </>
      }
    />
  );
}
