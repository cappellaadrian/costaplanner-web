# PDF Export Coverage Audit — Costaplanner Studio

**Date:** 2026-05-18
**Auditor:** EvidenceQA
**Scope:** 26 element studio pages + 9 geotech tools = 35 routes
**Production URL:** https://costaplanner.vercel.app/studio/{slug}/

## Executive Summary

- **35/35 routes return 200** (all alive after following the 308 trailing-slash redirect)
- **26/26 element pages** render at least one `<svg>` in SSR HTML and expose a PDF export path
- **9/9 geotech pages** are **SHIP-BLOCKERS** — no `StudioShell`, no `buildSnapshot`, no `ExportToolbar`, no SVGs in SSR
- **13/26 element pages** are **POLISH** — PDF button works, but the `diagrams[]` array is missing from the snapshot, so the PDF will export numbers without visuals
- **1/26 element pages** (beam) is the gold standard — full `diagrams: renderDiagrams([...])` wiring with 5 named diagrams

**Net: 22 of 35 routes (63 percent) have a degraded or absent PDF export.**

---

## A. Curl Smoke Test Table

`Invoke-WebRequest` against `https://costaplanner.vercel.app/studio/{slug}` (redirect-followed). PDF-button detection: regex against `printDesignAsPdf|ExportToolbar|>PDF<|Exportar PDF|Descargar PDF`. Note: SSR HTML detection of the PDF button is approximate — `ExportToolbar` may serialize as the literal class name in the bundled chunk, so `yes` here means evidence is present in initial HTML.

| Slug | Status | # `<svg>` | Has PDF button |
|---|---|---|---|
| beam | 200 | 8 | yes |
| rectangular-column | 200 | 5 | yes |
| circular-column | 200 | 3 | yes |
| isolated-footing | 200 | 11 | yes |
| strip-footing | 200 | 3 | yes |
| tie-beam | 200 | 2 | yes |
| one-way-slab | 200 | 3 | yes |
| two-way-slab | 200 | 1 | yes |
| shear-wall | 200 | 4 | yes |
| stair-slab | 200 | 2 | yes |
| lintel | 200 | 2 | yes |
| retaining-wall | 200 | 12 | yes |
| beam-column-joint | 200 | 2 | yes |
| diafragma | 200 | 2 | yes |
| esbeltez-columna | 200 | 2 | yes |
| punzonamiento-momento | 200 | 5 | yes |
| combined-footing | 200 | 2 | yes |
| mat-foundation | 200 | 1 | yes |
| pile-cap | 200 | 2 | yes |
| confined-masonry | 200 | 2 | yes |
| desarrollo-empalmes | 200 | 6 | yes |
| flexion-biaxial | 200 | 1 | yes |
| torsion-viga | 200 | 4 | yes |
| deflexion-largo-plazo | 200 | 3 | yes |
| fisuracion | 200 | 3 | yes |
| strut-tie | 200 | 1 | yes |
| **geotecnica/spt** | 200 | **0** | **no** |
| **geotecnica/cpt** | 200 | **0** | **no** |
| **geotecnica/capacidad-portante** | 200 | **0** | **no** |
| **geotecnica/asentamientos** | 200 | **0** | **no** |
| **geotecnica/rigidez-resorte** | 200 | **0** | **no** |
| **geotecnica/taludes** | 200 | **0** | **no** |
| **geotecnica/licuefaccion** | 200 | **0** | **no** |
| **geotecnica/perfil** | 200 | **0** | **no** |
| **geotecnica/muros-tipologia** | 200 | **0** | **no** |

Raw CSV: `D:\Projects\costaplanner-web\docs\.pdf-smoke.csv`

---

## B. Source Code Audit Table

Grep patterns against `src/app/studio/*/page.tsx` and `src/app/studio/geotecnica/*/page.tsx`:

- **shell**  = imports `StudioShell` from `@/components/studio/StudioShell`
- **bsnap**  = defines a `buildSnapshot` callback that returns a `DesignSnapshot`
- **rdiag**  = imports/calls `renderDiagrams` from `@/lib/exporters/render-diagrams`
- **dkey**   = literal `diagrams:` key present in the snapshot object
- **exptb**  = renders `ExportToolbar` directly **or** wires `printDesignAsPdf` (most do this implicitly by passing `buildSnapshot` to `StudioShell`, which then conditionally mounts `<ExportToolbar buildSnapshot={...} />` at line 122 of `StudioShell.tsx`)

| Page | shell | bsnap | rdiag | dkey | exptb (direct) |
|---|---|---|---|---|---|
| beam | yes | yes | **yes** | **yes** | **yes** |
| rectangular-column | yes | yes | yes | yes | no (via shell) |
| circular-column | yes | yes | yes | yes | no (via shell) |
| isolated-footing | yes | yes | yes | yes | no (via shell) |
| strip-footing | yes | yes | yes | yes | no (via shell) |
| tie-beam | yes | yes | yes | yes | no (via shell) |
| one-way-slab | yes | yes | yes | yes | no (via shell) |
| two-way-slab | yes | yes | yes | yes | no (via shell) |
| shear-wall | yes | yes | yes | yes | no (via shell) |
| stair-slab | yes | yes | yes | yes | no (via shell) |
| lintel | yes | yes | yes | yes | no (via shell) |
| retaining-wall | yes | yes | yes | yes | no (via shell) |
| strut-tie | yes | yes | **no** | **no** | no (via shell) |
| fisuracion | yes | yes | **no** | **no** | no (via shell) |
| deflexion-largo-plazo | yes | yes | **no** | **no** | no (via shell) |
| torsion-viga | yes | yes | **no** | **no** | no (via shell) |
| flexion-biaxial | yes | yes | **no** | **no** | no (via shell) |
| desarrollo-empalmes | yes | yes | **no** | **no** | no (via shell) |
| confined-masonry | yes | yes | **no** | **no** | no (via shell) |
| pile-cap | yes | yes | **no** | **no** | no (via shell) |
| mat-foundation | yes | yes | **no** | **no** | no (via shell) |
| combined-footing | yes | yes | **no** | **no** | no (via shell) |
| punzonamiento-momento | yes | yes | **no** | **no** | no (via shell) |
| esbeltez-columna | yes | yes | **no** | **no** | no (via shell) |
| diafragma | yes | yes | **no** | **no** | no (via shell) |
| beam-column-joint | yes | yes | **no** | **no** | no (via shell) |
| **geotecnica/spt** | **no** | **no** | **no** | **no** | **no** |
| **geotecnica/cpt** | **no** | **no** | **no** | **no** | **no** |
| **geotecnica/capacidad-portante** | **no** | **no** | **no** | **no** | **no** |
| **geotecnica/asentamientos** | **no** | **no** | **no** | **no** | **no** |
| **geotecnica/rigidez-resorte** | **no** | **no** | **no** | **no** | **no** |
| **geotecnica/taludes** | **no** | **no** | **no** | **no** | **no** |
| **geotecnica/licuefaccion** | **no** | **no** | **no** | **no** | **no** |
| **geotecnica/perfil** | **no** | **no** | **no** | **no** | **no** |
| **geotecnica/muros-tipologia** | **no** | **no** | **no** | **no** | **no** |

**Architectural note:** `StudioShell.tsx:122` conditionally mounts `<ExportToolbar buildSnapshot={buildSnap} />` whenever a `buildSnapshot` prop is supplied. So every page that imports `StudioShell` AND passes `buildSnapshot` gets the PDF button for free — only `beam` re-implements the toolbar wiring inline (legacy/reference pattern). This explains why `exptb (direct)` is `no` for most pages despite the button being live.

---

## C. Gap Report

### SHIP-BLOCKER — 9 geotech pages, no PDF export at all

All 9 geotech tools were built as one-off pages with `"use client"` + local `useState`/`useMemo` against their own `compute*Live` modules — they never adopted the `StudioShell` + `buildSnapshot` pattern. Evidence: 0 `<svg>` in SSR output, no `StudioShell` import, no `buildSnapshot` callback.

| Slug | 1-line fix |
|---|---|
| geotecnica/spt | Wrap the SPT page in `<StudioShell>` and add `buildSnapshot={() => buildSnapshot({ title: "SPT — ...", elementType: "spt", inputs, steps: result.steps, checks: [], diagrams: renderDiagrams([{ title: "Perfil SPT", element: <SPTProfileSvg input={input} result={result}/> }]) })}` — requires authoring `SPTProfileSvg` diagram component first. |
| geotecnica/cpt | Same shell wrap + author `CPTLogSvg` (qc/fs/Rf vs depth). |
| geotecnica/capacidad-portante | Shell wrap + `BearingFailureWedgeSvg` (Terzaghi/Meyerhof wedge). |
| geotecnica/asentamientos | Shell wrap + `SettlementStrainProfileSvg` (eps_v vs depth per layer). |
| geotecnica/rigidez-resorte | Shell wrap + `SpringMatSvg` (footing → ks grid). |
| geotecnica/taludes | Shell wrap + `SlopeBishopCircleSvg` (slip circle on slope). |
| geotecnica/licuefaccion | Shell wrap + `LiquefactionCSRvsCRRSvg` (CSR/CRR vs depth). |
| geotecnica/perfil | Shell wrap + `SoilProfileLayerSvg` (already visual — promote it to a snapshot diagram). |
| geotecnica/muros-tipologia | Shell wrap + `WallTypologySvg` (cross-section of selected wall type). |

**Common fix prerequisite:** none of these have a `computeXLive` result with a `.steps[]` array shaped for `DesignSnapshot.steps`. Each will need either (a) a thin adapter that maps the existing result into `Step[]`, or (b) the snapshot builder relaxed to accept a `freeform: ReactNode` block for tools that don't yet have step-by-step traces. Recommend option (b) as a one-time `snapshot-builder.ts` change.

### POLISH — 14 element pages, PDF works but no embedded diagrams

These pages have `StudioShell` + `buildSnapshot` wired (so the toolbar prints a numbers-only PDF), but `diagrams: renderDiagrams([...])` is **not** in the snapshot. The PDF will be missing the visual section/elevation/plan figures.

| Slug | 1-line fix |
|---|---|
| strut-tie | Add `import { renderDiagrams } from "@/lib/exporters/render-diagrams";` then `diagrams: renderDiagrams([{ title: "ST-1 — Modelo de bielas y tirantes", element: <StrutTieModelSvg input={input} result={result}/> }])` inside the `buildSnapshot` return. |
| fisuracion | `diagrams: renderDiagrams([{ title: "FS-1 — Patrón de fisuración (ACI 224R)", element: <CrackPatternSvg ...> }])` |
| deflexion-largo-plazo | `diagrams: renderDiagrams([{ title: "DF-1 — Deflexión inmediata + diferida", element: <DeflectionTimeChartSvg ...> }])` |
| torsion-viga | `diagrams: renderDiagrams([{ title: "TV-1 — Sección con estribos cerrados", element: <TorsionSectionSvg ...> }])` |
| flexion-biaxial | `diagrams: renderDiagrams([{ title: "FB-1 — Diagrama de interacción Mx-My", element: <BiaxialInteractionSvg ...> }])` |
| desarrollo-empalmes | `diagrams: renderDiagrams([{ title: "DE-1 — Longitudes de desarrollo y traslapo", element: <DevelopmentLapSvg ...> }])` |
| confined-masonry | `diagrams: renderDiagrams([{ title: "CM-1 — Muro con confinamientos", element: <ConfinedMasonrySvg ...> }])` |
| pile-cap | `diagrams: renderDiagrams([{ title: "PC-1 — Cabezal en planta", element: <PileCapPlanSvg ...> }, { title: "PC-2 — Cabezal en sección", element: <PileCapSectionSvg ...> }])` |
| mat-foundation | `diagrams: renderDiagrams([{ title: "MF-1 — Losa de cimentación, contornos M/V", element: <MatContourSvg ...> }])` |
| combined-footing | `diagrams: renderDiagrams([{ title: "CF-1 — Zapata combinada en planta", element: <CombinedFootingSvg ...> }])` |
| punzonamiento-momento | `diagrams: renderDiagrams([{ title: "PM-1 — Perímetro crítico de punzonamiento", element: <PunchingPerimeterSvg ...> }])` |
| esbeltez-columna | `diagrams: renderDiagrams([{ title: "EC-1 — Curva P-Δ con amplificación", element: <SlendernessPDeltaSvg ...> }])` |
| diafragma | `diagrams: renderDiagrams([{ title: "DA-1 — Diafragma rígido / fuerzas inerciales", element: <DiaphragmForceSvg ...> }])` |
| beam-column-joint | `diagrams: renderDiagrams([{ title: "BCJ-1 — Junta viga-columna, fuerzas", element: <JointForceSvg ...> }])` |

**Prerequisite:** several of these pages may not yet have authored SVG diagram components in `src/components/studio/`. Audit each page's existing JSX for inline `<svg>` blocks before fix — if present, extract them into named components first (matches the `BeamDiagrams.tsx` pattern).

### OK — 13 element pages, full pipeline wired

`beam`, `rectangular-column`, `circular-column`, `isolated-footing`, `strip-footing`, `tie-beam`, `one-way-slab`, `two-way-slab`, `shear-wall`, `stair-slab`, `lintel`, `retaining-wall`, and the non-studio `proyecto` page all have `buildSnapshot` + `renderDiagrams` + `diagrams:` key. Note `proyecto` is not in the 35-page scope but is included here as an evidence point that the pattern is well established.

---

## D. Sample PDF Check — /studio/beam

`D:\Projects\costaplanner-web\src\app\studio\beam\page.tsx` is the reference implementation.

**Snapshot wiring (lines 452-535):** the `buildSnapshot` callback returns a `DesignSnapshot` with:

- `title`, `elementType: "beam"`, `project`, `materials`, `inputs` (11 fields)
- `steps` (live or official calc trace)
- `checks` (rho_diseno ≤ rho_max; tension-controlled section)
- `reinforcement` (when official mode)
- `notes` (warnings + errors)
- `diagrams: renderDiagrams([...])` with **5 named entries**:
  1. `BM-1 — Sección en apoyo` → `<BM1_SectionApoyo>`
  2. `BM-2 — Sección en centro` → `<BM2_SectionCentro>`
  3. `BM-3 — Elevación con aros` → `<BM3_Elevation>`
  4. `BM-4 — Diagrama de momentos` → `<BM4_Moments>`
  5. `BM-5 — Diagrama de cortante` → `<BM5_Shear>`

All 5 components live in `@/components/studio/BeamDiagrams` and each receives `{ input, liveResult }`. The `renderDiagrams` helper serializes each React element to an SVG string for PDF embedding.

**The export handler** (lines 541-543):

```
const handleExportPdf = useCallback(() => {
  printDesignAsPdf(buildSnapshot());
}, [buildSnapshot]);
```

This is the only page in the codebase that calls `printDesignAsPdf` directly. All other "OK" pages route through `StudioShell` → `ExportToolbar` → `printDesignAsPdf`, which produces the same result with less boilerplate.

**Verdict:** beam's snapshot is correctly wired. Diagrams array is populated with 5 elements, each with a stable title and a JSX element. The pattern is exemplary and should be the template for the 14 POLISH fixes and (with shell adoption) the 9 SHIP-BLOCKER fixes.

---

## Severity Summary

| Severity | Count | Pages |
|---|---|---|
| **SHIP-BLOCKER** | 9 | All 9 geotecnica tools |
| **POLISH** | 14 | strut-tie, fisuracion, deflexion-largo-plazo, torsion-viga, flexion-biaxial, desarrollo-empalmes, confined-masonry, pile-cap, mat-foundation, combined-footing, punzonamiento-momento, esbeltez-columna, diafragma, beam-column-joint |
| **OK** | 12 | beam, rectangular-column, circular-column, isolated-footing, strip-footing, tie-beam, one-way-slab, two-way-slab, shear-wall, stair-slab, lintel, retaining-wall |

**Recommended fix order:**

1. **One snapshot-builder change first** — relax `snapshot-builder.ts` to accept geotech-shaped inputs (or add a `freeform` block) so geotech adoption doesn't require fabricating fake `Step[]` traces.
2. **Geotech batch (9 SHIP-BLOCKERs)** — adopt `StudioShell`, author one SVG per tool, wire snapshot. Highest user value (geotech is currently dead-ended for export).
3. **Diagrams polish (14 POLISH)** — add the missing `diagrams: renderDiagrams([...])` per the patch table above. Lowest-risk fix; pure additive.
4. **Standardize beam** — remove the inline `handleExportPdf`/`ExportToolbar` from beam and route through `StudioShell` like the other 12 OK pages. Drift-prevention only.

---

**Files referenced:**

- `D:\Projects\costaplanner-web\src\components\studio\StudioShell.tsx` (line 122 conditional ExportToolbar mount)
- `D:\Projects\costaplanner-web\src\components\studio\ExportToolbar.tsx`
- `D:\Projects\costaplanner-web\src\lib\exporters\snapshot-builder.ts` (line 44 diagrams field; line 90 passthrough)
- `D:\Projects\costaplanner-web\src\lib\exporters\render-diagrams.tsx`
- `D:\Projects\costaplanner-web\src\lib\exporters\pdf.ts`
- `D:\Projects\costaplanner-web\src\app\studio\beam\page.tsx` (reference implementation, lines 452-543)
- `D:\Projects\costaplanner-web\docs\.pdf-smoke.csv` (raw curl results)
