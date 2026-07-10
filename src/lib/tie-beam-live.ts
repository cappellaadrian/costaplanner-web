/**
 * TS port of design_tie_beam — viga de amarre. CSCR §18.12.
 */
import type { CalculationStep } from "./beam-flexure-live";
import { asBar } from "./materials";

export interface TieBeamInput {
  b_cm: number;
  h_cm: number;
  L_m: number;
  Pu_zapata_max_ton: number;
  fc: number;
  fy: number;
  zona: 1 | 2 | 3 | 4;
}

export interface TieBeamLiveResult {
  b: number; h: number; L: number;
  Pu_zapata_max: number;
  fc: number; fy: number; zona: number;
  Pu_amarre: number;
  As_long_req: number;
  As_min: number;
  As_diseno: number;
  warnings: string[];
}

export function computeTieBeamLive(input: TieBeamInput): TieBeamLiveResult {
  const { b_cm, h_cm, L_m, Pu_zapata_max_ton, fc, fy, zona } = input;
  const warnings: string[] = [];
  const Pu_amarre = 0.10 * Pu_zapata_max_ton;
  const phi = 0.90;
  const As_long_req = (Pu_amarre * 1000) / (phi * fy);
  const As_min = 4 * asBar(5);
  const As_diseno = Math.max(As_long_req, As_min);
  if (zona >= 3) warnings.push("Zona sísmica >= 3: acero ASTM A706, ganchos 135°.");
  return {
    b: b_cm, h: h_cm, L: L_m, Pu_zapata_max: Pu_zapata_max_ton,
    fc, fy, zona,
    Pu_amarre, As_long_req, As_min, As_diseno, warnings,
  };
}

export function buildTieBeamSteps(r: TieBeamLiveResult): CalculationStep[] {
  return [
    {
      id: "tie_beam.step_01_Pu_amarre", name: "Tracción de amarre",
      equation_latex: "P_{u,amarre} = 0.10 \\cdot P_{u,zapata,max}",
      inputs: { Pu_zap: r.Pu_zapata_max },
      output_var: "Pu_amarre", output_value: r.Pu_amarre, output_unit: "ton",
      code_ref: "CSCR §18.12", depends_on: [], note: "Fuerza de tracción mínima entre zapatas.",
    },
    {
      id: "tie_beam.step_02_As_long_req", name: "Acero longitudinal por tracción",
      equation_latex: "A_{s,req} = \\frac{P_{u,amarre} \\cdot 1000}{\\phi f_y}",
      inputs: { Pu_amarre: r.Pu_amarre, phi: 0.90, fy: r.fy },
      output_var: "As_req", output_value: r.As_long_req, output_unit: "cm²",
      code_ref: "ACI §22.4 (tracción pura)", depends_on: ["tie_beam.step_01_Pu_amarre"], note: "",
    },
    {
      id: "tie_beam.step_03_As_min", name: "Acero mínimo (4 #5)",
      equation_latex: "A_{s,min} = 4 \\cdot A_{s,\\#5}",
      inputs: {}, output_var: "As_min", output_value: r.As_min, output_unit: "cm²",
      code_ref: "CSCR §18.12", depends_on: [], note: "",
    },
    {
      id: "tie_beam.step_04_As_diseno", name: "Acero de diseño",
      equation_latex: "A_{s,dis} = \\max(A_{s,req}, A_{s,min})",
      inputs: { As_req: r.As_long_req, As_min: r.As_min },
      output_var: "As_diseno", output_value: r.As_diseno, output_unit: "cm²",
      code_ref: "", depends_on: ["tie_beam.step_02_As_long_req", "tie_beam.step_03_As_min"],
      note: "",
    },
  ];
}

export function buildTieBeamChecks(r: TieBeamLiveResult) {
  return [
    { nombre: "b ≥ 20 cm", requerido: 20, disponible: r.b, unidad: "cm",
      cumple: r.b >= 20, referencia: "CSCR §18.12", critical: true },
    { nombre: "h ≥ 40 cm", requerido: 40, disponible: r.h, unidad: "cm",
      cumple: r.h >= 40, referencia: "CSCR §18.12", critical: true },
    { nombre: "As longitudinal por tracción", requerido: r.As_long_req, disponible: r.As_min,
      unidad: "cm²", cumple: r.As_min >= r.As_long_req, referencia: "CSCR §18.12", critical: true },
  ];
}
