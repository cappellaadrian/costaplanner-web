/**
 * TypeScript port of design_rectangular_column + build_rectangular_column_steps.
 *
 * Mirrors python_port/column.py exactly so the Studio /rectangular-column
 * page can render a live walkthrough with the same numbers a Python
 * canonical run would produce. Bar sizing logic ported from materials.py.
 *
 * Codes:
 *   CSCR-10 Rev. 2014 §18.7 (column confinement, seismic)
 *   ACI 318-14 §10 (column strength), §18.7 (special seismic columns)
 */

// @lat: [[lat.md\codigo\columnas#Columnas#Diseno axial simplificado]]
// @lat: [[lat.md\codigo\columnas#Columnas#Confinamiento sismico]]

import type { CalculationStep } from "./beam-flexure-live";

// ---------------------------------------------------------------------------
// Bar area helpers (mirror materials.py As_bar / db)
// ---------------------------------------------------------------------------

const BAR_AREAS_CM2: Record<number, number> = {
  3: 0.71, 4: 1.27, 5: 1.99, 6: 2.84, 7: 3.87,
  8: 5.10, 9: 6.45, 10: 8.19, 11: 10.06, 14: 14.52, 18: 25.81,
};

const BAR_DIAMETERS_CM: Record<number, number> = {
  3: 0.953, 4: 1.27, 5: 1.588, 6: 1.905, 7: 2.222,
  8: 2.54, 9: 2.865, 10: 3.226, 11: 3.581, 14: 4.300, 18: 5.733,
};

export function asBar(size: number): number {
  return BAR_AREAS_CM2[size] ?? 0;
}

export function dbBar(size: number): number {
  return BAR_DIAMETERS_CM[size] ?? 0;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RectColumnInput {
  b: number;          // ancho cm
  h: number;          // peralte cm
  L: number;          // altura libre cm
  recubrimiento: number; // cm
  Pu_ton: number;     // carga axial ultima
  Mu_max_tonm: number;
  fc: number;
  fy: number;
  zona: 1 | 2 | 3 | 4;
  nBarsTentative: number;
  sizeBarTentative: number;
}

export interface RectColumnLiveResult {
  // Echoes
  b: number; h: number; L: number; r: number;
  Pu: number; Mu_max: number;
  fc: number; fy: number; zona: number;

  // Steps
  Ag: number;
  eccentricity_ratio: number;
  phi: number;
  Pu_mayorado: number;
  Ast_req: number;
  As_min: number;
  As_max: number;
  As_prov: number;
  n_bars: number;
  size: number;
  rho: number;
  lo_confinamiento: number;
  s_conf: number;
  s_central: number;
  hx: number;
  Ash_req: number;
  kl_r: number;
  kl_r_limit: number;

  // Flags
  warnings: string[];
}

// ---------------------------------------------------------------------------
// computeRectangularColumnLive — mirrors design_rectangular_column
// ---------------------------------------------------------------------------

export function computeRectangularColumnLive(
  input: RectColumnInput,
): RectColumnLiveResult {
  const {
    b, h, L, recubrimiento: r,
    Pu_ton, Mu_max_tonm, fc, fy, zona,
    nBarsTentative, sizeBarTentative,
  } = input;

  const warnings: string[] = [];

  const Ag = b * h;
  const ecc = Pu_ton > 0 ? Mu_max_tonm / ((Pu_ton * h) / 100.0) : 0;
  if (ecc > 0.10) {
    warnings.push(
      `Relacion Mu/(Pu*h) = ${ecc.toFixed(3)} > 0.10. ` +
      "Diseno simplificado no valido, se requiere diagrama de interaccion.",
    );
  }

  // Longitudinal steel (pure axial)
  // ACI 318-14 §22.4.2.1: Pn,max = 0.80·[0.85·f'c·(Ag - Ast) + fy·Ast] (columna con estribos)
  // So Pu ≤ ϕ·0.80·[0.85·f'c·Ag + (fy − 0.85·f'c)·Ast]  ⇒  Pu/(ϕ·0.80) is the demand on the steel-concrete couple.
  const phi = 0.65;
  const alpha_tied = 0.80; // ACI §22.4.2.1 — 0.80 estribos / 0.85 espirales
  const Pu_mayorado = Pu_ton / (phi * alpha_tied);
  const num = Pu_mayorado - (0.85 * fc * Ag) / 1000.0;
  const den = (fy - 0.85 * fc) / 1000.0;
  const Ast_req = den > 0 ? num / den : 0;

  const As_min = 0.01 * Ag;
  const As_max = zona >= 3 ? 0.06 * Ag : 0.08 * Ag;
  const Ast_diseno = Math.max(Ast_req, As_min);

  // Try tentative bar selection
  let size = sizeBarTentative;
  let n_bars = nBarsTentative;
  let As_prov = n_bars * asBar(size);
  while (As_prov < Ast_diseno && n_bars < 24) {
    n_bars += 2;
    As_prov = n_bars * asBar(size);
  }

  const rho = Ag > 0 ? As_prov / Ag : 0;

  // Confinement (approximate; matches Python conservative floor)
  const dim_menor = Math.min(b, h);
  const bar_spacing_lat =
    (dim_menor - 2 * r - dbBar(4)) / (Math.floor(n_bars / 4) + 1);
  const hx = Math.max(bar_spacing_lat, 10.0);

  // Confinement length lo per ACI §18.7.5.1
  const lo = Math.max(h, L / 6.0, 45.0);

  // Mirror column_confinement defaults: Ash_req at s=10 baseline
  // Use a simplified equivalent of column_confinement.s_conf
  const db_long = dbBar(size);
  const s_db = 6 * db_long;
  const s_dim = dim_menor / 4.0;
  const s_hx = 10 + (35 - hx) / 3.0;
  const s_conf_raw = Math.min(s_db, s_dim, Math.max(s_hx, 10.0), 10.0);

  // Ash requirement per ACI 318-14 §18.7.5.4(a):
  //   Ach = area del nucleo confinado medida al perimetro exterior de los
  //         estribos = (b - 2·r) · (h - 2·r)
  // (CR-Cal-Bug 2026-05: anteriormente se usaba 0.70·b·h, lo cual
  //  sub-estimaba Ash en zonas sismicas. Corregido a la definicion
  //  geometrica exacta del nucleo.)
  const bc_x = Math.max(1, b - 2 * r); // ancho del nucleo en x
  const bc_y = Math.max(1, h - 2 * r); // ancho del nucleo en y
  const Ach = bc_x * bc_y;
  const Ash_per_s_per_bc = Math.max(
    0.3 * (Ag / Ach - 1) * (fc / fy),
    0.09 * (fc / fy),
  );
  // bc = dimensión del núcleo perpendicular a la capa de estribo evaluada.
  // Tomamos el menor para verificar la dirección más crítica.
  const bc = Math.min(bc_x, bc_y);
  const Ash_req = Ash_per_s_per_bc * 10.0 * bc; // at s=10
  // Stirrup #4, 2 legs each direction → A_est = 2 * As_bar(4)
  const A_est = 2 * asBar(4);
  const Ash_needed_per_cm = Ash_req / 10.0;
  const s_ash = Ash_needed_per_cm > 0 ? A_est / Ash_needed_per_cm : 15.0;
  const s_conf = Math.max(5.0, Math.min(s_conf_raw, s_ash));

  const s_out = Math.min(6 * db_long, 15.0);

  // Slenderness
  const k = 1.0;
  const r_giro = 0.30 * h;
  const kl_r = (k * L) / r_giro;
  const kl_r_limit = 34 - 12 * 0.5;
  if (kl_r > kl_r_limit) {
    warnings.push(
      "Columna esbelta. Requiere analisis de segundo orden (P-delta).",
    );
  }
  if (zona >= 3) {
    warnings.push("Zona sismica >= 3: acero ASTM A706, ganchos 135°.");
  }

  return {
    b, h, L, r, Pu: Pu_ton, Mu_max: Mu_max_tonm,
    fc, fy, zona,
    Ag, eccentricity_ratio: ecc,
    phi, Pu_mayorado,
    Ast_req, As_min, As_max, As_prov, n_bars, size, rho,
    lo_confinamiento: lo, s_conf, s_central: s_out, hx, Ash_req,
    kl_r, kl_r_limit,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// buildRectangularColumnSteps — mirror of Python build_rectangular_column_steps
// ---------------------------------------------------------------------------

export function buildRectangularColumnSteps(
  r: RectColumnLiveResult,
): CalculationStep[] {
  const max_coef = r.zona >= 3 ? 0.06 : 0.08;
  return [
    {
      id: "rect_col.step_01_Ag",
      name: "Area bruta",
      equation_latex: "A_g = b \\cdot h",
      inputs: { b: r.b, h: r.h },
      output_var: "Ag",
      output_value: r.Ag,
      output_unit: "cm^2",
      code_ref: "ACI 318-14 §22.4",
      depends_on: [],
      note: "",
    },
    {
      id: "rect_col.step_02_ecc",
      name: "Relacion de excentricidad",
      equation_latex: "e/h = \\frac{M_u}{P_u \\cdot h/100}",
      inputs: { Mu: r.Mu_max, Pu: r.Pu, h: r.h },
      output_var: "e_over_h",
      output_value: r.eccentricity_ratio,
      output_unit: "",
      code_ref: "ACI 318-14 §10.5.1",
      depends_on: [],
      note: r.eccentricity_ratio > 0.10
        ? "Si e/h > 0.10 el metodo simplificado no aplica — usar diagrama P-M."
        : "",
    },
    {
      id: "rect_col.step_03_phi",
      name: "Factor de reduccion phi (estribada)",
      equation_latex: "\\phi = 0.65",
      inputs: {},
      output_var: "phi",
      output_value: 0.65,
      output_unit: "",
      code_ref: "ACI 318-14 §21.2.2",
      depends_on: [],
      note: "",
    },
    {
      id: "rect_col.step_04_Ast_req",
      name: "Acero longitudinal requerido (axial)",
      equation_latex: "A_{st,req} = \\frac{P_u/\\phi - 0.85 f'_c A_g}{f_y - 0.85 f'_c}",
      inputs: { Pu: r.Pu, phi: 0.65, fc: r.fc, Ag: r.Ag, fy: r.fy },
      output_var: "Ast_req",
      output_value: r.Ast_req,
      output_unit: "cm^2",
      code_ref: "ACI 318-14 §22.4.2.2",
      depends_on: ["rect_col.step_01_Ag", "rect_col.step_03_phi"],
      note: "Solo compresion axial. Si hay flexion significativa, revisar.",
    },
    {
      id: "rect_col.step_05_As_min",
      name: "Acero minimo",
      equation_latex: "A_{s,min} = 0.01 \\cdot A_g",
      inputs: { Ag: r.Ag },
      output_var: "As_min",
      output_value: r.As_min,
      output_unit: "cm^2",
      code_ref: "ACI 318-14 §10.6.1.1",
      depends_on: ["rect_col.step_01_Ag"],
      note: "",
    },
    {
      id: "rect_col.step_06_As_max",
      name: "Acero maximo",
      equation_latex: `A_{s,max} = ${max_coef.toFixed(2)} \\cdot A_g`,
      inputs: { Ag: r.Ag },
      output_var: "As_max",
      output_value: r.As_max,
      output_unit: "cm^2",
      code_ref: "ACI 318-14 §10.6.1 / §18.7.4.1",
      depends_on: ["rect_col.step_01_Ag"],
      note: r.zona >= 3
        ? "Zona sismica >= 3 limita a 6%."
        : "Zona sismica baja permite hasta 8%.",
    },
    {
      id: "rect_col.step_07_rho",
      name: "Cuantia longitudinal",
      equation_latex: "\\rho = \\frac{A_{s,prov}}{A_g}",
      inputs: { Ag: r.Ag, As_prov: r.As_prov },
      output_var: "rho",
      output_value: r.rho,
      output_unit: "",
      code_ref: "",
      depends_on: ["rect_col.step_01_Ag"],
      note: "",
    },
    {
      id: "rect_col.step_08_lo",
      name: "Longitud de zona confinada",
      equation_latex: "l_o = \\max(h,\\, L/6,\\, 45\\text{ cm})",
      inputs: { h: r.h, L: r.L },
      output_var: "lo",
      output_value: r.lo_confinamiento,
      output_unit: "cm",
      code_ref: "ACI 318-14 §18.7.5.1",
      depends_on: [],
      note: "",
    },
    {
      id: "rect_col.step_09_s_conf",
      name: "Separacion en zona confinada",
      equation_latex: "s_{conf} = \\min(d_b\\cdot 6,\\, b/4,\\, h_x/3,\\, s_{Ash},\\, 10\\text{ cm})",
      inputs: { hx: r.hx },
      output_var: "s_conf",
      output_value: r.s_conf,
      output_unit: "cm",
      code_ref: "ACI 318-14 §18.7.5.3",
      depends_on: [],
      note: "Aros mas cercanos en zona plastica para confinamiento sismico.",
    },
    {
      id: "rect_col.step_10_s_central",
      name: "Separacion en zona central",
      equation_latex: "s_{central} = \\min(d_b \\cdot 6,\\, 15\\text{ cm})",
      inputs: {},
      output_var: "s_central",
      output_value: r.s_central,
      output_unit: "cm",
      code_ref: "ACI 318-14 §10.7.6.5.2",
      depends_on: [],
      note: "",
    },
    {
      id: "rect_col.step_11_kl_r",
      name: "Esbeltez kl/r",
      equation_latex: "\\frac{kl}{r} = \\frac{k \\cdot L}{0.30 \\cdot h}",
      inputs: { L: r.L, h: r.h },
      output_var: "kl_r",
      output_value: r.kl_r,
      output_unit: "",
      code_ref: "ACI 318-14 §6.2.5",
      depends_on: [],
      note: r.kl_r > r.kl_r_limit
        ? "Si kl/r > limite se requiere analisis P-delta."
        : "",
    },
  ];
}

// ---------------------------------------------------------------------------
// Verification list for the right panel
// ---------------------------------------------------------------------------

export interface RectColumnCheck {
  nombre: string;
  requerido: number;
  disponible: number;
  unidad: string;
  cumple: boolean;
  referencia: string;
  critical: boolean;
}

export function buildRectangularColumnChecks(
  r: RectColumnLiveResult,
): RectColumnCheck[] {
  return [
    {
      nombre: "Ast >= As_min",
      requerido: r.As_min,
      disponible: r.As_prov,
      unidad: "cm^2",
      cumple: r.As_prov >= r.As_min,
      referencia: "ACI §10.6.1.1",
      critical: true,
    },
    {
      nombre: "Ast <= As_max",
      requerido: r.As_prov,
      disponible: r.As_max,
      unidad: "cm^2",
      cumple: r.As_prov <= r.As_max,
      referencia: "ACI §10.6.1 / §18.7.4.1",
      critical: true,
    },
    {
      nombre: "Minimo 4 barras",
      requerido: 4,
      disponible: r.n_bars,
      unidad: "barras",
      cumple: r.n_bars >= 4,
      referencia: "ACI §10.7.3",
      critical: true,
    },
    {
      nombre: "Esbeltez kl/r <= 34 - 12(M1/M2)",
      requerido: r.kl_r_limit,
      disponible: r.kl_r,
      unidad: "",
      cumple: r.kl_r <= r.kl_r_limit,
      referencia: "ACI §6.2.5",
      critical: false,
    },
  ];
}
