/**
 * TS port of design_circular_column.
 * Spiral confinement per ACI §10 + §25.7.3. Simplified axial design.
 */
import type { CalculationStep } from "./beam-flexure-live";
import { asBar } from "./materials";

export interface CircColumnInput {
  D_cm: number;
  L_cm: number;
  r_cm: number;
  Pu_ton: number;
  Mu_max_tonm: number;
  fc: number;
  fy: number;
  zona: 1 | 2 | 3 | 4;
  nBarsTentative: number;
  sizeBarTentative: number;
  sizeEspiral: number;
}

export interface CircColumnLiveResult {
  D: number; L: number; r: number;
  Pu: number; Mu: number; fc: number; fy: number; zona: number;
  Ag: number; Dc: number; Ac: number;
  phi: number;
  Ast_req: number;
  As_min: number;
  As_max: number;
  As_prov: number;
  n_bars: number;
  size: number;
  rho: number;
  rho_s_min: number;
  rho_s_prov: number;
  s_espiral: number;
  lo: number;
  sizeEspiral: number;
  warnings: string[];
}

export function computeCircularColumnLive(input: CircColumnInput): CircColumnLiveResult {
  const { D_cm: D, L_cm: L, r_cm: r, Pu_ton, Mu_max_tonm, fc, fy, zona,
    nBarsTentative, sizeBarTentative, sizeEspiral } = input;
  const warnings: string[] = [];

  const Ag = (Math.PI * D * D) / 4.0;
  const Dc = D - 2 * r;
  const Ac = (Math.PI * Dc * Dc) / 4.0;
  const phi = 0.75;

  const Pu_mayorado = Pu_ton / phi;
  const num = Pu_mayorado - (0.85 * fc * Ag) / 1000.0;
  const den = (fy - 0.85 * fc) / 1000.0;
  const Ast_req = den > 0 ? num / den : 0;

  const As_min = 0.01 * Ag;
  const As_max = zona >= 3 ? 0.06 * Ag : 0.08 * Ag;
  const Ast_diseno = Math.max(Ast_req, As_min);

  let size = sizeBarTentative;
  let n_bars = Math.max(6, nBarsTentative);
  let As_prov = n_bars * asBar(size);
  while (As_prov < Ast_diseno && n_bars < 24) {
    n_bars += 2;
    As_prov = n_bars * asBar(size);
  }
  const rho = Ag > 0 ? As_prov / Ag : 0;

  const rho_s_min = 0.45 * (Ag / Ac - 1.0) * (fc / fy);
  const As_esp = asBar(sizeEspiral);
  const s_raw = rho_s_min > 0 ? (4 * As_esp) / (rho_s_min * Dc) : 7.5;
  const s_espiral = Math.max(2.5, Math.min(7.5, s_raw));
  const rho_s_prov = (4 * As_esp) / (s_espiral * Dc);
  const lo = Math.max(D, L / 6.0, 45.0);

  if (zona >= 3) warnings.push("Zona sísmica >= 3: acero ASTM A706, espiral continua.");
  if (Mu_max_tonm > 0 && Pu_ton > 0) {
    const ecc = Mu_max_tonm / ((Pu_ton * D) / 100);
    if (ecc > 0.10)
      warnings.push(`e/D = ${ecc.toFixed(3)} > 0.10. Diagrama P-M requerido.`);
  }

  return {
    D, L, r, Pu: Pu_ton, Mu: Mu_max_tonm, fc, fy, zona,
    Ag, Dc, Ac,
    phi, Ast_req, As_min, As_max, As_prov, n_bars, size, rho,
    rho_s_min, rho_s_prov, s_espiral, lo, sizeEspiral,
    warnings,
  };
}

export function buildCircularColumnSteps(r: CircColumnLiveResult): CalculationStep[] {
  return [
    {
      id: "circ_col.step_01_Ag", name: "Área bruta",
      equation_latex: "A_g = \\frac{\\pi D^2}{4}",
      inputs: { D: r.D }, output_var: "Ag", output_value: r.Ag, output_unit: "cm^2",
      code_ref: "ACI 318-14 §22.4", depends_on: [], note: "",
    },
    {
      id: "circ_col.step_02_Dc", name: "Diámetro confinado",
      equation_latex: "D_c = D - 2r",
      inputs: { D: r.D, r: r.r }, output_var: "Dc", output_value: r.Dc, output_unit: "cm",
      code_ref: "", depends_on: [], note: "",
    },
    {
      id: "circ_col.step_03_Ac", name: "Área de núcleo",
      equation_latex: "A_c = \\frac{\\pi D_c^2}{4}",
      inputs: { Dc: r.Dc }, output_var: "Ac", output_value: r.Ac, output_unit: "cm^2",
      code_ref: "", depends_on: ["circ_col.step_02_Dc"], note: "",
    },
    {
      id: "circ_col.step_04_phi", name: "Factor phi (con espiral)",
      equation_latex: "\\phi = 0.75", inputs: {}, output_var: "phi", output_value: 0.75,
      output_unit: "", code_ref: "ACI 318-14 §21.2.2", depends_on: [], note: "",
    },
    {
      id: "circ_col.step_05_Ast_req", name: "Acero longitudinal requerido",
      equation_latex: "A_{st,req} = \\frac{P_u/\\phi - 0.85 f'_c A_g}{f_y - 0.85 f'_c}",
      inputs: { Pu: r.Pu, phi: 0.75, fc: r.fc, Ag: r.Ag, fy: r.fy },
      output_var: "Ast_req", output_value: r.Ast_req, output_unit: "cm^2",
      code_ref: "ACI 318-14 §22.4.2.2", depends_on: ["circ_col.step_01_Ag"], note: "",
    },
    {
      id: "circ_col.step_06_rho", name: "Cuantía longitudinal",
      equation_latex: "\\rho = \\frac{A_{s,prov}}{A_g}",
      inputs: { Ag: r.Ag, As_prov: r.As_prov }, output_var: "rho",
      output_value: r.rho, output_unit: "", code_ref: "",
      depends_on: ["circ_col.step_01_Ag"], note: "",
    },
    {
      id: "circ_col.step_07_rho_s_min", name: "Cuantía mínima de espiral",
      equation_latex: "\\rho_{s,min} = 0.45\\left(\\frac{A_g}{A_c} - 1\\right)\\frac{f'_c}{f_y}",
      inputs: { Ag: r.Ag, Ac: r.Ac, fc: r.fc, fy: r.fy },
      output_var: "rho_s_min", output_value: r.rho_s_min, output_unit: "",
      code_ref: "ACI 318-14 §25.7.3.3", depends_on: ["circ_col.step_03_Ac"], note: "",
    },
    {
      id: "circ_col.step_08_s_espiral", name: "Separación de espiral",
      equation_latex: "s_{esp} = \\frac{4 A_{esp}}{\\rho_{s,min} \\cdot D_c}",
      inputs: { Dc: r.Dc, rho_s_min: r.rho_s_min, As_esp: asBar(r.sizeEspiral) },
      output_var: "s_espiral", output_value: r.s_espiral, output_unit: "cm",
      code_ref: "ACI 318-14 §25.7.3", depends_on: ["circ_col.step_07_rho_s_min"],
      note: "Límites: 2.5 cm ≤ s ≤ 7.5 cm.",
    },
    {
      id: "circ_col.step_09_lo", name: "Longitud de zona confinada",
      equation_latex: "l_o = \\max(D,\\, L/6,\\, 45\\text{ cm})",
      inputs: { D: r.D, L: r.L }, output_var: "lo", output_value: r.lo,
      output_unit: "cm", code_ref: "ACI 318-14 §18.7.5.1", depends_on: [], note: "",
    },
  ];
}

export function buildCircularColumnChecks(r: CircColumnLiveResult) {
  return [
    { nombre: "Mínimo 6 barras", requerido: 6, disponible: r.n_bars, unidad: "barras",
      cumple: r.n_bars >= 6, referencia: "ACI §10.7.3.1", critical: true },
    { nombre: "Ast ≥ As_min", requerido: r.As_min, disponible: r.As_prov,
      unidad: "cm²", cumple: r.As_prov >= r.As_min, referencia: "ACI §10.6.1.1", critical: true },
    { nombre: "Ast ≤ As_max", requerido: r.As_prov, disponible: r.As_max,
      unidad: "cm²", cumple: r.As_prov <= r.As_max, referencia: "ACI §10.6.1", critical: true },
    { nombre: "ρ_s ≥ ρ_s,min", requerido: r.rho_s_min, disponible: r.rho_s_prov,
      unidad: "", cumple: r.rho_s_prov >= r.rho_s_min, referencia: "ACI §25.7.3.3", critical: true },
  ];
}
