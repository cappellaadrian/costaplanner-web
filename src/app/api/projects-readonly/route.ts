/**
 * /api/projects-readonly
 *
 * Read-only list of REVARA Project records for the current user. Used by
 * the Save modal to populate the "Vincular a proyecto REVARA" dropdown.
 *
 * Reads the same `Project` table REVARA writes to (shared Neon DB). We're
 * intentionally read-only here — Costaplanner doesn't create or mutate
 * REVARA projects; that's REVARA's job.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const userId = (auth.user as { id: string }).id;

  const projects = await db.project.findMany({
    where: { createdBy: userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
    take: 100,
  });
  return NextResponse.json({ projects });
}
