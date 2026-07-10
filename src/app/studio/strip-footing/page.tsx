"use client";

/**
 * /studio/strip-footing — zapata corrida bajo muro lineal.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { StripFootingDiagramSet, StripSeccion, StripPressure } from "@/components/studio/MoreDiagrams";
import { ReinforcementTable } from "@/components/studio/ReinforcementTable";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeStripFootingLive, buildStripFootingSteps, buildStripFootingChecks,
  stripFootingTempBars, type StripFootingInput,
} from "@/lib/strip-footing-live";

const DEFAULT: StripFootingInput = {
  B_m: 0.9, h_cm: 35, bMuro_cm: 15,
  Pu_lineal_ton_m: 10, qa_ton_m2: 15,
  fc: 245, fy: 4200, zona: 3, r_cm: 7.5,
};

export default function StripFootingPage() {
  const [input, setInput] = useState<StripFootingInput>(DEFAULT);
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
      qa_ton_m2: meta.qa_ton_m2 ?? p.qa_ton_m2,
    }));
  }, [meta]);
  const result = useMemo(() => computeStripFootingLive(input), [input]);
  const steps = useMemo(() => buildStripFootingSteps(result), [result]);
  const checks = useMemo(() => buildStripFootingChecks(result), [result]);
  const temp = stripFootingTempBars(result.As_temp);

  function up<K extends keyof StripFootingInput>(k: K, v: StripFootingInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Zapata corrida"
      subtitle="Cimiento continuo bajo muro. ACI 318-14 §13. Diseño por metro lineal."
      stepPrefix="strip_ftg."
      referencesBundle="footing"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Zapata corrida B=${input.B_m} m`,
          elementType: "strip_footing",
          zonaSismica: input.zona, fc: input.fc, fy: input.fy,
          inputs: [
            { name: "B", value: input.B_m, unit: "m" },
            { name: "h", value: input.h_cm, unit: "cm" },
            { name: "b muro", value: input.bMuro_cm, unit: "cm" },
            { name: "Pu lineal", value: input.Pu_lineal_ton_m, unit: "ton/m" },
            { name: "qa (estudio suelos)", value: input.qa_ton_m2, unit: "ton/m²" },
          ],
          steps, checks,
          reinforcement: {
            longitudinal: [{ n: result.n, size: result.size, As_total: result.As_prov,
              position: `Transversal sep ${result.s.toFixed(1)} cm` }],
          },
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "SF-1 — Sección", element: <StripSeccion r={result} /> },
            { title: "SF-2 — Reacción del suelo", element: <StripPressure r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="strip-footing"
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
              <NumberField label="B" unit="m" value={input.B_m} onChange={(v) => up("B_m", v)} step={0.05} />
              <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} />
              <NumberField label="b muro" unit="cm" value={input.bMuro_cm} onChange={(v) => up("bMuro_cm", v)} />
              <NumberField label="recubrim." unit="cm" value={input.r_cm} onChange={(v) => up("r_cm", v)} step={0.5} />
            </div>
          </InputCard>
          <InputCard label="Cargas">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Pu lineal" unit="ton/m" value={input.Pu_lineal_ton_m}
                onChange={(v) => up("Pu_lineal_ton_m", v)} step={0.5} source="loads" />
              <NumberField label="qa adm" unit="ton/m²" value={input.qa_ton_m2}
                onChange={(v) => up("qa_ton_m2", v)} step={1} source="soil" />
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
          <StripFootingDiagramSet r={result} />
          <ReinforcementTable
            longitudinal={[
              { n: result.n, size: result.size, As_total: result.As_prov,
                position: `Transversal. Sep ${result.s.toFixed(1)} cm` },
              { n: temp.n, size: temp.size, As_total: temp.As_total,
                position: "Longitudinal por retracción y temperatura" },
            ]}
          />
        </>
      }
    />
  );
}
