/**
 * TS port of design_strip_footing — zapata corrida bajo muro.
 * Diseño por metro lineal.
 */
import type { CalculationStep } from "./beam-flexure-live";
import { selectBars, dbBar, PHI_V, asBar } from "./materials";
import { designFlexure } from "./design-flexure-helper";

export interface StripFootingInput {
  B_m: number;
  h_cm: number;
  bMuro_cm: number;
  Pu_lineal_ton_m: number;
  qa_ton_m2: number;
  fc: number;
  fy: number;
  zona: 1 | 2 | 3 | 4;
  r_cm: number;
}

export interface StripFootingLiveResult {
  B: number; h: number; b_muro: number; r: number;
  Pu_lineal: number; qa: number; fc: number; fy: number; zona: number;

  qu: number;
  q_cap: number;
  d_cm: number;
  Mu: number;
  As_req: number;
  As_prov: number;
  size: number;
  n: number;
  s: number;
  Vu: number;
  phi_Vc: number;
  As_temp: number;

  warnings: string[];
}

export function computeStripFootingLive(input: StripFootingInput): StripFootingLiveResult {
  const { B_m: B, h_cm: h, bMuro_cm: b_muro, Pu_lineal_ton_m: Pu, qa_ton_m2: qa,
    fc, fy, zona, r_cm: r } = input;
  const warnings: string[] = [];

  const qu = Pu / B;
  const phi_suelo = 0.45;
  const q_cap = phi_suelo * qa * 3.0;
  const d_cm = h - r - 1.5 * dbBar(5);

  const a_v = (B - b_muro / 100) / 2;
  const Mu = (qu * 1.0 * a_v * a_v) / 2;
  const fl = designFlexure({ b: 100, d: d_cm, h, Mu_tonm: Mu, fc, fy });

  const sel = selectBars(fl.As_diseno, [4, 5]);
  const size = sel.size, n = sel.n, As_prov = sel.AsProv;
  const s = n > 1 ? (100 - 2 * r) / (n - 1) : 0;

  const Vu = qu * (a_v - d_cm / 100);
  const phi_Vc = (PHI_V * 0.53 * Math.sqrt(fc) * 100 * d_cm) / 1000;

  const As_temp = 0.0018 * 100 * h;
  if (zona >= 3) warnings.push("Zona sísmica >= 3: acero ASTM A706.");

  return {
    B, h, b_muro, r, Pu_lineal: Pu, qa, fc, fy, zona,
    qu, q_cap, d_cm, Mu,
    As_req: fl.As_diseno, As_prov, size, n, s,
    Vu, phi_Vc, As_temp,
    warnings,
  };
}

export function buildStripFootingSteps(r: StripFootingLiveResult): CalculationStep[] {
  return [
    {
      id: "strip_ftg.step_01_qu", name: "Presión última (por metro lineal)",
      equation_latex: "q_u = \\frac{P_{u,lin}}{B}",
      inputs: { Pu: r.Pu_lineal, B: r.B }, output_var: "qu", output_value: r.qu,
      output_unit: "ton/m²", code_ref: "", depends_on: [], note: "",
    },
    {
      id: "strip_ftg.step_02_qcap", name: "Capacidad del suelo",
      equation_latex: "q_{cap} = 0.45 \\cdot 3 \\cdot q_a",
      inputs: { qa: r.qa }, output_var: "q_cap", output_value: r.q_cap,
      output_unit: "ton/m²", code_ref: "CSCR-10 §6", depends_on: [], note: "",
    },
    {
      id: "strip_ftg.step_03_d", name: "Peralte efectivo",
      equation_latex: "d = h - r - 1.5 d_b",
      inputs: { h: r.h, r: r.r }, output_var: "d", output_value: r.d_cm, output_unit: "cm",
      code_ref: "ACI §20.6", depends_on: [], note: "",
    },
    {
      id: "strip_ftg.step_04_Mu", name: "Momento transversal por metro",
      equation_latex: "M_u = \\frac{q_u \\cdot a_v^2}{2}",
      inputs: { qu: r.qu, B: r.B, b_muro: r.b_muro },
      output_var: "Mu", output_value: r.Mu, output_unit: "ton-m/m",
      code_ref: "ACI §13.2", depends_on: ["strip_ftg.step_01_qu"], note: "",
    },
    {
      id: "strip_ftg.step_05_As", name: "Acero transversal requerido",
      equation_latex: "A_s",
      inputs: { Mu: r.Mu, d: r.d_cm }, output_var: "As", output_value: r.As_req,
      output_unit: "cm²/m", code_ref: "ACI §9.6",
      depends_on: ["strip_ftg.step_04_Mu"], note: `${r.n} #${r.size} sep ${r.s.toFixed(1)} cm`,
    },
    {
      id: "strip_ftg.step_06_Vu", name: "Cortante transversal",
      equation_latex: "V_u = q_u (a_v - d/100)",
      inputs: { qu: r.qu, B: r.B, b_muro: r.b_muro, d: r.d_cm },
      output_var: "Vu", output_value: r.Vu, output_unit: "ton/m",
      code_ref: "ACI §22.5", depends_on: ["strip_ftg.step_01_qu"], note: "",
    },
    {
      id: "strip_ftg.step_07_phiVc", name: "Capacidad a cortante",
      equation_latex: "\\phi V_c = 0.75 \\cdot 0.53 \\sqrt{f'_c} \\cdot 100 \\cdot d",
      inputs: { fc: r.fc, d: r.d_cm }, output_var: "phi_Vc", output_value: r.phi_Vc,
      output_unit: "ton/m", code_ref: "ACI §22.5",
      depends_on: ["strip_ftg.step_03_d"], note: "",
    },
    {
      id: "strip_ftg.step_08_As_temp", name: "Acero por temperatura (longitudinal)",
      equation_latex: "A_{s,temp} = 0.0018 \\cdot 100 \\cdot h",
      inputs: { h: r.h }, output_var: "As_temp", output_value: r.As_temp,
      output_unit: "cm²/m", code_ref: "ACI §7.6.1", depends_on: [], note: "",
    },
  ];
}

export function buildStripFootingChecks(r: StripFootingLiveResult) {
  return [
    { nombre: "Presión del suelo", requerido: r.qu, disponible: r.q_cap,
      unidad: "ton/m²", cumple: r.qu <= r.q_cap, referencia: "CSCR-10 §6", critical: true },
    { nombre: "As transversal", requerido: r.As_req, disponible: r.As_prov,
      unidad: "cm²/m", cumple: r.As_prov >= r.As_req, referencia: "ACI §9.6", critical: true },
    { nombre: "Cortante transversal", requerido: r.Vu, disponible: r.phi_Vc,
      unidad: "ton/m", cumple: r.phi_Vc >= r.Vu, referencia: "ACI §22.5", critical: true },
  ];
}

export function stripFootingTempBars(As_temp: number) {
  const n = Math.max(2, Math.ceil(As_temp / asBar(4)));
  return { n, size: 4, As_total: n * asBar(4) };
}
