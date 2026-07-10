/**
 * Quantities extraction — derives material takeoffs from a saved design.
 *
 * Used as the bridge between Costaplanner (design) and REVARA (estimating).
 * No new math: we re-read the geometry + reinforcement that's already on the
 * StructuralDesign record and project them into a normalized BoQ-friendly
 * shape:
 *   - rebar:    [{ size, weight_kg, length_m, bar_count }]
 *   - concrete: { volume_m3 }
 *   - formwork: { area_m2 }
 *
 * REVARA imports this and creates BoqPosition rows. Pricing/markup is
 * REVARA's job; we just hand over the quantities.
 *
 * Bar unit weights (kg/m) from materials.py:
 *   #3=0.560, #4=0.994, #5=1.552, #6=2.235, #7=3.042,
 *   #8=3.973, #9=5.060, #10=6.404, #11=7.907
 */

const BAR_UNIT_WEIGHT_KG_PER_M: Record<number, number> = {
  3: 0.560, 4: 0.994, 5: 1.552, 6: 2.235, 7: 3.042,
  8: 3.973, 9: 5.060, 10: 6.404, 11: 7.907, 14: 11.380, 18: 20.240,
};

export interface RebarLine {
  size: number;            // #3, #4, ...
  bar_count: number;       // total pieces in this group
  length_m: number;        // length per piece (m)
  total_length_m: number;  // bar_count * length_m
  weight_kg: number;       // total_length_m * unit weight
  description: string;     // e.g. "longitudinal superior 4#7 L=6.25m"
}

export interface Quantities {
  rebar: RebarLine[];
  concrete_m3: number;
  formwork_m2: number;
}

interface BeamSavedDesign {
  archJson: {
    elements?: {
      beams?: Array<{
        id: string;
        start: [number, number];
        end: [number, number];
        section: { width_mm: number; depth_mm: number };
      }>;
    };
  };
  resultJson: {
    results: Array<{
      element_id: string;
      element_type?: string;
      refuerzo: {
        longitudinal: Array<{ n: number; size: number; As_total: number; position?: string }>;
        transversal: Array<{ size: number; separacion: number; ramas: number; zona: string }>;
      };
    }>;
  };
}

/**
 * Pull quantities out of a saved beam design.
 *
 * The result is element-keyed so multi-element designs (future) can append
 * directly. For now we expect one beam V-1.
 *
 * Returns null if the design isn't a beam (caller falls back to the
 * generic per-element extractor when ported).
 */
export function extractBeamQuantities(
  design: BeamSavedDesign,
): Quantities | null {
  const beam = design.archJson.elements?.beams?.[0];
  const result = design.resultJson.results?.[0];
  if (!beam || !result) return null;

  // Geometry — width/height in mm, span from start/end.
  const widthMm = beam.section.width_mm;
  const heightMm = beam.section.depth_mm;
  const spanMm = Math.hypot(
    beam.end[0] - beam.start[0],
    beam.end[1] - beam.start[1],
  );

  const widthM = widthMm / 1000;
  const heightM = heightMm / 1000;
  const spanM = spanMm / 1000;

  const concrete_m3 = widthM * heightM * spanM;
  // Formwork: 2 sides + bottom (top is typically poured open if slab caps).
  const formwork_m2 = 2 * heightM * spanM + widthM * spanM;

  // Longitudinal rebar: each BarSet has n bars running the full span.
  // We add 25 cm of lap per end as a CR-standard allowance (0.5 m total).
  const rebar: RebarLine[] = [];
  const lapAllowanceM = 0.5;
  const lengthPerBarM = spanM + lapAllowanceM;

  for (const long of result.refuerzo.longitudinal ?? []) {
    const unitW = BAR_UNIT_WEIGHT_KG_PER_M[long.size] ?? 0;
    rebar.push({
      size: long.size,
      bar_count: long.n,
      length_m: lengthPerBarM,
      total_length_m: long.n * lengthPerBarM,
      weight_kg: long.n * lengthPerBarM * unitW,
      description: `${long.position ?? "longitudinal"}: ${long.n}#${long.size} L=${lengthPerBarM.toFixed(2)} m`,
    });
  }

  // Transversal (estribos): count stirrups per zone.
  // CR convention: stirrup perimeter ≈ 2(b + h) - 8(recubrimiento)
  //              ≈ 2(widthM + heightM) - 0.32 m (4 cm cover all 4 sides)
  const stirrupPerimeterM = Math.max(
    2 * (widthM + heightM) - 0.32 - 0.04, // - one #4 db approx
    0.6,
  );

  for (const stir of result.refuerzo.transversal ?? []) {
    // Each "zone" gets stirrups spaced at stir.separacion across some length.
    // For zone naming "confinada_izq"/"confinada_der" lo ≈ 2h on each end,
    // central spans the rest. Without finer geometry, attribute confined
    // zones to 2h each (0.4 * span as a conservative default) and central to
    // the remainder.
    const isConfined = /confin/i.test(stir.zona);
    const zoneLengthM = isConfined ? 2 * heightM : Math.max(spanM - 4 * heightM, 0);
    const spacingM = stir.separacion / 100; // cm → m
    const stirrupsCount = spacingM > 0
      ? Math.ceil(zoneLengthM / spacingM) + 1
      : 0;
    if (stirrupsCount === 0) continue;
    const totalLengthM = stirrupsCount * stirrupPerimeterM;
    const unitW = BAR_UNIT_WEIGHT_KG_PER_M[stir.size] ?? 0;
    rebar.push({
      size: stir.size,
      bar_count: stirrupsCount,
      length_m: stirrupPerimeterM,
      total_length_m: totalLengthM,
      weight_kg: totalLengthM * unitW,
      description: `estribos ${stir.zona}: ${stirrupsCount} #${stir.size} @ ${stir.separacion} cm`,
    });
  }

  return {
    rebar,
    concrete_m3,
    formwork_m2,
  };
}

/**
 * Dispatch by element type. Currently only beam is implemented; others
 * return null and the caller should show "Cantidades no disponibles".
 */
export function extractQuantities(
  design: BeamSavedDesign,
): Quantities | null {
  const first = design.resultJson?.results?.[0];
  const elementType = first?.element_type ?? "beam";
  if (elementType === "beam") return extractBeamQuantities(design);
  return null;
}

/** Helper for REVARA's BoQ import. Flattens quantities into BoqPosition rows. */
export interface BoqPositionDraft {
  description: string;
  quantity: number;
  unit: string;
  category: "concrete" | "rebar" | "formwork";
}

export function quantitiesToBoqRows(q: Quantities): BoqPositionDraft[] {
  const rows: BoqPositionDraft[] = [];
  if (q.concrete_m3 > 0) {
    rows.push({
      description: "Concreto estructural",
      quantity: Number(q.concrete_m3.toFixed(3)),
      unit: "m³",
      category: "concrete",
    });
  }
  if (q.formwork_m2 > 0) {
    rows.push({
      description: "Encofrado (formaleta)",
      quantity: Number(q.formwork_m2.toFixed(2)),
      unit: "m²",
      category: "formwork",
    });
  }
  // Group rebar by size — REVARA users typically order by bar size.
  const rebarBySize = new Map<number, number>();
  for (const r of q.rebar) {
    rebarBySize.set(r.size, (rebarBySize.get(r.size) ?? 0) + r.weight_kg);
  }
  rebarBySize.forEach((kg, size) => {
    rows.push({
      description: `Acero de refuerzo #${size}`,
      quantity: Number(kg.toFixed(2)),
      unit: "kg",
      category: "rebar",
    });
  });
  return rows;
}
