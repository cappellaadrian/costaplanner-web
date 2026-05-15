"use client";

/**
 * Modal for saving a beam design.
 *
 * Renders inside the studio when the user clicks "Guardar". Lets them:
 *   - name the design (defaults to project_name + date)
 *   - pick an existing DesignProject (Costaplanner-side container)
 *   - create a new DesignProject inline
 *   - optionally link the DesignProject to a REVARA Project
 *
 * The actual POST is in the parent (it has the arch/struct/result triple).
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface DesignProject {
  id: string;
  name: string;
  revaraProjectId: string | null;
}

interface RevaraProject {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  defaultName: string;
  onSave: (args: {
    name: string;
    designProjectId: string | null;
    projectId: string | null;
  }) => Promise<void>;
}

export function SaveModal({ open, onClose, defaultName, onSave }: Props) {
  const [name, setName] = useState(defaultName);
  const [designProjects, setDesignProjects] = useState<DesignProject[]>([]);
  const [revaraProjects, setRevaraProjects] = useState<RevaraProject[]>([]);
  const [selectedDP, setSelectedDP] = useState<string>(""); // "" = none, "__new__" = create
  const [newDPName, setNewDPName] = useState("");
  const [selectedRevara, setSelectedRevara] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load projects when modal opens
  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setError(null);
    Promise.all([
      fetch("/api/design-projects").then((r) => (r.ok ? r.json() : { projects: [] })),
      // REVARA Project list — same DB so we read via Prisma-backed endpoint
      // mirroring REVARA's /api/projects but read-only here.
      fetch("/api/projects-readonly").then((r) =>
        r.ok ? r.json() : { projects: [] },
      ),
    ])
      .then(([dp, rp]) => {
        setDesignProjects(dp.projects ?? []);
        setRevaraProjects(rp.projects ?? []);
      })
      .catch(() => {});
  }, [open, defaultName]);

  if (!open) return null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      let dpId: string | null = null;

      if (selectedDP === "__new__") {
        if (!newDPName.trim()) {
          setError("Falta el nombre del proyecto.");
          setSaving(false);
          return;
        }
        const r = await fetch("/api/design-projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newDPName,
            revaraProjectId: selectedRevara || undefined,
          }),
        });
        const created = await r.json();
        if (!r.ok) {
          setError(created.error ?? "No se pudo crear el proyecto.");
          setSaving(false);
          return;
        }
        dpId = created.id;
      } else if (selectedDP) {
        dpId = selectedDP;
      }

      await onSave({
        name,
        designProjectId: dpId,
        projectId: selectedRevara || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Guardar diseño</h2>
          <p className="text-xs text-zinc-500 mt-1">
            El diseño queda guardado en tu cuenta. Puedes asociarlo a un proyecto.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-zinc-500">
            Nombre del diseño
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-zinc-500">
            Proyecto Costaplanner (opcional)
          </label>
          <select
            value={selectedDP}
            onChange={(e) => setSelectedDP(e.target.value)}
            className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">Sin proyecto (diseño suelto)</option>
            {designProjects.map((dp) => (
              <option key={dp.id} value={dp.id}>
                {dp.name}
              </option>
            ))}
            <option value="__new__">+ Crear nuevo proyecto</option>
          </select>
        </div>

        {selectedDP === "__new__" && (
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">
              Nombre del nuevo proyecto
            </label>
            <input
              type="text"
              value={newDPName}
              onChange={(e) => setNewDPName(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              placeholder="Ej: Casa Santa Ana"
            />
          </div>
        )}

        {revaraProjects.length > 0 && (
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">
              Vincular a proyecto REVARA (opcional)
            </label>
            <select
              value={selectedRevara}
              onChange={(e) => setSelectedRevara(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">Sin vinculación</option>
              {revaraProjects.map((rp) => (
                <option key={rp.id} value={rp.id}>
                  {rp.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-zinc-600 mt-1">
              Si vinculas, el diseño aparecerá en /structural del proyecto en REVARA.
            </p>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 border border-red-900/40 bg-red-950/20 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
