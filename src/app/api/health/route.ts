/**
 * /api/health — lightweight uptime endpoint.
 *
 * Returns 200 with build info + current server time. No auth, no DB hits.
 * Used by:
 *   - Vercel deployment health checks (post-deploy)
 *   - External uptime monitors (BetterStack, UptimeRobot, etc.)
 *   - REVARA cross-app sanity checks
 *   - Future canary post-deploy scripts
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // always fresh — don't cache health

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "costaplanner-web",
    build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    region: process.env.VERCEL_REGION ?? "unknown",
    env: process.env.VERCEL_ENV ?? "development",
    now: new Date().toISOString(),
  });
}
