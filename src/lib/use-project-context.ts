"use client";

/**
 * useProjectContext — reads the `?proyecto=<id>` query param, fetches the
 * DesignProject's metaJson, and exposes the values that a studio calculator
 * may want to pre-fill (zona sísmica, materials defaults, geotech defaults,
 * architecture metadata).
 *
 * Phase 1 wires only /studio/beam. Phase 2 replicates to the other 34.
 */
import { useEffect, useState } from "react";

export interface ProjectMeta {
  // Site
  address?: string;
  province?: string;
  canton?: string;
  // Owners + engineer
  owner?: string;
  engineerName?: string;
  cfiaCode?: string;
  // Architecture
  numFloors?: number;
  grossArea_m2?: number;
  buildingUse?:
    | "residential"
    | "commercial"
    | "industrial"
    | "institutional";
  structuralSystem?:
    | "marcos"
    | "muros"
    | "dual"
    | "mampostería_confinada"
    | "acero";
  // Seismic (CSCR-10)
  zonaSismica?: 1 | 2 | 3 | 4;
  // Materials defaults
  fc_default?: number;
  fy_default?: number;
  // Geotech
  qa_ton_m2?: number;
  phi_deg?: number;
  c_kPa?: number;
  gamma_kN_m3?: number;
  waterTable_m?: number;
  // Bookkeeping
  notes?: string;
  completedSteps?: string[];
}

export function useProjectContext() {
  // Read the query string from window after mount instead of useSearchParams
  // so static prerender doesn't choke (Next 14 requires a Suspense boundary
  // around useSearchParams; we avoid that complexity entirely).
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [meta, setMeta] = useState<ProjectMeta | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("proyecto");
    setProyectoId(id);
  }, []);

  useEffect(() => {
    if (!proyectoId) {
      setMeta(null);
      setProjectName(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/design-projects/${proyectoId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setMeta((data.metaJson as ProjectMeta) ?? null);
        setProjectName(data.name ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [proyectoId]);

  return { proyectoId, meta, projectName, loading };
}
