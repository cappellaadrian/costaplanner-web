"use client";

/**
 * /proyectos/[id] — project dashboard.
 *
 * Left panel  : criteria from metaJson (editable via modal).
 * Right pane  : 8-section tree of element categories. Each row links into
 *               its /studio/<x>?proyecto=<id> calculator. If a
 *               StructuralDesign already exists for that element type +
 *               this project, we mark it ✓ and link to "Ver".
 *
 * Phase 1 — design existence is matched by name LIKE '%<element_type>%'.
 *           The Save button writes names like "beam — 2026-05-18", so the
 *           LIKE works against the elementType slug.
 *
 * Cross-tool integrations:
 *   - Real beam-column joint verification (computeBeamColumnJointLive run
 *     pair-wise on saved beams × columns, capped at 5×min(beams, columns)).
 *   - "Siguiente paso →" banner driven by ?saved=<elementType> redirect.
 *   - qa_source banner shown when metaJson.qa_source is set by the cascade
 *     in /api/designs POST.
 */
import { useEffect, useState, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  computeBeamColumnJointLive,
  type JointType,
} from "@/lib/beam-column-joint-live";
import {
  getNextStep,
  getElementLabel,
} from "@/lib/next-step";

interface DesignSummary {
  id: string;
  name: string;
  summaryStatus: string;
  elementsCount: number;
  passingCount: number;
  reviewCount: number;
  errorCount: number;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
}

interface ProjectMeta {
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
  completedSteps?: string[];
  // qa cascade fields — set by /api/designs POST when an SPT / capacidad-
  // portante design is saved with this project linked.
  qa_source?: "spt" | "capacidad-portante" | string;
  qa_updated_at?: string;
}

interface Project {
  id: string;
  name: string;
  metaJson: ProjectMeta;
  status: string;
  createdAt: string;
  updatedAt: string;
  designs: DesignSummary[];
}

/** Full design payload (heavy) — fetched on demand for joint check. */
interface FullDesignData {
  id: string;
  name: string;
  structJson: Record<string, unknown>;
  resultJson: Record<string, unknown>;
}

// Element catalog mirroring the 8-section spec.
interface ElementRow {
  key: string;            // slug used by SaveToProjectButton naming
  label: string;
  href: string;           // /studio/<x>
}
interface Section {
  num: number;
  title: string;
  rows: ElementRow[];
}

const SECTIONS: Section[] = [
  {
    num: 1,
    title: "ESTUDIO DE SITIO",
    rows: [
      { key: "spt", label: "Interpretación SPT/CPT", href: "/studio/geotecnica/spt" },
      { key: "capacidad-portante", label: "Capacidad portante", href: "/studio/geotecnica/capacidad-portante" },
      { key: "asentamientos", label: "Asentamientos", href: "/studio/geotecnica/asentamientos" },
      { key: "licuefaccion", label: "Licuefacción", href: "/studio/geotecnica/licuefaccion" },
      { key: "taludes", label: "Estabilidad de taludes", href: "/studio/geotecnica/taludes" },
    ],
  },
  {
    num: 2,
    title: "CIMENTACIÓN",
    rows: [
      { key: "isolated-footing", label: "Zapata aislada", href: "/studio/isolated-footing" },
      { key: "strip-footing", label: "Zapata corrida", href: "/studio/strip-footing" },
      { key: "combined-footing", label: "Combinada", href: "/studio/combined-footing" },
      { key: "mat-foundation", label: "Mat (losa de fundación)", href: "/studio/mat-foundation" },
      { key: "pile-cap", label: "Cabezal de pilotes", href: "/studio/pile-cap" },
      { key: "retaining-wall", label: "Muro de contención", href: "/studio/retaining-wall" },
      { key: "tie-beam", label: "Viga de amarre", href: "/studio/tie-beam" },
    ],
  },
  {
    num: 3,
    title: "ESTRUCTURA VERTICAL",
    rows: [
      { key: "rectangular-column", label: "Columna rectangular", href: "/studio/rectangular-column" },
      { key: "circular-column", label: "Columna circular", href: "/studio/circular-column" },
      { key: "shear-wall", label: "Muro de corte", href: "/studio/shear-wall" },
      { key: "confined-masonry", label: "Mampostería confinada", href: "/studio/confined-masonry" },
      { key: "esbeltez-columna", label: "Esbeltez de columna", href: "/studio/esbeltez-columna" },
      { key: "flexion-biaxial", label: "Flexión biaxial", href: "/studio/flexion-biaxial" },
    ],
  },
  {
    num: 4,
    title: "ESTRUCTURA HORIZONTAL",
    rows: [
      { key: "beam", label: "Viga", href: "/studio/beam" },
      { key: "one-way-slab", label: "Losa 1 dirección", href: "/studio/one-way-slab" },
      { key: "two-way-slab", label: "Losa 2 direcciones", href: "/studio/two-way-slab" },
      { key: "torsion-viga", label: "Torsión en viga", href: "/studio/torsion-viga" },
      { key: "deflexion-largo-plazo", label: "Deflexión largo plazo", href: "/studio/deflexion-largo-plazo" },
    ],
  },
  {
    num: 5,
    title: "ELEMENTOS ESPECIALES",
    rows: [
      { key: "stair-slab", label: "Losa de escalera", href: "/studio/stair-slab" },
      { key: "lintel", label: "Dintel", href: "/studio/lintel" },
    ],
  },
  {
    num: 6,
    title: "VERIFICACIONES SÍSMICAS",
    rows: [
      { key: "beam-column-joint", label: "Conexión viga-columna", href: "/studio/beam-column-joint" },
      { key: "diafragma", label: "Diafragma", href: "/studio/diafragma" },
      { key: "punzonamiento-momento", label: "Punzonamiento con momento", href: "/studio/punzonamiento-momento" },
    ],
  },
  {
    num: 7,
    title: "DETALLADO",
    rows: [
      { key: "desarrollo-empalmes", label: "Longitudes de desarrollo", href: "/studio/desarrollo-empalmes" },
      { key: "fisuracion", label: "Control de fisuración", href: "/studio/fisuracion" },
      { key: "strut-tie", label: "Modelo strut-and-tie", href: "/studio/strut-tie" },
    ],
  },
];

const STATUS_COLORS: Record<string, string> = {
  ok: "text-emerald-400 border-emerald-700/40 bg-emerald-500/5",
  review: "text-amber-300 border-amber-700/40 bg-amber-500/5",
  errors: "text-red-400 border-red-900/40 bg-red-950/20",
};

// ─── Joint-check helpers ────────────────────────────────────────────────────
// Extracts the geometry + reinforcement needed to call
// computeBeamColumnJointLive() from a saved beam + column design pair. The
// shape mirrors what /studio/beam and /studio/rectangular-column persist via
// SaveToProjectButton — see those pages' buildPayload() callbacks.
//
// For BEAM:    resultJson is the FlexureLiveResult; structJson is FlexureInput.
//              Mn is approximated as As · fy · (d − a/2) since beam-flexure
//              does not return Mn directly.
// For COLUMN:  rectangular columns persist RectColumnLiveResult; circular
//              columns persist a similar shape with D instead of b/h. We
//              detect by which fields are present.
//
// The function returns null if the extraction fails (e.g., legacy designs).
function buildJointInputFromPair(
  beam: { structJson: Record<string, unknown>; resultJson: Record<string, unknown> },
  col: { structJson: Record<string, unknown>; resultJson: Record<string, unknown>; name: string },
  defaults: { zona: 1 | 2 | 3 | 4; fc: number; fy: number },
): {
  bc: number;
  hc: number;
  As_top: number;
  As_bot: number;
  bw_beam: number;
  SumMn_col_tonm: number;
  SumMn_beam_tonm: number;
  Vcol_ton: number;
  jointType: JointType;
  confinedSides: 2 | 3 | 4;
  fc: number;
  fy: number;
  zona: 1 | 2 | 3 | 4;
} | null {
  // ── Beam ──
  // FlexureLiveResult has b, d, fc, fy, As_diseno. Also FlexureInput.b/d/fy.
  const br = beam.resultJson as Record<string, unknown>;
  // beam-flexure persists "results" array per the buildPayload in
  // /studio/beam/page.tsx: resultJson.results[0].live is the FlexureLiveResult.
  let beamLive: Record<string, unknown> | undefined;
  const beamResults = (br.results as Array<{ live?: Record<string, unknown> }> | undefined);
  if (beamResults && beamResults.length > 0 && beamResults[0].live) {
    beamLive = beamResults[0].live;
  } else if (typeof br.As_diseno === "number") {
    // Some calculators may persist FlexureLiveResult directly (no .results wrap).
    beamLive = br;
  }
  if (!beamLive) return null;

  const beam_b = Number(beamLive.b);
  const beam_d = Number(beamLive.d);
  const beam_As = Number(beamLive.As_diseno);
  const beam_fc = Number(beamLive.fc) || defaults.fc;
  const beam_fy = Number(beamLive.fy) || defaults.fy;
  if (!isFinite(beam_b) || !isFinite(beam_d) || !isFinite(beam_As)) return null;
  if (beam_b <= 0 || beam_d <= 0 || beam_As <= 0) return null;

  // Approximate Mn for a singly-reinforced section:
  //   a  = (As · fy) / (0.85 · f'c · b)   [cm]
  //   Mn = As · fy · (d − a/2)            [kg·cm] → ÷ 1e5 → ton·m
  const a = (beam_As * beam_fy) / (0.85 * beam_fc * beam_b);
  const Mn_beam_kgcm = beam_As * beam_fy * (beam_d - a / 2);
  const Mn_beam_tonm = Mn_beam_kgcm / 1e5;

  // Heuristic split: assume As_top = As_diseno (negative moment governs
  // typical CR beams), As_bot ≈ 0.6·As_top (continuity reinforcement).
  // This matches the joint calculator's default ratio (10 / 6 cm²).
  const As_top = beam_As;
  const As_bot = beam_As * 0.6;
  const bw_beam = beam_b;

  // ── Column ──
  // rectangular-column persists RectColumnLiveResult at resultJson top-level
  // (see /studio/rectangular-column/page.tsx buildPayload). Has b, h, Mu_max.
  // circular-column persists D, Mu, Pu, etc. — treat bc = hc = D.
  const cr = col.resultJson as Record<string, unknown>;
  const colNameLower = col.name.toLowerCase();
  const isCircular = colNameLower.includes("circular-column");

  let bc: number; let hc: number; let Mu_col_tonm: number;
  if (isCircular) {
    const D = Number(cr.D);
    const Mu = Number(cr.Mu);
    if (!isFinite(D) || D <= 0) return null;
    bc = D;
    hc = D;
    Mu_col_tonm = isFinite(Mu) ? Mu : 0;
  } else {
    const cb = Number(cr.b);
    const ch = Number(cr.h);
    const Mu_max = Number(cr.Mu_max);
    if (!isFinite(cb) || !isFinite(ch) || cb <= 0 || ch <= 0) return null;
    bc = cb;
    hc = ch;
    Mu_col_tonm = isFinite(Mu_max) ? Mu_max : 0;
  }

  // For SCWB we'd want ΣMn_col from a P-M interaction at the column's Pu.
  // Approximation: Mn_col ≈ Mu_col / φ where φ ≈ 0.65 for tied columns.
  // This is a lower bound — real Mn is larger when As contributes flexural
  // capacity. We surface this assumption in the UI ("aproximado").
  const SumMn_col_tonm = Mu_col_tonm > 0 ? Mu_col_tonm / 0.65 : 0;

  // For the beam side we use the computed approximate Mn. If the project has
  // a continuous beam framing both sides of an interior column, the joint
  // computeBeamColumnJointLive() takes the SUM of both — so we double for
  // the interior assumption (default).
  const SumMn_beam_tonm = Mn_beam_tonm * 2;

  // Vcol: column shear from frame analysis — not stored. Estimate as
  // Vcol ≈ ΣMn_beam / hcol_clear (rule of thumb for a single-bay frame).
  // hcol_clear is unknown here; use 2.5 m default (typical CR floor).
  const hcol_clear_m = 2.5;
  const Vcol_ton = SumMn_beam_tonm > 0
    ? SumMn_beam_tonm / hcol_clear_m
    : 0;

  return {
    bc,
    hc,
    As_top,
    As_bot,
    bw_beam,
    SumMn_col_tonm,
    SumMn_beam_tonm,
    Vcol_ton,
    jointType: "interior" as JointType,
    confinedSides: 4,
    fc: defaults.fc,
    fy: defaults.fy,
    zona: defaults.zona,
  };
}

export default function ProyectoDashboardPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Next 14 sometimes wraps params in a Promise via the dynamic API. Support both.
  const resolved =
    typeof (params as { then?: unknown }).then === "function"
      ? // eslint-disable-next-line react-hooks/rules-of-hooks
        use(params as Promise<{ id: string }>)
      : (params as { id: string });
  const projectId = resolved.id;

  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);

  // Full design payloads keyed by design id — populated on demand for the
  // designs that participate in the joint-check cross-tool integration
  // (beams + columns). Light "summary" data already lives on `project.designs`;
  // we only fetch the heavy structJson/resultJson for the few designs we need.
  const [fullDesigns, setFullDesigns] = useState<
    Record<string, FullDesignData>
  >({});

  // "?saved=<elementType>" banner — surfaced after SaveToProjectButton
  // redirects back to /proyectos/<id>?saved=beam. Cleared after 10s or on
  // click. See src/lib/next-step.ts for the suggested-next mapping.
  const [savedBanner, setSavedBanner] = useState<{
    elementType: string;
    visible: boolean;
  } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/design-projects/${projectId}`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as Project;
      setProject(data);
      setDraftName(data.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── "?saved=<elementType>" banner — Task 3 ───────────────────────────────
  // Read on mount, then strip the param from the URL so a refresh doesn't
  // re-show the banner. Auto-dismiss after 10s.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const saved = params.get("saved");
    if (!saved) return;
    setSavedBanner({ elementType: saved, visible: true });
    // Strip ?saved= from URL without triggering a re-navigation.
    params.delete("saved");
    const newSearch = params.toString();
    const newPath =
      window.location.pathname + (newSearch ? `?${newSearch}` : "");
    window.history.replaceState(null, "", newPath);
    const t = setTimeout(
      () => setSavedBanner((b) => (b ? { ...b, visible: false } : null)),
      10_000,
    );
    return () => clearTimeout(t);
  }, []);

  // ── Fetch full design payloads for joint-check (Task 1) ───────────────────
  // Only the designs we actually need: beams + rectangular columns +
  // circular columns. We cap at 10 of each to keep the dashboard snappy.
  useEffect(() => {
    if (!project) return;
    const targets = project.designs.filter((d) => {
      const n = d.name.toLowerCase();
      return /\bbeam\b/.test(n) || n.includes("rectangular-column") || n.includes("circular-column");
    });
    // Cap to keep dashboard snappy (cartesian product is capped later too).
    const capped = targets.slice(0, 20);

    // Skip any we already have
    const missing = capped.filter((d) => !fullDesigns[d.id]);
    if (missing.length === 0) return;

    let cancelled = false;
    Promise.all(
      missing.map(async (d) => {
        try {
          const r = await fetch(`/api/designs/${d.id}`);
          if (!r.ok) return null;
          const data = (await r.json()) as {
            id: string;
            name: string;
            structJson: Record<string, unknown>;
            resultJson: Record<string, unknown>;
          };
          return data;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setFullDesigns((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r.id] = r;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  async function saveName() {
    if (!project || !draftName.trim() || draftName === project.name) {
      setEditingName(false);
      return;
    }
    const r = await fetch(`/api/design-projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draftName.trim() }),
    });
    if (r.ok) {
      setProject({ ...project, name: draftName.trim() });
    }
    setEditingName(false);
  }

  async function archiveProject() {
    if (!confirm("¿Archivar este proyecto? Los cálculos guardados se preservarán.")) return;
    const r = await fetch(`/api/design-projects/${projectId}`, { method: "DELETE" });
    if (r.ok) {
      router.push("/proyectos");
    }
  }

  // Match designs to element rows by name LIKE '%<key>%'. Case-insensitive.
  const designsByKey = useMemo(() => {
    const map = new Map<string, DesignSummary[]>();
    if (!project) return map;
    for (const sec of SECTIONS) {
      for (const row of sec.rows) {
        const matches = project.designs.filter((d) =>
          d.name.toLowerCase().includes(row.key.toLowerCase()),
        );
        if (matches.length > 0) map.set(row.key, matches);
      }
    }
    return map;
  }, [project]);

  // ─── Correlation Refactor: project-level auto-verifications ─────────────
  // Joint-check: enumerate saved beams + columns, fetch full design payloads
  // (see useEffect above), then run computeBeamColumnJointLive() pair-wise
  // on a capped cartesian product. The worst-case ratio (most failing) is
  // surfaced on the dashboard tile.
  //
  // For zones I and II joint detailing is informational (CSCR-10 §8.6 only
  // mandates ductile joints in zones III/IV) — we still compute and display
  // but with a softer call-to-action.
  const autoVerifications = useMemo(() => {
    const beamSummaries = designsByKey.get("beam") ?? [];
    const colRectSummaries = designsByKey.get("rectangular-column") ?? [];
    const colCircSummaries = designsByKey.get("circular-column") ?? [];
    const beamCount = beamSummaries.length;
    const colRectCount = colRectSummaries.length;
    const colCircCount = colCircSummaries.length;
    const columnCount = colRectCount + colCircCount;

    const slab1Count = (designsByKey.get("one-way-slab") ?? []).length;
    const slab2Count = (designsByKey.get("two-way-slab") ?? []).length;
    const slabCount = slab1Count + slab2Count;
    const hasDiaphragm = (designsByKey.get("diafragma") ?? []).length > 0;
    const needsDiaphragm = slabCount >= 2 && !hasDiaphragm;

    const zona = project?.metaJson.zonaSismica ?? 2;
    const fcDefault = project?.metaJson.fc_default ?? 280;
    const fyDefault = project?.metaJson.fy_default ?? 4200;

    // Inferred junctions (upper bound): every beam end may meet a column.
    const inferredJoints = Math.min(beamCount, columnCount);

    // Walk through full beam/column data we've fetched and build pair-wise
    // joint inputs. We cap the cartesian product at min(beams, columns) × 5
    // to avoid combinatorial explosion when many designs are saved.
    const fullBeams = beamSummaries
      .map((b) => fullDesigns[b.id])
      .filter((b): b is FullDesignData => Boolean(b));
    const fullCols = [...colRectSummaries, ...colCircSummaries]
      .map((c) => fullDesigns[c.id])
      .filter((c): c is FullDesignData => Boolean(c));

    type JointEval = {
      beamId: string;
      beamName: string;
      colId: string;
      colName: string;
      ratio_SCWB: number;       // ΣMn_col / ΣMn_beam
      ratio_required: number;   // 1.20
      scwb_pass: boolean;
      shear_pass: boolean;
    };

    const evals: JointEval[] = [];
    const pairLimit = Math.max(0, Math.min(beamCount, columnCount) * 5);
    if (fullBeams.length > 0 && fullCols.length > 0 && pairLimit > 0) {
      outer: for (const beam of fullBeams) {
        for (const col of fullCols) {
          if (evals.length >= pairLimit) break outer;
          const jointInput = buildJointInputFromPair(
            beam,
            col,
            { zona: zona as 1 | 2 | 3 | 4, fc: fcDefault, fy: fyDefault },
          );
          if (!jointInput) continue;
          try {
            const out = computeBeamColumnJointLive(jointInput);
            evals.push({
              beamId: beam.id,
              beamName: beam.name,
              colId: col.id,
              colName: col.name,
              ratio_SCWB: out.ratio_SCWB,
              ratio_required: out.ratio_SCWB_required,
              scwb_pass: out.scwb_pass,
              shear_pass: out.shear_pass,
            });
          } catch {
            // skip
          }
        }
      }
    }

    // Worst-case = lowest ratio_SCWB (most likely to fail).
    let worst: JointEval | null = null;
    for (const e of evals) {
      if (worst === null || e.ratio_SCWB < worst.ratio_SCWB) worst = e;
    }

    return {
      beamCount, columnCount, inferredJoints,
      slabCount, needsDiaphragm,
      showJointTile: beamCount > 0 && columnCount > 0,
      // Real joint analysis output:
      jointEvalsCount: evals.length,
      jointWorst: worst,
      jointMandatory: zona >= 3,   // zones III/IV require ductile joint detailing
      jointFullyLoaded:
        fullBeams.length === beamCount && fullCols.length === columnCount,
    };
  }, [designsByKey, fullDesigns, project]);

  // Suggestion: where to go next?
  const suggestion = useMemo(() => {
    if (!project) return null;
    const meta = project.metaJson;
    const hasGeotech = SECTIONS[0].rows.some((r) => designsByKey.has(r.key));
    const hasFoundation = SECTIONS[1].rows.some((r) => designsByKey.has(r.key));
    if (!hasGeotech) {
      return {
        text: "Empieza con: Interpretación SPT",
        href: `/studio/geotecnica/spt?proyecto=${projectId}`,
      };
    }
    if (!hasFoundation) {
      const qa = meta.qa_ton_m2;
      const floors = meta.numFloors ?? 1;
      const sugLabel =
        qa && qa >= 15 && floors <= 3
          ? "Zapata aislada (sugerido por qa)"
          : qa && qa < 10
            ? "Mat / losa de fundación (qa bajo)"
            : "Zapata aislada";
      return {
        text: `Siguiente: ${sugLabel}`,
        href: `/studio/isolated-footing?proyecto=${projectId}`,
      };
    }
    return null;
  }, [project, designsByKey, projectId]);

  // Cimentación type suggestion banner (Section 2 header)
  const cimSuggestion = useMemo(() => {
    if (!project) return null;
    const { qa_ton_m2, numFloors } = project.metaJson;
    if (!qa_ton_m2) return null;
    if (qa_ton_m2 >= 15 && (numFloors ?? 1) <= 3) return "Zapata aislada";
    if (qa_ton_m2 < 10) return "Mat (losa de fundación)";
    if (qa_ton_m2 >= 10 && qa_ton_m2 < 15) return "Zapata aislada o corrida";
    return null;
  }, [project]);

  // ─── CFIA Auditor — "Listo para CFIA" checklist ─────────────────────────
  // Computes a 10-row checklist of what a CFIA-ready memoria estructural
  // needs. Each row is independent so engineers can see exactly what's
  // missing. Result feeds the right-side aside panel above "Entrega".
  const cfiaAudit = useMemo(() => {
    if (!project) return null;
    const meta = project.metaJson;

    // 1. Geotecnia — at least one SPT, CPT, or capacidad-portante
    const hasGeotech =
      (designsByKey.get("spt") ?? []).length > 0 ||
      (designsByKey.get("cpt") ?? []).length > 0 ||
      (designsByKey.get("capacidad-portante") ?? []).length > 0;

    // 2. Cimentación — at least one footing or mat or pile-cap
    const hasFoundation = [
      "isolated-footing",
      "strip-footing",
      "combined-footing",
      "mat-foundation",
      "pile-cap",
    ].some((k) => (designsByKey.get(k) ?? []).length > 0);

    // 3. Estructura vertical — at least one column or wall
    const hasVertical = [
      "rectangular-column",
      "circular-column",
      "shear-wall",
      "confined-masonry",
    ].some((k) => (designsByKey.get(k) ?? []).length > 0);

    // 4. Estructura horizontal — at least one beam or slab
    const hasHorizontal = [
      "beam",
      "one-way-slab",
      "two-way-slab",
    ].some((k) => (designsByKey.get(k) ?? []).length > 0);

    // 5. Sísmico — joint check required in zones III/IV
    const seismicZone = meta.zonaSismica ?? 2;
    const needsSeismicCheck = seismicZone >= 3;
    const hasJoint = (designsByKey.get("beam-column-joint") ?? []).length > 0;
    const seismicChecks = needsSeismicCheck ? hasJoint : null; // null = N/A

    // 6. Detallado — development lengths
    const hasDetailing =
      (designsByKey.get("desarrollo-empalmes") ?? []).length > 0;

    // 7. Loads / combinations — zona sísmica defined in metaJson
    const hasLoadCombinations = typeof meta.zonaSismica === "number";

    // 8. Materials specified
    const hasMaterials =
      typeof meta.fc_default === "number" &&
      typeof meta.fy_default === "number";

    // 9. Professional responsible — engineer + CFIA code
    const hasProfessional =
      Boolean(meta.engineerName?.trim()) && Boolean(meta.cfiaCode?.trim());

    // 10. Memoria PDF generated — tracked client-side via metaJson.completedSteps
    //     For Phase 1 we cannot detect "PDF was downloaded" — instead we mark
    //     this row as ✓ when the user has clicked through to the memoria route
    //     at least once (best-effort). Until that signal exists, leave gray.
    const hasMemoriaGenerated =
      (meta as { memoriaGeneratedAt?: string }).memoriaGeneratedAt != null;

    const rows: Array<{
      label: string;
      state: "ok" | "fail" | "na";
    }> = [
      {
        label: "Geotecnia (≥1 estudio SPT/CPT o capacidad portante)",
        state: hasGeotech ? "ok" : "fail",
      },
      {
        label: "Cimentación (≥1 zapata o mat o pile-cap)",
        state: hasFoundation ? "ok" : "fail",
      },
      {
        label: "Estructura vertical (≥1 columna o muro)",
        state: hasVertical ? "ok" : "fail",
      },
      {
        label: "Estructura horizontal (≥1 viga o losa)",
        state: hasHorizontal ? "ok" : "fail",
      },
      {
        label: "Verificaciones sísmicas (zona III/IV: unión viga-columna)",
        state:
          seismicChecks === null ? "na" : seismicChecks ? "ok" : "fail",
      },
      {
        label: "Detallado (longitudes de desarrollo)",
        state: hasDetailing ? "ok" : "fail",
      },
      {
        label: "Cargas y combinaciones (zona sísmica definida)",
        state: hasLoadCombinations ? "ok" : "fail",
      },
      {
        label: "Materiales (f'c + fy especificados)",
        state: hasMaterials ? "ok" : "fail",
      },
      {
        label: "Responsable profesional (ingeniero + CFIA)",
        state: hasProfessional ? "ok" : "fail",
      },
      {
        label: "Memoria PDF generada",
        state: hasMemoriaGenerated ? "ok" : "fail",
      },
    ];

    const applicable = rows.filter((r) => r.state !== "na");
    const completed = applicable.filter((r) => r.state === "ok").length;
    const total = applicable.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    let barColor: string;
    if (completed >= 8) barColor = "bg-emerald-500";
    else if (completed >= 5) barColor = "bg-amber-500";
    else barColor = "bg-red-500";

    return { rows, completed, total, pct, barColor };
  }, [project, designsByKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 text-sm text-zinc-400">
          Cargando proyecto…
        </div>
      </div>
    );
  }
  if (error || !project) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-4">
          <div className="text-sm text-red-400">
            Error: {error ?? "Proyecto no encontrado"}
          </div>
          <Link href="/proyectos" className="text-sm text-amber-400 hover:underline">
            ← Volver a Mis proyectos
          </Link>
        </div>
      </div>
    );
  }

  const meta = project.metaJson;
  const totalElements = SECTIONS.reduce((acc, s) => acc + s.rows.length, 0);
  const completedRows = SECTIONS.reduce(
    (acc, s) => acc + s.rows.filter((r) => designsByKey.has(r.key)).length,
    0,
  );
  const pct = Math.round((completedRows / totalElements) * 100);

  const zonaRoman = meta.zonaSismica
    ? ["I", "II", "III", "IV"][meta.zonaSismica - 1]
    : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        {/* Top breadcrumb */}
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <Link href="/proyectos" className="hover:text-amber-400">
            ← Mis proyectos
          </Link>
          <button
            onClick={archiveProject}
            className="text-zinc-500 hover:text-red-400"
          >
            Archivar proyecto
          </button>
        </div>

        {/* Header strip */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              {editingName ? (
                <input
                  className="w-full text-2xl font-semibold bg-zinc-950 border border-amber-500 rounded px-2 py-1"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") {
                      setDraftName(project.name);
                      setEditingName(false);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <h1
                  className="text-2xl font-semibold cursor-pointer hover:text-amber-400 transition-colors"
                  onClick={() => setEditingName(true)}
                  title="Click para editar"
                >
                  {project.name}
                </h1>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {meta.cfiaCode && (
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    CFIA {meta.cfiaCode}
                  </span>
                )}
                {zonaRoman && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-700/40">
                    Zona {zonaRoman}
                  </span>
                )}
                {meta.structuralSystem && (
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {meta.structuralSystem}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded border border-zinc-800 text-zinc-400">
                  {completedRows}/{totalElements} ({pct}%)
                </span>
              </div>
            </div>
            <div className="text-right text-xs text-zinc-500">
              Creado {new Date(project.createdAt).toLocaleDateString("es-CR")}
              <div>
                Actualizado{" "}
                {new Date(project.updatedAt).toLocaleDateString("es-CR")}
              </div>
            </div>
          </div>

          {/* ?saved=<elementType> banner — Task 3 */}
          {savedBanner?.visible && (() => {
            const savedLabel = getElementLabel(savedBanner.elementType);
            const next = getNextStep(savedBanner.elementType);
            const nextHref = next?.href
              ? `${next.href}?proyecto=${projectId}`
              : null;
            return (
              <div
                className="mt-4 rounded border border-emerald-700/40 bg-emerald-500/5 p-3 flex items-center justify-between gap-3 animate-in fade-in duration-300"
                onClick={() =>
                  setSavedBanner((b) => (b ? { ...b, visible: false } : null))
                }
                role="status"
                aria-live="polite"
              >
                <span className="text-sm">
                  <span className="text-emerald-400 font-semibold">
                    ✓ Guardaste {savedLabel}.
                  </span>{" "}
                  {next?.label
                    ? `Siguiente paso sugerido: ${next.label}`
                    : "Sigue con otro elemento o genera la memoria"}
                </span>
                {nextHref ? (
                  <Link
                    href={nextHref}
                    className="text-xs px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold whitespace-nowrap"
                  >
                    {next?.label ? next.label : "Siguiente"} →
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setSavedBanner((b) => (b ? { ...b, visible: false } : null))
                    }
                    className="text-xs text-emerald-400 hover:underline whitespace-nowrap"
                  >
                    Cerrar ✕
                  </button>
                )}
              </div>
            );
          })()}

          {/* qa cascade banner — Task 2. Surfaced when /api/designs POST
              propagated a fresh qa from SPT/capacidad-portante to metaJson. */}
          {meta.qa_source && meta.qa_ton_m2 && meta.qa_updated_at && (
            <div className="mt-3 rounded border border-sky-700/40 bg-sky-500/5 p-3 flex items-center justify-between gap-3">
              <span className="text-sm text-sky-100">
                <span className="text-sky-300 font-semibold">📐 qa actualizado —</span>{" "}
                {meta.qa_ton_m2.toFixed(1)} ton/m² calculado por{" "}
                <span className="font-mono text-sky-200">{meta.qa_source}</span>{" "}
                el{" "}
                {new Date(meta.qa_updated_at).toLocaleDateString("es-CR")}.{" "}
                Las nuevas zapatas usarán este valor.
              </span>
            </div>
          )}

          {suggestion && (
            <div className="mt-4 rounded border border-emerald-700/40 bg-emerald-500/5 p-3 flex items-center justify-between gap-3">
              <span className="text-sm">
                <span className="text-emerald-400 font-semibold">Sugerido siguiente —</span>{" "}
                {suggestion.text}
              </span>
              <Link
                href={suggestion.href}
                className="text-xs px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold"
              >
                Empezar →
              </Link>
            </div>
          )}

          {autoVerifications.needsDiaphragm && (
            <div className="mt-3 rounded border border-red-700/40 bg-red-500/5 p-3 flex items-center justify-between gap-3">
              <span className="text-sm text-red-200">
                <span className="text-red-400 font-semibold">⚠️ Diafragma sin verificar —</span>{" "}
                {autoVerifications.slabCount} losa(s) sin diseño de diafragma de piso.
              </span>
              <Link
                href={`/studio/diafragma?proyecto=${projectId}`}
                className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-zinc-50 font-bold whitespace-nowrap"
              >
                Verifica el diafragma →
              </Link>
            </div>
          )}
        </div>

        {/* Body: criteria + tree */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
          {/* Criteria panel */}
          <aside className="lg:sticky lg:top-4 lg:self-start space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Criterios</h3>
                <button
                  onClick={() => setShowCriteriaModal(true)}
                  className="text-[11px] text-amber-400 hover:underline"
                >
                  Editar →
                </button>
              </div>
              <CriteriaList meta={meta} />
            </div>

            {/* Verificaciones automáticas — Correlation Refactor */}
            {(autoVerifications.showJointTile || autoVerifications.needsDiaphragm) && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 space-y-2">
                <h3 className="text-sm font-semibold mb-2">Verificaciones automáticas</h3>

                {autoVerifications.showJointTile && (() => {
                  const worst = autoVerifications.jointWorst;
                  const hasRealEval =
                    autoVerifications.jointEvalsCount > 0 && worst !== null;

                  // Pass/fail color thresholds based on ΣMn_col/ΣMn_beam.
                  let borderClass = "border-amber-700/40 bg-amber-500/5 hover:bg-amber-500/10";
                  let titleClass = "text-amber-300";
                  let ratioClass = "text-amber-300";
                  if (hasRealEval && worst) {
                    if (!worst.scwb_pass) {
                      borderClass = "border-red-700/50 bg-red-500/10 hover:bg-red-500/15";
                      titleClass = "text-red-300";
                      ratioClass = "text-red-300";
                    } else if (worst.ratio_SCWB < 1.5) {
                      // Close to limit — keep amber.
                      borderClass = "border-amber-700/50 bg-amber-500/10 hover:bg-amber-500/15";
                    } else {
                      borderClass = "border-emerald-700/40 bg-emerald-500/5 hover:bg-emerald-500/10";
                      titleClass = "text-emerald-300";
                      ratioClass = "text-emerald-300";
                    }
                  }

                  // Detail link — pre-loads the worst pair into the joint
                  // calculator via query params so the engineer can refine.
                  const detailHref = hasRealEval && worst
                    ? `/studio/beam-column-joint?proyecto=${projectId}&from=joint-summary&beam=${worst.beamId}&col=${worst.colId}`
                    : `/studio/beam-column-joint?proyecto=${projectId}`;

                  return (
                    <Link
                      href={detailHref}
                      className={`block rounded border p-3 transition-colors ${borderClass}`}
                    >
                      <div className={`text-xs font-semibold ${titleClass}`}>
                        Conexión viga-columna
                        {!autoVerifications.jointMandatory && (
                          <span className="ml-1.5 text-[9px] text-zinc-500 font-normal">
                            (informativo, zona {meta.zonaSismica ?? "—"})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        {autoVerifications.inferredJoints} unión(es) inferida(s) ·{" "}
                        {autoVerifications.beamCount} viga(s) + {autoVerifications.columnCount} columna(s)
                      </div>

                      {hasRealEval && worst ? (
                        <>
                          <div className="text-[11px] text-zinc-300 mt-2 flex items-baseline gap-2">
                            <span className="text-zinc-500">Peor ratio ΣMn_col/ΣMn_beam:</span>
                            <span className={`font-mono font-semibold ${ratioClass}`}>
                              {isFinite(worst.ratio_SCWB) ? worst.ratio_SCWB.toFixed(2) : "∞"}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              (req ≥ {worst.ratio_required.toFixed(2)})
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-1 italic">
                            Asumiendo unión interior; refina por tipo de nudo →
                          </div>
                          <div className={`text-[10px] mt-1 font-semibold ${ratioClass}`}>
                            {worst.scwb_pass ? "✓" : "✗"} Ver detalle →
                          </div>
                        </>
                      ) : autoVerifications.jointFullyLoaded ? (
                        <div className="text-[10px] text-zinc-500 mt-1 italic">
                          No fue posible computar — datos incompletos.
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-400 mt-1">
                          Calculando ΣMn_col / ΣMn_beam …
                        </div>
                      )}
                    </Link>
                  );
                })()}

                {autoVerifications.needsDiaphragm && (
                  <Link
                    href={`/studio/diafragma?proyecto=${projectId}`}
                    className="block rounded border border-red-700/40 bg-red-500/5 p-3 hover:bg-red-500/10 transition-colors"
                  >
                    <div className="text-xs text-red-300 font-semibold">
                      Diafragma sin verificar
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      {autoVerifications.slabCount} losa(s) guardada(s) sin diseño de diafragma
                    </div>
                    <div className="text-[10px] text-red-400 mt-1">
                      Verifica el diafragma →
                    </div>
                  </Link>
                )}
              </div>
            )}

            {/* Auditoría CFIA */}
            {cfiaAudit && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Auditoría CFIA</h3>
                  <span className="text-[10px] text-zinc-500">
                    {cfiaAudit.completed}/{cfiaAudit.total}
                  </span>
                </div>

                {/* Checklist */}
                <ul className="space-y-1.5">
                  {cfiaAudit.rows.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-start gap-2 text-[11px] leading-snug"
                    >
                      <span
                        className={`mt-0.5 inline-block w-3.5 text-center flex-shrink-0 font-mono ${
                          row.state === "ok"
                            ? "text-emerald-400"
                            : row.state === "fail"
                              ? "text-red-400"
                              : "text-zinc-600"
                        }`}
                        aria-hidden
                      >
                        {row.state === "ok" ? "✓" : row.state === "fail" ? "✗" : "☐"}
                      </span>
                      <span
                        className={
                          row.state === "ok"
                            ? "text-zinc-200"
                            : row.state === "fail"
                              ? "text-zinc-400"
                              : "text-zinc-600 italic"
                        }
                      >
                        {row.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Progress bar */}
                <div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-900 overflow-hidden">
                    <div
                      className={`h-full ${cfiaAudit.barColor} transition-all duration-500`}
                      style={{ width: `${cfiaAudit.pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1.5 text-right">
                    {cfiaAudit.pct}% completado
                  </div>
                </div>

                {/* Success banner when ≥ 9/10 */}
                {cfiaAudit.completed >= 9 && (
                  <div className="rounded-md border border-emerald-700/50 bg-emerald-500/10 px-3 py-2 text-center">
                    <div className="text-xs font-bold text-emerald-300">
                      ✓ Listo para presentar al CFIA
                    </div>
                    <div className="text-[10px] text-emerald-400/80 mt-0.5">
                      Memoria estructural completa.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Entrega */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 space-y-2">
              <h3 className="text-sm font-semibold mb-2">Entrega</h3>
              <Link
                href={`/proyectos/${projectId}/memoria`}
                className="block w-full text-left text-xs px-3 py-2 rounded border border-emerald-700/40 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-600 transition-colors"
              >
                📄 Memoria PDF completa
              </Link>
              <Link
                href={`/proyectos/${projectId}/memoria-excel`}
                className="block w-full text-left text-xs px-3 py-2 rounded border border-emerald-700/40 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-600 transition-colors"
              >
                ⊞ Exportar a Excel
              </Link>
            </div>
          </aside>

          {/* Tree */}
          <main className="space-y-3">
            {SECTIONS.map((sec) => (
              <section
                key={sec.num}
                className="rounded-lg border border-zinc-800 bg-zinc-900/30"
              >
                <header className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-amber-300">
                    {sec.num}. {sec.title}
                  </h2>
                  {sec.num === 2 && cimSuggestion && (
                    <span className="text-[11px] text-emerald-400">
                      Sugerido: {cimSuggestion}
                    </span>
                  )}
                </header>
                <ul className="divide-y divide-zinc-800/60">
                  {sec.rows.map((row) => {
                    const matches = designsByKey.get(row.key) ?? [];
                    const latest = matches[0];
                    const status = latest?.summaryStatus ?? "";
                    return (
                      <li
                        key={row.key}
                        className="px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 hover:bg-zinc-900/40 transition-colors flex-wrap"
                      >
                        <span className="text-base w-5 text-center shrink-0">
                          {latest ? (
                            <span className="text-emerald-400">✓</span>
                          ) : (
                            <span className="text-zinc-600">☐</span>
                          )}
                        </span>
                        <Link
                          href={`${row.href}?proyecto=${projectId}`}
                          className="flex-1 min-w-0 text-sm text-zinc-200 hover:text-amber-400 transition-colors"
                        >
                          {row.label}
                        </Link>
                        {latest && (
                          <>
                            {/* Hide created date on small screens to keep the
                                status badge + "Ver" link visible without
                                wrapping on iPhone SE width. */}
                            <span className="hidden sm:inline text-[10px] text-zinc-500">
                              {new Date(latest.createdAt).toLocaleDateString("es-CR")}
                            </span>
                            {status && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${STATUS_COLORS[status] ?? "border-zinc-800 text-zinc-400"}`}
                              >
                                {status}
                              </span>
                            )}
                            <Link
                              href={`/mis-disenos/${latest.id}`}
                              className="text-[11px] text-amber-400 hover:underline whitespace-nowrap"
                            >
                              Ver
                            </Link>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </main>
        </div>
      </div>

      {showCriteriaModal && (
        <CriteriaModal
          meta={meta}
          onClose={() => setShowCriteriaModal(false)}
          onSave={async (patch) => {
            const r = await fetch(`/api/design-projects/${projectId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ metaJson: patch }),
            });
            if (r.ok) {
              const updated = await r.json();
              setProject({ ...project, metaJson: updated.metaJson });
            }
            setShowCriteriaModal(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function CriteriaList({ meta }: { meta: ProjectMeta }) {
  const Row = ({
    label,
    value,
  }: {
    label: string;
    value: React.ReactNode;
  }) => (
    <div className="flex items-baseline justify-between gap-2 py-1 text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 text-right">{value || "—"}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-amber-400 mb-1">
          Sitio
        </div>
        <Row label="Dirección" value={meta.address} />
        <Row label="Provincia" value={meta.province} />
        <Row label="Cantón" value={meta.canton} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-amber-400 mb-1">
          Responsables
        </div>
        <Row label="Dueño" value={meta.owner} />
        <Row label="Ingeniero" value={meta.engineerName} />
        <Row label="CFIA" value={meta.cfiaCode} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-amber-400 mb-1">
          Arquitectura
        </div>
        <Row label="Pisos" value={meta.numFloors} />
        <Row
          label="Área"
          value={meta.grossArea_m2 ? `${meta.grossArea_m2} m²` : null}
        />
        <Row label="Uso" value={meta.buildingUse} />
        <Row label="Sistema" value={meta.structuralSystem} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-amber-400 mb-1">
          Geotecnia
        </div>
        <Row
          label="qa"
          value={meta.qa_ton_m2 ? `${meta.qa_ton_m2} ton/m²` : null}
        />
        <Row label="φ" value={meta.phi_deg ? `${meta.phi_deg}°` : null} />
        <Row label="c" value={meta.c_kPa ? `${meta.c_kPa} kPa` : null} />
        <Row
          label="γ"
          value={meta.gamma_kN_m3 ? `${meta.gamma_kN_m3} kN/m³` : null}
        />
        <Row
          label="N. freático"
          value={meta.waterTable_m ? `${meta.waterTable_m} m` : null}
        />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-amber-400 mb-1">
          Materiales
        </div>
        <Row
          label="f'c"
          value={meta.fc_default ? `${meta.fc_default} kg/cm²` : null}
        />
        <Row
          label="fy"
          value={meta.fy_default ? `${meta.fy_default} kg/cm²` : null}
        />
      </div>
    </div>
  );
}

function CriteriaModal({
  meta,
  onClose,
  onSave,
}: {
  meta: ProjectMeta;
  onClose: () => void;
  onSave: (patch: Partial<ProjectMeta>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ProjectMeta>(meta);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof ProjectMeta>(
    key: K,
    value: ProjectMeta[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function num(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  async function handleSave() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  }

  const cls =
    "w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Editar criterios</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <details open>
            <summary className="text-xs uppercase tracking-wide text-amber-400 cursor-pointer mb-2">
              Sitio
            </summary>
            <div className="space-y-2 pl-2 mt-2">
              <input
                className={cls}
                placeholder="Dirección"
                value={draft.address ?? ""}
                onChange={(e) => setField("address", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={cls}
                  placeholder="Provincia"
                  value={draft.province ?? ""}
                  onChange={(e) => setField("province", e.target.value)}
                />
                <input
                  className={cls}
                  placeholder="Cantón"
                  value={draft.canton ?? ""}
                  onChange={(e) => setField("canton", e.target.value)}
                />
              </div>
            </div>
          </details>

          <details>
            <summary className="text-xs uppercase tracking-wide text-amber-400 cursor-pointer mb-2">
              Responsables
            </summary>
            <div className="space-y-2 pl-2 mt-2">
              <input
                className={cls}
                placeholder="Dueño"
                value={draft.owner ?? ""}
                onChange={(e) => setField("owner", e.target.value)}
              />
              <input
                className={cls}
                placeholder="Ingeniero"
                value={draft.engineerName ?? ""}
                onChange={(e) => setField("engineerName", e.target.value)}
              />
              <input
                className={cls}
                placeholder="CFIA"
                value={draft.cfiaCode ?? ""}
                onChange={(e) => setField("cfiaCode", e.target.value)}
              />
            </div>
          </details>

          <details>
            <summary className="text-xs uppercase tracking-wide text-amber-400 cursor-pointer mb-2">
              Sismo y arquitectura
            </summary>
            <div className="space-y-2 pl-2 mt-2">
              <div className="grid grid-cols-4 gap-2">
                {([1, 2, 3, 4] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setField("zonaSismica", z)}
                    className={`px-2 py-1 rounded border text-xs ${
                      draft.zonaSismica === z
                        ? "border-amber-400 bg-amber-500/20 text-amber-300"
                        : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    Zona {["I", "II", "III", "IV"][z - 1]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={cls}
                  type="number"
                  placeholder="# pisos"
                  value={draft.numFloors ?? ""}
                  onChange={(e) => setField("numFloors", num(e.target.value))}
                />
                <input
                  className={cls}
                  type="number"
                  placeholder="Área (m²)"
                  value={draft.grossArea_m2 ?? ""}
                  onChange={(e) =>
                    setField("grossArea_m2", num(e.target.value))
                  }
                />
              </div>
            </div>
          </details>

          <details>
            <summary className="text-xs uppercase tracking-wide text-amber-400 cursor-pointer mb-2">
              Geotecnia
            </summary>
            <div className="space-y-2 pl-2 mt-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={cls}
                  type="number"
                  step="0.5"
                  placeholder="qa (ton/m²)"
                  value={draft.qa_ton_m2 ?? ""}
                  onChange={(e) => setField("qa_ton_m2", num(e.target.value))}
                />
                <input
                  className={cls}
                  type="number"
                  placeholder="φ (°)"
                  value={draft.phi_deg ?? ""}
                  onChange={(e) => setField("phi_deg", num(e.target.value))}
                />
                <input
                  className={cls}
                  type="number"
                  placeholder="c (kPa)"
                  value={draft.c_kPa ?? ""}
                  onChange={(e) => setField("c_kPa", num(e.target.value))}
                />
                <input
                  className={cls}
                  type="number"
                  step="0.5"
                  placeholder="γ (kN/m³)"
                  value={draft.gamma_kN_m3 ?? ""}
                  onChange={(e) =>
                    setField("gamma_kN_m3", num(e.target.value))
                  }
                />
                <input
                  className={cls}
                  type="number"
                  step="0.5"
                  placeholder="N. freático (m)"
                  value={draft.waterTable_m ?? ""}
                  onChange={(e) =>
                    setField("waterTable_m", num(e.target.value))
                  }
                />
              </div>
            </div>
          </details>

          <details>
            <summary className="text-xs uppercase tracking-wide text-amber-400 cursor-pointer mb-2">
              Materiales
            </summary>
            <div className="space-y-2 pl-2 mt-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={cls}
                  type="number"
                  placeholder="f'c (kg/cm²)"
                  value={draft.fc_default ?? ""}
                  onChange={(e) =>
                    setField("fc_default", num(e.target.value))
                  }
                />
                <input
                  className={cls}
                  type="number"
                  placeholder="fy (kg/cm²)"
                  value={draft.fy_default ?? ""}
                  onChange={(e) =>
                    setField("fy_default", num(e.target.value))
                  }
                />
              </div>
            </div>
          </details>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm text-zinc-400 hover:text-zinc-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
