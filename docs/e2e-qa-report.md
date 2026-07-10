# Costaplanner — End-to-End QA Report

**Date**: 2026-05-19
**Target**: https://costaplanner.vercel.app
**QA agent**: EvidenceQA (skeptical, evidence-based)
**Method**: PowerShell `Invoke-WebRequest` for live HTTP + Grep/Read against `D:\Projects\costaplanner-web\src\app` for authenticated paths
**Build markers observed live**: `/codigo` HTML embeds `Build v2.3 · 2026-05-18 · subíndices renderizados`

---

## 1. Live URL status table

All probes from PowerShell `Invoke-WebRequest -UseBasicParsing` against the production Vercel domain. SVG count is `<svg` matches in the raw SSR HTML (Next.js client pages have low SSR counts because most of the calc UI is client-rendered).

| Slug | HTTP | SVGs (SSR) | Page size | Suspicious patterns |
|---|---|---|---|---|
| `/` | 200 | 0 | 11,376 | None — landing is static SSR |
| `/login` | 200 | 0 | 5,801 | **Almost empty SSR shell** — no `<form>`, no `<input>` in HTML. Form only mounts after JS hydration. Bad for SEO + JS-disabled users. |
| `/register` | 200 | 0 | 7,831 | Same client-only pattern as `/login` — but 4 inputs DO appear in raw HTML once hydrated (Vercel returns the post-hydration shell here) |
| `/studio` | 200 | 0 | 25,863 | 29 catalog tiles serialized in HTML. SSR-friendly. |
| `/studio/diseno-rapido` | 200 | 0 | 10,078 | Only first wizard step in SSR (`Paso 1` mention × 1, no `Paso 2..7`) — wizard is client state, fine. |
| `/studio/beam` | 200 | 8 | 142,315 | 22 ACI refs, 9 CSCR refs, 95 katex spans, 20 `$undefined` (Next.js RSC payload markers — NOT a bug) |
| `/studio/rectangular-column` | 200 | 5 | 91,580 | Esbeltez + biaxial sub-panels present in source; SSR renders only the parent (sub-panels conditional) |
| `/studio/isolated-footing` | 200 | 11 | 128,881 | Punzonamiento sub-panel auto-mounts when `Mu>0` — confirmed in source |
| `/studio/geotecnica/spt` | 200 | 1 | 28,339 | SPTProfileSvg present, single SVG = the boring-log profile diagram |
| `/codigo` | 200 | 0 | 12,400 | 8-tab reference page, build stamp visible. No KaTeX (uses unicode subscripts) |
| `/proyectos` | 200 | — | 6,545 | **No SSR auth gate** — renders `"Cargando proyectos…"` to anonymous users; redirect must be client-side via 401 from `/api/design-projects` |
| `/proyectos/new` | 200 | — | 10,653 | Same — wizard shell renders for anonymous users |
| `/mis-disenos` | 200 | — | 7,409 | Same |
| `/studio/geotecnica` | 200 | — | 29,860 | Catalog page, loads |
| `/studio/proyecto` | 200 | — | 13,655 | Loads |
| `/api/health` | 404 | — | — | No health endpoint configured |

**Headline**: 14/14 user-reachable pages return 200. No 500s, no broken redirects.

---

## 2. Visual evidence — what an anonymous user actually sees on first load

### `/` (landing)
**Title**: `Costaplanner — Diseño estructural Costa Rica`
**H1**: `Diseño estructural para Costa Rica,` (note the dangling comma — second line is `con cada fórmula a la vista.`)
**Above-the-fold visible copy** (extracted from HTML):
- `CSCR-10 + ACI 318 + INTE C85`
- `Mathcad para ingeniería`
- `PDF + Excel + sello CFIA`
- Long-form body: *"Diseña vigas, columnas, zapatas y losas conforme al CSCR-10 Rev. 2014 y ACI 318-14. Cada paso de cálculo se muestra como una ecuación renderizada, con citas al código y verificación en vivo."*
- Trust copy: *"No es una calculadora genérica. Cita cada artículo del código costarricense, con f'c mínimo por zona sísmica y A706 obligatorio en zonas III-IV."*

**Primary CTA**: `Empezar con viga` button + `Ver elementos →` link.
**Nav links discovered in HTML**: only `/studio`, `/studio/beam`, `/mis-disenos`. No `/login`, `/register`, `/codigo`, `/proyectos` links in header.
**Footer**: `Hecho en Costa Rica · 2026 ·`
**Inferred console errors**: none expected — static markup, no React state.

### `/login`
**Visible (post-hydration)**: brand wordmark `Costaplanner` (amber), H1 `Iniciar sesión`, email + password inputs, submit `Entrar`, link to `/register`. Optional notice if `?from=revara`: *"Usa la misma cuenta de REVARA. Las credenciales son compartidas."*
**Visible (no JS / first paint)**: nothing — empty `<main>` shell. **Issue**: if hydration fails or is slow, user sees a blank dark page.

### `/register`
**Visible**: H1 `Crear cuenta`, helper *"La misma cuenta sirve para REVARA. Una sola identidad."*, 4 inputs: Nombre / Empresa (opcional) / Correo electrónico / Contraseña (minLength 8). Submit `Crear cuenta`. Link `¿Ya tienes cuenta?` → `/login`.
**Auto-login**: on `/api/auth/register` 200, immediately calls `signIn("credentials", ...)` and pushes `/studio/beam`. Good UX.

### `/studio`
**H1**: `Elementos estructurales`. Eyebrow: `Costaplanner Studio`.
**Top-bar CTAs**: 🏠 Proyecto completo → (emerald, primary), 🌱 Geotecnia →, Referencia CSCR-10 + ACI 318 → (`/codigo`).
**Headline tile (Diseño Rápido)**: **PROMINENTLY DISPLAYED** as a large gradient emerald card directly under the top bar, *before* the group grids. Title: `Diseña tu casa CR en 7 pantallas`. NUEVO badge. Body: *"Especifica área + zona sísmica + sistema, y obtén predimensionado completo de vigas, columnas, losas, zapatas y muros — más cantidades preliminares y memoria CFIA-ready..."*  Confirmed: spec match — this is the marquee CTA.
**Group structure**: 8 groups (`Cimentaciones`, `Columnas`, `Vigas`, `Losas`, `Muros`, `Cumplimiento sísmico ACI §18 / CSCR §8`, `Cimentaciones especiales · mampostería · detallado`, `Verificaciones de servicio y refinamientos`) holding **24 detailed calculator tiles** (NOT 35+). Plus the Diseño Rápido headline + `/studio/proyecto` + `/studio/geotecnica` shortcut buttons = **29 unique `/studio/*` links** in the page.
**Footer**: `¿Necesitas un elemento que no aparece? Escribe a soporte@costaplanner.com.`

### `/studio/diseno-rapido`
**H1**: `🏠 Diseño Rápido — CSCR §17`. First-step subheading visible in SSR: `¿Qué vas a diseñar?`
**STEPS array** (from source): `["Tipo", "Geometría", "Sitio", "Sistema", "Materiales", "Resumen", "Resultado"]` — 7 confirmed.
**Default input** (from source): `casa_2pisos`, 80 m², 8×10 m, 2 pisos, altura 2.7 m, zona 3, suelo S2, qa 8 ton/m², `mampostería_confinada`, f'c 245, fy 4200, fm 7.5 MPa — sensible CR defaults.
**Live preview**: yes — `useMemo` calls `computeDisenoRapidoLive(input)` on every input change so user sees results recompute as they type.
**Bottom nav**: prev/next/generar buttons.

### `/studio/beam`
**Heavy page**: 142 KB SSR, 8 SVGs, 95 KaTeX spans. Has all documented features confirmed by imports + JSX line numbers:
- `SaveToProjectButton` (line 730 in `page.tsx`)
- `exportDesignAsExcel` / `printDesignAsPdf` (lines 651/655)
- `ElementDiagram` + `BeamDiagramSet` (line 871)
- `ModoAprendizajeToggle` + per-step `ModoAprendizajeBlock` (line 773)
- `ReferencesFooter bundle="beam"` (line 985)
- 5 named beam diagrams imported: `BM1_SectionApoyo, BM2_SectionCentro, BM3_Elevation, BM4_Moments, BM5_Shear`
- Hand-authored Spanish learning blocks for `flexure.step_01_Mu_kgcm`, `flexure.step_02_phi`, ...
- Cross-tool integrations: `computeTorsionVigaLive`, `computeDeflexionLargoPlazoLive`, `computeFisuracionLive` all imported into the beam page
- H1: `Modo estudio — Viga` (note: visible "Modo estudio — Viga" indicates the page title leans into the educational framing)

### `/studio/rectangular-column`
**H1/H2/H3 visible in SSR**: `Columna rectangular — Compresión axial`, `Referencias`, `Códigos aplicables`, `Confinamiento y detallado`.
**Sub-panels** (source-verified, file `page.tsx`):
- `computeEsbeltezLive` imported (line 23) — auto-mounts when `klu/r > 22` (ACI §6.2.5)
- `computeFlexionBiaxialLive` imported (line 24) — auto-mounts when `Muy_tonm > 0`
- `Muy_tonm` is held in a separate `useState` outside `RectColumnInput` *"so it doesn't bleed into the existing PDF snapshot"* — careful, intentional state design.
**Project prefill**: `prefilledRef` guard prevents double-prefill when project meta arrives via `useProjectContext()`.

### `/studio/isolated-footing`
**H1/H2 visible**: `Zapata aislada`, `Referencias`, `Códigos aplicables`, `Capacidad portante`.
**Sub-panel**: `computePunzonamientoMomentoLive` (line 24) wired with `edge: "interior"`, reuses `result.d_cm` and `result.Vu_pun` from the parent live engine — consistent state, not duplicated inputs.
**Diagrams**: imports `D12_PlanView, D13_ElevationX, D14_ElevationY, D16_PressureDist, D17_ShearL, D18_ShearS, D19_Punzonamiento, D20_FinalRebar` — 8 diagrams. SSR shows 11 `<svg>` tags (8 diagrams + 3 misc UI SVGs).
**Project prefill**: pulls `qa_ton_m2` from `useProjectContext().meta` so the footing inherits the latest QA-driven bearing pressure — this is the `qa_source` cascade banner integration on the dashboard.

### `/studio/geotecnica/spt`
**H1**: `🌱 Interpretación SPT`.
**Default readings** (source): 4 layers at 1.5/3.0/4.5/6.0 m with N-values 8/14/22/35 — water table at 3.5 m. Standard CR SPT setup.
**Profile SVG**: confirmed — `<SPTProfileSvg r={result} input={input} />` rendered TWICE in JSX (line 116 inside a diagram-list, line 323 inline). Component lives in `components/studio/GeotechDiagrams.tsx` (1,014 lines — substantial).
**Toolbar**: imports `ExportToolbar`, `SaveToProjectButton`, `ModoAprendizajeToggle`, `ModoAprendizajeProvider`.

### `/codigo`
**H1**: `Referencia CSCR-10 + ACI 318`.
**Build stamp visible**: `Build v2.3 · 2026-05-18 · subíndices renderizados`.
**Tabs**: 8 confirmed (simplificado/vigas/columnas/cimentaciones/losas/muros/detallado/materiales).
**React error #290 mitigation**: source has explicit comment *"keyed by `cite`, NOT `ref` — `ref` is a reserved React prop name that crashes function components with React error #290 in production"*. This bug has clearly been hit and fixed.
**KaTeX**: NOT used — content is plain HTML with unicode subscripts (the `subíndices renderizados` tagline indicates this rendering approach was a deliberate fix to whatever was broken before).
**SSR H2/H3 confirms**: `¿Cuándo aplica el Método Simplificado?`, `Densidad mínima de muros`, `Cortante basal simplificado` — first tab pre-rendered.

---

## 3. Code-path verification (authenticated paths)

### `/proyectos/new` — wizard with 5 screens ✅
File: `D:\Projects\costaplanner-web\src\app\proyectos\new\page.tsx`
- `useState(1)` for step + `Math.min(5, s + 1)` / `Math.max(1, s - 1)` caps
- `Step1`, `Step2`, `Step3`, `Step4`, `Step5` components rendered conditionally
- `<Stepper step={step} />` header + footer label `Paso {step} de 5`
- Step1 = Metadata (name, address, owner, engineer, CFIA code)
- Step2 = Estudio de sitio (zona sísmica 1-4 with descriptions, qa, φ, c, γ, water table)
- Step3 = Arquitectura (floors, gross area, building use enum)
- Step4 = Sistema estructural (system enum incl. `mampostería_confinada`, f'c, fy)
- Step5 = Confirmación + POST to `/api/design-projects`
- On 200 → `router.push('/proyectos/<id>')`
**Verdict**: matches spec exactly.

### `/proyectos/[id]` — dashboard ✅
File: `D:\Projects\costaplanner-web\src\app\proyectos\[id]\page.tsx`
- **CFIA Auditor**: line 633 — "Listo para CFIA" 10-row checklist (responsable, sísmico, joint check, qa_source, etc.)
- **Sections tree**: 8 section groups linking to `/studio/<x>?proyecto=<id>` — designs matched by name LIKE `%<element_type>%`
- **Joint check (real)**: `computeBeamColumnJointLive` imported (line 27) — runs pair-wise on saved beams × columns, capped at `5 × min(beams, columns)` (line 523-556), produces `jointWorst`, `jointEvalsCount`, `jointMandatory` (zone ≥ 3)
- **qa_source banner**: lines 918-928 — shows when `meta.qa_source` ∈ `"spt" | "capacidad-portante"` cascade hit
- **Saved toast / banner**: `?saved=<elementType>` banner (lines 349-397) — auto-dismisses after 10s, strips query param without re-navigating
- **Next-step nudge**: imports `getNextStep`, `getElementLabel` from `@/lib/next-step` for cross-tool flow
**Verdict**: every documented feature present and wired.

### `/proyectos/[id]/memoria` — master PDF builder ✅
File: `D:\Projects\costaplanner-web\src\app\proyectos\[id]\memoria\page.tsx`
- 4-step pipeline documented in the file header: fetch project → fetch each full design → `designToSnapshot()` → `printProjectAsPdf(snapshots, meta)`
- Imports: `printProjectAsPdf` from `@/lib/exporters/project-pdf`, `designToSnapshot, FullDesign, ProjectMeta` from `@/lib/proyectos/design-to-snapshot`
- Phase 1 limitations explicitly noted in the docstring: no diagrams, geotech entries render as inputs-only
**Verdict**: master PDF flow is real, with honest phase-1 caveats.

### `/mis-disenos` — 2-tab layout ✅
File: `D:\Projects\costaplanner-web\src\app\mis-disenos\page.tsx`
- `type Tab = "proyectos" | "orphans"` (line 56)
- `useState<Tab>("proyectos")` default (line 111)
- Two tab triggers (lines 203-225) with live counts: `Proyectos {projects.length}` / `Cálculos sueltos {orphans.length}`
- Tab content components: `ProjectsTab` (line 257) renders DesignProject cards with `computeCfiaAudit(...)` integration, `OrphansTab` (line 358) for unattached designs
- Imports `computeCfiaAudit, CfiaAuditMeta` from `@/lib/cfia-audit` — CFIA progress shown inline on each project card
**Verdict**: matches spec exactly.

---

## 4. Broken / suspicious findings

### S1 — `/proyectos`, `/proyectos/new`, `/mis-disenos` render HTML for anonymous users (no SSR auth gate)
Calling these without a session cookie returns 200 with the page chrome and `"Cargando proyectos…"` shell. The redirect to `/login` happens client-side after the `/api/design-projects` fetch returns 401 (presumably). Users get a flash of empty UI. Bots see authenticated-page metadata indexed.
**Evidence**: `Invoke-WebRequest /proyectos` → 200, 6,545 bytes, contains `Mis proyectos` H1 and `Cargando proyectos…` text. No `redirect`, `login`, or `signIn` string in the SSR HTML.

### S2 — `/login` is a fully client-rendered shell (5,801 bytes, zero `<input>` in SSR)
Source uses `"use client"` directive. With JS disabled or slow hydration, users see only the brand wordmark and the H1, no form.
**Evidence**: `Invoke-WebRequest /login` → form regex matches nothing; visible text count = 1.

### S3 — Stale doc-comments overstating tile counts
- `src\app\studio\page.tsx` line 4: *"catálogo de los 11 elementos estructurales soportados"* — actual count in `GROUPS` is **24** detailed tiles (+ Diseño Rápido + Proyecto + Geotecnia shortcuts). Off by 13.
- `src\app\studio\diseno-rapido\page.tsx` line 9: *"La dirección INVERSA de los 35 calculadores detallados."* — actual count is 24. Off by 11.
- The QA request itself says *"35+ tiles"* — this number is **incorrect** vs the live catalog.
**Impact**: low for users (they see the actual grid), but indicates spec drift. If marketing copy anywhere quotes "35 calculadores" it will be a fib.

### S4 — `/codigo` build stamp pins the page identity
`Build v2.3 · 2026-05-18 · subíndices renderizados` is hardcoded in JSX, not auto-derived from build env. Next deploy will silently still say "v2.3" unless someone bumps it.
**Evidence**: line 55 of `src\app\codigo\page.tsx`.

### S5 — Landing header is missing primary nav
The landing HTML exposes only 3 internal links (`/studio`, `/studio/beam`, `/mis-disenos`). There is **no link to `/login`, `/register`, `/codigo`, or `/proyectos`** from `/`. A first-time visitor cannot find the login button or the reference manual without typing the URL.
**Evidence**: regex over landing HTML extracted only the three slugs above.

### S6 — Landing H1 has a dangling comma
H1 is split across two lines: `Diseño estructural para Costa Rica,` then `con cada fórmula a la vista.` The comma-then-newline reads as a typographic accident on small screens where the line may collapse. Likely a deliberate stylistic break but worth confirming with the designer.

### S7 — `/api/health` returns 404
No health endpoint exists, so uptime monitors / status pages can't ping a lightweight URL. Minor, but standard hygiene.

### S8 — `/studio/beam` is 142 KB of SSR HTML
This is heavy for a first contentful paint. Most of it is KaTeX-rendered formulas (95 spans) + 8 SVG diagrams pre-rendered to HTML. Likely intentional (Mathcad feel needs the formulas visible immediately), but worth a Lighthouse pass — could be code-split with a streaming Suspense boundary for the non-default steps.

### Not actually broken (initial false alarms)
- `$undefined` strings in beam HTML (20 occurrences) — these are Next.js RSC serialization markers (`"error":"$undefined","errorStyles":"$undefined"`), not JavaScript `undefined` values. **Not a bug.**
- `/studio/diseno-rapido` showing only `Paso 1` in SSR — wizard correctly renders only the active step on the client. **Not a bug.**
- `/codigo` shows no KaTeX — by design; it uses unicode subscripts (§₆₀, ², etc.) and the build stamp explicitly says `subíndices renderizados`, which suggests this was the deliberate fix.

---

## 5. Recommended pre-launch fixes (top 5)

| # | Fix | Why | Effort |
|---|---|---|---|
| 1 | **Add header nav to `/` with Login + Register + Studio + Códigos + Mis diseños** | A first-time visitor literally cannot find the login button from the landing page. Currently only `/studio`, `/studio/beam`, `/mis-disenos` are linked. (S5) | 30 min — one header component |
| 2 | **SSR-redirect `/proyectos`, `/proyectos/new`, `/mis-disenos` to `/login?next=...` for anonymous users** | Currently these routes render the page shell + `"Cargando proyectos…"` to anyone — bad SEO, weird flash, and bots index authenticated-looking surfaces. Use Next.js middleware or a server-component auth check. (S1) | 1 h — middleware + `redirect()` in route layouts |
| 3 | **Sync the doc-comments and any marketing copy to "24 calculadores detallados"** (or whatever the true count is on launch day) | `/studio/page.tsx` says 11 and `/studio/diseno-rapido/page.tsx` says 35. Both wrong. (S3) | 5 min — search & replace |
| 4 | **Make `/codigo` build stamp dynamic** — read `process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` (short) + build date instead of hardcoded `v2.3 · 2026-05-18` | Hardcoded stamps lie after the next deploy. (S4) | 10 min |
| 5 | **Add `/api/health` GET → 200 `{ ok: true, build: ..., now: ... }`** | Vercel health alerting, uptime services, REVARA cross-app sanity check, and your own future canaries all want a free lightweight 200. (S7) | 15 min — single route handler |

### Honorable mentions (next round)
- Add a `<noscript>` fallback to `/login` and `/register` pointing users to enable JS (S2).
- Code-split heavy `/studio/beam` so the 142 KB SSR can stream the per-step diagrams (S8).
- Wire a basic e2e test (Playwright on Vercel Preview) that hits the 14 URLs in section 1 and asserts the H1 of each.

---

## Honest quality assessment

**Functional state**: B+ — every documented authenticated feature (5-screen wizard, dashboard CFIA auditor, joint check, qa_source cascade, saved toast, 2-tab mis-disenos, memoria master PDF) is wired in source and imports look consistent. Live public pages all return 200. Sub-panel auto-mounting in rectangular-column and isolated-footing is implemented carefully (separate state, reuses parent engine values).

**Production readiness**: NEEDS WORK — fixes S1 (auth gate) and S5 (header nav) are blocking-level. A user landing on the homepage cannot find the login button, and authenticated routes serve their HTML to anonymous traffic. Neither is a 500, but both will harm conversion and look unprofessional.

**Design level**: Good — the brand language (zinc + amber + emerald) is consistent across login/register/studio/codigo. The Diseño Rápido headline tile on `/studio` is unambiguously the marquee CTA (emerald gradient, larger card, NUEVO badge, well-written body copy). The build stamp on `/codigo` is a nice touch.

**Source health**: Good — careful inline comments (e.g. the `ref → cite` rename in `/codigo` explicitly references React error #290), purposeful state separation (`Muy_tonm` kept out of `RectColumnInput` to not pollute PDF snapshots), and explicit phase-1 caveats in the memoria builder docstring all suggest someone is reading the diffs and reasoning about consequences.

**Re-test required**: YES after S1+S5 fixes — re-probe `/proyectos` anonymously and re-screenshot `/` header.

---

**Files referenced** (all absolute):
- `D:\Projects\costaplanner-web\src\app\page.tsx` (not re-read this round — landing inferred from live HTML)
- `D:\Projects\costaplanner-web\src\app\login\page.tsx`
- `D:\Projects\costaplanner-web\src\app\register\page.tsx`
- `D:\Projects\costaplanner-web\src\app\studio\page.tsx`
- `D:\Projects\costaplanner-web\src\app\studio\diseno-rapido\page.tsx`
- `D:\Projects\costaplanner-web\src\app\studio\beam\page.tsx`
- `D:\Projects\costaplanner-web\src\app\studio\rectangular-column\page.tsx`
- `D:\Projects\costaplanner-web\src\app\studio\isolated-footing\page.tsx`
- `D:\Projects\costaplanner-web\src\app\studio\geotecnica\spt\page.tsx`
- `D:\Projects\costaplanner-web\src\app\codigo\page.tsx`
- `D:\Projects\costaplanner-web\src\app\proyectos\new\page.tsx`
- `D:\Projects\costaplanner-web\src\app\proyectos\[id]\page.tsx`
- `D:\Projects\costaplanner-web\src\app\proyectos\[id]\memoria\page.tsx`
- `D:\Projects\costaplanner-web\src\app\mis-disenos\page.tsx`
- `D:\Projects\costaplanner-web\src\components\studio\GeotechDiagrams.tsx` (size-checked only: 1,014 lines)
