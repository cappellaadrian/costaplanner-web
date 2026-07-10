/**
 * /api/design-projects/[id]
 *
 * GET    — returns the project + its designs + metaJson.
 * PATCH  — updates name, metaJson (deep-merged), status. Owner-scoped.
 * DELETE — soft delete by setting status = "archived" (designs preserved via
 *          schema-level onDelete: SetNull, but here we don't actually delete).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const userId = (auth.user as { id: string }).id;

  const project = await db.designProject.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      createdBy: true,
      revaraProjectId: true,
      metaJson: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      designs: {
        select: {
          id: true,
          name: true,
          summaryStatus: true,
          elementsCount: true,
          passingCount: true,
          reviewCount: true,
          errorCount: true,
          revisionNumber: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (project.createdBy !== userId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  return NextResponse.json(project);
}

interface PatchBody {
  name?: string;
  metaJson?: Record<string, unknown>;
  status?: string;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const userId = (auth.user as { id: string }).id;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await db.designProject.findUnique({
    where: { id: params.id },
    select: { createdBy: true, metaJson: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (existing.createdBy !== userId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const data: {
    name?: string;
    metaJson?: Record<string, unknown>;
    status?: string;
  } = {};

  if (body.name !== undefined) {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json(
        { error: "name no puede estar vacío" },
        { status: 400 },
      );
    }
    data.name = trimmed;
  }

  if (body.metaJson !== undefined) {
    // Deep-merge: client sends a delta, we preserve existing keys.
    const current =
      (existing.metaJson as Record<string, unknown> | null) ?? {};
    data.metaJson = { ...current, ...body.metaJson };
  }

  if (body.status !== undefined) {
    const allowed = ["active", "archived", "completed"];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `status debe ser uno de ${allowed.join(", ")}` },
        { status: 400 },
      );
    }
    data.status = body.status;
  }

  const updated = await db.designProject.update({
    where: { id: params.id },
    data: data as never,
    select: {
      id: true,
      name: true,
      metaJson: true,
      status: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const userId = (auth.user as { id: string }).id;

  const existing = await db.designProject.findUnique({
    where: { id: params.id },
    select: { createdBy: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (existing.createdBy !== userId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  // Soft delete: mark as archived. Designs remain linked.
  await db.designProject.update({
    where: { id: params.id },
    data: { status: "archived" },
  });

  return NextResponse.json({ ok: true });
}
