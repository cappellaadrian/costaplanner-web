/**
 * next-step — shared mapping of elementType slugs to suggested next steps.
 *
 * Used by:
 *   - SaveToProjectButton (after-save redirect carries ?saved=<elementType>)
 *   - /proyectos/[id] dashboard (banner reading ?saved=...)
 *   - Optional polish: studio calculator pages may show a small
 *     "Siguiente paso sugerido →" hint when they know which project they
 *     belong to (?proyecto=<id>).
 *
 * The mapping reflects the natural CR design workflow:
 *
 *   geotecnia → cimentación → columnas → vigas → losas → verificaciones
 *
 * For each entry the label is what the engineer SHOULD do next, and the href
 * points to the studio calculator for it. Callers append ?proyecto=<id> when
 * available so the chain continues without losing project context.
 */
export interface NextStep {
  /** Spanish label shown to the engineer (verb + element). */
  label: string;
  /** Studio calculator route (no query string). */
  href: string;
  /** ElementType slug the next step would save as — used for the
   *  "Guardaste X" banner copy. */
  toElementType: string;
}

/**
 * Element-type slug → suggested next step in the design workflow.
 *
 * The keys here mirror the `elementType` passed to <SaveToProjectButton>.
 */
export const NEXT_STEP: Record<string, NextStep> = {
  // ── 1. Estudio de sitio
  spt: {
    label: "Capacidad portante",
    href: "/studio/geotecnica/capacidad-portante",
    toElementType: "capacidad-portante",
  },
  "capacidad-portante": {
    label: "Zapata aislada",
    href: "/studio/isolated-footing",
    toElementType: "isolated-footing",
  },
  asentamientos: {
    label: "Capacidad portante",
    href: "/studio/geotecnica/capacidad-portante",
    toElementType: "capacidad-portante",
  },
  licuefaccion: {
    label: "Capacidad portante",
    href: "/studio/geotecnica/capacidad-portante",
    toElementType: "capacidad-portante",
  },
  taludes: {
    label: "Muro de contención",
    href: "/studio/retaining-wall",
    toElementType: "retaining-wall",
  },

  // ── 2. Cimentación
  "isolated-footing": {
    label: "Columna rectangular",
    href: "/studio/rectangular-column",
    toElementType: "rectangular-column",
  },
  "strip-footing": {
    label: "Columna rectangular",
    href: "/studio/rectangular-column",
    toElementType: "rectangular-column",
  },
  "combined-footing": {
    label: "Columna rectangular",
    href: "/studio/rectangular-column",
    toElementType: "rectangular-column",
  },
  "mat-foundation": {
    label: "Columna rectangular",
    href: "/studio/rectangular-column",
    toElementType: "rectangular-column",
  },
  "pile-cap": {
    label: "Columna rectangular",
    href: "/studio/rectangular-column",
    toElementType: "rectangular-column",
  },
  "retaining-wall": {
    label: "Viga de amarre",
    href: "/studio/tie-beam",
    toElementType: "tie-beam",
  },
  "tie-beam": {
    label: "Columna rectangular",
    href: "/studio/rectangular-column",
    toElementType: "rectangular-column",
  },

  // ── 3. Estructura vertical
  "rectangular-column": {
    label: "Viga",
    href: "/studio/beam",
    toElementType: "beam",
  },
  "circular-column": {
    label: "Viga",
    href: "/studio/beam",
    toElementType: "beam",
  },
  "shear-wall": {
    label: "Viga",
    href: "/studio/beam",
    toElementType: "beam",
  },
  "confined-masonry": {
    label: "Viga",
    href: "/studio/beam",
    toElementType: "beam",
  },
  "esbeltez-columna": {
    label: "Flexión biaxial",
    href: "/studio/flexion-biaxial",
    toElementType: "flexion-biaxial",
  },
  "flexion-biaxial": {
    label: "Viga",
    href: "/studio/beam",
    toElementType: "beam",
  },

  // ── 4. Estructura horizontal
  beam: {
    label: "Losa en 1 dirección",
    href: "/studio/one-way-slab",
    toElementType: "one-way-slab",
  },
  "one-way-slab": {
    label: "Verificación de unión viga-columna",
    href: "/studio/beam-column-joint",
    toElementType: "beam-column-joint",
  },
  "two-way-slab": {
    label: "Verificación de unión viga-columna",
    href: "/studio/beam-column-joint",
    toElementType: "beam-column-joint",
  },
  "torsion-viga": {
    label: "Deflexión a largo plazo",
    href: "/studio/deflexion-largo-plazo",
    toElementType: "deflexion-largo-plazo",
  },
  "deflexion-largo-plazo": {
    label: "Control de fisuración",
    href: "/studio/fisuracion",
    toElementType: "fisuracion",
  },

  // ── 5. Elementos especiales
  "stair-slab": {
    label: "Viga",
    href: "/studio/beam",
    toElementType: "beam",
  },
  lintel: {
    label: "Viga",
    href: "/studio/beam",
    toElementType: "beam",
  },

  // ── 6. Verificaciones sísmicas
  "beam-column-joint": {
    label: "Diafragma de piso",
    href: "/studio/diafragma",
    toElementType: "diafragma",
  },
  diafragma: {
    label: "Punzonamiento con momento",
    href: "/studio/punzonamiento-momento",
    toElementType: "punzonamiento-momento",
  },
  "punzonamiento-momento": {
    label: "Longitudes de desarrollo",
    href: "/studio/desarrollo-empalmes",
    toElementType: "desarrollo-empalmes",
  },

  // ── 7. Detallado
  "desarrollo-empalmes": {
    label: "Control de fisuración",
    href: "/studio/fisuracion",
    toElementType: "fisuracion",
  },
  fisuracion: {
    label: "Modelo strut-and-tie",
    href: "/studio/strut-tie",
    toElementType: "strut-tie",
  },
  "strut-tie": {
    label: "Genera la memoria",
    // no studio route — surface a generic "generate memoria" target.
    href: "",
    toElementType: "",
  },
};

/**
 * Friendly Spanish label for an elementType — used in the "Guardaste X"
 * banner copy. Falls back to the raw slug if unknown.
 */
export const ELEMENT_LABEL: Record<string, string> = {
  spt: "SPT",
  "capacidad-portante": "capacidad portante",
  asentamientos: "asentamientos",
  licuefaccion: "licuefacción",
  taludes: "estabilidad de taludes",
  "isolated-footing": "zapata aislada",
  "strip-footing": "zapata corrida",
  "combined-footing": "zapata combinada",
  "mat-foundation": "mat de fundación",
  "pile-cap": "cabezal de pilotes",
  "retaining-wall": "muro de contención",
  "tie-beam": "viga de amarre",
  "rectangular-column": "columna rectangular",
  "circular-column": "columna circular",
  "shear-wall": "muro de corte",
  "confined-masonry": "mampostería confinada",
  "esbeltez-columna": "esbeltez de columna",
  "flexion-biaxial": "flexión biaxial",
  beam: "viga",
  "one-way-slab": "losa en 1 dirección",
  "two-way-slab": "losa en 2 direcciones",
  "torsion-viga": "torsión en viga",
  "deflexion-largo-plazo": "deflexión a largo plazo",
  "stair-slab": "losa de escalera",
  lintel: "dintel",
  "beam-column-joint": "unión viga-columna",
  diafragma: "diafragma",
  "punzonamiento-momento": "punzonamiento con momento",
  "desarrollo-empalmes": "longitudes de desarrollo",
  fisuracion: "control de fisuración",
  "strut-tie": "strut-and-tie",
};

/** Resolves the next step for a given elementType. Returns null if unknown. */
export function getNextStep(elementType: string): NextStep | null {
  return NEXT_STEP[elementType] ?? null;
}

/** Spanish element label for an elementType (lowercase). */
export function getElementLabel(elementType: string): string {
  return ELEMENT_LABEL[elementType] ?? elementType;
}
