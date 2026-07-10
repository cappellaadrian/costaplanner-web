/**
 * /api/designs/[id]/quantities — extract material takeoff from a saved design.
 *
 * Read-only. Used by REVARA's BoQ import screen: it asks Costaplanner for
 * the quantities of every linked design and inserts BoqPosition rows.
 *
 * The response is structured to drop directly into REVARA's BoqPosition
 * shape via `quantitiesToBoqRows`. Same auth model as /api/designs/[id]:
 * creator only for now.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { extractQuantities, quantitiesToBoqRows } from "@/lib/quantities";

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
  if (design.createdBy !== userId) {
    return NextResponse.json({ error: "Sin acceso." }, { status: 403 });
  }

  // Prisma JsonValue types — cast through unknown to the expected shape.
  const archJson = design.archJson as unknown as {
    elements?: {
      beams?: Array<{
        id: string;
        start: [number, number];
        end: [number, number];
        section: { width_mm: number; depth_mm: number };
      }>;
    };
  };
  const resultJson = design.resultJson as unknown as {
    results: Array<{
      element_id: string;
      element_type?: string;
      refuerzo: {
        longitudinal: Array<{ n: number; size: number; As_total: number; position?: string }>;
        transversal: Array<{ size: number; separacion: number; ramas: number; zona: string }>;
      };
    }>;
  };

  const q = extractQuantities({ archJson, resultJson });
  if (!q) {
    return NextResponse.json({
      design_id: design.id,
      design_name: design.name,
      element_type: resultJson?.results?.[0]?.element_type ?? "unknown",
      available: false,
      message: "Cantidades aún no disponibles para este tipo de elemento.",
      quantities: null,
      boq_rows: [],
    });
  }
  return NextResponse.json({
    design_id: design.id,
    design_name: design.name,
    element_type: "beam",
    available: true,
    quantities: q,
    boq_rows: quantitiesToBoqRows(q),
  });
}
