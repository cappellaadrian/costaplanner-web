/**
 * Additively ensures the schema bits Costaplanner needs exist in the shared
 * Neon DB. Mirrors REVARA's pattern: pure CREATE IF NOT EXISTS + ALTER ADD
 * COLUMN IF NOT EXISTS, never DROP. The shared DB is owned by REVARA — we
 * only extend it.
 *
 * What this script ensures:
 *   - DesignProject table (Costaplanner-side container for design revisions)
 *   - StructuralDesign.designProjectId column (nullable FK to DesignProject)
 *   - StructuralDesign.revisionNumber column (default 1)
 *   - StructuralDesign.projectId is nullable (so design-loose designs can
 *     exist without a REVARA project)
 *
 * Idempotent. Safe to run on every deploy.
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[ensure-schema] DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(url);

const STATEMENTS = [
  // DesignProject — Costaplanner-side grouping of related designs.
  `CREATE TABLE IF NOT EXISTS "DesignProject" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "createdBy"       TEXT NOT NULL,
    "organizationId"  TEXT,
    "revaraProjectId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DesignProject_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "DesignProject_createdBy_idx" ON "DesignProject"("createdBy")`,
  `CREATE INDEX IF NOT EXISTS "DesignProject_revaraProjectId_idx" ON "DesignProject"("revaraProjectId")`,

  // Make StructuralDesign.projectId nullable (it was NOT NULL when REVARA
  // created it, but Costaplanner-side designs may have no REVARA project).
  `ALTER TABLE "StructuralDesign" ALTER COLUMN "projectId" DROP NOT NULL`,

  // Add DesignProject FK column.
  `ALTER TABLE "StructuralDesign" ADD COLUMN IF NOT EXISTS "designProjectId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "StructuralDesign_designProjectId_idx" ON "StructuralDesign"("designProjectId")`,

  // Add revisionNumber for grouping multiple iterations of the same design.
  `ALTER TABLE "StructuralDesign" ADD COLUMN IF NOT EXISTS "revisionNumber" INTEGER NOT NULL DEFAULT 1`,

  // DesignProject criteria metadata (zona sísmica, qa, fc/fy defaults, etc.)
  // — added 2026-05-18 for the Proyecto workflow Phase 1.
  `ALTER TABLE "DesignProject" ADD COLUMN IF NOT EXISTS "metaJson" JSONB NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "DesignProject" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active'`,

  // FK constraint for designProjectId, only if not already present.
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'StructuralDesign_designProjectId_fkey'
        AND table_name = 'StructuralDesign'
    ) THEN
      ALTER TABLE "StructuralDesign"
        ADD CONSTRAINT "StructuralDesign_designProjectId_fkey"
        FOREIGN KEY ("designProjectId") REFERENCES "DesignProject"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,
];

try {
  for (const stmt of STATEMENTS) {
    await sql.query(stmt);
  }
  console.log("[ensure-schema] OK");
} catch (e) {
  console.error("[ensure-schema] FAILED:", e.message ?? e);
  process.exit(1);
}
