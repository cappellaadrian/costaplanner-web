/**
 * Flexión Biaxial — Columna sometida a Pu + Mux + Muy.
 *
 * Two methods reported side-by-side:
 *   (a) Bresler reciprocal load method (1960): 1/Pn = 1/Pnx + 1/Pny - 1/Pno
 *   (b) Bresler load contour method: (Mux/Mnx0)^α + (Muy/Mny0)^α ≤ 1
 *
 * References:
 *   - ACI 318-14 §22.4 (Axial strength) and §10.5 (column design)
 *   - ACI 318-14 §10.3.6.2 (biaxial bending — Bresler permitted)
 *   - Bresler, B. (1960), "Design Criteria for Reinforced Concrete Columns
 *     under Axial Load and Biaxial Bending", ACI Journal V.57, pp. 481-490.
 *   - PCA Notes on ACI 318 §12.7 — Bresler load contour α from As/Ag ratio.
 *   - Park, R. and Paulay, T. (1975), Reinforced Concrete Structures, §5.4.
 *   - MacGregor, J.G. (2009), Reinforced Concrete Mechanics and Design, §11.6.
 *
 * Uniaxial capacities at axial load Pu computed by an approximate equivalent
 * rectangular stress block — adequate for tile sizing; for final design the
 * engineer should compare against an exact P-M interaction diagram.
 *
 * Units: cm, kg, kg/cm², ton, ton-m, ton·m.
 */
import type { CalculationStep } from "./beam-flexure-live";
import { beta1 } from "./materials";
import type { StudioCheck } from "@/components/studio/StudioShell";

export type ColumnShape = "rect" | "circ";
export type BarDistribution = "perimetro" | "esquinas" | "distribuida";

export interface FlexionBiaxialInput {
  shape: ColumnShape;
  b_cm: number;          // ancho (sección rectangular) — solo si shape="rect"
  h_cm: number;          // peralte (sección rectangular) — solo si shape="rect"
  D_cm: number;          // diámetro (sección circular) — solo si shape="circ"
  r_cm: number;          // recubrimiento al estribo
  nBars: number;         // número total de barras
  barSize: number;       // tamaño de barra (#)
  dist: BarDistribution; // distribución
  fc: number;            // kg/cm²
  fy: number;            // kg/cm²
  Pu_ton: number;        // carga axial última
  Mux_tonm: number;      // momento alrededor del eje x (= flexión de h)
  Muy_tonm: number;      // momento alrededor del eje y (= flexión de b)
}

export interface FlexionBiaxialResult {
  // echo
  shape: ColumnShape; b: number; h: number; D: number; r: number;
  nBars: number; barSize: number; dist: BarDistribution;
  fc: number; fy: number; Pu: number; Mux: number; Muy: number;

  // Geometry
  Ag_cm2: number;        // área bruta
  Ast_cm2: number;       // área total de acero
  rho_g: number;         // As/Ag
  dx_cm: number;         // peralte efectivo dirección x
  dy_cm: number;         // peralte efectivo dirección y

  // Capacidad axial concéntrica
  Pn0_ton: number;       // Pn,máx = 0.80·[0.85·fc·(Ag-Ast) + fy·Ast]
  phiPn0_ton: number;    // φPn0 con φ = 0.65

  // Capacidades uniaxiales a Pu
  phiMnx0_tonm: number;  // capacidad uniaxial alrededor de x (carga Pu)
  phiMny0_tonm: number;  // capacidad uniaxial alrededor de y (carga Pu)

  // Excentricidades
  ex_cm: number;         // Mux/Pu
  ey_cm: number;         // Muy/Pu

  // Método (a) — Bresler recíproco
  phiPnx_ton: number;    // Pn cuando solo actúa Mux
  phiPny_ton: number;    // Pn cuando solo actúa Muy
  phiPn_recip_ton: number;
  bresler_recip_ok: boolean;

  // Método (b) — Bresler load contour
  alpha: number;         // exponente de la ecuación
  beta_ratio: number;    // β = Mb/M0 ≈ función de ρg
  contour_value: number; // (Mux/Mnx0)^α + (Muy/Mny0)^α
  bresler_contour_ok: boolean;

  warnings: string[];
}

const PHI_C = 0.65;
const PHI_AXIAL_MAX = 0.80;

// helper: bar area cm²
function asBar(size: number): number {
  const tbl: Record<number, number> = {
    3: 0.71, 4: 1.27, 5: 1.99, 6: 2.84, 7: 3.87,
    8: 5.10, 9: 6.45, 10: 8.19, 11: 10.06,
  };
  return tbl[size] ?? 0;
}

/**
 * Capacidad uniaxial aproximada de columna rectangular a una carga Pu dada.
 * Usa el bloque de Whitney y asume acero distribuido uniformemente en las
 * caras opuestas. Para Pu = 0 → flexión pura. Para Pu ≥ Pbal → falla por
 * compresión (aproximación lineal con Pn0). Suficiente como predimensiona-
 * miento; el diseño final se confirma con diagrama de interacción exacto.
 */
function uniaxialPhiMn(
  b: number, h: number, Ast: number, fc: number, fy: number,
  d: number, Pu_ton: number,
): number {
  if (b <= 0 || h <= 0) return 0;
  const Ag = b * h;
  const b1 = beta1(fc);
  // Approximate: asumimos la mitad del acero en cada cara
  const As_t = Ast / 2; // acero traccionado
  const As_c = Ast / 2; // acero comprimido
  const d_p = h - d;    // recubrimiento a barras comprimidas

  // Pn,bal aproximado (eq. de Park & Paulay): c_bal = 6120·d/(6120+fy)
  const c_bal = (6120.0 * d) / (6120.0 + fy);
  const a_bal = b1 * c_bal;
  const Cc_bal = 0.85 * fc * a_bal * b;
  const Cs_bal = As_c * fy;        // asume cede
  const Ts_bal = As_t * fy;
  const Pn_bal = (Cc_bal + Cs_bal - Ts_bal) / 1000.0; // ton
  const M_bal_kgcm = Cc_bal * (h / 2 - a_bal / 2) + Cs_bal * (h / 2 - d_p) + Ts_bal * (d - h / 2);
  const phiMn_bal = (PHI_C * M_bal_kgcm) / 100_000.0; // ton·m

  // Pn,0 (axial puro)
  const Pn0 = 0.85 * fc * (Ag - Ast) + Ast * fy;
  const Pn0_ton = (PHI_AXIAL_MAX * Pn0) / 1000.0;
  const phiPn0 = PHI_C * Pn0_ton;

  // Capacidad a flexión pura aproximada (Pu = 0): asumir bloque con As_t
  const a_flex = (As_t * fy) / (0.85 * fc * b);
  const phiMn_flex = (0.9 * As_t * fy * (d - a_flex / 2)) / 100_000.0; // ton·m (φ=0.9)

  // Interpolación lineal entre (Pu=0, phiMn_flex) y (Pu=phiPn_bal, phiMn_bal)
  // y entre (Pu=phiPn_bal, phiMn_bal) y (Pu=phiPn0, 0).
  const phiPn_bal = PHI_C * Pn_bal;
  if (Pu_ton <= 0) return phiMn_flex;
  if (Pu_ton >= phiPn0) return 0;
  if (Pu_ton <= phiPn_bal) {
    // tensión controla → φ varía pero usamos φ=0.65 (conservador)
    const t = phiPn_bal > 0 ? Pu_ton / phiPn_bal : 0;
    return phiMn_flex + t * (phiMn_bal - phiMn_flex);
  } else {
    const t = (Pu_ton - phiPn_bal) / Math.max(0.001, phiPn0 - phiPn_bal);
    return phiMn_bal * (1 - t);
  }
}

/** Capacidad axial cuando actúa solo Mux (= con excentricidad ex = Mux/Pu). */
function phiPnUniaxial(
  b: number, h: number, Ast: number, fc: number, fy: number,
  d: number, M_tonm: number,
): number {
  // Para M = 0 → Pn = Pn,0. Para M = phiMnx0(Pu=0) → Pn ≈ 0.
  // Aproximación lineal en interacción simplificada.
  const Ag = b * h;
  const Pn0 = 0.85 * fc * (Ag - Ast) + Ast * fy;
  const phiPn0 = PHI_C * PHI_AXIAL_MAX * Pn0 / 1000.0;
  const phiMn0 = uniaxialPhiMn(b, h, Ast, fc, fy, d, 0);
  if (M_tonm <= 0) return phiPn0;
  if (M_tonm >= phiMn0) return 0;
  return phiPn0 * (1 - M_tonm / phiMn0);
}

export function computeFlexionBiaxialLive(
  input: FlexionBiaxialInput,
): FlexionBiaxialResult {
  const {
    shape, b_cm: b, h_cm: h, D_cm: D, r_cm: r,
    nBars, barSize, dist, fc, fy,
    Pu_ton: Pu, Mux_tonm: Mux, Muy_tonm: Muy,
  } = input;
  const warnings: string[] = [];

  // Geometría
  let Ag = 0, dx = 0, dy = 0;
  if (shape === "rect") {
    Ag = b * h;
    dx = h - r - 1.5; // 1.5 cm aprox = estribo + medio diámetro
    dy = b - r - 1.5;
  } else {
    Ag = (Math.PI * D * D) / 4;
    // Para circular usamos sección rectangular equivalente con d ≈ 0.8·D
    dx = 0.8 * D;
    dy = 0.8 * D;
  }
  const Ast = nBars * asBar(barSize);
  const rho_g = Ag > 0 ? Ast / Ag : 0;

  if (rho_g < 0.01) warnings.push("ρg < 1% — debajo del mínimo ACI 318-14 §10.6.");
  if (rho_g > 0.08) warnings.push("ρg > 8% — excede máximo ACI 318-14 §10.6.");

  // Pn0 axial concentrico
  const Pn0_raw = 0.85 * fc * (Ag - Ast) + Ast * fy; // kg
  const Pn0_ton = (PHI_AXIAL_MAX * Pn0_raw) / 1000.0;
  const phiPn0_ton = PHI_C * Pn0_ton;

  // Para sección circular usamos b = h = D (aproximación equivalente)
  const bx = shape === "rect" ? b : D;
  const by = shape === "rect" ? h : D;

  // Capacidad uniaxial a Pu — momento alrededor de x (peralte = h o D)
  const phiMnx0 = uniaxialPhiMn(bx, by, Ast, fc, fy, dx, Pu);
  // alrededor de y (peralte = b o D)
  const phiMny0 = uniaxialPhiMn(by, bx, Ast, fc, fy, dy, Pu);

  // Excentricidades
  const ex = Pu > 0 ? (Mux * 100) / Pu : 0; // cm
  const ey = Pu > 0 ? (Muy * 100) / Pu : 0; // cm

  // (a) Bresler recíproco — necesitamos Pnx, Pny en condición uniaxial con
  // las excentricidades reales
  const phiPnx = phiPnUniaxial(bx, by, Ast, fc, fy, dx, Mux);
  const phiPny = phiPnUniaxial(by, bx, Ast, fc, fy, dy, Muy);
  // 1/Pn = 1/Pnx + 1/Pny - 1/Pn0
  const inv = (phiPnx > 0 ? 1 / phiPnx : 0)
            + (phiPny > 0 ? 1 / phiPny : 0)
            - (phiPn0_ton > 0 ? 1 / phiPn0_ton : 0);
  const phiPn_recip = inv > 0 ? 1 / inv : 0;
  const bresler_recip_ok = phiPn_recip >= Pu;

  // (b) Bresler load contour — α depende de ρg vía β
  // PCA Notes: β ≈ 0.65 cuando ρg = 1%, β ≈ 0.85 cuando ρg ≥ 4%
  // α = log(0.5)/log(β)  → α va de 1.15 a 1.55
  let beta_ratio = 0.65 + 5 * (rho_g - 0.01); // lineal
  beta_ratio = Math.max(0.55, Math.min(0.85, beta_ratio));
  const alpha = Math.log(0.5) / Math.log(beta_ratio);
  const tx = phiMnx0 > 0 ? Mux / phiMnx0 : 0;
  const ty = phiMny0 > 0 ? Muy / phiMny0 : 0;
  const contour = Math.pow(tx, alpha) + Math.pow(ty, alpha);
  const bresler_contour_ok = contour <= 1.0;

  if (!bresler_recip_ok)
    warnings.push("Bresler recíproco: φPn < Pu. Aumentar sección o acero.");
  if (!bresler_contour_ok)
    warnings.push("Bresler contour: (Mux/φMnx0)^α + (Muy/φMny0)^α > 1. Aumentar sección o acero.");
  warnings.push("Capacidades uniaxiales son aproximadas (bloque equivalente). Verificar con diagrama P-M exacto antes de emisión final.");

  return {
    shape, b, h, D, r, nBars, barSize, dist, fc, fy, Pu, Mux, Muy,
    Ag_cm2: Ag, Ast_cm2: Ast, rho_g, dx_cm: dx, dy_cm: dy,
    Pn0_ton, phiPn0_ton,
    phiMnx0_tonm: phiMnx0, phiMny0_tonm: phiMny0,
    ex_cm: ex, ey_cm: ey,
    phiPnx_ton: phiPnx, phiPny_ton: phiPny,
    phiPn_recip_ton: phiPn_recip, bresler_recip_ok,
    alpha, beta_ratio, contour_value: contour, bresler_contour_ok,
    warnings,
  };
}

export function buildFlexionBiaxialSteps(r: FlexionBiaxialResult): CalculationStep[] {
  return [
    {
      id: "biaxial.step_01_geom",
      name: "Geometría y acero total",
      equation_latex: r.shape === "rect"
        ? "A_g = b \\cdot h, \\;\\; A_{st} = n \\cdot a_b"
        : "A_g = \\pi D^2 / 4, \\;\\; A_{st} = n \\cdot a_b",
      inputs: r.shape === "rect"
        ? { b: r.b, h: r.h, n: r.nBars, barSize: r.barSize }
        : { D: r.D, n: r.nBars, barSize: r.barSize },
      output_var: "Ag",
      output_value: r.Ag_cm2,
      output_unit: "cm²",
      code_ref: "ACI 318-14 §22.4",
      depends_on: [],
      note: `Ast = ${r.Ast_cm2.toFixed(2)} cm², ρg = ${(r.rho_g * 100).toFixed(2)}%`,
    },
    {
      id: "biaxial.step_02_Pn0",
      name: "Capacidad axial concéntrica φPn0",
      equation_latex: "\\phi P_{n,0} = \\phi \\cdot 0.80 \\cdot [0.85 f'_c (A_g - A_{st}) + f_y A_{st}]",
      inputs: { Ag: r.Ag_cm2, Ast: r.Ast_cm2, fc: r.fc, fy: r.fy },
      output_var: "phiPn0",
      output_value: r.phiPn0_ton,
      output_unit: "ton",
      code_ref: "ACI 318-14 §22.4.2.2",
      depends_on: ["biaxial.step_01_geom"],
      note: `φ = 0.65 (tied) · factor 0.80 por excentricidad mínima.`,
    },
    {
      id: "biaxial.step_03_ex_ey",
      name: "Excentricidades de la carga",
      equation_latex: "e_x = M_{ux}/P_u, \\;\\; e_y = M_{uy}/P_u",
      inputs: { Mux: r.Mux, Muy: r.Muy, Pu: r.Pu },
      output_var: "ex",
      output_value: r.ex_cm,
      output_unit: "cm",
      code_ref: "Mecánica de columnas",
      depends_on: [],
      note: `ex = ${r.ex_cm.toFixed(2)} cm, ey = ${r.ey_cm.toFixed(2)} cm`,
    },
    {
      id: "biaxial.step_04_phiMnx0",
      name: "Capacidad uniaxial φMnx0 (eje x, a carga Pu)",
      equation_latex: "\\phi M_{nx,0} = f(P_u, A_{st}, f'_c, f_y, h, b)",
      inputs: { Pu: r.Pu, fc: r.fc, fy: r.fy, h: r.shape === "rect" ? r.h : r.D },
      output_var: "phiMnx0",
      output_value: r.phiMnx0_tonm,
      output_unit: "ton·m",
      code_ref: "ACI 318-14 §22.2 (Whitney block)",
      depends_on: ["biaxial.step_02_Pn0"],
      note: "Aproximación interpolando interacción P-M en puntos (Pu=0, Pbal, Pn0).",
    },
    {
      id: "biaxial.step_05_phiMny0",
      name: "Capacidad uniaxial φMny0 (eje y, a carga Pu)",
      equation_latex: "\\phi M_{ny,0} = f(P_u, A_{st}, f'_c, f_y, b, h)",
      inputs: { Pu: r.Pu, fc: r.fc, fy: r.fy, b: r.shape === "rect" ? r.b : r.D },
      output_var: "phiMny0",
      output_value: r.phiMny0_tonm,
      output_unit: "ton·m",
      code_ref: "ACI 318-14 §22.2",
      depends_on: ["biaxial.step_02_Pn0"],
      note: "",
    },
    {
      id: "biaxial.step_06_recip",
      name: "Método (a) — Bresler recíproco",
      equation_latex: "\\frac{1}{\\phi P_n} = \\frac{1}{\\phi P_{nx}} + \\frac{1}{\\phi P_{ny}} - \\frac{1}{\\phi P_{n,0}}",
      inputs: { phiPnx: r.phiPnx_ton, phiPny: r.phiPny_ton, phiPn0: r.phiPn0_ton },
      output_var: "phiPn_recip",
      output_value: r.phiPn_recip_ton,
      output_unit: "ton",
      code_ref: "Bresler (1960)",
      depends_on: ["biaxial.step_02_Pn0"],
      note: r.bresler_recip_ok
        ? `OK — φPn = ${r.phiPn_recip_ton.toFixed(1)} ≥ Pu = ${r.Pu.toFixed(1)} ton`
        : `FALLA — φPn = ${r.phiPn_recip_ton.toFixed(1)} < Pu = ${r.Pu.toFixed(1)} ton`,
    },
    {
      id: "biaxial.step_07_contour",
      name: "Método (b) — Bresler load contour",
      equation_latex:
        "\\left(\\frac{M_{ux}}{\\phi M_{nx,0}}\\right)^{\\alpha} + \\left(\\frac{M_{uy}}{\\phi M_{ny,0}}\\right)^{\\alpha} \\le 1",
      inputs: { Mux: r.Mux, Muy: r.Muy, phiMnx0: r.phiMnx0_tonm, phiMny0: r.phiMny0_tonm, alpha: r.alpha },
      output_var: "contour",
      output_value: r.contour_value,
      output_unit: "",
      code_ref: "PCA Notes §12.7 · Bresler (1960)",
      depends_on: ["biaxial.step_04_phiMnx0", "biaxial.step_05_phiMny0"],
      note: `α = ${r.alpha.toFixed(3)} (β = ${r.beta_ratio.toFixed(3)}). ${r.bresler_contour_ok ? "OK ≤ 1" : "FALLA > 1"}`,
    },
  ];
}

export function buildFlexionBiaxialChecks(r: FlexionBiaxialResult): StudioCheck[] {
  return [
    {
      nombre: "Cuantía ρg dentro de 1%–8%",
      requerido: 1,
      disponible: (r.rho_g >= 0.01 && r.rho_g <= 0.08) ? 1 : 0,
      unidad: "",
      cumple: r.rho_g >= 0.01 && r.rho_g <= 0.08,
      referencia: "ACI 318-14 §10.6.1",
      critical: true,
    },
    {
      nombre: "Bresler recíproco: φPn ≥ Pu",
      requerido: r.Pu,
      disponible: r.phiPn_recip_ton,
      unidad: "ton",
      cumple: r.bresler_recip_ok,
      referencia: "Bresler (1960) · ACI 318-14 §22.4",
      critical: true,
    },
    {
      nombre: "Bresler contour: (Mux/φMnx)^α + (Muy/φMny)^α ≤ 1",
      requerido: 1,
      disponible: r.contour_value,
      unidad: "",
      cumple: r.bresler_contour_ok,
      referencia: "PCA Notes §12.7",
      critical: true,
    },
    {
      nombre: "Pu ≤ φPn0",
      requerido: r.Pu,
      disponible: r.phiPn0_ton,
      unidad: "ton",
      cumple: r.Pu <= r.phiPn0_ton,
      referencia: "ACI 318-14 §22.4.2",
      critical: true,
    },
  ];
}
