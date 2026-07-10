"use client";

/**
 * /proyectos — list of the user's DesignProjects.
 *
 * Card-style rows: name, # designs, status, created date, edit/archive
 * actions. Top-right "+ Nuevo proyecto" links to /proyectos/new.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

interface ProjectListItem {
  id: string;
  name: string;
  revaraProjectId: string | null;
  metaJson: {
    zonaSismica?: 1 | 2 | 3 | 4;
    cfiaCode?: string;
    structuralSystem?: string;
    numFloors?: number;
  } | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: { designs: number };
}

export default function ProyectosIndexPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "all" | "archived">("active");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/design-projects");
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setProjects(data.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function archive(id: string) {
    if (!confirm("¿Archivar este proyecto?")) return;
    const r = await fetch(`/api/design-projects/${id}`, { method: "DELETE" });
    if (r.ok) load();
  }

  const visible = projects.filter((p) => {
    if (filter === "all") return true;
    if (filter === "active") return p.status === "active";
    if (filter === "archived") return p.status === "archived";
    return true;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">Mis proyectos</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Cada proyecto agrupa los cálculos estructurales de un edificio.
            </p>
          </div>
          <Link
            href="/proyectos/new"
            className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold whitespace-nowrap"
          >
            + Nuevo proyecto
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 text-xs">
          {(["active", "archived", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded ${
                filter === f
                  ? "bg-amber-500/20 text-amber-300 border border-amber-700/40"
                  : "border border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {f === "active"
                ? "Activos"
                : f === "archived"
                  ? "Archivados"
                  : "Todos"}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-sm text-zinc-400">Cargando proyectos…</div>
        )}
        {error && (
          <div className="text-sm text-red-400 border border-red-900/40 bg-red-950/20 rounded p-3">
            {error}
          </div>
        )}
        {!loading && !error && visible.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-800 p-10 text-center">
            <p className="text-zinc-400 mb-4">
              {filter === "archived"
                ? "No hay proyectos archivados."
                : "No hay proyectos todavía."}
            </p>
            {filter !== "archived" && (
              <Link
                href="/proyectos/new"
                className="inline-block px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold"
              >
                + Crear el primero
              </Link>
            )}
          </div>
        )}

        <div className="space-y-2">
          {visible.map((p) => {
            const zona =
              p.metaJson?.zonaSismica
                ? ["I", "II", "III", "IV"][p.metaJson.zonaSismica - 1]
                : null;
            return (
              <Link
                key={p.id}
                href={`/proyectos/${p.id}`}
                className="block rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 hover:border-amber-700/40 hover:bg-zinc-900/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold">{p.name}</span>
                      {p.status === "archived" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          archivado
                        </span>
                      )}
                      {zona && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-700/40">
                          Zona {zona}
                        </span>
                      )}
                      {p.metaJson?.cfiaCode && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          CFIA {p.metaJson.cfiaCode}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 flex flex-wrap gap-3">
                      <span>
                        {p._count.designs} cálculo{p._count.designs === 1 ? "" : "s"}
                      </span>
                      {p.metaJson?.structuralSystem && (
                        <span>{p.metaJson.structuralSystem}</span>
                      )}
                      {p.metaJson?.numFloors && (
                        <span>{p.metaJson.numFloors} pisos</span>
                      )}
                      <span>
                        Actualizado {new Date(p.updatedAt).toLocaleDateString("es-CR")}
                      </span>
                    </div>
                  </div>
                  {p.status !== "archived" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        archive(p.id);
                      }}
                      className="text-[11px] text-zinc-500 hover:text-red-400"
                    >
                      Archivar
                    </button>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
