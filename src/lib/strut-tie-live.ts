/**
 * Strut-and-Tie — Diseño por puntales y tirantes para ménsula, viga profunda
 * y cabezal de pilotes.
 *
 * References:
 *   - ACI 318-14 §23 — Strut-and-tie method
 *   - ACI 318-14 §16.5 — Brackets and corbels (ménsulas)
 *   - ACI 318-14 §9.9 — Deep beams (vigas profundas, Ln/d < 4)
 *   - ACI 318-14 §13.4 — Pile caps (cabezales)
 *   - Schlaich, J., Schäfer, K., and Jennewein, M. (1987), "Toward a Consistent
 *     Design of Structural Concrete", PCI Journal V.32, No.3, pp. 74-150.
 *   - MacGregor, J.G. (2009), Reinforced Concrete §17.
 *   - ACI 445R-99 — Recent Approaches to Shear Design of Structural Concrete.
 *
 * For each typology computes:
 *   – Geometry (a, d, θ).
 *   – Strut capacity Fns = fce·Acs, fce = 0.85·βs·f'c (Table 23.4.3).
 *   – Tie capacity Fnt = As·fy.
 *   – Node capacity Fnn = fce·Anz, fce = 0.85·βn·f'c (Table 23.9.2).
 *   – Minimum distributed reinforcement (§23.5).
 *
 * Units: cm, kg, kg/cm², ton, ton·m.
 */
import type { CalculationStep } from "./beam-flexure-live";
import type { StudioCheck } from "@/components/studio/StudioShell";

export type TipoSTM = "corbel" | "deep_beam" | "pile_cap";

export interface StrutTieInput {
  tipo: TipoSTM;
  b_cm: number;          // ancho del elemento
  h_cm: number;          // peralte total
  d_cm: number;          // peralte efectivo
  // Corbel:
  avu_cm: number;        // proyección del corbel (distancia carga → cara columna)
  Vu_corbel_ton: number; // cortante en corbel
  Nu_corbel_ton: number; // tracción horizontal (= 0.2·Vu default)
  // Viga profunda:
  Ln_m: number;          // luz libre
  Pu_top_ton: number;    // carga puntual en parte superior (o reducir a wu·Ln)
  a_load_m: number;      // distancia desde cara apoyo al punto de aplicación
  // Pile cap:
  Pu_col_ton: number;    // carga de columna
  pile_spacing_m: number;// separación entre pilotes
  n_piles: number;       // # pilotes (2, 3, 4)
  // Materiales
  fc: number;
  fy: number;
}

export interface StrutTieResult {
  // echo
  tipo: TipoSTM; b: number; h: number; d: number;
  avu: number; Vu_corbel: number; Nu_corbel: number;
  Ln: number; Pu_top: number; a_load: number;
  Pu_col: number; pile_spacing: number; n_piles: number;
  fc: number; fy: number;

  // Modelo común
  theta_deg: number;     // ángulo del puntal con respecto a la horizontal
  L_strut_cm: number;    // longitud del puntal principal
  // Fuerzas
  F_strut_ton: number;   // fuerza axial en puntal
  F_tie_ton: number;     // fuerza axial en tirante

  // Capacidades
  fce_strut_kgcm2: number;
  beta_s: number;        // factor §23.4.3
  Acs_cm2: number;       // área del puntal (perpendicular)
  phi_Fns_ton: number;
  strut_ok: boolean;

  As_tie_req_cm2: number;
  phi_Fnt_per_cm2_ton: number;
  As_tie_provided_cm2: number; // sugerido = req con barras prácticas

  fce_node_kgcm2: number;
  beta_n: number;        // §23.9.2
  node_type: "CCC" | "CCT" | "CTT";
  Anz_cm2: number;       // área de la cara nodal
  phi_Fnn_ton: number;
  node_ok: boolean;

  // Mínimo refuerzo distribuido (§23.5)
  rho_v_min: number;
  rho_h_min: number;

  // Específicos corbel
  Avf_cm2: number;       // shear-friction (corbel)
  vu_corbel_check: boolean;

  warnings: string[];
}

const PHI_STM = 0.75;

export function computeStrutTieLive(input: StrutTieInput): StrutTieResult {
  const {
    tipo, b_cm: b, h_cm: h, d_cm: d,
    avu_cm: avu, Vu_corbel_ton: Vu_c, Nu_corbel_ton: Nu_c,
    Ln_m: Ln, Pu_top_ton: Pu_top, a_load_m: a_load,
    Pu_col_ton: Pu_col, pile_spacing_m: pile_spacing, n_piles, fc, fy,
  } = input;
  const warnings: string[] = [];

  // Geometría: theta y longitud del puntal
  const theta_deg = (function () {
    if (tipo === "corbel") return Math.atan2(d, Math.max(0.1, avu)) * 180 / Math.PI;
    if (tipo === "deep_beam") return Math.atan2(d, Math.max(0.1, a_load * 100)) * 180 / Math.PI;
    return Math.atan2(d, Math.max(0.1, (pile_spacing * 100) / 2)) * 180 / Math.PI;
  })();
  const theta_rad = theta_deg * Math.PI / 180;
  const L_strut = d / Math.max(0.001, Math.sin(theta_rad));

  if (theta_deg < 25) warnings.push("θ < 25° — geometría muy plana; ACI §23.2.7 limita θ ≥ 25°.");

  // Fuerzas: para cada tipología
  let F_strut = 0, F_tie = 0;
  // Para todos los modelos default = CCT (compresión-compresión-tracción).
  // Variable tipada como union para permitir futuras extensiones.
  let node_type_val: "CCC" | "CCT" | "CTT" = "CCT";

  if (tipo === "corbel") {
    // Fuerza vertical en puntal: F_strut·sin(θ) = Vu → F_strut = Vu/sin(θ)
    F_strut = Vu_c / Math.sin(theta_rad);
    F_tie = Vu_c * (avu / d) + Nu_c;
    node_type_val = "CCT";
  } else if (tipo === "deep_beam") {
    const a_cm = a_load * 100;
    F_strut = Pu_top / Math.sin(theta_rad);
    F_tie = Pu_top * (a_cm / d);
    node_type_val = "CCT";
  } else {
    // pile_cap: cada pilote toma Pu_col/n_piles
    const P_per_pile = Pu_col / n_piles;
    F_strut = P_per_pile / Math.sin(theta_rad);
    F_tie = P_per_pile * ((pile_spacing * 100) / 2) / d;
    node_type_val = "CCT";
  }
  const node_type: "CCC" | "CCT" | "CTT" = node_type_val;

  // Capacidad del puntal §23.4
  // βs = 0.75 para puntal con refuerzo perpendicular (Table 23.4.3 caso (d))
  // = 0.60 para botella sin refuerzo
  // = 1.0 para prismático
  const beta_s = 0.75;
  const fce_strut = 0.85 * beta_s * fc;
  // Anchura efectiva del puntal ≈ d·cos(θ) (ACI §23.4.1)
  const ws = d * Math.cos(theta_rad);
  const Acs = b * Math.max(5, ws);
  const phi_Fns = (PHI_STM * fce_strut * Acs) / 1000.0; // ton
  const strut_ok = phi_Fns >= F_strut;

  // Tirante §23.7
  const As_tie_req = F_tie * 1000 / (PHI_STM * fy);
  const phi_Fnt_per_cm2 = PHI_STM * fy / 1000.0; // ton/cm² de acero
  const As_tie_prov = As_tie_req; // recomendamos por barras prácticas en page

  // Nodo §23.9
  // βn: CCC=1.0, CCT=0.80, CTT=0.60
  let beta_n = 0.80;
  if ((node_type as string) === "CCC") beta_n = 1.0;
  else if ((node_type as string) === "CTT") beta_n = 0.60;
  const fce_node = 0.85 * beta_n * fc;
  // Área de la cara nodal — para corbel asume placa de carga ≈ b · (0.2·h)
  const Anz = b * Math.max(5, 0.2 * h);
  const phi_Fnn = (PHI_STM * fce_node * Anz) / 1000.0;
  const node_ok = phi_Fnn >= F_strut;

  // Mínimo §23.5 (deep beam) — ρv ≥ 0.0025, ρh ≥ 0.0015
  const rho_v_min = 0.0025;
  const rho_h_min = 0.0015;

  // Específico corbel — shear-friction §16.5.4
  // Avf = Vu/(φ·fy·μ), μ = 1.4·λ (monolítico), λ=1
  const mu = 1.4;
  const Avf = Vu_c * 1000 / (PHI_STM * fy * mu);

  // Limit check §16.5.2.2: Vu/(φ·b·d) ≤ min(0.2·fc, (28+0.05·fc), 11·b·d)  (SI metric)
  const vu_limit_corbel = Math.min(0.2 * fc, 28 + 0.05 * fc, 55); // kg/cm²
  const vu_actual = (b * d > 0) ? (Vu_c * 1000) / (PHI_STM * b * d) : 0;
  const vu_corbel_check = tipo !== "corbel" || vu_actual <= vu_limit_corbel;
  if (tipo === "corbel" && !vu_corbel_check)
    warnings.push("Corbel: Vu/φbd excede límite ACI §16.5.2.2. Aumentar sección.");

  if (!strut_ok) warnings.push(`Puntal insuficiente: φFns = ${phi_Fns.toFixed(1)} < ${F_strut.toFixed(1)} ton.`);
  if (!node_ok) warnings.push(`Nodo insuficiente: φFnn = ${phi_Fnn.toFixed(1)} < ${F_strut.toFixed(1)} ton.`);

  if (tipo === "deep_beam") {
    const Ld_check = (Ln * 100) / d;
    if (Ld_check >= 4)
      warnings.push("Ln/d ≥ 4 — no es viga profunda. Usar análisis de viga convencional.");
  }

  return {
    tipo, b, h, d,
    avu, Vu_corbel: Vu_c, Nu_corbel: Nu_c,
    Ln, Pu_top, a_load, Pu_col, pile_spacing, n_piles, fc, fy,
    theta_deg, L_strut_cm: L_strut,
    F_strut_ton: F_strut, F_tie_ton: F_tie,
    fce_strut_kgcm2: fce_strut, beta_s, Acs_cm2: Acs,
    phi_Fns_ton: phi_Fns, strut_ok,
    As_tie_req_cm2: As_tie_req, phi_Fnt_per_cm2_ton: phi_Fnt_per_cm2,
    As_tie_provided_cm2: As_tie_prov,
    fce_node_kgcm2: fce_node, beta_n, node_type,
    Anz_cm2: Anz, phi_Fnn_ton: phi_Fnn, node_ok,
    rho_v_min, rho_h_min,
    Avf_cm2: Avf, vu_corbel_check,
    warnings,
  };
}

export function buildStrutTieSteps(r: StrutTieResult): CalculationStep[] {
  return [
    {
      id: "strut.step_01_theta",
      name: "Geometría del modelo — ángulo θ y longitud del puntal",
      equation_latex: "\\theta = \\arctan(d/a), \\;\\; L_{strut} = d/\\sin\\theta",
      inputs: { d: r.d },
      output_var: "theta",
      output_value: r.theta_deg,
      output_unit: "°",
      code_ref: "ACI 318-14 §23.2.7 (θ ≥ 25°)",
      depends_on: [],
      note: `L puntal = ${r.L_strut_cm.toFixed(1)} cm. ${r.theta_deg >= 25 ? "OK" : "θ inadecuado"}`,
    },
    {
      id: "strut.step_02_forces",
      name: "Fuerzas en puntal y tirante",
      equation_latex: r.tipo === "corbel"
        ? "F_{strut} = V_u/\\sin\\theta, \\;\\; T = V_u (a/d) + N_u"
        : r.tipo === "deep_beam"
          ? "F_{strut} = P_u/\\sin\\theta, \\;\\; T = P_u (a/d)"
          : "F_{strut} = P_{pile}/\\sin\\theta, \\;\\; T = P_{pile} (s/2)/d",
      inputs: { theta: r.theta_deg },
      output_var: "F_strut",
      output_value: r.F_strut_ton,
      output_unit: "ton",
      code_ref: "Equilibrio del modelo STM",
      depends_on: ["strut.step_01_theta"],
      note: `T tirante = ${r.F_tie_ton.toFixed(1)} ton.`,
    },
    {
      id: "strut.step_03_strut",
      name: "Capacidad del puntal",
      equation_latex: "\\phi F_{ns} = \\phi \\cdot 0.85 \\beta_s f'_c \\cdot A_{cs}",
      inputs: { fc: r.fc, beta_s: r.beta_s, Acs: r.Acs_cm2 },
      output_var: "phiFns",
      output_value: r.phi_Fns_ton,
      output_unit: "ton",
      code_ref: "ACI 318-14 §23.4.1, Table 23.4.3",
      depends_on: ["strut.step_02_forces"],
      note: `${r.strut_ok ? "OK" : "FALLA"} vs F_strut = ${r.F_strut_ton.toFixed(1)} ton.`,
    },
    {
      id: "strut.step_04_tie",
      name: "Acero del tirante",
      equation_latex: "A_{s,tie} = \\frac{T}{\\phi f_y}",
      inputs: { T: r.F_tie_ton, fy: r.fy },
      output_var: "As_tie",
      output_value: r.As_tie_req_cm2,
      output_unit: "cm²",
      code_ref: "ACI 318-14 §23.7.2",
      depends_on: ["strut.step_02_forces"],
      note: "Anclaje del tirante: longitud de desarrollo completa desde la cara interior del nodo.",
    },
    {
      id: "strut.step_05_node",
      name: "Capacidad del nodo",
      equation_latex: "\\phi F_{nn} = \\phi \\cdot 0.85 \\beta_n f'_c \\cdot A_{nz}",
      inputs: { fc: r.fc, beta_n: r.beta_n, Anz: r.Anz_cm2 },
      output_var: "phiFnn",
      output_value: r.phi_Fnn_ton,
      output_unit: "ton",
      code_ref: "ACI 318-14 §23.9, Table 23.9.2",
      depends_on: ["strut.step_03_strut"],
      note: `Tipo de nodo: ${r.node_type} (βn = ${r.beta_n}). ${r.node_ok ? "OK" : "FALLA"}.`,
    },
    {
      id: "strut.step_06_min",
      name: "Refuerzo distribuido mínimo",
      equation_latex: "\\rho_v \\ge 0.0025, \\;\\; \\rho_h \\ge 0.0015",
      inputs: {},
      output_var: "rho_min",
      output_value: r.rho_v_min,
      output_unit: "",
      code_ref: "ACI 318-14 §23.5",
      depends_on: [],
      note: "Malla en ambas caras para vigas profundas y ménsulas.",
    },
    ...(r.tipo === "corbel" ? [{
      id: "strut.step_07_corbel_Avf",
      name: "Refuerzo de corte por fricción (ménsula)",
      equation_latex: "A_{vf} = \\frac{V_u}{\\phi f_y \\mu}",
      inputs: { Vu: r.Vu_corbel, fy: r.fy },
      output_var: "Avf",
      output_value: r.Avf_cm2,
      output_unit: "cm²",
      code_ref: "ACI 318-14 §16.5 + §22.9",
      depends_on: [],
      note: `μ = 1.4·λ (monolítico). Adicional al tirante principal.`,
    }] : []),
  ];
}

export function buildStrutTieChecks(r: StrutTieResult): StudioCheck[] {
  const checks: StudioCheck[] = [
    {
      nombre: "Puntal: φFns ≥ F_strut",
      requerido: r.F_strut_ton,
      disponible: r.phi_Fns_ton,
      unidad: "ton",
      cumple: r.strut_ok,
      referencia: "ACI 318-14 §23.4",
      critical: true,
    },
    {
      nombre: `Nodo ${r.node_type}: φFnn ≥ F_strut`,
      requerido: r.F_strut_ton,
      disponible: r.phi_Fnn_ton,
      unidad: "ton",
      cumple: r.node_ok,
      referencia: "ACI 318-14 §23.9",
      critical: true,
    },
    {
      nombre: "θ del puntal ≥ 25°",
      requerido: 25,
      disponible: r.theta_deg,
      unidad: "°",
      cumple: r.theta_deg >= 25,
      referencia: "ACI 318-14 §23.2.7",
      critical: true,
    },
  ];
  if (r.tipo === "corbel") {
    checks.push({
      nombre: "Corbel — Vu/(φbd) dentro de límites",
      requerido: 1,
      disponible: r.vu_corbel_check ? 1 : 0,
      unidad: "",
      cumple: r.vu_corbel_check,
      referencia: "ACI 318-14 §16.5.2.2",
      critical: true,
    });
  }
  return checks;
}
