/**
 * TS port of the cantilever retaining wall design procedure.
 *
 * Source: PDF A (Luis Enrique Maldonado / Structural Tech) — "Diseño de
 * Muro de Contención en Voladizo". Implements every check shown in the
 * hand-drawn cuaderno + the Excel template:
 *
 *   1. Rankine active + passive earth-pressure coefficients
 *   2. Empuje activo (triangular) + empuje sobrecarga (rectangular) +
 *      empuje pasivo on toe
 *   3. 4-section weight breakdown (cimentación + 2 pantalla pieces + relleno
 *      + sobrecarga)
 *   4. ΣF_H, ΣM_o (overturning), ΣF_V, ΣM_R (resisting)
 *   5. FS vuelco ≥ 1.5–2.0
 *   6. FS deslizamiento ≥ 1.25–1.5 using K₁=K₂≈2/3 friction reduction +
 *      passive contribution
 *   7. Excentricidad e + B/6 check, pressure distribution (trapezoidal vs
 *      rectangular B'=B-2e)
 *   8. Bearing capacity by Brinch Hansen (Nq, Nc, Nγ + shape + depth +
 *      inclination factors) → q_u → FS_scc = q_u / q_max
 *   9. Pantalla flexural + shear design + 135° hook anchorage Ldh
 *  10. Talón posterior + talón delantero shear + flexure
 *
 * Units: SI consistently — kN, kN/m, kN/m², kN·m, m, cm where noted.
 * Code references: ACI 318-14, CSCR-10 Rev. 2014 §17 (CR seismic code).
 *
 * Every value below is exposed on the result object so the live diagrams
 * (D1–D11 in svg-primitives + retaining-wall page) can bind to them and
 * redraw on every keystroke.
 */

import type { CalculationStep } from "./beam-flexure-live";

// ---------------------------------------------------------------------------
// Input shape
// ---------------------------------------------------------------------------

export interface RetainingWallInput {
  // Geometry (all in meters)
  c_m: number;            // ancho de corona
  ct_m: number;           // ancho de base de la pantalla
  b_m: number;            // longitud de la punta (delantero)
  H_m: number;            // altura de la pantalla
  Hz_m: number;           // altura de la zapata
  Bp_m: number;           // longitud del talón posterior
  D_m: number;            // profundidad de cimentación (terreno sobre zapata frontal)
  // Soil
  gamma_r: number;        // kN/m³ peso específico del suelo de relleno
  phi_deg: number;        // ángulo de fricción interno (grados)
  cohesion: number;       // kN/m² (típicamente 0 para arena)
  qSC: number;            // kN/m² sobrecarga sobre el terreno
  qadm: number;           // kN/m² capacidad admisible del suelo
  // Materials
  fc: number;             // kg/cm² resistencia concreto (convertimos internamente)
  fy: number;             // kg/cm² fluencia acero
  gamma_c: number;        // kN/m³ peso específico concreto
  mu_ct: number;          // coeficiente de fricción concreto-terreno
  // Factors (defaults match PDF A)
  phi_flexion: number;    // 0.90 default
  phi_corte: number;      // 0.75 default
  recubrimiento_cm: number; // 7.5 cm para suelo
  // Seismic
  zonaSismica: 1 | 2 | 3 | 4;
}

// ---------------------------------------------------------------------------
// Computed result shape — diagrams and steps read from this
// ---------------------------------------------------------------------------

export interface SectionWeight {
  id: 1 | 2 | 3 | 4;
  label: string;
  area_m2: number;
  weight_kN: number;
  arm_m: number;          // brazo Z respecto a la punta (toe)
  moment_kNm: number;     // ω · Z (resistente)
}

export interface RetainingWallLiveResult {
  // Echo of input
  input: RetainingWallInput;

  // Derived geometry
  B_m: number;            // longitud total de la zapata
  H_total_m: number;      // H + Hz altura total del muro
  hs_m: number;           // altura equivalente por sobrecarga = qSC / gamma_r

  // Earth pressure coefficients
  Ka: number;             // Rankine activo
  Kp: number;             // Rankine pasivo = 1/Ka

  // Active pressures and forces
  pa_max_kPa: number;     // gamma_r · H_total · Ka (presión máxima al pie)
  E1_kN: number;          // 0.5 · gamma_r · H² · Ka (empuje activo) por metro
  Z1_m: number;           // H_total / 3
  M_E1_kNm: number;

  pSC_kPa: number;        // qSC · Ka
  E2_kN: number;          // qSC · Ka · H_total
  Z2_m: number;           // H_total / 2
  M_E2_kNm: number;

  Ep_kN: number;          // 0.5 · gamma_r · D² · Kp (passive on toe)
  Zp_m: number;           // D / 3

  // Force totals
  sumFh_kN: number;
  sumMo_kNm: number;      // suma de momentos actuantes (volcador)

  // Section weights (the 4 pieces + sobrecarga)
  sections: SectionWeight[];
  sumFv_kN: number;
  sumMr_kNm: number;

  // Stability checks
  FS_vuelco: number;
  FS_vuelco_min: number;  // 1.5 estático, 2.0 con sobrecarga
  FS_vuelco_ok: boolean;

  // Sliding
  Fr_friccion_kN: number;
  Fr_pasivo_kN: number;
  Fr_total_kN: number;
  FS_desliz: number;
  FS_desliz_min: number;
  FS_desliz_ok: boolean;

  // Eccentricity + soil pressure
  x_bar_m: number;        // punto de paso de la resultante respecto a la punta
  e_m: number;            // excentricidad
  e_limite_m: number;     // B/6
  e_ok: boolean;
  presionCase: "trapezoidal" | "rectangular_efectivo";
  qmax_kPa: number;
  qmin_kPa: number;
  qact_kPa: number;       // para caso rectangular (uniforme)
  Befectivo_m: number;
  qadm_ok: boolean;

  // Brinch Hansen bearing capacity (simplified)
  Nq: number;
  Nc: number;
  N_gamma: number;
  qu_kPa: number;
  FS_scc: number;
  FS_scc_min: number;
  FS_scc_ok: boolean;

  // Pantalla design (shear at base of stem)
  pantalla_d_m: number;
  Vu_pantalla_kN: number;
  phiVc_pantalla_kN: number;
  pantalla_corte_ok: boolean;
  Mu_pantalla_kNm: number;
  As_pantalla_cm2: number;
  As_pantalla_min_cm2: number;
  As_pantalla_diseno_cm2: number;
  As_pantalla_size: number;    // bar # selected
  As_pantalla_sep_cm: number;
  // Acero exterior pantalla
  As_pantalla_ext_cm2: number;
  As_pantalla_ext_size: number;
  As_pantalla_ext_sep_cm: number;
  // Horizontal pantalla
  As_pantalla_horiz_cm2: number;

  // Anclaje gancho
  Ldh_basic_cm: number;
  Ldh_final_cm: number;
  Ldh_ok: boolean;

  // Talón posterior
  talonPost_d_m: number;
  Vu_talonPost_kN: number;
  phiVc_talonPost_kN: number;
  talonPost_corte_ok: boolean;
  Mu_talonPost_kNm: number;
  As_talonPost_cm2: number;
  As_talonPost_diseno_cm2: number;
  As_talonPost_size: number;
  As_talonPost_sep_cm: number;

  // Talón delantero (punta)
  talonDel_d_m: number;
  Vu_talonDel_kN: number;
  phiVc_talonDel_kN: number;
  talonDel_corte_ok: boolean;
  Mu_talonDel_kNm: number;
  As_talonDel_cm2: number;
  As_talonDel_diseno_cm2: number;
  As_talonDel_size: number;
  As_talonDel_sep_cm: number;

  // Warnings + errors
  warnings: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Bar areas (cm²) and unit weights — for rebar selection
// ---------------------------------------------------------------------------

const BAR_AREAS_CM2: Record<number, number> = {
  3: 0.71, 4: 1.27, 5: 1.99, 6: 2.84, 7: 3.87,
  8: 5.10, 9: 6.45, 10: 8.19, 11: 10.06,
};
const BAR_DB_CM: Record<number, number> = {
  3: 0.953, 4: 1.27, 5: 1.588, 6: 1.905, 7: 2.222,
  8: 2.54, 9: 2.865, 10: 3.226, 11: 3.581,
};

function asBar(n: number) { return BAR_AREAS_CM2[n] ?? 0; }
function dbBar(n: number) { return BAR_DB_CM[n] ?? 0; }

/** Pick smallest bar from `sizes` whose count × As meets the required area,
 *  then return separación in cm for a 100 cm width strip. */
function pickRebar(
  AsReq_cm2: number,
  widthBase_cm: number = 100,
  sizes: number[] = [3, 4, 5, 6, 7, 8],
): { size: number; sep_cm: number; nBars: number; AsProv_cm2: number } {
  for (const s of sizes) {
    const ab = asBar(s);
    if (ab <= 0) continue;
    const n = Math.max(2, Math.ceil(AsReq_cm2 / ab));
    const sep = widthBase_cm / n;
    if (sep >= 7) {
      return { size: s, sep_cm: Math.floor(sep * 2) / 2, nBars: n, AsProv_cm2: n * ab };
    }
  }
  // fallback to biggest
  const s = sizes[sizes.length - 1];
  const ab = asBar(s);
  const n = Math.max(2, Math.ceil(AsReq_cm2 / ab));
  return { size: s, sep_cm: widthBase_cm / n, nBars: n, AsProv_cm2: n * ab };
}

// ---------------------------------------------------------------------------
// Main compute
// ---------------------------------------------------------------------------

export function computeRetainingWallLive(input: RetainingWallInput): RetainingWallLiveResult {
  const {
    c_m, ct_m, b_m, H_m, Hz_m, Bp_m, D_m,
    gamma_r, phi_deg, qSC, qadm,
    fc, fy, gamma_c, mu_ct,
    phi_flexion, phi_corte, recubrimiento_cm,
    zonaSismica,
  } = input;

  const warnings: string[] = [];
  const errors: string[] = [];

  // Derived geometry
  const B_m = b_m + ct_m + Bp_m;
  const H_total_m = H_m + Hz_m;
  const hs_m = gamma_r > 0 ? qSC / gamma_r : 0;

  // ---- Rankine ----
  const phi_rad = (phi_deg * Math.PI) / 180;
  const Ka = Math.tan(Math.PI / 4 - phi_rad / 2) ** 2;
  const Kp = Math.tan(Math.PI / 4 + phi_rad / 2) ** 2;

  // ---- Active earth pressure (triangular, by meter) ----
  const pa_max_kPa = gamma_r * H_total_m * Ka;            // kPa
  const E1_kN = 0.5 * gamma_r * H_total_m * H_total_m * Ka; // kN/m
  const Z1_m = H_total_m / 3;
  const M_E1_kNm = E1_kN * Z1_m;

  // ---- Surcharge (rectangular, by meter) ----
  const pSC_kPa = qSC * Ka;
  const E2_kN = pSC_kPa * H_total_m;
  const Z2_m = H_total_m / 2;
  const M_E2_kNm = E2_kN * Z2_m;

  // ---- Passive on toe ----
  const Ep_kN = 0.5 * gamma_r * D_m * D_m * Kp;
  const Zp_m = D_m / 3;
  // We will NOT add E_p to ΣF_h for overturning (it stabilizes, not overturns).
  // Standard practice: passive helps sliding only.

  // ---- Totals ----
  const sumFh_kN = E1_kN + E2_kN;
  const sumMo_kNm = M_E1_kNm + M_E2_kNm;

  // ---- Section weights — 4 pieces ----
  // ① Cimentación: B × Hz (concreto, gamma_c)
  // ② Pantalla triangular: 0.5 × (ct - c) × H
  // ③ Pantalla rectangular: c × H
  // ④ Relleno sobre el talón posterior: Bp × H (suelo, gamma_r)
  // ⑤ Sobrecarga sobre el relleno: qSC × Bp

  // Centroide measured from the toe (front face) of footing.
  // ① cimentación centroide horizontal = B/2
  const w1 = B_m * Hz_m * gamma_c;
  const arm1 = B_m / 2;

  // ② pantalla triangular: el triángulo está adyacente al rectángulo de la pantalla.
  // Configuración típica: cara exterior (vertical, frente del muro) en x = b + ct (NO, depende del diseño).
  // Per PDF A: la corona c está al frente, la pantalla rectangular detrás, y la pantalla triangular
  // hace de transición. Pero geometrías varían. Simplificación: pantalla rectangular en
  // x = [b, b + c], pantalla triangular ocupa [b + c, b + ct], centroide a (2/3) del ancho desde la cara estrecha.
  const triangulo_b = ct_m - c_m;
  const w2 = 0.5 * triangulo_b * H_m * gamma_c;
  const arm2 = b_m + c_m + triangulo_b / 3;  // centroide del triángulo

  // ③ pantalla rectangular
  const w3 = c_m * H_m * gamma_c;
  const arm3 = b_m + c_m / 2;

  // ④ relleno sobre el talón posterior
  const w4 = Bp_m * H_m * gamma_r;
  const arm4 = b_m + ct_m + Bp_m / 2;

  // ⑤ sobrecarga: actúa solo en condición CON sobrecarga
  const w5 = qSC * Bp_m;  // kN/m
  const arm5 = arm4;

  const sections: SectionWeight[] = [
    { id: 1, label: "Cimentación",            area_m2: B_m * Hz_m,           weight_kN: w1, arm_m: arm1, moment_kNm: w1 * arm1 },
    { id: 2, label: "Pantalla triangular",    area_m2: 0.5 * triangulo_b * H_m, weight_kN: w2, arm_m: arm2, moment_kNm: w2 * arm2 },
    { id: 3, label: "Pantalla rectangular",   area_m2: c_m * H_m,            weight_kN: w3, arm_m: arm3, moment_kNm: w3 * arm3 },
    { id: 4, label: "Relleno sobre talón",    area_m2: Bp_m * H_m,           weight_kN: w4, arm_m: arm4, moment_kNm: w4 * arm4 },
  ];

  const sumFv_kN = w1 + w2 + w3 + w4 + w5;
  const sumMr_kNm = sections.reduce((acc, s) => acc + s.moment_kNm, 0) + w5 * arm5;

  // ---- FS vuelco ----
  // PDF A usa 1.5 estático, 2.0 con sobrecarga; nosotros tomamos 1.5 como base.
  const FS_vuelco = sumMo_kNm > 0 ? sumMr_kNm / sumMo_kNm : Infinity;
  const FS_vuelco_min = 1.5;
  const FS_vuelco_ok = FS_vuelco >= FS_vuelco_min;
  if (!FS_vuelco_ok) {
    warnings.push(`FS vuelco = ${FS_vuelco.toFixed(2)} < ${FS_vuelco_min}. Aumentar B o disminuir H.`);
  }

  // ---- FS deslizamiento ----
  // Friction angle reduced: K₁ = K₂ = 2/3 (concrete-on-soil). PDF A uses this.
  const Fr_friccion_kN = mu_ct * sumFv_kN;
  const Fr_pasivo_kN = Ep_kN;  // We add passive resistance
  const Fr_total_kN = Fr_friccion_kN + Fr_pasivo_kN;
  const FS_desliz = sumFh_kN > 0 ? Fr_total_kN / sumFh_kN : Infinity;
  const FS_desliz_min = 1.5;
  const FS_desliz_ok = FS_desliz >= FS_desliz_min;
  if (!FS_desliz_ok) {
    warnings.push(
      `FS deslizamiento = ${FS_desliz.toFixed(2)} < ${FS_desliz_min}. Considerar diente o aumentar B.`,
    );
  }

  // ---- Eccentricity + pressure distribution ----
  const x_bar_m = sumFv_kN > 0 ? (sumMr_kNm - sumMo_kNm) / sumFv_kN : 0;
  const e_m = Math.abs(B_m / 2 - x_bar_m);
  const e_limite_m = B_m / 6;
  const e_ok = e_m <= e_limite_m;
  let qmax_kPa: number, qmin_kPa: number;
  let presionCase: "trapezoidal" | "rectangular_efectivo";
  let Befectivo_m: number;
  let qact_kPa: number;

  if (e_ok) {
    // Linear trapezoidal distribution
    presionCase = "trapezoidal";
    qmax_kPa = (sumFv_kN / B_m) * (1 + (6 * e_m) / B_m);
    qmin_kPa = (sumFv_kN / B_m) * (1 - (6 * e_m) / B_m);
    Befectivo_m = B_m;
    qact_kPa = qmax_kPa; // para verificación de capacidad
  } else {
    // Effective width (rectangular) when e > B/6
    presionCase = "rectangular_efectivo";
    Befectivo_m = Math.max(0.01, B_m - 2 * e_m);
    qact_kPa = sumFv_kN / Befectivo_m;
    qmax_kPa = qact_kPa;
    qmin_kPa = 0;
    warnings.push(
      `e > B/6 (${e_m.toFixed(3)} > ${e_limite_m.toFixed(3)} m). Distribución rectangular B' = ${Befectivo_m.toFixed(2)} m.`,
    );
  }

  const qadm_kPa_compare = qadm; // already kPa
  const qadm_ok = qmax_kPa <= qadm_kPa_compare;
  if (!qadm_ok) {
    warnings.push(`q_max = ${qmax_kPa.toFixed(1)} kPa > q_adm = ${qadm_kPa_compare.toFixed(1)} kPa.`);
  }

  // ---- Brinch Hansen (simplified — strip footing, no inclination of base) ----
  const expPiTan = Math.exp(Math.PI * Math.tan(phi_rad));
  const Nq = phi_deg > 0 ? expPiTan * Math.tan(Math.PI / 4 + phi_rad / 2) ** 2 : 1;
  const Nc = phi_deg > 0 ? (Nq - 1) / Math.tan(phi_rad) : 5.14;
  const N_gamma = phi_deg > 0 ? 1.5 * (Nq - 1) * Math.tan(phi_rad) : 0;

  // For strip footing the shape factors are 1; depth factors apply (simplified):
  const d_factor = 1 + 0.4 * (D_m / Math.max(0.01, Befectivo_m));
  // Inclination factor (simplified): i = (1 - V/N)² where V = ΣF_h
  const i_factor =
    sumFv_kN > 0
      ? Math.pow(Math.max(0, 1 - sumFh_kN / sumFv_kN), 2)
      : 0;
  const cohesion = input.cohesion;
  const qu_kPa = Math.max(
    0.1,
    cohesion * Nc * d_factor * i_factor +
      (D_m * gamma_r) * Nq * d_factor * i_factor +
      0.5 * gamma_r * Befectivo_m * N_gamma * d_factor * i_factor,
  );
  const FS_scc = qu_kPa / Math.max(0.1, qact_kPa);
  const FS_scc_min = 3.0;
  const FS_scc_ok = FS_scc >= FS_scc_min;
  if (!FS_scc_ok) {
    warnings.push(`FS_scc = ${FS_scc.toFixed(2)} < 3. Suelo cercano a falla por capacidad.`);
  }

  // ---- Pantalla design ----
  // Forces on pantalla alone (no zapata):
  const E1_pantalla_kN = 0.5 * gamma_r * H_m * H_m * Ka;
  const Z1_pant_m = H_m / 3;
  const E2_pantalla_kN = qSC * Ka * H_m;
  const Z2_pant_m = H_m / 2;
  // Factor de carga para empuje lateral de tierra (H) y sobrecarga:
  // ACI 318-14 §5.3.1 LRFD usa 1.6 para H. (CR-Cal-Bug 2026-05:
  // anteriormente 1.7, valor de ACI 318-89 obsoleto.)
  const LF_H = 1.6;
  const Mu_pantalla_kNm = LF_H * (E1_pantalla_kN * Z1_pant_m + E2_pantalla_kN * Z2_pant_m);
  const Vu_pantalla_kN = LF_H * (E1_pantalla_kN + E2_pantalla_kN);

  // Pantalla section: width = ct (100% at base), d = ct - recubrimiento - dbar/2
  // Note: per meter of length, so b = 100 cm.
  const ct_cm = ct_m * 100;
  const pantalla_d_cm = ct_cm - 5 - 1.59 / 2;  // 5 cm recubrim, asume #5 bar
  const pantalla_d_m = pantalla_d_cm / 100;

  // phi*Vc (ACI 22.5) = 0.75 * 0.53 * sqrt(f'c) * b * d (kg, cm units → convert to kN)
  // f'c in kg/cm², b·d in cm² → 0.75·0.53·sqrt(fc)·b·d is in kg → ÷101.97 → kN
  const phiVc_pantalla_kg = phi_corte * 0.53 * Math.sqrt(fc) * 100 * pantalla_d_cm;
  const phiVc_pantalla_kN = phiVc_pantalla_kg * 9.81 / 1000;
  const pantalla_corte_ok = phiVc_pantalla_kN >= Vu_pantalla_kN;
  if (!pantalla_corte_ok) {
    warnings.push("Pantalla no resiste corte. Aumentar ct (espesor en la base).");
  }

  // Pantalla flexure: Mu in kN·m → kg·cm convert: × 101.97 then × 100
  // We'll work in consistent kg/cm: convert Mu_kNm to kg·cm: 1 kN·m = 101.971 kg·m = 10197.1 kg·cm
  const Mu_pantalla_kgcm = Mu_pantalla_kNm * 10197.1;
  // Use formula: As = Mu / (phi · fy · 0.9d) — first approximation
  const As_pantalla_cm2 = Mu_pantalla_kgcm / (phi_flexion * fy * 0.9 * pantalla_d_cm);
  const As_pantalla_min_cm2 = (14 / fy) * 100 * pantalla_d_cm;
  const As_pantalla_diseno_cm2 = Math.max(As_pantalla_cm2, As_pantalla_min_cm2);

  const pantPick = pickRebar(As_pantalla_diseno_cm2, 100, [5, 6, 7, 8]);
  // Outer face (exterior) uses minimum (temperature):
  const As_pantalla_ext_cm2 = 0.0018 * 100 * ct_cm;
  const pantExtPick = pickRebar(As_pantalla_ext_cm2, 100, [4, 5]);
  // Horizontal pantalla: As_temp also 0.0018 b·h per face
  const As_pantalla_horiz_cm2 = 0.0025 * 100 * ct_cm; // 0.25% for retaining walls

  // ---- Gancho anclaje (Ldh) ----
  // Ldh = (fy · psi_e / (17·sqrt(f'c))) · db, with factors per ACI §25.4.3.
  // PDF A uses: Ldh = 3.18 · db / sqrt(fc) (their simplified expression)
  const db_pant_cm = dbBar(pantPick.size);
  const Ldh_basic_cm = 3.18 * db_pant_cm * Math.sqrt(fy / fc);
  const r1 = 0.7; // factor para ganchos con recubrimiento adecuado
  const r2 = 1.0;
  const Ldh_final_cm = r1 * r2 * Ldh_basic_cm;
  const Ldh_ok = Ldh_final_cm <= Hz_m * 100; // debe caber en la zapata

  // ---- Talón posterior (heel back of footing) ----
  // Carga abajo: q_act (suelo empuja hacia arriba). Carga arriba: peso del relleno + zapata (hacia abajo).
  // Mu se calcula en la cara posterior de la pantalla.
  const W_relleno_talonPost_kNm = gamma_r * H_m;        // kN/m² distribuido
  const W_zapata_talonPost_kNm = gamma_c * Hz_m;
  const W_sobrecarga_talonPost = qSC;
  const W_arriba_kNm = W_relleno_talonPost_kNm + W_zapata_talonPost_kNm + W_sobrecarga_talonPost;
  // Reaccion del suelo en la posición media del talón posterior:
  // Posicion x desde la punta donde inicia talón posterior = b + ct
  const x_inicio_talonPost = b_m + ct_m;
  const x_fin_talonPost = B_m;
  // Pressure variation linear from qmax (at toe) to qmin (at heel)
  const q_at = (x: number) => {
    if (presionCase === "trapezoidal") {
      const t = x / B_m;
      return qmax_kPa + (qmin_kPa - qmax_kPa) * t;
    } else {
      return qact_kPa;  // uniforme dentro del B'
    }
  };
  const q_promedio_talonPost = (q_at(x_inicio_talonPost) + q_at(x_fin_talonPost)) / 2;
  const Wu_talonPost_kNm = 1.4 * W_arriba_kNm - 0.9 * q_promedio_talonPost;
  // Note: la carga net empuja HACIA ABAJO si W_arriba > q_suelo
  const Mu_talonPost_kNm = Math.abs(Wu_talonPost_kNm) * Bp_m * Bp_m / 2;
  const Vu_talonPost_kN = Math.abs(Wu_talonPost_kNm) * Bp_m;
  const Hz_cm = Hz_m * 100;
  const talonPost_d_cm = Hz_cm - 7.5 - 1.59 / 2;
  const talonPost_d_m = talonPost_d_cm / 100;
  const phiVc_talonPost_kg = phi_corte * 0.53 * Math.sqrt(fc) * 100 * talonPost_d_cm;
  const phiVc_talonPost_kN = phiVc_talonPost_kg * 9.81 / 1000;
  const talonPost_corte_ok = phiVc_talonPost_kN >= Vu_talonPost_kN;
  const Mu_talonPost_kgcm = Mu_talonPost_kNm * 10197.1;
  const As_talonPost_cm2 = Mu_talonPost_kgcm / (phi_flexion * fy * 0.9 * talonPost_d_cm);
  const As_talonPost_min_cm2 = (14 / fy) * 100 * talonPost_d_cm;
  const As_talonPost_diseno_cm2 = Math.max(As_talonPost_cm2, As_talonPost_min_cm2);
  const talonPostPick = pickRebar(As_talonPost_diseno_cm2, 100, [4, 5, 6]);

  // ---- Talón delantero (toe / punta) ----
  // Carga abajo: q_act (empuja hacia arriba). Carga arriba: solo peso zapata + relleno frontal mínimo (D).
  const W_relleno_punta_kNm = gamma_r * D_m;
  const W_zapata_punta_kNm = gamma_c * Hz_m;
  const W_arriba_punta_kNm = W_relleno_punta_kNm + W_zapata_punta_kNm;
  const q_promedio_punta = (q_at(0) + q_at(b_m)) / 2;
  const Wu_talonDel_kNm = 0.9 * q_promedio_punta - 1.4 * W_arriba_punta_kNm;
  const Mu_talonDel_kNm = Math.abs(Wu_talonDel_kNm) * b_m * b_m / 2;
  const Vu_talonDel_kN = Math.abs(Wu_talonDel_kNm) * b_m;
  const talonDel_d_cm = talonPost_d_cm;
  const talonDel_d_m = talonPost_d_m;
  const phiVc_talonDel_kg = phi_corte * 0.53 * Math.sqrt(fc) * 100 * talonDel_d_cm;
  const phiVc_talonDel_kN = phiVc_talonDel_kg * 9.81 / 1000;
  const talonDel_corte_ok = phiVc_talonDel_kN >= Vu_talonDel_kN;
  const Mu_talonDel_kgcm = Mu_talonDel_kNm * 10197.1;
  const As_talonDel_cm2 = Mu_talonDel_kgcm / (phi_flexion * fy * 0.9 * talonDel_d_cm);
  const As_talonDel_min_cm2 = (14 / fy) * 100 * talonDel_d_cm;
  const As_talonDel_diseno_cm2 = Math.max(As_talonDel_cm2, As_talonDel_min_cm2);
  const talonDelPick = pickRebar(As_talonDel_diseno_cm2, 100, [4, 5]);

  // ---- Zonal warnings ----
  if (zonaSismica >= 3) {
    warnings.push("Zona sísmica III/IV: usar acero ASTM A706 + ganchos 135°.");
  }

  return {
    input,
    B_m, H_total_m, hs_m,
    Ka, Kp,
    pa_max_kPa, E1_kN, Z1_m, M_E1_kNm,
    pSC_kPa, E2_kN, Z2_m, M_E2_kNm,
    Ep_kN, Zp_m,
    sumFh_kN, sumMo_kNm,
    sections, sumFv_kN, sumMr_kNm,
    FS_vuelco, FS_vuelco_min, FS_vuelco_ok,
    Fr_friccion_kN, Fr_pasivo_kN, Fr_total_kN,
    FS_desliz, FS_desliz_min, FS_desliz_ok,
    x_bar_m, e_m, e_limite_m, e_ok,
    presionCase, qmax_kPa, qmin_kPa, qact_kPa, Befectivo_m, qadm_ok,
    Nq, Nc, N_gamma, qu_kPa, FS_scc, FS_scc_min, FS_scc_ok,
    pantalla_d_m, Vu_pantalla_kN, phiVc_pantalla_kN, pantalla_corte_ok,
    Mu_pantalla_kNm, As_pantalla_cm2, As_pantalla_min_cm2, As_pantalla_diseno_cm2,
    As_pantalla_size: pantPick.size, As_pantalla_sep_cm: pantPick.sep_cm,
    As_pantalla_ext_cm2, As_pantalla_ext_size: pantExtPick.size, As_pantalla_ext_sep_cm: pantExtPick.sep_cm,
    As_pantalla_horiz_cm2,
    Ldh_basic_cm, Ldh_final_cm, Ldh_ok,
    talonPost_d_m, Vu_talonPost_kN, phiVc_talonPost_kN, talonPost_corte_ok,
    Mu_talonPost_kNm, As_talonPost_cm2, As_talonPost_diseno_cm2,
    As_talonPost_size: talonPostPick.size, As_talonPost_sep_cm: talonPostPick.sep_cm,
    talonDel_d_m, Vu_talonDel_kN, phiVc_talonDel_kN, talonDel_corte_ok,
    Mu_talonDel_kNm, As_talonDel_cm2, As_talonDel_diseno_cm2,
    As_talonDel_size: talonDelPick.size, As_talonDel_sep_cm: talonDelPick.sep_cm,
    warnings, errors,
  };
}

// ---------------------------------------------------------------------------
// Build the structured step list (drives the Mathcad-style center panel)
// ---------------------------------------------------------------------------

export function buildRetainingWallSteps(r: RetainingWallLiveResult): CalculationStep[] {
  return [
    {
      id: "rw.step_01_Ka",
      name: "Coeficiente activo de Rankine",
      equation_latex: "K_a = \\tan^2\\left(45° - \\frac{\\phi}{2}\\right)",
      inputs: { phi: r.input.phi_deg },
      output_var: "Ka",
      output_value: r.Ka,
      output_unit: "",
      code_ref: "Rankine 1857",
      depends_on: [],
      note: "Coeficiente de presión activa para suelo cohesionless detrás del muro.",
    },
    {
      id: "rw.step_02_Kp",
      name: "Coeficiente pasivo de Rankine",
      equation_latex: "K_p = 1/K_a = \\tan^2(45° + \\phi/2)",
      inputs: { phi: r.input.phi_deg },
      output_var: "Kp",
      output_value: r.Kp,
      output_unit: "",
      code_ref: "",
      depends_on: ["rw.step_01_Ka"],
      note: "Resistencia pasiva en la punta (estabiliza).",
    },
    {
      id: "rw.step_03_E1",
      name: "Empuje activo (triangular)",
      equation_latex: "E_1 = \\tfrac{1}{2}\\gamma_r H^2 K_a",
      inputs: { gamma_r: r.input.gamma_r, H: r.H_total_m, Ka: r.Ka },
      output_var: "E1",
      output_value: r.E1_kN,
      output_unit: "kN/m",
      code_ref: "Teoría de Rankine",
      depends_on: ["rw.step_01_Ka"],
      note: `Resultante actúa a H/3 = ${r.Z1_m.toFixed(2)} m desde la base.`,
    },
    {
      id: "rw.step_04_E2",
      name: "Empuje por sobrecarga (rectangular)",
      equation_latex: "E_2 = q_{SC} \\cdot K_a \\cdot H",
      inputs: { qSC: r.input.qSC, Ka: r.Ka, H: r.H_total_m },
      output_var: "E2",
      output_value: r.E2_kN,
      output_unit: "kN/m",
      code_ref: "",
      depends_on: ["rw.step_01_Ka"],
      note: `Centroide a H/2 = ${r.Z2_m.toFixed(2)} m.`,
    },
    {
      id: "rw.step_05_Ep",
      name: "Empuje pasivo (sobre la punta)",
      equation_latex: "E_p = \\tfrac{1}{2}\\gamma_r D^2 K_p",
      inputs: { gamma_r: r.input.gamma_r, D: r.input.D_m, Kp: r.Kp },
      output_var: "Ep",
      output_value: r.Ep_kN,
      output_unit: "kN/m",
      code_ref: "",
      depends_on: ["rw.step_02_Kp"],
      note: "Aporta resistencia al deslizamiento; no se considera en vuelco.",
    },
    {
      id: "rw.step_06_sumFh",
      name: "Suma de fuerzas horizontales actuantes",
      equation_latex: "\\sum F_h = E_1 + E_2",
      inputs: { E1: r.E1_kN, E2: r.E2_kN },
      output_var: "sumFh",
      output_value: r.sumFh_kN,
      output_unit: "kN/m",
      code_ref: "",
      depends_on: ["rw.step_03_E1", "rw.step_04_E2"],
      note: "",
    },
    {
      id: "rw.step_07_sumMo",
      name: "Suma de momentos volcadores",
      equation_latex: "\\sum M_o = E_1 \\cdot Z_1 + E_2 \\cdot Z_2",
      inputs: { E1Z1: r.M_E1_kNm, E2Z2: r.M_E2_kNm },
      output_var: "sumMo",
      output_value: r.sumMo_kNm,
      output_unit: "kN·m/m",
      code_ref: "",
      depends_on: ["rw.step_06_sumFh"],
      note: "",
    },
    {
      id: "rw.step_08_sumFv",
      name: "Suma de fuerzas verticales (4 secciones + sobrecarga)",
      equation_latex: "\\sum F_v = \\omega_1 + \\omega_2 + \\omega_3 + \\omega_4 + q_{SC}\\cdot B_p",
      inputs: r.sections.reduce((acc, s) => ({ ...acc, [`w${s.id}`]: s.weight_kN }), {}),
      output_var: "sumFv",
      output_value: r.sumFv_kN,
      output_unit: "kN/m",
      code_ref: "",
      depends_on: [],
      note: "Peso de cimentación + 2 partes de pantalla + relleno sobre talón + sobrecarga.",
    },
    {
      id: "rw.step_09_sumMr",
      name: "Suma de momentos resistentes",
      equation_latex: "\\sum M_R = \\sum \\omega_i \\cdot Z_i",
      inputs: { sumMr: r.sumMr_kNm },
      output_var: "sumMr",
      output_value: r.sumMr_kNm,
      output_unit: "kN·m/m",
      code_ref: "",
      depends_on: ["rw.step_08_sumFv"],
      note: "Cada peso multiplicado por su brazo hasta la punta.",
    },
    {
      id: "rw.step_10_FSv",
      name: "Factor de seguridad al vuelco",
      equation_latex: "FS_v = \\frac{\\sum M_R}{\\sum M_o}",
      inputs: { sumMr: r.sumMr_kNm, sumMo: r.sumMo_kNm },
      output_var: "FS_v",
      output_value: r.FS_vuelco,
      output_unit: "",
      code_ref: "CSCR-10 §17",
      depends_on: ["rw.step_07_sumMo", "rw.step_09_sumMr"],
      note: `Requerido ≥ ${r.FS_vuelco_min}. ${r.FS_vuelco_ok ? "✓ OK" : "✗ FALLA"}`,
    },
    {
      id: "rw.step_11_FSd",
      name: "Factor de seguridad al deslizamiento",
      equation_latex: "FS_d = \\frac{\\mu \\sum F_v + E_p}{\\sum F_h}",
      inputs: { mu: r.input.mu_ct, sumFv: r.sumFv_kN, Ep: r.Ep_kN, sumFh: r.sumFh_kN },
      output_var: "FS_d",
      output_value: r.FS_desliz,
      output_unit: "",
      code_ref: "CSCR-10 §17",
      depends_on: ["rw.step_08_sumFv"],
      note: `Requerido ≥ ${r.FS_desliz_min}. ${r.FS_desliz_ok ? "✓ OK" : "✗ FALLA"}`,
    },
    {
      id: "rw.step_12_e",
      name: "Excentricidad de la resultante",
      equation_latex: "e = \\frac{B}{2} - \\bar{x}, \\quad \\bar{x} = \\frac{\\sum M_R - \\sum M_o}{\\sum F_v}",
      inputs: { B: r.B_m, sumMr: r.sumMr_kNm, sumMo: r.sumMo_kNm, sumFv: r.sumFv_kN },
      output_var: "e",
      output_value: r.e_m,
      output_unit: "m",
      code_ref: "",
      depends_on: ["rw.step_09_sumMr"],
      note: `B/6 = ${r.e_limite_m.toFixed(3)} m. ${r.e_ok ? "Distribución trapezoidal." : "Rectangular B'."}`,
    },
    {
      id: "rw.step_13_qmax",
      name: "Presión máxima bajo la zapata",
      equation_latex: r.e_ok
        ? "q_{max} = \\frac{\\sum F_v}{B}\\left(1 + \\frac{6e}{B}\\right)"
        : "q_{max} = \\frac{\\sum F_v}{B'}, \\; B' = B - 2e",
      inputs: { sumFv: r.sumFv_kN, B: r.B_m, e: r.e_m },
      output_var: "q_max",
      output_value: r.qmax_kPa,
      output_unit: "kPa",
      code_ref: "",
      depends_on: ["rw.step_12_e"],
      note: `q_adm = ${r.input.qadm.toFixed(0)} kPa. ${r.qadm_ok ? "✓ OK" : "✗ Excede"}`,
    },
    {
      id: "rw.step_14_qu",
      name: "Capacidad última del suelo (Brinch Hansen)",
      equation_latex: "q_u = c N_c d_c i_c + q N_q d_q i_q + \\tfrac{1}{2}\\gamma B' N_\\gamma d_\\gamma i_\\gamma",
      inputs: { Nq: r.Nq, Nc: r.Nc, N_gamma: r.N_gamma, B_prime: r.Befectivo_m },
      output_var: "q_u",
      output_value: r.qu_kPa,
      output_unit: "kPa",
      code_ref: "Brinch Hansen 1970",
      depends_on: ["rw.step_13_qmax"],
      note: `FS_scc = q_u / q_max = ${r.FS_scc.toFixed(2)}. ${r.FS_scc_ok ? "✓ OK" : "✗ Revisar suelo"}`,
    },
    {
      id: "rw.step_15_Vu_pant",
      name: "Cortante último en la base de la pantalla",
      equation_latex: "V_u = 1.7 (E_{1,pant} + E_{2,pant})",
      inputs: { E1pant: 0.5 * r.input.gamma_r * r.input.H_m * r.input.H_m * r.Ka, E2pant: r.input.qSC * r.Ka * r.input.H_m },
      output_var: "Vu_pant",
      output_value: r.Vu_pantalla_kN,
      output_unit: "kN/m",
      code_ref: "ACI 318-14 §9.5",
      depends_on: [],
      note: `phiVc = ${r.phiVc_pantalla_kN.toFixed(1)} kN. ${r.pantalla_corte_ok ? "✓ OK" : "✗ Aumentar ct"}`,
    },
    {
      id: "rw.step_16_Mu_pant",
      name: "Momento último en la base de la pantalla",
      equation_latex: "M_u = 1.7 (M_{E1,pant} + M_{E2,pant})",
      inputs: { Mu: r.Mu_pantalla_kNm },
      output_var: "Mu_pant",
      output_value: r.Mu_pantalla_kNm,
      output_unit: "kN·m/m",
      code_ref: "ACI 318-14 §22.2",
      depends_on: ["rw.step_15_Vu_pant"],
      note: "",
    },
    {
      id: "rw.step_17_As_pant",
      name: "Acero vertical principal en pantalla",
      equation_latex: "A_s = \\frac{M_u}{\\phi f_y (0.9 d)}",
      inputs: { Mu: r.Mu_pantalla_kNm, phi: r.input.phi_flexion, fy: r.input.fy, d: r.pantalla_d_m * 100 },
      output_var: "As_pant",
      output_value: r.As_pantalla_diseno_cm2,
      output_unit: "cm²/m",
      code_ref: "ACI §9.6",
      depends_on: ["rw.step_16_Mu_pant"],
      note: `Ø${r.As_pantalla_size} @ ${r.As_pantalla_sep_cm.toFixed(0)} cm en cara interior.`,
    },
    {
      id: "rw.step_18_Ldh",
      name: "Longitud de anclaje del gancho",
      equation_latex: "L_{dh} = 0.7 \\cdot 3.18 \\cdot d_b \\sqrt{f_y/f'_c}",
      inputs: { db: dbBar(r.As_pantalla_size), fy: r.input.fy, fc: r.input.fc },
      output_var: "Ldh",
      output_value: r.Ldh_final_cm,
      output_unit: "cm",
      code_ref: "ACI §25.4.3",
      depends_on: ["rw.step_17_As_pant"],
      note: `Hz = ${r.input.Hz_m * 100} cm disponible. ${r.Ldh_ok ? "✓ OK" : "✗ Aumentar Hz"}`,
    },
    {
      id: "rw.step_19_As_talonPost",
      name: "Acero principal del talón posterior",
      equation_latex: "A_s = \\frac{M_u}{\\phi f_y (0.9 d)}",
      inputs: { Mu: r.Mu_talonPost_kNm, d: r.talonPost_d_m * 100 },
      output_var: "As_talonPost",
      output_value: r.As_talonPost_diseno_cm2,
      output_unit: "cm²/m",
      code_ref: "ACI §9.6",
      depends_on: [],
      note: `Ø${r.As_talonPost_size} @ ${r.As_talonPost_sep_cm.toFixed(0)} cm encima de la zapata.`,
    },
    {
      id: "rw.step_20_As_talonDel",
      name: "Acero principal del talón delantero (punta)",
      equation_latex: "A_s = \\frac{M_u}{\\phi f_y (0.9 d)}",
      inputs: { Mu: r.Mu_talonDel_kNm, d: r.talonDel_d_m * 100 },
      output_var: "As_talonDel",
      output_value: r.As_talonDel_diseno_cm2,
      output_unit: "cm²/m",
      code_ref: "ACI §9.6",
      depends_on: [],
      note: `Ø${r.As_talonDel_size} @ ${r.As_talonDel_sep_cm.toFixed(0)} cm abajo de la zapata.`,
    },
  ];
}

export function buildRetainingWallChecks(r: RetainingWallLiveResult) {
  return [
    {
      nombre: "FS al vuelco",
      requerido: r.FS_vuelco_min,
      disponible: r.FS_vuelco,
      unidad: "",
      cumple: r.FS_vuelco_ok,
      referencia: "CSCR-10 §17 + práctica CR",
      critical: true,
    },
    {
      nombre: "FS al deslizamiento",
      requerido: r.FS_desliz_min,
      disponible: r.FS_desliz,
      unidad: "",
      cumple: r.FS_desliz_ok,
      referencia: "CSCR-10 §17 + práctica CR",
      critical: true,
    },
    {
      nombre: "Excentricidad e ≤ B/6",
      requerido: r.e_limite_m,
      disponible: r.e_m,
      unidad: "m",
      cumple: r.e_ok,
      referencia: "Estabilidad de cimientos",
      critical: false,
    },
    {
      nombre: "q_max ≤ q_adm",
      requerido: r.qmax_kPa,
      disponible: r.input.qadm,
      unidad: "kPa",
      cumple: r.qadm_ok,
      referencia: "CSCR-10 §6",
      critical: true,
    },
    {
      nombre: "FS_scc (capacidad última)",
      requerido: r.FS_scc_min,
      disponible: r.FS_scc,
      unidad: "",
      cumple: r.FS_scc_ok,
      referencia: "Brinch Hansen",
      critical: true,
    },
    {
      nombre: "Cortante en pantalla",
      requerido: r.Vu_pantalla_kN,
      disponible: r.phiVc_pantalla_kN,
      unidad: "kN/m",
      cumple: r.pantalla_corte_ok,
      referencia: "ACI §22.5",
      critical: true,
    },
    {
      nombre: "Cortante en talón posterior",
      requerido: r.Vu_talonPost_kN,
      disponible: r.phiVc_talonPost_kN,
      unidad: "kN/m",
      cumple: r.talonPost_corte_ok,
      referencia: "ACI §22.5",
      critical: true,
    },
    {
      nombre: "Cortante en talón delantero",
      requerido: r.Vu_talonDel_kN,
      disponible: r.phiVc_talonDel_kN,
      unidad: "kN/m",
      cumple: r.talonDel_corte_ok,
      referencia: "ACI §22.5",
      critical: true,
    },
    {
      nombre: "Longitud de anclaje del gancho",
      requerido: r.Ldh_final_cm,
      disponible: r.input.Hz_m * 100,
      unidad: "cm",
      cumple: r.Ldh_ok,
      referencia: "ACI §25.4.3",
      critical: false,
    },
  ];
}
