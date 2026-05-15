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
  return NextResponse.json(design, { status: 201 });
}
