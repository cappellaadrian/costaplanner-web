/**
 * Control de fisuración — Separación máxima de barras a tracción.
 *
 * References:
 *   - ACI 318-14 §24.3 — Distribution of flexural reinforcement
 *   - ACI 318-14 §24.3.2 — Maximum bar spacing in tension zone
 *   - Frosch, R.J. (1999), "Another Look at Cracking and Crack Control in
 *     Reinforced Concrete", ACI Structural Journal V.96, No.3.
 *   - Gergely, P. and Lutz, L.A. (1968), "Maximum Crack Width in Reinforced
 *     Concrete Flexural Members", ACI Special Publication SP-20.
 *   - ACI 224R-01 — Control of Cracking in Concrete Structures.
 *
 * ACI 318-14 §24.3.2:
 *   s = 38·(28/fs) − 2.5·cc       (SI: cm; fs en kg/cm² convertido a MPa)
 *   pero no mayor que 30·(28/fs)
 *
 * Note: ACI uses SI formula s_max in cm with fs in MPa. We convert fs from
 * kg/cm² to MPa internally (×0.0980665).
 *
 * Frosch (1999) informative crack-width estimate:
 *   w = 2·(fs/Es)·β·√(dc² + (s/2)²)·1000   (mm)
 *
 * Gergely-Lutz: w = 0.011·β·fs·³√(dc·A)  (mm·10⁻³), with A = area de concreto
 * que rodea una barra.
 *
 * Units: mm and cm mixed (ACI native form). Outputs documented per item.
 */
import type { CalculationStep } from "./beam-flexure-live";
import type { StudioCheck } from "@/components/studio/StudioShell";

export type Exposure = "interior" | "exterior" | "aggressive";

export interface FisuracionInput {
  db_mm: number;          // diámetro de barra (mm)
  fy_kgcm2: number;       // kg/cm²
  cc_cm: number;          // recubrimiento libre al estribo más exterior (cm)
  fs_service_kgcm2: number; // tensión de servicio (kg/cm²). Si 0 → usar 2/3 fy
  s_actual_cm: number;    // separación actual entre barras (cm)
  exposure: Exposure;
  h_cm: number;           // peralte total (para visualización)
  b_cm: number;           // ancho (para visualización)
  n_bars: number;         // número de barras en la cara traccionada
}

export interface FisuracionResult {
  // echo
  db: number; fy: number; cc: number; fs_input: number;
  s_actual: number; exposure: Exposure; h: number; b: number; n_bars: number;

  // Calcs
  fs_kgcm2: number;       // usado en cálculo (input o 2/3 fy)
  fs_MPa: number;
  cc_mm: number;          // recubrimiento en mm

  s_max1_cm: number;      // 38·(28/fs) − 2.5·cc
  s_max2_cm: number;      // 30·(28/fs)
  s_max_cm: number;       // min

  s_max_strict_cm: number;// para exposición agresiva → reducir 25%
  governing_limit_cm: number;

  // Cumple
  fisura_ok: boolean;

  // Frosch / Gergely-Lutz (informativos)
  dc_mm: number;          // distancia del centro de barra a fibra extrema (mm)
  beta_GL: number;        // factor Gergely-Lutz ≈ 1.20
  w_frosch_mm: number;    // ancho estimado por Frosch
  w_GL_mm: number;        // ancho estimado por Gergely-Lutz

  warnings: string[];
}

const KG_CM2_TO_MPA = 0.0980665;
const ES_MPA = 200_000;

export function computeFisuracionLive(input: FisuracionInput): FisuracionResult {
  const {
    db_mm: db, fy_kgcm2: fy, cc_cm: cc, fs_service_kgcm2: fs_in,
    s_actual_cm: s_act, exposure, h_cm: h, b_cm: b, n_bars,
  } = input;
  const warnings: string[] = [];

  // fs default = 2/3 fy
  const fs = fs_in > 0 ? fs_in : (2 / 3) * fy;
  const fs_MPa = fs * KG_CM2_TO_MPA;
  const cc_mm = cc * 10;

  // s_max in mm (ACI metric form):
  // s = 380·(280/fs[MPa]) − 2.5·cc[mm]      → mm
  // s ≤ 300·(280/fs[MPa])                   → mm
  const s_max1_mm = Math.max(0, 380 * (280 / Math.max(1, fs_MPa)) - 2.5 * cc_mm);
  const s_max2_mm = 300 * (280 / Math.max(1, fs_MPa));
  const s_max_mm = Math.min(s_max1_mm, s_max2_mm);

  const s_max1_cm = s_max1_mm / 10;
  const s_max2_cm = s_max2_mm / 10;
  const s_max_cm = s_max_mm / 10;

  // Exposición agresiva: reducción 25%
  let s_strict = s_max_cm;
  if (exposure === "aggressive") {
    s_strict = 0.75 * s_max_cm;
    warnings.push("Exposición agresiva — separación reducida 25% (ACI 224R recomendación).");
  } else if (exposure === "exterior") {
    s_strict = 0.90 * s_max_cm;
    warnings.push("Exposición exterior — usar w ≤ 0.30 mm (ACI 224R Tabla 4.1).");
  }
  const governing = s_strict;

  const ok = s_act <= governing;

  // Frosch / Gergely-Lutz crack-width estimates
  // dc = recubrimiento al CENTRO de la barra
  const dc_mm = cc_mm + db / 2;
  // β = h2/h1 ≈ 1.20 para vigas típicas (h2 = dist NA al borde, h1 = dist NA al acero)
  const beta_GL = 1.20;
  // Frosch: w = 2 (fs/Es) β √(dc² + (s/2)²) · convertir fs MPa, Es MPa → mm
  const s_mm = s_act * 10;
  const w_frosch_mm = 2 * (fs_MPa / ES_MPA) * beta_GL
    * Math.sqrt(dc_mm * dc_mm + Math.pow(s_mm / 2, 2));

  // Gergely-Lutz: A = 2·dc·s (área de concreto que rodea cada barra)
  const A_mm2 = 2 * dc_mm * s_mm;
  // w (en 10⁻³ mm) = 0.011·β·fs[MPa]·³√(dc·A)·10⁻⁵... usar ACI form direct:
  // w·10⁻³ in = 0.076 β fs ³√(dc·A)  con dc, A en in; fs en ksi
  // Convertir: empíricamente ≈ w_mm ≈ 1.1×10⁻⁵·β·fs·³√(dc·A)  (fs MPa, dc/A en mm)
  const w_GL_mm = 1.1e-5 * beta_GL * fs_MPa * Math.cbrt(dc_mm * A_mm2);

  if (!ok)
    warnings.push(`s_actual ${s_act.toFixed(1)} cm > s_max ${governing.toFixed(1)} cm. Agregar barras (menor diámetro o mayor cantidad).`);

  return {
    db, fy, cc, fs_input: fs_in, s_actual: s_act, exposure, h, b, n_bars,
    fs_kgcm2: fs, fs_MPa, cc_mm,
    s_max1_cm, s_max2_cm, s_max_cm,
    s_max_strict_cm: s_strict, governing_limit_cm: governing, fisura_ok: ok,
    dc_mm, beta_GL,
    w_frosch_mm, w_GL_mm,
    warnings,
  };
}

export function buildFisuracionSteps(r: FisuracionResult): CalculationStep[] {
  return [
    {
      id: "crack.step_01_fs",
      name: "Tensión de servicio fs",
      equation_latex: r.fs_input > 0
        ? "f_s = \\text{ingresado}"
        : "f_s = \\frac{2}{3} f_y",
      inputs: { fy: r.fy },
      output_var: "fs",
      output_value: r.fs_kgcm2,
      output_unit: "kg/cm²",
      code_ref: "ACI 318-14 §24.3.2.1",
      depends_on: [],
      note: `fs = ${r.fs_MPa.toFixed(0)} MPa.`,
    },
    {
      id: "crack.step_02_cc",
      name: "Recubrimiento libre cc",
      equation_latex: "c_c = \\text{ recubrimiento libre al estribo más exterior}",
      inputs: { cc_cm: r.cc },
      output_var: "cc_mm",
      output_value: r.cc_mm,
      output_unit: "mm",
      code_ref: "ACI 318-14 §24.3.2 (cc en mm)",
      depends_on: [],
      note: "",
    },
    {
      id: "crack.step_03_smax1",
      name: "s_max,1 — fórmula principal",
      equation_latex: "s_{max,1} = 380 \\cdot \\frac{280}{f_s} - 2.5 \\cdot c_c",
      inputs: { fs: r.fs_MPa, cc: r.cc_mm },
      output_var: "s_max1",
      output_value: r.s_max1_cm,
      output_unit: "cm",
      code_ref: "ACI 318-14 §24.3.2 ec. (24.3.2)",
      depends_on: ["crack.step_01_fs", "crack.step_02_cc"],
      note: "Fórmula primaria — gobierna en mayoría de casos.",
    },
    {
      id: "crack.step_04_smax2",
      name: "s_max,2 — límite superior",
      equation_latex: "s_{max,2} = 300 \\cdot \\frac{280}{f_s}",
      inputs: { fs: r.fs_MPa },
      output_var: "s_max2",
      output_value: r.s_max2_cm,
      output_unit: "cm",
      code_ref: "ACI 318-14 §24.3.2",
      depends_on: ["crack.step_01_fs"],
      note: "",
    },
    {
      id: "crack.step_05_smax",
      name: "s_max gobernante",
      equation_latex: "s_{max} = \\min(s_{max,1}, s_{max,2})",
      inputs: { s_max1: r.s_max1_cm, s_max2: r.s_max2_cm },
      output_var: "s_max",
      output_value: r.s_max_cm,
      output_unit: "cm",
      code_ref: "ACI 318-14 §24.3.2",
      depends_on: ["crack.step_03_smax1", "crack.step_04_smax2"],
      note: r.exposure === "aggressive"
        ? "Exposición agresiva → reducir a 75% del valor"
        : r.exposure === "exterior"
          ? "Exposición exterior → reducir a 90% (recom. ACI 224R)"
          : "Exposición interior — sin reducción adicional.",
    },
    {
      id: "crack.step_06_governing",
      name: "Límite gobernante (incluye exposición)",
      equation_latex: r.exposure === "aggressive"
        ? "s_{lim} = 0.75 \\cdot s_{max}"
        : r.exposure === "exterior"
          ? "s_{lim} = 0.90 \\cdot s_{max}"
          : "s_{lim} = s_{max}",
      inputs: { s_max: r.s_max_cm },
      output_var: "s_lim",
      output_value: r.governing_limit_cm,
      output_unit: "cm",
      code_ref: "ACI 224R / ACI 318-14",
      depends_on: ["crack.step_05_smax"],
      note: r.fisura_ok ? "OK — s_actual ≤ s_lim" : "FALLA — agregar barras.",
    },
    {
      id: "crack.step_07_frosch",
      name: "Estimación ancho de fisura (Frosch)",
      equation_latex: "w = 2 \\frac{f_s}{E_s} \\beta \\sqrt{d_c^2 + (s/2)^2}",
      inputs: { fs: r.fs_MPa, dc: r.dc_mm, s: r.s_actual * 10, beta: r.beta_GL },
      output_var: "w_frosch",
      output_value: r.w_frosch_mm,
      output_unit: "mm",
      code_ref: "Frosch (1999)",
      depends_on: [],
      note: `Informativo. Límite recomendado: w ≤ 0.40 mm interior, ≤ 0.30 mm exterior.`,
    },
    {
      id: "crack.step_08_GL",
      name: "Estimación ancho de fisura (Gergely-Lutz)",
      equation_latex: "w = 1.1 \\times 10^{-5} \\beta f_s \\sqrt[3]{d_c \\cdot A}",
      inputs: { fs: r.fs_MPa, dc: r.dc_mm },
      output_var: "w_GL",
      output_value: r.w_GL_mm,
      output_unit: "mm",
      code_ref: "Gergely-Lutz (1968) · ACI 224R-01",
      depends_on: [],
      note: "Histórico. Forma adaptada SI.",
    },
  ];
}

export function buildFisuracionChecks(r: FisuracionResult): StudioCheck[] {
  const w_limit = r.exposure === "interior" ? 0.40
                 : r.exposure === "exterior" ? 0.30 : 0.18;
  return [
    {
      nombre: "s actual ≤ s max (ACI §24.3.2)",
      requerido: r.governing_limit_cm,
      disponible: r.s_actual,
      unidad: "cm",
      cumple: r.fisura_ok,
      referencia: "ACI 318-14 §24.3.2",
      critical: true,
    },
    {
      nombre: "Ancho de fisura w (Frosch) ≤ límite exposición",
      requerido: w_limit,
      disponible: r.w_frosch_mm,
      unidad: "mm",
      cumple: r.w_frosch_mm <= w_limit,
      referencia: "ACI 224R Tabla 4.1",
      critical: false,
    },
    {
      nombre: "Ancho de fisura w (Gergely-Lutz) ≤ límite",
      requerido: w_limit,
      disponible: r.w_GL_mm,
      unidad: "mm",
      cumple: r.w_GL_mm <= w_limit,
      referencia: "ACI 224R Tabla 4.1",
      critical: false,
    },
  ];
}
