/**
 * cfia-audit.ts — shared CFIA-readiness checklist for a DesignProject.
 *
 * Mirrors the 10-row "Listo para CFIA" audit that lives inline in
 * /proyectos/[id]. Pulled into a lib so /mis-disenos can compute X / Y per
 * project card without duplicating the rules.
 *
 * Rules are intentionally simple — name LIKE matching on the design name
 * (because `Save` writes names like "beam — 2026-05-18"). When the data model
 * gains a proper elementType column, swap the matching strategy and the call
 * sites stay the same.
 */

export interface CfiaAuditMeta {
  zonaSismica?: 1 | 2 | 3 | 4;
  fc_default?: number;
  fy_default?: number;
  engineerName?: string;
  cfiaCode?: string;
  memoriaGeneratedAt?: string;
}

export interface CfiaAuditDesign {
  name: string;
}

export interface CfiaAuditResult {
  rows: Array<{ label: string; state: "ok" | "fail" | "na" }>;
  completed: number;
  total: number;
  pct: number;
  /** "ok" once ≥ 8 applicable rows pass, "review" 5-7, "fail" below. */
  band: "ok" | "review" | "fail";
}

/** Case-insensitive: does ANY design name contain `key`? */
function hasDesign(designs: CfiaAuditDesign[], key: string): boolean {
  const lk = key.toLowerCase();
  return designs.some((d) => d.name.toLowerCase().includes(lk));
}

export function computeCfiaAudit(
  meta: CfiaAuditMeta | null | undefined,
  designs: CfiaAuditDesign[],
): CfiaAuditResult {
  const m = meta ?? {};

  const hasGeotech =
    hasDesign(designs, "spt") ||
    hasDesign(designs, "cpt") ||
    hasDesign(designs, "capacidad-portante");

  const hasFoundation = [
    "isolated-footing",
    "strip-footing",
    "combined-footing",
    "mat-foundation",
    "pile-cap",
  ].some((k) => hasDesign(designs, k));

  const hasVertical = [
    "rectangular-column",
    "circular-column",
    "shear-wall",
    "confined-masonry",
  ].some((k) => hasDesign(designs, k));

  const hasHorizontal = ["beam", "one-way-slab", "two-way-slab"].some((k) =>
    hasDesign(designs, k),
  );

  // Joint check only mandated in zones III/IV (CSCR-10 §8.6).
  const seismicZone = m.zonaSismica ?? 2;
  const needsSeismicCheck = seismicZone >= 3;
  const hasJoint = hasDesign(designs, "beam-column-joint");
  const seismicState: "ok" | "fail" | "na" = needsSeismicCheck
    ? hasJoint
      ? "ok"
      : "fail"
    : "na";

  const hasDetailing = hasDesign(designs, "desarrollo-empalmes");
  const hasLoadCombinations = typeof m.zonaSismica === "number";
  const hasMaterials =
    typeof m.fc_default === "number" && typeof m.fy_default === "number";
  const hasProfessional =
    Boolean(m.engineerName?.trim()) && Boolean(m.cfiaCode?.trim());
  const hasMemoriaGenerated = m.memoriaGeneratedAt != null;

  const rows: CfiaAuditResult["rows"] = [
    { label: "Geotecnia (SPT/CPT o capacidad portante)", state: hasGeotech ? "ok" : "fail" },
    { label: "Cimentación (zapata / mat / pile-cap)", state: hasFoundation ? "ok" : "fail" },
    { label: "Estructura vertical (columna o muro)", state: hasVertical ? "ok" : "fail" },
    { label: "Estructura horizontal (viga o losa)", state: hasHorizontal ? "ok" : "fail" },
    { label: "Verificaciones sísmicas (zona III/IV)", state: seismicState },
    { label: "Detallado (longitudes de desarrollo)", state: hasDetailing ? "ok" : "fail" },
    { label: "Cargas y combinaciones (zona sísmica)", state: hasLoadCombinations ? "ok" : "fail" },
    { label: "Materiales (f'c + fy)", state: hasMaterials ? "ok" : "fail" },
    { label: "Responsable profesional (ingeniero + CFIA)", state: hasProfessional ? "ok" : "fail" },
    { label: "Memoria PDF generada", state: hasMemoriaGenerated ? "ok" : "fail" },
  ];

  const applicable = rows.filter((r) => r.state !== "na");
  const completed = applicable.filter((r) => r.state === "ok").length;
  const total = applicable.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  let band: "ok" | "review" | "fail";
  if (completed >= 8) band = "ok";
  else if (completed >= 5) band = "review";
  else band = "fail";

  return { rows, completed, total, pct, band };
}
