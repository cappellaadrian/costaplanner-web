/**
 * Punzonamiento (two-way shear) con transferencia de momento.
 *
 * References:
 *   - ACI 318-14 §8.4.4 (Combined shear + moment transfer at slab-column joints)
 *   - ACI 318-14 §8.4.2.3.2 (γf, γv fractions)
 *   - ACI 318-14 §22.6.5.2 (Two-way shear strength)
 *   - CRSI Design Handbook §8 (Punzonamiento + γv)
 *   - CSCR-10 Rev. 2014 §8.4 (Cortante en losas y zapatas)
 *
 * Procedure:
 *   1. Compute critical perimeter at d/2 from the column face (bo).
 *      Edge condition shrinks bo (one side missing for edge, two for corner).
 *   2. Fraction transferred by flexure:
 *          γf = 1 / (1 + (2/3) √(b1/b2))    [ACI §8.4.2.3.2]
 *      Fraction by eccentricity-of-shear:
 *          γv = 1 − γf
 *   3. Polar moment of perimeter Jc — simplified formulas for interior column.
 *   4. Combined stress:
 *          vu = Vu / (bo · d)  +  γv · Mu · c_AB / Jc
 *   5. Capacity (ACI §22.6.5.2) — controlling minimum:
 *          vc1 = 4 · λ · √f'c[psi]
 *          vc2 = (2 + 4/β) · λ · √f'c[psi]      β = c1/c2 ≥ 1
 *          vc3 = (αs·d/bo + 2) · λ · √f'c[psi]   αs = 40 int, 30 edge, 20 corner
 *      φvc = φ · min(vc1, vc2, vc3)   [φ = 0.75]
 *   6. Check vu ≤ φvc; if not → stud rails or shear caps.
 *
 * Units in/out: cm, kg, kg/cm². √f'c is computed in psi (×14.22) then capacity
 * is returned in kg/cm² for direct comparison with the demand.
 */
import type { CalculationStep } from "./beam-flexure-live";

export type EdgeCondition = "interior" | "edge" | "corner";

export interface PunzonamientoMomentoInput {
  h_cm: number;            // espesor total de la losa o zapata
  d_cm: number;            // peralte efectivo
  c1_cm: number;           // dimensión de la columna en la dirección del momento
  c2_cm: number;           // dimensión perpendicular
  Vu_ton: number;          // carga vertical última transferida
  Mu_tonm: number;         // momento desbalanceado
  edge: EdgeCondition;
  fc: number;              // kg/cm²
  fy: number;              // kg/cm² (informativo)
}

export interface PunzonamientoMomentoLiveResult {
  // echo
  h: number; d: number; c1: number; c2: number;
  Vu: number; Mu: number; edge: EdgeCondition;
  fc: number; fy: number;

  // computed perimeter
  b1: number;              // c1 + d  (in direction of moment)
  b2: number;              // c2 + d  (perpendicular)
  bo: number;              // critical perimeter (cm)

  gamma_f: number;
  gamma_v: number;

  Jc_cm4: number;          // polar moment of perimeter
  c_AB_cm: number;         // distance from perimeter centroid to far face

  // demand
  vu_axial: number;        // Vu / (bo·d)
  vu_moment: number;       // γv·Mu·c_AB / Jc
  vu_combined: number;     // sum, kg/cm²

  // capacity
  beta_ratio: number;      // c1/c2 (with c1 ≥ c2)
  alpha_s: number;         // 40/30/20
  fc_psi: number;
  vc1: number; vc2: number; vc3: number;  // psi
  vc_min_psi: number;
  vc_min_kgcm2: number;
  phi_vc: number;

  shear_pass: boolean;
  warnings: string[];
}

const PSI_PER_KGCM2 = 14.22;

export function computePunzonamientoMomentoLive(
  input: PunzonamientoMomentoInput,
): PunzonamientoMomentoLiveResult {
  const { h_cm, d_cm, c1_cm, c2_cm, Vu_ton, Mu_tonm, edge, fc, fy } = input;
  const warnings: string[] = [];

  // ---- 1. Critical section dimensions ----
  const b1 = c1_cm + d_cm;
  const b2 = c2_cm + d_cm;

  // Perimeter bo at d/2 from column face — adjusted by edge condition
  let bo: number;
  if (edge === "interior") bo = 2 * (b1 + b2);
  else if (edge === "edge") bo = 2 * b1 + b2;    // one side missing (b2 side)
  else /* corner */         bo = b1 + b2;

  // ---- 2. Fraction transferred by flexure / shear ----
  // γf = 1 / (1 + (2/3)·√(b1/b2))
  const gamma_f = 1 / (1 + (2 / 3) * Math.sqrt(b1 / b2));
  const gamma_v = 1 - gamma_f;

  // ---- 3. Polar moment Jc (simplified for interior column) ----
  // Closed-form for interior column (ACI Commentary R8.4.4.2.3):
  //   Jc = d·b1³/6 + b1·d³/6 + 2·b2·d·(b1/2)²
  // For edge / corner, the simplified formula is conservatively scaled by
  // a perimeter ratio. Engineers using this tool for edge / corner should
  // verify against full Jc formulas from ACI 421.1R.
  const Jc_interior = (d_cm * Math.pow(b1, 3)) / 6
                    + (b1 * Math.pow(d_cm, 3)) / 6
                    + 2 * b2 * d_cm * Math.pow(b1 / 2, 2);
  let Jc: number;
  if (edge === "interior") {
    Jc = Jc_interior;
  } else if (edge === "edge") {
    Jc = Jc_interior * 0.55; // approximate reduction
    warnings.push("Borde: Jc aproximado a 0.55·Jc_interior. Para diseño definitivo usar ACI 421.1R.");
  } else {
    Jc = Jc_interior * 0.30;
    warnings.push("Esquina: Jc aproximado a 0.30·Jc_interior. Para diseño definitivo usar ACI 421.1R.");
  }

  // c_AB = distancia del centroide del perímetro a la cara más lejana
  const c_AB = b1 / 2;

  // ---- 4. Demand ----
  const vu_axial = bo * d_cm > 0 ? (Vu_ton * 1000) / (bo * d_cm) : 0; // kg/cm²
  // γv · Mu · c_AB / Jc  → Mu in kg·cm, c_AB in cm, Jc in cm⁴ → kg/cm²
  const Mu_kgcm = Mu_tonm * 1e5;
  const vu_moment = Jc > 0 ? (gamma_v * Mu_kgcm * c_AB) / Jc : 0;
  const vu_combined = vu_axial + vu_moment;

  // ---- 5. Capacity ----
  const c_long = Math.max(c1_cm, c2_cm);
  const c_short = Math.min(c1_cm, c2_cm);
  const beta = c_short > 0 ? c_long / c_short : 1;
  let alpha_s: number;
  if (edge === "interior") alpha_s = 40;
  else if (edge === "edge") alpha_s = 30;
  else alpha_s = 20;

  const lambda = 1.0;
  const fc_psi = fc * PSI_PER_KGCM2;
  const sqrt_fc = Math.sqrt(fc_psi);
  const vc1_psi = 4 * lambda * sqrt_fc;
  const vc2_psi = (2 + 4 / beta) * lambda * sqrt_fc;
  const vc3_psi = bo > 0 ? ((alpha_s * d_cm) / bo + 2) * lambda * sqrt_fc : vc1_psi;
  const vc_min_psi = Math.min(vc1_psi, vc2_psi, vc3_psi);
  const vc_min_kgcm2 = vc_min_psi / PSI_PER_KGCM2;
  const phi_v = 0.75;
  const phi_vc = phi_v * vc_min_kgcm2;

  const shear_pass = vu_combined <= phi_vc;
  if (!shear_pass) {
    warnings.push(
      `vu = ${vu_combined.toFixed(2)} > φvc = ${phi_vc.toFixed(2)} kg/cm² — ` +
      `requiere stud rails, capiteles o aumentar peralte.`,
    );
  }

  return {
    h: h_cm, d: d_cm, c1: c1_cm, c2: c2_cm,
    Vu: Vu_ton, Mu: Mu_tonm, edge, fc, fy,
    b1, b2, bo,
    gamma_f, gamma_v,
    Jc_cm4: Jc, c_AB_cm: c_AB,
    vu_axial, vu_moment, vu_combined,
    beta_ratio: beta, alpha_s,
    fc_psi,
    vc1: vc1_psi, vc2: vc2_psi, vc3: vc3_psi,
    vc_min_psi, vc_min_kgcm2,
    phi_vc, shear_pass,
    warnings,
  };
}

export function buildPunzonamientoMomentoSteps(
  r: PunzonamientoMomentoLiveResult,
): CalculationStep[] {
  return [
    {
      id: "punz_mom.step_01_b1_b2",
      name: "Dimensiones del perímetro crítico",
      equation_latex: "b_1 = c_1 + d, \\quad b_2 = c_2 + d",
      inputs: { c1: r.c1, c2: r.c2, d: r.d },
      output_var: "b1",
      output_value: r.b1,
      output_unit: "cm",
      code_ref: "ACI 318-14 §22.6.4.1",
      depends_on: [],
      note: `b1 = ${r.b1} cm, b2 = ${r.b2} cm.`,
    },
    {
      id: "punz_mom.step_02_bo",
      name: "Perímetro crítico bo",
      equation_latex: r.edge === "interior"
        ? "b_o = 2(b_1 + b_2)"
        : r.edge === "edge"
          ? "b_o = 2 b_1 + b_2"
          : "b_o = b_1 + b_2",
      inputs: { b1: r.b1, b2: r.b2 },
      output_var: "bo",
      output_value: r.bo,
      output_unit: "cm",
      code_ref: "ACI 318-14 §22.6.4.1",
      depends_on: ["punz_mom.step_01_b1_b2"],
      note: `Posición: ${r.edge}.`,
    },
    {
      id: "punz_mom.step_03_gamma_f",
      name: "Fracción transferida por flexión γf",
      equation_latex:
        "\\gamma_f = \\frac{1}{1 + \\tfrac{2}{3}\\sqrt{b_1 / b_2}}",
      inputs: { b1: r.b1, b2: r.b2 },
      output_var: "gamma_f",
      output_value: r.gamma_f,
      output_unit: "",
      code_ref: "ACI 318-14 §8.4.2.3.2",
      depends_on: ["punz_mom.step_01_b1_b2"],
      note: "",
    },
    {
      id: "punz_mom.step_04_gamma_v",
      name: "Fracción transferida por excentricidad γv",
      equation_latex: "\\gamma_v = 1 - \\gamma_f",
      inputs: { gamma_f: r.gamma_f },
      output_var: "gamma_v",
      output_value: r.gamma_v,
      output_unit: "",
      code_ref: "ACI 318-14 §8.4.4.2.2",
      depends_on: ["punz_mom.step_03_gamma_f"],
      note: "",
    },
    {
      id: "punz_mom.step_05_Jc",
      name: "Momento polar Jc del perímetro crítico",
      equation_latex:
        "J_c = \\tfrac{d \\, b_1^{3}}{6} + \\tfrac{b_1 \\, d^{3}}{6} + 2 b_2 d \\!\\left(\\tfrac{b_1}{2}\\right)^{2}",
      inputs: { d: r.d, b1: r.b1, b2: r.b2 },
      output_var: "Jc",
      output_value: r.Jc_cm4,
      output_unit: "cm⁴",
      code_ref: "ACI 318-14 R8.4.4.2.3",
      depends_on: ["punz_mom.step_01_b1_b2"],
      note: r.edge === "interior"
        ? ""
        : `Ajustado para columna ${r.edge}; verificación final con ACI 421.1R recomendada.`,
    },
    {
      id: "punz_mom.step_06_c_AB",
      name: "Distancia c_AB al borde lejano",
      equation_latex: "c_{AB} = b_1 / 2",
      inputs: { b1: r.b1 },
      output_var: "c_AB",
      output_value: r.c_AB_cm,
      output_unit: "cm",
      code_ref: "ACI 318-14 R8.4.4",
      depends_on: ["punz_mom.step_01_b1_b2"],
      note: "",
    },
    {
      id: "punz_mom.step_07_vu_axial",
      name: "Esfuerzo cortante por Vu",
      equation_latex: "v_{u,axial} = \\frac{V_u \\cdot 1000}{b_o \\cdot d}",
      inputs: { Vu: r.Vu, bo: r.bo, d: r.d },
      output_var: "vu_axial",
      output_value: r.vu_axial,
      output_unit: "kg/cm²",
      code_ref: "ACI 318-14 §22.6.4",
      depends_on: ["punz_mom.step_02_bo"],
      note: "",
    },
    {
      id: "punz_mom.step_08_vu_moment",
      name: "Esfuerzo cortante por momento desbalanceado",
      equation_latex:
        "v_{u,M} = \\frac{\\gamma_v \\cdot M_u \\cdot c_{AB}}{J_c}",
      inputs: { gamma_v: r.gamma_v, Mu: r.Mu * 1e5, c_AB: r.c_AB_cm, Jc: r.Jc_cm4 },
      output_var: "vu_moment",
      output_value: r.vu_moment,
      output_unit: "kg/cm²",
      code_ref: "ACI 318-14 §8.4.4.2",
      depends_on: [
        "punz_mom.step_04_gamma_v",
        "punz_mom.step_05_Jc",
        "punz_mom.step_06_c_AB",
      ],
      note: "",
    },
    {
      id: "punz_mom.step_09_vu_total",
      name: "Esfuerzo cortante combinado",
      equation_latex: "v_u = v_{u,axial} + v_{u,M}",
      inputs: { vu_axial: r.vu_axial, vu_moment: r.vu_moment },
      output_var: "vu_combined",
      output_value: r.vu_combined,
      output_unit: "kg/cm²",
      code_ref: "ACI 318-14 §8.4.4.2",
      depends_on: ["punz_mom.step_07_vu_axial", "punz_mom.step_08_vu_moment"],
      note: "",
    },
    {
      id: "punz_mom.step_10_beta",
      name: "Relación de aspecto β",
      equation_latex: "\\beta = c_{largo} / c_{corto}",
      inputs: { c1: r.c1, c2: r.c2 },
      output_var: "beta",
      output_value: r.beta_ratio,
      output_unit: "",
      code_ref: "ACI 318-14 §22.6.5.2",
      depends_on: [],
      note: "",
    },
    {
      id: "punz_mom.step_11_vc",
      name: "Capacidad mínima a punzonamiento",
      equation_latex:
        "v_c = \\min\\!\\left[\\, 4\\sqrt{f'_c},\\;\\; (2 + 4/\\beta)\\sqrt{f'_c},\\;\\; (\\alpha_s d / b_o + 2)\\sqrt{f'_c} \\,\\right]_{psi}",
      inputs: {
        beta: r.beta_ratio,
        alpha_s: r.alpha_s,
        d: r.d,
        bo: r.bo,
        fc_psi: r.fc_psi,
      },
      output_var: "vc",
      output_value: r.vc_min_kgcm2,
      output_unit: "kg/cm²",
      code_ref: "ACI 318-14 §22.6.5.2",
      depends_on: ["punz_mom.step_02_bo", "punz_mom.step_10_beta"],
      note: `αs = ${r.alpha_s} (${r.edge}). vc1=${r.vc1.toFixed(1)} psi, vc2=${r.vc2.toFixed(1)} psi, vc3=${r.vc3.toFixed(1)} psi.`,
    },
    {
      id: "punz_mom.step_12_phi_vc",
      name: "Capacidad reducida φvc",
      equation_latex: "\\phi v_c = 0.75 \\cdot v_c",
      inputs: { vc: r.vc_min_kgcm2 },
      output_var: "phi_vc",
      output_value: r.phi_vc,
      output_unit: "kg/cm²",
      code_ref: "ACI 318-14 §21.2.1",
      depends_on: ["punz_mom.step_11_vc"],
      note: "",
    },
    {
      id: "punz_mom.step_13_check",
      name: "Verificación vu ≤ φvc",
      equation_latex: "v_u \\;\\leq\\; \\phi v_c",
      inputs: { vu: r.vu_combined, phi_vc: r.phi_vc },
      output_var: "shear_ratio",
      output_value: r.phi_vc > 0 ? r.vu_combined / r.phi_vc : 0,
      output_unit: "",
      code_ref: "ACI 318-14 §8.4.4",
      depends_on: ["punz_mom.step_09_vu_total", "punz_mom.step_12_phi_vc"],
      note: r.shear_pass ? "OK" : "FALLA — instalar stud rails o aumentar d.",
    },
  ];
}

export function buildPunzonamientoMomentoChecks(
  r: PunzonamientoMomentoLiveResult,
) {
  return [
    {
      nombre: "Punzonamiento vu ≤ φvc",
      requerido: r.vu_combined,
      disponible: r.phi_vc,
      unidad: "kg/cm²",
      cumple: r.shear_pass,
      referencia: "ACI 318-14 §8.4.4 + §22.6.5",
      critical: true,
    },
    {
      nombre: "γv (fracción excéntrica)",
      requerido: r.gamma_v,
      disponible: r.gamma_v,
      unidad: "",
      cumple: true,
      referencia: "ACI 318-14 §8.4.2.3.2",
      critical: false,
    },
    {
      nombre: "Peralte efectivo mínimo d ≥ 15 cm",
      requerido: 15,
      disponible: r.d,
      unidad: "cm",
      cumple: r.d >= 15,
      referencia: "Práctica CR (zapatas / losas)",
      critical: false,
    },
  ];
}
