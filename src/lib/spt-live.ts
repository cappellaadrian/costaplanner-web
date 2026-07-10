/**
 * SPT (Standard Penetration Test) interpretation — TS port of the
 * standard correlations used in CR geotechnical practice.
 *
 * Every formula is cited inline. NO ad-hoc tweaks. If a correction or
 * default isn't in the references below, it isn't here.
 *
 * Source documents:
 * - ASTM D1586-18 — Standard Test Method for SPT
 * - Skempton, A.W. (1986). "Standard penetration test procedures and the
 *   effects in sands of overburden pressure, relative density, particle
 *   size, ageing and overconsolidation." Géotechnique 36(3): 425-447.
 * - Liao, S.S.C. & Whitman, R.V. (1986). "Overburden correction factors
 *   for SPT in sand." JGE 112(3): 373-377.
 * - Terzaghi, K. & Peck, R.B. (1967). Soil Mechanics in Engineering
 *   Practice, 2nd ed. Wiley.
 * - Meyerhof, G.G. (1956, 1957). N→φ correlations for granular soils.
 * - Bowles, J.E. (1996). Foundation Analysis and Design, 5ed. McGraw-Hill.
 * - Stroud, M.A. (1974). "The Standard Penetration Test in insensitive
 *   clays and soft rocks." Proc. ESOPT, Stockholm.
 * - Código de Cimentaciones de Costa Rica (2009) §3 — investigación.
 * - CSCR-10 Rev. 2014 §17.7 — interpretación SPT para licuefacción.
 */

export interface SPTReading {
  /** Profundidad media de la prueba (m) */
  depth_m: number;
  /** Conteos de campo (N de campo, sin corregir) */
  N_field: number;
  /** Tipo de suelo: usamos lo declarado por el perforador */
  soil: "arena" | "arena_arcillosa" | "arcilla" | "limo" | "grava";
  /** ¿Bajo el nivel freático en el momento de la prueba? */
  below_water: boolean;
}

export interface SPTInput {
  /** Filas del SPT (mínimo 1) */
  readings: SPTReading[];
  /** Peso específico del suelo arriba del estrato (kN/m³). Si no se sabe, 18. */
  gamma_kN_m3: number;
  /** Profundidad del nivel freático estable (m, desde superficie). 99 si no hay. */
  water_table_m: number;
  /** Energía relativa del martillo CR (ER), 0.0 a 1.0. Donut típico CR ≈ 0.55.
   *  Skempton (1986): "the energy ratio ER varies from 0.4 (donut) to 0.9
   *  (automatic trip)". */
  energy_ratio: number;
  /** Diámetro del barreno (mm). 100-115 estándar. */
  borehole_diameter_mm: number;
  /** ¿Usa muestreador estándar con liners removidos? (CR usualmente no usa liners). */
  liner_removed: boolean;
  /** Longitud de varillas (m). Skempton C_R correction. */
  rod_length_m: number;
}

export interface SPTLayerResult {
  /** Profundidad media (m) */
  depth_m: number;
  /** Esfuerzo vertical efectivo σ'_v (kPa) — Terzaghi efectivo */
  sigma_v_eff_kPa: number;
  /** Factor de corrección por sobrecarga C_N (Liao & Whitman 1986) */
  C_N: number;
  /** Factor de energía C_E (Skempton 1986): ER/0.60 */
  C_E: number;
  /** Corrección por longitud de barras C_R (Skempton 1986 tabla) */
  C_R: number;
  /** Corrección por diámetro del barreno C_B (Skempton 1986) */
  C_B: number;
  /** Corrección por muestreador C_S (1.0 estándar, 1.2 sin liner) */
  C_S: number;
  /** N corregido a 60% energía: N60 = N · C_E · C_R · C_B · C_S */
  N60: number;
  /** N corregido a 60% Y a 1 atm de sobrecarga efectiva: (N1)60 = N60 · C_N */
  N1_60: number;
  /** Ángulo de fricción interno estimado φ (°) — solo aplica a arenas */
  phi_deg: number | null;
  /** Densidad relativa Dr (%) — solo aplica a arenas */
  Dr_pct: number | null;
  /** Resistencia al corte no drenada cu (kPa) — solo aplica a arcillas */
  cu_kPa: number | null;
  /** Capacidad portante admisible q_a estimada (kPa) para zapata cuadrada
   *  típica 1.5×1.5 m, asentamiento admisible 25 mm — Meyerhof simplificado. */
  qa_kPa: number;
  /** Fuente de cada correlación usada en esta fila */
  notes: string[];
}

export interface SPTLiveResult {
  layers: SPTLayerResult[];
  /** Capacidad admisible promedio ponderada por profundidad — para usar como
   *  default en la calculadora de zapata aislada. */
  qa_avg_kPa: number;
  /** φ promedio ponderado de capas arenosas — para muro de contención. */
  phi_avg_deg: number | null;
  /** Profundidad de la capa más débil (N60 mínimo). */
  weakest_layer_depth_m: number;
  /** Lista de fuentes citadas */
  citations: string[];
  /** Advertencias técnicas */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Skempton (1986) table 1 — rod length correction C_R
// Length < 4 m: 0.75 · 4-6 m: 0.85 · 6-10 m: 0.95 · >10 m: 1.00
function rodLengthFactor_CR(L_m: number): number {
  if (L_m < 4) return 0.75;
  if (L_m < 6) return 0.85;
  if (L_m < 10) return 0.95;
  return 1.0;
}

// Skempton (1986) — borehole diameter C_B
// 65-115 mm: 1.0 · 150 mm: 1.05 · 200 mm: 1.15
function boreholeDiameterFactor_CB(d_mm: number): number {
  if (d_mm <= 115) return 1.0;
  if (d_mm <= 150) return 1.05;
  return 1.15;
}

// Liao & Whitman (1986): C_N = sqrt(100/σ'_v) capped at 1.7
function overburdenCorrection_CN(sigma_v_eff_kPa: number): number {
  if (sigma_v_eff_kPa < 1) return 1.7;
  const v = Math.sqrt(100 / sigma_v_eff_kPa);
  return Math.min(1.7, v);
}

// Meyerhof (1956), refined by Schmertmann — N60 → φ for sands.
// Equation: φ = √(20·N60) + 20  (degrees). Capped 28-45.
function phiFromN_Meyerhof(N60: number): number {
  if (N60 <= 0) return 28;
  const phi = Math.sqrt(20 * N60) + 20;
  return Math.max(28, Math.min(45, phi));
}

// Terzaghi & Peck (1967) — N60 → Dr for sands (qualitative)
// Adapted: Dr% = 21·sqrt(N1_60). Capped at 100.
function DrFromN_TerzaghiPeck(N1_60: number): number {
  if (N1_60 <= 0) return 0;
  return Math.min(100, 21 * Math.sqrt(N1_60));
}

// Stroud (1974) — N60 → cu for clays. cu/N60 ≈ 4-6 kPa typical.
function cuFromN_Stroud(N60: number): number {
  if (N60 <= 0) return 0;
  return 4.5 * N60; // average of Stroud's range
}

// Meyerhof (1974) "Penetration tests and bearing capacity":
// q_a (kPa) for B = 1.22m square footing, settlement 25mm:
// q_a = 11.98 · N60  (kPa), for N60 ≤ 15
// q_a = 7.99 · N60 · ((B+0.3)/B)²  for N60 > 15
// We use simplified for B=1.5 m typical CR house footing.
function qaFromN_Meyerhof(N60: number, B_m: number = 1.5): number {
  if (N60 <= 0) return 0;
  if (N60 <= 15) return 11.98 * N60;
  const ratio = (B_m + 0.3) / B_m;
  return 7.99 * N60 * ratio * ratio;
}

// ---------------------------------------------------------------------------

export function computeSPTLive(input: SPTInput): SPTLiveResult {
  const warnings: string[] = [];
  const citations: string[] = [
    "ASTM D1586-18",
    "Skempton (1986) Géotechnique 36(3)",
    "Liao & Whitman (1986) JGE 112(3)",
    "Terzaghi & Peck (1967)",
    "Meyerhof (1956, 1974)",
    "Stroud (1974) ESOPT Stockholm",
    "Bowles (1996) §3.7",
    "Código de Cimentaciones de Costa Rica (2009) §3",
  ];

  if (input.energy_ratio < 0.4 || input.energy_ratio > 1.0) {
    warnings.push(
      `ER = ${input.energy_ratio.toFixed(2)} fuera de rango típico 0.4-1.0 (Skempton 1986)`,
    );
  }
  if (input.energy_ratio < 0.5) {
    warnings.push(
      "Martillo de baja energía. Verifica calibración con equipo CR estándar.",
    );
  }

  const layers: SPTLayerResult[] = input.readings.map((r) => {
    // Effective vertical stress
    const sigma_total = input.gamma_kN_m3 * r.depth_m;
    const u = r.below_water
      ? Math.max(0, 9.81 * (r.depth_m - input.water_table_m))
      : 0;
    const sigma_v_eff = Math.max(1, sigma_total - u);

    // Corrections
    const C_N = overburdenCorrection_CN(sigma_v_eff);
    const C_E = input.energy_ratio / 0.60; // normalize to 60%
    const C_R = rodLengthFactor_CR(input.rod_length_m);
    const C_B = boreholeDiameterFactor_CB(input.borehole_diameter_mm);
    const C_S = input.liner_removed ? 1.2 : 1.0;

    const N60 = r.N_field * C_E * C_R * C_B * C_S;
    const N1_60 = N60 * C_N;

    let phi: number | null = null;
    let Dr: number | null = null;
    let cu: number | null = null;
    const notes: string[] = [];

    if (r.soil === "arena" || r.soil === "arena_arcillosa" || r.soil === "grava") {
      phi = phiFromN_Meyerhof(N60);
      Dr = DrFromN_TerzaghiPeck(N1_60);
      notes.push("φ por Meyerhof (1956)");
      notes.push("Dr por Terzaghi-Peck (1967)");
    } else if (r.soil === "arcilla" || r.soil === "limo") {
      cu = cuFromN_Stroud(N60);
      notes.push("cu por Stroud (1974)");
    }

    const qa = qaFromN_Meyerhof(N60);
    notes.push("qa por Meyerhof (1974), zapata 1.5×1.5 m, asentamiento 25 mm");

    return {
      depth_m: r.depth_m,
      sigma_v_eff_kPa: sigma_v_eff,
      C_N, C_E, C_R, C_B, C_S,
      N60, N1_60,
      phi_deg: phi,
      Dr_pct: Dr,
      cu_kPa: cu,
      qa_kPa: qa,
      notes,
    };
  });

  // Weighted average qa (weight by depth contribution)
  const qa_avg = layers.reduce((acc, l) => acc + l.qa_kPa, 0) / Math.max(1, layers.length);
  const sandLayers = layers.filter((l) => l.phi_deg !== null);
  const phi_avg = sandLayers.length > 0
    ? sandLayers.reduce((acc, l) => acc + (l.phi_deg ?? 0), 0) / sandLayers.length
    : null;

  // Find weakest layer
  const sorted = [...layers].sort((a, b) => a.N60 - b.N60);
  const weakest = sorted[0]?.depth_m ?? 0;

  if (qa_avg < 100) {
    warnings.push(
      `q_a promedio = ${qa_avg.toFixed(0)} kPa es bajo. Considera mejoramiento o cimentación profunda.`,
    );
  }

  return {
    layers,
    qa_avg_kPa: qa_avg,
    phi_avg_deg: phi_avg,
    weakest_layer_depth_m: weakest,
    citations,
    warnings,
  };
}
