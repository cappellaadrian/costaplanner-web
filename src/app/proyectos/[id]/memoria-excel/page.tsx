"use client";

/**
 * /proyectos/[id]/memoria-excel — project-level master Excel builder.
 *
 * Mirror of /proyectos/[id]/memoria but emits a single .xlsx workbook
 * instead of the printable HTML memoria PDF. Same fetch + snapshot
 * pipeline:
 *   1. GET /api/design-projects/[id]   → project meta + design index
 *   2. GET /api/designs/[id]            (one per saved design)
 *   3. designToSnapshot(...)            → reconstruct DesignSnapshot[]
 *   4. exportProjectAsExcel(snapshots, meta) — emits workbook with:
 *        Portada · Resumen · Cargas y materiales · <element>… · Cantidades · Bibliografía
 *
 * designToSnapshot lives in @/lib/proyectos/design-to-snapshot so both this
 * page and the PDF memoria page share the exact same conversion logic.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { exportProjectAsExcel } from "@/lib/exporters/project-excel";
import type { DesignSnapshot } from "@/lib/exporters/types";
import {
  designToSnapshot,
  type FullDesign,
  type ProjectMeta,
} from "@/lib/proyectos/design-to-snapshot";

interface DesignSummary {
  id: string;
  name: string;
  summaryStatus: string;
  elementsCount: number;
  passingCount: number;
  reviewCount: number;
  errorCount: number;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
}

interface ProjectResponse {
  id: string;
  name: string;
  metaJson: ProjectMeta;
  status: string;
  createdAt: string;
  updatedAt: string;
  designs: DesignSummary[];
}

interface BuildEntry {
  design: FullDesign;
  snapshot: DesignSnapshot | null;
  reason?: string;
}

export default function MemoriaExcelPage({
  params,
}: {
  params: { id: string };
}) {
  const projectId = params.id;

  const router = useRouter();
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [entries, setEntries] = useState<BuildEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        // 1. Project + design index
        const projRes = await fetch(`/api/design-projects/${projectId}`);
        if (projRes.status === 401) {
          router.push(`/login?next=/proyectos/${projectId}/memoria-excel`);
          return;
        }
        if (!projRes.ok) {
          const e = await projRes.json().catch(() => ({}));
          throw new Error(e.error ?? `HTTP ${projRes.status}`);
        }
        const proj = (await projRes.json()) as ProjectResponse;
        if (cancelled) return;
        setProject(proj);

        // 2. Fetch each design's full payload in parallel
        const fulls = await Promise.all(
          proj.designs.map(async (d): Promise<FullDesign | null> => {
            try {
              const r = await fetch(`/api/designs/${d.id}`);
              if (!r.ok) return null;
              return (await r.json()) as FullDesign;
            } catch {
              return null;
            }
          }),
        );
        if (cancelled) return;

        // 3. Convert each design to a snapshot
        const next: BuildEntry[] = [];
        for (const full of fulls) {
          if (!full) continue;
          const { snapshot, reason } = designToSnapshot(
            full,
            proj.metaJson ?? {},
            proj.name,
          );
          next.push({ design: full, snapshot, reason });
        }
        setEntries(next);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error inesperado");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [projectId, router]);

  const snapshots = useMemo<DesignSnapshot[]>(
    () =>
      entries
        .map((e) => e.snapshot)
        .filter((s): s is DesignSnapshot => s !== null),
    [entries],
  );

  const skipped = entries.filter((e) => e.snapshot === null);

  // Sheet count estimate: Portada + Resumen + Cargas + N (per element) + Cantidades + Bibliografía
  const sheetEstimate = 3 + snapshots.length + 2;

  async function handleGenerate() {
    if (!project) return;
    setGenerating(true);
    try {
      const meta = project.metaJson ?? {};
      await exportProjectAsExcel(snapshots, {
        name: project.name,
        address: meta.address,
        owner: meta.owner,
        engineer: meta.engineerName,
        cfia: meta.cfiaCode,
        zonaSismica: meta.zonaSismica,
        fc: meta.fc_default,
        fy: meta.fy_default,
        qa_ton_m2: meta.qa_ton_m2,
        phi_deg: meta.phi_deg,
        c_kPa: meta.c_kPa,
        gamma_kN_m3: meta.gamma_kN_m3,
        numFloors: meta.numFloors,
        grossArea_m2: meta.grossArea_m2,
        structuralSystem: meta.structuralSystem,
        buildingUse: meta.buildingUse,
      });
      // After download fires, send the user back to the dashboard.
      setTimeout(() => {
        router.push(`/proyectos/${projectId}`);
      }, 1200);
    } catch (e) {
      setError(
        e instanceof Error
          ? `No se pudo generar el archivo: ${e.message}`
          : "Error inesperado al generar el archivo",
      );
    } finally {
      setTimeout(() => setGenerating(false), 1200);
    }
  }

  // ─── States ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-3">
          <div className="text-xs uppercase tracking-widest text-emerald-400">
            <Link
              href={`/proyectos/${projectId}`}
              className="hover:text-emerald-300"
            >
              ← Volver al proyecto
            </Link>
          </div>
          <h1 className="text-2xl font-semibold">Construyendo libro Excel…</h1>
          <p className="text-sm text-zinc-400">
            Cargando proyecto y reconstruyendo {entries.length || "…"} elementos.
          </p>
          <div className="h-1 w-full bg-zinc-900 rounded overflow-hidden">
            <div className="h-full w-1/3 bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-4">
          <div className="text-xs uppercase tracking-widest text-emerald-400">
            <Link
              href={`/proyectos/${projectId}`}
              className="hover:text-emerald-300"
            >
              ← Volver al proyecto
            </Link>
          </div>
          <h1 className="text-2xl font-semibold">
            No se pudo construir el archivo
          </h1>
          <div className="rounded border border-red-700/40 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
          <Link
            href={`/proyectos/${projectId}`}
            className="inline-block text-xs text-emerald-400 hover:underline"
          >
            Regresar al dashboard →
          </Link>
        </div>
      </div>
    );
  }

  if (!project) return null;

  // Empty state
  if (project.designs.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-4">
          <div className="text-xs uppercase tracking-widest text-emerald-400">
            <Link
              href={`/proyectos/${projectId}`}
              className="hover:text-emerald-300"
            >
              ← Volver al proyecto
            </Link>
          </div>
          <h1 className="text-2xl font-semibold">Memoria vacía</h1>
          <p className="text-sm text-zinc-400 max-w-xl">
            Aún no hay elementos calculados en{" "}
            <strong className="text-zinc-200">{project.name}</strong>. Empieza
            calculando un elemento (zapata, viga, columna…) y vuelve aquí para
            generar el libro Excel completo.
          </p>
          <Link
            href={`/proyectos/${projectId}`}
            className="inline-block px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold"
          >
            Empieza calculando algo →
          </Link>
        </div>
      </div>
    );
  }

  // Ready state
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="text-xs uppercase tracking-widest text-emerald-400">
          <Link
            href={`/proyectos/${projectId}`}
            className="hover:text-emerald-300"
          >
            ← Volver al proyecto
          </Link>
        </div>

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">
            Exportación Excel — {project.name}
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Genera un libro <code className="text-emerald-300">.xlsx</code> con
            portada, resumen, cargas y materiales, hoja por elemento, resumen
            de cantidades y bibliografía. Ideal para auditorías, takeoff
            preliminar y entregas paralelas a la memoria PDF.
          </p>
        </header>

        {/* Project chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {project.metaJson?.cfiaCode && (
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
              CFIA {project.metaJson.cfiaCode}
            </span>
          )}
          {project.metaJson?.engineerName && (
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
              Ing. {project.metaJson.engineerName}
            </span>
          )}
          {project.metaJson?.zonaSismica && (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-700/40">
              Zona{" "}
              {["I", "II", "III", "IV"][project.metaJson.zonaSismica - 1]}
            </span>
          )}
          <span className="px-2 py-0.5 rounded border border-emerald-800 text-emerald-300 bg-emerald-500/5">
            ≈ {sheetEstimate} hojas
          </span>
        </div>

        {/* Element list */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/30 overflow-hidden">
          <header className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Elementos incluidos ({snapshots.length}
              {skipped.length > 0 && (
                <span className="text-zinc-500">
                  {" "}· {skipped.length} omitido(s)
                </span>
              )}
              )
            </h2>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
              {project.designs.length} diseños guardados
            </span>
          </header>
          <ul className="divide-y divide-zinc-800/60">
            {entries.map((e) => {
              if (!e.snapshot) {
                return (
                  <li
                    key={e.design.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 opacity-50"
                  >
                    <div>
                      <div className="text-sm text-zinc-400">
                        {e.design.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {e.reason ?? "Omitido"}
                      </div>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                      Omitido
                    </span>
                  </li>
                );
              }
              const passing =
                e.snapshot.checks.length === 0
                  ? null
                  : e.snapshot.checks.every((c) => c.cumple);
              return (
                <li
                  key={e.design.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-200 truncate">
                      {e.snapshot.title}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {e.snapshot.elementType} · {e.snapshot.steps.length} pasos ·{" "}
                      {e.snapshot.checks.length} verificaciones
                    </div>
                  </div>
                  <span
                    className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                      passing === true
                        ? "bg-emerald-900/40 text-emerald-300 border-emerald-800"
                        : passing === false
                          ? "bg-amber-900/40 text-amber-300 border-amber-800"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800"
                    }`}
                  >
                    {passing === true
                      ? "OK"
                      : passing === false
                        ? "Revisión"
                        : "Sin checks"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Generate Excel */}
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/20 p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-emerald-200 mb-1">
              Generar libro Excel
            </h3>
            <p className="text-xs text-zinc-400">
              Descarga directa de un archivo{" "}
              <span className="text-zinc-200 font-semibold">.xlsx</span>{" "}
              con todas las hojas estilizadas y listas para revisión / takeoff.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || snapshots.length === 0}
            className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? "Generando…" : "⊞ Exportar a Excel"}
          </button>
        </div>

        <p className="text-xs text-zinc-600 italic">
          La hoja “Cantidades” usa la misma estimación indicativa que la
          memoria PDF — para takeoff oficial confirma con planos. Diagramas
          SVG aún no se embeben en Excel (sólo en PDF).
        </p>
      </div>
    </div>
  );
}
