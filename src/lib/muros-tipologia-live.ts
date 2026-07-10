/**
 * Selección de tipología de muro de contención — decision support
 * tree multi-criterio.
 *
 * Sources:
 * - Das, B.M. (2010). Principles of Foundation Engineering, 7ed §13.
 * - AASHTO LRFD Bridge Design (2017) §11 — Retaining Walls.
 * - NCMA TR-127B — Segmental Retaining Wall Design Manual.
 * - FHWA-NHI-10-024 — Design and Construction of MSE Walls.
 * - Coduto (2001) — Foundation Design §23.
 * - Código de Cimentaciones de Costa Rica (2009) §7 — muros.
 * - CSCR-10 Rev. 2014 §6 — sismo para muros.
 */

export type SuelosAtras = "arena" | "arcilla" | "granular_grueso";
export type Presupuesto = "low" | "medium" | "high";
export type ZonaSismica = 1 | 2 | 3 | 4;

export interface WallInput {
  /** Altura H (m). */
  H_m: number;
  /** Tipo de suelo retenido. */
  suelo_atras: SuelosAtras;
  /** Espacio disponible para talón / pie posterior (m). */
  espacio_atras_m: number;
  /** Presupuesto disponible. */
  presupuesto: Presupuesto;
  /** Zona sísmica CR (1-4). */
  zona_sismica: ZonaSismica;
  /** ¿Agua freática presente? */
  agua_freatica: boolean;
}

export type TipoMuro =
  | "voladizo"
  | "contrafuertes"
  | "gravedad"
  | "gaviones"
  | "anclado"
  | "tierra_armada";

export interface WallScore {
  tipo: TipoMuro;
  /** Nombre legible. */
  nombre: string;
  /** Descripción corta. */
  descripcion: string;
  /** Score 0-10 (mayor = mejor para este caso). */
  score: number;
  /** Razones del score por dimensión. */
  breakdown: {
    altura: number;
    suelo: number;
    espacio: number;
    costo: number;
    sismo: number;
    agua: number;
  };
  /** Justificación textual. */
  justificacion: string[];
  /** Referencias específicas. */
  refs: string[];
}

export interface WallResult {
  ranking: WallScore[];
  recomendacion: WallScore;
  citations: string[];
  warnings: string[];
}

interface WallType {
  tipo: TipoMuro;
  nombre: string;
  descripcion: string;
  /** Rango óptimo de altura. */
  H_min: number;
  H_max: number;
  /** Sueles preferidos (peso 0-1). */
  suelos: Record<SuelosAtras, number>;
  /** Espacio mínimo recomendado (m) detrás. */
  espacio_min: number;
  /** Costo relativo: 1 (low) - 3 (high). */
  costo_rel: number;
  /** Robustez sísmica: 0-10. */
  sismo_robustness: number;
  /** Tolerancia a agua freática: 0-10. */
  agua_tol: number;
  refs: string[];
}

const TYPES: WallType[] = [
  {
    tipo: "voladizo",
    nombre: "Muro en voladizo (concreto reforzado)",
    descripcion: "Concrete cantilever. Talón posterior provee estabilidad. Versátil y económico para alturas moderadas.",
    H_min: 1.5, H_max: 8,
    suelos: { arena: 1.0, arcilla: 0.7, granular_grueso: 0.9 },
    espacio_min: 1.5,
    costo_rel: 2,
    sismo_robustness: 7,
    agua_tol: 6,
    refs: ["Das (2010) §13", "AASHTO LRFD §11.6", "Código Cimentaciones CR (2009) §7"],
  },
  {
    tipo: "contrafuertes",
    nombre: "Muro con contrafuertes",
    descripcion: "Concrete con contrafuertes verticales en la cara posterior. Económico para H > 6 m.",
    H_min: 6, H_max: 12,
    suelos: { arena: 1.0, arcilla: 0.7, granular_grueso: 0.9 },
    espacio_min: 1.5,
    costo_rel: 2,
    sismo_robustness: 8,
    agua_tol: 6,
    refs: ["Das (2010) §13.5", "AASHTO LRFD §11.6"],
  },
  {
    tipo: "gravedad",
    nombre: "Muro de gravedad (concreto / mampostería)",
    descripcion: "Resiste por su propio peso. Económico para H ≤ 4 m; requiere ancho de base 0.4-0.6·H.",
    H_min: 0.5, H_max: 4,
    suelos: { arena: 1.0, arcilla: 0.6, granular_grueso: 1.0 },
    espacio_min: 0.5,
    costo_rel: 1,
    sismo_robustness: 5,
    agua_tol: 7,
    refs: ["Das (2010) §13.2", "Coduto (2001) §23.2"],
  },
  {
    tipo: "gaviones",
    nombre: "Muro de gaviones",
    descripcion: "Cajas de malla rellenas con piedra. Drenaje libre, fácil construcción, costo bajo.",
    H_min: 1, H_max: 6,
    suelos: { arena: 0.8, arcilla: 0.5, granular_grueso: 1.0 },
    espacio_min: 1.0,
    costo_rel: 1,
    sismo_robustness: 6,
    agua_tol: 10,
    refs: ["Maccaferri Gabion Manual", "Coduto (2001) §23.5"],
  },
  {
    tipo: "anclado",
    nombre: "Muro anclado (soldier piles + tirantes)",
    descripcion: "Pilotes con anclajes activos. Para H > 10 m o espacios estrechos. Requiere monitoreo.",
    H_min: 6, H_max: 25,
    suelos: { arena: 0.9, arcilla: 0.8, granular_grueso: 1.0 },
    espacio_min: 0.3,
    costo_rel: 3,
    sismo_robustness: 8,
    agua_tol: 7,
    refs: ["FHWA-IF-99-015", "AASHTO LRFD §11.9", "Sabatini et al. (1999)"],
  },
  {
    tipo: "tierra_armada",
    nombre: "Tierra armada (MSE / muro mecánicamente estabilizado)",
    descripcion: "Refuerzos geosintéticos en relleno granular. Económico para H 3-12 m.",
    H_min: 3, H_max: 12,
    suelos: { arena: 1.0, arcilla: 0.4, granular_grueso: 1.0 },
    espacio_min: 0.8,
    costo_rel: 2,
    sismo_robustness: 9,
    agua_tol: 6,
    refs: ["FHWA-NHI-10-024", "NCMA TR-127B", "AASHTO LRFD §11.10"],
  },
];

export function computeWallSelection(input: WallInput): WallResult {
  const warnings: string[] = [];
  const citations = [
    "Das (2010) Principles of Foundation Engineering §13",
    "AASHTO LRFD §11 — Retaining Walls",
    "NCMA TR-127B",
    "FHWA-NHI-10-024",
    "Coduto (2001) §23",
    "Código de Cimentaciones de Costa Rica (2009) §7",
    "CSCR-10 Rev. 2014 §6",
  ];

  const { H_m, suelo_atras, espacio_atras_m, presupuesto, zona_sismica, agua_freatica } = input;

  if (H_m <= 0) warnings.push("Altura debe ser > 0.");
  if (H_m > 15) warnings.push(`H = ${H_m} m: muro grande, considera estudio detallado de cimentación.`);

  const presupBudget = { low: 1, medium: 2, high: 3 }[presupuesto];

  const scored: WallScore[] = TYPES.map((t) => {
    // Score per dimension (0-10 each)
    // Altura: 10 if H within optimal, decrease towards boundaries
    let altura = 0;
    if (H_m >= t.H_min && H_m <= t.H_max) {
      const mid = (t.H_min + t.H_max) / 2;
      const range = (t.H_max - t.H_min) / 2;
      altura = 10 - Math.min(10, 5 * Math.abs(H_m - mid) / range);
    } else if (H_m < t.H_min) {
      altura = Math.max(0, 5 - 2 * (t.H_min - H_m));
    } else {
      altura = Math.max(0, 5 - 2 * (H_m - t.H_max));
    }
    // Suelo
    const suelo = 10 * t.suelos[suelo_atras];
    // Espacio: full score if espacio_atras ≥ espacio_min, else linear penalty
    const espacio = espacio_atras_m >= t.espacio_min
      ? 10
      : 10 * (espacio_atras_m / t.espacio_min);
    // Costo: budget vs cost. If budget ≥ cost → 10. Else reduce.
    const costo = presupBudget >= t.costo_rel
      ? 10
      : 10 * (presupBudget / t.costo_rel);
    // Sismo: muros más robustos son mejores para zonas IV
    const sismo_demand = zona_sismica / 4; // 0.25 to 1.0
    const sismo = t.sismo_robustness * (0.5 + 0.5 * sismo_demand);
    // Agua: si hay agua, premiar tolerancia
    const agua = agua_freatica ? t.agua_tol : 8; // si no hay agua, todos parejos

    // Weighted total — altura más importante, después suelo y espacio
    const total = (
      altura * 0.25 +
      suelo * 0.15 +
      espacio * 0.20 +
      costo * 0.15 +
      sismo * 0.15 +
      agua * 0.10
    );

    const justifs: string[] = [];
    if (altura >= 8) justifs.push(`Rango de altura ideal (${t.H_min}-${t.H_max} m).`);
    else if (altura < 5) justifs.push(`H = ${H_m} m fuera del rango óptimo (${t.H_min}-${t.H_max} m).`);
    if (t.suelos[suelo_atras] >= 0.9) justifs.push(`Compatible con suelo ${suelo_atras}.`);
    else if (t.suelos[suelo_atras] < 0.6) justifs.push(`Suelo ${suelo_atras} no ideal para este tipo.`);
    if (espacio < 10) justifs.push(`Espacio atrás ${espacio_atras_m} m < ${t.espacio_min} m recomendado.`);
    if (presupBudget < t.costo_rel) justifs.push(`Presupuesto ${presupuesto} por debajo del costo típico.`);
    if (agua_freatica && t.agua_tol >= 8) justifs.push("Buen comportamiento con agua freática.");
    if (agua_freatica && t.agua_tol <= 6) justifs.push("Requiere sistema de drenaje complementario.");
    if (zona_sismica >= 3 && t.sismo_robustness >= 8) justifs.push(`Adecuado para zona sísmica ${zona_sismica}.`);

    return {
      tipo: t.tipo,
      nombre: t.nombre,
      descripcion: t.descripcion,
      score: total,
      breakdown: { altura, suelo, espacio, costo, sismo, agua },
      justificacion: justifs,
      refs: t.refs,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  if (scored[0].score < 5) {
    warnings.push("Ninguna tipología alcanza score alto. Revisar geometría y restricciones.");
  }

  return {
    ranking: scored,
    recomendacion: scored[0],
    citations,
    warnings,
  };
}
