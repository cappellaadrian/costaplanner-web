/**
 * TS port of design_one_way_slab — losa en una dirección por franja de 1 m.
 */
import type { CalculationStep } from "./beam-flexure-live";
import { selectBars, PHI_V, asBar } from "./materials";
import { designFlexure } from "./design-flexure-helper";

export const ACI_COEFF_1WAY: Record<string, number> = {
  first_exterior_simple: 0,
  first_exterior_fixed: -1 / 16,
  first_interior_2spans: -1 / 9,
  first_interior_3plus: -1 / 10,
  other_interior: -1 / 11,
  first_span_pos: 1 / 14,
  interior_span_pos: 1 / 16,
};

export type OneWayCondition = keyof typeof ACI_COEFF_1WAY;

export interface OneWaySlabInput {
  Lcorto_m: number;
  Llargo_m: number;
  h_cm: number;
  r_cm: number;
  Ln_m: number;
  wu_ton_m2: number;
  condicion: OneWayCondition;
  fc: number;
  fy: number;
  zona: 1 | 2 | 3 | 4;
}

export interface OneWaySlabLiveResult {
  Lc: number; Ll: number; h: number; r: number; Ln: number;
  wu: number; condicion: OneWayCondition;
  fc: number; fy: number; zona: number;

  d_cm: number;
  Cm: number;
  Mu: number;
  As_req: number;
  As_prov: number;
  size: number;
  n: number;
  s: number;
  As_temp: number;
  As_temp_prov: number;
  size_temp: number;
  n_temp: number;
  s_temp: number;
  s_max_code: number;
  Vu: number;
  phi_Vc: number;

  warnings: string[];
}

export function computeOneWaySlabLive(input: OneWaySlabInput): OneWaySlabLiveResult {
  const { Lcorto_m, Llargo_m, h_cm, r_cm, Ln_m, wu_ton_m2, condicion, fc, fy, zona } = input;
  const warnings: string[] = [];

  const Ln = Ln_m > 0 ? Ln_m : Lcorto_m;
  const d_cm = h_cm - r_cm - asBar(4) / 2;

  const Cm = ACI_COEFF_1WAY[condicion];
  const Mu = Math.abs(Cm * wu_ton_m2 * Ln * Ln);

  const fl = designFlexure({ b: 100, d: d_cm, h: h_cm, Mu_tonm: Mu, fc, fy });
  const sel = selectBars(fl.As_diseno, [3, 4, 5]);
  const size = sel.size, n = sel.n, As_prov = sel.AsProv;
  const s = (100 - 2 * r_cm) / Math.max(n, 1);

  const As_temp = 0.0018 * 100 * h_cm;
  const selT = selectBars(As_temp, [3, 4]);
  const s_temp = (100 - 2 * r_cm) / Math.max(selT.n, 1);

  const s_max_code = Math.min(3 * h_cm, 45);

  const Vu = wu_ton_m2 * (Ln / 2 - d_cm / 100);
  const phi_Vc = (PHI_V * 0.53 * Math.sqrt(fc) * 100 * d_cm) / 1000;

  if (zona >= 3) warnings.push("Zona sísmica >= 3: acero ASTM A706.");

  return {
    Lc: Lcorto_m, Ll: Llargo_m, h: h_cm, r: r_cm, Ln, wu: wu_ton_m2,
    condicion, fc, fy, zona,
    d_cm, Cm, Mu,
    As_req: fl.As_diseno, As_prov, size, n, s,
    As_temp, As_temp_prov: selT.AsProv, size_temp: selT.size, n_temp: selT.n, s_temp,
    s_max_code, Vu, phi_Vc, warnings,
  };
}

export function buildOneWaySlabSteps(r: OneWaySlabLiveResult): CalculationStep[] {
  return [
    {
      id: "ow_slab.step_01_d", name: "Peralte efectivo",
      equation_latex: "d = h - r - d_b/2",
      inputs: { h: r.h, r: r.r }, output_var: "d", output_value: r.d_cm,
      output_unit: "cm", code_ref: "ACI §20.6", depends_on: [], note: "",
    },
    {
      id: "ow_slab.step_02_Cm", name: "Coeficiente ACI por condición",
      equation_latex: `C_m = ${r.Cm.toFixed(4)}`,
      inputs: {}, output_var: "Cm", output_value: r.Cm, output_unit: "",
      code_ref: "ACI 318-14 §6.5.2", depends_on: [],
      note: `Condición: ${r.condicion}`,
    },
    {
      id: "ow_slab.step_03_Mu", name: "Momento por metro",
      equation_latex: "M_u = C_m \\cdot w_u \\cdot L_n^2",
      inputs: { Cm: r.Cm, wu: r.wu, Ln: r.Ln },
      output_var: "Mu", output_value: r.Mu, output_unit: "ton-m/m",
      code_ref: "", depends_on: ["ow_slab.step_02_Cm"], note: "",
    },
    {
      id: "ow_slab.step_04_As", name: "Acero principal por metro",
      equation_latex: "A_s",
      inputs: { Mu: r.Mu, d: r.d_cm }, output_var: "As", output_value: r.As_req,
      output_unit: "cm²/m", code_ref: "ACI §9.6",
      depends_on: ["ow_slab.step_03_Mu"],
      note: `${r.n} #${r.size} @ ${r.s.toFixed(1)} cm`,
    },
    {
      id: "ow_slab.step_05_Astemp", name: "Acero por temperatura (perpendicular)",
      equation_latex: "A_{s,temp} = 0.0018 \\cdot 100 \\cdot h",
      inputs: { h: r.h }, output_var: "As_temp", output_value: r.As_temp,
      output_unit: "cm²/m", code_ref: "ACI §7.6.1", depends_on: [],
      note: `${r.n_temp} #${r.size_temp} @ ${r.s_temp.toFixed(1)} cm`,
    },
    {
      id: "ow_slab.step_06_Vu", name: "Cortante por metro",
      equation_latex: "V_u = w_u (L_n/2 - d/100)",
      inputs: { wu: r.wu, Ln: r.Ln, d: r.d_cm },
      output_var: "Vu", output_value: r.Vu, output_unit: "ton/m",
      code_ref: "ACI §22.5", depends_on: ["ow_slab.step_01_d"], note: "",
    },
    {
      id: "ow_slab.step_07_phiVc", name: "Capacidad de cortante",
      equation_latex: "\\phi V_c = 0.75 \\cdot 0.53 \\sqrt{f'_c} \\cdot 100 \\cdot d",
      inputs: { fc: r.fc, d: r.d_cm }, output_var: "phi_Vc",
      output_value: r.phi_Vc, output_unit: "ton/m",
      code_ref: "ACI §22.5", depends_on: ["ow_slab.step_01_d"], note: "",
    },
  ];
}

export function buildOneWaySlabChecks(r: OneWaySlabLiveResult) {
  return [
    { nombre: "As principal por metro", requerido: r.As_req, disponible: r.As_prov,
      unidad: "cm²/m", cumple: r.As_prov >= r.As_req, referencia: "ACI §9.6", critical: true },
    { nombre: "Separación principal ≤ min(3h, 45)", requerido: r.s, disponible: r.s_max_code,
      unidad: "cm", cumple: r.s <= r.s_max_code, referencia: "ACI §7.7.2", critical: false },
    { nombre: "As temperatura", requerido: r.As_temp, disponible: r.As_temp_prov,
      unidad: "cm²/m", cumple: r.As_temp_prov >= r.As_temp, referencia: "ACI §7.6.1", critical: true },
    { nombre: "Cortante phi·Vc ≥ Vu", requerido: r.Vu, disponible: r.phi_Vc,
      unidad: "ton/m", cumple: r.phi_Vc >= r.Vu, referencia: "ACI §22.5", critical: true },
  ];
}
