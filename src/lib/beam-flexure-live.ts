/**
 * TypeScript port of the 15-step beam flexure procedure.
 *
 * Mirrors `D:\Projects\costaplanner\skills\costa-rica-structural\python_port\
 * flexure.py:design_flexure` + `build_flexure_steps` exactly. This is the
 * Live-mode calculator for the Beam Studio walkthrough — user edits any
 * input, the entire 19-step list recomputes in <16 ms in the browser.
 *
 * A parity test in `beam-flexure-live.test.ts` runs the same inputs through
 * Python (via a golden file) and asserts byte-equal numeric output (within
 * 1e-9). If math here drifts from the canonical Python engine, that test
 * fails and the build refuses to ship.
 *
 * Codes referenced:
 *   CSCR-10 Rev. 2014 §8 (flexion en vigas)
 *   ACI 318-14 §9, §22.2.2
 *   INTE C85:2017 (concrete class by zone)
 */

// @lat: [[lat.md\codigo\vigas#Vigas#Diseno de flexion]]
// @lat: [[lat.md\codigo\vigas#Vigas#Predimensionado de viga]]

// ---------------------------------------------------------------------------
// Material helpers — ports of materials.py
// ---------------------------------------------------------------------------

/** ACI 318-14 §22.2.2.4.3 — equivalent rectangular stress block factor. */
export function beta1(fc: number): number {
  if (fc <= 280) return 0.85;
  if (fc >= 560) return 0.65;
  return 0.85 - (0.05 * (fc - 280)) / 70;
}

/** Balanced reinforcement ratio (ACI). */
export function rhoBalanceado(fc: number, fy: number): number {
  return (0.85 * beta1(fc) * (fc / fy) * 6120.0) / (6120.0 + fy);
}

/** Max rho for tension-controlled section (eps_t >= 0.005). */
export function rhoMax(fc: number, fy: number): number {
  return 0.375 * rhoBalanceado(fc, fy);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlexureInput {
  b: number;        // ancho cm
  d: number;        // peralte efectivo cm
  h: number;        // peralte total cm
  Mu_tonm: number;  // momento ultimo ton-m
  fc: number;       // f'c kg/cm^2
  fy: number;       // fy kg/cm^2
}

export interface FlexureLiveResult {
  // Inputs echoed
  b: number;
  d: number;
  h: number;
  Mu_tonm: number;
  fc: number;
  fy: number;

  // 15 design steps
  Mu_kgcm: number;
  phi: number;
  phi_bd2: number;
  Rn: number;
  m: number;
  arg: number;
  one_minus_arg: number;
  sqrt_term: number;
  rho_req: number;
  As_req: number;
  As_min_flex_1: number;
  As_min_flex_2: number;
  As_min_flex: number;
  As_min_temp: number;
  As_diseno: number;

  // Verification
  rho_diseno: number;
  rho_max_val: number;
  beta1: number;
  c_na: number;
  eps_s: number;
  tension_controlled: boolean;

  // Flags
  requires_doubly: boolean;
  error: string | null;
}

export interface CalculationStep {
  id: string;
  name: string;
  equation_latex: string;
  inputs: Record<string, number>;
  output_var: string;
  output_value: number;
  output_unit: string;
  code_ref: string;
  depends_on: string[];
  note: string;
}

// ---------------------------------------------------------------------------
// computeBeamFlexureLive — port of design_flexure
// ---------------------------------------------------------------------------

export function computeBeamFlexureLive(input: FlexureInput): FlexureLiveResult {
  const { b, d, h, Mu_tonm, fc, fy } = input;

  // Step 1
  const Mu_kgcm = Mu_tonm * 100_000.0;

  // Step 2
  const phi = 0.9;

  // Step 3
  const phi_bd2 = phi * b * d * d;

  // Step 4
  const Rn = phi_bd2 > 0 ? Mu_kgcm / phi_bd2 : 0;

  // Step 5
  const m = fy / (0.85 * fc);

  // Step 6
  const arg = (2.0 * m * Rn) / fy;

  // Step 7
  const one_minus = 1.0 - arg;

  let requires_doubly = false;
  let error: string | null = null;
  let sqrt_term = 0;
  let rho_req = 0;
  let As_req = 0;

  if (one_minus < 0) {
    requires_doubly = true;
    error =
      "Seccion no puede ser singly reinforced. Aumentar d o usar doble refuerzo.";
  } else {
    // Step 8
    sqrt_term = Math.sqrt(one_minus);
    // Step 9
    rho_req = (1.0 / m) * (1.0 - sqrt_term);
    // Step 10
    As_req = rho_req * b * d;
  }

  // Steps 11-13
  const As_min_flex_1 = (14.0 / fy) * b * d;
  const As_min_flex_2 = ((0.79 * Math.sqrt(fc)) / fy) * b * d;
  const As_min_flex = Math.max(As_min_flex_1, As_min_flex_2);

  // Step 14
  const As_min_temp = 0.0018 * b * h;

  // Step 15
  const As_diseno = Math.max(As_req, As_min_flex, As_min_temp);

  // Verification
  const rho_diseno = b * d > 0 ? As_diseno / (b * d) : 0;
  const b1 = beta1(fc);
  const denom = 0.85 * b1 * fc * b;
  const c_na = denom > 0 ? (As_diseno * fy) / denom : 0;
  const eps_s = c_na > 0 ? (0.003 * (d - c_na)) / c_na : Number.POSITIVE_INFINITY;
  const tension_controlled = eps_s >= 0.005;
  const rho_max_val = rhoMax(fc, fy);

  if (rho_req > rho_max_val) {
    requires_doubly = true;
    if (error === null) {
      error = `rho_req (${rho_req.toFixed(4)}) > rho_max (${rho_max_val.toFixed(
        4,
      )}). Requiere doble refuerzo.`;
    }
  }

  return {
    b, d, h, Mu_tonm, fc, fy,
    Mu_kgcm, phi, phi_bd2, Rn, m,
    arg, one_minus_arg: one_minus, sqrt_term,
    rho_req, As_req,
    As_min_flex_1, As_min_flex_2, As_min_flex, As_min_temp,
    As_diseno,
    rho_diseno, rho_max_val, beta1: b1,
    c_na, eps_s, tension_controlled,
    requires_doubly, error,
  };
}

// ---------------------------------------------------------------------------
// buildFlexureSteps — port of flexure.py:build_flexure_steps
// ---------------------------------------------------------------------------

export function buildFlexureSteps(r: FlexureLiveResult): CalculationStep[] {
  const epsForView = r.eps_s === Number.POSITIVE_INFINITY ? 1.0 : r.eps_s;

  return [
    {
      id: "flexure.step_01_Mu_kgcm",
      name: "Momento ultimo en kg-cm",
      equation_latex: "M_u = M_{u,\\,ton\\text{-}m} \\cdot 100{,}000",
      inputs: { Mu_tonm: r.Mu_tonm },
      output_var: "Mu_kgcm",
      output_value: r.Mu_kgcm,
      output_unit: "kg-cm",
      code_ref: "Conversion de unidades",
      depends_on: [],
      note: "",
    },
    {
      id: "flexure.step_02_phi",
      name: "Factor de reduccion de resistencia",
      equation_latex: "\\phi = 0.90",
      inputs: {},
      output_var: "phi",
      output_value: r.phi,
      output_unit: "",
      code_ref: "ACI 318-14 §21.2.2",
      depends_on: [],
      note: "Seccion controlada por traccion, valor por defecto.",
    },
    {
      id: "flexure.step_03_phi_bd2",
      name: "Termino phi*b*d^2",
      equation_latex: "\\phi b d^{2} = \\phi \\cdot b \\cdot d^{2}",
      inputs: { phi: r.phi, b: r.b, d: r.d },
      output_var: "phi_bd2",
      output_value: r.phi_bd2,
      output_unit: "cm^3",
      code_ref: "ACI 318-14 §22.2",
      depends_on: ["flexure.step_02_phi"],
      note: "",
    },
    {
      id: "flexure.step_04_Rn",
      name: "Resistencia nominal requerida Rn",
      equation_latex: "R_n = \\frac{M_u}{\\phi b d^{2}}",
      inputs: { Mu_kgcm: r.Mu_kgcm, phi_bd2: r.phi_bd2 },
      output_var: "Rn",
      output_value: r.Rn,
      output_unit: "kg/cm^2",
      code_ref: "ACI 318-14 §22.2.2",
      depends_on: ["flexure.step_01_Mu_kgcm", "flexure.step_03_phi_bd2"],
      note: "",
    },
    {
      id: "flexure.step_05_m",
      name: "Parametro m",
      equation_latex: "m = \\frac{f_y}{0.85 \\, f'_c}",
      inputs: { fy: r.fy, fc: r.fc },
      output_var: "m",
      output_value: r.m,
      output_unit: "",
      code_ref: "Whitney stress block (ACI §22.2.2.4)",
      depends_on: [],
      note: "",
    },
    {
      id: "flexure.step_06_arg",
      name: "Argumento del radical",
      equation_latex: "\\text{arg} = \\frac{2 \\, m \\, R_n}{f_y}",
      inputs: { m: r.m, Rn: r.Rn, fy: r.fy },
      output_var: "arg",
      output_value: r.arg,
      output_unit: "",
      code_ref: "Solucion cuadratica del area de acero",
      depends_on: ["flexure.step_04_Rn", "flexure.step_05_m"],
      note: "",
    },
    {
      id: "flexure.step_07_one_minus_arg",
      name: "1 menos argumento",
      equation_latex: "1 - \\text{arg}",
      inputs: { arg: r.arg },
      output_var: "one_minus_arg",
      output_value: r.one_minus_arg,
      output_unit: "",
      code_ref: "Si negativo: la seccion requiere doble refuerzo",
      depends_on: ["flexure.step_06_arg"],
      note: r.requires_doubly
        ? "Si 1-arg < 0 la seccion no puede ser singly reinforced; aumentar d o usar doble refuerzo."
        : "",
    },
    {
      id: "flexure.step_08_sqrt_term",
      name: "Radical",
      equation_latex: "\\sqrt{\\,1 - \\text{arg}\\,}",
      inputs: { one_minus_arg: Math.max(r.one_minus_arg, 0) },
      output_var: "sqrt_term",
      output_value: r.sqrt_term,
      output_unit: "",
      code_ref: "",
      depends_on: ["flexure.step_07_one_minus_arg"],
      note: "",
    },
    {
      id: "flexure.step_09_rho_req",
      name: "Cuantia requerida rho_req",
      equation_latex:
        "\\rho_{req} = \\frac{1}{m}\\left(1 - \\sqrt{1 - \\text{arg}}\\right)",
      inputs: { m: r.m, sqrt_term: r.sqrt_term },
      output_var: "rho_req",
      output_value: r.rho_req,
      output_unit: "",
      code_ref: "ACI 318-14 §9.6.1",
      depends_on: ["flexure.step_05_m", "flexure.step_08_sqrt_term"],
      note: "",
    },
    {
      id: "flexure.step_10_As_req",
      name: "Acero requerido por flexion",
      equation_latex: "A_{s,req} = \\rho_{req} \\cdot b \\cdot d",
      inputs: { rho_req: r.rho_req, b: r.b, d: r.d },
      output_var: "As_req",
      output_value: r.As_req,
      output_unit: "cm^2",
      code_ref: "ACI 318-14 §9.6.1",
      depends_on: ["flexure.step_09_rho_req"],
      note: "",
    },
    {
      id: "flexure.step_11_As_min_flex_1",
      name: "Acero minimo por flexion (CSCR)",
      equation_latex: "A_{s,min,1} = \\frac{14}{f_y} \\cdot b \\cdot d",
      inputs: { fy: r.fy, b: r.b, d: r.d },
      output_var: "As_min_flex_1",
      output_value: r.As_min_flex_1,
      output_unit: "cm^2",
      code_ref: "CSCR-10 §8.3.1",
      depends_on: [],
      note: "",
    },
    {
      id: "flexure.step_12_As_min_flex_2",
      name: "Acero minimo por flexion (ACI)",
      equation_latex:
        "A_{s,min,2} = \\frac{0.79 \\sqrt{f'_c}}{f_y} \\cdot b \\cdot d",
      inputs: { fc: r.fc, fy: r.fy, b: r.b, d: r.d },
      output_var: "As_min_flex_2",
      output_value: r.As_min_flex_2,
      output_unit: "cm^2",
      code_ref: "ACI 318-14 §9.6.1.2",
      depends_on: [],
      note: "",
    },
    {
      id: "flexure.step_13_As_min_flex",
      name: "Acero minimo por flexion (gobernante)",
      equation_latex:
        "A_{s,min,flex} = \\max(A_{s,min,1},\\, A_{s,min,2})",
      inputs: { As_min_flex_1: r.As_min_flex_1, As_min_flex_2: r.As_min_flex_2 },
      output_var: "As_min_flex",
      output_value: r.As_min_flex,
      output_unit: "cm^2",
      code_ref: "",
      depends_on: ["flexure.step_11_As_min_flex_1", "flexure.step_12_As_min_flex_2"],
      note: "",
    },
    {
      id: "flexure.step_14_As_min_temp",
      name: "Acero minimo por temperatura",
      equation_latex: "A_{s,temp} = 0.0018 \\cdot b \\cdot h",
      inputs: { b: r.b, h: r.h },
      output_var: "As_min_temp",
      output_value: r.As_min_temp,
      output_unit: "cm^2",
      code_ref: "ACI 318-14 §7.6.1 (Gr 60)",
      depends_on: [],
      note: "",
    },
    {
      id: "flexure.step_15_As_diseno",
      name: "Acero de diseno",
      equation_latex:
        "A_{s,dis} = \\max\\!\\left(A_{s,req},\\; A_{s,min,flex},\\; A_{s,temp}\\right)",
      inputs: {
        As_req: r.As_req,
        As_min_flex: r.As_min_flex,
        As_min_temp: r.As_min_temp,
      },
      output_var: "As_diseno",
      output_value: r.As_diseno,
      output_unit: "cm^2",
      code_ref: "",
      depends_on: [
        "flexure.step_10_As_req",
        "flexure.step_13_As_min_flex",
        "flexure.step_14_As_min_temp",
      ],
      note: "",
    },
    {
      id: "flexure.verif_01_rho_diseno",
      name: "Cuantia de diseno",
      equation_latex: "\\rho_{dis} = \\frac{A_{s,dis}}{b \\cdot d}",
      inputs: { As_diseno: r.As_diseno, b: r.b, d: r.d },
      output_var: "rho_diseno",
      output_value: r.rho_diseno,
      output_unit: "",
      code_ref: "",
      depends_on: ["flexure.step_15_As_diseno"],
      note: "",
    },
    {
      id: "flexure.verif_02_beta1",
      name: "Factor beta_1 de Whitney",
      equation_latex: "\\beta_1 = \\beta_1(f'_c)",
      inputs: { fc: r.fc },
      output_var: "beta1",
      output_value: r.beta1,
      output_unit: "",
      code_ref: "ACI 318-14 §22.2.2.4",
      depends_on: [],
      note: "",
    },
    {
      id: "flexure.verif_03_c_na",
      name: "Profundidad del eje neutro",
      equation_latex:
        "c = \\frac{A_{s,dis} \\cdot f_y}{0.85 \\cdot \\beta_1 \\cdot f'_c \\cdot b}",
      inputs: {
        As_diseno: r.As_diseno,
        fy: r.fy,
        beta1: r.beta1,
        fc: r.fc,
        b: r.b,
      },
      output_var: "c_na",
      output_value: r.c_na,
      output_unit: "cm",
      code_ref: "ACI 318-14 §22.2.2",
      depends_on: ["flexure.step_15_As_diseno", "flexure.verif_02_beta1"],
      note: "",
    },
    {
      id: "flexure.verif_04_eps_s",
      name: "Deformacion del acero en traccion",
      equation_latex: "\\varepsilon_s = 0.003 \\cdot \\frac{d - c}{c}",
      inputs: { d: r.d, c_na: r.c_na },
      output_var: "eps_s",
      output_value: epsForView,
      output_unit: "",
      code_ref: "ACI 318-14 §21.2.2 (>= 0.005 => seccion controlada por traccion)",
      depends_on: ["flexure.verif_03_c_na"],
      note: r.tension_controlled
        ? "Tension-controlled"
        : "Verificar control por traccion",
    },
  ];
}

/**
 * Convenience: run the procedure AND build the step list in one call.
 * Used by the Beam Studio page on every input change.
 */
export function computeBeamFlexureWithSteps(input: FlexureInput): {
  result: FlexureLiveResult;
  steps: CalculationStep[];
} {
  const result = computeBeamFlexureLive(input);
  const steps = buildFlexureSteps(result);
  return { result, steps };
}
