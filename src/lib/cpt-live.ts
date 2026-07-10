/**
 * CPT (Cone Penetration Test) interpretation — Robertson normalized
 * soil behaviour type (SBT) classification + parameter derivation for
 * Costa Rica geotechnical practice.
 *
 * Every formula is cited inline.
 *
 * Source documents:
 * - Robertson, P.K. (1990). "Soil classification using the cone
 *   penetration test." Canadian Geotechnical Journal 27(1): 151-158.
 * - Robertson, P.K. (2009). "Interpretation of cone penetration tests —
 *   a unified approach." Canadian Geotechnical Journal 46(11): 1337-1355.
 * - Lunne, T., Robertson, P.K. & Powell, J.J.M. (1997). "Cone
 *   Penetration Testing in Geotechnical Practice." Blackie Academic.
 * - ASTM D5778-12 — Standard Test Method for CPT.
 * - Kulhawy, F.H. & Mayne, P.W. (1990). "Manual on Estimating Soil
 *   Properties for Foundation Design." EPRI EL-6800.
 * - Mayne, P.W. (2007). "Cone Penetration Testing — NCHRP Synthesis 368."
 * - Código de Cimentaciones de Costa Rica (2009) §3.
 */

export interface CPTReading {
  /** Profundidad (m) */
  depth_m: number;
  /** Resistencia de punta qc (MPa) */
  qc_MPa: number;
  /** Fricción lateral fs (kPa) */
  fs_kPa: number;
  /** Presión de poros u2 detrás del cono (kPa). 0 si no se midió. */
  u2_kPa: number;
}

export interface CPTInput {
  readings: CPTReading[];
  /** Nivel freático estable (m). 99 si no hay. */
  water_table_m: number;
  /** Peso específico promedio del suelo (kN/m³). */
  gamma_kN_m3: number;
  /** Factor de cono Nk para arcillas (típico 12-18, default 15). */
  Nk: number;
}

export interface CPTLayerResult {
  depth_m: number;
  qc_MPa: number;
  fs_kPa: number;
  /** Esfuerzo vertical total σv (kPa) */
  sigma_v_kPa: number;
  /** Esfuerzo vertical efectivo σ'v (kPa) */
  sigma_v_eff_kPa: number;
  /** Friction ratio Rf = fs/qc · 100 (%) */
  Rf_pct: number;
  /** Normalized cone resistance Qtn (Robertson 2009) */
  Qtn: number;
  /** Normalized friction ratio Fr (%) */
  Fr_pct: number;
  /** SBT index Ic (Robertson 2009) */
  Ic: number;
  /** Zona SBT (1-9 simplificada) */
  SBT_zone: number;
  /** Nombre de la clasificación */
  SBT_name: string;
  /** Tipo agregado (granular/cohesivo) */
  soil_type: "granular" | "cohesivo" | "mixto";
  /** φ para granular (°) — Kulhawy & Mayne (1990) */
  phi_deg: number | null;
  /** Dr para arenas (%) — Kulhawy & Mayne (1990) */
  Dr_pct: number | null;
  /** su para cohesivo (kPa) — su = (qc - σv)/Nk */
  su_kPa: number | null;
  notes: string[];
}

export interface CPTLiveResult {
  layers: CPTLayerResult[];
  phi_avg_deg: number | null;
  su_avg_kPa: number | null;
  predominant_SBT: string;
  citations: string[];
  warnings: string[];
}

const PA = 101.325; // atmospheric pressure (kPa)

// Robertson (2009) SBT zone names (simplified 9-zone chart)
const SBT_NAMES: Record<number, string> = {
  1: "Suelo fino sensitivo",
  2: "Suelo orgánico, turba",
  3: "Arcilla a arcilla limosa",
  4: "Limo arcilloso a limo arenoso",
  5: "Arena limosa a arena",
  6: "Arena limpia a arena limosa",
  7: "Arena densa a grava arenosa",
  8: "Arena dura, OC o cementada",
  9: "Suelo fino muy duro, OC",
};

/** Robertson (2009): Ic = sqrt((3.47 - log10(Qtn))^2 + (log10(Fr) + 1.22)^2) */
function computeIc(Qtn: number, Fr: number): number {
  if (Qtn <= 0 || Fr <= 0) return 99;
  const a = 3.47 - Math.log10(Qtn);
  const b = Math.log10(Fr) + 1.22;
  return Math.sqrt(a * a + b * b);
}

/** Robertson (2009) Ic → SBT zone mapping. */
function IcToZone(Ic: number, Qtn: number, Fr: number): number {
  if (Ic > 3.6) return 2; // organic
  if (Ic > 2.95) return 3; // clay
  if (Ic > 2.60) return 4; // silty mix
  if (Ic > 2.05) return 5; // silty sand
  if (Ic > 1.31) return 6; // clean sand
  if (Ic <= 1.31 && Qtn > 50) return 8; // very dense/OC
  if (Qtn > 100) return 7;
  return 6;
}

/** Kulhawy & Mayne (1990): φ' = 17.6 + 11·log10(qt1) where qt1 = (qt/Pa)/sqrt(σ'v/Pa). */
function phiFromQt_KulhawyMayne(qt_kPa: number, sigma_v_eff_kPa: number): number {
  const qt_norm = (qt_kPa / PA) / Math.sqrt(Math.max(0.1, sigma_v_eff_kPa) / PA);
  if (qt_norm <= 1) return 28;
  const phi = 17.6 + 11 * Math.log10(qt_norm);
  return Math.max(28, Math.min(45, phi));
}

/** Kulhawy & Mayne (1990): Dr% = sqrt(qt1 / (305·Qc·Qocr·QA)) — simplified Qc=Qocr=QA=1 for NC clean sand. */
function DrFromQt_KulhawyMayne(qt_kPa: number, sigma_v_eff_kPa: number): number {
  const qt_norm = (qt_kPa / PA) / Math.sqrt(Math.max(0.1, sigma_v_eff_kPa) / PA);
  if (qt_norm <= 0) return 0;
  const Dr = Math.sqrt(qt_norm / 305) * 100;
  return Math.max(0, Math.min(100, Dr));
}

export function computeCPTLive(input: CPTInput): CPTLiveResult {
  const warnings: string[] = [];
  const citations = [
    "Robertson (1990) Can. Geotech. J. 27(1)",
    "Robertson (2009) Can. Geotech. J. 46(11)",
    "Lunne, Robertson & Powell (1997)",
    "ASTM D5778-12",
    "Kulhawy & Mayne (1990) EPRI EL-6800",
    "Mayne (2007) NCHRP Synthesis 368",
    "Código de Cimentaciones de Costa Rica (2009) §3",
  ];

  if (input.Nk < 10 || input.Nk > 20) {
    warnings.push(`Nk = ${input.Nk} fuera del rango típico 10-20 (Lunne et al. 1997).`);
  }

  const layers: CPTLayerResult[] = input.readings.map((r) => {
    const qc_kPa = r.qc_MPa * 1000;
    const sigma_v = input.gamma_kN_m3 * r.depth_m;
    const u0 = r.depth_m > input.water_table_m
      ? 9.81 * (r.depth_m - input.water_table_m)
      : 0;
    const sigma_v_eff = Math.max(1, sigma_v - u0);
    // Robertson 2009: qt = qc + u2·(1-a). a=0.8 typical, but we ignore correction if u2=0.
    const qt_kPa = qc_kPa + r.u2_kPa * 0.2;
    const Rf_pct = qc_kPa > 0 ? (r.fs_kPa / qc_kPa) * 100 : 0;
    // Qtn with n = 0.5 default (granular) — Robertson 2009 iterative; we use n=0.5 for simplicity.
    const Qtn = ((qt_kPa - sigma_v) / PA) * Math.pow(PA / sigma_v_eff, 0.5);
    const Fr_pct = (qt_kPa - sigma_v) > 0
      ? (r.fs_kPa / (qt_kPa - sigma_v)) * 100
      : 0.1;
    const Ic = computeIc(Math.max(0.01, Qtn), Math.max(0.01, Fr_pct));
    const zone = IcToZone(Ic, Qtn, Fr_pct);
    const SBT_name = SBT_NAMES[zone] ?? "Indefinido";

    let soil_type: "granular" | "cohesivo" | "mixto" = "mixto";
    if (Ic < 2.6) soil_type = "granular";
    else if (Ic > 2.95) soil_type = "cohesivo";

    let phi: number | null = null;
    let Dr: number | null = null;
    let su: number | null = null;
    const notes: string[] = [];

    if (soil_type === "granular") {
      phi = phiFromQt_KulhawyMayne(qt_kPa, sigma_v_eff);
      Dr = DrFromQt_KulhawyMayne(qt_kPa, sigma_v_eff);
      notes.push("φ por Kulhawy & Mayne (1990)");
      notes.push("Dr por Kulhawy & Mayne (1990)");
    } else if (soil_type === "cohesivo") {
      su = Math.max(0, (qt_kPa - sigma_v) / input.Nk);
      notes.push(`su = (qt - σv)/Nk con Nk=${input.Nk} (Lunne 1997)`);
    } else {
      phi = phiFromQt_KulhawyMayne(qt_kPa, sigma_v_eff);
      su = Math.max(0, (qt_kPa - sigma_v) / input.Nk);
      notes.push("Capa mixta — se reportan φ y su orientativos");
    }

    return {
      depth_m: r.depth_m,
      qc_MPa: r.qc_MPa,
      fs_kPa: r.fs_kPa,
      sigma_v_kPa: sigma_v,
      sigma_v_eff_kPa: sigma_v_eff,
      Rf_pct,
      Qtn,
      Fr_pct,
      Ic,
      SBT_zone: zone,
      SBT_name,
      soil_type,
      phi_deg: phi,
      Dr_pct: Dr,
      su_kPa: su,
      notes,
    };
  });

  const granularLayers = layers.filter((l) => l.phi_deg !== null);
  const cohesiveLayers = layers.filter((l) => l.su_kPa !== null);
  const phi_avg = granularLayers.length > 0
    ? granularLayers.reduce((a, l) => a + (l.phi_deg ?? 0), 0) / granularLayers.length
    : null;
  const su_avg = cohesiveLayers.length > 0
    ? cohesiveLayers.reduce((a, l) => a + (l.su_kPa ?? 0), 0) / cohesiveLayers.length
    : null;

  // Predominant SBT
  const zoneCount: Record<number, number> = {};
  for (const l of layers) zoneCount[l.SBT_zone] = (zoneCount[l.SBT_zone] ?? 0) + 1;
  let maxZone = 0, maxCount = 0;
  for (const z in zoneCount) {
    if (zoneCount[z] > maxCount) { maxCount = zoneCount[z]; maxZone = parseInt(z); }
  }
  const predominant_SBT = SBT_NAMES[maxZone] ?? "Indefinido";

  if (layers.some((l) => l.Ic > 3.6)) {
    warnings.push("Detectada capa orgánica (Ic > 3.6). Verificar con muestreo directo.");
  }
  if (layers.some((l) => l.qc_MPa < 0.5)) {
    warnings.push("qc < 0.5 MPa: suelo muy blando. Considerar cimentación profunda.");
  }

  return {
    layers,
    phi_avg_deg: phi_avg,
    su_avg_kPa: su_avg,
    predominant_SBT,
    citations,
    warnings,
  };
}
