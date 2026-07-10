/**
 * Capacidad portante de cimentaciones superficiales — comparativa
 * Meyerhof (1963), Hansen (1970) y Vesić (1973).
 *
 * Sources:
 * - Terzaghi (1943). Theoretical Soil Mechanics. Wiley.
 * - Meyerhof, G.G. (1963). "Some Recent Research on the Bearing Capacity
 *   of Foundations." Canadian Geotechnical Journal 1(1): 16-26.
 * - Hansen, J. Brinch (1970). "A Revised and Extended Formula for Bearing
 *   Capacity." Bulletin No. 28, Danish Geotechnical Institute, Copenhagen.
 * - Vesić, A.S. (1973). "Analysis of Ultimate Loads of Shallow Foundations."
 *   JSMFD 99(SM1): 45-73.
 * - Bowles (1996), Foundation Analysis and Design, 5ed §4.
 * - Das (2016), Principles of Geotechnical Engineering, 9ed §16.
 * - Código de Cimentaciones de Costa Rica (2009) §5.
 * - CSCR-10 Rev. 2014 §6 — combinaciones para suelo.
 */

export interface BearingInput {
  /** Ancho de la zapata B (m). */
  B_m: number;
  /** Largo de la zapata L (m). L≥B. Si circular: L = B. */
  L_m: number;
  /** Profundidad de desplante D_f (m). */
  Df_m: number;
  /** Peso unitario del suelo γ (kN/m³). */
  gamma_kN_m3: number;
  /** Ángulo de fricción φ (°). */
  phi_deg: number;
  /** Cohesión c (kPa). */
  c_kPa: number;
  /** Inclinación de la carga respecto a la vertical (°). */
  inclinacion_deg: number;
  /** Nivel freático desde superficie (m). 99 = sin agua. */
  water_table_m: number;
  /** Factor de seguridad estático mínimo (CR §5: ≥3). */
  FS_estatico: number;
  /** Factor sísmico mínimo (CR: ≥2). */
  FS_sismico: number;
  /** Coeficiente sísmico horizontal k_h (CSCR §6 ≈ 0.5·PGA/g). */
  k_h: number;
}

export interface MethodResult {
  metodo: "Meyerhof" | "Hansen" | "Vesic";
  /** Factores capacidad (Nc, Nq, Nγ). */
  Nc: number;
  Nq: number;
  Ngamma: number;
  /** Factores forma (sc, sq, sγ). */
  sc: number;
  sq: number;
  sgamma: number;
  /** Factores profundidad (dc, dq, dγ). */
  dc: number;
  dq: number;
  dgamma: number;
  /** Factores inclinación (ic, iq, iγ). */
  ic: number;
  iq: number;
  igamma: number;
  /** Capacidad última q_u (kPa). */
  qu_kPa: number;
  /** Capacidad admisible estática q_a = q_u / FS (kPa). */
  qa_kPa: number;
  /** Capacidad admisible sísmica considerando k_h. */
  qa_sismico_kPa: number;
}

export interface BearingResult {
  input: BearingInput;
  /** γ efectivo arriba de la base (para q_0). */
  gamma_eff_top_kN_m3: number;
  /** γ efectivo abajo de la base (para el término N_γ). */
  gamma_eff_bot_kN_m3: number;
  /** Sobrecarga efectiva q_0 = γ·D_f (kPa). */
  q0_kPa: number;
  meyerhof: MethodResult;
  hansen: MethodResult;
  vesic: MethodResult;
  /** Recomendación: mínimo de los 3 (más conservador). */
  qa_recomendado_kPa: number;
  warnings: string[];
}

const deg = (d: number) => (d * Math.PI) / 180;

/** N_q común a los 3 métodos (Reissner 1924, Prandtl 1921). */
function calcNq(phi_deg: number): number {
  const phi = deg(phi_deg);
  return Math.exp(Math.PI * Math.tan(phi)) * Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);
}

/** N_c común (Prandtl). */
function calcNc(phi_deg: number, Nq: number): number {
  if (phi_deg < 0.01) return 5.14; // φ = 0 caso especial
  return (Nq - 1) / Math.tan(deg(phi_deg));
}

/** N_γ Meyerhof (1963). */
function calcNgammaMeyerhof(phi_deg: number, Nq: number): number {
  return (Nq - 1) * Math.tan(deg(1.4 * phi_deg));
}

/** N_γ Hansen (1970). */
function calcNgammaHansen(phi_deg: number, Nq: number): number {
  return 1.5 * (Nq - 1) * Math.tan(deg(phi_deg));
}

/** N_γ Vesić (1973). */
function calcNgammaVesic(phi_deg: number, Nq: number): number {
  return 2 * (Nq + 1) * Math.tan(deg(phi_deg));
}

export function computeBearingLive(input: BearingInput): BearingResult {
  const warnings: string[] = [];
  const { B_m, L_m, Df_m, gamma_kN_m3, phi_deg, c_kPa, inclinacion_deg, water_table_m, FS_estatico, FS_sismico, k_h } = input;

  if (B_m <= 0 || L_m <= 0) {
    warnings.push("Dimensiones B y L deben ser positivas.");
  }
  if (L_m < B_m) {
    warnings.push("Convencionalmente L ≥ B. Intercambiar valores si fuera necesario.");
  }
  if (phi_deg < 0 || phi_deg > 50) {
    warnings.push("φ fuera de rango típico (0-50°).");
  }

  // γ efectivo (gravedad sumergida si el agua está sobre la base)
  let gamma_eff_top = gamma_kN_m3;
  let gamma_eff_bot = gamma_kN_m3;
  if (water_table_m < Df_m) {
    // agua arriba de la base
    gamma_eff_top = Math.max(gamma_kN_m3 - 9.81, 8);
    gamma_eff_bot = Math.max(gamma_kN_m3 - 9.81, 8);
    warnings.push("Nivel freático arriba de la base: usando γ' (sumergido).");
  } else if (water_table_m < Df_m + B_m) {
    gamma_eff_bot = Math.max(gamma_kN_m3 - 9.81, 8);
    warnings.push("Nivel freático dentro de la zona de influencia (D_f a D_f+B): γ efectivo reducido bajo la base.");
  }
  const q0 = gamma_eff_top * Df_m;

  const phi = deg(phi_deg);
  const tan_phi = Math.tan(phi);

  function buildMethod(metodo: MethodResult["metodo"], Ngamma: number): MethodResult {
    const Nq = calcNq(phi_deg);
    const Nc = calcNc(phi_deg, Nq);
    const B_L = B_m / L_m;
    let sc = 1, sq = 1, sgamma = 1;
    let dc = 1, dq = 1, dgamma = 1;
    let ic = 1, iq = 1, igamma = 1;

    if (metodo === "Meyerhof") {
      // Meyerhof (1963)
      const Kp = Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);
      sc = 1 + 0.2 * Kp * B_L;
      sq = sgamma = phi_deg > 10 ? 1 + 0.1 * Kp * B_L : 1;
      const Df_B = Df_m / B_m;
      dc = 1 + 0.2 * Math.sqrt(Kp) * Df_B;
      dq = dgamma = phi_deg > 10 ? 1 + 0.1 * Math.sqrt(Kp) * Df_B : 1;
      const alpha = inclinacion_deg;
      ic = iq = Math.pow(1 - alpha / 90, 2);
      igamma = phi_deg > 0 ? Math.pow(1 - alpha / phi_deg, 2) : 0;
    } else if (metodo === "Hansen") {
      // Hansen (1970) — Bowles §4 table 4-5a
      sc = 1 + (Nq / Nc) * B_L;
      sq = 1 + B_L * tan_phi;
      sgamma = Math.max(1 - 0.4 * B_L, 0.6);
      const k = Df_m <= B_m ? Df_m / B_m : Math.atan(Df_m / B_m);
      dc = 1 + 0.4 * k;
      dq = 1 + 2 * tan_phi * Math.pow(1 - Math.sin(phi), 2) * k;
      dgamma = 1;
      const alpha = deg(inclinacion_deg);
      iq = Math.pow(1 - (0.5 * Math.sin(alpha)) / 1, 5);
      ic = phi_deg < 0.01 ? 1 - (2 * inclinacion_deg) / (Math.PI * 5.14) : iq - (1 - iq) / (Nq - 1);
      igamma = Math.pow(Math.max(1 - (0.7 * Math.sin(alpha)) / 1, 0), 5);
    } else {
      // Vesić (1973)
      sc = 1 + (Nq / Nc) * B_L;
      sq = 1 + B_L * tan_phi;
      sgamma = Math.max(1 - 0.4 * B_L, 0.6);
      const k = Df_m <= B_m ? Df_m / B_m : Math.atan(Df_m / B_m);
      dc = 1 + 0.4 * k;
      dq = 1 + 2 * tan_phi * Math.pow(1 - Math.sin(phi), 2) * k;
      dgamma = 1;
      const m = (2 + B_L) / (1 + B_L);
      const Vu = 1; // unidad
      const Hu = Math.tan(deg(inclinacion_deg));
      const ratio = Hu / (Vu + (c_kPa * B_m * L_m) / Math.max(Vu, 1e-6));
      iq = Math.pow(Math.max(1 - ratio, 0), m);
      ic = phi_deg < 0.01 ? 1 - (m * inclinacion_deg) / (Math.PI * 5.14) : iq - (1 - iq) / (Nq - 1);
      igamma = Math.pow(Math.max(1 - ratio, 0), m + 1);
    }

    const term_c = c_kPa * Nc * sc * dc * ic;
    const term_q = q0 * Nq * sq * dq * iq;
    const term_gamma = 0.5 * gamma_eff_bot * B_m * Ngamma * sgamma * dgamma * igamma;
    const qu = term_c + term_q + term_gamma;
    const qa = qu / FS_estatico;
    // Reducción sísmica simple por k_h (CSCR §6): φ aparente = φ - arctan(k_h)
    const phi_sismico = Math.max(phi_deg - Math.atan(k_h) * (180 / Math.PI), 0);
    const Nq_s = calcNq(phi_sismico);
    const Nc_s = calcNc(phi_sismico, Nq_s);
    const Ngamma_s =
      metodo === "Meyerhof" ? calcNgammaMeyerhof(phi_sismico, Nq_s) :
      metodo === "Hansen"   ? calcNgammaHansen(phi_sismico, Nq_s) :
                              calcNgammaVesic(phi_sismico, Nq_s);
    const qu_s = c_kPa * Nc_s * sc + q0 * Nq_s * sq + 0.5 * gamma_eff_bot * B_m * Ngamma_s * sgamma;
    const qa_s = qu_s / FS_sismico;

    return {
      metodo,
      Nc, Nq, Ngamma,
      sc, sq, sgamma,
      dc, dq, dgamma,
      ic, iq, igamma,
      qu_kPa: qu,
      qa_kPa: qa,
      qa_sismico_kPa: qa_s,
    };
  }

  const NqRaw = calcNq(phi_deg);
  const meyerhof = buildMethod("Meyerhof", calcNgammaMeyerhof(phi_deg, NqRaw));
  const hansen = buildMethod("Hansen", calcNgammaHansen(phi_deg, NqRaw));
  const vesic = buildMethod("Vesic", calcNgammaVesic(phi_deg, NqRaw));

  const qa_min = Math.min(meyerhof.qa_kPa, hansen.qa_kPa, vesic.qa_kPa);
  const qa_min_s = Math.min(meyerhof.qa_sismico_kPa, hansen.qa_sismico_kPa, vesic.qa_sismico_kPa);
  const qa_recomendado_kPa = Math.min(qa_min, qa_min_s);

  if (FS_estatico < 3) warnings.push("Código de Cimentaciones CR §5: FS estático ≥ 3.");
  if (FS_sismico < 2) warnings.push("Código de Cimentaciones CR §5: FS sísmico ≥ 2.");

  return {
    input,
    gamma_eff_top_kN_m3: gamma_eff_top,
    gamma_eff_bot_kN_m3: gamma_eff_bot,
    q0_kPa: q0,
    meyerhof, hansen, vesic,
    qa_recomendado_kPa,
    warnings,
  };
}
