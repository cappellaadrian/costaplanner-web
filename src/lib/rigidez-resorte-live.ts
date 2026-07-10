/**
 * Módulo de balasto / resorte equivalente — Winkler model k for
 * SAP2000/ETABS plate-on-elastic-foundation modeling.
 *
 * Sources:
 * - Terzaghi, K. (1955). "Evaluation of coefficients of subgrade
 *   reaction." Géotechnique 5(4): 297-326.
 * - Vesić, A.S. (1961). "Bending of beams resting on isotropic elastic
 *   solid." JEMD 87(EM2): 35-53.
 * - Bowles, J.E. (1996). Foundation Analysis and Design, 5ed §16.
 * - Biot, M.A. (1937). "Bending of an infinite beam on an elastic
 *   foundation." J. Appl. Mech.
 * - ACI 336.2R-88 — Combined Footings and Mats.
 * - Coduto (2001) — Foundation Design §10.
 */

export type SoilType = "arena_suelta" | "arena_media" | "arena_densa" | "arcilla_blanda" | "arcilla_media" | "arcilla_dura";

export interface SpringInput {
  /** Capacidad admisible q_a (kPa). */
  qa_kPa: number;
  /** Asentamiento admisible (cm). */
  asentamiento_adm_cm: number;
  /** Ancho de la zapata B (m). */
  B_m: number;
  /** Largo de la zapata L (m). */
  L_m: number;
  /** Tipo de suelo. */
  soil_type: SoilType;
  /** Módulo de elasticidad del suelo Es (MPa). */
  E_MPa: number;
  /** Relación de Poisson μ. */
  mu: number;
  /** Rigidez de la estructura sobre la zapata (MPa). 0 = flexible (default zapata aislada). */
  Ef_MPa: number;
  /** Inercia de la estructura sobre la zapata (m^4). 0 = flexible. */
  If_m4: number;
}

export interface SpringResult {
  /** k vertical por qa/δ admisible (kN/m³). */
  k_qa_kN_m3: number;
  /** k vertical por teoría elástica Vesić (kN/m³). */
  k_vesic_kN_m3: number;
  /** k vertical Terzaghi tabulado para B=0.3 m (kN/m³). */
  k_terzaghi_ref_kN_m3: number;
  /** k corregido por tamaño (Bowles): k = k_ref · (0.3/B)² para arena, (0.3/B) para arcilla. */
  k_corregido_kN_m3: number;
  /** Recomendado: media geométrica de qa-based y Vesic. */
  k_recomendado_kN_m3: number;
  /** Rigidez equivalente del resorte K = k · A (kN/m). */
  K_spring_kN_m: number;
  /** Área (m²). */
  A_m2: number;
  /** Factor de forma. */
  shape_factor: number;
  citations: string[];
  warnings: string[];
}

/** Terzaghi (1955) values for k₁ (B=0.3 m, kPa/cm or equivalently MN/m³). */
function k_terzaghi_ref(soil: SoilType): number {
  // values in kN/m³ — converted from typical literature ranges
  const TABLE: Record<SoilType, number> = {
    arena_suelta: 8_000,
    arena_media: 25_000,
    arena_densa: 80_000,
    arcilla_blanda: 12_000,
    arcilla_media: 24_000,
    arcilla_dura: 48_000,
  };
  return TABLE[soil];
}

export function computeSpringLive(input: SpringInput): SpringResult {
  const warnings: string[] = [];
  const citations = [
    "Terzaghi (1955) Géotechnique 5(4)",
    "Vesić (1961) JEMD 87(EM2)",
    "Bowles (1996) §16",
    "ACI 336.2R-88",
    "Biot (1937) J. Appl. Mech.",
  ];

  const { qa_kPa, asentamiento_adm_cm, B_m, L_m, soil_type, E_MPa, mu, Ef_MPa, If_m4 } = input;

  if (asentamiento_adm_cm <= 0) {
    warnings.push("Asentamiento admisible debe ser > 0.");
  }
  if (mu < 0 || mu >= 0.5) {
    warnings.push("μ fuera del rango físico (0 ≤ μ < 0.5).");
  }

  // 1) k = qa / δ
  // qa in kPa = kN/m², δ in cm → convert δ to m
  const delta_m = asentamiento_adm_cm / 100;
  const k_qa = qa_kPa / Math.max(0.001, delta_m); // kN/m³

  // 2) Vesić (1961) closed form:
  // k = 0.65 · Es / (B·(1-μ²)) · (Es·B^4 / (Ef·If))^(1/12)
  // If flexible (Ef·If = 0), reduce to k = 0.65·Es/(B·(1-μ²))
  const Es_kPa = E_MPa * 1000;
  let k_vesic: number;
  if (Ef_MPa > 0 && If_m4 > 0) {
    const Ef_kPa = Ef_MPa * 1000;
    const ratio = (Es_kPa * Math.pow(B_m, 4)) / (Ef_kPa * If_m4);
    const term = Math.pow(Math.max(1e-6, ratio), 1 / 12);
    k_vesic = (0.65 * Es_kPa / (B_m * (1 - mu * mu))) * term;
  } else {
    k_vesic = 0.65 * Es_kPa / (B_m * (1 - mu * mu));
  }

  // 3) Terzaghi reference for B=0.3 m
  const k_terzaghi = k_terzaghi_ref(soil_type);

  // 4) Bowles size correction
  // Sand: k = k₁ · ((B + 0.3)/(2B))²
  // Clay: k = k₁ · (0.3/B)
  let k_corregido: number;
  let shape_factor: number;
  if (soil_type.startsWith("arena")) {
    shape_factor = Math.pow((B_m + 0.3) / (2 * B_m), 2);
    k_corregido = k_terzaghi * shape_factor;
  } else {
    shape_factor = 0.3 / B_m;
    k_corregido = k_terzaghi * shape_factor;
  }
  // Additional shape correction for rectangular: k_rect = k_sq · (1 + 0.5·B/L) / 1.5
  const rect_corr = (1 + 0.5 * (B_m / L_m)) / 1.5;
  k_corregido *= rect_corr;

  // Recommended: geometric mean of qa-based and Vesic
  const k_recomendado = Math.sqrt(Math.max(1, k_qa) * Math.max(1, k_vesic));

  const A = B_m * L_m;
  const K_spring = k_recomendado * A; // kN/m

  if (k_recomendado < 10_000) {
    warnings.push("k < 10 MN/m³: suelo muy compresible, considera mejoramiento.");
  }
  if (k_recomendado > 200_000) {
    warnings.push("k > 200 MN/m³: posible suelo rocoso, verifica con ensayo de placa.");
  }

  return {
    k_qa_kN_m3: k_qa,
    k_vesic_kN_m3: k_vesic,
    k_terzaghi_ref_kN_m3: k_terzaghi,
    k_corregido_kN_m3: k_corregido,
    k_recomendado_kN_m3: k_recomendado,
    K_spring_kN_m: K_spring,
    A_m2: A,
    shape_factor,
    citations,
    warnings,
  };
}
