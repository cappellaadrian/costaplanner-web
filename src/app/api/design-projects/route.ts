/**
 * /api/design-projects
 *
 * Costaplanner-side project container (DesignProject). Holds one or more
 * StructuralDesign records and may optionally link back to a REVARA Project
 * via revaraProjectId — that's how a design saved here surfaces in REVARA's
 * /structural page under "Diseños recientes".
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const userId = (auth.user as { id: string }).id;

  const projects = await db.designProject.findMany({
    where: { createdBy: userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      revaraProjectId: true,
      metaJson: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { designs: true } },
    },
    take: 100,
  });
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const userId = (auth.user as { id: string }).id;

  let body: { name?: string; revaraProjectId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Falta name" }, { status: 400 });
  }

  const project = await db.designProject.create({
    data: {
      name: body.name.trim(),
      createdBy: userId,
      revaraProjectId: body.revaraProjectId?.trim() || null,
    },
    select: { id: true, name: true, revaraProjectId: true, createdAt: true },
  });
  return NextResponse.json(project, { status: 201 });
}
