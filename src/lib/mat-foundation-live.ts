/**
 * Mat / raft foundation (losa de fundación) — análisis rígido simplificado.
 *
 * References:
 *   - ACI 318-14 §13.3.4 (Mat foundations)
 *   - ACI 336.2R-88 (Suggested analysis and design for combined footings and mats)
 *   - Bowles, J.E. (1996), Foundation Analysis and Design, 5th ed., §16
 *   - Das, B.M. (2016), Principles of Foundation Engineering, §17
 *   - Winkler model — Terzaghi, K. (1955), "Evaluation of coefficients of subgrade reaction"
 *
 * Procedure (rigid method, ACI 336.2R-88 Chapter 5):
 *   1. Resultante ΣP y posición del centroide de cargas (xR, yR).
 *   2. Excentricidades ex = xR − L/2, ey = yR − B/2.
 *   3. Presión en cada esquina:
 *        q = ΣP/(L·B) ± (ΣP·ex)·y/Iy ± (ΣP·ey)·x/Ix
 *      Verificar todas ≤ qa.
 *   4. Espesor mínimo por punzonamiento (columna más cargada).
 *   5. Acero por flexión — método de franjas:  M = q·L²/c (c por restricción).
 *   6. Cuantía mínima ρ_min = 0.0018 en cada cara y dirección + temperatura.
 *   7. Asentamiento Winkler:  δ = q/k.
 *
 * Units: cm, kg, kg/cm², ton, ton-m. k en kg/cm³.
 */
import type { CalculationStep } from "./beam-flexure-live";
import { selectBars, dbBar, PHI_V } from "./materials";

export interface MatColumnLoad {
  x_m: number;        // posición x desde origen (esquina inferior izq)
  y_m: number;
  P_ton: number;
  // Dimensiones de la columna (opcional, solo necesarias para punzonamiento;
  // si no se dan se asume 40×40 cm).
  bc_cm?: number;
  hc_cm?: number;
}

export interface MatFoundationInput {
  L_m: number;
  B_m: number;
  h_cm: number;
  columns: MatColumnLoad[];
  qa_ton_m2: number;
  k_kg_cm3: number;       // módulo de balasto (Winkler)
  fc: number;
  fy: number;
  r_cm: number;
  zona: 1 | 2 | 3 | 4;
}

export interface MatFoundationLiveResult {
  L: number; B: number; h: number; qa: number; k: number;
  fc: number; fy: number; r: number; zona: number;
  ncols: number;

  SumP_ton: number;
  xR_m: number; yR_m: number;
  ex_m: number; ey_m: number;
  Ix_m4: number; Iy_m4: number;
  q_corner1: number; q_corner2: number; q_corner3: number; q_corner4: number;
  q_max: number; q_min: number;
  q_ok: boolean;

  d_cm: number;
  // Punching del col más cargado
  worst_col_P: number;
  worst_col_bc: number; worst_col_hc: number;
  bo_worst: number;
  Vu_pun_worst: number;
  phi_Vc_pun_worst: number;
  pun_ok: boolean;

  // Flexión por franjas — promedio
  Mu_strip_x_tonm_per_m: number;     // momento por metro de ancho, dirección x
  Mu_strip_y_tonm_per_m: number;
  As_x_req_cm2_per_m: number;
  As_y_req_cm2_per_m: number;
  As_min_cm2_per_m: number;          // ρ_min = 0.0018 ambas caras
  As_x_prov_cm2_per_m: number;
  As_y_prov_cm2_per_m: number;
  size_x: number; s_x_cm: number;
  size_y: number; s_y_cm: number;

  // Asentamiento Winkler
  delta_max_cm: number;

  warnings: string[];
}

export function computeMatFoundationLive(
  input: MatFoundationInput,
): MatFoundationLiveResult {
  const { L_m: L, B_m: B, h_cm: h, columns, qa_ton_m2: qa,
    k_kg_cm3: k, fc, fy, r_cm: r, zona } = input;
  const warnings: string[] = [];
  const ncols = columns.length;
  if (ncols === 0) warnings.push("Sin columnas — agregar al menos una.");

  // 1. Resultante y centroide
  let SumP = 0, SumPx = 0, SumPy = 0;
  for (const c of columns) {
    SumP += c.P_ton;
    SumPx += c.P_ton * c.x_m;
    SumPy += c.P_ton * c.y_m;
  }
  const xR = SumP > 0 ? SumPx / SumP : L / 2;
  const yR = SumP > 0 ? SumPy / SumP : B / 2;
  const ex = xR - L / 2;
  const ey = yR - B / 2;

  // 2. Momentos de inercia de la losa (área rectangular L×B)
  const A = L * B;
  const Ix = (L * Math.pow(B, 3)) / 12; // m^4 — sobre eje x
  const Iy = (Math.pow(L, 3) * B) / 12;

  // 3. Presión en 4 esquinas
  const qBase = SumP / A;
  const Mx = SumP * ey; // momento respecto al eje x (positivo hacia +y)
  const My = SumP * ex;
  const corner = (x: number, y: number) =>
    qBase + (Mx * (y - B / 2)) / Ix + (My * (x - L / 2)) / Iy;
  // Corner coords (0,0)(L,0)(L,B)(0,B)
  const q1 = corner(0, 0);
  const q2 = corner(L, 0);
  const q3 = corner(L, B);
  const q4 = corner(0, B);
  const q_max = Math.max(q1, q2, q3, q4);
  const q_min = Math.min(q1, q2, q3, q4);
  const q_ok = q_max <= qa && q_min >= 0;
  if (q_max > qa) warnings.push(`Presión máxima ${q_max.toFixed(2)} > qa ${qa.toFixed(2)}.`);
  if (q_min < 0) warnings.push(`Esquina con tracción: q_min = ${q_min.toFixed(2)}. Aumentar L/B o reubicar columnas.`);

  // 4. Peralte efectivo (asume #6 doble malla)
  const db_assume = dbBar(6);
  const d_cm = h - r - 1.5 * db_assume;

  // 5. Punzonamiento del col más cargado
  let worstP = 0;
  let worstCol: MatColumnLoad = { x_m: 0, y_m: 0, P_ton: 0 };
  for (const c of columns) {
    if (c.P_ton > worstP) {
      worstP = c.P_ton;
      worstCol = c;
    }
  }
  const bc = worstCol.bc_cm ?? 40;
  const hc = worstCol.hc_cm ?? 40;
  const bo = 2 * (bc + d_cm) + 2 * (hc + d_cm);
  const beta = Math.max(bc, hc) / Math.max(1, Math.min(bc, hc));
  const sqrt_fc = Math.sqrt(fc);
  // alpha_s — interior 40, borde 30, esquina 20. Asumir interior.
  const vc1 = 1.06 * sqrt_fc;
  const vc2 = (0.53 + 1.06 / beta) * sqrt_fc;
  const vc3 = (0.27 + (40 * d_cm) / bo) * sqrt_fc;
  const vc = Math.min(vc1, vc2, vc3);
  const phi_Vc_pun = (PHI_V * vc * bo * d_cm) / 1000; // ton
  // Demanda: Pu_col − presión tributaria dentro del perímetro crítico
  const A_pun_m2 = ((bc + d_cm) * (hc + d_cm)) / 10000;
  const Vu_pun = Math.max(0, worstP - q_max * A_pun_m2);
  const pun_ok = Vu_pun <= phi_Vc_pun;
  if (!pun_ok) warnings.push(
    `Punzonamiento col máx: Vu = ${Vu_pun.toFixed(1)} > φVc = ${phi_Vc_pun.toFixed(1)} ton. Aumentar h.`,
  );

  // 6. Flexión por franjas — simplificado:
  //    M_strip = q_max · L_strip² / c, con c = 10 (ACI 336.2R-88 §5).
  const c_factor = 10;
  // Estimamos luz de franja como la separación promedio entre columnas:
  const L_strip_x = ncols > 1 ? L / Math.max(1, Math.ceil(Math.sqrt(ncols))) : L;
  const L_strip_y = ncols > 1 ? B / Math.max(1, Math.ceil(Math.sqrt(ncols))) : B;
  const Mu_x_per_m = (q_max * L_strip_x * L_strip_x) / c_factor; // ton-m por m
  const Mu_y_per_m = (q_max * L_strip_y * L_strip_y) / c_factor;

  // Acero por metro:  As = Mu / (φ · fy · 0.9·d)
  const phi_flex = 0.9;
  const As_x_req = Math.max(
    0,
    (Mu_x_per_m * 1e5) / (phi_flex * fy * 0.9 * d_cm),
  ); // cm² per m
  const As_y_req = Math.max(
    0,
    (Mu_y_per_m * 1e5) / (phi_flex * fy * 0.9 * d_cm),
  );
  // Cuantía mínima — ρ_min = 0.0018 (ACI 318-14 §24.4.3.2) por cada cara y dirección
  const As_min = 0.0018 * 100 * h; // cm² por metro de ancho, ambas caras combinadas
  const As_x_eff = Math.max(As_x_req, As_min);
  const As_y_eff = Math.max(As_y_req, As_min);

  // Seleccionar barra y separación
  const pickBar = (As_per_m: number) => {
    const candidates = [5, 6, 7, 8];
    for (const size of candidates) {
      const ab = [0, 0, 0, 0, 0, 1.99, 2.84, 3.87, 5.10][size];
      const s = (ab * 100) / As_per_m; // cm
      if (s >= 10 && s <= 30) return { size, s };
    }
    // fallback — usar #5 con s ajustada
    return { size: 5, s: (1.99 * 100) / Math.max(0.01, As_per_m) };
  };
  const bx = pickBar(As_x_eff);
  const by = pickBar(As_y_eff);

  // 7. Asentamiento Winkler:  δ = q / k
  // q en ton/m², k en kg/cm³ → δ en cm:  δ_cm = (q_ton_m2 · 1000/10000) / k
  // q ton/m² ·1000 kg/ton ·1m²/10000 cm² = q · 0.1 kg/cm²; δ = q·0.1/k
  const delta_max_cm = k > 0 ? (q_max * 0.1) / k : 0;

  if (delta_max_cm > 2.5) warnings.push(`Asentamiento estimado ${delta_max_cm.toFixed(2)} cm > 2.5 cm. Revisar k o agrandar losa.`);
  if (zona >= 3) warnings.push("Zona sísmica ≥ III: confinamiento de columnas debe continuar dentro de la losa.");

  return {
    L, B, h, qa, k, fc, fy, r, zona, ncols,
    SumP_ton: SumP, xR_m: xR, yR_m: yR, ex_m: ex, ey_m: ey,
    Ix_m4: Ix, Iy_m4: Iy,
    q_corner1: q1, q_corner2: q2, q_corner3: q3, q_corner4: q4,
    q_max, q_min, q_ok,
    d_cm,
    worst_col_P: worstP, worst_col_bc: bc, worst_col_hc: hc,
    bo_worst: bo, Vu_pun_worst: Vu_pun, phi_Vc_pun_worst: phi_Vc_pun, pun_ok,
    Mu_strip_x_tonm_per_m: Mu_x_per_m,
    Mu_strip_y_tonm_per_m: Mu_y_per_m,
    As_x_req_cm2_per_m: As_x_req,
    As_y_req_cm2_per_m: As_y_req,
    As_min_cm2_per_m: As_min,
    As_x_prov_cm2_per_m: As_x_eff,
    As_y_prov_cm2_per_m: As_y_eff,
    size_x: bx.size, s_x_cm: bx.s,
    size_y: by.size, s_y_cm: by.s,
    delta_max_cm,
    warnings,
  };
}

export function buildMatFoundationSteps(r: MatFoundationLiveResult): CalculationStep[] {
  return [
    {
      id: "mat.step_01_sumP", name: "Resultante de cargas",
      equation_latex: "\\Sigma P = \\sum_{i} P_i",
      inputs: { ncols: r.ncols }, output_var: "SumP",
      output_value: r.SumP_ton, output_unit: "ton",
      code_ref: "Equilibrio", depends_on: [], note: "",
    },
    {
      id: "mat.step_02_centroid", name: "Centroide de cargas",
      equation_latex: "x_R = \\frac{\\sum P_i x_i}{\\Sigma P}, \\;\\; y_R = \\frac{\\sum P_i y_i}{\\Sigma P}",
      inputs: { SumP: r.SumP_ton },
      output_var: "xR_yR", output_value: r.xR_m, output_unit: "m",
      code_ref: "Bowles §16.2", depends_on: ["mat.step_01_sumP"],
      note: `xR = ${r.xR_m.toFixed(2)} m, yR = ${r.yR_m.toFixed(2)} m.`,
    },
    {
      id: "mat.step_03_ecc", name: "Excentricidades",
      equation_latex: "e_x = x_R - L/2,\\;\\; e_y = y_R - B/2",
      inputs: { xR: r.xR_m, yR: r.yR_m, L: r.L, B: r.B },
      output_var: "ex_ey", output_value: r.ex_m, output_unit: "m",
      code_ref: "Bowles §16.3", depends_on: ["mat.step_02_centroid"],
      note: `ex = ${r.ex_m.toFixed(3)} m, ey = ${r.ey_m.toFixed(3)} m.`,
    },
    {
      id: "mat.step_04_qcorners", name: "Presión en esquinas",
      equation_latex:
        "q = \\frac{\\Sigma P}{L \\cdot B} \\pm \\frac{M_x \\cdot y'}{I_x} \\pm \\frac{M_y \\cdot x'}{I_y}",
      inputs: { SumP: r.SumP_ton, L: r.L, B: r.B },
      output_var: "q_max", output_value: r.q_max, output_unit: "ton/m²",
      code_ref: "ACI 336.2R-88 §5", depends_on: ["mat.step_03_ecc"],
      note: `q1=${r.q_corner1.toFixed(2)} q2=${r.q_corner2.toFixed(2)} q3=${r.q_corner3.toFixed(2)} q4=${r.q_corner4.toFixed(2)}.`,
    },
    {
      id: "mat.step_05_d", name: "Peralte efectivo",
      equation_latex: "d = h - r - 1.5 d_b",
      inputs: { h: r.h, r: r.r },
      output_var: "d", output_value: r.d_cm, output_unit: "cm",
      code_ref: "ACI 318-14 §20.6", depends_on: [],
      note: "Doble malla — se asume #6.",
    },
    {
      id: "mat.step_06_pun", name: "Punzonamiento (col más cargada)",
      equation_latex: "\\phi V_c = \\phi \\cdot v_c \\cdot b_o \\cdot d",
      inputs: { bo: r.bo_worst, d: r.d_cm },
      output_var: "phiVc_pun", output_value: r.phi_Vc_pun_worst, output_unit: "ton",
      code_ref: "ACI 318-14 §22.6.5", depends_on: ["mat.step_05_d"],
      note: r.pun_ok
        ? `OK — Vu=${r.Vu_pun_worst.toFixed(1)} ≤ φVc=${r.phi_Vc_pun_worst.toFixed(1)}`
        : `FALLA — aumentar h.`,
    },
    {
      id: "mat.step_07_Mstrip", name: "Momento por franjas",
      equation_latex: "M_{strip} = \\frac{q_{max} \\cdot L_s^2}{10}",
      inputs: { q: r.q_max, L: r.L, B: r.B },
      output_var: "Mu_x", output_value: r.Mu_strip_x_tonm_per_m, output_unit: "ton·m/m",
      code_ref: "ACI 336.2R-88 §5.3", depends_on: ["mat.step_04_qcorners"],
      note: `Mu_x = ${r.Mu_strip_x_tonm_per_m.toFixed(2)}, Mu_y = ${r.Mu_strip_y_tonm_per_m.toFixed(2)} ton·m/m.`,
    },
    {
      id: "mat.step_08_Asmin", name: "Cuantía mínima (temperatura)",
      equation_latex: "\\rho_{min} = 0.0018,\\;\\; A_{s,min} = 0.0018 \\cdot b \\cdot h",
      inputs: { h: r.h }, output_var: "As_min",
      output_value: r.As_min_cm2_per_m, output_unit: "cm²/m",
      code_ref: "ACI 318-14 §24.4.3.2", depends_on: [], note: "Ambas direcciones, ambas caras combinadas.",
    },
    {
      id: "mat.step_09_As_x", name: "Acero dirección X",
      equation_latex: "A_{s,x} = \\frac{M_u}{\\phi \\cdot f_y \\cdot 0.9 d}",
      inputs: { Mu: r.Mu_strip_x_tonm_per_m, fy: r.fy, d: r.d_cm },
      output_var: "As_x", output_value: r.As_x_prov_cm2_per_m, output_unit: "cm²/m",
      code_ref: "ACI 318-14 §9.6", depends_on: ["mat.step_07_Mstrip"],
      note: `Provisto: #${r.size_x} @ ${r.s_x_cm.toFixed(0)} cm.`,
    },
    {
      id: "mat.step_10_As_y", name: "Acero dirección Y",
      equation_latex: "A_{s,y} = \\frac{M_u}{\\phi \\cdot f_y \\cdot 0.9 d}",
      inputs: { Mu: r.Mu_strip_y_tonm_per_m, fy: r.fy, d: r.d_cm },
      output_var: "As_y", output_value: r.As_y_prov_cm2_per_m, output_unit: "cm²/m",
      code_ref: "ACI 318-14 §9.6", depends_on: ["mat.step_07_Mstrip"],
      note: `Provisto: #${r.size_y} @ ${r.s_y_cm.toFixed(0)} cm.`,
    },
    {
      id: "mat.step_11_winkler", name: "Asentamiento (Winkler)",
      equation_latex: "\\delta = \\frac{q}{k}",
      inputs: { q: r.q_max, k: r.k },
      output_var: "delta", output_value: r.delta_max_cm, output_unit: "cm",
      code_ref: "Terzaghi (1955); Bowles §16.5", depends_on: ["mat.step_04_qcorners"],
      note: "Modelo de Winkler: resorte equivalente bajo cada punto.",
    },
  ];
}

export function buildMatFoundationChecks(r: MatFoundationLiveResult) {
  return [
    {
      nombre: "Presión máxima q_max ≤ qa",
      requerido: r.qa, disponible: r.q_max,
      unidad: "ton/m²", cumple: r.q_max <= r.qa,
      referencia: "ACI 318-14 §13.3.1", critical: true,
    },
    {
      nombre: "Presión mínima ≥ 0 (sin tracción)",
      requerido: 0, disponible: r.q_min,
      unidad: "ton/m²", cumple: r.q_min >= 0,
      referencia: "Bowles §16.3", critical: true,
    },
    {
      nombre: "Punzonamiento col más cargada",
      requerido: r.Vu_pun_worst, disponible: r.phi_Vc_pun_worst,
      unidad: "ton", cumple: r.pun_ok,
      referencia: "ACI 318-14 §22.6.5", critical: true,
    },
    {
      nombre: "Acero X ≥ As_min (temperatura)",
      requerido: r.As_min_cm2_per_m, disponible: r.As_x_prov_cm2_per_m,
      unidad: "cm²/m", cumple: r.As_x_prov_cm2_per_m >= r.As_min_cm2_per_m,
      referencia: "ACI 318-14 §24.4.3.2", critical: true,
    },
    {
      nombre: "Acero Y ≥ As_min (temperatura)",
      requerido: r.As_min_cm2_per_m, disponible: r.As_y_prov_cm2_per_m,
      unidad: "cm²/m", cumple: r.As_y_prov_cm2_per_m >= r.As_min_cm2_per_m,
      referencia: "ACI 318-14 §24.4.3.2", critical: true,
    },
    {
      nombre: "Asentamiento ≤ 2.5 cm",
      requerido: 2.5, disponible: r.delta_max_cm,
      unidad: "cm", cumple: r.delta_max_cm <= 2.5,
      referencia: "Bowles §16.5", critical: false,
    },
  ];
}
