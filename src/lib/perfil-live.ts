/**
 * Perfil estratigráfico — builder y validador de perfiles de suelo
 * típicos de Costa Rica.
 *
 * Sources:
 * - Código de Cimentaciones de Costa Rica (2009) §3 — investigación.
 * - CFIA — Reglamento de estudios geotécnicos.
 * - IMN — Boletín meteorológico mensual.
 * - LanammeUCR — Informes técnicos de subsuelos urbanos.
 * - MAG/SEPSA — Mapa pedológico nacional 1:200,000.
 * - Wesley (2010). Geotechnical Engineering in Residual Soils.
 */

export interface SoilLayer {
  depth_top_m: number;
  depth_bot_m: number;
  soil_name: string;
  /** Color para representación visual. */
  color: string;
  /** Peso específico γ (kN/m³). */
  gamma_kN_m3: number;
  /** Ángulo de fricción φ (°). 0 si N/A. */
  phi_deg: number;
  /** Cohesión c (kPa). 0 si N/A. */
  c_kPa: number;
  /** Nivel freático contenido en esta capa? */
  water: boolean;
  notes: string;
}

export interface ProfileInput {
  layers: SoilLayer[];
  /** Profundidad del nivel freático estable (m). 99 si no se detectó. */
  water_table_m: number;
}

export interface ProfileLayerResult {
  layer: SoilLayer;
  thickness_m: number;
  /** Esfuerzo total acumulado al techo de la capa (kPa). */
  sigma_v_top_kPa: number;
  /** Esfuerzo total acumulado al fondo de la capa (kPa). */
  sigma_v_bot_kPa: number;
  /** Esfuerzo efectivo al fondo (kPa). */
  sigma_v_eff_bot_kPa: number;
}

export interface ProfileValidation {
  level: "error" | "warning" | "info";
  message: string;
}

export interface ProfileResult {
  layers: ProfileLayerResult[];
  total_depth_m: number;
  gamma_avg_kN_m3: number;
  phi_avg_deg: number;
  c_avg_kPa: number;
  water_table_m: number;
  validations: ProfileValidation[];
  citations: string[];
}

/** Default 3-layer Valle Central profile (Costa Rica residential). */
export const DEFAULT_VALLE_CENTRAL: SoilLayer[] = [
  {
    depth_top_m: 0,
    depth_bot_m: 1.5,
    soil_name: "Arcilla limosa expansiva",
    color: "#a3754d",
    gamma_kN_m3: 16,
    phi_deg: 18,
    c_kPa: 25,
    water: false,
    notes: "Capa orgánica superior. IP > 25 típico. Considerar plateas flotantes.",
  },
  {
    depth_top_m: 1.5,
    depth_bot_m: 5.0,
    soil_name: "Ceniza volcánica densa",
    color: "#7a6354",
    gamma_kN_m3: 17,
    phi_deg: 32,
    c_kPa: 15,
    water: false,
    notes: "Andisol con allophane. Comportamiento drenado típico CR Valle Central.",
  },
  {
    depth_top_m: 5.0,
    depth_bot_m: 10.0,
    soil_name: "Toba alterada (saprolito)",
    color: "#8a7458",
    gamma_kN_m3: 19,
    phi_deg: 35,
    c_kPa: 35,
    water: false,
    notes: "Roca alterada in-situ. Apta para cimentación de edificios medianos.",
  },
];

export function computeProfileLive(input: ProfileInput): ProfileResult {
  const validations: ProfileValidation[] = [];
  const citations = [
    "Código de Cimentaciones de Costa Rica (2009) §3",
    "CFIA — Reglamento de estudios geotécnicos",
    "Wesley (2010) — Geotechnical Engineering in Residual Soils",
    "LanammeUCR — Informes técnicos subsuelos urbanos",
    "MAG/SEPSA — Mapa pedológico nacional",
  ];

  if (input.layers.length === 0) {
    validations.push({ level: "error", message: "Perfil vacío. Agrega al menos una capa." });
  }

  // Sort by depth_top
  const sorted = [...input.layers].sort((a, b) => a.depth_top_m - b.depth_top_m);

  // Validate gaps and overlaps
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const nxt = sorted[i + 1];
    if (cur.depth_bot_m < nxt.depth_top_m) {
      validations.push({
        level: "warning",
        message: `Gap de ${(nxt.depth_top_m - cur.depth_bot_m).toFixed(2)} m entre ${cur.soil_name} y ${nxt.soil_name}.`,
      });
    } else if (cur.depth_bot_m > nxt.depth_top_m) {
      validations.push({
        level: "error",
        message: `Solape de ${(cur.depth_bot_m - nxt.depth_top_m).toFixed(2)} m entre ${cur.soil_name} y ${nxt.soil_name}.`,
      });
    }
  }

  // Validate sanity ranges
  for (const l of sorted) {
    if (l.gamma_kN_m3 < 12 || l.gamma_kN_m3 > 24) {
      validations.push({
        level: "warning",
        message: `γ = ${l.gamma_kN_m3} kN/m³ fuera del rango típico (12-24) en ${l.soil_name}.`,
      });
    }
    if (l.phi_deg < 0 || l.phi_deg > 50) {
      validations.push({
        level: "warning",
        message: `φ = ${l.phi_deg}° fuera del rango físico (0-50°) en ${l.soil_name}.`,
      });
    }
    if (l.c_kPa < 0 || l.c_kPa > 500) {
      validations.push({
        level: "warning",
        message: `c = ${l.c_kPa} kPa fuera del rango típico (0-500) en ${l.soil_name}.`,
      });
    }
    if (l.depth_bot_m <= l.depth_top_m) {
      validations.push({
        level: "error",
        message: `Capa ${l.soil_name} tiene profundidad de fondo ≤ techo.`,
      });
    }
  }

  // Stress profile
  let sigma_v_acc = 0;
  let depth_acc = 0;
  let gamma_weighted = 0;
  let phi_weighted = 0;
  let c_weighted = 0;
  const layerResults: ProfileLayerResult[] = sorted.map((l) => {
    const thick = l.depth_bot_m - l.depth_top_m;
    const sigma_top = sigma_v_acc;
    const sigma_bot = sigma_v_acc + l.gamma_kN_m3 * thick;
    const u_bot = l.depth_bot_m > input.water_table_m
      ? 9.81 * (l.depth_bot_m - input.water_table_m)
      : 0;
    const sigma_eff_bot = sigma_bot - u_bot;
    sigma_v_acc = sigma_bot;
    depth_acc += thick;
    gamma_weighted += l.gamma_kN_m3 * thick;
    phi_weighted += l.phi_deg * thick;
    c_weighted += l.c_kPa * thick;
    return {
      layer: l,
      thickness_m: thick,
      sigma_v_top_kPa: sigma_top,
      sigma_v_bot_kPa: sigma_bot,
      sigma_v_eff_bot_kPa: sigma_eff_bot,
    };
  });

  const total_depth = depth_acc;
  const gamma_avg = depth_acc > 0 ? gamma_weighted / depth_acc : 0;
  const phi_avg = depth_acc > 0 ? phi_weighted / depth_acc : 0;
  const c_avg = depth_acc > 0 ? c_weighted / depth_acc : 0;

  // Detect water from data
  let water_table_inferred = input.water_table_m;
  const waterLayer = sorted.find((l) => l.water);
  if (waterLayer && water_table_inferred > waterLayer.depth_top_m) {
    water_table_inferred = waterLayer.depth_top_m;
    validations.push({
      level: "info",
      message: `Nivel freático inferido a ${water_table_inferred.toFixed(2)} m por capa marcada con agua.`,
    });
  }

  if (input.water_table_m < 99 && input.water_table_m < total_depth) {
    validations.push({
      level: "info",
      message: `Nivel freático a ${input.water_table_m.toFixed(1)} m. Considerar subpresión en cimentaciones bajo NF.`,
    });
  }

  if (total_depth < 6) {
    validations.push({
      level: "warning",
      message: `Profundidad investigada ${total_depth.toFixed(1)} m < 6 m. CFIA recomienda al menos 1.5·B + Df para zapatas.`,
    });
  }

  return {
    layers: layerResults,
    total_depth_m: total_depth,
    gamma_avg_kN_m3: gamma_avg,
    phi_avg_deg: phi_avg,
    c_avg_kPa: c_avg,
    water_table_m: water_table_inferred,
    validations,
    citations,
  };
}
