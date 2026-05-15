"use client";

/**
 * /mis-disenos — list of the current user's saved structural designs.
 *
 * Reads from /api/designs which queries the shared StructuralDesign table.
 * Shows project + status + element counts + revision + created date.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export default function MisDisenosPage() {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/designs")
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 401) {
            window.location.href = "/login?next=/mis-disenos";
            return null;
          }
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        setDesigns(data.designs ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-amber-400 mb-1">
              Costaplanner
            </div>
            <h1 className="text-2xl font-semibold">Mis diseños</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Diseños guardados en tu cuenta. Si están vinculados a un proyecto
              REVARA, también aparecen ahí bajo Diseños recientes.
            </p>
          </div>
          <Link href="/studio/beam">
            <Button>+ Nuevo diseño</Button>
          </Link>
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

        {!loading && !error && designs.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <div className="text-sm text-zinc-400">
                Aún no has guardado ningún diseño.
              </div>
              <Link href="/studio/beam">
                <Button>Empezar un diseño →</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {!loading && !error && designs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {designs.length} {designs.length === 1 ? "diseño" : "diseños"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                    <th className="text-left px-4 py-2 font-normal">Nombre</th>
                    <th className="text-left px-4 py-2 font-normal">Proyecto</th>
                    <th className="text-left px-4 py-2 font-normal">REVARA</th>
                    <th className="text-left px-4 py-2 font-normal">Estado</th>
                    <th className="text-right px-4 py-2 font-normal">Elementos</th>
                    <th className="text-right px-4 py-2 font-normal">Cumplen</th>
                    <th className="text-left px-4 py-2 font-normal">Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {designs.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-zinc-800/60 hover:bg-zinc-900/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-zinc-200">{d.name}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {d.designProject?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {d.designProject?.revaraProjectId || d.projectId ? "✓ vinculado" : "—"}
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
        )}
      </div>
    </main>
  );
}
