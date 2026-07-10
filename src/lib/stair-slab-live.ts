/**
 * TS port of design_stair — losa de escalera (inclinada, simplemente apoyada).
 */
import type { CalculationStep } from "./beam-flexure-live";
import { selectBars, asBar } from "./materials";
import { designFlexure } from "./design-flexure-helper";

export interface StairInput {
  L_horiz_m: number;
  h_slab_cm: number;
  contrahuella_cm: number;
  huella_cm: number;
  CP_acabados_kg_m2: number;
  CT_kg_m2: number;
  fc: number;
  fy: number;
  zona: 1 | 2 | 3 | 4;
  r_cm: number;
}

export interface StairLiveResult {
  L_horiz: number; h_slab: number; C: number; H: number;
  CP_acabados: number; CT: number;
  fc: number; fy: number; zona: number; r: number;

  ergo: number;          // 2C + H
  h_min: number;         // L/20
  pendiente: number;
  factor: number;
  PP_losa: number;
  PP_escalon: number;
  CP_total: number;      // ton/m²
  CT_ton_m2: number;
  wu: number;            // ton/m²
  Mu: number;            // ton-m/m
  d_cm: number;
  As_req: number;
  As_prov: number;
  size: number;
  n: number;
  s: number;
  As_temp: number;
  As_temp_prov: number;
  size_temp: number;
  n_temp: number;
  s_temp: number;

  warnings: string[];
}

export function computeStairLive(input: StairInput): StairLiveResult {
  const { L_horiz_m, h_slab_cm, contrahuella_cm: C, huella_cm: H,
    CP_acabados_kg_m2, CT_kg_m2, fc, fy, zona, r_cm } = input;
  const warnings: string[] = [];

  const ergo = 2 * C + H;
  const h_min = (L_horiz_m * 100) / 20;
  const pendiente = H > 0 ? C / H : 0;
  const factor = Math.sqrt(1 + pendiente * pendiente);
  const PP_losa = 24 * h_slab_cm * factor;
  const PP_escalon = (24 * C) / 2;
  const PP_total = PP_losa + PP_escalon;
  const CP_total_kg = PP_total + CP_acabados_kg_m2;
  const CT = CT_kg_m2;
  const wu = (1.2 * CP_total_kg + 1.6 * CT) / 1000;

  const Mu = (wu * L_horiz_m * L_horiz_m) / 8;
  const d_cm = h_slab_cm - r_cm - asBar(4) / 2;

  const fl = designFlexure({ b: 100, d: d_cm, h: h_slab_cm, Mu_tonm: Mu, fc, fy });
  const sel = selectBars(fl.As_diseno, [3, 4, 5]);
  const s = (100 - 2 * r_cm) / Math.max(sel.n - 1, 1);

  const As_temp = 0.0018 * 100 * h_slab_cm;
  const selT = selectBars(As_temp, [3, 4]);
  const s_temp = (100 - 2 * r_cm) / Math.max(selT.n - 1, 1);

  if (zona >= 3) warnings.push("Zona sísmica >= 3: acero ASTM A706.");

  return {
    L_horiz: L_horiz_m, h_slab: h_slab_cm, C, H,
    CP_acabados: CP_acabados_kg_m2, CT, fc, fy, zona, r: r_cm,
    ergo, h_min, pendiente, factor,
    PP_losa, PP_escalon, CP_total: CP_total_kg / 1000, CT_ton_m2: CT / 1000,
    wu, Mu, d_cm,
    As_req: fl.As_diseno, As_prov: sel.AsProv, size: sel.size, n: sel.n, s,
    As_temp, As_temp_prov: selT.AsProv, size_temp: selT.size, n_temp: selT.n, s_temp,
    warnings,
  };
}

export function buildStairSteps(r: StairLiveResult): CalculationStep[] {
  return [
    {
      id: "stair.step_01_ergo", name: "Ergonomía 2C + H",
      equation_latex: "2C + H",
      inputs: { C: r.C, H: r.H }, output_var: "ergo", output_value: r.ergo,
      output_unit: "cm", code_ref: "Reglamento Construcciones",
      depends_on: [], note: r.ergo >= 60 && r.ergo <= 66 ? "OK (60-66 cm)" : "Fuera de rango.",
    },
    {
      id: "stair.step_02_pendiente", name: "Pendiente y factor inclinado",
      equation_latex: "k = \\sqrt{1 + (C/H)^2}",
      inputs: { C: r.C, H: r.H }, output_var: "factor", output_value: r.factor,
      output_unit: "", code_ref: "", depends_on: [], note: "",
    },
    {
      id: "stair.step_03_PP_losa", name: "Peso propio losa (inclinada)",
      equation_latex: "P_{P,losa} = 24 \\cdot h \\cdot k",
      inputs: { h: r.h_slab, k: r.factor },
      output_var: "PP_losa", output_value: r.PP_losa, output_unit: "kg/m²",
      code_ref: "γ_c = 2400 kg/m³", depends_on: ["stair.step_02_pendiente"], note: "",
    },
    {
      id: "stair.step_04_PP_esc", name: "Peso propio escalón",
      equation_latex: "P_{P,esc} = 24 \\cdot C / 2",
      inputs: { C: r.C }, output_var: "PP_escalon", output_value: r.PP_escalon,
      output_unit: "kg/m²", code_ref: "", depends_on: [], note: "",
    },
    {
      id: "stair.step_05_wu", name: "Carga última distribuida",
      equation_latex: "w_u = 1.2 CP + 1.6 CT",
      inputs: { CP: r.CP_total, CT: r.CT_ton_m2 },
      output_var: "wu", output_value: r.wu, output_unit: "ton/m²",
      code_ref: "ACI §5.3", depends_on: [], note: "",
    },
    {
      id: "stair.step_06_Mu", name: "Momento (simplemente apoyada)",
      equation_latex: "M_u = w_u L^2 / 8",
      inputs: { wu: r.wu, L: r.L_horiz },
      output_var: "Mu", output_value: r.Mu, output_unit: "ton-m/m",
      code_ref: "Estática", depends_on: ["stair.step_05_wu"], note: "",
    },
    {
      id: "stair.step_07_As", name: "Acero principal por metro",
      equation_latex: "A_s",
      inputs: { Mu: r.Mu, d: r.d_cm }, output_var: "As",
      output_value: r.As_req, output_unit: "cm²/m",
      code_ref: "ACI §9.6", depends_on: ["stair.step_06_Mu"],
      note: `${r.n} #${r.size} @ ${r.s.toFixed(1)} cm`,
    },
    {
      id: "stair.step_08_Astemp", name: "Acero por temperatura",
      equation_latex: "A_{s,temp} = 0.0018 \\cdot 100 \\cdot h",
      inputs: { h: r.h_slab }, output_var: "As_temp",
      output_value: r.As_temp, output_unit: "cm²/m",
      code_ref: "ACI §7.6.1", depends_on: [],
      note: `${r.n_temp} #${r.size_temp} @ ${r.s_temp.toFixed(1)} cm`,
    },
  ];
}

export function buildStairChecks(r: StairLiveResult) {
  return [
    { nombre: "Ergonomía 60 ≤ 2C+H ≤ 66 cm", requerido: r.ergo, disponible: 63,
      unidad: "cm", cumple: r.ergo >= 60 && r.ergo <= 66,
      referencia: "Reglamento Construcciones", critical: false },
    { nombre: "h ≥ L/20", requerido: r.h_min, disponible: r.h_slab,
      unidad: "cm", cumple: r.h_slab >= r.h_min,
      referencia: "ACI tabla 9.5(a)", critical: false },
    { nombre: "As principal", requerido: r.As_req, disponible: r.As_prov,
      unidad: "cm²/m", cumple: r.As_prov >= r.As_req,
      referencia: "ACI §9.6", critical: true },
    { nombre: "As temperatura", requerido: r.As_temp, disponible: r.As_temp_prov,
      unidad: "cm²/m", cumple: r.As_temp_prov >= r.As_temp,
      referencia: "ACI §7.6.1", critical: true },
  ];
}
