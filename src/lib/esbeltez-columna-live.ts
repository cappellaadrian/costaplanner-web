/**
 * Esbeltez de columna — clasificación + magnificación de momentos.
 *
 * References:
 *   - ACI 318-14 §6.2.5    (Slenderness, short vs slender)
 *   - ACI 318-14 §6.6.4    (Moment magnification — non-sway)
 *   - ACI 318-14 §6.6.4.5.2 (EI, βdns, Cm)
 *   - CSCR-10 Rev. 2014 §8.2 (Análisis de segundo orden)
 *
 * Procedure:
 *   1. Radio de giro:       r = 0.30·h (rect),  r = 0.25·D (circular)
 *   2. Relación de esbeltez: klu / r
 *   3. Frame arriostrado (non-sway):
 *        corta si  klu/r ≤ 34 − 12·(M1/M2) ≤ 40
 *   4. Frame no arriostrado (sway):
 *        corta si  klu/r ≤ 22
 *   5. Si esbelta y braced → magnificar M2:
 *        EI = 0.4·Ec·Ig / (1 + βdns)
 *        Pc = π²·EI / (k·lu)²
 *        Cm = 0.6 + 0.4·M1/M2 ≥ 0.4
 *        δns = Cm / (1 − Pu/(0.75·Pc)) ≥ 1.0
 *        Mc = δns · M2
 *   6. klu/r > 100 → análisis P-Δ no lineal obligatorio (CSCR §8.2.1).
 *
 * Sign convention: M1 (smaller end moment), M2 (larger end moment). For
 * double curvature M1/M2 < 0 (negative). For single curvature M1/M2 > 0.
 *
 * Units: cm, kg/cm², ton, ton·m. Ec = 15100·√f'c (kg/cm²) — ACI §19.2.2.1.
 */
import type { CalculationStep } from "./beam-flexure-live";

export type ColumnShape = "rect" | "circ";
export type FrameType = "braced" | "unbraced";

export interface EsbeltezInput {
  shape: ColumnShape;
  // Rectangular:
  b_cm: number;
  h_cm: number;
  // Circular:
  D_cm: number;
  // Geometry
  lu_m: number;        // longitud no arriostrada (m)
  k: number;           // factor de longitud efectiva
  frame: FrameType;
  // Cargas
  Pu_ton: number;
  M1_tonm: number;     // momento menor — signo: − si doble curvatura
  M2_tonm: number;     // momento mayor — siempre tomado positivo
  // Para EI: βdns ≈ Pu_DL / Pu (típico 0.6)
  beta_dns: number;
  // Materiales
  fc: number;          // kg/cm²
  fy: number;          // kg/cm² (no usado en esbeltez, sólo para referencia futura)
}

export interface EsbeltezLiveResult {
  // echo
  shape: ColumnShape; b: number; h: number; D: number;
  lu_m: number; k: number; frame: FrameType;
  Pu_ton: number; M1_tonm: number; M2_tonm: number;
  beta_dns: number; fc: number; fy: number;

  // computed
  r_cm: number;
  klu_r: number;
  M1_M2: number;
  limit_short: number;   // 34 - 12·M1/M2 (braced) ó 22 (unbraced)
  is_short: boolean;
  exceeds_PDelta: boolean;  // klu/r > 100

  // Magnification (only if slender + braced)
  Ec_kgcm2: number;
  Ig_cm4: number;
  EI_kgcm2: number;
  Pc_ton: number;
  Cm: number;
  one_minus_term: number;
  delta_ns: number;
  Mc_tonm: number;

  warnings: string[];
}

export function computeEsbeltezLive(input: EsbeltezInput): EsbeltezLiveResult {
  const {
    shape, b_cm, h_cm, D_cm, lu_m, k, frame,
    Pu_ton, M1_tonm, M2_tonm, beta_dns, fc, fy,
  } = input;
  const warnings: string[] = [];

  // ---- 1. Radio de giro ----
  const r = shape === "rect" ? 0.30 * h_cm : 0.25 * D_cm;

  // ---- 2. Relación de esbeltez ----
  const lu_cm = lu_m * 100;
  const klu_r = r > 0 ? (k * lu_cm) / r : 0;

  // ---- 3. Clasificación ----
  const M1_M2 = M2_tonm !== 0 ? M1_tonm / M2_tonm : 0;
  let limit_short = 22;
  let is_short = false;
  if (frame === "braced") {
    // braced: short if klu/r ≤ min(34 − 12·M1/M2, 40)
    const raw = 34 - 12 * M1_M2;
    limit_short = Math.min(Math.max(raw, 0), 40);
    is_short = klu_r <= limit_short;
  } else {
    limit_short = 22;
    is_short = klu_r <= limit_short;
  }

  const exceeds_PDelta = klu_r > 100;
  if (exceeds_PDelta) {
    warnings.push(
      `klu/r = ${klu_r.toFixed(1)} > 100 — requiere análisis P-Δ no lineal ` +
      `(ACI §6.6.4.3, CSCR §8.2.1).`,
    );
  }

  // ---- 4–5. Magnificación si esbelta ----
  // Ec ACI §19.2.2.1: Ec = 15100·√f'c (kg/cm²)
  const Ec = 15100 * Math.sqrt(fc);
  let Ig: number;
  if (shape === "rect") {
    Ig = (b_cm * Math.pow(h_cm, 3)) / 12.0;
  } else {
    Ig = (Math.PI * Math.pow(D_cm, 4)) / 64.0;
  }
  const EI = (0.4 * Ec * Ig) / (1 + beta_dns);
  // Pc = π² · EI / (k·lu)²    →  EI in kg·cm², k·lu in cm  →  Pc in kg
  const Pc_kg = (Math.PI * Math.PI * EI) / Math.pow(k * lu_cm, 2);
  const Pc_ton = Pc_kg / 1000;

  // Cm — only meaningful for braced columns; ACI §6.6.4.5.3:
  // Cm = 0.6 + 0.4·(M1/M2) ≥ 0.4 ; for unbraced Cm = 1.0
  let Cm: number;
  if (frame === "braced") {
    Cm = Math.max(0.6 + 0.4 * M1_M2, 0.4);
  } else {
    Cm = 1.0;
  }

  // δns = Cm / (1 − Pu / (0.75·Pc)) ≥ 1.0
  const denom_term = 1 - Pu_ton / (0.75 * Pc_ton);
  let delta_ns: number;
  if (denom_term <= 0) {
    delta_ns = Number.POSITIVE_INFINITY;
    warnings.push(
      `Pu = ${Pu_ton.toFixed(1)} ton se acerca o supera 0.75·Pc = ` +
      `${(0.75 * Pc_ton).toFixed(1)} ton — la columna se aproxima a falla por pandeo. ` +
      `Aumentar sección.`,
    );
  } else {
    delta_ns = Math.max(Cm / denom_term, 1.0);
  }

  // Mc = δns · M2 (no aplica si es corta — pasa M2 directo)
  const Mc = is_short ? M2_tonm : (isFinite(delta_ns) ? delta_ns * M2_tonm : Number.POSITIVE_INFINITY);

  if (!is_short && frame === "unbraced") {
    warnings.push(
      "Columna esbelta en marco no arriostrado: requiere análisis de segundo orden " +
      "completo del marco (no sólo magnificación local). ACI §6.6.4.6.",
    );
  }

  return {
    shape, b: b_cm, h: h_cm, D: D_cm,
    lu_m, k, frame,
    Pu_ton, M1_tonm, M2_tonm, beta_dns, fc, fy,
    r_cm: r, klu_r, M1_M2, limit_short, is_short, exceeds_PDelta,
    Ec_kgcm2: Ec, Ig_cm4: Ig, EI_kgcm2: EI,
    Pc_ton, Cm,
    one_minus_term: denom_term,
    delta_ns, Mc_tonm: Mc,
    warnings,
  };
}

export function buildEsbeltezSteps(r: EsbeltezLiveResult): CalculationStep[] {
  const finiteMc = isFinite(r.Mc_tonm) ? r.Mc_tonm : 9999;
  const finiteDelta = isFinite(r.delta_ns) ? r.delta_ns : 9999;
  return [
    {
      id: "esbeltez.step_01_r",
      name: "Radio de giro",
      equation_latex: r.shape === "rect"
        ? "r = 0.30 \\cdot h"
        : "r = 0.25 \\cdot D",
      inputs: r.shape === "rect" ? { h: r.h } : { D: r.D },
      output_var: "r",
      output_value: r.r_cm,
      output_unit: "cm",
      code_ref: "ACI 318-14 §6.2.5.1",
      depends_on: [],
      note: r.shape === "rect" ? "Sección rectangular." : "Sección circular.",
    },
    {
      id: "esbeltez.step_02_klu_r",
      name: "Relación de esbeltez",
      equation_latex: "\\frac{k \\, l_u}{r}",
      inputs: { k: r.k, lu_cm: r.lu_m * 100, r_val: r.r_cm },
      output_var: "klu_r",
      output_value: r.klu_r,
      output_unit: "",
      code_ref: "ACI 318-14 §6.2.5",
      depends_on: ["esbeltez.step_01_r"],
      note: r.exceeds_PDelta ? "klu/r > 100 — requiere P-Δ no lineal." : "",
    },
    {
      id: "esbeltez.step_03_M1_M2",
      name: "Relación M1/M2",
      equation_latex: "M_1 / M_2",
      inputs: { M1: r.M1_tonm, M2: r.M2_tonm },
      output_var: "M1_M2",
      output_value: r.M1_M2,
      output_unit: "",
      code_ref: "ACI 318-14 §6.6.4.5.3",
      depends_on: [],
      note: r.M1_M2 < 0 ? "Doble curvatura (signo negativo)." : "Curvatura simple.",
    },
    {
      id: "esbeltez.step_04_classify",
      name: "Clasificación de esbeltez",
      equation_latex: r.frame === "braced"
        ? "k l_u / r \\leq 34 - 12\\, M_1/M_2 \\leq 40"
        : "k l_u / r \\leq 22",
      inputs: { klu_r: r.klu_r, limit: r.limit_short },
      output_var: "is_short",
      output_value: r.is_short ? 1 : 0,
      output_unit: "",
      code_ref: "ACI 318-14 §6.2.5",
      depends_on: ["esbeltez.step_02_klu_r"],
      note: r.is_short
        ? "Columna CORTA — no requiere magnificación."
        : "Columna ESBELTA — se magnifica M2.",
    },
    {
      id: "esbeltez.step_05_Ec",
      name: "Módulo elástico del concreto",
      equation_latex: "E_c = 15{,}100 \\sqrt{f'_c}",
      inputs: { fc: r.fc },
      output_var: "Ec",
      output_value: r.Ec_kgcm2,
      output_unit: "kg/cm²",
      code_ref: "ACI 318-14 §19.2.2.1",
      depends_on: [],
      note: "",
    },
    {
      id: "esbeltez.step_06_Ig",
      name: "Inercia bruta de la sección",
      equation_latex: r.shape === "rect"
        ? "I_g = \\frac{b \\cdot h^{3}}{12}"
        : "I_g = \\frac{\\pi \\cdot D^{4}}{64}",
      inputs: r.shape === "rect" ? { b: r.b, h: r.h } : { D: r.D },
      output_var: "Ig",
      output_value: r.Ig_cm4,
      output_unit: "cm⁴",
      code_ref: "Geometría",
      depends_on: [],
      note: "",
    },
    {
      id: "esbeltez.step_07_EI",
      name: "Rigidez reducida EI (ACI §6.6.4.4.4)",
      equation_latex: "EI = \\frac{0.4 \\, E_c \\, I_g}{1 + \\beta_{dns}}",
      inputs: { Ec: r.Ec_kgcm2, Ig: r.Ig_cm4, beta: r.beta_dns },
      output_var: "EI",
      output_value: r.EI_kgcm2,
      output_unit: "kg·cm²",
      code_ref: "ACI 318-14 §6.6.4.4.4",
      depends_on: ["esbeltez.step_05_Ec", "esbeltez.step_06_Ig"],
      note: "Captura el efecto de creep bajo carga sostenida.",
    },
    {
      id: "esbeltez.step_08_Pc",
      name: "Carga crítica de Euler",
      equation_latex: "P_c = \\frac{\\pi^{2} EI}{(k l_u)^{2}}",
      inputs: { EI: r.EI_kgcm2, k_lu: r.k * r.lu_m * 100 },
      output_var: "Pc",
      output_value: r.Pc_ton,
      output_unit: "ton",
      code_ref: "ACI 318-14 §6.6.4.4.2",
      depends_on: ["esbeltez.step_07_EI"],
      note: "",
    },
    {
      id: "esbeltez.step_09_Cm",
      name: "Factor de modificación Cm",
      equation_latex: r.frame === "braced"
        ? "C_m = 0.6 + 0.4 \\, \\frac{M_1}{M_2} \\geq 0.4"
        : "C_m = 1.0",
      inputs: r.frame === "braced" ? { M1_M2: r.M1_M2 } : {},
      output_var: "Cm",
      output_value: r.Cm,
      output_unit: "",
      code_ref: "ACI 318-14 §6.6.4.5.3",
      depends_on: ["esbeltez.step_03_M1_M2"],
      note: "",
    },
    {
      id: "esbeltez.step_10_delta",
      name: "Factor de magnificación δns",
      equation_latex:
        "\\delta_{ns} = \\frac{C_m}{1 - \\dfrac{P_u}{0.75\\, P_c}} \\;\\geq\\; 1.0",
      inputs: { Cm: r.Cm, Pu: r.Pu_ton, Pc: r.Pc_ton },
      output_var: "delta_ns",
      output_value: finiteDelta,
      output_unit: "",
      code_ref: "ACI 318-14 §6.6.4.5",
      depends_on: ["esbeltez.step_08_Pc", "esbeltez.step_09_Cm"],
      note: r.one_minus_term <= 0
        ? "Denominador ≤ 0: columna falla por pandeo, rediseñar."
        : "",
    },
    {
      id: "esbeltez.step_11_Mc",
      name: "Momento magnificado de diseño",
      equation_latex: r.is_short
        ? "M_c = M_2 \\;(\\text{columna corta})"
        : "M_c = \\delta_{ns} \\cdot M_2",
      inputs: { delta: finiteDelta, M2: r.M2_tonm },
      output_var: "Mc",
      output_value: finiteMc,
      output_unit: "ton·m",
      code_ref: "ACI 318-14 §6.6.4.5.2",
      depends_on: ["esbeltez.step_04_classify", "esbeltez.step_10_delta"],
      note: r.is_short ? "Columna corta: M2 no se magnifica." : "",
    },
  ];
}

export function buildEsbeltezChecks(r: EsbeltezLiveResult) {
  return [
    {
      nombre: "klu/r ≤ 100 (sin P-Δ)",
      requerido: 100,
      disponible: r.klu_r,
      unidad: "",
      cumple: !r.exceeds_PDelta,
      referencia: "ACI 318-14 §6.6.4.3 · CSCR §8.2.1",
      critical: true,
    },
    {
      nombre: "Estabilidad: Pu ≤ 0.75·Pc",
      requerido: r.Pu_ton,
      disponible: 0.75 * r.Pc_ton,
      unidad: "ton",
      cumple: r.one_minus_term > 0,
      referencia: "ACI 318-14 §6.6.4.5.2",
      critical: true,
    },
    {
      nombre: r.is_short ? "Columna corta" : "Columna esbelta",
      requerido: r.limit_short,
      disponible: r.klu_r,
      unidad: "",
      cumple: true,
      referencia: "ACI 318-14 §6.2.5",
      critical: false,
    },
    {
      nombre: "Mc / M2 (magnificación)",
      requerido: 1.0,
      disponible: r.M2_tonm > 0 && isFinite(r.Mc_tonm) ? r.Mc_tonm / r.M2_tonm : 1.0,
      unidad: "",
      cumple: isFinite(r.Mc_tonm),
      referencia: "ACI 318-14 §6.6.4.5",
      critical: false,
    },
  ];
}
