"use client";

/**
 * /mis-disenos — project-aware index of the user's saved structural work.
 *
 * Two tabs:
 *   1. "Proyectos" (default)   — DesignProject cards with CFIA progress.
 *   2. "Cálculos sueltos"      — StructuralDesigns NOT linked to any project.
 *
 * Designs linked to a project show up in their project card; the orphan list
 * is what was previously the entire page. The tab boundary nudges engineers
 * to create a project first, which unlocks the CFIA-readiness audit.
 *
 * APIs used:
 *   GET /api/design-projects   — projects + counts + metaJson (for CFIA audit)
 *   GET /api/designs           — all of user's designs; we group locally.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  computeCfiaAudit,
  type CfiaAuditMeta,
} from "@/lib/cfia-audit";

// ── Types ─────────────────────────────────────────────────────────────────

interface SavedDesign {
  id: string;
  name: string;
  designProjectId: string | null;
  projectId: string | null;
  designProject: { id: string; name: string; revaraProjectId: string | null } | null;
  project: { id: string; name: string } | null;
  summaryStatus: "ok" | "review" | "errors";
  elementsCount: number;
  passingCount: number;
  reviewCount: number;
  errorCount: number;
  revisionNumber: number;
  createdAt: string;
}

interface DesignProjectItem {
  id: string;
  name: string;
  revaraProjectId: string | null;
  metaJson: CfiaAuditMeta | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: { designs: number };
}

type Tab = "proyectos" | "orphans";

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-CR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: SavedDesign["summaryStatus"] }) {
  if (status === "errors") {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-red-900/40 text-red-300 border border-red-800">
        ERROR
      </span>
    );
  }
  if (status === "review") {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-amber-900/40 text-amber-300 border border-amber-800">
        REVISIÓN
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-emerald-900/40 text-emerald-300 border border-emerald-800">
      OK
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function MisDisenosPage() {
  const [tab, setTab] = useState<Tab>("proyectos");
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [projects, setProjects] = useState<DesignProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/designs").then(async (r) => {
        if (!r.ok) {
          if (r.status === 401) {
            window.location.href = "/login?next=/mis-disenos";
            return null;
          }
          throw new Error(`/api/designs HTTP ${r.status}`);
        }
        return r.json();
      }),
      fetch("/api/design-projects").then(async (r) => {
        if (!r.ok) {
          // Auth was already handled by the designs call. A 401 here means a
          // race; the first redirect wins.
          if (r.status === 401) return null;
          throw new Error(`/api/design-projects HTTP ${r.status}`);
        }
        return r.json();
      }),
    ])
      .then(([d, p]) => {
        if (cancelled || !d || !p) return;
        setDesigns(d.designs ?? []);
        setProjects(p.projects ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Designs grouped by designProjectId so the project cards can compute their
  // CFIA audit without re-fetching per project.
  const designsByProject = useMemo(() => {
    const m = new Map<string, SavedDesign[]>();
    for (const d of designs) {
      if (!d.designProjectId) continue;
      const list = m.get(d.designProjectId) ?? [];
      list.push(d);
      m.set(d.designProjectId, list);
    }
    return m;
  }, [designs]);

  const orphans = useMemo(
    () => designs.filter((d) => !d.designProjectId),
    [designs],
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-amber-400 mb-1">
              Costaplanner
            </div>
            <h1 className="text-2xl font-semibold">Mis diseños</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Tus proyectos estructurales y los cálculos sueltos que aún no
              están organizados en un proyecto.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/proyectos/new">
              <Button variant="ghost">+ Nuevo proyecto</Button>
            </Link>
            <Link href="/studio">
              <Button>+ Nuevo cálculo</Button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800">
          <button
            onClick={() => setTab("proyectos")}
            className={`px-4 py-2 text-sm transition-colors -mb-px border-b-2 ${
              tab === "proyectos"
                ? "text-amber-300 border-amber-500"
                : "text-zinc-400 border-transparent hover:text-zinc-200"
            }`}
          >
            Proyectos{" "}
            <span className="text-[11px] text-zinc-500">({projects.length})</span>
          </button>
          <button
            onClick={() => setTab("orphans")}
            className={`px-4 py-2 text-sm transition-colors -mb-px border-b-2 ${
              tab === "orphans"
                ? "text-amber-300 border-amber-500"
                : "text-zinc-400 border-transparent hover:text-zinc-200"
            }`}
          >
            Cálculos sueltos{" "}
            <span className="text-[11px] text-zinc-500">({orphans.length})</span>
          </button>
        </div>

        {loading && (
          <Card>
            <CardContent className="p-6 text-sm text-zinc-400">Cargando...</CardContent>
          </Card>
        )}

        {error && (
          <Card>
            <CardContent className="p-6 text-sm text-red-400">
              No se pudo cargar la lista: {error}
            </CardContent>
          </Card>
        )}

        {!loading && !error && tab === "proyectos" && (
          <ProjectsTab projects={projects} designsByProject={designsByProject} />
        )}

        {!loading && !error && tab === "orphans" && (
          <OrphansTab orphans={orphans} />
        )}
      </div>
    </main>
  );
}

// ── Tab: Proyectos ────────────────────────────────────────────────────────

function ProjectsTab({
  projects,
  designsByProject,
}: {
  projects: DesignProjectItem[];
  designsByProject: Map<string, SavedDesign[]>;
}) {
  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-3">
          <div className="text-sm text-zinc-400">
            Aún no has creado un proyecto. Un proyecto agrupa tus cálculos para
            que la app pueda hacer la auditoría CFIA por ti.
          </div>
          <Link href="/proyectos/new">
            <Button>Crea tu primer proyecto →</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {projects.map((p) => {
        const designs = designsByProject.get(p.id) ?? [];
        const audit = computeCfiaAudit(p.metaJson, designs);

        const barColor =
          audit.band === "ok"
            ? "bg-emerald-500"
            : audit.band === "review"
              ? "bg-amber-500"
              : "bg-red-500";

        return (
          <Link
            key={p.id}
            href={`/proyectos/${p.id}`}
            className="block rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 hover:border-amber-700/40 hover:bg-zinc-900/60 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-semibold text-zinc-100">
                    {p.name}
                  </span>
                  {p.status === "archived" ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase tracking-wider">
                      archivado
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800 uppercase tracking-wider">
                      activo
                    </span>
                  )}
                  {p.revaraProjectId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-700/40">
                      ↔ REVARA
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-zinc-500 flex flex-wrap gap-3">
                  <span>
                    {p._count.designs}{" "}
                    {p._count.designs === 1 ? "cálculo" : "cálculos"}
                  </span>
                  <span>Actualizado {formatDateShort(p.updatedAt)}</span>
                </div>
              </div>
              <div className="shrink-0 text-xs text-amber-400">Abrir →</div>
            </div>

            {/* CFIA progress */}
            <div className="mt-3">
              <div className="flex items-baseline justify-between text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                <span>CFIA — listo para entrega</span>
                <span className="font-mono text-zinc-300">
                  {audit.completed} / {audit.total}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} transition-all duration-500`}
                  style={{ width: `${audit.pct}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-zinc-500">
                {audit.pct}% completado
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Tab: Cálculos sueltos (orphans) ───────────────────────────────────────

function OrphansTab({ orphans }: { orphans: SavedDesign[] }) {
  if (orphans.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-3">
          <div className="text-sm text-emerald-300">
            Todos tus cálculos están organizados ✓
          </div>
          <div className="text-xs text-zinc-500">
            Cada diseño que guardes desde Studio ya está vinculado a un
            proyecto.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {orphans.length} {orphans.length === 1 ? "cálculo suelto" : "cálculos sueltos"}
        </CardTitle>
        <p className="text-xs text-zinc-500 mt-1">
          Estos diseños no están vinculados a ningún proyecto. Ábrelo y usa
          &quot;Guardar en proyecto&quot; para organizarlo.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
              <th className="text-left px-4 py-2 font-normal">Nombre</th>
              <th className="text-left px-4 py-2 font-normal">REVARA</th>
              <th className="text-left px-4 py-2 font-normal">Estado</th>
              <th className="text-right px-4 py-2 font-normal">Elementos</th>
              <th className="text-right px-4 py-2 font-normal">Cumplen</th>
              <th className="text-left px-4 py-2 font-normal">Creado</th>
            </tr>
          </thead>
          <tbody>
            {orphans.map((d) => (
              <tr
                key={d.id}
                className="border-b border-zinc-800/60 hover:bg-zinc-900/40 transition-colors"
              >
                <td className="px-4 py-3 text-zinc-200">{d.name}</td>
                <td className="px-4 py-3 text-zinc-400">
                  {d.projectId ? "✓ vinculado" : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={d.summaryStatus} />
                </td>
                <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                  {d.elementsCount}
                </td>
                <td className="px-4 py-3 text-right text-emerald-300 tabular-nums">
                  {d.passingCount}
                </td>
                <td className="px-4 py-3 text-zinc-500 text-xs">
                  {formatDate(d.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
