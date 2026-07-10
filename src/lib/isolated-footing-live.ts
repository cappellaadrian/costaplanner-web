/**
 * TS port of design_isolated_footing — concentric/eccentric isolated footing.
 * ACI §13 + §22.5 (1-way shear) + §22.6 (punching). Simplified — assumes
 * uniform soil capacity, no overturning P-M envelope.
 */

// @lat: [[lat.md\codigo\cimentaciones#Cimentaciones#Zapata aislada - 6 verificaciones]]

import type { CalculationStep } from "./beam-flexure-live";
import { selectBars, dbBar, PHI_V } from "./materials";
import { designFlexure } from "./design-flexure-helper";

export interface IsolatedFootingInput {
  B_m: number;
  L_m: number;
  h_cm: number;
  bc_cm: number;       // column width
  lc_cm: number;       // column length
  r_cm: number;
  Pu_ton: number;
  Mu_tonm: number;
  qa_ton_m2: number;
  fc: number;
  fy: number;
  zona: 1 | 2 | 3 | 4;
  withSeismic: boolean;
}

export interface IsolatedFootingLiveResult {
  B: number; L: number; h: number; bc: number; lc: number; r: number;
  Pu: number; Mu: number; qa: number; fc: number; fy: number; zona: number;

  A_total: number;
  e: number;
  qu_max: number;
  qu_min: number;
  caso_presion: string;
  x_contact: number;
  q_cap: number;
  phi_suelo: number;
  d_cm: number;

  Vu_1d: number;
  phi_Vc_1d: number;
  // Punching
  bo: number;
  Vu_pun: number;
  phi_Vc_pun: number;

  Mu_B: number;
  As_req_B: number;
  As_prov_B: number;
  size_B: number;
  n_B: number;
  s_B: number;

  Mu_L: number;
  As_req_L: number;
  As_prov_L: number;
  size_L: number;
  n_L: number;
  s_L: number;

  s_max_code: number;
  warnings: string[];
  errors: string[];
}

export function computeIsolatedFootingLive(input: IsolatedFootingInput): IsolatedFootingLiveResult {
  const { B_m: B, L_m: L, h_cm: h, bc_cm: bc, lc_cm: lc, r_cm: r,
    Pu_ton: Pu, Mu_tonm: Mu, qa_ton_m2: qa, fc, fy, zona, withSeismic } = input;
  const warnings: string[] = [];
  const errors: string[] = [];

  const A_total = B * L;
  const e = Pu > 0 ? Mu / Pu : 0;

  let qu_max: number, qu_min: number, x_contact: number, caso_presion: string;
  if (e > B / 2) {
    errors.push("e > B/2. Zapata insuficiente. Rediseñar con B mayor.");
    qu_max = 999; qu_min = 0; x_contact = 0; caso_presion = "fuera de rango";
  } else if (e <= B / 6) {
    qu_max = (Pu / A_total) * (1 + (6 * e) / B);
    qu_min = (Pu / A_total) * (1 - (6 * e) / B);
    caso_presion = "trapezoidal (e ≤ B/6)";
    x_contact = B;
  } else {
    x_contact = 3 * (B / 2 - e);
    qu_max = (2 * Pu) / (L * x_contact);
    qu_min = 0;
    caso_presion = "triangular (e > B/6)";
    warnings.push(`Distribución triangular, zona contacto x = ${x_contact.toFixed(3)} m`);
  }

  const phi_suelo = withSeismic ? 0.65 : 0.45;
  const q_ult = qa * 3.0;
  const q_cap = phi_suelo * q_ult;

  const db_assume = dbBar(5);
  const d_cm = h - r - 1.5 * db_assume;

  const a_v_m = (B - bc / 100) / 2 - d_cm / 100;
  const Vu_1d = Math.max(0, qu_max * L * a_v_m);
  const phi_Vc_1d = (PHI_V * 0.53 * Math.sqrt(fc) * L * 100 * d_cm) / 1000;

  // Punching shear (ACI 318-14 §22.6.5.2): vc es el MENOR de tres
  // expresiones, no solo la primera.
  // (CR-Cal-Bug 2026-05: anteriormente solo se evaluaba 1.06·√f'c, lo
  //  cual sobre-predice capacidad cuando la columna es angosta o
  //  elongada (β > 2). Ahora aplicamos el minimo de las tres.)
  const bo = 2 * (bc + d_cm) + 2 * (lc + d_cm); // cm
  const Apun = (bc + d_cm) * (lc + d_cm); // cm²
  const Apun_m2 = Apun / 10000;
  const Vu_pun = qu_max * (A_total - Apun_m2);

  const beta = Math.max(bc, lc) / Math.max(1, Math.min(bc, lc));
  // alpha_s: 40 columna interior, 30 borde, 20 esquina. Asumimos interior.
  const alpha_s = 40;
  const sqrt_fc = Math.sqrt(fc);
  //  (a) vc1 = 1.06 · √f'c                  (caso general)
  //  (b) vc2 = (0.53 + 1.06/β) · √f'c       (columna elongada)
  //  (c) vc3 = (0.27 + α_s·d/bo) · √f'c     (perímetro grande)
  const vc1 = 1.06 * sqrt_fc;
  const vc2 = (0.53 + 1.06 / beta) * sqrt_fc;
  const vc3 = (0.27 + (alpha_s * d_cm) / bo) * sqrt_fc;
  const vc_punching = Math.min(vc1, vc2, vc3); // kg/cm²
  const phi_Vc_pun_kg = PHI_V * vc_punching * bo * d_cm;
  const phi_Vc_pun = phi_Vc_pun_kg / 1000; // ton

  // Flexure B direction (cantilever a_B = (B - bc/100)/2)
  const a_B = (B - bc / 100) / 2;
  const Mu_B = (qu_max * L * a_B * a_B) / 2;
  const fl_B = designFlexure({ b: L * 100, d: d_cm, h, Mu_tonm: Mu_B, fc, fy });
  const sel_B = selectBars(fl_B.As_diseno, [4, 5, 6, 7]);
  const n_B = sel_B.n;
  const size_B = sel_B.size;
  const As_prov_B = sel_B.AsProv;
  const s_B = n_B > 1 ? (L * 100 - 2 * r) / (n_B - 1) : 0;

  const a_L = (L - lc / 100) / 2;
  const Mu_L = (qu_max * B * a_L * a_L) / 2;
  const fl_L = designFlexure({ b: B * 100, d: d_cm, h, Mu_tonm: Mu_L, fc, fy });
  const sel_L = selectBars(fl_L.As_diseno, [4, 5, 6, 7]);
  const n_L = sel_L.n;
  const size_L = sel_L.size;
  const As_prov_L = sel_L.AsProv;
  const s_L = n_L > 1 ? (B * 100 - 2 * r) / (n_L - 1) : 0;

  const s_max_code = Math.min(3 * h, 45);
  if (zona >= 3) warnings.push("Zona sísmica >= 3: usar acero ASTM A706.");
  warnings.push("Colocar solado f'c = 140 kg/cm², espesor 5-10 cm.");

  return {
    B, L, h, bc, lc, r, Pu, Mu, qa, fc, fy, zona,
    A_total, e, qu_max, qu_min, caso_presion, x_contact, q_cap, phi_suelo,
    d_cm,
    Vu_1d, phi_Vc_1d,
    bo, Vu_pun, phi_Vc_pun,
    Mu_B, As_req_B: fl_B.As_diseno, As_prov_B, size_B, n_B, s_B,
    Mu_L, As_req_L: fl_L.As_diseno, As_prov_L, size_L, n_L, s_L,
    s_max_code,
    warnings, errors,
  };
}

export function buildIsolatedFootingSteps(r: IsolatedFootingLiveResult): CalculationStep[] {
  return [
    {
      id: "iso_ftg.step_01_A", name: "Área total de zapata",
      equation_latex: "A = B \\cdot L",
      inputs: { B: r.B, L: r.L }, output_var: "A", output_value: r.A_total, output_unit: "m²",
      code_ref: "Geometría", depends_on: [], note: "",
    },
    {
      id: "iso_ftg.step_02_e", name: "Excentricidad",
      equation_latex: "e = \\frac{M_u}{P_u}",
      inputs: { Mu: r.Mu, Pu: r.Pu }, output_var: "e", output_value: r.e, output_unit: "m",
      code_ref: "", depends_on: [], note: r.caso_presion,
    },
    {
      id: "iso_ftg.step_03_qu", name: "Presión última máxima",
      equation_latex: r.e <= r.B / 6
        ? "q_{u,max} = \\frac{P_u}{A}\\left(1 + \\frac{6e}{B}\\right)"
        : "q_{u,max} = \\frac{2 P_u}{L \\cdot x_{cont}}",
      inputs: { Pu: r.Pu, A: r.A_total, e: r.e, B: r.B },
      output_var: "qu_max", output_value: r.qu_max, output_unit: "ton/m²",
      code_ref: "Equilibrio", depends_on: ["iso_ftg.step_01_A", "iso_ftg.step_02_e"], note: "",
    },
    {
      id: "iso_ftg.step_04_q_cap", name: "Capacidad del suelo",
      equation_latex: "q_{cap} = \\phi_{suelo} \\cdot 3 \\cdot q_a",
      inputs: { phi: r.phi_suelo, qa: r.qa }, output_var: "q_cap", output_value: r.q_cap,
      output_unit: "ton/m²", code_ref: "CSCR-10 §6", depends_on: [], note: "",
    },
    {
      id: "iso_ftg.step_05_d", name: "Peralte efectivo",
      equation_latex: "d = h - r - 1.5 d_b",
      inputs: { h: r.h, r: r.r }, output_var: "d", output_value: r.d_cm, output_unit: "cm",
      code_ref: "ACI 318-14 §20.6", depends_on: [], note: "Asume malla #5 inferior.",
    },
    {
      id: "iso_ftg.step_06_Vu_1d", name: "Cortante en una dirección",
      equation_latex: "V_{u,1d} = q_{u,max} \\cdot L \\cdot a_v",
      inputs: { qu: r.qu_max, L: r.L },
      output_var: "Vu_1d", output_value: r.Vu_1d, output_unit: "ton",
      code_ref: "ACI 318-14 §22.5.5", depends_on: ["iso_ftg.step_03_qu"], note: "",
    },
    {
      id: "iso_ftg.step_07_phiVc_1d", name: "Resistencia phi·Vc (1 dir.)",
      equation_latex: "\\phi V_c = 0.75 \\cdot 0.53 \\sqrt{f'_c} \\cdot L \\cdot d",
      inputs: { fc: r.fc, L: r.L, d: r.d_cm },
      output_var: "phi_Vc_1d", output_value: r.phi_Vc_1d, output_unit: "ton",
      code_ref: "ACI 318-14 §22.5", depends_on: ["iso_ftg.step_05_d"], note: "",
    },
    {
      id: "iso_ftg.step_08_bo", name: "Perímetro crítico de punzonamiento",
      equation_latex: "b_o = 2(b_c + d) + 2(l_c + d)",
      inputs: { bc: r.bc, lc: r.lc, d: r.d_cm },
      output_var: "bo", output_value: r.bo, output_unit: "cm",
      code_ref: "ACI 318-14 §22.6.5.1", depends_on: ["iso_ftg.step_05_d"], note: "",
    },
    {
      id: "iso_ftg.step_09_phiVc_pun", name: "Capacidad punzonamiento",
      equation_latex: "\\phi V_c = 0.75 \\cdot 1.06 \\sqrt{f'_c} \\cdot b_o \\cdot d",
      inputs: { fc: r.fc, bo: r.bo, d: r.d_cm },
      output_var: "phi_Vc_pun", output_value: r.phi_Vc_pun, output_unit: "ton",
      code_ref: "ACI 318-14 §22.6.5", depends_on: ["iso_ftg.step_08_bo"], note: "",
    },
    {
      id: "iso_ftg.step_10_Mu_B", name: "Momento dirección B",
      equation_latex: "M_{u,B} = \\frac{q_{u,max} L (a_B)^2}{2}",
      inputs: { qu: r.qu_max, L: r.L, B: r.B, bc: r.bc },
      output_var: "Mu_B", output_value: r.Mu_B, output_unit: "ton-m",
      code_ref: "ACI 318-14 §13.2", depends_on: ["iso_ftg.step_03_qu"], note: "",
    },
    {
      id: "iso_ftg.step_11_As_B", name: "Acero dirección B (perpendicular)",
      equation_latex: "A_{s,B}",
      inputs: { Mu_B: r.Mu_B }, output_var: "As_B", output_value: r.As_req_B, output_unit: "cm²",
      code_ref: "ACI 318-14 §9.6 (flexión)", depends_on: ["iso_ftg.step_10_Mu_B"],
      note: `Provisto: ${r.n_B} #${r.size_B} (As = ${r.As_prov_B.toFixed(2)} cm²)`,
    },
    {
      id: "iso_ftg.step_12_Mu_L", name: "Momento dirección L",
      equation_latex: "M_{u,L} = \\frac{q_{u,max} B (a_L)^2}{2}",
      inputs: { qu: r.qu_max, B: r.B, L: r.L, lc: r.lc },
      output_var: "Mu_L", output_value: r.Mu_L, output_unit: "ton-m",
      code_ref: "ACI 318-14 §13.2", depends_on: ["iso_ftg.step_03_qu"], note: "",
    },
    {
      id: "iso_ftg.step_13_As_L", name: "Acero dirección L (perpendicular)",
      equation_latex: "A_{s,L}",
      inputs: { Mu_L: r.Mu_L }, output_var: "As_L", output_value: r.As_req_L, output_unit: "cm²",
      code_ref: "ACI 318-14 §9.6", depends_on: ["iso_ftg.step_12_Mu_L"],
      note: `Provisto: ${r.n_L} #${r.size_L} (As = ${r.As_prov_L.toFixed(2)} cm²)`,
    },
  ];
}

export function buildIsolatedFootingChecks(r: IsolatedFootingLiveResult) {
  return [
    { nombre: "Presión del suelo", requerido: r.qu_max, disponible: r.q_cap,
      unidad: "ton/m²", cumple: r.qu_max <= r.q_cap, referencia: "CSCR-10 §6", critical: true },
    { nombre: "Cortante 1 dirección", requerido: r.Vu_1d, disponible: r.phi_Vc_1d,
      unidad: "ton", cumple: r.phi_Vc_1d >= r.Vu_1d, referencia: "ACI §22.5", critical: true },
    { nombre: "Punzonamiento", requerido: r.Vu_pun, disponible: r.phi_Vc_pun,
      unidad: "ton", cumple: r.phi_Vc_pun >= r.Vu_pun, referencia: "ACI §22.6", critical: true },
    { nombre: "As dirección B", requerido: r.As_req_B, disponible: r.As_prov_B,
      unidad: "cm²", cumple: r.As_prov_B >= r.As_req_B, referencia: "ACI §9.6", critical: true },
    { nombre: "As dirección L", requerido: r.As_req_L, disponible: r.As_prov_L,
      unidad: "cm²", cumple: r.As_prov_L >= r.As_req_L, referencia: "ACI §9.6", critical: true },
    { nombre: "Separación B ≤ 3h ó 45 cm", requerido: r.s_B, disponible: r.s_max_code,
      unidad: "cm", cumple: r.s_B <= r.s_max_code, referencia: "ACI §7.7.2", critical: false },
    { nombre: "Separación L ≤ 3h ó 45 cm", requerido: r.s_L, disponible: r.s_max_code,
      unidad: "cm", cumple: r.s_L <= r.s_max_code, referencia: "ACI §7.7.2", critical: false },
  ];
}
