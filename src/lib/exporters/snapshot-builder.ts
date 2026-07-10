/**
 * Snapshot builders — turn any element's LiveResult + inputs + steps + checks
 * into a DesignSnapshot ready for PDF/Excel export.
 *
 * Each element page imports `buildSnapshotFor*` here and passes the closure
 * to <ExportToolbar/>. This keeps export logic in ONE place instead of
 * scattered per-page handlers.
 */

import type { CalculationStep } from "@/lib/beam-flexure-live";
import type { DesignSnapshot, SnapshotDiagram } from "./types";

interface ChecksLike {
  nombre: string;
  requerido: number;
  disponible: number;
  unidad: string;
  cumple: boolean;
  referencia: string;
}

interface ReinforcementLike {
  longitudinal?: Array<{ n: number | string; size: number; As_total: number; position: string }>;
  transversal?: Array<{ size: number; separacion_cm: number; zona: string; ramas: number }>;
}

interface BuildArgs {
  title: string;
  elementType: string;
  projectName?: string;
  canton?: string;
  zonaSismica?: number | string;
  engineer?: string;
  cfia?: string;
  fc: number;
  fy: number;
  aceroNorma?: string;
  /** Echo of inputs the user typed. */
  inputs: Array<{ name: string; value: number | string; unit?: string }>;
  steps: CalculationStep[];
  checks: ChecksLike[];
  reinforcement?: ReinforcementLike;
  notes?: string[];
  diagrams?: SnapshotDiagram[];
}

export function buildSnapshot(args: BuildArgs): DesignSnapshot {
  return {
    title: args.title,
    elementType: args.elementType,
    project: {
      name: args.projectName ?? "Proyecto sin nombre",
      canton: args.canton,
      zona_sismica: args.zonaSismica,
      engineer: args.engineer,
      cfia_code: args.cfia,
    },
    materials: {
      fc: args.fc,
      fy: args.fy,
      acero_norma: args.aceroNorma,
    },
    inputs: args.inputs,
    steps: args.steps,
    checks: args.checks.map((c) => ({
      nombre: c.nombre,
      requerido: c.requerido,
      disponible: c.disponible,
      unidad: c.unidad,
      cumple: c.cumple,
      referencia: c.referencia,
    })),
    reinforcement: args.reinforcement
      ? {
          longitudinal: args.reinforcement.longitudinal?.map((b) => ({
            n: typeof b.n === "number" ? b.n : 0,
            size: b.size,
            As_total: b.As_total,
            position: b.position,
          })),
          transversal: args.reinforcement.transversal?.map((s) => ({
            size: s.size,
            separacion: s.separacion_cm,
            ramas: s.ramas,
            zona: s.zona,
          })),
        }
      : undefined,
    notes: args.notes,
    diagrams: args.diagrams,
  };
}
