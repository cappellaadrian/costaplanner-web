/**
 * /api/designs/[id] — load a saved StructuralDesign by id.
 *
 * Returns archJson + structJson + resultJson so the Beam Studio can replay
 * the design (preload form, re-render steps, re-render verification).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const userId = (auth.user as { id: string }).id;

  const design = await db.structuralDesign.findUnique({
    where: { id: params.id },
  });
  if (!design) {
    return NextResponse.json({ error: "Diseño no encontrado." }, { status: 404 });
  }
  // Soft access control: creator only. Future: org-membership shared access.
  if (design.createdBy !== userId) {
    return NextResponse.json({ error: "Sin acceso." }, { status: 403 });
  }
  return NextResponse.json(design);
}
