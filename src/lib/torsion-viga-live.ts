/**
 * Torsión en viga — Diseño combinado V + T + M.
 *
 * References:
 *   - ACI 318-14 §22.7 — Torsional strength (cracking, design, combined)
 *   - ACI 318-14 §9.5.4 — Longitudinal reinforcement for torsion
 *   - ACI 318-14 §9.6.4 — Minimum transverse + longitudinal reinforcement
 *   - Hsu, T.T.C. and Mo, Y.L. (2010), Unified Theory of Concrete Structures.
 *   - MacGregor, J.G. (2009), §7 — Torsion in beams.
 *   - CSCR-10 §8.6 — torsión y cortante combinado.
 *
 * Procedure:
 *   1. Threshold torsion Tth (below which torsion can be neglected).
 *   2. Cracking torsion Tcr.
 *   3. Cross-section adequacy (combined stress limit).
 *   4. Transverse reinforcement At/s.
 *   5. Combined Av/s + 2·At/s (per leg vs per pair).
 *   6. Longitudinal reinforcement Al.
 *   7. Minimum Al, spacing limits.
 *
 * Units: kg, kg/cm², cm, ton, ton·m. Internal psi/lb conversion where ACI
 * uses psi-form √f'c (note: §22.7 uses SI directly in the metric edition).
 */
import type { CalculationStep } from "./beam-flexure-live";
import type { StudioCheck } from "@/components/studio/StudioShell";

export interface TorsionVigaInput {
  b_cm: number;          // ancho del alma
  h_cm: number;          // peralte total
  d_cm: number;          // peralte efectivo
  r_cm: number;          // recubrimiento al estribo
  Tu_tonm: number;       // torsión última
  Vu_ton: number;        // cortante último
  Mu_tonm: number;       // momento último (para combinación con Al)
  fc: number;            // kg/cm²
  fy_long: number;       // kg/cm² acero longitudinal
  fy_transv: number;     // kg/cm² acero transversal (estribos)
  As_long_existing: number; // cm² acero longitudinal existente (flexión)
  Av_existing_cm2: number;  // cm² por estribo (toda la sección, 2 ramas)
  s_existing_cm: number;    // separación de estribos existente
  isEquilibrium: boolean;   // true = equilibrium torsion; false = compatibility
}

export interface TorsionVigaResult {
  // echo
  b: number; h: number; d: number; r: number;
  Tu: number; Vu: number; Mu: number;
  fc: number; fy_long: number; fy_transv: number;
  As_long_existing: number; Av_existing_cm2: number; s_existing_cm: number;
  isEquilibrium: boolean;

  // Geometría torsional
  Acp_cm2: number;       // area enclosed by outer perimeter
  pcp_cm: number;        // outer perimeter
  Aoh_cm2: number;       // area enclosed by centerline of outermost stirrup
  ph_cm: number;         // perimeter of centerline of outermost stirrup
  Ao_cm2: number;        // gross area enclosed by shear flow (= 0.85·Aoh)

  // Umbrales
  Tth_tonm: number;      // umbral §22.7.4 (threshold)
  Tcr_tonm: number;      // cracking §22.7.5
  needs_design: boolean; // Tu > φ·Tth
  Tu_design_tonm: number; // efectivo (puede reducirse a Tcr en compatibility)

  // Adecuación de sección
  combined_stress: number; // √[(Vu/bd)² + (Tu·ph/1.7·Aoh²)²]
  stress_limit: number;    // φ·(Vc/(bd) + 8√f'c) en kg/cm²
  section_ok: boolean;

  // Refuerzo transversal
  At_over_s_cm2cm: number;  // At/s requerido (1 rama) cm²/cm
  Av_over_s_cm2cm: number;  // Av/s por cortante (2 ramas)
  combined_av_at_cm2cm: number; // Av/s + 2·At/s para verificación
  s_max_cm: number;         // separación máxima

  // Refuerzo longitudinal
  Al_req_cm2: number;       // longitudinal por torsión
  Al_min_cm2: number;       // mínimo §9.5.4
  Al_design_cm2: number;    // gobierna
  As_long_total_req_cm2: number; // acero flexión + torsión combinado

  warnings: string[];
}

const PHI_V = 0.75;
const PHI_T = 0.75;

export function computeTorsionVigaLive(
  input: TorsionVigaInput,
): TorsionVigaResult {
  const {
    b_cm: b, h_cm: h, d_cm: d, r_cm: r,
    Tu_tonm: Tu, Vu_ton: Vu, Mu_tonm: Mu,
    fc, fy_long, fy_transv,
    As_long_existing, Av_existing_cm2, s_existing_cm,
    isEquilibrium,
  } = input;
  const warnings: string[] = [];

  // Geometría torsional (sección rectangular sólida)
  const Acp = b * h;
  const pcp = 2 * (b + h);
  // Aoh = area encerrada por el centerline del estribo más exterior
  // Asumimos un estribo @ recubrimiento r + db_estribo/2 ≈ r + 0.5
  const cover = r + 0.5;
  const x1 = b - 2 * cover;
  const y1 = h - 2 * cover;
  const Aoh = Math.max(0, x1 * y1);
  const ph = Math.max(0, 2 * (x1 + y1));
  const Ao = 0.85 * Aoh;

  // Cracking torsion §22.7.5
  // Tcr = 4·λ·√f'c · (Acp²/pcp)   en psi-units → metricar
  // En forma SI (kg-cm²): Tcr ≈ 1.06·√f'c·Acp²/pcp [kg·cm]
  // Pasamos a ton·m: dividir por 100,000
  const sqrt_fc = Math.sqrt(fc);
  const Tcr_kgcm = (pcp > 0) ? 1.06 * sqrt_fc * (Acp * Acp / pcp) : 0;
  const Tcr_tonm = Tcr_kgcm / 100_000.0;

  // Threshold §22.7.4: T < φ·Tth = φ·0.25·Tcr → torsión puede ignorarse
  const Tth_tonm = 0.25 * Tcr_tonm;
  const needs_design = Tu > PHI_T * Tth_tonm;

  // Compatibility torsion (§22.7.3): puede reducirse a φ·Tcr
  let Tu_design = Tu;
  if (!isEquilibrium && Tu > PHI_T * Tcr_tonm) {
    Tu_design = PHI_T * Tcr_tonm;
    warnings.push(`Torsión por compatibilidad — reducida de Tu = ${Tu.toFixed(2)} a φ·Tcr = ${Tu_design.toFixed(2)} ton·m.`);
  }

  // Adecuación de sección §22.7.7.1
  // √[(Vu/(b·d))² + (Tu·ph/(1.7·Aoh²))²] ≤ φ·(Vc/(b·d) + 8·√f'c·factor)
  const Tu_kgcm = Tu_design * 100_000.0;
  const Vu_kg = Vu * 1000.0;
  const term_v = b * d > 0 ? Vu_kg / (b * d) : 0; // kg/cm²
  const term_t = (Aoh * Aoh > 0) ? (Tu_kgcm * ph) / (1.7 * Aoh * Aoh) : 0; // kg/cm²
  const combined_stress = Math.sqrt(term_v * term_v + term_t * term_t);
  // Vc/bd para viga ≈ 0.53·√f'c
  const Vc_term = 0.53 * sqrt_fc;
  // Convertir 8·√f'c (psi-form) → 8/12 · √f'c en kg/cm² ≈ 2.12·√f'c
  const stress_limit = PHI_T * (Vc_term + 2.12 * sqrt_fc);
  const section_ok = combined_stress <= stress_limit;
  if (!section_ok) warnings.push("Sección inadecuada para combinación V+T. Aumentar b o h.");

  // Refuerzo transversal por torsión §22.7.6.1
  // At/s = Tu / (φ·2·Ao·fyt·cot(θ))  con θ = 45° → cot = 1
  const theta_cot = 1.0;
  const At_over_s = (Ao > 0 && fy_transv > 0)
    ? Tu_kgcm / (PHI_T * 2 * Ao * fy_transv * theta_cot)
    : 0;

  // Cortante — Vs requerido = Vu/φ − Vc
  const Vc = 0.53 * sqrt_fc * b * d; // kg
  const Vs_req = Math.max(0, Vu_kg / PHI_V - Vc); // kg
  const Av_over_s = (fy_transv > 0 && d > 0) ? Vs_req / (fy_transv * d) : 0;

  // Combined: Av/s (2 ramas) + 2·At/s (porque At es por una rama, x2 ramas)
  const combined = Av_over_s + 2 * At_over_s;

  // Min Av §9.6.4: Av,min/s = max(0.75√f'c · b/fyt, 3.5 b/fyt)
  const Av_min_over_s_1 = 0.75 * sqrt_fc * b / fy_transv;
  const Av_min_over_s_2 = 3.5 * b / fy_transv;
  const Av_min_over_s = Math.max(Av_min_over_s_1, Av_min_over_s_2);

  // Spacing limit §9.7.6.3
  const s_max = Math.min(ph / 8, 30);

  // Refuerzo longitudinal §22.7.6.1
  // Al = (At/s)·ph·(fyt/fyl)·cot²(θ)
  const Al_req = At_over_s * ph * (fy_transv / fy_long) * theta_cot * theta_cot;

  // Al min §9.5.4 / §9.6.4.3
  // Al,min = (5·√f'c·Acp)/fy − (At/s)·ph·(fyt/fy)
  // En unidades SI metricadas:
  const Al_min_1 = (5 * sqrt_fc * Acp) / fy_long;
  const Al_min_2 = Al_min_1 - (At_over_s * ph * (fy_transv / fy_long));
  const Al_min = Math.max(0, Math.min(Al_min_1, Math.max(Al_min_2, 0)));

  const Al_design = Math.max(Al_req, Al_min);
  const As_long_total = As_long_existing + Al_design;

  if (s_existing_cm > 0 && s_existing_cm > s_max)
    warnings.push(`Separación de estribos ${s_existing_cm} cm > smax = ${s_max.toFixed(1)} cm.`);

  if (Av_existing_cm2 > 0 && s_existing_cm > 0) {
    const Av_prov = Av_existing_cm2 / s_existing_cm;
    if (Av_prov < combined)
      warnings.push(`Av/s provisto (${Av_prov.toFixed(4)}) < requerido (${combined.toFixed(4)}) cm²/cm.`);
  }

  return {
    b, h, d, r, Tu, Vu, Mu, fc, fy_long, fy_transv,
    As_long_existing, Av_existing_cm2, s_existing_cm, isEquilibrium,
    Acp_cm2: Acp, pcp_cm: pcp, Aoh_cm2: Aoh, ph_cm: ph, Ao_cm2: Ao,
    Tth_tonm, Tcr_tonm, needs_design, Tu_design_tonm: Tu_design,
    combined_stress, stress_limit, section_ok,
    At_over_s_cm2cm: At_over_s,
    Av_over_s_cm2cm: Math.max(Av_over_s, Av_min_over_s),
    combined_av_at_cm2cm: combined,
    s_max_cm: s_max,
    Al_req_cm2: Al_req, Al_min_cm2: Al_min, Al_design_cm2: Al_design,
    As_long_total_req_cm2: As_long_total,
    warnings,
  };
}

export function buildTorsionVigaSteps(r: TorsionVigaResult): CalculationStep[] {
  return [
    {
      id: "torsion.step_01_Acp",
      name: "Área y perímetro exteriores",
      equation_latex: "A_{cp} = b \\cdot h, \\;\\; p_{cp} = 2(b+h)",
      inputs: { b: r.b, h: r.h },
      output_var: "Acp",
      output_value: r.Acp_cm2,
      output_unit: "cm²",
      code_ref: "ACI 318-14 §22.7.5",
      depends_on: [],
      note: `pcp = ${r.pcp_cm.toFixed(0)} cm`,
    },
    {
      id: "torsion.step_02_Aoh",
      name: "Geometría del estribo cerrado",
      equation_latex: "A_{oh} = x_1 \\cdot y_1, \\;\\; p_h = 2(x_1 + y_1), \\;\\; A_o = 0.85 A_{oh}",
      inputs: { b: r.b, h: r.h, r: r.r },
      output_var: "Aoh",
      output_value: r.Aoh_cm2,
      output_unit: "cm²",
      code_ref: "ACI 318-14 §22.7.6.1",
      depends_on: ["torsion.step_01_Acp"],
      note: `ph = ${r.ph_cm.toFixed(1)} cm, Ao = ${r.Ao_cm2.toFixed(0)} cm²`,
    },
    {
      id: "torsion.step_03_Tcr",
      name: "Torsión de agrietamiento",
      equation_latex: "T_{cr} = 1.06 \\sqrt{f'_c} \\cdot \\frac{A_{cp}^2}{p_{cp}}",
      inputs: { fc: r.fc, Acp: r.Acp_cm2, pcp: r.pcp_cm },
      output_var: "Tcr",
      output_value: r.Tcr_tonm,
      output_unit: "ton·m",
      code_ref: "ACI 318-14 §22.7.5",
      depends_on: ["torsion.step_01_Acp"],
      note: `Threshold Tth = 0.25·Tcr = ${r.Tth_tonm.toFixed(3)} ton·m`,
    },
    {
      id: "torsion.step_04_Tdes",
      name: "Torsión de diseño",
      equation_latex: r.isEquilibrium
        ? "T_{u,dis} = T_u \\text{ (equilibrio)}"
        : "T_{u,dis} = \\min(T_u, \\phi T_{cr}) \\text{ (compatibilidad)}",
      inputs: { Tu: r.Tu, Tcr: r.Tcr_tonm },
      output_var: "Tu_design",
      output_value: r.Tu_design_tonm,
      output_unit: "ton·m",
      code_ref: "ACI 318-14 §22.7.3",
      depends_on: ["torsion.step_03_Tcr"],
      note: r.needs_design
        ? "Torsión > φTth → DISEÑO requerido"
        : "Tu ≤ φTth → torsión despreciable",
    },
    {
      id: "torsion.step_05_sectAdeq",
      name: "Adecuación de sección (V + T combinados)",
      equation_latex:
        "\\sqrt{\\left(\\frac{V_u}{bd}\\right)^2 + \\left(\\frac{T_u \\cdot p_h}{1.7 A_{oh}^2}\\right)^2} \\le \\phi\\left(\\frac{V_c}{bd} + 2.12\\sqrt{f'_c}\\right)",
      inputs: { Vu: r.Vu, Tu: r.Tu_design_tonm, ph: r.ph_cm, Aoh: r.Aoh_cm2, b: r.b, d: r.d },
      output_var: "stress",
      output_value: r.combined_stress,
      output_unit: "kg/cm²",
      code_ref: "ACI 318-14 §22.7.7.1",
      depends_on: ["torsion.step_04_Tdes"],
      note: `${r.section_ok ? "OK" : "FALLA"} — límite ${r.stress_limit.toFixed(2)} kg/cm²`,
    },
    {
      id: "torsion.step_06_AtOverS",
      name: "Refuerzo transversal por torsión At/s",
      equation_latex: "\\frac{A_t}{s} = \\frac{T_u}{\\phi \\cdot 2 A_o \\cdot f_{yt} \\cot\\theta}",
      inputs: { Tu: r.Tu_design_tonm, Ao: r.Ao_cm2, fy: r.fy_transv },
      output_var: "At_over_s",
      output_value: r.At_over_s_cm2cm,
      output_unit: "cm²/cm",
      code_ref: "ACI 318-14 §22.7.6.1",
      depends_on: ["torsion.step_05_sectAdeq"],
      note: `θ = 45° (cot θ = 1). Por rama de estribo cerrado.`,
    },
    {
      id: "torsion.step_07_combined",
      name: "Combinado Av/s + 2·At/s",
      equation_latex: "\\frac{A_{v+t}}{s} = \\frac{A_v}{s} + 2 \\frac{A_t}{s}",
      inputs: { Av_s: r.Av_over_s_cm2cm, At_s: r.At_over_s_cm2cm },
      output_var: "Avt_over_s",
      output_value: r.combined_av_at_cm2cm,
      output_unit: "cm²/cm",
      code_ref: "ACI 318-14 §9.5.4 + §22.7",
      depends_on: ["torsion.step_06_AtOverS"],
      note: `smax = min(ph/8, 30 cm) = ${r.s_max_cm.toFixed(1)} cm.`,
    },
    {
      id: "torsion.step_08_Al",
      name: "Refuerzo longitudinal por torsión Al",
      equation_latex: "A_l = \\frac{A_t}{s} \\cdot p_h \\cdot \\frac{f_{yt}}{f_{yl}} \\cot^2\\theta",
      inputs: { At_s: r.At_over_s_cm2cm, ph: r.ph_cm, fyt: r.fy_transv, fyl: r.fy_long },
      output_var: "Al",
      output_value: r.Al_design_cm2,
      output_unit: "cm²",
      code_ref: "ACI 318-14 §22.7.6.1 + §9.5.4",
      depends_on: ["torsion.step_06_AtOverS"],
      note: `Almin = ${r.Al_min_cm2.toFixed(2)} cm². Sumar a As de flexión.`,
    },
    {
      id: "torsion.step_09_AsTotal",
      name: "Acero longitudinal total = flexión + torsión",
      equation_latex: "A_{s,tot} = A_{s,flex} + A_l",
      inputs: { Asf: r.As_long_existing, Al: r.Al_design_cm2 },
      output_var: "As_tot",
      output_value: r.As_long_total_req_cm2,
      output_unit: "cm²",
      code_ref: "ACI 318-14 §9.5.4",
      depends_on: ["torsion.step_08_Al"],
      note: "Distribuir Al entre las 4 esquinas + caras intermedias.",
    },
  ];
}

export function buildTorsionVigaChecks(r: TorsionVigaResult): StudioCheck[] {
  return [
    {
      nombre: "Torsión > umbral → diseño requerido",
      requerido: 0.25 * r.Tcr_tonm * PHI_T,
      disponible: r.Tu,
      unidad: "ton·m",
      cumple: !r.needs_design || r.section_ok,
      referencia: "ACI 318-14 §22.7.4",
      critical: false,
    },
    {
      nombre: "Sección adecuada (V + T)",
      requerido: r.stress_limit,
      disponible: r.combined_stress,
      unidad: "kg/cm²",
      cumple: r.section_ok,
      referencia: "ACI 318-14 §22.7.7.1",
      critical: true,
    },
    {
      nombre: "Separación estribos ≤ smax",
      requerido: r.s_max_cm,
      disponible: r.s_existing_cm,
      unidad: "cm",
      cumple: r.s_existing_cm <= r.s_max_cm,
      referencia: "ACI 318-14 §9.7.6.3",
      critical: true,
    },
    {
      nombre: "Al provisto ≥ Al requerido",
      requerido: r.Al_design_cm2,
      disponible: r.As_long_existing,
      unidad: "cm²",
      cumple: r.As_long_existing >= r.Al_design_cm2,
      referencia: "ACI 318-14 §9.5.4",
      critical: false,
    },
  ];
}
