/**
 * TS port of design_lintel — dintel sobre vano.
 * Si a/d < 2 marca requires_review (viga profunda).
 */
import type { CalculationStep } from "./beam-flexure-live";
import { selectBars, asBar, dbBar, PHI_V } from "./materials";
import { designFlexure } from "./design-flexure-helper";

export interface LintelInput {
  a_cm: number;
  b_cm: number;
  h_cm: number;
  Mu_tonm: number;
  Vu_ton: number;
  fc: number;
  fy: number;
  zona: 1 | 2 | 3 | 4;
  r_cm: number;
}

export interface LintelLiveResult {
  a: number; b: number; h: number; r: number;
  Mu: number; Vu: number; fc: number; fy: number; zona: number;

  d_cm: number;
  a_d_ratio: number;
  deepBeam: boolean;
  As_req: number;
  As_prov: number;
  size: number;
  n: number;
  phi_Vc: number;

  warnings: string[];
}

export function computeLintelLive(input: LintelInput): LintelLiveResult {
  const { a_cm, b_cm, h_cm, Mu_tonm, Vu_ton, fc, fy, zona, r_cm } = input;
  const warnings: string[] = [];

  // Peralte efectivo: d = h - recubrimiento - diametro_estribo - db_long/2.
  // (CR-Cal-Bug 2026-05: anteriormente usaba asBar(3) (area=0.71 cm²)
  //  en lugar de dbBar(3) (diametro=0.953 cm). Error de unidades.)
  const d_cm = h_cm - r_cm - dbBar(3) - dbBar(4) / 2;
  const ratio = d_cm > 0 ? a_cm / d_cm : 0;
  const deepBeam = ratio < 2.0;

  let As_req = 0, As_prov = 0, size = 4, n = 0;
  let phi_Vc = 0;

  if (deepBeam) {
    warnings.push(`a/d = ${ratio.toFixed(2)} < 2. Viga profunda, requiere modelo puntal-tensor §23.`);
    if (zona >= 3) warnings.push("Agregar barras diagonales a 45° en el alma.");
  } else {
    const fl = designFlexure({ b: b_cm, d: d_cm, h: h_cm, Mu_tonm, fc, fy });
    As_req = fl.As_diseno;
    const sel = selectBars(As_req, [4, 5]);
    size = sel.size; n = sel.n; As_prov = sel.AsProv;
    phi_Vc = (PHI_V * 0.53 * Math.sqrt(fc) * b_cm * d_cm) / 1000;
  }

  return {
    a: a_cm, b: b_cm, h: h_cm, r: r_cm,
    Mu: Mu_tonm, Vu: Vu_ton,
    fc, fy, zona,
    d_cm, a_d_ratio: ratio, deepBeam,
    As_req, As_prov, size, n, phi_Vc,
    warnings,
  };
}

export function buildLintelSteps(r: LintelLiveResult): CalculationStep[] {
  const steps: CalculationStep[] = [
    {
      id: "lintel.step_01_d", name: "Peralte efectivo",
      equation_latex: "d = h - r - d_b/2",
      inputs: { h: r.h, r: r.r }, output_var: "d", output_value: r.d_cm,
      output_unit: "cm", code_ref: "ACI §20.6", depends_on: [], note: "",
    },
    {
      id: "lintel.step_02_ratio", name: "Relación a/d",
      equation_latex: "a/d",
      inputs: { a: r.a, d: r.d_cm }, output_var: "a_d", output_value: r.a_d_ratio,
      output_unit: "", code_ref: "ACI §9.9 (viga profunda si < 2)",
      depends_on: ["lintel.step_01_d"],
      note: r.deepBeam ? "Viga profunda. Modelo puntal-tensor (§23)." : "Viga convencional.",
    },
  ];
  if (!r.deepBeam) {
    steps.push({
      id: "lintel.step_03_As", name: "Acero inferior por flexión",
      equation_latex: "A_s",
      inputs: { Mu: r.Mu, d: r.d_cm }, output_var: "As",
      output_value: r.As_req, output_unit: "cm²", code_ref: "ACI §9.6",
      depends_on: ["lintel.step_01_d"],
      note: `${r.n} #${r.size} (As = ${r.As_prov.toFixed(2)} cm²)`,
    });
    steps.push({
      id: "lintel.step_04_phiVc", name: "Capacidad cortante phi·Vc",
      equation_latex: "\\phi V_c = 0.75 \\cdot 0.53 \\sqrt{f'_c} \\cdot b \\cdot d",
      inputs: { fc: r.fc, b: r.b, d: r.d_cm },
      output_var: "phi_Vc", output_value: r.phi_Vc, output_unit: "ton",
      code_ref: "ACI §22.5", depends_on: ["lintel.step_01_d"], note: "",
    });
  }
  return steps;
}

export function buildLintelChecks(r: LintelLiveResult) {
  if (r.deepBeam) {
    return [
      { nombre: "a/d ≥ 2 (viga convencional)", requerido: 2.0, disponible: r.a_d_ratio,
        unidad: "", cumple: false,
        referencia: "ACI §9.9 — usar puntal-tensor", critical: true },
    ];
  }
  return [
    { nombre: "As inferior por flexión", requerido: r.As_req, disponible: r.As_prov,
      unidad: "cm²", cumple: r.As_prov >= r.As_req, referencia: "ACI §9.6", critical: true },
    { nombre: "phi·Vc ≥ Vu (sin estribos)", requerido: r.Vu, disponible: r.phi_Vc,
      unidad: "ton", cumple: r.phi_Vc >= r.Vu, referencia: "ACI §22.5", critical: true },
  ];
}
