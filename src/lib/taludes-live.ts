/**
 * Estabilidad de taludes — Método de Bishop simplificado y Fellenius
 * (ordinary method of slices) con búsqueda automática del círculo crítico.
 *
 * Sources:
 * - Bishop, A.W. (1955). "The use of the slip circle in the stability
 *   analysis of slopes." Géotechnique 5(1): 7-17.
 * - Fellenius, W. (1936). "Calculation of stability of earth dams."
 *   Trans. 2nd Congress Large Dams, Washington.
 * - Spencer, E. (1967). "A method of analysis of the stability of
 *   embankments." Géotechnique 17(1): 11-26.
 * - Hynes-Griffin, M.E. & Franklin, A.G. (1984). "Rationalizing the
 *   seismic coefficient method." US Army WES.
 * - Eurocode 8-5 §7 — slope stability seismic.
 * - Duncan & Wright (2005). Soil Strength and Slope Stability.
 * - Código de Cimentaciones de Costa Rica (2009) §7.
 */

export interface SlopeLayer {
  /** Profundidad del techo (m, desde la corona). */
  z_top_m: number;
  /** Peso específico (kN/m³). */
  gamma_kN_m3: number;
  /** Cohesión efectiva c' (kPa). */
  c_kPa: number;
  /** Ángulo de fricción efectivo φ' (°). */
  phi_deg: number;
}

export interface SlopeInput {
  /** Altura del talud H (m). */
  height_m: number;
  /** Ángulo del talud respecto a la horizontal (°). */
  angle_deg: number;
  /** Estratos del talud, ordenados de arriba a abajo. */
  layers: SlopeLayer[];
  /** Profundidad del nivel freático (m desde la corona). 99 si seco. */
  water_table_m: number;
  /** Coeficiente sísmico horizontal pseudo-estático k_h. */
  k_h: number;
  /** Resolución de búsqueda (cantidad de centros por eje). */
  grid_n: number;
  /** Cantidad de dovelas por circulo (default 15). */
  slices_n: number;
}

export interface SlopeSliceResult {
  /** Coordenada x media de la dovela (m). */
  x: number;
  /** Peso W de la dovela (kN/m). */
  W_kN_m: number;
  /** Ángulo α de la base con la horizontal (rad). */
  alpha_rad: number;
  /** Cohesión + φ promedios en la base. */
  c_kPa: number;
  phi_deg: number;
  /** Longitud de la base de la dovela (m). */
  L_base_m: number;
  /** Presión de poros u (kPa). */
  u_kPa: number;
}

export interface CircleResult {
  /** Coordenadas centro (m) — origen en pie del talud. */
  xc_m: number;
  yc_m: number;
  /** Radio (m). */
  R_m: number;
  /** Factor de seguridad Fellenius. */
  FS_fellenius: number;
  /** Factor de seguridad Bishop simplificado. */
  FS_bishop: number;
  /** Dovelas usadas (solo para el círculo crítico). */
  slices?: SlopeSliceResult[];
}

export interface SlopeResult {
  /** Círculo crítico (mínimo FS Bishop). */
  critical: CircleResult;
  /** Todos los círculos evaluados (para visualización). */
  all_circles: CircleResult[];
  /** FS sísmico del círculo crítico (con k_h). */
  FS_sismico_bishop: number;
  citations: string[];
  warnings: string[];
}

// Helper
const deg = (d: number) => (d * Math.PI) / 180;

/** Get layer properties at depth z. */
function layerAt(layers: SlopeLayer[], z: number): SlopeLayer {
  // layers sorted by z_top ascending
  let active = layers[0];
  for (const l of layers) {
    if (l.z_top_m <= z) active = l;
  }
  return active;
}

/** Geometry: slope from pie (origin) up-and-back. y(x) = min(H, x·tan(angle)) and ground level after crown. */
function ground_y(x: number, H: number, angle_rad: number): number {
  if (x <= 0) return 0; // toe and below
  const x_crown = H / Math.tan(angle_rad);
  if (x >= x_crown) return H;
  return x * Math.tan(angle_rad);
}

/** Compute σ'v at depth z below ground surface using layer integration. */
function effective_stress_at(layers: SlopeLayer[], z_below_surface: number, gw_depth: number): { sigma: number; u: number } {
  let sigma = 0;
  let z = 0;
  for (let i = 0; i < layers.length; i++) {
    const top = layers[i].z_top_m;
    const bot = i < layers.length - 1 ? layers[i + 1].z_top_m : z_below_surface + 100;
    const z_in = Math.max(top, z);
    const z_out = Math.min(bot, z_below_surface);
    if (z_out <= z_in) continue;
    sigma += layers[i].gamma_kN_m3 * (z_out - z_in);
    z = z_out;
    if (z >= z_below_surface) break;
  }
  const u = z_below_surface > gw_depth ? 9.81 * (z_below_surface - gw_depth) : 0;
  return { sigma, u };
}

function evaluateCircle(
  xc: number, yc: number, R: number,
  input: SlopeInput,
): CircleResult | null {
  const { height_m: H, angle_deg, layers, water_table_m, slices_n } = input;
  const angle_rad = deg(angle_deg);
  // Intersections of circle with ground surface
  // Ground surface from x=0 to x=x_crown is line y = x·tan(angle); after x=x_crown, y = H.
  // We find where (x-xc)² + (y-yc)² = R² meets ground.
  // For simplicity, sample x along surface from 0 to x_crown+H (extend behind crown),
  // find leftmost and rightmost intersection.
  const x_crown = H / Math.tan(angle_rad);
  const x_max = x_crown + 2 * H;
  // Sample 200 points
  let x_left: number | null = null;
  let x_right: number | null = null;
  const N_sample = 400;
  let prev_diff: number | null = null;
  let prev_x = -0.5;
  for (let i = 0; i <= N_sample; i++) {
    const x = -0.5 + (x_max + 0.5) * (i / N_sample);
    const y = ground_y(x, H, angle_rad);
    const diff = (x - xc) ** 2 + (y - yc) ** 2 - R * R; // <0 inside
    if (prev_diff !== null && Math.sign(diff) !== Math.sign(prev_diff)) {
      // intersection between prev_x and x
      const x_int = (prev_x * Math.abs(diff) + x * Math.abs(prev_diff)) / (Math.abs(diff) + Math.abs(prev_diff));
      if (x_left === null) x_left = x_int;
      else x_right = x_int;
    }
    prev_diff = diff;
    prev_x = x;
  }
  if (x_left === null || x_right === null) return null;
  if (x_right - x_left < 0.5) return null; // arc too small
  // Build slices
  const slice_w = (x_right - x_left) / slices_n;
  const slices: SlopeSliceResult[] = [];
  for (let i = 0; i < slices_n; i++) {
    const x_mid = x_left + slice_w * (i + 0.5);
    // y_top: ground surface
    const y_top = ground_y(x_mid, H, angle_rad);
    // y_bot: lower point of circle at x = x_mid
    const dx = x_mid - xc;
    const under = R * R - dx * dx;
    if (under <= 0) return null;
    const y_bot = yc - Math.sqrt(under);
    const slice_h = y_top - y_bot;
    if (slice_h <= 0.01) continue;
    // mid depth below ground for stress calc
    const z_mid = (y_top + y_bot) / 2;
    const z_from_surface = y_top - z_mid; // half-height of slice from surface, but we want avg depth
    // Average vertical effective stress over the slice
    const z_avg_below_surface = (y_top - y_bot) / 2; // midpoint of slice
    // Layer integration: weighted average gamma over slice height
    // Build weighted gamma
    let W_total = 0;
    let z_cumulative = 0;
    let z_remaining = slice_h;
    let z_from_surf = 0;
    while (z_remaining > 0.001) {
      const layer = layerAt(layers, z_from_surf);
      const next_top = layers.find((l) => l.z_top_m > z_from_surf)?.z_top_m ?? 1e6;
      const dz = Math.min(z_remaining, next_top - z_from_surf);
      W_total += layer.gamma_kN_m3 * dz * slice_w;
      z_remaining -= dz;
      z_from_surf += dz;
      z_cumulative += dz;
    }
    // base properties at base depth
    const base_layer = layerAt(layers, y_top - y_bot);
    // alpha: angle of base with horizontal
    // base normal points from (xc,yc) towards (x_mid, y_bot)
    const alpha_rad = Math.atan2(x_mid - xc, yc - y_bot);
    const L_base = slice_w / Math.cos(alpha_rad);
    // pore pressure at slice base
    const u = (y_top - y_bot) > 0 && (z_avg_below_surface) > water_table_m
      ? 9.81 * (slice_h - water_table_m)
      : 0;
    slices.push({
      x: x_mid,
      W_kN_m: W_total,
      alpha_rad,
      c_kPa: base_layer.c_kPa,
      phi_deg: base_layer.phi_deg,
      L_base_m: L_base,
      u_kPa: u,
    });
  }
  if (slices.length === 0) return null;

  // Fellenius: FS = Σ(c·L + (W·cosα - u·L)·tan φ) / Σ(W·sinα)
  let num_fell = 0;
  let denom = 0;
  for (const s of slices) {
    const phi = deg(s.phi_deg);
    const N = s.W_kN_m * Math.cos(s.alpha_rad) - s.u_kPa * s.L_base_m;
    num_fell += s.c_kPa * s.L_base_m + Math.max(0, N) * Math.tan(phi);
    denom += s.W_kN_m * Math.sin(s.alpha_rad);
  }
  const FS_fell = denom > 0 ? num_fell / denom : 999;

  // Bishop simplified: iterate FS
  // FS = [Σ((c·b + (W - u·b)·tan φ)/m_α)] / Σ(W·sin α)
  // m_α = cos α + (tan φ · sin α)/FS
  let FS_bishop = FS_fell;
  for (let it = 0; it < 50; it++) {
    let num = 0;
    for (const s of slices) {
      const phi = deg(s.phi_deg);
      const m_alpha = Math.cos(s.alpha_rad) + (Math.tan(phi) * Math.sin(s.alpha_rad)) / FS_bishop;
      const b = s.L_base_m * Math.cos(s.alpha_rad);
      num += (s.c_kPa * b + Math.max(0, s.W_kN_m - s.u_kPa * b) * Math.tan(phi)) / m_alpha;
    }
    const FS_new = num / Math.max(0.01, denom);
    if (Math.abs(FS_new - FS_bishop) < 0.001) {
      FS_bishop = FS_new;
      break;
    }
    FS_bishop = FS_new;
  }

  return {
    xc_m: xc,
    yc_m: yc,
    R_m: R,
    FS_fellenius: FS_fell,
    FS_bishop: FS_bishop,
    slices,
  };
}

export function computeSlopeLive(input: SlopeInput): SlopeResult {
  const warnings: string[] = [];
  const citations = [
    "Bishop (1955) Géotechnique 5(1)",
    "Fellenius (1936) — ordinary method of slices",
    "Spencer (1967) Géotechnique 17(1)",
    "Hynes-Griffin & Franklin (1984)",
    "Eurocode 8-5 §7",
    "Duncan & Wright (2005)",
    "Código de Cimentaciones de Costa Rica (2009) §7",
  ];

  const { height_m: H, angle_deg, grid_n } = input;
  const angle_rad = deg(angle_deg);
  const x_crown = H / Math.tan(angle_rad);
  // Grid of centers above the slope: xc from x_crown/2 to x_crown + H, yc from H to 2.5H
  const xc_min = x_crown / 4;
  const xc_max = x_crown + H;
  const yc_min = H + 0.5;
  const yc_max = 2.5 * H;
  const N = Math.max(3, Math.min(10, grid_n));
  // Radius range: from sqrt(yc² + xc²)·0.8 to ·1.4 — must reach the toe
  const all_circles: CircleResult[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const xc = xc_min + (xc_max - xc_min) * (i / (N - 1));
      const yc = yc_min + (yc_max - yc_min) * (j / (N - 1));
      // Try 3 radii per center
      for (let k = 0; k < 3; k++) {
        const R_base = Math.sqrt(xc * xc + yc * yc);
        const R = R_base * (0.9 + 0.15 * k);
        const c = evaluateCircle(xc, yc, R, input);
        if (c && isFinite(c.FS_bishop) && c.FS_bishop > 0 && c.FS_bishop < 50) {
          all_circles.push(c);
        }
      }
    }
  }

  if (all_circles.length === 0) {
    warnings.push("No se encontraron círculos válidos. Ajusta geometría o resolución.");
    return {
      critical: { xc_m: 0, yc_m: 0, R_m: 0, FS_fellenius: 0, FS_bishop: 0 },
      all_circles: [],
      FS_sismico_bishop: 0,
      citations,
      warnings,
    };
  }

  all_circles.sort((a, b) => a.FS_bishop - b.FS_bishop);
  const critical = all_circles[0];

  // Pseudo-static FS: multiply driving by (1 + k_h·tan α effect simplified)
  // Practical approximation: FS_dyn ≈ FS_static · cos δ / (cos δ + k_h·sin δ) with δ ≈ slope angle.
  const FS_sismico = critical.FS_bishop * (1 / (1 + input.k_h * Math.tan(angle_rad) * 2));

  if (critical.FS_bishop < 1.5) {
    warnings.push(
      `FS Bishop = ${critical.FS_bishop.toFixed(2)} < 1.5 (mínimo estático recomendado).`,
    );
  }
  if (FS_sismico < 1.1) {
    warnings.push(
      `FS sísmico = ${FS_sismico.toFixed(2)} < 1.1 (Eurocode 8-5 mínimo pseudo-estático).`,
    );
  }

  return {
    critical,
    all_circles: all_circles.slice(0, 20), // top 20 for visualization
    FS_sismico_bishop: FS_sismico,
    citations,
    warnings,
  };
}
