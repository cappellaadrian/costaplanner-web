/**
 * Deflexión a largo plazo — Vigas y losas en 1 dirección.
 *
 * References:
 *   - ACI 318-14 §24.2 — Deflection (immediate and time-dependent)
 *   - ACI 318-14 §24.2.3.5 — Effective moment of inertia (Branson)
 *   - ACI 318-14 Table 24.2.2 — Span/depth limits for deflection criteria
 *   - ACI 318-14 §24.2.4 — Long-term deflection multiplier λΔ
 *   - Branson, D.E. (1965), "Instantaneous and Time-Dependent Deflections of
 *     Simple and Continuous Reinforced Concrete Beams", HPR Report No. 7,
 *     Alabama Highway Department.
 *   - ACI Committee 435 (1991), "Deflections of Reinforced Concrete Flexural
 *     Members under Service Loads."
 *   - MacGregor (2009), Reinforced Concrete §9.
 *
 * Procedure:
 *   1. Ig = b·h³/12. Sección transformada n = Es/Ec.
 *   2. fr = 2·√f'c (kg/cm²). Mcr = fr·Ig/(h/2).
 *   3. Compute kd (cracked NA) from b·kd²/2 = n·As·(d - kd) [singly] or
 *      similar including As'.
 *   4. Icr = b·(kd)³/3 + n·As·(d - kd)² + (2n-1)·As'·(kd - d')².
 *   5. Ma = momento de servicio (D+L o D solamente para sustained).
 *   6. Ie = (Mcr/Ma)³·Ig + (1-(Mcr/Ma)³)·Icr   ≤ Ig.
 *   7. Δinst = K·w·L⁴/(E·Ie) usando coeficiente K por tipo de apoyo.
 *   8. λΔ = ξ/(1+50·ρ')   ξ = 2.0 (5+años) → §24.2.4.1.
 *   9. Δlong = λΔ·Δinst,sus. Δtotal = Δinst,L + Δlong.
 *  10. Comparar contra ACI Table 24.2.2.
 *
 * Units: cm, kg, kg/cm², m, ton/m, ton·m. Output Δ en cm.
 */
import type { CalculationStep } from "./beam-flexure-live";
import type { StudioCheck } from "@/components/studio/StudioShell";

export type ElementoType = "viga_simple" | "viga_continua" | "losa_1dir" | "volado";
export type DeflectionLimit = "L/240" | "L/360" | "L/480" | "L/180";

export interface DeflexionLargoPlazoInput {
  tipo: ElementoType;
  L_m: number;             // luz libre o longitud del volado
  b_cm: number;            // ancho (para losa = 100)
  h_cm: number;            // peralte total
  d_cm: number;            // peralte efectivo
  r_cm: number;            // recubrimiento
  fc: number;              // kg/cm²
  fy: number;              // kg/cm²
  As_cm2: number;          // acero traccionado provisto
  AsP_cm2: number;         // acero a compresión (As') provisto
  wD_tonm: number;         // carga muerta (servicio) ton/m lineal
  wL_tonm: number;         // carga viva (servicio) ton/m lineal
  sustained_fraction_L: number; // fracción de L que se considera sostenida (0-1)
  age_loading_days: number; // edad de aplicación de carga sostenida (días)
  limite: DeflectionLimit;
}

export interface DeflexionLargoPlazoResult {
  // echo
  tipo: ElementoType; L: number; b: number; h: number; d: number; r: number;
  fc: number; fy: number; As: number; AsP: number;
  wD: number; wL: number; sustained_fraction_L: number;
  age_loading_days: number; limite: DeflectionLimit;

  // Materials
  Ec_kgcm2: number;        // módulo del concreto (15100·√f'c)
  Es_kgcm2: number;        // 2.04e6
  n_ratio: number;         // Es/Ec
  fr_kgcm2: number;        // modulo de ruptura

  // Sección
  Ig_cm4: number;          // bruto
  yt_cm: number;           // h/2 (centroide bruto)
  Mcr_tonm: number;        // momento de agrietamiento
  kd_cm: number;           // profundidad NA fisurada
  Icr_cm4: number;         // fisurada transformada

  // Cargas
  Ma_D_tonm: number;       // momento de servicio bajo wD
  Ma_DL_tonm: number;      // momento bajo wD + wL
  Ma_sus_tonm: number;     // sostenida = wD + sustained_fraction · wL

  // Ie
  Ie_D: number;
  Ie_DL: number;
  Ie_sus: number;

  // Deflexiones inmediatas
  K_factor: number;        // coeficiente según apoyo
  delta_inst_D_cm: number;
  delta_inst_DL_cm: number;
  delta_inst_L_cm: number; // = ΔDL − ΔD
  delta_inst_sus_cm: number;

  // Largo plazo
  rho_prime: number;       // As'/(b·d)
  xi: number;              // factor por edad (2.0 a 5+ años)
  lambda_delta: number;    // ξ/(1+50ρ')
  delta_long_cm: number;   // = λΔ·Δsus
  delta_total_cm: number;  // = Δinst,L + Δlong

  // Límite
  limit_cm: number;
  limite_ok: boolean;

  warnings: string[];
}

function K_coeff(tipo: ElementoType): number {
  // Δmax = K · w·L⁴ / (E·Ie)
  switch (tipo) {
    case "viga_simple":   return 5 / 384;  // 5wL⁴/384EI
    case "viga_continua": return 1 / 384;  // wL⁴/384EI (aprox. simétrica empotrada)
    case "losa_1dir":     return 5 / 384;
    case "volado":        return 1 / 8;    // wL⁴/8EI
  }
}

function limit_factor(l: DeflectionLimit): number {
  switch (l) {
    case "L/240": return 1 / 240;
    case "L/360": return 1 / 360;
    case "L/480": return 1 / 480;
    case "L/180": return 1 / 180;
  }
}

export function computeDeflexionLargoPlazoLive(
  input: DeflexionLargoPlazoInput,
): DeflexionLargoPlazoResult {
  const {
    tipo, L_m: L, b_cm: b, h_cm: h, d_cm: d, r_cm: r,
    fc, fy, As_cm2: As, AsP_cm2: AsP,
    wD_tonm: wD, wL_tonm: wL, sustained_fraction_L: sus, age_loading_days,
    limite,
  } = input;
  const warnings: string[] = [];

  // Materials
  const Ec = 15100 * Math.sqrt(fc);       // kg/cm²
  const Es = 2_040_000;                    // kg/cm²
  const n = Ec > 0 ? Es / Ec : 0;
  const fr = 2 * Math.sqrt(fc);            // kg/cm²

  // Sección bruta
  const Ig = (b * Math.pow(h, 3)) / 12;
  const yt = h / 2;
  const Mcr_kgcm = yt > 0 ? (fr * Ig) / yt : 0;
  const Mcr = Mcr_kgcm / 100_000;          // ton·m

  // Profundidad NA fisurada (sección singly reinforced con As'):
  // b·kd²/2 + (n-1)·As'·(kd - d') = n·As·(d - kd)
  const dp = r + 1.0;                      // posición de As'
  // Resolver: (b/2)·kd² + (n·As + (n-1)·As')·kd − [n·As·d + (n-1)·As'·dp] = 0
  const A = b / 2;
  const B = n * As + (n - 1) * AsP;
  const C = -(n * As * d + (n - 1) * AsP * dp);
  let kd = 0;
  if (A > 0) {
    const disc = B * B - 4 * A * C;
    kd = disc >= 0 ? (-B + Math.sqrt(disc)) / (2 * A) : 0;
  }
  kd = Math.max(0, Math.min(d, kd));

  // Icr = b·kd³/3 + n·As·(d-kd)² + (n-1)·As'·(kd-d')²
  const Icr = (b * Math.pow(kd, 3)) / 3
            + n * As * Math.pow(d - kd, 2)
            + (n - 1) * AsP * Math.pow(Math.max(0, kd - dp), 2);

  // Momentos de servicio
  // Para viga simple: M = w·L²/8 ; volado: M = w·L²/2 ; continua: M ≈ w·L²/10
  let Mcoeff = 1 / 8;
  if (tipo === "viga_continua") Mcoeff = 1 / 10;
  if (tipo === "volado") Mcoeff = 1 / 2;
  if (tipo === "losa_1dir") Mcoeff = 1 / 8;
  const Ma_D = Mcoeff * wD * L * L;
  const Ma_DL = Mcoeff * (wD + wL) * L * L;
  const Ma_sus = Mcoeff * (wD + sus * wL) * L * L;

  // Ie (Branson)
  const branson = (Ma: number) => {
    if (Ma <= 0) return Ig;
    if (Mcr >= Ma) return Ig;
    const ratio = Math.pow(Mcr / Ma, 3);
    return Math.min(Ig, ratio * Ig + (1 - ratio) * Icr);
  };
  const Ie_D = branson(Ma_D);
  const Ie_DL = branson(Ma_DL);
  const Ie_sus = branson(Ma_sus);

  // Deflexiones inmediatas
  const K = K_coeff(tipo);
  const L_cm = L * 100;
  // w en kg/cm: ton/m × 1000 / 100
  const w_to_kgcm = (w_tonm: number) => (w_tonm * 1000) / 100;
  const wD_kg = w_to_kgcm(wD);
  const wL_kg = w_to_kgcm(wL);
  const wSus_kg = w_to_kgcm(wD + sus * wL);

  const delta = (w_kgcm: number, Ie: number) =>
    Ec > 0 && Ie > 0 ? (K * w_kgcm * Math.pow(L_cm, 4)) / (Ec * Ie) : 0;

  const delta_inst_D = delta(wD_kg, Ie_D);
  const delta_inst_DL = delta(wD_kg + wL_kg, Ie_DL);
  const delta_inst_L = Math.max(0, delta_inst_DL - delta_inst_D);
  const delta_inst_sus = delta(wSus_kg, Ie_sus);

  // Largo plazo
  const rho_prime = b * d > 0 ? AsP / (b * d) : 0;
  let xi = 2.0;
  if (age_loading_days < 3 * 30) xi = 1.0;
  else if (age_loading_days < 6 * 30) xi = 1.2;
  else if (age_loading_days < 12 * 30) xi = 1.4;
  else if (age_loading_days < 5 * 365) xi = 1.8;
  else xi = 2.0;
  const lambda_delta = xi / (1 + 50 * rho_prime);
  const delta_long = lambda_delta * delta_inst_sus;
  const delta_total = delta_inst_L + delta_long;

  // Límite
  const limit_cm = limit_factor(limite) * L_cm;
  const ok = delta_total <= limit_cm;
  if (!ok) warnings.push(
    `Δtotal = ${delta_total.toFixed(2)} cm > límite ${limit_cm.toFixed(2)} cm. Aumentar h, As', o disminuir luz.`,
  );

  if (rho_prime === 0)
    warnings.push("As' = 0 → λΔ máximo. Considerar añadir acero a compresión.");

  return {
    tipo, L, b, h, d, r, fc, fy, As, AsP, wD, wL,
    sustained_fraction_L: sus, age_loading_days, limite,
    Ec_kgcm2: Ec, Es_kgcm2: Es, n_ratio: n, fr_kgcm2: fr,
    Ig_cm4: Ig, yt_cm: yt, Mcr_tonm: Mcr,
    kd_cm: kd, Icr_cm4: Icr,
    Ma_D_tonm: Ma_D, Ma_DL_tonm: Ma_DL, Ma_sus_tonm: Ma_sus,
    Ie_D, Ie_DL, Ie_sus,
    K_factor: K,
    delta_inst_D_cm: delta_inst_D,
    delta_inst_DL_cm: delta_inst_DL,
    delta_inst_L_cm: delta_inst_L,
    delta_inst_sus_cm: delta_inst_sus,
    rho_prime, xi, lambda_delta,
    delta_long_cm: delta_long,
    delta_total_cm: delta_total,
    limit_cm, limite_ok: ok,
    warnings,
  };
}

export function buildDeflexionLargoPlazoSteps(r: DeflexionLargoPlazoResult): CalculationStep[] {
  return [
    {
      id: "deflex.step_01_Ec",
      name: "Módulo del concreto Ec",
      equation_latex: "E_c = 15100 \\sqrt{f'_c}",
      inputs: { fc: r.fc },
      output_var: "Ec",
      output_value: r.Ec_kgcm2,
      output_unit: "kg/cm²",
      code_ref: "ACI 318-14 §19.2.2",
      depends_on: [],
      note: `n = Es/Ec = ${r.n_ratio.toFixed(2)}`,
    },
    {
      id: "deflex.step_02_Ig",
      name: "Momento de inercia bruto Ig",
      equation_latex: "I_g = b \\cdot h^3 / 12",
      inputs: { b: r.b, h: r.h },
      output_var: "Ig",
      output_value: r.Ig_cm4,
      output_unit: "cm⁴",
      code_ref: "Mecánica",
      depends_on: [],
      note: "",
    },
    {
      id: "deflex.step_03_Mcr",
      name: "Momento de agrietamiento Mcr",
      equation_latex: "M_{cr} = \\frac{f_r \\cdot I_g}{y_t}, \\;\\; f_r = 2\\sqrt{f'_c}",
      inputs: { fr: r.fr_kgcm2, Ig: r.Ig_cm4, yt: r.yt_cm },
      output_var: "Mcr",
      output_value: r.Mcr_tonm,
      output_unit: "ton·m",
      code_ref: "ACI 318-14 §24.2.3.5b",
      depends_on: ["deflex.step_02_Ig"],
      note: "fr = módulo de ruptura.",
    },
    {
      id: "deflex.step_04_kd",
      name: "Profundidad NA fisurada kd",
      equation_latex: "\\frac{b kd^2}{2} + (n-1)A_s'(kd-d') = n A_s (d-kd)",
      inputs: { b: r.b, d: r.d, As: r.As, AsP: r.AsP, n: r.n_ratio },
      output_var: "kd",
      output_value: r.kd_cm,
      output_unit: "cm",
      code_ref: "Análisis sección fisurada transformada",
      depends_on: ["deflex.step_01_Ec"],
      note: "",
    },
    {
      id: "deflex.step_05_Icr",
      name: "Momento de inercia fisurado Icr",
      equation_latex: "I_{cr} = \\frac{b \\cdot kd^3}{3} + nA_s(d-kd)^2 + (n-1)A_s'(kd-d')^2",
      inputs: { b: r.b, kd: r.kd_cm, As: r.As, AsP: r.AsP, n: r.n_ratio },
      output_var: "Icr",
      output_value: r.Icr_cm4,
      output_unit: "cm⁴",
      code_ref: "Sección transformada",
      depends_on: ["deflex.step_04_kd"],
      note: `Icr/Ig = ${(r.Icr_cm4 / r.Ig_cm4 * 100).toFixed(1)}%`,
    },
    {
      id: "deflex.step_06_Ma",
      name: "Momentos de servicio",
      equation_latex: "M_a = K_M \\cdot w \\cdot L^2",
      inputs: { wD: r.wD, wL: r.wL, L: r.L },
      output_var: "Ma_DL",
      output_value: r.Ma_DL_tonm,
      output_unit: "ton·m",
      code_ref: "Análisis lineal",
      depends_on: [],
      note: `D = ${r.Ma_D_tonm.toFixed(2)}, sostenida = ${r.Ma_sus_tonm.toFixed(2)} ton·m`,
    },
    {
      id: "deflex.step_07_Ie",
      name: "Inercia efectiva Ie (Branson)",
      equation_latex: "I_e = \\left(\\frac{M_{cr}}{M_a}\\right)^3 I_g + \\left[1 - \\left(\\frac{M_{cr}}{M_a}\\right)^3\\right] I_{cr}",
      inputs: { Mcr: r.Mcr_tonm, Ma: r.Ma_DL_tonm, Ig: r.Ig_cm4, Icr: r.Icr_cm4 },
      output_var: "Ie",
      output_value: r.Ie_DL,
      output_unit: "cm⁴",
      code_ref: "ACI 318-14 §24.2.3.5a",
      depends_on: ["deflex.step_05_Icr"],
      note: `Ie_D = ${r.Ie_D.toFixed(0)}, Ie_sus = ${r.Ie_sus.toFixed(0)} cm⁴`,
    },
    {
      id: "deflex.step_08_dinst",
      name: "Deflexión inmediata por carga viva",
      equation_latex: "\\Delta_{inst,L} = K \\cdot \\frac{w_L \\cdot L^4}{E_c \\cdot I_e}",
      inputs: { K: r.K_factor, wL: r.wL, L: r.L, Ec: r.Ec_kgcm2, Ie: r.Ie_DL },
      output_var: "delta_inst_L",
      output_value: r.delta_inst_L_cm,
      output_unit: "cm",
      code_ref: "ACI 318-14 §24.2.3",
      depends_on: ["deflex.step_07_Ie"],
      note: `Δinst,D = ${r.delta_inst_D_cm.toFixed(3)} cm, Δinst,sus = ${r.delta_inst_sus_cm.toFixed(3)} cm`,
    },
    {
      id: "deflex.step_09_lambda",
      name: "Multiplicador de largo plazo λΔ",
      equation_latex: "\\lambda_\\Delta = \\frac{\\xi}{1 + 50 \\rho'}",
      inputs: { xi: r.xi, rhoP: r.rho_prime },
      output_var: "lambda",
      output_value: r.lambda_delta,
      output_unit: "",
      code_ref: "ACI 318-14 §24.2.4.1",
      depends_on: [],
      note: `ξ = ${r.xi.toFixed(1)} para ${r.age_loading_days} días, ρ' = ${(r.rho_prime * 100).toFixed(2)}%`,
    },
    {
      id: "deflex.step_10_dlp",
      name: "Deflexión adicional por largo plazo",
      equation_latex: "\\Delta_{lp} = \\lambda_\\Delta \\cdot \\Delta_{inst,sus}",
      inputs: { lambda: r.lambda_delta, d_sus: r.delta_inst_sus_cm },
      output_var: "delta_lp",
      output_value: r.delta_long_cm,
      output_unit: "cm",
      code_ref: "ACI 318-14 §24.2.4",
      depends_on: ["deflex.step_09_lambda"],
      note: "",
    },
    {
      id: "deflex.step_11_dtotal",
      name: "Deflexión total = Δinst,L + Δlp",
      equation_latex: "\\Delta_{tot} = \\Delta_{inst,L} + \\Delta_{lp}",
      inputs: { d_L: r.delta_inst_L_cm, d_lp: r.delta_long_cm },
      output_var: "delta_tot",
      output_value: r.delta_total_cm,
      output_unit: "cm",
      code_ref: "ACI 318-14 Table 24.2.2",
      depends_on: ["deflex.step_08_dinst", "deflex.step_10_dlp"],
      note: `Límite ${r.limite} = ${r.limit_cm.toFixed(2)} cm. ${r.limite_ok ? "OK" : "FALLA"}.`,
    },
  ];
}

export function buildDeflexionLargoPlazoChecks(r: DeflexionLargoPlazoResult): StudioCheck[] {
  return [
    {
      nombre: `Δtotal ≤ ${r.limite}`,
      requerido: r.limit_cm,
      disponible: r.delta_total_cm,
      unidad: "cm",
      cumple: r.limite_ok,
      referencia: "ACI 318-14 Table 24.2.2",
      critical: true,
    },
    {
      nombre: "Mcr ≤ Ma (sección está agrietada)",
      requerido: r.Mcr_tonm,
      disponible: r.Ma_DL_tonm,
      unidad: "ton·m",
      cumple: r.Ma_DL_tonm >= r.Mcr_tonm,
      referencia: "ACI 318-14 §24.2.3.5",
      critical: false,
    },
    {
      nombre: "Δinst,L ≤ L/360",
      requerido: r.L * 100 / 360,
      disponible: r.delta_inst_L_cm,
      unidad: "cm",
      cumple: r.delta_inst_L_cm <= r.L * 100 / 360,
      referencia: "ACI 318-14 Table 24.2.2",
      critical: false,
    },
  ];
}
