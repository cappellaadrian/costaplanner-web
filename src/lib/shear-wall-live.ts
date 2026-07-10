/**
 * TS port of design_shear_wall — muro de corte. ACI §18.10.
 */

// @lat: [[lat.md\codigo\muros#Muros#Muro de corte]]

import type { CalculationStep } from "./beam-flexure-live";
import { PHI_V } from "./materials";

export interface ShearWallInput {
  lw_m: number;
  hw_m: number;
  t_cm: number;
  Pu_ton: number;
  Vu_ton: number;
  Mu_tonm: number;
  fc: number;
  fy: number;
  zona: 1 | 2 | 3 | 4;
}

export interface ShearWallLiveResult {
  lw: number; hw: number; t: number;
  Pu: number; Vu: number; Mu: number;
  fc: number; fy: number; zona: number;

  Acv: number;
  hw_lw: number;
  alpha_c: number;
  rho_min: number;
  rho_t: number;
  phi_Vn: number;
  phi_Vn_max: number;
  Vu_limit_2curt: number;
  dos_cortinas: boolean;
  As_vert_min: number;
  As_horiz_min: number;

  warnings: string[];
}

export function computeShearWallLive(input: ShearWallInput): ShearWallLiveResult {
  const { lw_m, hw_m, t_cm, Pu_ton, Vu_ton, Mu_tonm, fc, fy, zona } = input;
  const warnings: string[] = [];

  const lw_cm = lw_m * 100;
  const Acv = t_cm * lw_cm;
  const Ag = Acv;
  const hw_lw = lw_m > 0 ? hw_m / lw_m : 0;

  let alpha_c: number;
  if (hw_lw <= 1.5) alpha_c = 0.80;
  else if (hw_lw >= 2.0) alpha_c = 0.53;
  else alpha_c = 0.80 - ((0.80 - 0.53) * (hw_lw - 1.5)) / 0.5;

  const rho_min = 0.0025;
  const rho_t = rho_min;
  const phi_Vn = (PHI_V * Acv * (alpha_c * Math.sqrt(fc) + rho_t * fy)) / 1000;
  const Vn_max = (2.65 * Acv * Math.sqrt(fc)) / 1000;
  const phi_Vn_max = PHI_V * Vn_max;
  // Umbral para exigir doble cortina por ACI 318-14 §18.10.2.2:
  //   Vu > 0.17·Acv·√f'c (en unidades kg/cm², resultado ton)
  // (CR-Cal-Bug 2026-05: anteriormente 0.27, valor incorrecto. La norma
  //  actual es 0.17.)
  const Vu_limit_2curt = (0.17 * Acv * Math.sqrt(fc)) / 1000;
  const dos_cortinas = Vu_ton > Vu_limit_2curt || t_cm >= 20 || zona >= 3;
  const As_vert_min = rho_min * t_cm * 100;
  const As_horiz_min = rho_min * t_cm * 100;

  if (hw_lw > 2.0 && Pu_ton > 0.35 * Ag * fc / 1000) {
    warnings.push("Muro alto con Pu alta. Requiere análisis de interacción P-M.");
  }
  if (zona >= 3) warnings.push("Zona sísmica >= 3: verificar elementos de borde §18.10.6.");

  return {
    lw: lw_m, hw: hw_m, t: t_cm,
    Pu: Pu_ton, Vu: Vu_ton, Mu: Mu_tonm,
    fc, fy, zona,
    Acv, hw_lw, alpha_c, rho_min, rho_t,
    phi_Vn, phi_Vn_max, Vu_limit_2curt, dos_cortinas,
    As_vert_min, As_horiz_min,
    warnings,
  };
}

export function buildShearWallSteps(r: ShearWallLiveResult): CalculationStep[] {
  return [
    {
      id: "wall.step_01_Acv", name: "Área de corte del muro",
      equation_latex: "A_{cv} = t \\cdot l_w",
      inputs: { t: r.t, lw: r.lw * 100 },
      output_var: "Acv", output_value: r.Acv, output_unit: "cm²",
      code_ref: "ACI §18.10.4", depends_on: [], note: "",
    },
    {
      id: "wall.step_02_hwlw", name: "Relación hw/lw",
      equation_latex: "h_w / l_w",
      inputs: { hw: r.hw, lw: r.lw }, output_var: "hw_lw",
      output_value: r.hw_lw, output_unit: "", code_ref: "",
      depends_on: [], note: r.hw_lw > 2.0 ? "Muro esbelto." : "Muro robusto.",
    },
    {
      id: "wall.step_03_alpha", name: "Coeficiente α_c",
      equation_latex: r.hw_lw <= 1.5
        ? "\\alpha_c = 0.80 \\; (h_w/l_w \\leq 1.5)"
        : r.hw_lw >= 2.0
          ? "\\alpha_c = 0.53 \\; (h_w/l_w \\geq 2.0)"
          : "\\alpha_c = 0.80 - 0.27 \\cdot (h_w/l_w - 1.5)/0.5",
      inputs: { hw_lw: r.hw_lw }, output_var: "alpha_c",
      output_value: r.alpha_c, output_unit: "",
      code_ref: "ACI 318-14 §18.10.4.1", depends_on: ["wall.step_02_hwlw"], note: "",
    },
    {
      id: "wall.step_04_phiVn", name: "Resistencia a corte phi·Vn",
      equation_latex: "\\phi V_n = \\phi A_{cv} (\\alpha_c \\sqrt{f'_c} + \\rho_t f_y)",
      inputs: { Acv: r.Acv, alpha_c: r.alpha_c, fc: r.fc, rho_t: r.rho_t, fy: r.fy },
      output_var: "phi_Vn", output_value: r.phi_Vn, output_unit: "ton",
      code_ref: "ACI §18.10.4", depends_on: ["wall.step_01_Acv", "wall.step_03_alpha"], note: "",
    },
    {
      id: "wall.step_05_phiVn_max", name: "Límite máximo phi·Vn,max",
      equation_latex: "\\phi V_{n,max} = \\phi \\cdot 2.65 A_{cv} \\sqrt{f'_c}",
      inputs: { Acv: r.Acv, fc: r.fc },
      output_var: "phi_Vn_max", output_value: r.phi_Vn_max, output_unit: "ton",
      code_ref: "ACI §18.10.4.4", depends_on: ["wall.step_01_Acv"], note: "",
    },
    {
      id: "wall.step_06_Vu_2curt", name: "Vu límite para 2 cortinas",
      equation_latex: "V_{u,lim,2curt} = 0.17 A_{cv} \\sqrt{f'_c}",
      inputs: { Acv: r.Acv, fc: r.fc },
      output_var: "Vu_limit_2curt", output_value: r.Vu_limit_2curt, output_unit: "ton",
      code_ref: "ACI §18.10.2.2", depends_on: ["wall.step_01_Acv"],
      note: r.dos_cortinas ? "Se requieren DOS cortinas." : "Una cortina admisible.",
    },
    {
      id: "wall.step_07_As_min", name: "Acero mínimo por metro (vert + horiz)",
      equation_latex: "A_{s,min} = 0.0025 \\cdot t \\cdot 100",
      inputs: { t: r.t },
      output_var: "As_min", output_value: r.As_vert_min, output_unit: "cm²/m",
      code_ref: "ACI §18.10.2.1", depends_on: [], note: "",
    },
  ];
}

export function buildShearWallChecks(r: ShearWallLiveResult) {
  return [
    { nombre: "phi·Vn ≥ Vu", requerido: r.Vu, disponible: r.phi_Vn,
      unidad: "ton", cumple: r.phi_Vn >= r.Vu, referencia: "ACI §18.10.4", critical: true },
    { nombre: "Vu ≤ phi·Vn,max", requerido: r.Vu, disponible: r.phi_Vn_max,
      unidad: "ton", cumple: r.Vu <= r.phi_Vn_max, referencia: "ACI §18.10.4.4", critical: true },
  ];
}
