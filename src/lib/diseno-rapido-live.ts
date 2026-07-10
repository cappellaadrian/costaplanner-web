/**
 * Diseño Rápido CSCR §17 — vivienda CR 1-2 pisos.
 *
 * Dada una especificación mínima de casa (área, # pisos, zona sísmica,
 * tipo de suelo, sistema estructural), devuelve TODO el predimensionado
 * de vigas, columnas, losas, zapatas y muros de mampostería confinada —
 * más cantidades preliminares y verificaciones CSCR §17.
 *
 * Es la dirección INVERSA de los 35 calculadores detallados: aquí
 * generamos la geometría y refuerzo para que el ingeniero pueda luego
 * refinarlo en /studio/<elemento>. CSCR §17 es intencionalmente
 * conservador — montamos esa conservación.
 *
 * References:
 *   - CSCR-10 Rev. 2014, Capítulo 17 (Diseño Simplificado)
 *   - CSCR-10 Rev. 2014, Capítulo  6 (Cargas y combinaciones)
 *   - CSCR-10 Rev. 2014, Capítulo  8 (Concreto reforzado)
 *   - CSCR-10 Rev. 2014, Capítulo 10 (Mampostería confinada)
 *   - ACI 318-14 — detallado de barras y estribos
 *   - INTE C5:2014 — Mampostería estructural CR
 */

export type TipoProyecto = "casa_1piso" | "casa_2pisos" | "apartamento" | "local_pequeno";
export type Sistema = "mamposteria_confinada" | "marcos_concreto" | "mixto";
export type TipoSuelo = "S1" | "S2" | "S3" | "S4";

export interface DisenoRapidoInput {
  // Tipo
  tipoProyecto: TipoProyecto;

  // Geometría
  area_planta_m2: number;
  ancho_m: number;       // dirección corta del rectángulo equivalente
  largo_m: number;       // dirección larga
  numPisos: 1 | 2;
  altura_piso_m: number; // típico 2.7

  // Sitio (CSCR-10 §5 + §6)
  zonaSismica: 2 | 3 | 4; // §17 solo aplica zonas II-IV
  tipoSuelo: TipoSuelo;
  qa_ton_m2: number;

  // Sistema
  sistema: Sistema;

  // Materiales
  fc: number;     // kg/cm² — 245 default
  fy: number;     // kg/cm² — 4200 default
  fm_MPa: number; // mampostería, default 7.5
}

export interface ElementoViga {
  b_cm: number;
  h_cm: number;
  refuerzo_top: string;
  refuerzo_bot: string;
  estribos: string;
  cantidad: number;     // total de vigas
  luz_tipica_m: number; // luz usada para predimensionado
}

export interface ElementoColumna {
  tipo: string;
  b_cm: number;
  h_cm: number;
  refuerzo: string;
  estribos: string;
  cantidad: number;
  Pu_servicio_ton: number;
}

export interface ElementoLosa {
  tipo: "1dir" | "2dir";
  espesor_cm: number;
  refuerzo: string;
  area_total_m2: number;
}

export interface ElementoZapata {
  tipo: "aislada" | "corrida" | "combinada";
  dimensiones: string;
  refuerzo: string;
  cantidad: number;
  B_m: number;
  L_m: number;
  h_cm: number;
}

export interface ElementoMuros {
  tipo: string;
  espesor_cm: number;
  confinamientos: string;
  vigas_corona: string;
  refuerzo_horizontal: string;
  longitud_total_m: number;
}

export interface Verificacion {
  nombre: string;
  cumple: boolean;
  referencia: string;
  detalle: string;
}

export interface DisenoRapidoResult {
  input: DisenoRapidoInput;

  // Cargas (CSCR §6 + §17.4)
  cargas: {
    CP_kg_m2: number;
    CV_kg_m2: number;
    W_total_ton: number;
    Cs: number;
    V_basal_ton: number;
  };

  elementos: {
    vigas: {
      principal: ElementoViga;
      secundaria: ElementoViga | null;
    };
    columnas: ElementoColumna;
    losas: ElementoLosa;
    zapatas: ElementoZapata;
    muros: ElementoMuros | null;
  };

  cantidades: {
    concreto_m3: number;
    acero_kg: number;
    bloque_unidades: number;
    formaleta_m2: number;
  };

  verificaciones: Verificacion[];
  warnings: string[];
}

// -------------------------------------------------------------------
// Tablas y constantes CSCR §17
// -------------------------------------------------------------------

/** CP (peso propio + acabados) según uso, kg/m². */
function defaultCP(tipoProyecto: TipoProyecto, esTecho: boolean): number {
  if (esTecho) return 250; // cubierta liviana CR estándar
  // entrepiso losa concreto 12-15 cm + acabados
  switch (tipoProyecto) {
    case "casa_1piso":
    case "casa_2pisos":
    case "apartamento":
      return 350;
    case "local_pequeno":
      return 400;
  }
}

/** CV residencial / comercial, kg/m². */
function defaultCV(tipoProyecto: TipoProyecto): number {
  switch (tipoProyecto) {
    case "casa_1piso":
    case "casa_2pisos":
    case "apartamento":
      return 200;
    case "local_pequeno":
      return 500;
  }
}

/**
 * Cs simplificado CSCR-10 §17.5 — tabla por zona × suelo.
 * Valores conservadores que envuelven el espectro completo
 * para alturas ≤ 2 pisos y T ≈ 0.1-0.3 s.
 */
function tablaCs(zona: 2 | 3 | 4, suelo: TipoSuelo): number {
  const tabla: Record<2 | 3 | 4, Record<TipoSuelo, number>> = {
    2: { S1: 0.10, S2: 0.12, S3: 0.15, S4: 0.18 },
    3: { S1: 0.15, S2: 0.20, S3: 0.25, S4: 0.30 },
    4: { S1: 0.20, S2: 0.25, S3: 0.30, S4: 0.35 },
  };
  return tabla[zona][suelo];
}

// -------------------------------------------------------------------
// Helpers refuerzo
// -------------------------------------------------------------------

/** Área de barra # estándar CR (in/8 → cm²). */
function areaBarra(num: 3 | 4 | 5 | 6 | 7 | 8): number {
  return ({ 3: 0.71, 4: 1.27, 5: 1.98, 6: 2.85, 7: 3.88, 8: 5.07 }[num]);
}

/** Peso lineal kg/m de una barra #. */
function pesoBarra(num: 3 | 4 | 5 | 6 | 7 | 8): number {
  return ({ 3: 0.557, 4: 0.994, 5: 1.554, 6: 2.236, 7: 3.042, 8: 3.973 }[num]);
}

/** Elige (n, #) cuyo As provisto ≥ As_req. Empieza con #5; sube si hace falta. */
function escogerBarras(As_req_cm2: number, minBars = 2): { n: number; size: 3 | 4 | 5 | 6 | 7 | 8; As: number } {
  const tallas: Array<3 | 4 | 5 | 6 | 7 | 8> = [4, 5, 6, 7, 8];
  for (const s of tallas) {
    const n = Math.max(minBars, Math.ceil(As_req_cm2 / areaBarra(s)));
    if (n <= 8) return { n, size: s, As: n * areaBarra(s) };
  }
  // fallback grande
  return { n: 8, size: 8, As: 8 * areaBarra(8) };
}

function formatBarras(n: number, size: number): string {
  return `${n} #${size}`;
}

// -------------------------------------------------------------------
// Cálculo principal
// -------------------------------------------------------------------

export function computeDisenoRapidoLive(input: DisenoRapidoInput): DisenoRapidoResult {
  const warnings: string[] = [];
  const verificaciones: Verificacion[] = [];

  const {
    tipoProyecto, area_planta_m2: A, ancho_m: B_plan, largo_m: L_plan,
    numPisos, altura_piso_m, zonaSismica, tipoSuelo, qa_ton_m2,
    sistema, fc, fy, fm_MPa,
  } = input;

  // -----------------------------------------------------------------
  // 1) Cargas (CSCR §6 + §17.4)
  // -----------------------------------------------------------------
  const CP_ent = defaultCP(tipoProyecto, false); // entrepisos
  const CP_techo = defaultCP(tipoProyecto, true);
  const CV = defaultCV(tipoProyecto);

  // Peso sísmico W = (CP + 0.25·CV)·área por nivel
  // Niveles típicos: para 1 piso → 1 nivel de techo. Para 2 pisos →
  // 1 entrepiso + 1 techo. Para apartamento/local tratamos como 1 piso.
  let W_ton: number;
  if (numPisos === 2) {
    const W_ent = (CP_ent + 0.25 * CV) * A;        // kg
    const W_t = (CP_techo + 0.25 * CV * 0.5) * A;  // techo carga viva reducida
    W_ton = (W_ent + W_t) / 1000;
  } else {
    const W_t = (CP_techo + 0.25 * CV * 0.5) * A;
    const W_ent = (CP_ent + 0.25 * CV) * A;
    // para 1 piso, el peso sísmico es ~1 nivel completo (entrepiso + techo)
    W_ton = (W_ent + W_t) / 1000;
  }

  const Cs = tablaCs(zonaSismica, tipoSuelo);
  const V_basal_ton = Cs * W_ton;

  // CP promedio reportado (entrepiso, que es el que más pesa)
  const CP_kg_m2 = CP_ent;

  // -----------------------------------------------------------------
  // 2) Predimensionado de vigas (CSCR §17.6)
  // -----------------------------------------------------------------
  // Luz típica = separación entre columnas (~4 m máx en §17), no el lado
  // completo del rectángulo. La viga es continua entre apoyos → h ≥ L/12.
  const luz_principal_m = Math.min(4.5, B_plan);
  const h_viga_min_cm = Math.max(25, Math.ceil((luz_principal_m * 100) / 12 / 5) * 5);
  const b_viga_min_cm = Math.max(15, Math.ceil(h_viga_min_cm / 2 / 5) * 5);

  // As principal: aprox ρ ≈ 0.005 para vigas residenciales típicas
  // (CSCR §8: ρ_min = 14/fy = 0.0033; ρ_max ≈ 0.025 dúctil).
  const d_viga = h_viga_min_cm - 6; // recubrimiento + estribo + medio db
  const As_principal = 0.005 * b_viga_min_cm * d_viga;
  const refTop = escogerBarras(As_principal, 2);
  const refBot = escogerBarras(As_principal * 1.1, 3);

  // Estribos: CSCR §8.3 / ACI §18.6 dúctiles: #3 @ d/4 zona crítica,
  // d/2 fuera. Para Diseño Rápido usamos #3 @ 10 cm extremos / @ 20 cm centro.
  const estribos_viga = `#3 @ 10 cm (Lc = 2h) · @ 20 cm centro`;

  // Cantidad de vigas — perímetro + ejes interiores estimados
  const cantidad_vigas_principal = Math.max(2, Math.round((2 * L_plan) / luz_principal_m));
  const cantidad_vigas_secundaria = Math.max(2, Math.round((2 * B_plan) / 4));

  const viga_principal: ElementoViga = {
    b_cm: b_viga_min_cm,
    h_cm: h_viga_min_cm,
    refuerzo_top: formatBarras(refTop.n, refTop.size),
    refuerzo_bot: formatBarras(refBot.n, refBot.size),
    estribos: estribos_viga,
    cantidad: cantidad_vigas_principal,
    luz_tipica_m: luz_principal_m,
  };

  // Viga secundaria: solo si largo > 1.5·ancho (la casa es alargada)
  let viga_secundaria: ElementoViga | null = null;
  if (L_plan > 1.5 * B_plan) {
    const luz_sec = Math.min(4, B_plan);
    const h_sec = Math.max(20, Math.ceil((luz_sec * 100) / 14 / 5) * 5);
    const b_sec = Math.max(15, Math.ceil(h_sec / 2 / 5) * 5);
    const As_sec = 0.005 * b_sec * (h_sec - 6);
    const rSec = escogerBarras(As_sec, 2);
    viga_secundaria = {
      b_cm: b_sec,
      h_cm: h_sec,
      refuerzo_top: formatBarras(rSec.n, rSec.size),
      refuerzo_bot: formatBarras(rSec.n, rSec.size),
      estribos: `#3 @ 15 cm extremos · @ 25 cm centro`,
      cantidad: cantidad_vigas_secundaria,
      luz_tipica_m: luz_sec,
    };
  }

  // -----------------------------------------------------------------
  // 3) Predimensionado de columnas
  // -----------------------------------------------------------------
  // Área tributaria = (ancho/2)·(luz_principal/2) por columna esquinera;
  // para predimensionado usamos columna interior con A_trib ≈ luz × ancho.
  // # columnas estimadas: rejilla de 4 m × 4 m sobre el rectángulo.
  const sep_col_m = Math.min(4, B_plan);
  const n_col_x = Math.max(2, Math.ceil(B_plan / sep_col_m) + 1);
  const n_col_y = Math.max(2, Math.ceil(L_plan / sep_col_m) + 1);
  const cantidad_columnas = n_col_x * n_col_y;

  // Área tributaria por columna interior ≈ A_planta / cantidad
  const A_trib_m2 = A / Math.max(1, cantidad_columnas - Math.round(0.5 * (n_col_x + n_col_y)));
  // Carga última factorizada CSCR §6: 1.2·CP + 1.6·CV por nivel
  const wu_kg_m2 = 1.2 * CP_ent + 1.6 * CV;
  const Pu_kg = wu_kg_m2 * A_trib_m2 * numPisos;
  const Pu_ton = Pu_kg / 1000;

  // Ag_req = Pu / (0.30·f'c)  → fc en kg/cm², Pu en kg
  const Ag_req_cm2 = Pu_kg / (0.30 * fc);
  const lado_req_cm = Math.sqrt(Ag_req_cm2);

  // Mínimos CSCR §17
  const lado_min = numPisos === 2 ? 30 : 25;
  const lado_col = Math.max(lado_min, Math.ceil(lado_req_cm / 5) * 5);

  // Refuerzo: ρ ≈ 0.015 (mínimo seguro CSCR § 8.6: 1% a 6%)
  const As_col_req = 0.015 * lado_col * lado_col;
  const refCol = escogerBarras(As_col_req, 4);
  // forzar a múltiplo de 4 para simetría
  const n_col_bars = Math.max(4, Math.ceil(refCol.n / 4) * 4);

  const columnas: ElementoColumna = {
    tipo: `${lado_col}×${lado_col} cm`,
    b_cm: lado_col,
    h_cm: lado_col,
    refuerzo: `${n_col_bars} #${refCol.size}`,
    estribos: zonaSismica >= 3
      ? `#3 @ 10 cm (Lo = ${Math.max(45, lado_col)} cm) · @ ${Math.min(15, lado_col / 2)} cm centro`
      : `#3 @ 15 cm`,
    cantidad: cantidad_columnas,
    Pu_servicio_ton: Pu_ton,
  };

  // -----------------------------------------------------------------
  // 4) Predimensionado de losas
  // -----------------------------------------------------------------
  // La losa apoya en vigas a separación ≈ luz_principal_m, no en el
  // perímetro completo. Usamos esa luz como L_corto.
  const rel_lados = B_plan / L_plan;
  const losa_tipo: "1dir" | "2dir" = rel_lados >= 0.5 ? "2dir" : "1dir";
  const L_losa_m = luz_principal_m; // separación entre vigas

  let espesor_losa_cm: number;
  if (losa_tipo === "2dir") {
    espesor_losa_cm = Math.max(10, Math.ceil((L_losa_m * 100) / 30));
  } else {
    espesor_losa_cm = Math.max(10, Math.ceil((L_losa_m * 100) / 24));
  }

  // Refuerzo: As_min = 0.0018·b·h (retracción) para fy 4200
  // Por franja de 1 m: 0.0018·100·h
  const As_min_losa = 0.0018 * 100 * espesor_losa_cm;
  // típicamente #4 @ 20 (1.27/20·100 = 6.35 cm²/m) o #3 @ 15
  let refuerzo_losa: string;
  if (As_min_losa <= 0.71 * 100 / 20) {
    refuerzo_losa = `#3 @ 20 cm (ambas direcciones)`;
  } else if (As_min_losa <= 1.27 * 100 / 20) {
    refuerzo_losa = `#4 @ 20 cm (ambas direcciones)`;
  } else {
    refuerzo_losa = `#4 @ 15 cm (ambas direcciones)`;
  }

  const losas: ElementoLosa = {
    tipo: losa_tipo,
    espesor_cm: espesor_losa_cm,
    refuerzo: refuerzo_losa,
    area_total_m2: A * numPisos, // entrepiso(s) + techo si losa
  };

  // -----------------------------------------------------------------
  // 5) Predimensionado de zapatas
  // -----------------------------------------------------------------
  let zapatas: ElementoZapata;
  if (sistema === "mamposteria_confinada") {
    // Cimiento corrido bajo muros: ancho B = w_lineal / qa
    // Ancho mínimo CSCR-10 §17.10: 40 cm; peralte mínimo 30 cm.
    const w_muro_kg_m = (CP_ent + CV) * (B_plan / 2); // peso unitario por metro lineal
    const B_zap_m = Math.max(0.4, Math.ceil((w_muro_kg_m / 1000 / qa_ton_m2) * 10) / 10);
    const h_zap_cm = Math.max(30, Math.ceil(B_zap_m * 100 / 4 / 5) * 5);
    const longitud_total_m = 2 * (B_plan + L_plan); // perímetro aprox

    zapatas = {
      tipo: "corrida",
      dimensiones: `${B_zap_m.toFixed(2)} m × ${h_zap_cm} cm (${longitud_total_m.toFixed(1)} m total)`,
      refuerzo: `Long: 4 #4 · Trans: #3 @ 20 cm`,
      cantidad: 1, // cimiento continuo
      B_m: B_zap_m,
      L_m: longitud_total_m,
      h_cm: h_zap_cm,
    };
  } else {
    // Zapata aislada bajo cada columna
    // B = √(Pu/qa). Pu en ton, qa en ton/m² → B en m.
    const B_zap_m = Math.max(1.0, Math.ceil(Math.sqrt(Pu_ton / qa_ton_m2) * 10) / 10);
    const h_zap_cm = Math.max(30, Math.ceil((B_zap_m * 100) / 4 / 5) * 5);

    // Refuerzo: As_min = 0.0018·b·h por dirección, expresado por metro
    const As_zap = 0.0018 * 100 * h_zap_cm; // cm²/m
    let refZap: string;
    if (As_zap <= 1.27 * 100 / 20) refZap = `#4 @ 20 cm (ambas direcciones)`;
    else if (As_zap <= 1.98 * 100 / 20) refZap = `#5 @ 20 cm (ambas direcciones)`;
    else refZap = `#5 @ 15 cm (ambas direcciones)`;

    zapatas = {
      tipo: "aislada",
      dimensiones: `${B_zap_m.toFixed(2)}×${B_zap_m.toFixed(2)}×${(h_zap_cm / 100).toFixed(2)} m`,
      refuerzo: refZap,
      cantidad: cantidad_columnas,
      B_m: B_zap_m,
      L_m: B_zap_m,
      h_cm: h_zap_cm,
    };
  }

  // -----------------------------------------------------------------
  // 6) Mampostería confinada (CSCR §10 + §17.9)
  // -----------------------------------------------------------------
  let muros: ElementoMuros | null = null;
  if (sistema === "mamposteria_confinada" || sistema === "mixto") {
    const H_muro = altura_piso_m;
    // Espesor mínimo: max(15 cm, H/25)
    const t_min_cm = Math.max(15, Math.ceil((H_muro * 100) / 25));
    const espesor_muro = t_min_cm <= 15 ? 15 : t_min_cm <= 20 ? 20 : 25;

    // Separación máxima de columnas: min(4 m, 25·t)
    const s_max_m = Math.min(4, (25 * espesor_muro) / 100);

    // Longitud total de muros = perímetro + ejes interiores
    const longitud_muros = 2 * (B_plan + L_plan) + Math.max(0, L_plan - 2) * (numPisos === 2 ? 1.5 : 1);

    const ref_horiz = zonaSismica >= 3 ? "2 #3 @ 60 cm de altura" : "1 #3 @ 60 cm de altura";

    muros = {
      tipo: `Bloque ${espesor_muro}×20×40 cm · f'_m = ${fm_MPa.toFixed(1)} MPa`,
      espesor_cm: espesor_muro,
      confinamientos: `Col confinamiento ${espesor_muro}×${espesor_muro} cm · 4 #4 · estribos #3 @ 20 cm · separación ≤ ${s_max_m.toFixed(1)} m`,
      vigas_corona: `${espesor_muro}×20 cm · 4 #4 · estribos #3 @ 20 cm · obligatoria por nivel`,
      refuerzo_horizontal: ref_horiz,
      longitud_total_m: longitud_muros,
    };
  }

  // -----------------------------------------------------------------
  // 7) Cantidades preliminares
  // -----------------------------------------------------------------
  // Concreto
  const vol_vigas =
    (viga_principal.b_cm / 100) * (viga_principal.h_cm / 100) *
    viga_principal.luz_tipica_m * viga_principal.cantidad * numPisos +
    (viga_secundaria
      ? (viga_secundaria.b_cm / 100) * (viga_secundaria.h_cm / 100) *
        viga_secundaria.luz_tipica_m * viga_secundaria.cantidad * numPisos
      : 0);

  const vol_columnas =
    (columnas.b_cm / 100) * (columnas.h_cm / 100) *
    altura_piso_m * cantidad_columnas * numPisos;

  const vol_losas = (espesor_losa_cm / 100) * A * numPisos;

  const vol_zapatas = zapatas.tipo === "corrida"
    ? zapatas.B_m * (zapatas.h_cm / 100) * zapatas.L_m
    : zapatas.B_m * zapatas.L_m * (zapatas.h_cm / 100) * zapatas.cantidad;

  const concreto_m3 = vol_vigas + vol_columnas + vol_losas + vol_zapatas;

  // Acero: 90 kg/m³ promedio residencial CR
  const acero_kg = concreto_m3 * 90;

  // Bloques: área de muro / 0.08 m² por bloque (15×20×40 cm visto)
  let bloque_unidades = 0;
  if (muros) {
    const longitud_muros = (muros as ElementoMuros).longitud_total_m;
    const area_muro_m2 = longitud_muros * altura_piso_m * numPisos;
    bloque_unidades = Math.round(area_muro_m2 / 0.08);
  }

  // Formaleta: superficie expuesta de vigas + columnas + losas (1 cara)
  const form_vigas =
    (2 * viga_principal.h_cm / 100 + viga_principal.b_cm / 100) *
    viga_principal.luz_tipica_m * viga_principal.cantidad * numPisos;
  const form_columnas = 4 * (columnas.b_cm / 100) * altura_piso_m * cantidad_columnas * numPisos;
  const form_losas = A * numPisos;
  const formaleta_m2 = form_vigas + form_columnas + form_losas;

  // -----------------------------------------------------------------
  // 8) Verificaciones CSCR §17 (informativas)
  // -----------------------------------------------------------------
  // §17.2 — Geometría
  verificaciones.push({
    nombre: "Altura máxima ≤ 2 pisos",
    cumple: numPisos <= 2,
    referencia: "CSCR-10 §17.2",
    detalle: `${numPisos} piso(s) — §17 aplica solo a ≤ 2 pisos.`,
  });

  // §17.3 — relación de lados
  verificaciones.push({
    nombre: "Relación largo/ancho ≤ 4",
    cumple: L_plan / B_plan <= 4,
    referencia: "CSCR-10 §17.3.2",
    detalle: `L/B = ${(L_plan / B_plan).toFixed(2)} (límite 4.0)`,
  });

  // §17.6 — peraltes mínimos de viga
  verificaciones.push({
    nombre: "Peralte viga ≥ Luz/12",
    cumple: viga_principal.h_cm / 100 >= viga_principal.luz_tipica_m / 12,
    referencia: "CSCR-10 §17.6.1",
    detalle: `h = ${viga_principal.h_cm} cm vs L/12 = ${Math.ceil(viga_principal.luz_tipica_m * 100 / 12)} cm`,
  });

  // §17.7 — columnas mínimas
  verificaciones.push({
    nombre: `Columna ≥ ${lado_min} cm`,
    cumple: lado_col >= lado_min,
    referencia: "CSCR-10 §17.7.1",
    detalle: `${lado_col}×${lado_col} cm (mín ${lado_min} cm para ${numPisos} piso${numPisos > 1 ? "s" : ""})`,
  });

  // §17.4 — peso sísmico y cortante basal
  verificaciones.push({
    nombre: "Cortante basal V = Cs·W calculado",
    cumple: true,
    referencia: "CSCR-10 §17.4-§17.5",
    detalle: `V = ${V_basal_ton.toFixed(2)} ton (Cs = ${Cs.toFixed(3)}, W = ${W_ton.toFixed(2)} ton)`,
  });

  // §17.9 — mampostería confinada: espesor mínimo
  if (muros) {
    verificaciones.push({
      nombre: "Espesor muro ≥ max(15 cm, H/25)",
      cumple: muros.espesor_cm >= Math.max(15, Math.ceil((altura_piso_m * 100) / 25)),
      referencia: "CSCR-10 §10.4.1 + §17.9",
      detalle: `t = ${muros.espesor_cm} cm; H/25 = ${((altura_piso_m * 100) / 25).toFixed(1)} cm`,
    });
    verificaciones.push({
      nombre: "Viga corona obligatoria por nivel",
      cumple: true,
      referencia: "CSCR-10 §10.5.3",
      detalle: muros.vigas_corona,
    });
  }

  // §6 — combinaciones de carga aplicadas
  verificaciones.push({
    nombre: "Combinación 1.2CP + 1.6CV usada en columnas",
    cumple: true,
    referencia: "CSCR-10 §6.2.2 (LC-2)",
    detalle: `wu = ${wu_kg_m2.toFixed(0)} kg/m² · A_trib = ${A_trib_m2.toFixed(1)} m² · Pu = ${Pu_ton.toFixed(2)} ton`,
  });

  // -----------------------------------------------------------------
  // 9) Advertencias
  // -----------------------------------------------------------------
  if (zonaSismica === 4 && fc < 245) {
    warnings.push("Zona IV: CSCR-10 §8 exige f'c ≥ 245 kg/cm². Aumenta f'c.");
  }
  if (zonaSismica === 4 && sistema === "mamposteria_confinada" && numPisos === 2) {
    warnings.push("Mampostería confinada de 2 pisos en zona IV: revisar muros con cálculo detallado /studio/confined-masonry.");
  }
  if (L_plan / B_plan > 4) {
    warnings.push("L/B > 4: la planta es muy alargada. §17.3.2 exige juntas estructurales o análisis dinámico (no diseño simplificado).");
  }
  if (qa_ton_m2 < 5) {
    warnings.push(`qa = ${qa_ton_m2} ton/m² es bajo. Considera mejoramiento de suelo o pilotes (ver /studio/pile-cap).`);
  }
  if (numPisos === 2 && A > 200) {
    warnings.push("Casa de 2 pisos > 200 m²: revisa cargas reales por nivel (esta estimación promedia entrepiso + techo).");
  }
  if (sistema === "marcos_concreto" && zonaSismica >= 3) {
    warnings.push("Marcos de concreto en zona III/IV requieren detallado dúctil ACI §18 / CSCR §8.3. Verifica /studio/beam-column-joint.");
  }

  // -----------------------------------------------------------------
  return {
    input,
    cargas: {
      CP_kg_m2,
      CV_kg_m2: CV,
      W_total_ton: W_ton,
      Cs,
      V_basal_ton,
    },
    elementos: {
      vigas: {
        principal: viga_principal,
        secundaria: viga_secundaria,
      },
      columnas,
      losas,
      zapatas,
      muros,
    },
    cantidades: {
      concreto_m3: Math.round(concreto_m3 * 10) / 10,
      acero_kg: Math.round(acero_kg),
      bloque_unidades,
      formaleta_m2: Math.round(formaleta_m2),
    },
    verificaciones,
    warnings,
  };
}

// Re-export helpers para que la UI pueda mostrar áreas exactas
export const _internal = { areaBarra, pesoBarra, escogerBarras, tablaCs };
