/**
 * Potencial de licuefacción — Procedimiento simplificado Seed-Idriss
 * actualizado por Youd & Idriss (2001) y Boulanger & Idriss (2014).
 *
 * Sources:
 * - Seed, H.B. & Idriss, I.M. (1971). "Simplified procedure for evaluating
 *   soil liquefaction potential." JSMFD 97(SM9): 1249-1273.
 * - Youd, T.L. & Idriss, I.M. (2001). "Liquefaction resistance of soils:
 *   summary report from the 1996 NCEER and 1998 NCEER/NSF workshops."
 *   JGGE 127(4): 297-313.
 * - Boulanger, R.W. & Idriss, I.M. (2014). "CPT and SPT based liquefaction
 *   triggering procedures." UC Davis Report UCD/CGM-14/01.
 * - Liao, S.S.C. & Whitman, R.V. (1986). "Overburden correction factors
 *   for SPT in sand." JGE 112(3): 373-377.
 * - Idriss, I.M. & Boulanger, R.W. (2008). "Soil liquefaction during
 *   earthquakes." EERI MNO-12.
 * - CSCR-10 Rev. 2014 §17.7 — riesgo de licuefacción.
 */

export interface LiqLayer {
  /** Profundidad media (m). */
  depth_m: number;
  /** N60 (energía 60%, sin corrección por sobrecarga). */
  N60: number;
  /** Tipo de suelo. */
  soil_type: "arena" | "arena_limosa" | "limo" | "arcilla";
  /** Porcentaje de finos FC (%). */
  fines_pct: number;
  /** Peso específico γ (kN/m³). */
  gamma_kN_m3: number;
}

export interface LiqInput {
  layers: LiqLayer[];
  /** Nivel freático (m). 99 si no hay. */
  water_table_m: number;
  /** Aceleración máxima en superficie a_max (g). */
  a_max_g: number;
  /** Magnitud sísmica Mw. */
  Mw: number;
}

export interface LiqLayerResult {
  depth_m: number;
  N60: number;
  fines_pct: number;
  /** Esfuerzo total σv (kPa). */
  sigma_v_kPa: number;
  /** Esfuerzo efectivo σ'v (kPa). */
  sigma_v_eff_kPa: number;
  /** Factor de reducción rd (Liao & Whitman 1986). */
  rd: number;
  /** CSR (cyclic stress ratio). */
  CSR: number;
  /** C_N (Liao & Whitman). */
  C_N: number;
  /** (N1)60. */
  N1_60: number;
  /** Corrección por finos Δ(N1)60. */
  delta_N: number;
  /** (N1)60cs equivalente arena limpia. */
  N1_60cs: number;
  /** CRR 7.5 (Youd 2001). */
  CRR_75: number;
  /** Magnitude Scaling Factor (Youd 2001). */
  MSF: number;
  /** CRR escalado por MSF. */
  CRR_M: number;
  /** Factor de seguridad. */
  FS_liq: number;
  /** ¿Licuable? */
  licuable: boolean;
  /** Razón si no es candidato (sobre nivel freático, suelo no susceptible, etc). */
  reason: string;
}

export interface LiqResult {
  layers: LiqLayerResult[];
  /** Profundidad de la capa más crítica (mínimo FS_liq entre las susceptibles). */
  critical_depth_m: number | null;
  /** FS mínimo. */
  FS_min: number | null;
  /** ¿Hay capas licuables? */
  hay_licuacion: boolean;
  citations: string[];
  warnings: string[];
}

/** Liao & Whitman (1986): rd profile. */
function rd_LiaoWhitman(z: number): number {
  if (z < 9.15) return 1 - 0.00765 * z;
  if (z < 23) return 1.174 - 0.0267 * z;
  return Math.max(0.5, 0.744 - 0.008 * z);
}

/** C_N = sqrt(100/σ'v), capped at 1.7. */
function C_N_LiaoWhitman(sigma_v_eff_kPa: number): number {
  return Math.min(1.7, Math.sqrt(100 / Math.max(1, sigma_v_eff_kPa)));
}

/** Idriss & Boulanger (2008): Δ(N1)60 for fines content. */
function deltaN_finesCorrection(N1_60: number, FC_pct: number): number {
  // Δ(N1)60 = exp(1.63 + 9.7/(FC+0.01) - (15.7/(FC+0.01))²)
  // Approximate practical table:
  if (FC_pct <= 5) return 0;
  if (FC_pct >= 35) return 5;
  // Linear interp
  return 5 * ((FC_pct - 5) / 30);
}

/** Youd (2001) CRR_7.5 simplified equation (clean sand). */
function CRR_75_Youd(N1_60cs: number): number {
  // Valid for N1_60cs < 30; above that, "non-liquefiable"
  if (N1_60cs >= 30) return 2.0; // effectively non-liquefiable
  // CRR_7.5 = 1/(34 - N1_60cs) + N1_60cs/135 + 50/(10·N1_60cs + 45)² - 1/200
  const term1 = 1 / (34 - N1_60cs);
  const term2 = N1_60cs / 135;
  const term3 = 50 / Math.pow(10 * N1_60cs + 45, 2);
  return Math.max(0, term1 + term2 + term3 - 1 / 200);
}

/** Magnitude Scaling Factor (Youd 2001). MSF = 10^2.24 / Mw^2.56 */
function MSF_Youd(Mw: number): number {
  return Math.pow(10, 2.24) / Math.pow(Mw, 2.56);
}

export function computeLiquefactionLive(input: LiqInput): LiqResult {
  const warnings: string[] = [];
  const citations = [
    "Seed & Idriss (1971) JSMFD 97(SM9)",
    "Youd & Idriss (2001) JGGE 127(4)",
    "Boulanger & Idriss (2014) UCD/CGM-14/01",
    "Liao & Whitman (1986)",
    "Idriss & Boulanger (2008) EERI MNO-12",
    "CSCR-10 Rev. 2014 §17.7",
  ];

  if (input.a_max_g < 0.05) {
    warnings.push(`a_max = ${input.a_max_g}g muy bajo, evaluar zona sísmica CR.`);
  }
  if (input.Mw < 5 || input.Mw > 9) {
    warnings.push(`Mw = ${input.Mw} fuera del rango común 5-9.`);
  }

  const layers: LiqLayerResult[] = input.layers.map((l) => {
    // σv, σ'v
    // Approximate using gamma·depth; ignore higher layers for simplicity (each layer treated as a point).
    const sigma_v = l.gamma_kN_m3 * l.depth_m;
    const u = l.depth_m > input.water_table_m
      ? 9.81 * (l.depth_m - input.water_table_m)
      : 0;
    const sigma_v_eff = Math.max(1, sigma_v - u);

    const rd = rd_LiaoWhitman(l.depth_m);
    const CSR = 0.65 * input.a_max_g * (sigma_v / sigma_v_eff) * rd;

    const C_N = C_N_LiaoWhitman(sigma_v_eff);
    const N1_60 = l.N60 * C_N;
    const delta_N = deltaN_finesCorrection(N1_60, l.fines_pct);
    const N1_60cs = N1_60 + delta_N;

    const CRR_75 = CRR_75_Youd(N1_60cs);
    const MSF = MSF_Youd(input.Mw);
    const CRR_M = CRR_75 * MSF;

    // Eligibility: below water table AND granular (arena or arena_limosa).
    // Clays and silts with FC > 35% generally non-liquefiable per Youd 2001 ("Chinese criteria" superseded by Bray-Sancio 2006 but Youd still common).
    const eligible = l.depth_m > input.water_table_m
      && (l.soil_type === "arena" || l.soil_type === "arena_limosa")
      && l.fines_pct < 35
      && N1_60cs < 30;

    let FS = 999;
    let licuable = false;
    let reason = "";
    if (!eligible) {
      if (l.depth_m <= input.water_table_m) reason = "sobre nivel freático";
      else if (l.soil_type === "arcilla" || l.soil_type === "limo") reason = "cohesivo (no licuable)";
      else if (l.fines_pct >= 35) reason = `FC=${l.fines_pct.toFixed(0)}% ≥ 35%, no licuable`;
      else if (N1_60cs >= 30) reason = "(N1)60cs ≥ 30, suelo denso, no licuable";
    } else if (CSR > 0) {
      FS = CRR_M / CSR;
      licuable = FS < 1.0;
    }

    return {
      depth_m: l.depth_m,
      N60: l.N60,
      fines_pct: l.fines_pct,
      sigma_v_kPa: sigma_v,
      sigma_v_eff_kPa: sigma_v_eff,
      rd, CSR,
      C_N, N1_60, delta_N, N1_60cs,
      CRR_75, MSF, CRR_M,
      FS_liq: FS,
      licuable,
      reason,
    };
  });

  const susceptibles = layers.filter((l) => l.FS_liq < 999);
  let critical_depth: number | null = null;
  let FS_min: number | null = null;
  if (susceptibles.length > 0) {
    const sorted = [...susceptibles].sort((a, b) => a.FS_liq - b.FS_liq);
    critical_depth = sorted[0].depth_m;
    FS_min = sorted[0].FS_liq;
  }

  const hay = layers.some((l) => l.licuable);
  if (hay) {
    warnings.push(
      `Capas licuables detectadas. Considera mitigación: drenes verticales, columnas de grava, deep soil mixing (CSCR §17.7).`,
    );
  }

  return {
    layers,
    critical_depth_m: critical_depth,
    FS_min,
    hay_licuacion: hay,
    citations,
    warnings,
  };
}
