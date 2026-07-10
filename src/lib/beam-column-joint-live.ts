/**
 * Beam-Column Joint Design — Conexión viga-columna ductil.
 *
 * References:
 *   - ACI 318-14 §18.7.3 (Strong-column-weak-beam)
 *   - ACI 318-14 §18.8 (Joints of special moment frames)
 *   - ACI 352R-02 (Recommendations for beam-column joints)
 *   - CSCR-10 Rev. 2014 §8.6 (Conexiones viga-columna)
 *
 * Procedure:
 *   1. Strong-column-weak-beam:  ΣMn_col  ≥  (6/5) · ΣMn_beam   [ACI 18.7.3.2]
 *   2. Beam tensile force (overstrength):  T = α·As·fy  (α = 1.25)
 *   3. Joint shear demand:  Vj = T_top + C_bot − V_col
 *   4. Effective joint width bj  per ACI 18.8.4
 *   5. γ factor (15 for confined-by-4-beams, 12 for 3 sides, 8 perimeter)
 *   6. Joint shear capacity:  φVn = φ · γ · √f'c[psi] · Aj   [kips → tonf]
 *   7. Check Vu_joint ≤ φVn  and require transverse reinforcement continuity.
 *
 * Units: cm, kg, kg/cm². f'c is converted to psi via × 14.22 inside the
 * √f'c term (then result returned in tonf). All inputs are echoed in result.
 */
import type { CalculationStep } from "./beam-flexure-live";

export type JointType = "interior" | "exterior" | "corner";

export interface BeamColumnJointInput {
  // Column section (cm)
  bc: number;             // ancho columna
  hc: number;             // profundidad columna (dirección de la viga)
  // Beam reinforcement at the joint (cm²)
  As_top: number;         // Acero superior de viga(s) convergente(s)
  As_bot: number;         // Acero inferior
  bw_beam: number;        // ancho de la viga (para bj)
  // Approximate column flexural strength sum, ton·m (analysis or pre-computed)
  SumMn_col_tonm: number; // ΣMn de columnas que llegan al nudo
  // Beam flexural strength sum if asked directly
  SumMn_beam_tonm: number;
  // Column shear above the joint, ton (from frame analysis)
  Vcol_ton: number;
  // Joint geometry
  jointType: JointType;
  confinedSides: 2 | 3 | 4;  // # of beam sides framing (≥0.75·bc width each)
  // Materials
  fc: number;             // kg/cm²
  fy: number;             // kg/cm²
  zona: 1 | 2 | 3 | 4;
}

export interface BeamColumnJointLiveResult {
  // echo
  bc: number; hc: number;
  As_top: number; As_bot: number; bw_beam: number;
  SumMn_col_tonm: number; SumMn_beam_tonm: number;
  Vcol_ton: number;
  jointType: JointType;
  confinedSides: number;
  fc: number; fy: number; zona: number;

  // Step results
  ratio_SCWB: number;          // ΣMn_col / ΣMn_beam
  ratio_SCWB_required: number; // 1.20
  scwb_pass: boolean;

  alpha_overstrength: number;  // 1.25
  T_top: number;               // ton
  T_bot: number;               // ton (treated as compression resultant for interior joint)
  Vj_demand: number;           // ton — joint shear demand
  bj: number;                  // cm
  Aj: number;                  // cm² = bj · hc
  gamma: number;               // 15/12/8 (psi convention)
  phi_joint: number;           // 0.85
  fc_psi: number;              // f'c converted to psi
  phi_Vn_joint: number;        // ton — joint shear capacity
  shear_pass: boolean;

  // Transverse reinforcement requirement passthrough (informational)
  s_max_joint_cm: number;      // separación máxima en el nudo (cm)
  Ash_required_note: string;

  warnings: string[];
}

const PSI_PER_KGCM2 = 14.22;

export function computeBeamColumnJointLive(
  input: BeamColumnJointInput,
): BeamColumnJointLiveResult {
  const {
    bc, hc, As_top, As_bot, bw_beam,
    SumMn_col_tonm, SumMn_beam_tonm, Vcol_ton,
    jointType, confinedSides, fc, fy, zona,
  } = input;
  const warnings: string[] = [];

  // ---- 1. Strong-column-weak-beam ----
  const ratio_required = 6 / 5; // 1.20
  const ratio = SumMn_beam_tonm > 0
    ? SumMn_col_tonm / SumMn_beam_tonm
    : Number.POSITIVE_INFINITY;
  const scwb_pass = ratio >= ratio_required;
  if (!scwb_pass) {
    warnings.push(
      `Columna débil — ΣMn_col/ΣMn_beam = ${ratio.toFixed(2)} < 1.20. ` +
      `Aumentar columna o reducir refuerzo de viga (ACI §18.7.3.2).`,
    );
  }

  // ---- 2. Beam tensile force with overstrength α = 1.25 ----
  const alpha = 1.25;
  // T = α·As·fy → convert kg to ton (÷ 1000)
  const T_top = (alpha * As_top * fy) / 1000;
  const T_bot = (alpha * As_bot * fy) / 1000;

  // ---- 3. Joint shear demand ----
  // Interior joint: Vj = T_top + C_bot − Vcol; for C_bot use T_bot (equilibrium
  // of an interior beam with both sides framing). Exterior joint: only one
  // beam frames → use only T_top (bottom bars typically hooked-developed and
  // contribute compression that cancels with column shear partially).
  let Vj: number;
  if (jointType === "interior") {
    Vj = T_top + T_bot - Vcol_ton;
  } else {
    // exterior / corner: only the framing beam side contributes
    Vj = T_top - Vcol_ton;
  }
  if (Vj < 0) Vj = 0;

  // ---- 4. Effective joint width bj (ACI 18.8.4) ----
  // bj = min{ bc, bw_beam + hc, bw_beam + 2·x } — simplified: take
  // bj = min(bc, bw_beam + hc). Conservative and common in practice.
  const bj = Math.min(bc, bw_beam + hc);
  const Aj = bj * hc;

  // ---- 5. γ factor (ACI 18.8.4.1) ----
  // 4 sides confined → γ = 20 (with f'c in psi), 3 sides → 15, others → 12.
  // CSCR/ACI usual values:
  //   20 — confined by beams on all 4 vertical faces
  //   15 — confined on 3 faces or 2 opposite faces
  //   12 — others (corner, exterior)
  let gamma: number;
  if (confinedSides >= 4) gamma = 20;
  else if (confinedSides === 3) gamma = 15;
  else gamma = 12;

  // Override for joint type (exterior/corner default reduces gamma)
  if (jointType === "corner" && gamma > 12) gamma = 12;
  if (jointType === "exterior" && gamma > 15) gamma = 15;

  // ---- 6. Joint shear capacity ----
  const phi_joint = 0.85;
  const fc_psi = fc * PSI_PER_KGCM2;
  // φVn = φ · γ · √f'c[psi] · Aj[in²] ... convert:
  // Aj is cm². Use the consistent kg/cm² form:
  //   φVn [kg] = φ · γ · √f'c[psi] · Aj[cm²] · 0.0703  (lb/in² → kg/cm² area)
  // Cleaner: keep psi+in² and convert capacity to ton.
  // 1 in² = 6.4516 cm² ; 1 lb = 0.4536 kg
  const Aj_in2 = Aj / 6.4516;
  const Vn_lb = gamma * Math.sqrt(fc_psi) * Aj_in2;
  const Vn_ton = (Vn_lb * 0.4536) / 1000;
  const phi_Vn_joint = phi_joint * Vn_ton;
  const shear_pass = Vj <= phi_Vn_joint;
  if (!shear_pass) {
    warnings.push(
      `Vj = ${Vj.toFixed(1)} ton > φVn = ${phi_Vn_joint.toFixed(1)} ton — ` +
      `nudo insuficiente. Aumentar columna o concreto de mayor f'c.`,
    );
  }

  // ---- 7. Transverse reinforcement note ----
  // ACI 18.8.3 — the column hinge zone Ash and spacing requirements must
  // continue through the joint. s ≤ min(6db_long, 150 mm) is typical.
  const s_max_joint_cm = 15.0; // conservative simplification
  const Ash_required_note =
    "Ash y separación del confinamiento de columna (ACI §18.7.5) deben " +
    "continuar a través del nudo (ACI §18.8.3).";

  if (zona >= 3) {
    warnings.push("Zona sísmica ≥ III: el nudo requiere detallado dúctil completo (ganchos 135°, traslapes fuera del nudo).");
  }

  return {
    bc, hc, As_top, As_bot, bw_beam,
    SumMn_col_tonm, SumMn_beam_tonm, Vcol_ton,
    jointType, confinedSides, fc, fy, zona,
    ratio_SCWB: ratio, ratio_SCWB_required: ratio_required, scwb_pass,
    alpha_overstrength: alpha, T_top, T_bot,
    Vj_demand: Vj, bj, Aj, gamma,
    phi_joint, fc_psi, phi_Vn_joint, shear_pass,
    s_max_joint_cm, Ash_required_note,
    warnings,
  };
}

export function buildBeamColumnJointSteps(
  r: BeamColumnJointLiveResult,
): CalculationStep[] {
  return [
    {
      id: "joint.step_01_scwb",
      name: "Columna fuerte, viga débil (Strong-Column-Weak-Beam)",
      equation_latex:
        "\\frac{\\sum M_{n,col}}{\\sum M_{n,beam}} \\;\\geq\\; \\frac{6}{5}",
      inputs: {
        SumMn_col: r.SumMn_col_tonm,
        SumMn_beam: r.SumMn_beam_tonm,
      },
      output_var: "ratio",
      output_value: r.ratio_SCWB,
      output_unit: "",
      code_ref: "ACI 318-14 §18.7.3.2",
      depends_on: [],
      note: r.scwb_pass
        ? "OK — la columna es más fuerte que la viga; rótula plástica se forma en la viga."
        : "FALLA — la columna se rotula primero. Aumentar refuerzo o sección.",
    },
    {
      id: "joint.step_02_overstrength",
      name: "Fuerza de tracción en barras con sobreresistencia",
      equation_latex:
        "T = \\alpha \\cdot A_s \\cdot f_y, \\quad \\alpha = 1.25",
      inputs: {
        alpha: r.alpha_overstrength,
        As_top: r.As_top,
        As_bot: r.As_bot,
        fy: r.fy,
      },
      output_var: "T_top",
      output_value: r.T_top,
      output_unit: "ton",
      code_ref: "ACI 318-14 §18.8.2.1",
      depends_on: [],
      note: `T_top = ${r.T_top.toFixed(2)} ton, T_bot = ${r.T_bot.toFixed(2)} ton. ` +
        `Se aplica α = 1.25 al fy para considerar sobreresistencia del acero.`,
    },
    {
      id: "joint.step_03_Vj",
      name: "Cortante de demanda en el nudo",
      equation_latex: r.jointType === "interior"
        ? "V_j = T_{top} + T_{bot} - V_{col}"
        : "V_j = T_{top} - V_{col}",
      inputs: { T_top: r.T_top, T_bot: r.T_bot, Vcol: r.Vcol_ton },
      output_var: "Vj",
      output_value: r.Vj_demand,
      output_unit: "ton",
      code_ref: "ACI 318-14 §18.8.2",
      depends_on: ["joint.step_02_overstrength"],
      note: r.jointType === "interior"
        ? "Nudo interior: ambas vigas contribuyen tracción y compresión."
        : "Nudo exterior/esquinero: sólo una viga llega al nudo.",
    },
    {
      id: "joint.step_04_bj",
      name: "Ancho efectivo del nudo",
      equation_latex: "b_j = \\min(b_c,\\; b_{w,viga} + h_c)",
      inputs: { bc: r.bc, bw_viga: r.bw_beam, hc: r.hc },
      output_var: "bj",
      output_value: r.bj,
      output_unit: "cm",
      code_ref: "ACI 318-14 §18.8.4",
      depends_on: [],
      note: "",
    },
    {
      id: "joint.step_05_Aj",
      name: "Área efectiva del nudo",
      equation_latex: "A_j = b_j \\cdot h_c",
      inputs: { bj: r.bj, hc: r.hc },
      output_var: "Aj",
      output_value: r.Aj,
      output_unit: "cm²",
      code_ref: "ACI 318-14 §18.8.4",
      depends_on: ["joint.step_04_bj"],
      note: "",
    },
    {
      id: "joint.step_06_gamma",
      name: "Factor γ por confinamiento del nudo",
      equation_latex:
        "\\gamma = 20\\;(4\\text{ lados}),\\; 15\\;(3),\\; 12\\;(2\\text{ o menos})",
      inputs: { confinedSides: r.confinedSides },
      output_var: "gamma",
      output_value: r.gamma,
      output_unit: "",
      code_ref: "ACI 318-14 §18.8.4.1",
      depends_on: [],
      note: `Nudo ${r.jointType}, ${r.confinedSides} lados confinados → γ = ${r.gamma}.`,
    },
    {
      id: "joint.step_07_phi_Vn",
      name: "Capacidad nominal de cortante del nudo",
      equation_latex:
        "\\phi V_n = \\phi \\cdot \\gamma \\cdot \\sqrt{f'_c\\,[psi]} \\cdot A_j",
      inputs: {
        phi: r.phi_joint,
        gamma: r.gamma,
        fc_psi: r.fc_psi,
        Aj: r.Aj,
      },
      output_var: "phi_Vn",
      output_value: r.phi_Vn_joint,
      output_unit: "ton",
      code_ref: "ACI 318-14 §18.8.4.1, §22.5",
      depends_on: ["joint.step_05_Aj", "joint.step_06_gamma"],
      note: `f'c = ${r.fc} kg/cm² × 14.22 = ${r.fc_psi.toFixed(0)} psi.`,
    },
    {
      id: "joint.step_08_check",
      name: "Verificación de cortante",
      equation_latex: "V_j \\;\\leq\\; \\phi V_n",
      inputs: { Vj: r.Vj_demand, phi_Vn: r.phi_Vn_joint },
      output_var: "shear_ratio",
      output_value: r.phi_Vn_joint > 0 ? r.Vj_demand / r.phi_Vn_joint : 0,
      output_unit: "",
      code_ref: "ACI 318-14 §18.8.4.3",
      depends_on: ["joint.step_03_Vj", "joint.step_07_phi_Vn"],
      note: r.shear_pass ? "OK" : "FALLA — rediseñar nudo.",
    },
  ];
}

export function buildBeamColumnJointChecks(r: BeamColumnJointLiveResult) {
  return [
    {
      nombre: "Columna fuerte / Viga débil (≥ 1.20)",
      requerido: r.ratio_SCWB_required,
      disponible: isFinite(r.ratio_SCWB) ? r.ratio_SCWB : 999,
      unidad: "",
      cumple: r.scwb_pass,
      referencia: "ACI 318-14 §18.7.3.2",
      critical: true,
    },
    {
      nombre: "Cortante del nudo Vj ≤ φVn",
      requerido: r.Vj_demand,
      disponible: r.phi_Vn_joint,
      unidad: "ton",
      cumple: r.shear_pass,
      referencia: "ACI 318-14 §18.8.4",
      critical: true,
    },
    {
      nombre: "Confinamiento continuo a través del nudo",
      requerido: r.s_max_joint_cm,
      disponible: r.s_max_joint_cm,
      unidad: "cm",
      cumple: true,
      referencia: "ACI 318-14 §18.8.3",
      critical: false,
    },
  ];
}
