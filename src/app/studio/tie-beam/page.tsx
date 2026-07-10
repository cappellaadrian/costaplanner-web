"use client";

/**
 * /studio/tie-beam — viga de amarre sísmica. CSCR §18.12.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { TieBeamDiagramSet, TieBeamSection, TieBeamPlan } from "@/components/studio/MoreDiagrams";
import { ReinforcementTable } from "@/components/studio/ReinforcementTable";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeTieBeamLive, buildTieBeamSteps, buildTieBeamChecks,
  type TieBeamInput,
} from "@/lib/tie-beam-live";

const DEFAULT: TieBeamInput = {
  b_cm: 20, h_cm: 40, L_m: 4.0,
  Pu_zapata_max_ton: 80,
  fc: 245, fy: 4200, zona: 3,
};

export default function TieBeamPage() {
  const [input, setInput] = useState<TieBeamInput>(DEFAULT);
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
  const result = useMemo(() => computeTieBeamLive(input), [input]);
  const steps = useMemo(() => buildTieBeamSteps(result), [result]);
  const checks = useMemo(() => buildTieBeamChecks(result), [result]);

  function up<K extends keyof TieBeamInput>(k: K, v: TieBeamInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Viga de amarre"
      subtitle="CSCR §18.12. Conecta zapatas para resistir tracción sísmica entre cimientos."
      stepPrefix="tie_beam."
      referencesBundle="beam"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Viga de amarre ${input.b_cm}×${input.h_cm} cm`,
          elementType: "tie_beam",
          zonaSismica: input.zona, fc: input.fc, fy: input.fy,
          inputs: [
            { name: "b", value: input.b_cm, unit: "cm" },
            { name: "h", value: input.h_cm, unit: "cm" },
            { name: "L", value: input.L_m, unit: "m" },
            { name: "Pu zapata max", value: input.Pu_zapata_max_ton, unit: "ton" },
          ],
          steps, checks,
          reinforcement: {
            longitudinal: [
              { n: 2, size: 5, As_total: 2 * 1.99, position: "Superior" },
              { n: 2, size: 5, As_total: 2 * 1.99, position: "Inferior" },
            ],
            transversal: [{ size: 3, separacion_cm: 20, zona: "Toda la longitud", ramas: 2 }],
          },
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "TB-1 — Sección transversal", element: <TieBeamSection r={result} /> },
            { title: "TB-2 — Plan cimentación", element: <TieBeamPlan r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="tie-beam"
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
              <NumberField label="b" unit="cm" value={input.b_cm} onChange={(v) => up("b_cm", v)} />
              <NumberField label="h" unit="cm" value={input.h_cm} onChange={(v) => up("h_cm", v)} />
              <NumberField label="L" unit="m" value={input.L_m} onChange={(v) => up("L_m", v)} step={0.1} />
            </div>
          </InputCard>
          <InputCard label="Cargas">
            <NumberField label="Pu zapata max" unit="ton" value={input.Pu_zapata_max_ton}
              onChange={(v) => up("Pu_zapata_max_ton", v)} step={1} source="loads" />
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
          <TieBeamDiagramSet r={result} />
          <ReinforcementTable
            longitudinal={[
              { n: 2, size: 5, As_total: 2 * 1.99, position: "Superior" },
              { n: 2, size: 5, As_total: 2 * 1.99, position: "Inferior" },
            ]}
            transversal={[
              { size: 3, separacion_cm: 20, zona: "Toda la longitud", ramas: 2 },
            ]}
          />
        </>
      }
    />
  );
}
