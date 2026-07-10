/**
 * Asentamientos de cimentaciones superficiales:
 * - Inmediato en arenas: Schmertmann (1970, 1978)
 * - Consolidación primaria en arcillas: Terzaghi 1D
 * - Consolidación secundaria: Mesri Cα
 *
 * Sources:
 * - Schmertmann, J.H. (1970). "Static cone to compute static settlement
 *   over sand." JSMFD 96(SM3): 1011-1043.
 * - Schmertmann, Hartman & Brown (1978). "Improved strain influence
 *   factor diagrams." JGE 104(GT8): 1131-1135.
 * - Terzaghi, K. (1943). Theoretical Soil Mechanics. Wiley.
 * - Mesri, G. & Godlewski, P.M. (1977). "Time- and stress-compressibility
 *   interrelationship." JGE 103(GT5): 417-430.
 * - Bowles (1996), Foundation Analysis and Design, 5ed §5.
 * - Das (2016), Principles of Geotechnical Engineering, 9ed §11.
 * - ACI 360R-10 — Slabs on Ground.
 * - Código de Cimentaciones de Costa Rica (2009) §6.
 */

export type LayerType = "sand" | "clay";

export interface SettlementLayer {
  depth_top_m: number;
  depth_bot_m: number;
  type: LayerType;
  gamma_kN_m3: number;
  /** Módulo de elasticidad para arenas (MPa). */
  E_MPa?: number;
  /** Índice de compresión Cc para arcillas. */
  Cc?: number;
  /** Índice de recompresión Cr para arcillas. */
  Cr?: number;
  /** Índice de vacíos inicial e0. */
  e0?: number;
  /** Relación de sobreconsolidación OCR. */
  OCR?: number;
  /** Índice de compresión secundaria Cα (Mesri). */
  C_alpha?: number;
}

export interface SettlementInput {
  /** Ancho de la zapata (m). */
  B_m: number;
  /** Largo de la zapata (m). */
  L_m: number;
  /** Profundidad de desplante (m). */
  Df_m: number;
  /** Presión neta aplicada (kPa). */
  q_neta_kPa: number;
  /** Estratos del subsuelo. */
  layers: SettlementLayer[];
  /** Nivel freático (m). 99 si no hay. */
  water_table_m: number;
  /** Tiempo para asentamiento secundario (años). */
  t_years: number;
  /** Tiempo de referencia primaria t_p (años, default 1). */
  tp_years: number;
}

export interface SettlementLayerResult {
  depth_top_m: number;
  depth_bot_m: number;
  type: LayerType;
  /** Profundidad media de la capa (m bajo la base de la zapata). */
  z_mid_m: number;
  /** Esfuerzo efectivo medio en la capa σ'v0 (kPa). */
  sigma_v0_kPa: number;
  /** Incremento de esfuerzo Δσ (kPa) — Boussinesq 2:1 simplificado. */
  delta_sigma_kPa: number;
  /** Asentamiento inmediato para arenas (mm). */
  S_imm_mm: number | null;
  /** Asentamiento por consolidación primaria para arcillas (mm). */
  S_cons_mm: number | null;
  /** Asentamiento secundario para arcillas (mm). */
  S_sec_mm: number | null;
  /** Factor de influencia Iz (Schmertmann). */
  Iz?: number;
  notes: string[];
}

export interface SettlementResult {
  layers: SettlementLayerResult[];
  /** Asentamiento total inmediato (arenas) en mm. */
  S_imm_total_mm: number;
  /** Asentamiento total primario (arcillas) en mm. */
  S_cons_total_mm: number;
  /** Asentamiento secundario (arcillas) en mm. */
  S_sec_total_mm: number;
  /** Asentamiento total en mm. */
  S_total_mm: number;
  /** Factor C1 de Schmertmann. */
  C1: number;
  /** Factor C2 de Schmertmann. */
  C2: number;
  citations: string[];
  warnings: string[];
}

/**
 * Boussinesq simplified 2:1 stress distribution under a rectangular footing
 * — Δσ = q·B·L / ((B+z)(L+z)) where z is depth below footing base.
 */
function delta_sigma_2to1(q_neta: number, B: number, L: number, z: number): number {
  if (z <= 0) return q_neta;
  return (q_neta * B * L) / ((B + z) * (L + z));
}

/** Schmertmann (1978) strain influence factor Iz for axisymmetric (L/B≤1) or strip (L/B≥10). */
function Iz_Schmertmann(z_over_B: number, L_over_B: number): number {
  // 1978 improved diagram: peak Iz at z=0.5B (axi) or z=B (strip), zero at 2B (axi) or 4B (strip).
  // Peak value: 0.5 + 0.1·sqrt(q_neta/σ'_zp) — we use Iz_peak = 0.5 default; user can refine.
  const isStrip = L_over_B >= 10;
  const z_peak = isStrip ? 1.0 : 0.5;
  const z_end = isStrip ? 4.0 : 2.0;
  const Iz_peak = 0.5;
  if (z_over_B <= 0) return 0.1;
  if (z_over_B <= z_peak) {
    return 0.1 + (Iz_peak - 0.1) * (z_over_B / z_peak);
  }
  if (z_over_B <= z_end) {
    return Iz_peak * (z_end - z_over_B) / (z_end - z_peak);
  }
  return 0;
}

export function computeSettlementLive(input: SettlementInput): SettlementResult {
  const warnings: string[] = [];
  const citations = [
    "Schmertmann (1970, 1978)",
    "Terzaghi (1943) — Consolidación 1D",
    "Mesri & Godlewski (1977) — Cα",
    "Bowles (1996) §5",
    "Das (2016) §11",
    "ACI 360R-10 — tolerable settlements",
    "Código de Cimentaciones de Costa Rica (2009) §6",
  ];

  const { B_m, L_m, Df_m, q_neta_kPa, layers, water_table_m, t_years, tp_years } = input;
  const L_over_B = L_m / B_m;

  // Schmertmann correction factors
  // σ'_zp ≈ effective stress at depth z_peak below footing
  const z_peak_m = (L_over_B >= 10 ? 1.0 : 0.5) * B_m;
  // Rough σ'_zp using first granular layer's gamma if available
  const gamma_top = layers[0]?.gamma_kN_m3 ?? 18;
  let sigma_zp = gamma_top * (Df_m + z_peak_m);
  if (water_table_m < Df_m + z_peak_m) {
    sigma_zp -= 9.81 * Math.max(0, (Df_m + z_peak_m) - water_table_m);
  }
  sigma_zp = Math.max(1, sigma_zp);
  // C1: depth (embedment) reduction. C1 = 1 - 0.5·(q0/q_neta), min 0.5.
  const q0 = gamma_top * Df_m;
  const C1 = Math.max(0.5, 1 - 0.5 * (q0 / Math.max(1, q_neta_kPa)));
  // C2: creep factor (time-after-load, t in years). C2 = 1 + 0.2·log10(t/0.1).
  const C2 = 1 + 0.2 * Math.log10(Math.max(0.1, t_years) / 0.1);

  const results: SettlementLayerResult[] = [];
  let S_imm_total = 0;
  let S_cons_total = 0;
  let S_sec_total = 0;

  for (const layer of layers) {
    // z relative to footing base
    const z_top = Math.max(0, layer.depth_top_m - Df_m);
    const z_bot = Math.max(0, layer.depth_bot_m - Df_m);
    const z_mid = (z_top + z_bot) / 2;
    const dz = z_bot - z_top;
    if (dz <= 0) continue;

    // σ'v0 at mid layer
    let sigma_v0 = 0;
    for (const upper of layers) {
      if (upper.depth_top_m >= layer.depth_top_m + (z_bot - z_top) / 2) break;
      const top = upper.depth_top_m;
      const bot = Math.min(upper.depth_bot_m, layer.depth_top_m + (z_bot - z_top) / 2);
      const thick = Math.max(0, bot - top);
      sigma_v0 += upper.gamma_kN_m3 * thick;
    }
    // subtract pore pressure
    const z_abs = layer.depth_top_m + (z_bot - z_top) / 2;
    if (z_abs > water_table_m) {
      sigma_v0 -= 9.81 * (z_abs - water_table_m);
    }
    sigma_v0 = Math.max(1, sigma_v0);

    const z_mid_abs = Df_m + z_mid;
    const delta_sigma = delta_sigma_2to1(q_neta_kPa, B_m, L_m, z_mid);
    const notes: string[] = [];
    let S_imm: number | null = null;
    let S_cons: number | null = null;
    let S_sec: number | null = null;
    let Iz_val: number | undefined;

    if (layer.type === "sand") {
      const E_kPa = (layer.E_MPa ?? 20) * 1000;
      const z_over_B = z_mid / B_m;
      Iz_val = Iz_Schmertmann(z_over_B, L_over_B);
      // Schmertmann: ΔS_i = C1·C2·q_neta · (Iz/E)·dz
      S_imm = C1 * C2 * q_neta_kPa * (Iz_val / E_kPa) * dz * 1000; // mm
      notes.push("Schmertmann (1978) Iz strain influence");
    } else if (layer.type === "clay") {
      const Cc = layer.Cc ?? 0.2;
      const Cr = layer.Cr ?? 0.04;
      const e0 = layer.e0 ?? 0.8;
      const OCR = layer.OCR ?? 1.0;
      const sigma_p = sigma_v0 * OCR; // preconsolidation pressure
      const sigma_f = sigma_v0 + delta_sigma;
      const H_mm = dz * 1000;
      if (OCR <= 1.0 || sigma_f <= sigma_p) {
        // Either NC entirely, or stays in recompression
        if (sigma_f <= sigma_p) {
          S_cons = (Cr * H_mm / (1 + e0)) * Math.log10(Math.max(1.01, sigma_f / sigma_v0));
          notes.push("Cr (recompresión) — OC y σf ≤ σp");
        } else {
          S_cons = (Cc * H_mm / (1 + e0)) * Math.log10(Math.max(1.01, sigma_f / sigma_v0));
          notes.push("Cc (compresión virgen) — suelo NC");
        }
      } else {
        // OC, crosses preconsolidation
        const s1 = (Cr * H_mm / (1 + e0)) * Math.log10(Math.max(1.01, sigma_p / sigma_v0));
        const s2 = (Cc * H_mm / (1 + e0)) * Math.log10(Math.max(1.01, sigma_f / sigma_p));
        S_cons = s1 + s2;
        notes.push("Cr + Cc — OC y σf cruza σp");
      }
      // Secondary (Mesri): S_sec = Cα·H/(1+e_p)·log10(t/tp)
      const C_alpha = layer.C_alpha ?? 0.005;
      if (t_years > tp_years) {
        S_sec = (C_alpha * H_mm / (1 + e0)) * Math.log10(t_years / tp_years);
        notes.push(`Cα = ${C_alpha} — Mesri (1977)`);
      } else {
        S_sec = 0;
      }
    }

    results.push({
      depth_top_m: layer.depth_top_m,
      depth_bot_m: layer.depth_bot_m,
      type: layer.type,
      z_mid_m: z_mid_abs,
      sigma_v0_kPa: sigma_v0,
      delta_sigma_kPa: delta_sigma,
      S_imm_mm: S_imm,
      S_cons_mm: S_cons,
      S_sec_mm: S_sec,
      Iz: Iz_val,
      notes,
    });

    if (S_imm) S_imm_total += S_imm;
    if (S_cons) S_cons_total += S_cons;
    if (S_sec) S_sec_total += S_sec;
  }

  const S_total = S_imm_total + S_cons_total + S_sec_total;

  if (S_total > 25) {
    warnings.push(
      `Asentamiento total ${S_total.toFixed(1)} mm excede 25 mm (límite típico ACI 360R-10).`,
    );
  }
  if (S_cons_total > S_imm_total * 2) {
    warnings.push(
      "Consolidación primaria domina. Verificar tiempo de consolidación U(t).",
    );
  }

  return {
    layers: results,
    S_imm_total_mm: S_imm_total,
    S_cons_total_mm: S_cons_total,
    S_sec_total_mm: S_sec_total,
    S_total_mm: S_total,
    C1, C2,
    citations,
    warnings,
  };
}
