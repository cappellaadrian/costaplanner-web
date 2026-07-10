/**
 * TS port of design_two_way_slab — método de coeficientes ACI 318-63 (Caso 2).
 * Mirror of slab.py:design_two_way_slab. Tabulated for Case 2 only; other
 * cases warn until tabulated.
 */
import type { CalculationStep } from "./beam-flexure-live";
import { selectBars, asBar } from "./materials";
import { designFlexure } from "./design-flexure-helper";

type Tup6 = [number, number, number, number, number, number];

export const TWO_WAY_COEFF: Record<number, Record<number, Tup6>> = {
  2: {
    1.0: [0.045, 0.045, 0.018, 0.018, 0.027, 0.027],
    0.9: [0.05, 0.041, 0.02, 0.014, 0.03, 0.024],
    0.8: [0.055, 0.037, 0.022, 0.011, 0.033, 0.02],
    0.7: [0.06, 0.031, 0.023, 0.008, 0.036, 0.015],
    0.6: [0.065, 0.024, 0.024, 0.006, 0.039, 0.011],
    0.5: [0.068, 0.015, 0.024, 0.003, 0.04, 0.007],
  },
};

export interface TwoWaySlabInput {
  a_m: number;
  b_m: number;
  h_cm: number;
  r_cm: number;
  CP_ton_m2: number;
  CT_ton_m2: number;
  fc: number;
  fy: number;
  zona: 1 | 2 | 3 | 4;
  caso: number;
  fR: number;
}

export interface TwoWaySlabLiveResult {
  a: number; b: number; h: number; r: number; m_ratio: number;
  CP: number; CT: number; wu: number;
  fc: number; fy: number; zona: number; caso: number;

  m_key: number;
  Ca_neg: number; Cb_neg: number;
  Ma_neg: number; Mb_neg: number;
  Ma_pos: number; Mb_pos: number;
  Mu_a: number; Mu_b: number;
  d_a: number; d_b: number;
  As_req_a: number; As_prov_a: number; size_a: number; n_a: number; s_a: number;
  As_req_b: number; As_prov_b: number; size_b: number; n_b: number; s_b: number;
  s_max_code: number;

  warnings: string[];
  errors: string[];
}

export function computeTwoWaySlabLive(input: TwoWaySlabInput): TwoWaySlabLiveResult {
  const { a_m: a, b_m: b, h_cm: h, r_cm: r, CP_ton_m2: CP, CT_ton_m2: CT,
    fc, fy, zona, caso, fR } = input;
  const warnings: string[] = [];
  const errors: string[] = [];

  const m_ratio = b > 0 ? a / b : 1.0;
  const wu = 1.2 * CP + 1.6 * fR * CT;

  if (!TWO_WAY_COEFF[caso]) {
    errors.push(`Caso ${caso} no tabulado en este puerto. Solo Caso 2 disponible.`);
    return {
      a, b, h, r, m_ratio, CP, CT, wu, fc, fy, zona, caso,
      m_key: 1.0, Ca_neg: 0, Cb_neg: 0,
      Ma_neg: 0, Mb_neg: 0, Ma_pos: 0, Mb_pos: 0,
      Mu_a: 0, Mu_b: 0, d_a: 0, d_b: 0,
      As_req_a: 0, As_prov_a: 0, size_a: 4, n_a: 0, s_a: 0,
      As_req_b: 0, As_prov_b: 0, size_b: 4, n_b: 0, s_b: 0,
      s_max_code: Math.min(2 * h, 45), warnings, errors,
    };
  }

  const table = TWO_WAY_COEFF[caso];
  const keys = Object.keys(table).map(Number);
  let m_key = keys[0];
  let best = Math.abs(m_key - m_ratio);
  for (const k of keys) {
    const d = Math.abs(k - m_ratio);
    if (d < best) { best = d; m_key = k; }
  }
  const [Ca_neg, Cb_neg, Ca_pos_CP, Cb_pos_CP, Ca_pos_CT, Cb_pos_CT] = table[m_key];

  const Ma_neg = Ca_neg * wu * a * a;
  const Mb_neg = Cb_neg * wu * b * b;
  const Ma_pos = Ca_pos_CP * (1.2 * CP) * a * a + Ca_pos_CT * (1.6 * fR * CT) * a * a;
  const Mb_pos = Cb_pos_CP * (1.2 * CP) * b * b + Cb_pos_CT * (1.6 * fR * CT) * b * b;
  const Mu_a = Math.max(Ma_neg, Ma_pos);
  const Mu_b = Math.max(Mb_neg, Mb_pos);

  const d_a = h - r - asBar(4) / 2;
  const d_b = d_a - asBar(4);

  const fl_a = designFlexure({ b: 100, d: d_a, h, Mu_tonm: Mu_a, fc, fy });
  const fl_b = designFlexure({ b: 100, d: d_b, h, Mu_tonm: Mu_b, fc, fy });

  const sel_a = selectBars(fl_a.As_diseno, [3, 4, 5]);
  const sel_b = selectBars(fl_b.As_diseno, [3, 4, 5]);

  const s_a = (100 - 2 * r) / Math.max(sel_a.n, 1);
  const s_b = (100 - 2 * r) / Math.max(sel_b.n, 1);
  const s_max_code = Math.min(2 * h, 45);

  if (zona >= 3) warnings.push("Zona sísmica >= 3: acero ASTM A706.");

  return {
    a, b, h, r, m_ratio, CP, CT, wu, fc, fy, zona, caso,
    m_key, Ca_neg, Cb_neg,
    Ma_neg, Mb_neg, Ma_pos, Mb_pos, Mu_a, Mu_b,
    d_a, d_b,
    As_req_a: fl_a.As_diseno, As_prov_a: sel_a.AsProv, size_a: sel_a.size, n_a: sel_a.n, s_a,
    As_req_b: fl_b.As_diseno, As_prov_b: sel_b.AsProv, size_b: sel_b.size, n_b: sel_b.n, s_b,
    s_max_code, warnings, errors,
  };
}

export function buildTwoWaySlabSteps(r: TwoWaySlabLiveResult): CalculationStep[] {
  return [
    {
      id: "tw_slab.step_01_m", name: "Relación de lados m",
      equation_latex: "m = a/b",
      inputs: { a: r.a, b: r.b }, output_var: "m", output_value: r.m_ratio,
      output_unit: "", code_ref: "", depends_on: [], note: `m_key tabla = ${r.m_key}`,
    },
    {
      id: "tw_slab.step_02_wu", name: "Carga última distribuida",
      equation_latex: "w_u = 1.2 CP + 1.6 f_R CT",
      inputs: { CP: r.CP, CT: r.CT },
      output_var: "wu", output_value: r.wu, output_unit: "ton/m²",
      code_ref: "ACI §5.3", depends_on: [], note: "",
    },
    {
      id: "tw_slab.step_03_Ma_neg", name: "Momento negativo dir. a",
      equation_latex: "M_{a,neg} = C_{a,neg} w_u a^2",
      inputs: { Ca: r.Ca_neg, wu: r.wu, a: r.a },
      output_var: "Ma_neg", output_value: r.Ma_neg, output_unit: "ton-m/m",
      code_ref: "Método 3 ACI 318-63", depends_on: ["tw_slab.step_02_wu"], note: "",
    },
    {
      id: "tw_slab.step_04_Mb_neg", name: "Momento negativo dir. b",
      equation_latex: "M_{b,neg} = C_{b,neg} w_u b^2",
      inputs: { Cb: r.Cb_neg, wu: r.wu, b: r.b },
      output_var: "Mb_neg", output_value: r.Mb_neg, output_unit: "ton-m/m",
      code_ref: "Método 3 ACI 318-63", depends_on: ["tw_slab.step_02_wu"], note: "",
    },
    {
      id: "tw_slab.step_05_Mu_a", name: "Momento gobernante dir. a",
      equation_latex: "M_{u,a} = \\max(M_{a,neg}, M_{a,pos})",
      inputs: { Ma_neg: r.Ma_neg, Ma_pos: r.Ma_pos },
      output_var: "Mu_a", output_value: r.Mu_a, output_unit: "ton-m/m",
      code_ref: "", depends_on: ["tw_slab.step_03_Ma_neg"], note: "",
    },
    {
      id: "tw_slab.step_06_Mu_b", name: "Momento gobernante dir. b",
      equation_latex: "M_{u,b} = \\max(M_{b,neg}, M_{b,pos})",
      inputs: { Mb_neg: r.Mb_neg, Mb_pos: r.Mb_pos },
      output_var: "Mu_b", output_value: r.Mu_b, output_unit: "ton-m/m",
      code_ref: "", depends_on: ["tw_slab.step_04_Mb_neg"], note: "",
    },
    {
      id: "tw_slab.step_07_As_a", name: "Acero dirección corta a",
      equation_latex: "A_{s,a}",
      inputs: { Mu_a: r.Mu_a, d_a: r.d_a },
      output_var: "As_a", output_value: r.As_req_a, output_unit: "cm²/m",
      code_ref: "ACI §9.6", depends_on: ["tw_slab.step_05_Mu_a"],
      note: `${r.n_a} #${r.size_a} @ ${r.s_a.toFixed(1)} cm`,
    },
    {
      id: "tw_slab.step_08_As_b", name: "Acero dirección larga b",
      equation_latex: "A_{s,b}",
      inputs: { Mu_b: r.Mu_b, d_b: r.d_b },
      output_var: "As_b", output_value: r.As_req_b, output_unit: "cm²/m",
      code_ref: "ACI §9.6", depends_on: ["tw_slab.step_06_Mu_b"],
      note: `${r.n_b} #${r.size_b} @ ${r.s_b.toFixed(1)} cm`,
    },
  ];
}

export function buildTwoWaySlabChecks(r: TwoWaySlabLiveResult) {
  return [
    { nombre: "As corta", requerido: r.As_req_a, disponible: r.As_prov_a,
      unidad: "cm²/m", cumple: r.As_prov_a >= r.As_req_a, referencia: "ACI §9.6", critical: true },
    { nombre: "As larga", requerido: r.As_req_b, disponible: r.As_prov_b,
      unidad: "cm²/m", cumple: r.As_prov_b >= r.As_req_b, referencia: "ACI §9.6", critical: true },
    { nombre: "Separación corta", requerido: r.s_a, disponible: r.s_max_code,
      unidad: "cm", cumple: r.s_a <= r.s_max_code, referencia: "ACI §8.7.2", critical: false },
    { nombre: "Separación larga", requerido: r.s_b, disponible: r.s_max_code,
      unidad: "cm", cumple: r.s_b <= r.s_max_code, referencia: "ACI §8.7.2", critical: false },
  ];
}
