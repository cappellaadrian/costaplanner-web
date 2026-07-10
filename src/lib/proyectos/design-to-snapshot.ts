/**
 * design-to-snapshot — shared helper for converting a saved StructuralDesign
 * payload into a DesignSnapshot ready for any project-level exporter
 * (PDF, Excel, …).
 *
 * Extracted from `/proyectos/[id]/memoria/page.tsx` so that other consumers
 * (e.g. the Excel exporter at `/proyectos/[id]/memoria-excel`) can re-use
 * the exact same conversion logic — no duplication, no drift.
 *
 * NOTE: This is the project-level converter (slugs from the design name,
 * element-registry dispatch). The single-element exporters call
 * buildSnapshot() directly from within each studio page.
 */
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import type { DesignSnapshot } from "@/lib/exporters/types";
import { lookupEntryByName } from "@/lib/element-registry";

// ─── Re-exported types ─────────────────────────────────────────────────────

export interface ProjectMeta {
  address?: string;
  province?: string;
  canton?: string;
  owner?: string;
  engineerName?: string;
  cfiaCode?: string;
  numFloors?: number;
  grossArea_m2?: number;
  buildingUse?: string;
  structuralSystem?: string;
  zonaSismica?: 1 | 2 | 3 | 4;
  fc_default?: number;
  fy_default?: number;
  qa_ton_m2?: number;
  phi_deg?: number;
  c_kPa?: number;
  gamma_kN_m3?: number;
  waterTable_m?: number;
  notes?: string;
}

export interface FullDesign {
  id: string;
  name: string;
  archJson: Record<string, unknown>;
  structJson: Record<string, unknown>;
  resultJson: Record<string, unknown>;
}

export interface DesignToSnapshotResult {
  snapshot: DesignSnapshot | null;
  reason?: string;
}

// ─── Internal helpers (same shape as the original memoria/page.tsx code) ──

/** Read the LiveResult out of a saved resultJson, dealing with the few
 *  studio-specific wrapper shapes. Returns null when nothing usable is found. */
function extractLiveResult(
  resultJson: Record<string, unknown>,
): Record<string, unknown> | null {
  // Beam studio writes { project, materials, results: [{ live }], summary }
  const results = (resultJson as { results?: unknown }).results;
  if (Array.isArray(results) && results.length > 0) {
    const first = results[0] as { live?: unknown };
    if (first && typeof first.live === "object" && first.live !== null) {
      return first.live as Record<string, unknown>;
    }
  }
  // Most studios write { ...liveResult, summary } — strip summary and return the rest.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { summary, ...rest } = resultJson as Record<string, unknown> & {
    summary?: unknown;
  };
  if (Object.keys(rest).length === 0) return null;
  return rest;
}

/** Turn an array of input scalars into the "Datos de entrada" table rows. */
function flattenInputs(
  structJson: Record<string, unknown>,
): Array<{ name: string; value: number | string; unit?: string }> {
  const rows: Array<{ name: string; value: number | string; unit?: string }> = [];
  for (const [k, v] of Object.entries(structJson)) {
    if (v == null) continue;
    if (typeof v === "number" || typeof v === "string") {
      rows.push({ name: k, value: v });
    }
    // Skip nested objects — they'd need element-specific knowledge to render well.
  }
  return rows.slice(0, 20); // cap to keep export tidy
}

/** Pretty title for the section header. Prefer the user-saved design name; if
 *  it ends in a date suffix " — YYYY-MM-DD" strip it for the heading. */
function titleFromDesign(d: FullDesign, fallbackLabel: string): string {
  const stripped = d.name.replace(/\s*—\s*\d{4}-\d{2}-\d{2}\s*$/, "").trim();
  if (!stripped) return fallbackLabel;
  return stripped;
}

// ─── Public conversion ─────────────────────────────────────────────────────

/**
 * Re-derives a DesignSnapshot from a saved StructuralDesign + project meta.
 *
 * Behavior matches what /proyectos/[id]/memoria/page.tsx used to do inline:
 *  - Slug lookup via element-registry by design.name
 *  - Live-result extraction (beam studio wrapper, summary stripping)
 *  - Steps + checks rebuilt through the registry dispatchers
 *  - Materials sourced from project meta first, design as fallback, defaults last
 *
 * Returns { snapshot: null, reason } when the design isn't usable
 * (unknown slug / empty resultJson). Callers display the reason as a
 * "omitted" line item.
 */
export function designToSnapshot(
  design: FullDesign,
  projectMeta: ProjectMeta,
  projectName: string,
): DesignToSnapshotResult {
  const entry = lookupEntryByName(design.name);
  if (!entry) {
    return { snapshot: null, reason: `Slug no reconocido en "${design.name}"` };
  }
  const liveResult = extractLiveResult(design.resultJson);
  if (!liveResult) {
    return { snapshot: null, reason: `resultJson vacío en "${design.name}"` };
  }

  // Re-derive steps + checks from the LiveResult via the registry.
  let steps: ReturnType<typeof entry.buildSteps> = [];
  let checks: ReturnType<typeof entry.buildChecks> = [];
  try {
    steps = entry.buildSteps(liveResult);
  } catch (e) {
    console.warn(`buildSteps failed for ${entry.slug}:`, e);
  }
  try {
    checks = entry.buildChecks(liveResult);
  } catch (e) {
    console.warn(`buildChecks failed for ${entry.slug}:`, e);
  }

  // Materials: project meta is the single source of truth.
  const fcFromStruct =
    (design.structJson as { fc?: number }).fc ??
    (liveResult as { fc?: number }).fc;
  const fyFromStruct =
    (design.structJson as { fy?: number }).fy ??
    (liveResult as { fy?: number }).fy;
  const fc = projectMeta.fc_default ?? fcFromStruct ?? 245;
  const fy = projectMeta.fy_default ?? fyFromStruct ?? 4200;

  const inputs = flattenInputs(design.structJson);

  const snapshot = buildSnapshot({
    title: titleFromDesign(design, entry.label),
    elementType: entry.slug,
    projectName,
    canton: projectMeta.canton,
    zonaSismica: projectMeta.zonaSismica,
    engineer: projectMeta.engineerName,
    cfia: projectMeta.cfiaCode,
    fc,
    fy,
    aceroNorma: (projectMeta.zonaSismica ?? 2) >= 3 ? "A706" : "A615",
    inputs,
    steps,
    checks,
    notes: [`Elemento del registro: ${entry.label} (${entry.category})`],
  });
  return { snapshot };
}
