"use client";

/**
 * /studio/stair-slab — losa de escalera (inclinada).
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { StudioShell, NumberField, InputCard } from "@/components/studio/StudioShell";
import { SaveToProjectButton } from "@/components/studio/SaveToProjectButton";
import { useProjectContext } from "@/lib/use-project-context";
import { StairDiagramSet, StairProfile } from "@/components/studio/MoreDiagrams";
import { ReinforcementTable } from "@/components/studio/ReinforcementTable";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import {
  computeStairLive, buildStairSteps, buildStairChecks,
  type StairInput,
} from "@/lib/stair-slab-live";

const DEFAULT: StairInput = {
  L_horiz_m: 3.2, h_slab_cm: 15,
  contrahuella_cm: 18, huella_cm: 28,
  CP_acabados_kg_m2: 120, CT_kg_m2: 400,
  fc: 245, fy: 4200, zona: 3, r_cm: 2,
};

export default function StairPage() {
  const [input, setInput] = useState<StairInput>(DEFAULT);
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
  const result = useMemo(() => computeStairLive(input), [input]);
  const steps = useMemo(() => buildStairSteps(result), [result]);
  const checks = useMemo(() => buildStairChecks(result), [result]);

  function up<K extends keyof StairInput>(k: K, v: StairInput[K]) {
    setInput((p) => ({ ...p, [k]: v }));
  }

  return (
    <StudioShell
      title="Losa de escalera"
      subtitle="Losa inclinada simplemente apoyada. Diseño por flexión + ergonomía CR."
      stepPrefix="stair."
      referencesBundle="stair"
      buildSnapshot={() =>
        buildSnapshot({
          title: `Losa de escalera L=${input.L_horiz_m} m`,
          elementType: "stair_slab",
          zonaSismica: input.zona, fc: input.fc, fy: input.fy,
          inputs: [
            { name: "L horiz", value: input.L_horiz_m, unit: "m" },
            { name: "h losa", value: input.h_slab_cm, unit: "cm" },
            { name: "C (contrahuella)", value: input.contrahuella_cm, unit: "cm" },
            { name: "H (huella)", value: input.huella_cm, unit: "cm" },
            { name: "CP acabados", value: input.CP_acabados_kg_m2, unit: "kg/m²" },
            { name: "CT", value: input.CT_kg_m2, unit: "kg/m²" },
          ],
          steps, checks,
          reinforcement: {
            longitudinal: [
              { n: result.n, size: result.size, As_total: result.As_prov,
                position: `Principal sep ${result.s.toFixed(1)} cm` },
              { n: result.n_temp, size: result.size_temp, As_total: result.As_temp_prov,
                position: `Temperatura sep ${result.s_temp.toFixed(1)} cm` },
            ],
          },
          notes: result.warnings,
          diagrams: renderDiagrams([
            { title: "ST-1 — Perfil de la escalera", element: <StairProfile r={result} /> },
          ]),
        })
      }
      warnings={result.warnings}
      extraToolbarSlot={
        <SaveToProjectButton
          elementType="stair-slab"
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
              <NumberField label="L horiz" unit="m" value={input.L_horiz_m}
                onChange={(v) => up("L_horiz_m", v)} step={0.1} />
              <NumberField label="h losa" unit="cm" value={input.h_slab_cm}
                onChange={(v) => up("h_slab_cm", v)} />
              <NumberField label="C (contra.)" unit="cm" value={input.contrahuella_cm}
                onChange={(v) => up("contrahuella_cm", v)} step={0.5} />
              <NumberField label="H (huella)" unit="cm" value={input.huella_cm}
                onChange={(v) => up("huella_cm", v)} step={0.5} />
              <NumberField label="recubrim." unit="cm" value={input.r_cm}
                onChange={(v) => up("r_cm", v)} step={0.5} />
            </div>
          </InputCard>
          <InputCard label="Cargas">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="CP acabados" unit="kg/m²" value={input.CP_acabados_kg_m2}
                onChange={(v) => up("CP_acabados_kg_m2", v)} step={10} />
              <NumberField label="CT" unit="kg/m²" value={input.CT_kg_m2}
                onChange={(v) => up("CT_kg_m2", v)} step={25} />
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
          <StairDiagramSet r={result} />
          <ReinforcementTable
            longitudinal={[
              { n: result.n, size: result.size, As_total: result.As_prov,
                position: `Principal (sentido circulación). Sep ${result.s.toFixed(1)} cm` },
              { n: result.n_temp, size: result.size_temp, As_total: result.As_temp_prov,
                position: `Temperatura. Sep ${result.s_temp.toFixed(1)} cm` },
            ]}
          />
        </>
      }
    />
  );
}
