/**
 * Combined Footing — Zapata combinada para dos columnas.
 *
 * References:
 *   - ACI 318-14 §13.2, §13.3 (Foundations, two-column footings)
 *   - ACI 318-14 §22.5 (One-way shear) + §22.6 (Punching)
 *   - Bowles, J.E. (1996), Foundation Analysis and Design, 5th ed., §10
 *   - Das, B.M. (2016), Principles of Foundation Engineering, §16
 *
 * Procedure (rectangular combined footing — rigid analysis):
 *   1. Resultante R = P1 + P2 ; ubicación del centroide xR = (P1·0 + P2·s)/R
 *   2. Longitud L tal que el centroide coincida con la resultante:
 *        L = 2·(a1 + xR)   ← donde a1 es la distancia desde col 1 al borde.
 *      Si esto da L irrealizable → trapezoidal.
 *   3. Reacción uniforme del suelo:  q = R / (B·L)   debe ≤ qa.
 *   4. Cortante y momento — tratar la zapata como una viga continua sobre
 *      suelo con carga lineal hacia arriba w = q·B (ton/m) y reacciones
 *      puntuales hacia abajo P1, P2:
 *        Mmax(-) entre columnas, Mmax(+) en volados.
 *   5. Diseño longitudinal:
 *        – Acero negativo (superior) entre columnas usa Mmax(-).
 *        – Acero positivo (inferior) en volados usa Mmax(+).
 *   6. Diseño transversal (Bowles §10): bandas de ancho (b_col + d) bajo cada
 *      columna, momento M_t = q·B·(B-bcol/100)²/8 por banda.
 *   7. Punzonamiento de cada columna y cortante en una dirección.
 *
 * Units: cm, kg, kg/cm², ton, ton-m. f'c siempre en kg/cm².
 */
import type { CalculationStep } from "./beam-flexure-live";
import { selectBars, dbBar, PHI_V } from "./materials";
import { designFlexure } from "./design-flexure-helper";

export interface CombinedFootingInput {
  P1_ton: number;        // carga columna 1
  P2_ton: number;        // carga columna 2
  s_m: number;           // distancia entre columnas (centro a centro)
  a1_m: number;          // distancia desde columna 1 al borde libre cercano
  B_m: number;           // ancho transversal de la zapata
  h_cm: number;          // espesor total
  b1_cm: number;         // columna 1 — ancho
  h1_cm: number;         // columna 1 — peralte (dirección longitudinal)
  b2_cm: number;         // columna 2 — ancho
  h2_cm: number;         // columna 2 — peralte
  qa_ton_m2: number;
  fc: number;
  fy: number;
  r_cm: number;
  zona: 1 | 2 | 3 | 4;
}

export interface CombinedFootingLiveResult {
  // echo
  P1: number; P2: number; s: number; a1: number; B: number; h: number;
  b1: number; h1: number; b2: number; h2: number;
  qa: number; fc: number; fy: number; r: number; zona: number;

  // Geometry derived
  R_ton: number;             // P1 + P2
  xR_m: number;              // posición de R desde col 1
  L_m: number;               // longitud requerida
  a2_m: number;              // volado en el lado opuesto
  q_ton_m2: number;          // presión uniforme del suelo
  q_ok: boolean;
  d_cm: number;              // peralte efectivo
  feasibleRectangular: boolean;

  // Beam-on-elastic analysis (idealizado como uniforme)
  w_ton_m: number;           // q·B (ton/m lineal)
  M_pos_cant_left_tonm: number;
  M_pos_cant_right_tonm: number;
  M_neg_max_tonm: number;    // momento negativo máximo entre columnas
  x_Mneg_m: number;          // posición desde col1 del Mmax(-)
  V_max_ton: number;         // cortante máximo en la cara de col

  // 1-dir shear (longitudinal)
  Vu_1d: number;
  phi_Vc_1d: number;
  shear1d_ok: boolean;

  // Punzonamiento col 1 y col 2
  bo1: number; Vu_pun1: number; phi_Vc_pun1: number; pun1_ok: boolean;
  bo2: number; Vu_pun2: number; phi_Vc_pun2: number; pun2_ok: boolean;

  // Refuerzo longitudinal superior (Mmax negativo entre cols)
  As_top_req: number; As_top_prov: number; size_top: number; n_top: number;
  // Refuerzo longitudinal inferior (Mmax positivo en volados)
  As_bot_req: number; As_bot_prov: number; size_bot: number; n_bot: number;

  // Bandas transversales (bajo cada columna)
  Mt_tonm: number;            // momento transversal (mismo en ambas bandas si simétrico)
  banda1_width_cm: number;    // b1 + d (banda bajo col 1)
  banda2_width_cm: number;    // b2 + d
  As_trans1_req: number; As_trans1_prov: number; size_trans1: number; n_trans1: number;
  As_trans2_req: number; As_trans2_prov: number; size_trans2: number; n_trans2: number;

  warnings: string[];
}

export function computeCombinedFootingLive(
  input: CombinedFootingInput,
): CombinedFootingLiveResult {
  const {
    P1_ton: P1, P2_ton: P2, s_m: s, a1_m: a1, B_m: B, h_cm: h,
    b1_cm: b1, h1_cm: h1, b2_cm: b2, h2_cm: h2,
    qa_ton_m2: qa, fc, fy, r_cm: r, zona,
  } = input;
  const warnings: string[] = [];

  // 1. Resultant and centroid
  const R = P1 + P2;
  const xR = R > 0 ? (P2 * s) / R : 0; // desde col 1

  // 2. Required length so resultant coincides with centroid:
  //    L = 2 · (a1 + xR)
  const L = 2 * (a1 + xR);
  const feasibleRectangular = L > a1 + s; // debe sobrepasar col 2
  if (!feasibleRectangular) {
    warnings.push(
      "Longitud rectangular insuficiente — la resultante cae fuera del centroide. " +
      "Considerar zapata trapezoidal (Bowles §10.4) o aumentar volado a1.",
    );
  }
  const a2 = Math.max(0, L - (a1 + s)); // volado del lado opuesto

  // 3. Soil pressure
  const A_total = B * L;
  const q = A_total > 0 ? R / A_total : 0;
  const q_ok = q <= qa;
  if (!q_ok) {
    warnings.push(
      `Presión q = ${q.toFixed(2)} ton/m² > qa = ${qa.toFixed(2)} ton/m². ` +
      "Aumentar B o L.",
    );
  }

  // 4. Effective depth
  const db_assume = dbBar(6);
  const d_cm = h - r - 1.5 * db_assume;

  // 5. Beam-on-soil analysis
  // w = q · B (kN/m equivalent — but we keep ton/m)
  const w = q * B; // ton/m (carga lineal hacia ARRIBA)
  // Volado izquierdo (longitud a1): momento en cara de col 1
  const M_cant_left = (w * a1 * a1) / 2; // ton-m positivo (acero abajo)
  // Volado derecho (longitud a2)
  const M_cant_right = (w * a2 * a2) / 2;
  // Entre columnas: la carga lineal w empuja hacia arriba y P1, P2 hacia abajo.
  // Tratamos el tramo entre las columnas como una viga continua. El momento
  // máximo (negativo, acero arriba) ocurre donde V = 0.
  // V(x) midiendo desde col 1 (en el tramo entre cols):
  //   V(x) = w · (a1 + x) − P1     [for 0 ≤ x ≤ s]
  // V = 0 → x* = P1/w − a1
  let x_Mneg = R > 0 ? P1 / w - a1 : 0;
  // Clamp dentro del tramo
  if (x_Mneg < 0) x_Mneg = 0;
  if (x_Mneg > s) x_Mneg = s;
  // M(x*) = w·(a1 + x*)²/2 − P1·x*  (momento + abajo, − arriba; aquí queda
  //   negativo si w pequeña — tomamos magnitud)
  const xtot = a1 + x_Mneg;
  const M_at_xstar = (w * xtot * xtot) / 2 - P1 * x_Mneg;
  const M_neg_max = Math.abs(M_at_xstar);
  // Cortante máximo: en la cara interior de la columna más cargada
  const Vmax_at_col1 = Math.abs(w * a1 - P1);
  const Vmax_at_col2 = Math.abs(w * (a1 + s) - P1 - P2 + w * a2);
  const V_max = Math.max(Vmax_at_col1, Vmax_at_col2, w * a1, w * a2);

  // 6. 1-dir shear longitudinal — verificar a "d" de la cara de col 1
  const a_v_left_m = Math.max(0, a1 - d_cm / 100);
  const Vu_1d = Math.max(0, w * a_v_left_m);
  const phi_Vc_1d = (PHI_V * 0.53 * Math.sqrt(fc) * B * 100 * d_cm) / 1000; // ton
  const shear1d_ok = Vu_1d <= phi_Vc_1d;

  // 7. Punzonamiento por columna (asumimos columna interior — α_s=40)
  const punching = (bc: number, lc: number) => {
    const bo = 2 * (bc + d_cm) + 2 * (lc + d_cm); // cm
    const Apun_m2 = ((bc + d_cm) * (lc + d_cm)) / 10000;
    const Vu_pun = q * (A_total / 2 - Apun_m2); // simplificación: tributario ≈ A/2
    const beta = Math.max(bc, lc) / Math.max(1, Math.min(bc, lc));
    const sqrt_fc = Math.sqrt(fc);
    const vc1 = 1.06 * sqrt_fc;
    const vc2 = (0.53 + 1.06 / beta) * sqrt_fc;
    const vc3 = (0.27 + (40 * d_cm) / bo) * sqrt_fc;
    const vc = Math.min(vc1, vc2, vc3);
    const phi_Vc_pun = (PHI_V * vc * bo * d_cm) / 1000;
    return { bo, Vu_pun, phi_Vc_pun, ok: Vu_pun <= phi_Vc_pun };
  };
  const pun1 = punching(b1, h1);
  const pun2 = punching(b2, h2);
  if (!pun1.ok) warnings.push(`Punzonamiento col 1: Vu = ${pun1.Vu_pun.toFixed(1)} > φVc = ${pun1.phi_Vc_pun.toFixed(1)} ton.`);
  if (!pun2.ok) warnings.push(`Punzonamiento col 2: Vu = ${pun2.Vu_pun.toFixed(1)} > φVc = ${pun2.phi_Vc_pun.toFixed(1)} ton.`);

  // 8. Refuerzo longitudinal — superior (negativo) e inferior (positivo)
  const flTop = designFlexure({ b: B * 100, d: d_cm, h, Mu_tonm: M_neg_max, fc, fy });
  const selTop = selectBars(flTop.As_diseno, [5, 6, 7, 8]);
  const M_cant_max = Math.max(M_cant_left, M_cant_right);
  const flBot = designFlexure({ b: B * 100, d: d_cm, h, Mu_tonm: M_cant_max, fc, fy });
  const selBot = selectBars(flBot.As_diseno, [5, 6, 7, 8]);

  // 9. Refuerzo transversal — bandas bajo cada columna
  // Bowles §10: tratar como viga de ancho (bc + d) y luz = (B - bc/100)/2 (volado)
  const band1_cm = b1 + d_cm;
  const band2_cm = b2 + d_cm;
  // Momento transversal por columna: q_col · (B/2)² / 2, donde q_col = P / (B · ancho_banda/100)
  const qcol1 = (B > 0 && band1_cm > 0) ? P1 / (B * (band1_cm / 100)) : 0;
  const qcol2 = (B > 0 && band2_cm > 0) ? P2 / (B * (band2_cm / 100)) : 0;
  const a_trans1 = (B - b1 / 100) / 2;
  const a_trans2 = (B - b2 / 100) / 2;
  const Mt1 = (qcol1 * a_trans1 * a_trans1) / 2;
  const Mt2 = (qcol2 * a_trans2 * a_trans2) / 2;
  const flT1 = designFlexure({ b: band1_cm, d: d_cm, h, Mu_tonm: Mt1, fc, fy });
  const selT1 = selectBars(flT1.As_diseno, [4, 5, 6]);
  const flT2 = designFlexure({ b: band2_cm, d: d_cm, h, Mu_tonm: Mt2, fc, fy });
  const selT2 = selectBars(flT2.As_diseno, [4, 5, 6]);

  if (zona >= 3) warnings.push("Zona sísmica ≥ III: usar acero ASTM A706 (CSCR §8.2).");
  warnings.push("Colocar solado f'c = 140 kg/cm², espesor 5–10 cm.");

  return {
    P1, P2, s, a1, B, h, b1, h1, b2, h2, qa, fc, fy, r, zona,
    R_ton: R, xR_m: xR, L_m: L, a2_m: a2, q_ton_m2: q, q_ok, d_cm,
    feasibleRectangular,
    w_ton_m: w,
    M_pos_cant_left_tonm: M_cant_left,
    M_pos_cant_right_tonm: M_cant_right,
    M_neg_max_tonm: M_neg_max,
    x_Mneg_m: x_Mneg,
    V_max_ton: V_max,
    Vu_1d, phi_Vc_1d, shear1d_ok,
    bo1: pun1.bo, Vu_pun1: pun1.Vu_pun, phi_Vc_pun1: pun1.phi_Vc_pun, pun1_ok: pun1.ok,
    bo2: pun2.bo, Vu_pun2: pun2.Vu_pun, phi_Vc_pun2: pun2.phi_Vc_pun, pun2_ok: pun2.ok,
    As_top_req: flTop.As_diseno, As_top_prov: selTop.AsProv, size_top: selTop.size, n_top: selTop.n,
    As_bot_req: flBot.As_diseno, As_bot_prov: selBot.AsProv, size_bot: selBot.size, n_bot: selBot.n,
    Mt_tonm: Math.max(Mt1, Mt2),
    banda1_width_cm: band1_cm, banda2_width_cm: band2_cm,
    As_trans1_req: flT1.As_diseno, As_trans1_prov: selT1.AsProv, size_trans1: selT1.size, n_trans1: selT1.n,
    As_trans2_req: flT2.As_diseno, As_trans2_prov: selT2.AsProv, size_trans2: selT2.size, n_trans2: selT2.n,
    warnings,
  };
}

export function buildCombinedFootingSteps(r: CombinedFootingLiveResult): CalculationStep[] {
  return [
    {
      id: "comb_ftg.step_01_R", name: "Resultante de columnas",
      equation_latex: "R = P_1 + P_2",
      inputs: { P1: r.P1, P2: r.P2 }, output_var: "R", output_value: r.R_ton, output_unit: "ton",
      code_ref: "Equilibrio", depends_on: [], note: "",
    },
    {
      id: "comb_ftg.step_02_xR", name: "Centroide de la resultante",
      equation_latex: "x_R = \\frac{P_2 \\cdot s}{R}",
      inputs: { P2: r.P2, s: r.s, R: r.R_ton },
      output_var: "xR", output_value: r.xR_m, output_unit: "m",
      code_ref: "Bowles §10.2", depends_on: ["comb_ftg.step_01_R"],
      note: "Distancia medida desde columna 1.",
    },
    {
      id: "comb_ftg.step_03_L", name: "Longitud requerida de la zapata",
      equation_latex: "L = 2 \\cdot (a_1 + x_R)",
      inputs: { a1: r.a1, xR: r.xR_m },
      output_var: "L", output_value: r.L_m, output_unit: "m",
      code_ref: "Bowles §10.2 (rect. footing centroid)",
      depends_on: ["comb_ftg.step_02_xR"],
      note: r.feasibleRectangular
        ? "Rectangular factible: el centroide cae sobre R."
        : "No factible — usar zapata trapezoidal (Bowles §10.4).",
    },
    {
      id: "comb_ftg.step_04_q", name: "Presión uniforme del suelo",
      equation_latex: "q = \\frac{R}{B \\cdot L}",
      inputs: { R: r.R_ton, B: r.B, L: r.L_m },
      output_var: "q", output_value: r.q_ton_m2, output_unit: "ton/m²",
      code_ref: "ACI 318-14 §13.3.1", depends_on: ["comb_ftg.step_03_L"],
      note: r.q_ok ? `OK — q ≤ qa = ${r.qa.toFixed(2)} ton/m²` : `FALLA — q > qa`,
    },
    {
      id: "comb_ftg.step_05_d", name: "Peralte efectivo",
      equation_latex: "d = h - r - 1.5 d_b",
      inputs: { h: r.h, r: r.r },
      output_var: "d", output_value: r.d_cm, output_unit: "cm",
      code_ref: "ACI 318-14 §20.6", depends_on: [], note: "Asume #6 inferior.",
    },
    {
      id: "comb_ftg.step_06_w", name: "Carga lineal hacia arriba",
      equation_latex: "w = q \\cdot B",
      inputs: { q: r.q_ton_m2, B: r.B },
      output_var: "w", output_value: r.w_ton_m, output_unit: "ton/m",
      code_ref: "Bowles §10.3", depends_on: ["comb_ftg.step_04_q"], note: "",
    },
    {
      id: "comb_ftg.step_07_Mneg", name: "Momento negativo máximo (entre columnas)",
      equation_latex:
        "M_{neg} = \\frac{w \\cdot (a_1 + x^*)^2}{2} - P_1 \\cdot x^*,\\;\\; x^* = \\frac{P_1}{w} - a_1",
      inputs: { w: r.w_ton_m, P1: r.P1, a1: r.a1 },
      output_var: "M_neg", output_value: r.M_neg_max_tonm, output_unit: "ton·m",
      code_ref: "Bowles §10.3", depends_on: ["comb_ftg.step_06_w"],
      note: `Ubicación: x* = ${r.x_Mneg_m.toFixed(2)} m desde col 1 (acero superior).`,
    },
    {
      id: "comb_ftg.step_08_Mpos", name: "Momento positivo en volados",
      equation_latex: "M_{pos} = \\frac{w \\cdot a^2}{2}",
      inputs: { w: r.w_ton_m, a1: r.a1, a2: r.a2_m },
      output_var: "M_pos",
      output_value: Math.max(r.M_pos_cant_left_tonm, r.M_pos_cant_right_tonm),
      output_unit: "ton·m",
      code_ref: "Bowles §10.3", depends_on: ["comb_ftg.step_06_w"],
      note: `Volado izq = ${r.M_pos_cant_left_tonm.toFixed(2)}, der = ${r.M_pos_cant_right_tonm.toFixed(2)} ton·m. Acero inferior.`,
    },
    {
      id: "comb_ftg.step_09_As_top", name: "Acero longitudinal superior (M-)",
      equation_latex: "A_{s,sup} = \\frac{M_{neg}}{\\phi \\cdot f_y \\cdot 0.9 d}",
      inputs: { M: r.M_neg_max_tonm, fy: r.fy, d: r.d_cm },
      output_var: "As_sup", output_value: r.As_top_prov, output_unit: "cm²",
      code_ref: "ACI 318-14 §9.6", depends_on: ["comb_ftg.step_07_Mneg"],
      note: `Provisto: ${r.n_top} #${r.size_top} (req ${r.As_top_req.toFixed(2)} cm²).`,
    },
    {
      id: "comb_ftg.step_10_As_bot", name: "Acero longitudinal inferior (M+)",
      equation_latex: "A_{s,inf} = \\frac{M_{pos}}{\\phi \\cdot f_y \\cdot 0.9 d}",
      inputs: { M: Math.max(r.M_pos_cant_left_tonm, r.M_pos_cant_right_tonm), fy: r.fy, d: r.d_cm },
      output_var: "As_inf", output_value: r.As_bot_prov, output_unit: "cm²",
      code_ref: "ACI 318-14 §9.6", depends_on: ["comb_ftg.step_08_Mpos"],
      note: `Provisto: ${r.n_bot} #${r.size_bot} (req ${r.As_bot_req.toFixed(2)} cm²).`,
    },
    {
      id: "comb_ftg.step_11_trans", name: "Acero transversal — banda bajo col 1",
      equation_latex: "A_{s,t} = \\frac{q_{col} \\cdot a_t^2 / 2}{\\phi \\cdot f_y \\cdot 0.9 d}",
      inputs: { ancho_banda: r.banda1_width_cm, Mt: r.Mt_tonm },
      output_var: "As_t1", output_value: r.As_trans1_prov, output_unit: "cm²",
      code_ref: "Bowles §10.5", depends_on: ["comb_ftg.step_05_d"],
      note: `Banda ancho (b1 + d) = ${r.banda1_width_cm.toFixed(0)} cm: ${r.n_trans1} #${r.size_trans1}.`,
    },
    {
      id: "comb_ftg.step_12_pun1", name: "Punzonamiento columna 1",
      equation_latex: "\\phi V_c = \\phi \\cdot v_c \\cdot b_o \\cdot d",
      inputs: { bo: r.bo1, d: r.d_cm },
      output_var: "phiVc1", output_value: r.phi_Vc_pun1, output_unit: "ton",
      code_ref: "ACI 318-14 §22.6.5", depends_on: ["comb_ftg.step_05_d"],
      note: r.pun1_ok ? "OK" : "FALLA — aumentar h.",
    },
    {
      id: "comb_ftg.step_13_pun2", name: "Punzonamiento columna 2",
      equation_latex: "\\phi V_c = \\phi \\cdot v_c \\cdot b_o \\cdot d",
      inputs: { bo: r.bo2, d: r.d_cm },
      output_var: "phiVc2", output_value: r.phi_Vc_pun2, output_unit: "ton",
      code_ref: "ACI 318-14 §22.6.5", depends_on: ["comb_ftg.step_05_d"],
      note: r.pun2_ok ? "OK" : "FALLA — aumentar h.",
    },
    {
      id: "comb_ftg.step_14_v1d", name: "Cortante en una dirección",
      equation_latex: "\\phi V_c = \\phi \\cdot 0.53 \\sqrt{f'_c} \\cdot B \\cdot d",
      inputs: { fc: r.fc, B: r.B, d: r.d_cm },
      output_var: "phiVc_1d", output_value: r.phi_Vc_1d, output_unit: "ton",
      code_ref: "ACI 318-14 §22.5", depends_on: ["comb_ftg.step_05_d"],
      note: r.shear1d_ok ? "OK" : "FALLA — aumentar h o L.",
    },
  ];
}

export function buildCombinedFootingChecks(r: CombinedFootingLiveResult) {
  return [
    {
      nombre: "Presión del suelo q ≤ qa",
      requerido: r.qa, disponible: r.q_ton_m2,
      unidad: "ton/m²", cumple: r.q_ok,
      referencia: "ACI 318-14 §13.3.1", critical: true,
    },
    {
      nombre: "Rectangular factible (centroide)",
      requerido: 1, disponible: r.feasibleRectangular ? 1 : 0,
      unidad: "", cumple: r.feasibleRectangular,
      referencia: "Bowles §10.2", critical: true,
    },
    {
      nombre: "Punzonamiento col 1: Vu ≤ φVc",
      requerido: r.Vu_pun1, disponible: r.phi_Vc_pun1,
      unidad: "ton", cumple: r.pun1_ok,
      referencia: "ACI 318-14 §22.6", critical: true,
    },
    {
      nombre: "Punzonamiento col 2: Vu ≤ φVc",
      requerido: r.Vu_pun2, disponible: r.phi_Vc_pun2,
      unidad: "ton", cumple: r.pun2_ok,
      referencia: "ACI 318-14 §22.6", critical: true,
    },
    {
      nombre: "Cortante 1-dir: Vu ≤ φVc",
      requerido: r.Vu_1d, disponible: r.phi_Vc_1d,
      unidad: "ton", cumple: r.shear1d_ok,
      referencia: "ACI 318-14 §22.5", critical: true,
    },
    {
      nombre: "Acero superior provisto ≥ requerido",
      requerido: r.As_top_req, disponible: r.As_top_prov,
      unidad: "cm²", cumple: r.As_top_prov >= r.As_top_req,
      referencia: "ACI 318-14 §9.6", critical: true,
    },
    {
      nombre: "Acero inferior provisto ≥ requerido",
      requerido: r.As_bot_req, disponible: r.As_bot_prov,
      unidad: "cm²", cumple: r.As_bot_prov >= r.As_bot_req,
      referencia: "ACI 318-14 §9.6", critical: true,
    },
  ];
}
