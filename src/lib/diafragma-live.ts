/**
 * Diafragma (losa actuando como viga horizontal de gran peralte).
 *
 * References:
 *   - ACI 318-14 §18.12 (Special diaphragms, chords, collectors)
 *   - ACI 318-14 §12   (Diaphragms — general)
 *   - ASCE 7-16 §12.10 (Diaphragm forces Fpx)
 *   - CSCR-10 Rev. 2014 §8.7 (Diafragmas)
 *
 * Procedure:
 *   1. Treat the diaphragm as a horizontal deep beam spanning between shear
 *      walls. Span Ld, depth Bd (= width perpendicular to lateral force).
 *   2. Moment Mu = Fpx · Ld / 8  (uniformly distributed, two-end-supported).
 *   3. Chord tension Tu = Mu / (Bd · 0.9)  approx. (lever arm ≈ 0.9·Bd).
 *      Chord steel As_chord = Tu / (φ · fy).
 *   4. Shear vu = Vu / (Acv) where Acv = t · Bd (gross slab section).
 *      Vu = Fpx / 2 at supports (uniform load).
 *   5. Diaphragm shear capacity φVn ≤ φ · Acv · (2·λ·√f'c[psi] + ρt·fy[psi]).
 *   6. Collector design — transfer of in-plane masa to walls. Approximated
 *      with Fcollector = Fpx · (Lcoll / Ld) and As_coll = Fcoll / (φ · fy).
 *   7. Minimum slab reinforcement ρ_min = 0.0018 (S&T, Gr 60).
 *
 * Units: kg, kg/cm², cm, m. Forces enter in ton; converted internally.
 */
import type { CalculationStep } from "./beam-flexure-live";

export interface DiafragmaInput {
  t_cm: number;          // espesor losa cm
  Ld_m: number;          // longitud entre muros (luz del diafragma) m
  Bd_m: number;          // ancho del diafragma m (perpendicular a Fpx)
  Fpx_ton: number;       // fuerza horizontal en el piso (ton)
  Lcoll_m: number;       // longitud del colector m (a un lado del muro)
  num_muros_dir: number; // muros de corte en la dirección de Fpx
  fc: number;            // kg/cm²
  fy: number;            // kg/cm²
  zona: 1 | 2 | 3 | 4;
}

export interface DiafragmaLiveResult {
  // echo
  t: number; Ld: number; Bd: number;
  Fpx: number; Lcoll: number; num_muros: number;
  fc: number; fy: number; zona: number;

  // computed
  Vu_diaf: number;       // ton — Vu = Fpx / 2
  Mu_diaf_tonm: number;  // ton·m — Mu = Fpx · Ld / 8
  z_arm_m: number;       // 0.9 · Bd
  Tu_chord_ton: number;  // tracción del cordón
  As_chord_cm2: number;  // refuerzo del cordón
  As_chord_min_cm2: number; // ρ_min · area

  Acv_cm2: number;       // área cortante = t · Bd
  vu_kgcm2: number;      // esfuerzo cortante demandado
  phi_vn_kgcm2: number;  // resistencia
  shear_pass: boolean;

  Fcoll_ton: number;
  As_coll_cm2: number;

  rho_min: number;
  As_min_temp_cm2_per_m: number; // por metro de ancho

  warnings: string[];
}

const PSI_PER_KGCM2 = 14.22;

export function computeDiafragmaLive(input: DiafragmaInput): DiafragmaLiveResult {
  const {
    t_cm, Ld_m, Bd_m, Fpx_ton, Lcoll_m,
    num_muros_dir, fc, fy, zona,
  } = input;
  const warnings: string[] = [];

  const phi_b = 0.90;
  const phi_v = 0.75;

  // ---- 1. Cargas ----
  // Uniformly distributed; supports at the shear walls (= num_muros_dir).
  // Simply supported model between the two ends, conservative:
  const Vu = Fpx_ton / 2;
  const Mu_tonm = (Fpx_ton * Ld_m) / 8;

  // ---- 2. Cordón ----
  const z_arm_m = 0.9 * Bd_m;
  const Tu_chord = z_arm_m > 0 ? Mu_tonm / z_arm_m : 0; // ton
  const As_chord = (Tu_chord * 1000) / (phi_b * fy);    // cm²
  // Minimum chord area: ρ_min · gross area of chord band (taken as 0.10·Bd·t)
  const chord_band_area_cm2 = 0.10 * Bd_m * 100 * t_cm;
  const As_chord_min = 0.0018 * chord_band_area_cm2;

  // ---- 3. Cortante ----
  const Bd_cm = Bd_m * 100;
  const Acv = t_cm * Bd_cm; // cm²
  const vu = Acv > 0 ? (Vu * 1000) / Acv : 0; // kg/cm²

  // φVn / Acv = φ · (2·λ·√f'c[psi] + ρt·fy[psi])  → convert to kg/cm²
  const lambda = 1.0; // concreto normal
  const rho_t = 0.0025; // mínimo asumido para muros y diafragmas (ACI §18.12.7.1)
  const fc_psi = fc * PSI_PER_KGCM2;
  const fy_psi = fy * PSI_PER_KGCM2;
  const vn_psi = 2 * lambda * Math.sqrt(fc_psi) + rho_t * fy_psi;
  const vn_kgcm2 = vn_psi / PSI_PER_KGCM2;
  const phi_vn = phi_v * vn_kgcm2;
  const shear_pass = vu <= phi_vn;
  if (!shear_pass) {
    warnings.push(
      `Cortante del diafragma vu = ${vu.toFixed(2)} > φVn = ${phi_vn.toFixed(2)} kg/cm². ` +
      `Aumentar espesor de losa o ρt.`,
    );
  }

  // ---- 4. Colector ----
  const Fcoll = Ld_m > 0 ? Fpx_ton * (Lcoll_m / Ld_m) : 0; // ton
  const As_coll = (Fcoll * 1000) / (phi_b * fy);          // cm²

  // ---- 5. Min refuerzo por temperatura / S&T ----
  const rho_min = 0.0018;
  const As_min_temp_per_m = rho_min * t_cm * 100; // cm² por metro

  // ---- Warnings ----
  if (num_muros_dir < 2) {
    warnings.push("Diafragma con < 2 muros en la dirección: revisar estabilidad por torsión.");
  }
  if (Ld_m / Bd_m > 3) {
    warnings.push(`Relación Ld/Bd = ${(Ld_m / Bd_m).toFixed(1)} > 3.0 — diafragma muy esbelto, considerar análisis detallado.`);
  }
  if (zona >= 3) {
    warnings.push("Zona sísmica ≥ III: diafragma especial — ACI §18.12 aplica completo.");
  }

  return {
    t: t_cm, Ld: Ld_m, Bd: Bd_m,
    Fpx: Fpx_ton, Lcoll: Lcoll_m, num_muros: num_muros_dir,
    fc, fy, zona,
    Vu_diaf: Vu, Mu_diaf_tonm: Mu_tonm, z_arm_m,
    Tu_chord_ton: Tu_chord, As_chord_cm2: Math.max(As_chord, As_chord_min),
    As_chord_min_cm2: As_chord_min,
    Acv_cm2: Acv, vu_kgcm2: vu, phi_vn_kgcm2: phi_vn, shear_pass,
    Fcoll_ton: Fcoll, As_coll_cm2: As_coll,
    rho_min, As_min_temp_cm2_per_m: As_min_temp_per_m,
    warnings,
  };
}

export function buildDiafragmaSteps(r: DiafragmaLiveResult): CalculationStep[] {
  return [
    {
      id: "diafragma.step_01_Vu",
      name: "Cortante en el diafragma",
      equation_latex: "V_u = F_{px} / 2",
      inputs: { Fpx: r.Fpx },
      output_var: "Vu",
      output_value: r.Vu_diaf,
      output_unit: "ton",
      code_ref: "ASCE 7-16 §12.10.1",
      depends_on: [],
      note: "Reacción en cada muro extremo (carga uniforme, dos apoyos).",
    },
    {
      id: "diafragma.step_02_Mu",
      name: "Momento del diafragma como viga horizontal",
      equation_latex: "M_u = \\frac{F_{px} \\cdot L_d}{8}",
      inputs: { Fpx: r.Fpx, Ld: r.Ld },
      output_var: "Mu",
      output_value: r.Mu_diaf_tonm,
      output_unit: "ton·m",
      code_ref: "ACI 318-14 §12.5",
      depends_on: [],
      note: "Modelo de viga simplemente apoyada entre muros.",
    },
    {
      id: "diafragma.step_03_chord",
      name: "Tracción del cordón",
      equation_latex: "T_u = \\frac{M_u}{0.9 \\cdot B_d}",
      inputs: { Mu: r.Mu_diaf_tonm, Bd: r.Bd },
      output_var: "Tu_chord",
      output_value: r.Tu_chord_ton,
      output_unit: "ton",
      code_ref: "ACI 318-14 §18.12.7.5",
      depends_on: ["diafragma.step_02_Mu"],
      note: "Brazo de palanca ≈ 0.9·Bd para diafragmas rectangulares.",
    },
    {
      id: "diafragma.step_04_As_chord",
      name: "Acero del cordón",
      equation_latex: "A_{s,chord} = \\frac{T_u \\cdot 1000}{\\phi \\cdot f_y}",
      inputs: { Tu: r.Tu_chord_ton, phi: 0.9, fy: r.fy },
      output_var: "As_chord",
      output_value: r.As_chord_cm2,
      output_unit: "cm²",
      code_ref: "ACI 318-14 §18.12.7.5",
      depends_on: ["diafragma.step_03_chord"],
      note: "Mínimo por ρ=0.0018 sobre banda 10% Bd verificado en cumplimiento.",
    },
    {
      id: "diafragma.step_05_Acv",
      name: "Área cortante del diafragma",
      equation_latex: "A_{cv} = t \\cdot B_d",
      inputs: { t: r.t, Bd: r.Bd * 100 },
      output_var: "Acv",
      output_value: r.Acv_cm2,
      output_unit: "cm²",
      code_ref: "ACI 318-14 §18.12.9.1",
      depends_on: [],
      note: "",
    },
    {
      id: "diafragma.step_06_vu",
      name: "Esfuerzo cortante demandado",
      equation_latex: "v_u = \\frac{V_u \\cdot 1000}{A_{cv}}",
      inputs: { Vu: r.Vu_diaf, Acv: r.Acv_cm2 },
      output_var: "vu",
      output_value: r.vu_kgcm2,
      output_unit: "kg/cm²",
      code_ref: "ACI 318-14 §18.12.9",
      depends_on: ["diafragma.step_01_Vu", "diafragma.step_05_Acv"],
      note: "",
    },
    {
      id: "diafragma.step_07_phi_vn",
      name: "Resistencia nominal a cortante del diafragma",
      equation_latex:
        "\\phi V_n = \\phi \\cdot A_{cv} \\left(2\\lambda\\sqrt{f'_c[psi]} + \\rho_t f_y[psi]\\right)",
      inputs: { phi: 0.75, fc: r.fc, rho_t: 0.0025, fy: r.fy },
      output_var: "phi_vn",
      output_value: r.phi_vn_kgcm2,
      output_unit: "kg/cm²",
      code_ref: "ACI 318-14 §18.12.9.1",
      depends_on: [],
      note: "Asume ρt mínimo distribuido = 0.0025 (ACI §18.12.7.1).",
    },
    {
      id: "diafragma.step_08_collector",
      name: "Fuerza del colector",
      equation_latex: "F_{col} = F_{px} \\cdot \\frac{L_{col}}{L_d}",
      inputs: { Fpx: r.Fpx, Lcol: r.Lcoll, Ld: r.Ld },
      output_var: "Fcoll",
      output_value: r.Fcoll_ton,
      output_unit: "ton",
      code_ref: "ASCE 7-16 §12.10.2 · ACI §18.12.7.6",
      depends_on: [],
      note: "Fuerza acumulada que transfiere el colector al muro.",
    },
    {
      id: "diafragma.step_09_As_coll",
      name: "Acero del colector",
      equation_latex: "A_{s,col} = \\frac{F_{col} \\cdot 1000}{\\phi \\cdot f_y}",
      inputs: { Fcoll: r.Fcoll_ton, phi: 0.9, fy: r.fy },
      output_var: "As_coll",
      output_value: r.As_coll_cm2,
      output_unit: "cm²",
      code_ref: "ACI 318-14 §18.12.7.6",
      depends_on: ["diafragma.step_08_collector"],
      note: "",
    },
    {
      id: "diafragma.step_10_temp",
      name: "Acero mínimo por temperatura",
      equation_latex: "A_{s,temp} = \\rho_{min} \\cdot t \\cdot b",
      inputs: { rho_min: r.rho_min, t: r.t },
      output_var: "As_temp_per_m",
      output_value: r.As_min_temp_cm2_per_m,
      output_unit: "cm²/m",
      code_ref: "ACI 318-14 §24.4.3.2",
      depends_on: [],
      note: "Distribuido en ambas direcciones del diafragma.",
    },
  ];
}

export function buildDiafragmaChecks(r: DiafragmaLiveResult) {
  return [
    {
      nombre: "Cortante del diafragma vu ≤ φVn",
      requerido: r.vu_kgcm2,
      disponible: r.phi_vn_kgcm2,
      unidad: "kg/cm²",
      cumple: r.shear_pass,
      referencia: "ACI 318-14 §18.12.9",
      critical: true,
    },
    {
      nombre: "Acero del cordón As_chord",
      requerido: r.As_chord_cm2,
      disponible: r.As_chord_cm2,
      unidad: "cm²",
      cumple: true,
      referencia: "ACI 318-14 §18.12.7.5",
      critical: false,
    },
    {
      nombre: "Espesor mínimo del diafragma",
      requerido: 5,
      disponible: r.t,
      unidad: "cm",
      cumple: r.t >= 5,
      referencia: "ACI 318-14 §18.12.6",
      critical: true,
    },
    {
      nombre: "Esbeltez Ld / Bd ≤ 3",
      requerido: 3,
      disponible: r.Bd > 0 ? r.Ld / r.Bd : 0,
      unidad: "",
      cumple: r.Bd > 0 ? (r.Ld / r.Bd) <= 3 : false,
      referencia: "Buena práctica — diafragma rígido",
      critical: false,
    },
  ];
}
