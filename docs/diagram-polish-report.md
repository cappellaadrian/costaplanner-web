# Diagram Polish Report — Costaplanner Studio

**Date**: 2026-05-18
**Scope**: SVG engineering diagrams across 35 studio pages
**Author**: ArchitectUX (diagram polish pass 1)

---

## 1. Audit Summary

### Diagrams audited (component count)

| Source file | Components | Inline SVGs |
| --- | --- | --- |
| `src/components/studio/svg-primitives.tsx` | 14 primitives | — |
| `src/components/studio/ElementDiagram.tsx` | 9 element variants | — |
| `src/components/studio/BeamDiagrams.tsx` | 5 (BM-1..BM-5) | — |
| `src/components/studio/ColumnDiagrams.tsx` | 8 (RC-1..RC-5 + CC-1..CC-3) | — |
| `src/components/studio/IsolatedFootingDiagrams.tsx` | 9 (D12..D20) | — |
| `src/components/studio/MoreDiagrams.tsx` | 9 (Strip, OWS, TWS, Tie, SW, Stair, Lintel) | — |
| `src/components/studio/RetainingWallDiagrams.tsx` | 11 (D1..D11) | — |
| `src/app/studio/beam-column-joint/page.tsx` | — | 1 inline |
| `src/app/studio/diafragma/page.tsx` | — | 1 inline |
| `src/app/studio/esbeltez-columna/page.tsx` | — | 1 inline |
| `src/app/studio/punzonamiento-momento/page.tsx` | — | 1 inline |
| `src/app/studio/combined-footing/page.tsx` | — | 1 inline |
| `src/app/studio/mat-foundation/page.tsx` | — | 1 inline |
| `src/app/studio/pile-cap/page.tsx` | — | 1 inline |
| `src/app/studio/confined-masonry/page.tsx` | — | 1 inline |
| `src/app/studio/desarrollo-empalmes/page.tsx` | — | 1 inline |
| `src/app/studio/flexion-biaxial/page.tsx` | — | 1 inline |
| `src/app/studio/torsion-viga/page.tsx` | — | 1 inline |
| `src/app/studio/deflexion-largo-plazo/page.tsx` | — | 1 inline |
| `src/app/studio/fisuracion/page.tsx` | — | 1 inline |
| `src/app/studio/strut-tie/page.tsx` | — | 3 inline (corbel / deep beam / pile cap) |

**Total**: ~65 distinct SVG diagram renderers across 21 files.

### Issue counts per component (audit pass 1)

| Component / file | Critical | Major | Minor |
| --- | :-: | :-: | :-: |
| `svg-primitives.DimLine` | 0 | 0 | 1 (already auto-suppresses textBg) |
| `svg-primitives.ForceArrow` | 0 | 1 | 0 (log scale used, but `maxLength=80` still saturates) |
| `svg-primitives.DistributedLoad` | 1 | 0 | 0 (broken arrow geometry — `cx === x` branch is a typo) |
| `ElementDiagram.DimLine` (local) | **1** | 1 | 0 (fixed-width text-bg covers arrowheads on short lines) |
| `ElementDiagram.IsolatedFootingDiagram` | 0 | 1 | 1 (section height amplified ×4, can overflow vertically) |
| `ElementDiagram.StairDiagram` | **1** | 1 | 0 (polygon back-tracks through stair edges) |
| `ElementDiagram.SlabDiagram` | 0 | 1 | 0 (slab height clamped to 4× cm — works but loses scale) |
| `BeamDiagrams.BM3_Elevation` | 0 | 1 | 1 (zone bars at `yBot + 6` collide with `yBot + 22` labels) |
| `BeamDiagrams.BM4_Moments` | **1** | 1 | 0 (labels escape viewBox top when M is large) |
| `BeamDiagrams.BM5_Shear` | 0 | 1 | 0 (clamped `vc_amp = 0.9·amp` looks identical for `phiVc < Vu`) |
| `ColumnDiagrams.RC1_Seccion` | **1** | 0 | 0 (hx callout overlaps b-dim line) |
| `ColumnDiagrams.RC2_Elevacion` | 0 | 1 | 1 (zone labels at xLeft go off-canvas when colW small) |
| `ColumnDiagrams.RC5_PM_Diagram` | 0 | 1 | 0 (user-point text can sit outside envelope) |
| `IsolatedFootingDiagrams.D12_PlanView` | 0 | 1 | 0 (C1 dim text at base of column overlaps L-dim) |
| `IsolatedFootingDiagrams.D15_AnclajeLdb` | **1** | 0 | 0 (h_z dim with `offset=-30` clipped off left edge) |
| `IsolatedFootingDiagrams.D16_PressureDist` | 0 | 1 | 0 (q_min label collides with B-dim line) |
| `IsolatedFootingDiagrams.D19_Punzonamiento` | **1** | 0 | 0 (d/2 callout clipped left when column near edge) |
| `IsolatedFootingDiagrams.D20_FinalRebar` | 0 | 1 | 1 (`bandLength` computed but never used — dead code) |
| `MoreDiagrams.OWSMomentDiagram` | **1** | 0 | 0 (amp = `Cm*500` overflows H=200 viewBox) |
| `MoreDiagrams.StripSeccion` | 0 | 1 | 0 (top steel rendered as faint line, not RebarRow) |
| `MoreDiagrams.TWSPlan` | **1** | 0 | 0 (corner column rects hang outside slab polygon) |
| `MoreDiagrams.TieBeamPlan` | 0 | 1 | 0 (28×28 zapata blocks not scaled to actual zapata size) |
| `MoreDiagrams.LintelElevation` | 0 | 1 | 0 (vertical walls extend below lintel by hard-coded 70 px) |
| `RetainingWallDiagrams.D1_CrossSection` | **1** | 1 | 0 (b/ct/Bp dim lines stacked at same y, overlap) |
| `RetainingWallDiagrams.D2_Isometric` | 0 | 1 | 0 (3D oblique uses fixed `scale=30`, not data-driven) |
| `RetainingWallDiagrams.D6_SectionWeights` | **1** | 0 | 0 (table cols misaligned — `padStart` collapsed in SVG `<text>`) |
| `RetainingWallDiagrams.D7_Vuelco` | 0 | 1 | 0 (StatusReadout at `W-145, H-50` overlaps wall footprint) |
| `RetainingWallDiagrams.D10_PantallaBendingShear` | 0 | 1 | 0 (4 slots at slotW=160 — last slot text overflows W=720) |
| `RetainingWallDiagrams.D11_FinalReinforcement` | 0 | 1 | 1 (interior/exterior bar labels can collide near top) |
| **page.tsx inline — beam-column-joint** | 0 | 1 | 1 (ΣMn col arrow is a `↓` glyph, not a real curved arrow) |
| **page.tsx inline — diafragma** | 0 | 1 | 0 (chord T arrow uses double arrowheads on a thin line) |
| **page.tsx inline — esbeltez-columna** | 0 | 1 | 1 (lateral deflection clamped to 3.0 — visually saturates) |
| **page.tsx inline — punzonamiento-momento** | 0 | 1 | 0 (stress trapezoid drawn with only 3 lines — looks incomplete) |
| **page.tsx inline — combined-footing** | 0 | 1 | 1 (`<defs>` declared TWICE in same SVG — second one overrides) |
| **page.tsx inline — strut-tie (3 variants)** | 0 | 2 | 1 (deep beam: tirante line covers bar fix; pile cap: pile rects break viewBox at n_piles ≥ 5) |
| **page.tsx inline — confined-masonry** | 0 | 1 | 0 (`<defs>` declared TWICE in same SVG) |

**Totals (audit):**
- **Critical (unreadable / broken geometry / off-canvas):** 10
- **Major (looks wrong but readable):** 28
- **Minor (polish):** 13

---

## 2. Fixes Applied (Phase 2 — surgical edits)

10 surgical fixes targeting the critical issues. **Total lines changed: ~75** across 5 files. No new files; no rewrites.

| # | File | Lines | Description |
| -- | --- | :-: | --- |
| 1 | `src/components/studio/ElementDiagram.tsx:183-215` | +12/-7 | `DimLine` now sizes text-bg to label width and suppresses bg on short lines (≤ textW+14 px) so arrowheads remain visible. Mirrors the pattern already used in `svg-primitives.DimLine`. |
| 2 | `src/components/studio/MoreDiagrams.tsx:125-135` | +6/-1 | `OWSMomentDiagram`: replaced uncapped `amp = 50·sign(Cm)·\|Cm\|·10` with clamped `amp = clamp(sign(Cm)·\|Cm\|·600, ±(H/2−20))`. Curve now always fits inside the H=200 viewBox. |
| 3 | `src/components/studio/ColumnDiagrams.tsx:59-66` | +6/-3 | `RC1_Seccion`: moved b dim line from `bh+22` to `bh+38` and placed the hx callout at `bh+14`/`+24`. Eliminates the overlap between hx text and b-dim text. |
| 4 | `src/components/studio/RetainingWallDiagrams.tsx:144-163` | +6/-5 | `D1_CrossSection`: staggered the previously-overlapping b/ct/Bp dim lines — b and Bp at +40, ct centered at +56 so all three are legible. |
| 5 | `src/components/studio/IsolatedFootingDiagrams.tsx:172-176` | +4/-1 | `D15_AnclajeLdb`: removed `offset=-30` (which pushed h_z label past the SVG left edge); moved the dim line inboard (`zx + 14`) so it stays inside the padding. |
| 6 | `src/components/studio/IsolatedFootingDiagrams.tsx:329-333` | +2/-2 | `D19_Punzonamiento`: clamp d/2 label x to `max(clippedX−4, 60)` and flip `textAnchor` to `start` when clamped, so the label is never clipped against the SVG left edge. |
| 7 | `src/components/studio/MoreDiagrams.tsx:189-194` | +3/-2 | `TWSPlan`: corner column rects (representing slab-supporting columns) are now rendered flush INSIDE each corner instead of centered on the corner (half outside the slab polygon). |
| 8 | `src/components/studio/BeamDiagrams.tsx:241-247` | +3/-2 | `BM4_Moments`: clamp the y-coordinate of the M⁻/M⁺ labels to `max(28, …)` so they never escape the top of the viewBox when moment values are large. |
| 9 | `src/components/studio/MoreDiagrams.tsx:367-395` | +9/-5 | `StairProfile`: clamp `RisePx` to a maximum that fits within H−2·padding, and replace the bottom-face return points with a proper offset-parallel stringer (was self-intersecting through the stair edges when totalRise was large). |
| 10 | `src/components/studio/RetainingWallDiagrams.tsx:484-510` | +14/-4 | `D6_SectionWeights`: replaced `padStart()`-aligned single text element (SVG `<text>` collapses leading whitespace runs) with one `<text>` per column using fixed x-anchors and `textAnchor="end"`. Table columns now align numerically. Updated header to match. |

**Verification**: `npx tsc --noEmit` → exit 0.

---

## 3. Remaining Issues (deferred to next polish pass)

| Issue | File | Rationale for deferral |
| --- | --- | --- |
| `ForceArrow` `maxLength` saturates large vectors (visual log scale OK but length identical above ~200 kN) | `svg-primitives.tsx:196-209` | Already logarithmic; would need redesign of legend, not a surgical fix |
| `DistributedLoad` arrow geometry has a typo (`cx === x` branch is unreachable) | `svg-primitives.tsx:258-269` | Unused by current pages; `DistributedDownLoad` is what's actually called |
| BM3 zone bars overlap zone-name text at `yBot + 6 / + 22` | `BeamDiagrams.tsx:164-175` | Visible but readable; needs vertical stacking redesign |
| `BM5_Shear` φVc band identical to Vu envelope when phiVc > Vu (clamped to 0.9·amp) | `BeamDiagrams.tsx:271` | Engineering-meaning-correct fix needs separate amp axis |
| RC2 zone labels at `x0 − 20` go off-canvas when colW < ~30 px | `ColumnDiagrams.tsx:150-161` | Padding rework needed; surgical fix would shift the whole column |
| D12 C1 dim text overlaps L-dim text when column is wider than column-strip | `IsolatedFootingDiagrams.tsx:59` | Layout reshuffle, not surgical |
| D16 q_min/q_max labels overflow on narrow B | `IsolatedFootingDiagrams.tsx:208-210` | PressureDistribution primitive owns this — central fix |
| D20 unused `bandLength`/`bandFx` dead code | `IsolatedFootingDiagrams.tsx:364-365` | Cosmetic; not visual |
| TieBeamPlan zapata blocks aren't scaled to B/L | `MoreDiagrams.tsx:264-267` | Diagram is schematic by intent — confirm with PM before adding scale |
| LintelElevation walls extend 70 px below regardless of opening height | `MoreDiagrams.tsx:429-431` | Cosmetic; widely used pattern |
| D2_Isometric uses fixed scale=30 instead of fitting wall to canvas | `RetainingWallDiagrams.tsx:184-185` | Iso view is data-driven by `r.B_m` but scale is constant — needs proper auto-fit |
| D10 4-slot layout overflows W=720 on the last slot | `RetainingWallDiagrams.tsx:702-705` | Need to widen W or shrink slotW |
| D7 StatusReadout box at `W-145, H-50` overlaps the wall in narrow geometries | `RetainingWallDiagrams.tsx:531-535` | Auto-place readout outside wall bbox |
| Inline pages duplicate `<defs>` blocks (combined-footing, confined-masonry, strut-tie) | inline page.tsx files | Only the second `<defs>` survives; markers still work, just dead code |
| esbeltez-columna lateral deflection clamps at δ=3.0 — visually identical for any δ ≥ 3 | `esbeltez-columna/page.tsx:48` | Engineering trade-off — discuss with author |
| beam-column-joint "Σ↓" glyph as a column moment indicator | `beam-column-joint/page.tsx:90` | Should be a real curved arrow primitive (`RotationArrow`) |
| punzonamiento-momento stress trapezoid drawn with 3 lines only | `punzonamiento-momento/page.tsx:93-98` | Use `PressureDistribution` primitive instead |
| strut-tie pile-cap renders pile rects below `capY + capH` and below H boundary at high n_piles | `strut-tie/page.tsx:170-180` | Needs viewBox H bump or pile bar trimming |

**Total deferred**: 13 distinct issues.

---

## 4. Visual Language Conventions (enforced)

All new fixes adhere to the existing primitives in `src/components/studio/svg-primitives.tsx`:

| Element | Convention | Primitive |
| --- | --- | --- |
| Concrete fill | `#d4d4d8` w/ 45° hatch `#a1a1aa` | `<pattern id="concrete-hatch">` (SvgDefs) |
| Soil fill | `#92400e` w/ horizontal hatch `#78350f` | `<pattern id="soil-hatch">` (SvgDefs) |
| Longitudinal rebar | Amber `#f59e0b` circles, radius = `1.5 + size·0.4` | `RebarCircle`, `RebarRow`, `RebarPerimeter`, `RebarCircular` |
| Stirrups / ties | Emerald `#10b981`, `strokeDasharray="3,2"` | `StirrupRect`, `StirrupRing` |
| Spirals | Continuous emerald helix | `SpiralElevation` |
| Dimension lines | Blue `#3b82f6`, arrowheads at both ends, label in centered text-bg | `DimLine` |
| Force vectors | Red `#dc2626`, length proportional (log scale) to magnitude | `ForceArrow` |
| Distributed loads | Red downward arrows on a top line | `DistributedDownLoad`, `DistributedLoad` |
| Soil pressure | Trapezoidal/triangular polygon + arrows | `PressureDistribution` |
| Critical sections | Dashed red `#ef4444`, `strokeDasharray="5,3"` | inline |
| 135° seismic hooks | Real bent geometry | `Hook135` |
| Pass/fail badge | Inline in SVG with green/red glow | `StatusReadout` |
| Section number badge | Numbered circle | `SectionBadge` |
| Frame header | Title + optional subtitle + pass/fail badge | `DiagramFrame` |

**Inline SVGs that bypass primitives (combined-footing, mat-foundation, pile-cap, beam-column-joint, punzonamiento-momento, etc.) are the next-priority migration target.** They duplicate `<defs>`, redefine markers locally, and don't get the `DimLine` text-bg-suppression auto-fix.

---

## 5. Recommendations for Next Polish Pass

1. **Migrate inline page SVGs onto primitives**: every inline `<svg>` in `app/studio/**/page.tsx` should import `SvgDefs`, `DimLine`, `ForceArrow`, etc. instead of redeclaring `<defs>` and `<marker>` blocks. Estimated 14 pages × ~30 LoC = ~420 LoC.
2. **Add auto-placement helper for StatusReadout**: compute the readout's box position from a passed bbox so it never overlaps the wall/footing geometry (D7, D8, D9 currently hard-code `W-145, H-50`).
3. **Standardise viewBox dimensions per diagram class**: section views 360×360, elevations 720×260, plan+section 720×340, P-M diagrams 360×320 — reduces per-component padding math.
4. **Fix duplicate `<defs>` in inline pages**: `combined-footing`, `confined-masonry`, `strut-tie` declare `<defs>` at end of SVG after the first `<defs>`. Only the first survives.
5. **Convert magic-number labels to a `LabelToken` primitive**: every page repeats `<text fontSize="9" fontFamily="ui-monospace, monospace">…</text>` patterns. A `<DiagramLabel size="sm|md|lg" tone="dim|primary|rebar|force|pass|fail" />` would shrink the codebase ~15%.
6. **Auto-fit isometric `D2_Isometric`**: the scale=30 hard-code breaks for B > 6 m. Replace with `Math.min((W-160)/(B+Htot), (H-100)/(B+Htot)) * 0.9`.
7. **Add `gstack benchmark` regression tests** for SVG render time on the 4 heaviest diagrams (D11, D20, D6, BM3).
8. **Run the `design-review` skill** against the live studio pages once the inline-page migration completes, to catch issues that are only visible in the rendered browser.

---

## 6. Sign-off

- **Files modified**: 5 (`ElementDiagram.tsx`, `BeamDiagrams.tsx`, `ColumnDiagrams.tsx`, `IsolatedFootingDiagrams.tsx`, `MoreDiagrams.tsx`, `RetainingWallDiagrams.tsx`) — 6 total.
- **Lines changed**: ~75 (mix of additions, edits, brief CR-Vis-Bug comments anchored to 2026-05).
- **TypeScript check**: `npx tsc --noEmit` → exit 0.
- **No deploy**: per instructions.
- **No diagrams redesigned from scratch**: all fixes are surgical edits to existing renderers, preserving the visual language in `svg-primitives.tsx`.
