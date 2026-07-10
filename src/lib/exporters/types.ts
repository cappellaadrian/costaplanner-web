/**
 * Shared types for studio exporters.
 *
 * Every element studio (beam, column, footing, ...) produces a normalized
 * DesignSnapshot that exporters consume. Keeps the PDF/Excel writers
 * generic over element type — they don't care if it's a beam or a column.
 */

import type { CalculationStep } from "@/lib/beam-flexure-live";

export interface DesignCheck {
  nombre: string;
  requerido: number;
  disponible: number;
  unidad: string;
  cumple: boolean;
  referencia: string;
}

export interface DesignReinforcement {
  longitudinal?: Array<{ n: number; size: number; As_total: number; position?: string }>;
  transversal?: Array<{ size: number; separacion: number; ramas: number; zona: string }>;
}

/** A rendered diagram as static SVG markup — ready to inline in printable HTML. */
export interface SnapshotDiagram {
  title: string;
  /** Raw SVG markup string (e.g. from ReactDOMServer.renderToStaticMarkup). */
  svgMarkup: string;
  /** Optional caption shown below the diagram in the PDF. */
  caption?: string;
}

export interface DesignSnapshot {
  /** Pretty element label, e.g. "Viga V-1" or "Columna C-1 (Casa Demo)". */
  title: string;
  /** Element type identifier (beam, rectangular_column, ...). */
  elementType: string;
  /** Project context for the title block. */
  project: {
    name: string;
    canton?: string;
    zona_sismica?: number | string;
    engineer?: string;
    cfia_code?: string;
  };
  /** Material strengths. */
  materials: {
    fc: number;
    fy: number;
    acero_norma?: string;
  };
  /** Echo of user inputs (key -> value, optional unit). */
  inputs: Array<{ name: string; value: number | string; unit?: string }>;
  /** Full step list for the body of the memo. */
  steps: CalculationStep[];
  /** Verifications. */
  checks: DesignCheck[];
  /** Final reinforcement design. */
  reinforcement?: DesignReinforcement;
  /** Free-form notes / warnings. */
  notes?: string[];
  /** Rendered SVG diagrams to embed in PDF/Excel exports. */
  diagrams?: SnapshotDiagram[];
}
