/**
 * Pile + cap (pilote + cabezal) — fundaciones profundas.
 *
 * References:
 *   - ACI 318-14 §13.4 (Deep foundations and pile caps)
 *   - ACI 318-14 §23 (Strut-and-tie models)
 *   - AASHTO LRFD Bridge Design Spec §10.7 (Driven piles)
 *   - Das, B.M. (2016), Principles of Foundation Engineering, §17
 *   - CRSI Design Handbook (2008), §11 (Pile caps)
 *
 * Procedure:
 *   1. Capacidad última del pilote individual:
 *        Qu = qp·Ap + fs·As_lat
 *      Qa (admisible) = Qu / FS  (FS = 3 estático, 2 sísmico).
 *   2. Distribución de cargas en pilotes (cuerpo rígido):
 *        P_i = Pu/n ± Mu·x_i / Σx_i²    (caso 2, 3, 4 pilotes)
 *      Verificar max(P_i) ≤ Qa.
 *   3. Diseño del cabezal con modelo strut-and-tie (ACI §23):
 *        T = P_pile · s / (2·d)
 *        As,tie = T / (φ·fy)
 *   4. Punzonamiento del cap por la columna + cada pilote.
 *   5. Cortante 1-dir en el cabezal.
 *
 * Units: cm, kg, kg/cm², ton, ton-m.
 */
import type { CalculationStep } from "./beam-flexure-live";
import { selectBars, dbBar, PHI_V } from "./materials";

export type PileCount = 2 | 3 | 4;

export interface PileCapInput {
  Pu_ton: number;        // carga última de la columna
  Mu_tonm: number;       // momento de la columna
  n_piles: PileCount;
  s_m: number;           // separación entre pilotes
  D_cm: number;          // diámetro del pilote
  L_pile_m: number;      // longitud del pilote
  qp_kPa: number;        // resistencia de punta (servicio)
  fs_kPa: number;        // fricción lateral
  bc_cm: number;         // columna ancho
  hc_cm: number;         // columna peralte
  h_cap_cm: number;      // espesor del cabezal
  fc: number;
  fy: number;
  r_cm: number;
  zona: 1 | 2 | 3 | 4;
  seismic: boolean;      // FS = 2 si sísmico
}

export interface PileCapLiveResult {
  // echo
  Pu: number; Mu: number; n_piles: PileCount; s: number; D: number; Lp: number;
  qp_kPa: number; fs_kPa: number;
  bc: number; hc: number; h_cap: number; fc: number; fy: number; r: number; zona: number;
  seismic: boolean;

  // Capacidad pilote
  Ap_m2: number;          // área de punta
  As_lat_m2: number;      // área de fuste
  Qu_ton: number;
  FS: number;
  Qa_ton: number;

  // Reparto en pilotes
  Pi_max_ton: number;     // pilote más cargado
  Pi_min_ton: number;
  pile_loads_ton: number[];
  load_ok: boolean;

  // Cabezal — strut-tie
  d_cap_cm: number;
  T_tie_ton: number;       // fuerza en el tirante
  As_tie_req: number; As_tie_prov: number; size_tie: number; n_tie: number;

  // Punzonamiento por la columna
  bo_col: number; Vu_pun_col: number; phi_Vc_pun_col: number; pun_col_ok: boolean;
  // Punzonamiento por un pilote (más cargado)
  bo_pile: number; Vu_pun_pile: number; phi_Vc_pun_pile: number; pun_pile_ok: boolean;
  // Cortante 1-dir
  Vu_1d: number; phi_Vc_1d: number; shear1d_ok: boolean;

  warnings: string[];
}

export function computePileCapLive(input: PileCapInput): PileCapLiveResult {
  const {
    Pu_ton: Pu, Mu_tonm: Mu, n_piles, s_m: s, D_cm: D, L_pile_m: Lp,
    qp_kPa, fs_kPa, bc_cm: bc, hc_cm: hc, h_cap_cm: h_cap,
    fc, fy, r_cm: r, zona, seismic,
  } = input;
  const warnings: string[] = [];

  // 1. Capacidad pilote individual
  // qp y fs en kPa → ton (1 kPa = 0.1019 ton/m²)
  const Ap = Math.PI * Math.pow(D / 100, 2) / 4; // m²
  const As_lat = Math.PI * (D / 100) * Lp; // m²
  // Convert kPa → ton/m²
  const kPa_to_tonm2 = 0.10197;
  const Qu_punta = qp_kPa * kPa_to_tonm2 * Ap;
  const Qu_friccion = fs_kPa * kPa_to_tonm2 * As_lat;
  const Qu = Qu_punta + Qu_friccion;
  const FS = seismic ? 2 : 3;
  const Qa = Qu / FS;

  // 2. Reparto de cargas — depende de n_piles
  // Posiciones x_i (en m, respecto al centroide del grupo):
  let positions_x: number[] = [];
  if (n_piles === 2) {
    positions_x = [-s / 2, s / 2];
  } else if (n_piles === 3) {
    // triángulo equilátero — solo necesitamos x_i para reparto
    positions_x = [-s / 2, s / 2, 0];
  } else {
    // 4 — cuadrado de lado s
    positions_x = [-s / 2, s / 2, s / 2, -s / 2];
  }
  const SumX2 = positions_x.reduce((acc, x) => acc + x * x, 0);
  const Pi_avg = Pu / n_piles;
  const pile_loads: number[] = positions_x.map(
    (xi) => Pi_avg + (Mu * xi) / Math.max(0.001, SumX2),
  );
  const Pi_max = Math.max(...pile_loads);
  const Pi_min = Math.min(...pile_loads);
  const load_ok = Pi_max <= Qa;
  if (!load_ok) warnings.push(
    `Pilote más cargado P = ${Pi_max.toFixed(1)} > Qa = ${Qa.toFixed(1)} ton. Aumentar n_pilotes o L.`,
  );
  if (Pi_min < 0) warnings.push(
    `Pilote en tracción P = ${Pi_min.toFixed(1)} ton — verificar anclaje o aumentar separación.`,
  );

  // 3. Cabezal — strut-and-tie
  const db_assume = dbBar(8);
  const d_cap = h_cap - r - 1.5 * db_assume;
  // T_tie por la metodología CRSI §11.3: T = P · s / (2·d) por cada par de pilotes
  const T = (Pi_max * s * 100) / (2 * d_cap); // ton
  const phi_tie = 0.75;
  // As = T·1000 (kg) / (φ · fy)
  const As_tie_req = (T * 1000) / (phi_tie * fy);
  const sel_tie = selectBars(As_tie_req, [6, 7, 8, 9, 10]);

  // 4. Punzonamiento por la columna
  const bo_col = 2 * (bc + d_cap) + 2 * (hc + d_cap);
  const beta_col = Math.max(bc, hc) / Math.max(1, Math.min(bc, hc));
  const sqrt_fc = Math.sqrt(fc);
  const vc1_col = 1.06 * sqrt_fc;
  const vc2_col = (0.53 + 1.06 / beta_col) * sqrt_fc;
  const vc3_col = (0.27 + (40 * d_cap) / bo_col) * sqrt_fc;
  const vc_col = Math.min(vc1_col, vc2_col, vc3_col);
  const phi_Vc_pun_col = (PHI_V * vc_col * bo_col * d_cap) / 1000; // ton
  // Demanda: Pu menos las reacciones de pilotes dentro del perímetro crítico.
  // Simplificación conservadora: Vu_pun_col = Pu (asume pilotes fuera del perímetro).
  const Vu_pun_col = Pu;
  const pun_col_ok = Vu_pun_col <= phi_Vc_pun_col;
  if (!pun_col_ok) warnings.push(
    `Punzonamiento columna: Vu = ${Vu_pun_col.toFixed(1)} > φVc = ${phi_Vc_pun_col.toFixed(1)} ton.`,
  );

  // 5. Punzonamiento por un pilote individual
  // perímetro circular: bo = π·(D + d)
  const bo_pile = Math.PI * (D + d_cap);
  const vc_pile = 1.06 * sqrt_fc; // sin factor β/perímetro para pilote circular
  const phi_Vc_pun_pile = (PHI_V * vc_pile * bo_pile * d_cap) / 1000;
  const Vu_pun_pile = Pi_max;
  const pun_pile_ok = Vu_pun_pile <= phi_Vc_pun_pile;
  if (!pun_pile_ok) warnings.push(
    `Punzonamiento por pilote: Vu = ${Vu_pun_pile.toFixed(1)} > φVc = ${phi_Vc_pun_pile.toFixed(1)} ton.`,
  );

  // 6. Cortante 1-dir
  // ancho del cap se asume s·1.5 a cada lado del eje (CRSI). Aquí simplificamos
  // tomando B_cap = s + 2·(D/100) y d como antes.
  const B_cap_m = s + 2 * (D / 100);
  const Vu_1d = Pi_max; // conservativo: la mitad del cap pasa por el pilote más cargado
  const phi_Vc_1d = (PHI_V * 0.53 * sqrt_fc * B_cap_m * 100 * d_cap) / 1000;
  const shear1d_ok = Vu_1d <= phi_Vc_1d;

  if (zona >= 3) warnings.push("Zona sísmica ≥ III: pilotes y cabezal requieren detallado dúctil (ACI §18.13).");
  warnings.push("Verificar capacidad estructural del pilote (compresión + flexión) separadamente — ACI 318-14 §13.4.5.");

  return {
    Pu, Mu, n_piles, s, D, Lp, qp_kPa, fs_kPa, bc, hc, h_cap, fc, fy, r, zona, seismic,
    Ap_m2: Ap, As_lat_m2: As_lat,
    Qu_ton: Qu, FS, Qa_ton: Qa,
    Pi_max_ton: Pi_max, Pi_min_ton: Pi_min, pile_loads_ton: pile_loads, load_ok,
    d_cap_cm: d_cap,
    T_tie_ton: T, As_tie_req, As_tie_prov: sel_tie.AsProv,
    size_tie: sel_tie.size, n_tie: sel_tie.n,
    bo_col, Vu_pun_col, phi_Vc_pun_col, pun_col_ok,
    bo_pile, Vu_pun_pile, phi_Vc_pun_pile, pun_pile_ok,
    Vu_1d, phi_Vc_1d, shear1d_ok,
    warnings,
  };
}

export function buildPileCapSteps(r: PileCapLiveResult): CalculationStep[] {
  return [
    {
      id: "pile_cap.step_01_Ap", name: "Áreas del pilote",
      equation_latex: "A_p = \\frac{\\pi D^2}{4}, \\;\\; A_{s,lat} = \\pi \\cdot D \\cdot L_p",
      inputs: { D: r.D, Lp: r.Lp },
      output_var: "Ap", output_value: r.Ap_m2, output_unit: "m²",
      code_ref: "Das §17.4", depends_on: [], note: `As_lat = ${r.As_lat_m2.toFixed(3)} m²`,
    },
    {
      id: "pile_cap.step_02_Qu", name: "Capacidad última del pilote",
      equation_latex: "Q_u = q_p A_p + f_s A_{s,lat}",
      inputs: { qp: r.qp_kPa, fs: r.fs_kPa, Ap: r.Ap_m2 },
      output_var: "Qu", output_value: r.Qu_ton, output_unit: "ton",
      code_ref: "AASHTO LRFD §10.7 / Das §17", depends_on: ["pile_cap.step_01_Ap"],
      note: "qp y fs en kPa, convertidos a ton/m².",
    },
    {
      id: "pile_cap.step_03_Qa", name: "Capacidad admisible",
      equation_latex: "Q_a = \\frac{Q_u}{FS}",
      inputs: { Qu: r.Qu_ton, FS: r.FS },
      output_var: "Qa", output_value: r.Qa_ton, output_unit: "ton",
      code_ref: "Das §17.5", depends_on: ["pile_cap.step_02_Qu"],
      note: `FS = ${r.FS} (${r.seismic ? "sísmico" : "estático"}).`,
    },
    {
      id: "pile_cap.step_04_reparto", name: "Reparto de cargas en pilotes",
      equation_latex: "P_i = \\frac{P_u}{n} \\pm \\frac{M_u \\cdot x_i}{\\Sigma x_i^2}",
      inputs: { Pu: r.Pu, Mu: r.Mu, n: r.n_piles },
      output_var: "Pi_max", output_value: r.Pi_max_ton, output_unit: "ton",
      code_ref: "ACI 318-14 §13.4.2", depends_on: [],
      note: r.load_ok ? `OK — Pi_max ≤ Qa` : `FALLA — aumentar n o L.`,
    },
    {
      id: "pile_cap.step_05_d_cap", name: "Peralte efectivo del cabezal",
      equation_latex: "d = h_{cap} - r - 1.5 d_b",
      inputs: { h: r.h_cap, r: r.r },
      output_var: "d", output_value: r.d_cap_cm, output_unit: "cm",
      code_ref: "ACI 318-14 §13.4.3", depends_on: [], note: "Asume barra de tirante #8.",
    },
    {
      id: "pile_cap.step_06_T_tie", name: "Tirante del modelo strut-and-tie",
      equation_latex: "T = \\frac{P_i \\cdot s}{2 \\cdot d}",
      inputs: { Pi: r.Pi_max_ton, s: r.s, d: r.d_cap_cm },
      output_var: "T_tie", output_value: r.T_tie_ton, output_unit: "ton",
      code_ref: "ACI 318-14 §23 / CRSI §11.3",
      depends_on: ["pile_cap.step_04_reparto", "pile_cap.step_05_d_cap"], note: "",
    },
    {
      id: "pile_cap.step_07_As_tie", name: "Acero del tirante",
      equation_latex: "A_{s,tie} = \\frac{T}{\\phi \\cdot f_y}",
      inputs: { T: r.T_tie_ton, fy: r.fy, phi: 0.75 },
      output_var: "As_tie", output_value: r.As_tie_prov, output_unit: "cm²",
      code_ref: "ACI 318-14 §23.7", depends_on: ["pile_cap.step_06_T_tie"],
      note: `${r.n_tie} #${r.size_tie} (req ${r.As_tie_req.toFixed(2)} cm²).`,
    },
    {
      id: "pile_cap.step_08_pun_col", name: "Punzonamiento por columna",
      equation_latex: "\\phi V_c = \\phi \\cdot v_c \\cdot b_o \\cdot d",
      inputs: { bo: r.bo_col, d: r.d_cap_cm },
      output_var: "phiVc_col", output_value: r.phi_Vc_pun_col, output_unit: "ton",
      code_ref: "ACI 318-14 §22.6.5", depends_on: ["pile_cap.step_05_d_cap"],
      note: r.pun_col_ok ? "OK" : "FALLA",
    },
    {
      id: "pile_cap.step_09_pun_pile", name: "Punzonamiento por un pilote",
      equation_latex: "b_o = \\pi(D + d)",
      inputs: { D: r.D, d: r.d_cap_cm },
      output_var: "phiVc_pile", output_value: r.phi_Vc_pun_pile, output_unit: "ton",
      code_ref: "ACI 318-14 §22.6.5", depends_on: ["pile_cap.step_05_d_cap"],
      note: r.pun_pile_ok ? "OK" : "FALLA",
    },
    {
      id: "pile_cap.step_10_v1d", name: "Cortante en una dirección",
      equation_latex: "\\phi V_c = \\phi \\cdot 0.53 \\sqrt{f'_c} \\cdot B \\cdot d",
      inputs: { fc: r.fc, d: r.d_cap_cm },
      output_var: "phiVc_1d", output_value: r.phi_Vc_1d, output_unit: "ton",
      code_ref: "ACI 318-14 §22.5", depends_on: ["pile_cap.step_05_d_cap"],
      note: r.shear1d_ok ? "OK" : "FALLA — aumentar h_cap.",
    },
  ];
}

export function buildPileCapChecks(r: PileCapLiveResult) {
  return [
    {
      nombre: "Pilote más cargado ≤ Qa",
      requerido: r.Pi_max_ton, disponible: r.Qa_ton,
      unidad: "ton", cumple: r.load_ok,
      referencia: "AASHTO LRFD §10.7", critical: true,
    },
    {
      nombre: "Sin pilotes en tracción",
      requerido: 0, disponible: r.Pi_min_ton,
      unidad: "ton", cumple: r.Pi_min_ton >= 0,
      referencia: "ACI 318-14 §13.4.6.2", critical: true,
    },
    {
      nombre: "Punzonamiento columna",
      requerido: r.Vu_pun_col, disponible: r.phi_Vc_pun_col,
      unidad: "ton", cumple: r.pun_col_ok,
      referencia: "ACI 318-14 §22.6.5", critical: true,
    },
    {
      nombre: "Punzonamiento pilote individual",
      requerido: r.Vu_pun_pile, disponible: r.phi_Vc_pun_pile,
      unidad: "ton", cumple: r.pun_pile_ok,
      referencia: "ACI 318-14 §22.6.5", critical: true,
    },
    {
      nombre: "Cortante 1-dir",
      requerido: r.Vu_1d, disponible: r.phi_Vc_1d,
      unidad: "ton", cumple: r.shear1d_ok,
      referencia: "ACI 318-14 §22.5", critical: true,
    },
    {
      nombre: "Tirante acero provisto ≥ requerido",
      requerido: r.As_tie_req, disponible: r.As_tie_prov,
      unidad: "cm²", cumple: r.As_tie_prov >= r.As_tie_req,
      referencia: "ACI 318-14 §23.7", critical: true,
    },
  ];
}
