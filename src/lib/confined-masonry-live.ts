/**
 * Confined Masonry — Mampostería confinada (muros de bloque con columnas
 * y vigas de confinamiento).
 *
 * References:
 *   - CSCR-10 Rev. 2014, Capítulo 10 (Mampostería confinada)
 *   - INTE C5:2014 — Mampostería de concreto en CR
 *   - NTM (Normas Técnicas Mampostería, CFIA)
 *   - TMS 402-13 / ACI 530 — Masonry Standards Joint Committee (referencia)
 *   - MOC 2008 (México) — analogía adicional para confinamiento
 *
 * Procedure (CSCR-10 §10):
 *   1. Esbeltez:   t/H ≤ 25 (relación espesor/altura).
 *   2. Cortante admisible:
 *        V_m = 0.25 · √f'_m · t · L          (kg, con f'_m en kg/cm²)
 *      Verificar V_sismico ≤ φ · V_m  (φ = 0.6 mampostería).
 *   3. Compresión:
 *        f_a = P_u / (t · L) ≤ 0.20 · f'_m   (§10.5)
 *   4. Confinamiento mínimo:
 *        – Columna: ≥ 15×15 cm, 4 #4 + estribos #2 @ 20 cm.
 *        – Separación entre columnas: ≤ min(4 m, 25·t).
 *        – Viga corona obligatoria por nivel; solera intermedia si H > 3.5 m.
 *   5. Refuerzo horizontal (zona sísmica III/IV):
 *        2 #3 cada 60 cm de altura (CSCR §10.6.2).
 *
 * Units: cm, kg, kg/cm², ton. f'_m en MPa convertido internamente a kg/cm².
 */
import type { CalculationStep } from "./beam-flexure-live";

export interface ConfinedMasonryInput {
  fm_MPa: number;        // resistencia del bloque (típico 7.5–13.5 MPa)
  t_cm: number;          // espesor de pared (10/12/15/20)
  H_m: number;           // altura del muro
  L_m: number;           // longitud del muro
  // Columnas de confinamiento
  b_col_cm: number;      // ancho columna confinamiento
  h_col_cm: number;      // peralte
  s_conf_m: number;      // separación entre columnas
  // Viga corona
  b_vc_cm: number;
  h_vc_cm: number;
  // Cargas
  V_sismico_ton: number;
  Pu_axial_ton: number;
  // Configuración
  zona: 1 | 2 | 3 | 4;
  num_pisos: number;
}

export interface ConfinedMasonryLiveResult {
  // echo
  fm_MPa: number; fm_kgcm2: number; t: number; H: number; L: number;
  b_col: number; h_col: number; s_conf: number;
  b_vc: number; h_vc: number;
  V_sismico: number; Pu_axial: number;
  zona: number; num_pisos: number;

  // Verificaciones
  slenderness_ratio: number;   // H/t (forma actual del check)
  slenderness_ok: boolean;     // H/t ≤ 25
  // CSCR §10.4 — cortante
  V_m_ton: number;             // V admisible del muro
  phi_masonry: number;         // 0.6
  phi_Vm_ton: number;
  shear_ok: boolean;
  // CSCR §10.5 — compresión axial
  fa_kgcm2: number;            // P/(t·L)
  fa_limit_kgcm2: number;      // 0.20·f'm
  compression_ok: boolean;
  // Espaciamiento confinamiento
  s_max_conf_m: number;        // min(4 m, 25·t)
  s_conf_ok: boolean;
  // Refuerzo horizontal
  s_horiz_required_cm: number; // 60 si zona III/IV
  needs_horiz_reinf: boolean;
  // Solera intermedia
  needs_intermediate_beam: boolean;

  warnings: string[];
}

const MPA_TO_KGCM2 = 10.197;

export function computeConfinedMasonryLive(
  input: ConfinedMasonryInput,
): ConfinedMasonryLiveResult {
  const {
    fm_MPa, t_cm: t, H_m: H, L_m: L,
    b_col_cm: b_col, h_col_cm: h_col, s_conf_m: s_conf,
    b_vc_cm: b_vc, h_vc_cm: h_vc,
    V_sismico_ton: Vs, Pu_axial_ton: Pu,
    zona, num_pisos,
  } = input;
  const warnings: string[] = [];

  const fm_kgcm2 = fm_MPa * MPA_TO_KGCM2;

  // 1. Esbeltez — CSCR §10.3: H/t ≤ 25
  const Hcm = H * 100;
  const sl = Hcm / t;
  const slenderness_ok = sl <= 25;
  if (!slenderness_ok) {
    warnings.push(
      `Esbeltez H/t = ${sl.toFixed(1)} > 25. Reforzar con núcleos confinados adicionales o aumentar t.`,
    );
  }

  // 2. Cortante admisible — CSCR §10.4
  //    V_m = 0.25 · √f'_m · t · L  (kg, con dimensiones en cm)
  const sqrt_fm = Math.sqrt(fm_kgcm2);
  const V_m_kg = 0.25 * sqrt_fm * t * L * 100;
  const V_m_ton = V_m_kg / 1000;
  const phi_m = 0.6;
  const phi_Vm = phi_m * V_m_ton;
  const shear_ok = Vs <= phi_Vm;
  if (!shear_ok) {
    warnings.push(
      `V sísmico ${Vs.toFixed(2)} > φVm ${phi_Vm.toFixed(2)} ton. ` +
      `Reforzar con malla electrosoldada (TMS 402) o aumentar f'_m / t.`,
    );
  }

  // 3. Compresión axial — CSCR §10.5
  //    f_a = Pu / (t·L), límite 0.20 · f'_m
  const Pu_kg = Pu * 1000;
  const fa = Pu_kg / (t * L * 100); // kg/cm²
  const fa_limit = 0.20 * fm_kgcm2;
  const compression_ok = fa <= fa_limit;
  if (!compression_ok) {
    warnings.push(
      `f_a = ${fa.toFixed(2)} > 0.20·f'm = ${fa_limit.toFixed(2)} kg/cm². ` +
      `Aumentar espesor o usar mampostería reforzada.`,
    );
  }

  // 4. Espaciamiento de confinamiento — min(4 m, 25·t)
  const s_max_m = Math.min(4, (25 * t) / 100);
  const s_conf_ok = s_conf <= s_max_m;
  if (!s_conf_ok) {
    warnings.push(
      `Separación columnas confinamiento ${s_conf.toFixed(2)} m > ${s_max_m.toFixed(2)} m. ` +
      `Agregar columnas intermedias.`,
    );
  }

  // 5. Sección mínima de columna de confinamiento
  if (b_col < 15 || h_col < 15) {
    warnings.push("Columna de confinamiento debe ser ≥ 15×15 cm (CSCR §10.6.1).");
  }
  if (b_vc < 15 || h_vc < 15) {
    warnings.push("Viga corona debe ser ≥ 15×15 cm.");
  }

  // 6. Refuerzo horizontal (CSCR §10.6.2 zona III/IV)
  const needs_horiz_reinf = zona >= 3;
  const s_horiz_required_cm = needs_horiz_reinf ? 60 : 0;
  if (needs_horiz_reinf) {
    warnings.push("Zona sísmica III/IV: agregar 2 #3 cada 60 cm de altura en mortero (CSCR §10.6.2).");
  }

  // 7. Solera intermedia si H > 3.5 m
  const needs_intermediate_beam = H > 3.5;
  if (needs_intermediate_beam) {
    warnings.push("H > 3.5 m: colocar solera intermedia entre piso y viga corona.");
  }

  if (num_pisos >= 3) {
    warnings.push("≥ 3 pisos: verificar cortante basal acumulado y refuerzo del primer nivel.");
  }

  return {
    fm_MPa, fm_kgcm2, t, H, L,
    b_col, h_col, s_conf,
    b_vc, h_vc,
    V_sismico: Vs, Pu_axial: Pu, zona, num_pisos,
    slenderness_ratio: sl, slenderness_ok,
    V_m_ton, phi_masonry: phi_m, phi_Vm_ton: phi_Vm, shear_ok,
    fa_kgcm2: fa, fa_limit_kgcm2: fa_limit, compression_ok,
    s_max_conf_m: s_max_m, s_conf_ok,
    s_horiz_required_cm, needs_horiz_reinf,
    needs_intermediate_beam,
    warnings,
  };
}

export function buildConfinedMasonrySteps(r: ConfinedMasonryLiveResult): CalculationStep[] {
  return [
    {
      id: "masonry.step_01_fm", name: "Resistencia f'_m (conversión a kg/cm²)",
      equation_latex: "f'_m = f'_{m,MPa} \\cdot 10.197",
      inputs: { fm_MPa: r.fm_MPa },
      output_var: "fm_kgcm2", output_value: r.fm_kgcm2, output_unit: "kg/cm²",
      code_ref: "INTE C5:2014", depends_on: [],
      note: "1 MPa = 10.197 kg/cm².",
    },
    {
      id: "masonry.step_02_slenderness", name: "Esbeltez del muro",
      equation_latex: "\\frac{H}{t} \\leq 25",
      inputs: { H: r.H, t: r.t },
      output_var: "H/t", output_value: r.slenderness_ratio, output_unit: "",
      code_ref: "CSCR-10 §10.3", depends_on: [],
      note: r.slenderness_ok ? "OK" : "FALLA — aumentar t o agregar confinamiento.",
    },
    {
      id: "masonry.step_03_Vm", name: "Cortante admisible del muro",
      equation_latex: "V_m = 0.25 \\sqrt{f'_m} \\cdot t \\cdot L",
      inputs: { fm: r.fm_kgcm2, t: r.t, L: r.L },
      output_var: "V_m", output_value: r.V_m_ton, output_unit: "ton",
      code_ref: "CSCR-10 §10.4", depends_on: ["masonry.step_01_fm"],
      note: `√f'm = ${Math.sqrt(r.fm_kgcm2).toFixed(2)} (kg/cm²)^0.5.`,
    },
    {
      id: "masonry.step_04_phiVm", name: "Cortante reducido φV_m",
      equation_latex: "\\phi V_m = \\phi \\cdot V_m, \\quad \\phi = 0.6",
      inputs: { phi: r.phi_masonry, V_m: r.V_m_ton },
      output_var: "phi_Vm", output_value: r.phi_Vm_ton, output_unit: "ton",
      code_ref: "CSCR-10 §10.4.1", depends_on: ["masonry.step_03_Vm"],
      note: r.shear_ok ? "OK — V_sismico ≤ φV_m" : "FALLA — reforzar el muro.",
    },
    {
      id: "masonry.step_05_fa", name: "Esfuerzo axial",
      equation_latex: "f_a = \\frac{P_u}{t \\cdot L}",
      inputs: { Pu: r.Pu_axial, t: r.t, L: r.L },
      output_var: "f_a", output_value: r.fa_kgcm2, output_unit: "kg/cm²",
      code_ref: "CSCR-10 §10.5", depends_on: [],
      note: `Límite = 0.20·f'm = ${r.fa_limit_kgcm2.toFixed(2)} kg/cm².`,
    },
    {
      id: "masonry.step_06_s_conf", name: "Separación máxima entre confinamientos",
      equation_latex: "s_{max} = \\min(4\\,\\text{m},\\; 25 t)",
      inputs: { t: r.t },
      output_var: "s_max", output_value: r.s_max_conf_m, output_unit: "m",
      code_ref: "CSCR-10 §10.6.1", depends_on: [],
      note: r.s_conf_ok ? "OK" : "FALLA — agregar columna intermedia.",
    },
    {
      id: "masonry.step_07_horiz", name: "Refuerzo horizontal (zona sísmica)",
      equation_latex: "2\\,\\#3 \\;\\text{cada}\\; 60\\,\\text{cm}\\;\\text{de altura}",
      inputs: { zona: r.zona },
      output_var: "s_horiz", output_value: r.s_horiz_required_cm, output_unit: "cm",
      code_ref: "CSCR-10 §10.6.2", depends_on: [],
      note: r.needs_horiz_reinf ? "Obligatorio zona III/IV." : "No exigido zona ≤ II.",
    },
    {
      id: "masonry.step_08_intermediate", name: "Solera intermedia (si H > 3.5 m)",
      equation_latex: "H > 3.5\\,\\text{m} \\Rightarrow \\text{solera intermedia obligatoria}",
      inputs: { H: r.H },
      output_var: "needs_solera", output_value: r.needs_intermediate_beam ? 1 : 0,
      output_unit: "", code_ref: "CSCR-10 §10.6.3", depends_on: [],
      note: r.needs_intermediate_beam ? "Sí — colocar solera." : "No requerida.",
    },
  ];
}

export function buildConfinedMasonryChecks(r: ConfinedMasonryLiveResult) {
  return [
    {
      nombre: "Esbeltez H/t ≤ 25",
      requerido: 25, disponible: r.slenderness_ratio,
      unidad: "", cumple: r.slenderness_ok,
      referencia: "CSCR-10 §10.3", critical: true,
    },
    {
      nombre: "Cortante: V_s ≤ φV_m",
      requerido: r.V_sismico, disponible: r.phi_Vm_ton,
      unidad: "ton", cumple: r.shear_ok,
      referencia: "CSCR-10 §10.4", critical: true,
    },
    {
      nombre: "Compresión: f_a ≤ 0.20·f'_m",
      requerido: r.fa_limit_kgcm2, disponible: r.fa_kgcm2,
      unidad: "kg/cm²", cumple: r.compression_ok,
      referencia: "CSCR-10 §10.5", critical: true,
    },
    {
      nombre: "Separación confinamientos ≤ min(4 m, 25·t)",
      requerido: r.s_max_conf_m, disponible: r.s_conf,
      unidad: "m", cumple: r.s_conf_ok,
      referencia: "CSCR-10 §10.6.1", critical: true,
    },
    {
      nombre: "Refuerzo horizontal (zona III/IV)",
      requerido: r.needs_horiz_reinf ? 1 : 0,
      disponible: r.needs_horiz_reinf ? 1 : 0,
      unidad: "", cumple: true,
      referencia: "CSCR-10 §10.6.2", critical: false,
    },
    {
      nombre: "Solera intermedia si H > 3.5 m",
      requerido: r.needs_intermediate_beam ? 1 : 0,
      disponible: r.needs_intermediate_beam ? 1 : 0,
      unidad: "", cumple: true,
      referencia: "CSCR-10 §10.6.3", critical: false,
    },
  ];
}
