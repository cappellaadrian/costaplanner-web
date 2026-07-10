/**
 * element-registry.ts — centralized lookup table mapping every element
 * slug (the same slug used by SaveToProjectButton naming and by the
 * /proyectos/[id] dashboard tree) to its:
 *
 *   - compute  : the live calculator function (input -> LiveResult)
 *   - buildSteps : LiveResult -> CalculationStep[]
 *   - buildChecks: LiveResult -> DesignCheck[]
 *
 * Used primarily by the project-level memoria builder to reconstruct
 * DesignSnapshots from saved StructuralDesigns. Could also be reused
 * for future features like project-wide validation or PDF preview.
 *
 * Coverage: 35 entries — every studio currently in /studio/*.
 *
 * NOTE: A handful of geotech engines (SPT, CPT, bearing, settlement,
 * liquefaction, slope, profile, spring, wall-selection) do NOT ship
 * with buildSteps / buildChecks — those return empty arrays. The PDF
 * still renders them with an inputs+results summary block.
 */

import type { CalculationStep } from "@/lib/beam-flexure-live";

// ─── Live engine imports (compute / buildSteps / buildChecks) ───────────
import {
  computeBeamFlexureLive, buildFlexureSteps,
} from "@/lib/beam-flexure-live";
import {
  computeRectangularColumnLive, buildRectangularColumnSteps, buildRectangularColumnChecks,
} from "@/lib/rectangular-column-live";
import {
  computeCircularColumnLive, buildCircularColumnSteps, buildCircularColumnChecks,
} from "@/lib/circular-column-live";
import {
  computeIsolatedFootingLive, buildIsolatedFootingSteps, buildIsolatedFootingChecks,
} from "@/lib/isolated-footing-live";
import {
  computeStripFootingLive, buildStripFootingSteps, buildStripFootingChecks,
} from "@/lib/strip-footing-live";
import {
  computeCombinedFootingLive, buildCombinedFootingSteps, buildCombinedFootingChecks,
} from "@/lib/combined-footing-live";
import {
  computeMatFoundationLive, buildMatFoundationSteps, buildMatFoundationChecks,
} from "@/lib/mat-foundation-live";
import {
  computePileCapLive, buildPileCapSteps, buildPileCapChecks,
} from "@/lib/pile-cap-live";
import {
  computeRetainingWallLive, buildRetainingWallSteps, buildRetainingWallChecks,
} from "@/lib/retaining-wall-live";
import {
  computeTieBeamLive, buildTieBeamSteps, buildTieBeamChecks,
} from "@/lib/tie-beam-live";
import {
  computeShearWallLive, buildShearWallSteps, buildShearWallChecks,
} from "@/lib/shear-wall-live";
import {
  computeConfinedMasonryLive, buildConfinedMasonrySteps, buildConfinedMasonryChecks,
} from "@/lib/confined-masonry-live";
import {
  computeEsbeltezLive, buildEsbeltezSteps, buildEsbeltezChecks,
} from "@/lib/esbeltez-columna-live";
import {
  computeFlexionBiaxialLive, buildFlexionBiaxialSteps, buildFlexionBiaxialChecks,
} from "@/lib/flexion-biaxial-live";
import {
  computeOneWaySlabLive, buildOneWaySlabSteps, buildOneWaySlabChecks,
} from "@/lib/one-way-slab-live";
import {
  computeTwoWaySlabLive, buildTwoWaySlabSteps, buildTwoWaySlabChecks,
} from "@/lib/two-way-slab-live";
import {
  computeTorsionVigaLive, buildTorsionVigaSteps, buildTorsionVigaChecks,
} from "@/lib/torsion-viga-live";
import {
  computeDeflexionLargoPlazoLive, buildDeflexionLargoPlazoSteps, buildDeflexionLargoPlazoChecks,
} from "@/lib/deflexion-largo-plazo-live";
import {
  computeStairLive, buildStairSteps, buildStairChecks,
} from "@/lib/stair-slab-live";
import {
  computeLintelLive, buildLintelSteps, buildLintelChecks,
} from "@/lib/lintel-live";
import {
  computeBeamColumnJointLive, buildBeamColumnJointSteps, buildBeamColumnJointChecks,
} from "@/lib/beam-column-joint-live";
import {
  computeDiafragmaLive, buildDiafragmaSteps, buildDiafragmaChecks,
} from "@/lib/diafragma-live";
import {
  computePunzonamientoMomentoLive, buildPunzonamientoMomentoSteps, buildPunzonamientoMomentoChecks,
} from "@/lib/punzonamiento-momento-live";
import {
  computeDesarrolloLive, buildDesarrolloSteps, buildDesarrolloChecks,
} from "@/lib/desarrollo-empalmes-live";
import {
  computeFisuracionLive, buildFisuracionSteps, buildFisuracionChecks,
} from "@/lib/fisuracion-live";
import {
  computeStrutTieLive, buildStrutTieSteps, buildStrutTieChecks,
} from "@/lib/strut-tie-live";

// ─── Geotech (compute only — no Steps/Checks) ────────────────────────────
import { computeSPTLive } from "@/lib/spt-live";
import { computeCPTLive } from "@/lib/cpt-live";
import { computeBearingLive } from "@/lib/bearing-capacity-live";
import { computeSettlementLive } from "@/lib/asentamientos-live";
import { computeLiquefactionLive } from "@/lib/licuefaccion-live";
import { computeSlopeLive } from "@/lib/taludes-live";
import { computeProfileLive } from "@/lib/perfil-live";
import { computeSpringLive } from "@/lib/rigidez-resorte-live";
import { computeWallSelection } from "@/lib/muros-tipologia-live";

// ───────────────────────────────────────────────────────────────────────────
// Public types
// ───────────────────────────────────────────────────────────────────────────

export type ElementCategory =
  | "geotech"
  | "foundation"
  | "vertical"
  | "horizontal"
  | "special"
  | "seismic"
  | "detail";

export interface RegistryCheck {
  nombre: string;
  requerido: number;
  disponible: number;
  unidad: string;
  cumple: boolean;
  referencia: string;
}

export interface ElementEntry {
  /** Slug used by SaveToProjectButton naming and dashboard tree rows. */
  slug: string;
  /** Human label, Spanish. */
  label: string;
  /** Auditor bucket. */
  category: ElementCategory;
  /** Live compute function — accepts the engine's input shape, returns a LiveResult. */
  compute: (input: unknown) => unknown;
  /** Builds the procedure step list from a LiveResult (empty when unsupported). */
  buildSteps: (result: unknown) => CalculationStep[];
  /** Builds the verification rows from a LiveResult (empty when unsupported). */
  buildChecks: (result: unknown) => RegistryCheck[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const noSteps = (): CalculationStep[] => [];
const noChecks = (): RegistryCheck[] => [];

/** Tiny type-erasure wrapper so we can keep individual engine types accurate
 *  at the call site without exploding the registry into 35 generics. */
function wrap<I, R>(fn: (input: I) => R): (input: unknown) => unknown {
  return (input) => fn(input as I);
}
function wrapSteps<R>(fn: (r: R) => CalculationStep[]): (r: unknown) => CalculationStep[] {
  return (r) => fn(r as R);
}
function wrapChecks<R>(fn: (r: R) => RegistryCheck[]): (r: unknown) => RegistryCheck[] {
  // Some buildChecks return inferred objects rather than RegistryCheck[]. They
  // all match structurally (nombre/requerido/...), so cast is safe.
  return (r) => fn(r as R) as RegistryCheck[];
}

// ───────────────────────────────────────────────────────────────────────────
// THE REGISTRY — 35 entries
// ───────────────────────────────────────────────────────────────────────────

export const ELEMENT_REGISTRY: Record<string, ElementEntry> = {
  // ─── 1. ESTUDIO DE SITIO ──────────────────────────────────────────────
  spt: {
    slug: "spt",
    label: "Interpretación SPT",
    category: "geotech",
    compute: wrap(computeSPTLive),
    buildSteps: noSteps,
    buildChecks: noChecks,
  },
  cpt: {
    slug: "cpt",
    label: "Interpretación CPT",
    category: "geotech",
    compute: wrap(computeCPTLive),
    buildSteps: noSteps,
    buildChecks: noChecks,
  },
  "capacidad-portante": {
    slug: "capacidad-portante",
    label: "Capacidad portante",
    category: "geotech",
    compute: wrap(computeBearingLive),
    buildSteps: noSteps,
    buildChecks: noChecks,
  },
  asentamientos: {
    slug: "asentamientos",
    label: "Asentamientos",
    category: "geotech",
    compute: wrap(computeSettlementLive),
    buildSteps: noSteps,
    buildChecks: noChecks,
  },
  licuefaccion: {
    slug: "licuefaccion",
    label: "Licuefacción",
    category: "geotech",
    compute: wrap(computeLiquefactionLive),
    buildSteps: noSteps,
    buildChecks: noChecks,
  },
  taludes: {
    slug: "taludes",
    label: "Estabilidad de taludes",
    category: "geotech",
    compute: wrap(computeSlopeLive),
    buildSteps: noSteps,
    buildChecks: noChecks,
  },
  perfil: {
    slug: "perfil",
    label: "Perfil de suelo",
    category: "geotech",
    compute: wrap(computeProfileLive),
    buildSteps: noSteps,
    buildChecks: noChecks,
  },
  "rigidez-resorte": {
    slug: "rigidez-resorte",
    label: "Rigidez de resorte",
    category: "geotech",
    compute: wrap(computeSpringLive),
    buildSteps: noSteps,
    buildChecks: noChecks,
  },
  "muros-tipologia": {
    slug: "muros-tipologia",
    label: "Tipología de muros",
    category: "geotech",
    compute: wrap(computeWallSelection),
    buildSteps: noSteps,
    buildChecks: noChecks,
  },

  // ─── 2. CIMENTACIÓN ───────────────────────────────────────────────────
  "isolated-footing": {
    slug: "isolated-footing",
    label: "Zapata aislada",
    category: "foundation",
    compute: wrap(computeIsolatedFootingLive),
    buildSteps: wrapSteps(buildIsolatedFootingSteps),
    buildChecks: wrapChecks(buildIsolatedFootingChecks),
  },
  "strip-footing": {
    slug: "strip-footing",
    label: "Zapata corrida",
    category: "foundation",
    compute: wrap(computeStripFootingLive),
    buildSteps: wrapSteps(buildStripFootingSteps),
    buildChecks: wrapChecks(buildStripFootingChecks),
  },
  "combined-footing": {
    slug: "combined-footing",
    label: "Zapata combinada",
    category: "foundation",
    compute: wrap(computeCombinedFootingLive),
    buildSteps: wrapSteps(buildCombinedFootingSteps),
    buildChecks: wrapChecks(buildCombinedFootingChecks),
  },
  "mat-foundation": {
    slug: "mat-foundation",
    label: "Mat (losa de fundación)",
    category: "foundation",
    compute: wrap(computeMatFoundationLive),
    buildSteps: wrapSteps(buildMatFoundationSteps),
    buildChecks: wrapChecks(buildMatFoundationChecks),
  },
  "pile-cap": {
    slug: "pile-cap",
    label: "Cabezal de pilotes",
    category: "foundation",
    compute: wrap(computePileCapLive),
    buildSteps: wrapSteps(buildPileCapSteps),
    buildChecks: wrapChecks(buildPileCapChecks),
  },
  "retaining-wall": {
    slug: "retaining-wall",
    label: "Muro de contención",
    category: "foundation",
    compute: wrap(computeRetainingWallLive),
    buildSteps: wrapSteps(buildRetainingWallSteps),
    buildChecks: wrapChecks(buildRetainingWallChecks),
  },
  "tie-beam": {
    slug: "tie-beam",
    label: "Viga de amarre",
    category: "foundation",
    compute: wrap(computeTieBeamLive),
    buildSteps: wrapSteps(buildTieBeamSteps),
    buildChecks: wrapChecks(buildTieBeamChecks),
  },

  // ─── 3. ESTRUCTURA VERTICAL ───────────────────────────────────────────
  "rectangular-column": {
    slug: "rectangular-column",
    label: "Columna rectangular",
    category: "vertical",
    compute: wrap(computeRectangularColumnLive),
    buildSteps: wrapSteps(buildRectangularColumnSteps),
    buildChecks: wrapChecks(buildRectangularColumnChecks),
  },
  "circular-column": {
    slug: "circular-column",
    label: "Columna circular",
    category: "vertical",
    compute: wrap(computeCircularColumnLive),
    buildSteps: wrapSteps(buildCircularColumnSteps),
    buildChecks: wrapChecks(buildCircularColumnChecks),
  },
  "shear-wall": {
    slug: "shear-wall",
    label: "Muro de corte",
    category: "vertical",
    compute: wrap(computeShearWallLive),
    buildSteps: wrapSteps(buildShearWallSteps),
    buildChecks: wrapChecks(buildShearWallChecks),
  },
  "confined-masonry": {
    slug: "confined-masonry",
    label: "Mampostería confinada",
    category: "vertical",
    compute: wrap(computeConfinedMasonryLive),
    buildSteps: wrapSteps(buildConfinedMasonrySteps),
    buildChecks: wrapChecks(buildConfinedMasonryChecks),
  },
  "esbeltez-columna": {
    slug: "esbeltez-columna",
    label: "Esbeltez de columna",
    category: "vertical",
    compute: wrap(computeEsbeltezLive),
    buildSteps: wrapSteps(buildEsbeltezSteps),
    buildChecks: wrapChecks(buildEsbeltezChecks),
  },
  "flexion-biaxial": {
    slug: "flexion-biaxial",
    label: "Flexión biaxial",
    category: "vertical",
    compute: wrap(computeFlexionBiaxialLive),
    buildSteps: wrapSteps(buildFlexionBiaxialSteps),
    buildChecks: wrapChecks(buildFlexionBiaxialChecks),
  },

  // ─── 4. ESTRUCTURA HORIZONTAL ─────────────────────────────────────────
  beam: {
    slug: "beam",
    label: "Viga",
    category: "horizontal",
    compute: wrap(computeBeamFlexureLive),
    buildSteps: wrapSteps(buildFlexureSteps),
    // beam-flexure-live has no buildChecks export — we synthesize two basic ones
    // (ρ ≤ ρmax, tension-controlled) directly from the LiveResult.
    buildChecks: (r: unknown) => {
      const live = r as {
        rho_max_val: number; rho_diseno: number; tension_controlled: boolean; eps_s: number;
      };
      if (!live || typeof live.rho_diseno !== "number") return [];
      return [
        {
          nombre: "ρ ≤ ρ_max",
          requerido: live.rho_max_val,
          disponible: live.rho_diseno,
          unidad: "",
          cumple: live.rho_diseno <= live.rho_max_val,
          referencia: "ACI §9.3",
        },
        {
          nombre: "Sección controlada por tracción",
          requerido: 0.005,
          disponible: live.eps_s,
          unidad: "",
          cumple: !!live.tension_controlled,
          referencia: "ACI §21.2",
        },
      ];
    },
  },
  "one-way-slab": {
    slug: "one-way-slab",
    label: "Losa 1 dirección",
    category: "horizontal",
    compute: wrap(computeOneWaySlabLive),
    buildSteps: wrapSteps(buildOneWaySlabSteps),
    buildChecks: wrapChecks(buildOneWaySlabChecks),
  },
  "two-way-slab": {
    slug: "two-way-slab",
    label: "Losa 2 direcciones",
    category: "horizontal",
    compute: wrap(computeTwoWaySlabLive),
    buildSteps: wrapSteps(buildTwoWaySlabSteps),
    buildChecks: wrapChecks(buildTwoWaySlabChecks),
  },
  "torsion-viga": {
    slug: "torsion-viga",
    label: "Torsión en viga",
    category: "horizontal",
    compute: wrap(computeTorsionVigaLive),
    buildSteps: wrapSteps(buildTorsionVigaSteps),
    buildChecks: wrapChecks(buildTorsionVigaChecks),
  },
  "deflexion-largo-plazo": {
    slug: "deflexion-largo-plazo",
    label: "Deflexión largo plazo",
    category: "horizontal",
    compute: wrap(computeDeflexionLargoPlazoLive),
    buildSteps: wrapSteps(buildDeflexionLargoPlazoSteps),
    buildChecks: wrapChecks(buildDeflexionLargoPlazoChecks),
  },

  // ─── 5. ELEMENTOS ESPECIALES ──────────────────────────────────────────
  "stair-slab": {
    slug: "stair-slab",
    label: "Losa de escalera",
    category: "special",
    compute: wrap(computeStairLive),
    buildSteps: wrapSteps(buildStairSteps),
    buildChecks: wrapChecks(buildStairChecks),
  },
  lintel: {
    slug: "lintel",
    label: "Dintel",
    category: "special",
    compute: wrap(computeLintelLive),
    buildSteps: wrapSteps(buildLintelSteps),
    buildChecks: wrapChecks(buildLintelChecks),
  },

  // ─── 6. VERIFICACIONES SÍSMICAS ───────────────────────────────────────
  "beam-column-joint": {
    slug: "beam-column-joint",
    label: "Conexión viga-columna",
    category: "seismic",
    compute: wrap(computeBeamColumnJointLive),
    buildSteps: wrapSteps(buildBeamColumnJointSteps),
    buildChecks: wrapChecks(buildBeamColumnJointChecks),
  },
  diafragma: {
    slug: "diafragma",
    label: "Diafragma de piso",
    category: "seismic",
    compute: wrap(computeDiafragmaLive),
    buildSteps: wrapSteps(buildDiafragmaSteps),
    buildChecks: wrapChecks(buildDiafragmaChecks),
  },
  "punzonamiento-momento": {
    slug: "punzonamiento-momento",
    label: "Punzonamiento con momento",
    category: "seismic",
    compute: wrap(computePunzonamientoMomentoLive),
    buildSteps: wrapSteps(buildPunzonamientoMomentoSteps),
    buildChecks: wrapChecks(buildPunzonamientoMomentoChecks),
  },

  // ─── 7. DETALLADO ─────────────────────────────────────────────────────
  "desarrollo-empalmes": {
    slug: "desarrollo-empalmes",
    label: "Longitudes de desarrollo",
    category: "detail",
    compute: wrap(computeDesarrolloLive),
    buildSteps: wrapSteps(buildDesarrolloSteps),
    buildChecks: wrapChecks(buildDesarrolloChecks),
  },
  fisuracion: {
    slug: "fisuracion",
    label: "Control de fisuración",
    category: "detail",
    compute: wrap(computeFisuracionLive),
    buildSteps: wrapSteps(buildFisuracionSteps),
    buildChecks: wrapChecks(buildFisuracionChecks),
  },
  "strut-tie": {
    slug: "strut-tie",
    label: "Modelo strut-and-tie",
    category: "detail",
    compute: wrap(computeStrutTieLive),
    buildSteps: wrapSteps(buildStrutTieSteps),
    buildChecks: wrapChecks(buildStrutTieChecks),
  },
};

// ───────────────────────────────────────────────────────────────────────────
// Lookup helpers
// ───────────────────────────────────────────────────────────────────────────

/** Find the registry entry whose slug appears (case-insensitively) inside `name`.
 *  Names look like "beam — 2026-05-18" or "isolated-footing — 2026-05-18". The
 *  slug match is greedy: pick the LONGEST slug that matches, so "stair-slab"
 *  wins over "slab" if both ever existed. */
export function lookupEntryByName(name: string): ElementEntry | null {
  const lc = name.toLowerCase();
  let best: ElementEntry | null = null;
  for (const entry of Object.values(ELEMENT_REGISTRY)) {
    if (lc.includes(entry.slug.toLowerCase())) {
      if (!best || entry.slug.length > best.slug.length) best = entry;
    }
  }
  return best;
}

/** Strictly look up by slug. */
export function lookupEntry(slug: string): ElementEntry | null {
  return ELEMENT_REGISTRY[slug] ?? null;
}

/** Total number of registered element types. */
export const ELEMENT_REGISTRY_COUNT = Object.keys(ELEMENT_REGISTRY).length;
