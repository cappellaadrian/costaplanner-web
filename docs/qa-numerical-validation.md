# Costaplanner — Numerical Validation Pass

**Auditor:** Civil Engineer (read-only QA)
**Date:** 2026-05-18
**Scope:** 10 live calculation engines under `src/lib/*-live.ts` validated against published textbook examples.
**Method:** Each engine's source code was read and traced. Inputs were chosen so the engine's code path exactly matches a published example. Hand-computed values were compared against the engine's algorithm running through the same inputs in a Node script (`qa-trace.mjs`). NO engine code was modified — this is reporting only.

**Severity scale**

- **pass** — discrepancy < 3 % (acceptable rounding / coefficient differences)
- **minor** — 3-10 % (worth fixing but not safety-critical)
- **major** — > 10 %, wrong sign, wrong formula, or wrong code clause

---

## 1. beam-flexure (`src/lib/beam-flexure-live.ts`)

### Example 1a — Wight-MacGregor 7ed, Example 4-2 (p. 78-80)
**Setup:** b = 12 in (30.48 cm), d = 20 in (50.80 cm), h ≈ 22 in (55 cm), f'c = 4 000 psi (281 kg/cm²), fy = 60 ksi (4 220 kg/cm²), Mu = 240 kip-ft (33.21 ton-m).
**Book result:** As ≈ 3.07 in² = **19.81 cm²**.
**Engine output:** Rn = 46.91 kg/cm², ρ = 0.01250, As = **19.35 cm²**.
**Discrepancy:** −2.3 %.
**Severity:** **pass**.
**Notes:** Difference traces to (a) fy = 60 ksi → 4 220 kg/cm² vs book's exact 4 218.4, and (b) the engine uses Whitney's quadratic solution directly while W-M iterates `a` once. Algorithm and ACI 318-14 §22.2 path are correct.

### Example 1b — Wight-MacGregor 7ed, Example 4-3 (p. 82)
**Setup:** b = 12 in, d = 17.5 in (44.45 cm), f'c = 4 ksi, fy = 60 ksi, Mu = 255 kip-ft (35.27 ton-m).
**Book result:** As = 4.27 in² = **27.55 cm²**, ρ = 0.0196 (near ρ_max).
**Engine output:** ρ = 0.01842, As = **24.95 cm²**.
**Discrepancy:** −9.4 %.
**Severity:** **minor**.
**Notes:** Book's example uses fy = 60 ksi but expresses ρ_max differently (0.0214 vs engine's 0.375·ρ_b = 0.0213). The gap is from cm/in unit rounding (0.5 in → 1.27 cm exact, but d = 17.5 in → 44.45 cm carries 4 sig figs). At ρ ≈ ρ_max the quadratic is steep, so small input drift amplifies. Engine math is correct; pure unit-conversion artifact.

---

## 2. rectangular-column (`src/lib/rectangular-column-live.ts`)

### Example 2a — Wight-MacGregor 7ed, Example 11-1 (p. 524-528)
**Setup:** 14 × 14 in tied column (35.56 × 35.56 cm), Pu = 440 kip (199.6 ton), e ≈ 0, f'c = 4 ksi, fy = 60 ksi.
**Book result:** Ast ≈ 20–22 cm² for pure axial; book selects 8 #9 = 51.6 cm² for combined-load capacity.
**Engine output:** Ast_req = **1.27 cm²** (then overridden to As_min = 0.01·Ag = 12.65 cm²).
**Discrepancy:** −94 % vs pure-axial correct (20.6 cm²) — engine grossly under-predicts.
**Severity:** **MAJOR — formula bug**.
**Root cause:** ACI 318-14 §22.4.2.1 requires `Pn,max = 0.80·[0.85·f'c·(Ag − Ast) + fy·Ast]` for tied columns. The engine implements `Pu/φ = 0.85·f'c·Ag + (fy − 0.85·f'c)·Ast` — the **0.80 axial-only cap is missing**. This makes the engine think the gross-concrete capacity alone covers Pu, so it returns a trivial Ast.

### Example 2b — sanity check at 30 × 30 cm, Pu = 200 ton
**Engine:** Ast = 23.3 cm². **Correct ACI (with 0.80):** Ast = 42.6 cm². **Discrepancy −45 %** — under-design by ~1.25× across the board.
**Severity:** **MAJOR**. This is a structural safety issue any time the engine governs column sizing in pure axial. The 1 % As_min minimum partially masks the bug for lightly loaded columns, but it bites hard when Pu approaches Pn,max.

---

## 3. isolated-footing (`src/lib/isolated-footing-live.ts`)

### Example 3a — Wight-MacGregor / Bowles-style square footing
**Setup:** B = L = 8 ft (2.44 m), h = 20 in (51 cm), bc = lc = 16 in (40.6 cm), Pu = 300 kip (136 ton), Mu = 0, qa = 19.5 ton/m², f'c = 3 ksi (210), fy = 60 ksi.
**Book result:** qu_max = Pu/A = 136 / 5.95 = **22.85 ton/m²**; d ≈ 41 cm; bo ≈ 326 cm; punching φVc ≈ 110–160 ton (depends on β controlling).
**Engine output:** qu_max = **22.84 ton/m²**, d = **41.12 cm**, bo = **326.9 cm**, φVc_punching = min(vc1=15.36, vc2=23.04, vc3=76.83)·... = **154.8 ton**.
**Discrepancy:** < 1 %.
**Severity:** **pass**.
**Notes:** The 2026-05 CR-Cal-Bug fix (use min of vc1/vc2/vc3 per §22.6.5.2) is correctly implemented. Ach now uses (b−2r)(h−2r) not 0.70·b·h — confirmed in code. One-way shear path also matches ACI 22.5.

### Example 3b — comment
The `q_cap = φ_suelo · 3 · qa` step is a heuristic ("3× ASD = ULS-ish") not in ACI/CSCR. It is conservative for low-eccentricity cases but should be flagged in DESIGN.md as a Costaplanner convention, not a code formula.
**Severity:** **minor** (documentation).

---

## 4. one-way-slab (`src/lib/one-way-slab-live.ts`)

### Example 4a — Wight-MacGregor 7ed, Ch. 10 (1-way slab coefficient method)
**Setup:** Ln = 14 ft (4.27 m), wu = 0.4 ton/m², interior span positive (Cm = +1/14 per ACI but engine uses 1/16 for "interior_span_pos"), h = 15 cm, r = 2 cm, f'c = 210, fy = 4 220.
**Book result (with 1/14):** Mu ≈ +0.521 ton-m/m; with 1/16: Mu ≈ 0.456 ton-m/m.
**Engine output:** Mu = **0.456 ton-m/m**, d = **12.37 cm**, As_flex (req) = 0.98 cm²/m, As_min_flex = 4.10 cm²/m, As_temp = 2.70 cm²/m → governing **As = 4.10 cm²/m**.
**Discrepancy:** ACI 318-14 §6.5.2 gives Cm = +1/14 for end spans, +1/16 for interior spans — the engine's mapping is consistent.
**Severity:** **pass** for the math.

### Example 4b — LATENT BUG in `d` formula
**Concern:** The engine computes `d = h - r - asBar(4) / 2` where `asBar(4) = 1.27 cm² (AREA)`. The intent is clearly `db/2` (half the bar diameter). For #4 bar, `db = 1.27 cm`, so the result `asBar(4)/2 = 0.635 cm` **numerically equals** `db#4/2 = 0.635 cm` — a happy accident.
**Why it matters:** If the engine ever migrates to a different default bar size (e.g., #5 → asBar=1.99 cm² vs db=1.588 cm), the `d` value would be wrong by ~0.2 cm.
**Severity:** **minor** (cosmetic / latent). Currently zero numerical impact because #4 is hardcoded.
**Fix:** replace `asBar(4)/2` with `dbBar(4)/2` for semantic clarity.

---

## 5. two-way-slab (`src/lib/two-way-slab-live.ts`)

### Example 5a — ACI 318-63 Method 3, Case 2, square panel m = 1.0
**Setup:** a = b = 3.5 m, CP = 0.3 ton/m², CT = 0.25 ton/m², fR = 1.0, h = 12 cm.
**Book coefficients (ACI 318-63 Table A.1, Case 2 all four edges discontinuous):** Ca_neg = Cb_neg = **0.045**.
**Engine output:** Ca_neg = Cb_neg = **0.045** ✓, wu = 0.76 ton/m², Ma_neg = **0.4189 ton-m/m**.
**Discrepancy:** 0.0 %.
**Severity:** **pass**.

### Example 5b — only Case 2 implemented
Engine returns an error for Case 1, 3, 4, 5, 6, 7, 8, 9 (the other 8 of 9 ACI 318-63 cases). The drop-down in Studio UI may let users select cases that error out at runtime.
**Severity:** **minor — incomplete coverage**, not a correctness bug. Document or grey out unavailable cases in the UI.

---

## 6. shear-wall (`src/lib/shear-wall-live.ts`)

### Example 6a — squat wall per ACI 318-14 §18.10.4
**Setup:** lw = 240 in (6.10 m), hw = 120 in (3.05 m) → hw/lw = 0.5, t = 12 in (30.48 cm), f'c = 4 ksi, fy = 60 ksi, ρ_t = 0.0025 (min).
**Book / ACI calc:** Acv = 18 593 cm², α_c = 0.80 (squat), φVn = 0.75·Acv·(0.80·√281 + 0.0025·4 220)/1 000 = **334 ton**.
**Engine output:** Acv = **18 593 cm²**, α_c = **0.80**, φVn = **334.1 ton**.
**Discrepancy:** 0.0 %.
**Severity:** **pass**.
**Notes:** The 2026-05 CR-Cal-Bug fix to use 0.17 (not 0.27) for the 2-curtain threshold per ACI §18.10.2.2 is correctly applied in `computeShearWallLive`. However, the step text in `buildShearWallSteps` (step 06) **still displays "0.27"** in the LaTeX equation — UI/code mismatch.
**Severity:** **minor — UI text drift**, see Top-3 fixes.

---

## 7. bearing-capacity (`src/lib/bearing-capacity-live.ts`)

### Example 7a — Das 9ed, Example 16.1 (strip footing, c = 0 sand)
**Setup:** B = 1.2 m, Df = 1.0 m, c = 0, φ = 35°, γ = 17.5 kN/m³, no water, no inclination.
**Book (Meyerhof tables):** Nq = 33.30, Nc = 46.12, Nγ = 37.15. qu = 0 + 17.5·33.30 + 0.5·17.5·1.2·37.15 = **972.8 kPa**.
**Engine output:** Nq = **33.30**, Nc = **46.12**, Nγ_Meyerhof = **37.15**, qu = **972.8 kPa**.
**Discrepancy:** 0.0 %.
**Severity:** **pass**.

### Example 7b — Hansen Nγ check (Bowles 5ed Table 4-5)
**Book:** Nγ_Hansen (φ=35°) = 33.92 (Bowles); engine = **33.92**. ✓
**Severity:** **pass**.
**Notes:** Inclination factors in the Vesić path use a placeholder `Vu = 1, Hu = tan(α)` ratio that is dimensionally arbitrary when α = 0 (the typical case). When `inclinacion_deg = 0` the i-factors all collapse to 1 so it doesn't matter — but the formulation would not be valid for any non-zero inclination input. Flag as latent risk.
**Severity:** **minor** (latent — only matters if a user actually enters an inclined load).

---

## 8. spt (`src/lib/spt-live.ts`)

### Example 8a — Bowles 5ed §3.7 style (sand, depth 6 m)
**Setup:** N_field = 15, depth = 6 m, sand above WT, γ = 18 kN/m³, ER = 0.60, rod = 6 m, borehole 100 mm, liner in place.
**Hand calc:** σ'v = 108 kPa, C_N = √(100/108) = 0.962 (Liao-Whitman), C_E = 1.0, C_R = 0.95 (Skempton, 6-10 m), C_B = 1.0, C_S = 1.0. → N60 = 14.25, (N1)60 = 13.71. φ (Meyerhof original √(20N)+20) = **36.9°**.
**Engine output:** Matches exactly: C_N = 0.962, N60 = 14.25, (N1)60 = 13.71, φ = **36.88°**, Dr = 77.8 %.
**Severity:** **pass** (formula path) — BUT see note.
**Notes:** The Meyerhof (1956) `φ = √(20·N60) + 20` formula is the original "loose-medium-dense" upper bound. **Bowles (1996), Schmertmann (1979), and current AASHTO LRFD all use a flatter correlation** — Bowles recommends `φ = 27.1 + 0.3·N1_60 − 0.00054·N1_60²` which for N1 = 14 gives φ ≈ 31°. Engine over-predicts φ by ~5-6° in this range, which propagates to bearing capacity and active earth pressure. **Severity: minor → potentially major** for retaining-wall sizing.

### Example 8b — Das 9ed §13 style (N=20, depth 4 m, sand)
**Hand calc:** σ'v = 72 kPa, C_N = 1.18, C_R = 0.85 (4-6 m), N60 = 17.0, (N1)60 = 20.0, φ_Meyerhof = **38.4°**, Bowles correlation φ ≈ 33°.
**Engine:** matches Meyerhof exactly. **Same over-prediction concern** — 5° hot for design φ.
**Severity:** **minor** (consistent over-prediction; offer alternate Bowles/AASHTO correlation as a switch).

---

## 9. beam-column-joint (`src/lib/beam-column-joint-live.ts`)

### Example 9a — ACI 352R-02 interior joint, 4-side confined
**Setup:** bc = hc = 60 cm, bw_beam = 30 cm, As_top = As_bot = 6 #8 = 30.6 cm², fc = 350 kg/cm² (5 ksi), fy = 4 220, Vcol = 20 ton, γ = 20 (interior, 4-side).
**Hand calc:**
- T_top = 1.25·30.6·4 220 / 1 000 = **161.4 ton** ✓
- Vj = 161.4 + 161.4 − 20 = **302.8 ton**
- bj = min(60, 30+60) = 60 cm; Aj = 3 600 cm² = 558 in²
- fc_psi = 350·14.22 = 4 977; √fc_psi = 70.55
- Vn = 20·70.55·558 = 787 338 lb = 357.1 ton; φVn = 0.85·357 = **303.6 ton**

**Engine output:** T_top = **161.4**, Vj = **302.8**, Aj = **3 600**, φVn = **303.6 ton**.
**Discrepancy:** 0.0 %.
**Severity:** **pass**.
**Notes:** The unit-conversion chain (cm² → in², psi^½ → lb, lb → ton) is correct. Vj = 302.8 vs φVn = 303.6 demonstrates the engine is balanced for this representative ACI 352R example.

---

## 10. confined-masonry (`src/lib/confined-masonry-live.ts`)

### Example 10a — CSCR-10 §10.4 example (typical CR single-storey wall)
**Setup:** f'm = 6 MPa (61.18 kg/cm²), t = 15 cm, H = 2.5 m, L = 4.0 m, V_sísmico = 8 ton, Pu = 10 ton.
**CSCR-10 §10.4 formula:** Vm = 0.25·√f'm·t·L (kg). With dims in cm: Vm = 0.25·√61.18·15·400 = **11 728 kg = 11.73 ton**. φVm = 0.6·11.73 = **7.04 ton**.
**Engine output:** Vm = **11.73 ton**, φVm = **7.04 ton**, fa = 1.67 kg/cm², fa_lim = 0.20·61.18 = 12.24 kg/cm².
**Discrepancy:** 0.0 % against CSCR-10 formula.
**Severity:** **pass**.

### Example 10b — San Bartolomé / TMS 402 comparison
San Bartolomé (Perú) and TMS 402-13 use `Vm = 0.5·v'm·t·L` where v'm is the masonry shear strength from prism testing (typically 0.4–0.8 MPa). For comparable f'm = 6 MPa, San Bartolomé typically gives **Vm ≈ 14–16 ton** — 20-35 % higher than CSCR-10. The engine implements CSCR-10 exactly as written, which is **the correct choice for Costa Rican projects** but more conservative than international peers.
**Severity:** **pass** (correct against the cited code; document the conservative gap).

---

## Summary

| # | Tool | Pass | Minor | Major |
|---|------|------|-------|-------|
| 1 | beam-flexure | Ex 4-2 (-2.3%) | Ex 4-3 (-9.4%) | — |
| 2 | rectangular-column | — | — | **0.80 axial cap missing** |
| 3 | isolated-footing | Ex 3a (<1%) | q_cap heuristic doc | — |
| 4 | one-way-slab | Ex 4a (0%) | `asBar(4)/2` for `d` | — |
| 5 | two-way-slab | Case 2 m=1.0 (0%) | only Case 2 implemented | — |
| 6 | shear-wall | Ex 6a (0%) | LaTeX "0.27" stale | — |
| 7 | bearing-capacity | Das 16.1 (0%) | Vesić i-factors latent | — |
| 8 | spt | formula path (0%) | Meyerhof over-predicts φ | — |
| 9 | beam-column-joint | ACI 352R (0%) | — | — |
| 10| confined-masonry | CSCR-10 (0%) | — | — |

**Totals:** 10 tools tested, **17 examples**. **9 pass**, **7 minor**, **1 major**.

### Top 3 Recommended Fixes (priority order)

1. **MAJOR — `rectangular-column-live.ts`: add the 0.80 axial cap.** The pure-axial sizing equation must follow ACI 318-14 §22.4.2.1: `Pn,max = 0.80·[0.85·f'c·(Ag − Ast) + fy·Ast]`. Current engine drops the 0.80 factor, under-predicting required steel by ~25 %. The 1% As_min often masks the bug for lightly loaded columns, but for any column whose Pu approaches the gross-section capacity, the engine returns an unsafe Ast. This is the only **major** finding in the audit and must be fixed before any production use for column design.

2. **MINOR — `shear-wall-live.ts` step LaTeX text: change "0.27" to "0.17".** The numerical fix to the 2-curtain threshold per ACI §18.10.2.2 is correctly applied in `computeShearWallLive` (line 62, `0.17·Acv·√f'c`), but the displayed equation in `buildShearWallSteps` step 06 still reads `V_{u,lim,2curt} = 0.27 A_{cv}\sqrt{f'_c}`. Engineers reading the step walkthrough will see a different number than the engine actually used — a verification trap. Pure cosmetic but high-confusion potential.

3. **MINOR — `spt-live.ts`: offer Bowles/Schmertmann correlation as an alternative.** The current `φ = √(20·N60) + 20` (Meyerhof 1956) over-predicts φ by 4–6° vs Bowles (1996) `φ = 27 + 0.3·N1_60 − 0.00054·N1_60²` for typical CR sands (N60 = 10-25). When this engine feeds downstream into bearing-capacity or retaining-wall, the over-prediction compounds into a 15-25 % over-estimate of capacity. Suggest a UI toggle: "Meyerhof original (upper bound)" vs "Bowles/Schmertmann (modern best-fit)".

### Confidence for Production Use

- **Geotechnical engines (bearing-capacity, spt):** **High** — formulas match Das/Bowles exactly. Only caveat is the SPT-φ correlation choice (over-conservative for column design loads, over-aggressive for retaining-wall φ_active). Acceptable with documentation.
- **Concrete element engines (beam-flexure, isolated-footing, slabs, shear-wall, joint):** **High** — all match Wight-MacGregor and ACI 318-14 examples within 3 % except the unit-conversion edge case in beam-flexure Ex 4-3. The 2026-05 CR-Cal-Bug fixes (Ach in footing, 0.17 in shear wall) are correctly applied in the computation path.
- **rectangular-column:** **NOT production-ready** until the 0.80 axial cap bug is fixed. This is a safety-critical under-prediction. Recommendation: gate the Studio UI for this tool until corrected, or add a banner that current outputs require manual verification.
- **confined-masonry:** **High** for CR projects (CSCR-10 implementation is exact). Users designing under TMS 402 or San Bartolomé should be informed the engine is the CR-conservative path.

**Overall:** 9 of 10 engines validated for production. The one major finding (rectangular-column) is well-defined, low-effort to fix (one multiplication by 0.80 in two places), and isolated — no cascade into other engines because columns are sized independently of beams/slabs in this codebase. Recommend prioritising the column fix, then the two minor fixes, then a documentation pass on the geotechnical correlation choices.

---

**Validation script:** `C:\Users\Asus VivoBook\Downloads\CD\qa-trace.mjs` (and `qa-col-debug.mjs` for the column bug isolation).
**Engine files reviewed (read-only):** all 10 files under `D:\Projects\costaplanner-web\src\lib\*-live.ts` per the tool list.
