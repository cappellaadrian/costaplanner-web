/**
 * /api/structural/design-proxy
 *
 * Server-side proxy to costaplanner-api.vercel.app/design/structural.
 *
 * Used by Beam Studio when the user clicks "Guardar" without having clicked
 * "Validar oficialmente" first — we want a canonical resultJson to persist,
 * so we run the official compute here on the server.
 *
 * Auth-protected so unauthenticated browsers can't hit the upstream API
 * through this app's domain.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const COSTAPLANNER_API_URL =
  process.env.COSTAPLANNER_API_URL ?? "https://costaplanner-api.vercel.app";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: { arch: unknown; struct: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido (esperaba { arch, struct })." },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${COSTAPLANNER_API_URL}/design/structural`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
