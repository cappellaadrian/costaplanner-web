/**
 * /api/designs
 *
 * POST — save a StructuralDesign for the current user. Either designProjectId
 *        (Costaplanner-side container) or projectId (direct REVARA Project)
 *        may be provided; both are optional.
 * GET  — list current user's designs, optionally filtered by designProjectId
 *        or projectId.
 *
 * Auth required.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";

interface SaveBody {
  name?: string;
  designProjectId?: string;
  projectId?: string; // optional REVARA Project id
  archJson: Record<string, unknown>;
  structJson: Record<string, unknown>;
  resultJson: Record<string, unknown>;
}

function deriveStatus(summary: {
  total_elements?: number;
  passing?: number;
  requires_review?: number;
  with_errors?: number;
}): "ok" | "review" | "errors" {
  if ((summary.with_errors ?? 0) > 0) return "errors";
  if ((summary.requires_review ?? 0) > 0) return "review";
  return "ok";
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const userId = (auth.user as { id: string }).id;

  const designProjectId = req.nextUrl.searchParams.get("designProjectId");
  const projectId = req.nextUrl.searchParams.get("projectId");

  const where: Record<string, string> = { createdBy: userId };
  if (designProjectId) where.designProjectId = designProjectId;
  if (projectId) where.projectId = projectId;

  const designs = await db.structuralDesign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      designProjectId: true,
      projectId: true,
      designProject: { select: { id: true, name: true, revaraProjectId: true } },
      project: { select: { id: true, name: true } },
      summaryStatus: true,
      elementsCount: true,
      passingCount: true,
      reviewCount: true,
      errorCount: true,
      revisionNumber: true,
      createdAt: true,
    },
    take: 100,
  });
  return NextResponse.json({ designs });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const userId = (auth.user as { id: string }).id;

  let body: SaveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido. Se esperaba JSON." },
      { status: 400 },
    );
  }

  if (!body.archJson || !body.structJson || !body.resultJson) {
    return NextResponse.json(
      { error: "Faltan campos: archJson, structJson, resultJson son requeridos." },
      { status: 400 },
    );
  }

  // If designProjectId provided, validate the user owns it.
  if (body.designProjectId) {
    const dp = await db.designProject.findUnique({
      where: { id: body.designProjectId },
      select: { createdBy: true, name: true },
    });
    if (!dp || dp.createdBy !== userId) {
      return NextResponse.json(
        { error: "DesignProject no encontrado o sin acceso." },
        { status: 404 },
      );
    }
  }

  // If projectId provided, validate it exists (cross-app — REVARA Project).
  if (body.projectId) {
    const p = await db.project.findUnique({
      where: { id: body.projectId },
      select: { id: true },
    });
    if (!p) {
      return NextResponse.json(
        { error: "Project (REVARA) no encontrado." },
        { status: 404 },
      );
    }
  }

  const summary =
    (body.resultJson as { summary?: Record<string, number> }).summary ?? {};
  const total = Number(summary.total_elements ?? 0);
  const passing = Number(summary.passing ?? 0);
  const review = Number(summary.requires_review ?? 0);
  const errors = Number(summary.with_errors ?? 0);

  const projectName =
    (body.resultJson as { project?: { name?: string } }).project?.name ??
    "Diseño";
  const defaultName = `${projectName} — ${new Date().toISOString().slice(0, 10)}`;

  const design = await db.structuralDesign.create({
    data: {
      createdBy: userId,
      name: body.name?.trim() || defaultName,
      designProjectId: body.designProjectId ?? null,
      projectId: body.projectId ?? null,
      archJson: body.archJson as never,
      structJson: body.structJson as never,
      resultJson: body.resultJson as never,
      summaryStatus: deriveStatus({
        total_elements: total,
        passing,
        requires_review: review,
        with_errors: errors,
      }),
      elementsCount: total,
      passingCount: passing,
      reviewCount: review,
      errorCount: errors,
    },
    select: { id: true, name: true, summaryStatus: true, createdAt: true },
  });

  // ── qa cascade — SPT/CPT/capacidad-portante → DesignProject.metaJson ──
  // When a geotechnical design is saved with a project linked, propagate the
  // computed bearing capacity (and any other geotech defaults) up to the
  // project's metaJson so that subsequent /studio/<x>?proyecto=<id> calculator
  // pages pre-fill with the freshly-computed values instead of the original
  // wizard inputs (which are often "best guess").
  //
  // Best-effort: any failure here is logged but does NOT fail the design
  // save. The design itself is already persisted above.
  if (body.designProjectId) {
    try {
      await cascadeGeotechToProject(
        body.designProjectId,
        body.name?.trim() || defaultName,
        body.resultJson,
        body.structJson,
      );
    } catch (err) {
      // Logging only — don't break the response.
      console.error("[designs.POST] qa cascade failed:", err);
    }
  }

  return NextResponse.json(design, { status: 201 });
}

/**
 * Best-effort: extract geotech defaults (qa, φ, c, γ, water table) from a
 * just-saved SPT / CPT / capacidad-portante design and merge them into the
 * project's metaJson. Idempotent — overwrites only when the source design
 * actually produced a value > 0.
 *
 * Recognized name patterns: anything containing "spt", "cpt", or
 * "capacidad-portante" (case-insensitive).
 *
 * Field map (per source):
 *   spt              → result.qa_avg_kPa       → qa_ton_m2 (÷ 9.807)
 *                      result.phi_avg_deg      → phi_deg
 *                      input.water_table_m     → waterTable_m
 *   cpt              → result.phi_avg_deg      → phi_deg
 *                      result.su_avg_kPa       → c_kPa
 *   capacidad-port.  → result.qa_recomendado_kPa → qa_ton_m2 (÷ 9.807)
 *                      input.gamma_kN_m3       → gamma_kN_m3
 *                      input.phi_deg           → phi_deg
 *                      input.c_kPa             → c_kPa
 *                      input.water_table_m     → waterTable_m
 *
 * Also sets qa_source ("spt" | "capacidad-portante") and qa_updated_at
 * (ISO timestamp) so the dashboard can surface a "qa actualizado por X"
 * banner.
 */
async function cascadeGeotechToProject(
  designProjectId: string,
  designName: string,
  resultJson: Record<string, unknown>,
  structJson: Record<string, unknown>,
): Promise<void> {
  const nameLower = designName.toLowerCase();
  const isSPT = /spt/.test(nameLower);
  const isCPT = /\bcpt\b/.test(nameLower);
  const isBearing = /capacidad-portante/.test(nameLower);

  if (!isSPT && !isCPT && !isBearing) return;

  const r = resultJson as Record<string, unknown>;
  const s = structJson as Record<string, unknown>;

  // The patch we'll merge into metaJson. Only set keys we actually derive.
  const patch: Record<string, number | string> = {};

  // qa: SPT returns qa_avg_kPa; capacidad-portante returns qa_recomendado_kPa.
  // CPT does NOT return a qa directly (it returns φ / su layers only).
  const kPa_to_ton_m2 = 1 / 9.807; // 1 ton/m² ≈ 9.807 kPa
  let qa_kPa: number | undefined;
  let qa_source: string | undefined;
  if (isSPT && typeof r.qa_avg_kPa === "number" && r.qa_avg_kPa > 0) {
    qa_kPa = r.qa_avg_kPa as number;
    qa_source = "spt";
  } else if (
    isBearing &&
    typeof r.qa_recomendado_kPa === "number" &&
    r.qa_recomendado_kPa > 0
  ) {
    qa_kPa = r.qa_recomendado_kPa as number;
    qa_source = "capacidad-portante";
  }
  if (qa_kPa !== undefined) {
    // Round to 1 decimal so the dashboard renders cleanly.
    patch.qa_ton_m2 = Math.round(qa_kPa * kPa_to_ton_m2 * 10) / 10;
    if (qa_source) patch.qa_source = qa_source;
    patch.qa_updated_at = new Date().toISOString();
  }

  // φ (friction angle). SPT + CPT both produce phi_avg_deg.
  if (
    (isSPT || isCPT) &&
    typeof r.phi_avg_deg === "number" &&
    r.phi_avg_deg > 0
  ) {
    patch.phi_deg = Math.round(r.phi_avg_deg as number);
  }

  // c (cohesion). CPT returns su_avg_kPa explicitly. SPT result type doesn't
  // currently expose a layer-averaged cu, so we skip SPT here — only CPT
  // contributes cohesion to metaJson.
  if (isCPT && typeof r.su_avg_kPa === "number" && r.su_avg_kPa > 0) {
    patch.c_kPa = Math.round((r.su_avg_kPa as number) * 10) / 10;
  }

  // γ, φ, c, water table — capacidad-portante carries these as INPUTS
  // (structJson is the BearingInput). Reflect them into project metaJson so
  // subsequent calculators see the same values the engineer just used.
  if (isBearing) {
    if (typeof s.gamma_kN_m3 === "number" && s.gamma_kN_m3 > 0) {
      patch.gamma_kN_m3 = Math.round((s.gamma_kN_m3 as number) * 10) / 10;
    }
    if (typeof s.phi_deg === "number" && s.phi_deg > 0) {
      patch.phi_deg = Math.round(s.phi_deg as number);
    }
    if (typeof s.c_kPa === "number" && s.c_kPa > 0) {
      patch.c_kPa = Math.round((s.c_kPa as number) * 10) / 10;
    }
    if (
      typeof s.water_table_m === "number" &&
      s.water_table_m >= 0 &&
      s.water_table_m < 99
    ) {
      patch.waterTable_m = Math.round((s.water_table_m as number) * 10) / 10;
    }
  }

  // Water table. SPT input carries water_table_m; the live result spread
  // doesn't include it, so we read it from the saved structJson (input).
  // Treat ≥ 99 as "sin nivel freático" sentinel.
  if (
    isSPT &&
    typeof s.water_table_m === "number" &&
    s.water_table_m >= 0 &&
    s.water_table_m < 99
  ) {
    patch.waterTable_m = Math.round((s.water_table_m as number) * 10) / 10;
  }

  if (Object.keys(patch).length === 0) return;

  const project = await db.designProject.findUnique({
    where: { id: designProjectId },
    select: { metaJson: true },
  });
  if (!project) return;

  const currentMeta = (project.metaJson as Record<string, unknown> | null) ?? {};
  const newMeta = { ...currentMeta, ...patch };

  await db.designProject.update({
    where: { id: designProjectId },
    data: { metaJson: newMeta as never },
  });
}
