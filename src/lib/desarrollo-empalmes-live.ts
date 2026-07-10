/**
 * Development & splice lengths — Longitudes de desarrollo / empalme.
 *
 * References:
 *   - ACI 318-14 §25.4 (Development of reinforcement)
 *   - ACI 318-14 §25.5 (Splices)
 *   - CSCR-10 Rev. 2014 §8.2.1 (Ganchos sísmicos 135°)
 *
 * Procedure:
 *   1. Tracción — simplificado §25.4.2.2:
 *        ld = (fy · ψt · ψe · ψs · λ) / (γ · √f'c) · db,
 *      γ por tabla (depende de db, c, s, Ktr).
 *   2. Tracción — general §25.4.2.3:
 *        ld = (fy · ψt · ψe · ψs · λ) / (110 · √f'c · ((cb+Ktr)/db)) · db
 *      (cb+Ktr)/db ≤ 2.5.
 *   3. Gancho estándar §25.4.3:
 *        ldh = (0.075 · fy · ψe · ψc · ψr · λ) / √f'c · db
 *      no menor que 8db ni 15 cm.
 *   4. Compresión §25.4.9:
 *        ldc = (0.075 · fy / (λ · √f'c)) · db ≥ 0.0044 · fy · db
 *   5. Empalmes §25.5.2.1:
 *        Clase A: 1.0·ld; Clase B: 1.3·ld
 *   6. Gancho sísmico 135° (CSCR §8.2.1):
 *        ext = max(6·db, 75 mm)
 *
 * Units: cm, kg, kg/cm². fy y f'c en kg/cm². Salida en cm.
 */

// @lat: [[lat.md\codigo\detallado#Detallado#Longitudes de desarrollo]]
// @lat: [[lat.md\codigo\detallado#Detallado#Ganchos sismicos 135]]

import type { CalculationStep } from "./beam-flexure-live";
import { dbBar } from "./materials";

export type CaseType =
  | "straight_tension"        // barra recta tracción
  | "hook_90"                 // gancho 90°
  | "hook_180"                // gancho 180°
  | "splice_A"                // empalme clase A
  | "splice_B"                // empalme clase B
  | "compression";            // compresión

export interface DesarrolloInput {
  bar_size: number;          // # de barra (3..11)
  fy: number;                // kg/cm²
  fc: number;                // kg/cm²
  caseType: CaseType;
  c_cover_cm: number;        // recubrimiento c (más cercano)
  s_spacing_cm: number;      // separación centro-a-centro entre barras
  Ktr: number;               // factor por estribos transversales (puede ser 0)
  epoxi: boolean;            // ψe = 1.5 con epóxico, 1.0 sin
  topBar: boolean;           // ψt = 1.3 barra superior, 1.0 otras
  lightweight: boolean;      // λ = 0.75 ligero, 1.0 normal
  seismic_zone: 1 | 2 | 3 | 4;
}

export interface DesarrolloLiveResult {
  // echo
  bar_size: number; db_cm: number; fy: number; fc: number; caseType: CaseType;
  c: number; s: number; Ktr: number;
  psi_t: number; psi_e: number; psi_s: number; psi_c: number; psi_r: number;
  lambda: number;

  // intermediate
  sqrt_fc: number;
  cb_plus_Ktr_over_db: number;     // bounded ≤ 2.5

  // outputs by case (all computed; caller picks final based on caseType)
  ld_simple_cm: number;            // §25.4.2.2 simplificado
  ld_general_cm: number;           // §25.4.2.3 general
  ldh_cm: number;                  // gancho 90° / 180°
  ldh_min_cm: number;              // max(8db, 15 cm)
  ldc_cm: number;                  // compresión §25.4.9
  ldc_min_cm: number;              // 0.0044·fy·db
  splice_A_cm: number;             // 1.0 · ld_general
  splice_B_cm: number;             // 1.3 · ld_general

  // final length for the case
  ld_final_cm: number;
  hook_extension_135_cm: number;   // CSCR §8.2.1: max(6db, 7.5 cm)

  warnings: string[];
}

export function computeDesarrolloLive(input: DesarrolloInput): DesarrolloLiveResult {
  const {
    bar_size, fy, fc, caseType,
    c_cover_cm: c, s_spacing_cm: s, Ktr,
    epoxi, topBar, lightweight, seismic_zone,
  } = input;
  const warnings: string[] = [];

  const db = dbBar(bar_size); // cm
  const sqrt_fc = Math.sqrt(fc);

  // ψ factors per ACI 318-14 §25.4.2.4
  const psi_t = topBar ? 1.3 : 1.0;        // top bar (over 30 cm of concrete below)
  const psi_e = epoxi ? 1.5 : 1.0;         // epoxy coating
  const psi_s = bar_size >= 7 ? 1.0 : 0.8; // bar size factor
  const psi_c = epoxi ? 1.2 : 1.0;         // for hooks: coating
  const psi_r = 1.0;                       // for hooks: confinement (1.0 default)
  const lambda = lightweight ? 0.75 : 1.0; // lightweight concrete

  // ψt·ψe ≤ 1.7 (ACI 25.4.2.4)
  let psi_t_psi_e = psi_t * psi_e;
  if (psi_t_psi_e > 1.7) {
    psi_t_psi_e = 1.7;
    warnings.push("ψt·ψe limitado a 1.7 por ACI 25.4.2.4.");
  }

  // cb = min(c, s/2)
  const cb = Math.min(c, s / 2);
  // (cb + Ktr) / db, máximo 2.5
  let cb_plus_Ktr_over_db = (cb + Ktr) / db;
  if (cb_plus_Ktr_over_db > 2.5) cb_plus_Ktr_over_db = 2.5;

  // 1. Simplified §25.4.2.2 — γ table:
  //    db ≤ #6 (1.91 cm) and (c≥db and s≥3db) or transverse reinforcement → γ=44
  //    Otherwise db ≤ #6 → γ=66; db ≥ #7 with same condition → γ=35; else γ=53.
  // Approximate γ value (we keep the kg/cm² form):
  let gamma_simple = 50; // default kg/cm² equivalent
  if (bar_size <= 6 && cb >= db && s >= 3 * db) gamma_simple = 44;
  else if (bar_size <= 6) gamma_simple = 66;
  else if (cb >= db && s >= 3 * db) gamma_simple = 35;
  else gamma_simple = 53;

  const ld_simple = (fy * psi_t_psi_e * psi_s * lambda) / (gamma_simple * sqrt_fc) * db;

  // 2. General §25.4.2.3
  const ld_general = (fy * psi_t_psi_e * psi_s * lambda) /
    (110 * sqrt_fc * cb_plus_Ktr_over_db) * db;

  // 3. Hook 90° / 180° §25.4.3
  const ldh = (0.075 * fy * psi_e * psi_c * psi_r * lambda) / sqrt_fc * db;
  const ldh_min = Math.max(8 * db, 15);
  const ldh_final = Math.max(ldh, ldh_min);

  // 4. Compression §25.4.9
  const ldc_main = (0.075 * fy / (lambda * sqrt_fc)) * db;
  const ldc_min = 0.0044 * fy * db;
  const ldc = Math.max(ldc_main, ldc_min);

  // 5. Splices §25.5.2.1
  const splice_A = 1.0 * ld_general;
  const splice_B = 1.3 * ld_general;

  // 6. Seismic hook 135° extension — CSCR §8.2.1
  const hook_135 = Math.max(6 * db, 7.5); // cm

  // Final
  let ld_final = 0;
  switch (caseType) {
    case "straight_tension": ld_final = Math.max(ld_simple, 30); break;
    case "hook_90": ld_final = ldh_final; break;
    case "hook_180": ld_final = ldh_final; break;
    case "splice_A": ld_final = splice_A; break;
    case "splice_B": ld_final = splice_B; break;
    case "compression": ld_final = ldc; break;
  }

  if (seismic_zone >= 3 && caseType.startsWith("hook")) {
    warnings.push("Zona III/IV: usar gancho sísmico 135° en estribos (CSCR §8.2.1).");
  }
  if (caseType === "splice_B") {
    warnings.push("Clase B (1.3·ld) usado por defecto si > 50% de barras se empalman en la misma zona.");
  }

  return {
    bar_size, db_cm: db, fy, fc, caseType,
    c, s, Ktr,
    psi_t, psi_e, psi_s, psi_c, psi_r, lambda,
    sqrt_fc,
    cb_plus_Ktr_over_db,
    ld_simple_cm: ld_simple,
    ld_general_cm: ld_general,
    ldh_cm: ldh,
    ldh_min_cm: ldh_min,
    ldc_cm: ldc,
    ldc_min_cm: ldc_min,
    splice_A_cm: splice_A,
    splice_B_cm: splice_B,
    ld_final_cm: ld_final,
    hook_extension_135_cm: hook_135,
    warnings,
  };
}

export function buildDesarrolloSteps(r: DesarrolloLiveResult): CalculationStep[] {
  return [
    {
      id: "develop.step_01_db", name: "Diámetro de la barra",
      equation_latex: "d_b\\;\\text{según tabla (cm)}",
      inputs: { size: r.bar_size },
      output_var: "db", output_value: r.db_cm, output_unit: "cm",
      code_ref: "ASTM A615 / INTE 06-09-23",
      depends_on: [], note: `Barra #${r.bar_size} → db = ${r.db_cm.toFixed(2)} cm.`,
    },
    {
      id: "develop.step_02_psi", name: "Factores ψ y λ",
      equation_latex:
        "\\psi_t \\cdot \\psi_e \\leq 1.7;\\;\\; \\psi_s,\\; \\lambda\\;\\text{según condiciones}",
      inputs: { psi_t: r.psi_t, psi_e: r.psi_e, psi_s: r.psi_s, lambda: r.lambda },
      output_var: "psi_prod", output_value: r.psi_t * r.psi_e, output_unit: "",
      code_ref: "ACI 318-14 §25.4.2.4", depends_on: [],
      note: `ψt=${r.psi_t}, ψe=${r.psi_e}, ψs=${r.psi_s}, λ=${r.lambda}.`,
    },
    {
      id: "develop.step_03_sqrt_fc", name: "√f'c",
      equation_latex: "\\sqrt{f'_c}",
      inputs: { fc: r.fc },
      output_var: "sqrt_fc", output_value: r.sqrt_fc, output_unit: "(kg/cm²)^0.5",
      code_ref: "ACI 318-14 §25.4", depends_on: [], note: "",
    },
    {
      id: "develop.step_04_ld_simple", name: "Longitud de desarrollo simplificada (tracción)",
      equation_latex:
        "\\ell_d = \\frac{f_y \\cdot \\psi_t \\psi_e \\psi_s \\cdot \\lambda}{\\gamma \\sqrt{f'_c}} \\cdot d_b",
      inputs: { fy: r.fy, db: r.db_cm },
      output_var: "ld_simple", output_value: r.ld_simple_cm, output_unit: "cm",
      code_ref: "ACI 318-14 §25.4.2.2",
      depends_on: ["develop.step_01_db", "develop.step_02_psi", "develop.step_03_sqrt_fc"], note: "",
    },
    {
      id: "develop.step_05_ld_general", name: "Longitud de desarrollo general (tracción)",
      equation_latex:
        "\\ell_d = \\frac{f_y \\cdot \\psi_t \\psi_e \\psi_s \\lambda}{110 \\sqrt{f'_c} \\cdot \\frac{c_b + K_{tr}}{d_b}} \\cdot d_b",
      inputs: { cb_Ktr_db: r.cb_plus_Ktr_over_db, fy: r.fy, db: r.db_cm },
      output_var: "ld_general", output_value: r.ld_general_cm, output_unit: "cm",
      code_ref: "ACI 318-14 §25.4.2.3",
      depends_on: ["develop.step_01_db", "develop.step_02_psi", "develop.step_03_sqrt_fc"],
      note: `(cb+Ktr)/db = ${r.cb_plus_Ktr_over_db.toFixed(2)} (máx 2.5).`,
    },
    {
      id: "develop.step_06_ldh", name: "Gancho estándar 90° / 180°",
      equation_latex:
        "\\ell_{dh} = \\frac{0.075 \\cdot f_y \\cdot \\psi_e \\psi_c \\psi_r \\cdot \\lambda}{\\sqrt{f'_c}} \\cdot d_b",
      inputs: { fy: r.fy, db: r.db_cm },
      output_var: "ldh", output_value: r.ldh_cm, output_unit: "cm",
      code_ref: "ACI 318-14 §25.4.3",
      depends_on: ["develop.step_03_sqrt_fc"],
      note: `Mínimo: max(8·db, 15 cm) = ${r.ldh_min_cm.toFixed(1)} cm.`,
    },
    {
      id: "develop.step_07_ldc", name: "Longitud de desarrollo en compresión",
      equation_latex:
        "\\ell_{dc} = \\frac{0.075 \\cdot f_y}{\\lambda \\sqrt{f'_c}} \\cdot d_b \\;\\;\\geq\\;\\; 0.0044 f_y d_b",
      inputs: { fy: r.fy, db: r.db_cm },
      output_var: "ldc", output_value: r.ldc_cm, output_unit: "cm",
      code_ref: "ACI 318-14 §25.4.9", depends_on: [],
      note: `Mínimo 0.0044·fy·db = ${r.ldc_min_cm.toFixed(1)} cm.`,
    },
    {
      id: "develop.step_08_splices", name: "Empalmes por solapado",
      equation_latex:
        "\\ell_{st,A} = 1.0\\ell_d,\\;\\; \\ell_{st,B} = 1.3\\ell_d",
      inputs: { ld: r.ld_general_cm },
      output_var: "splice_B", output_value: r.splice_B_cm, output_unit: "cm",
      code_ref: "ACI 318-14 §25.5.2.1",
      depends_on: ["develop.step_05_ld_general"],
      note: `Clase A = ${r.splice_A_cm.toFixed(1)}, Clase B = ${r.splice_B_cm.toFixed(1)} cm.`,
    },
    {
      id: "develop.step_09_hook_135", name: "Extensión de gancho sísmico 135°",
      equation_latex: "\\text{ext} = \\max(6 d_b,\\; 7.5\\,\\text{cm})",
      inputs: { db: r.db_cm },
      output_var: "ext_135", output_value: r.hook_extension_135_cm, output_unit: "cm",
      code_ref: "CSCR-10 §8.2.1", depends_on: [],
      note: "Aplicable a estribos en zona sísmica.",
    },
    {
      id: "develop.step_10_final", name: "Longitud final para el caso seleccionado",
      equation_latex: "\\ell\\;\\text{(caso)}",
      inputs: { case: 0 },
      output_var: "L_final", output_value: r.ld_final_cm, output_unit: "cm",
      code_ref: "ACI 318-14 §25",
      depends_on: ["develop.step_04_ld_simple", "develop.step_05_ld_general", "develop.step_06_ldh", "develop.step_07_ldc"],
      note: `Caso = ${r.caseType}; longitud = ${r.ld_final_cm.toFixed(1)} cm.`,
    },
  ];
}

export function buildDesarrolloChecks(r: DesarrolloLiveResult) {
  return [
    {
      nombre: "Gancho ≥ max(8·db, 15 cm)",
      requerido: r.ldh_min_cm, disponible: r.ldh_cm,
      unidad: "cm", cumple: r.ldh_cm >= r.ldh_min_cm,
      referencia: "ACI 318-14 §25.4.3", critical: r.caseType.startsWith("hook"),
    },
    {
      nombre: "Compresión ≥ 0.0044·fy·db",
      requerido: r.ldc_min_cm, disponible: r.ldc_cm,
      unidad: "cm", cumple: r.ldc_cm >= r.ldc_min_cm,
      referencia: "ACI 318-14 §25.4.9", critical: r.caseType === "compression",
    },
    {
      nombre: "(cb+Ktr)/db ≤ 2.5",
      requerido: 2.5, disponible: r.cb_plus_Ktr_over_db,
      unidad: "", cumple: r.cb_plus_Ktr_over_db <= 2.5,
      referencia: "ACI 318-14 §25.4.2.3", critical: false,
    },
    {
      nombre: "Longitud final calculada",
      requerido: 0, disponible: r.ld_final_cm,
      unidad: "cm", cumple: r.ld_final_cm > 0,
      referencia: "ACI 318-14 §25", critical: true,
    },
  ];
}
