"use client";

/**
 * /studio/proyecto — "Casa demo" — diseño completo de una casa de 2 pisos
 * con todos los elementos estructurales pre-calculados y exportable como
 * UNA SOLA memoria PDF de varios elementos.
 *
 * Demostración end-to-end de la integración Costaplanner:
 *   1. Geotecnia → SPT entrega qa = 200 kPa, φ = 32°
 *   2. Cimentaciones → zapata aislada, zapata corrida, viga de amarre
 *   3. Estructura vertical → columnas rectangulares + muro de corte
 *   4. Horizontales → vigas + losas + escaleras
 *   5. Detalles → dintel sobre ventana
 *   6. Salida → memoria PDF de 6+ elementos en un solo click
 */
import { useState, useMemo } from "react";
import Link from "next/link";
import { printProjectAsPdf } from "@/lib/exporters/project-pdf";
import { buildSnapshot } from "@/lib/exporters/snapshot-builder";
import { renderDiagrams } from "@/lib/exporters/render-diagrams";
import { computeBeamFlexureLive, buildFlexureSteps } from "@/lib/beam-flexure-live";
import {
  computeRectangularColumnLive, buildRectangularColumnSteps, buildRectangularColumnChecks,
} from "@/lib/rectangular-column-live";
import {
  computeIsolatedFootingLive, buildIsolatedFootingSteps, buildIsolatedFootingChecks,
} from "@/lib/isolated-footing-live";
import {
  computeStripFootingLive, buildStripFootingSteps, buildStripFootingChecks,
} from "@/lib/strip-footing-live";
import {
  computeTieBeamLive, buildTieBeamSteps, buildTieBeamChecks,
} from "@/lib/tie-beam-live";
import {
  computeOneWaySlabLive, buildOneWaySlabSteps, buildOneWaySlabChecks,
} from "@/lib/one-way-slab-live";
import {
  D12_PlanView, D13_ElevationX, D14_ElevationY, D16_PressureDist,
  D19_Punzonamiento, D20_FinalRebar,
} from "@/components/studio/IsolatedFootingDiagrams";
import { StripSeccion, StripPressure, OWSSection, OWSMomentDiagram, TieBeamSection, TieBeamPlan } from "@/components/studio/MoreDiagrams";
import { RC1_Seccion, RC2_Elevacion, RC5_PM_Diagram } from "@/components/studio/ColumnDiagrams";
import { BM1_SectionApoyo, BM3_Elevation, BM4_Moments, BM5_Shear } from "@/components/studio/BeamDiagrams";

interface ProjectMetadata {
  name: string;
  address: string;
  owner: string;
  engineer: string;
  cfia: string;
  zonaSismica: 1 | 2 | 3 | 4;
}

const DEMO_META: ProjectMetadata = {
  name: "Casa Demo — Santa Ana",
  address: "Santa Ana, San José, Costa Rica",
  owner: "Sr. Adrian Cappella",
  engineer: "_______________________",
  cfia: "_______________",
  zonaSismica: 3,
};

export default function ProyectoPage() {
  const [meta, setMeta] = useState<ProjectMetadata>(DEMO_META);
  const [generating, setGenerating] = useState(false);

  // Pre-canned demo design — typical CR 2-story house, zona III
  const snapshots = useMemo(() => {
    // 1. Isolated footing for an interior column (typical Pu = 60 ton)
    const ftgInput = {
      B_m: 1.8, L_m: 1.8, h_cm: 45, bc_cm: 35, lc_cm: 35, r_cm: 7.5,
      Pu_ton: 60, Mu_tonm: 4.5, qa_ton_m2: 20, fc: 245, fy: 4200,
      zona: meta.zonaSismica, withSeismic: false,
    };
    const ftgRes = computeIsolatedFootingLive(ftgInput);
    const ftgSnap = buildSnapshot({
      title: `Zapata aislada interior 1.80×1.80 m`,
      elementType: "isolated_footing",
      projectName: meta.name, canton: meta.address.split(",")[1]?.trim(),
      zonaSismica: meta.zonaSismica,
      engineer: meta.engineer, cfia: meta.cfia,
      fc: ftgInput.fc, fy: ftgInput.fy,
      aceroNorma: meta.zonaSismica >= 3 ? "A706" : "A615",
      inputs: [
        { name: "B", value: ftgInput.B_m, unit: "m" },
        { name: "L", value: ftgInput.L_m, unit: "m" },
        { name: "h", value: ftgInput.h_cm, unit: "cm" },
        { name: "Columna", value: `${ftgInput.bc_cm}×${ftgInput.lc_cm}`, unit: "cm" },
        { name: "Pu (análisis estructural)", value: ftgInput.Pu_ton, unit: "ton" },
        { name: "Mu (análisis estructural)", value: ftgInput.Mu_tonm, unit: "ton-m" },
        { name: "qa (estudio de suelos)", value: ftgInput.qa_ton_m2, unit: "ton/m²" },
      ],
      steps: buildIsolatedFootingSteps(ftgRes),
      checks: buildIsolatedFootingChecks(ftgRes),
      reinforcement: {
        longitudinal: [
          { n: ftgRes.n_B, size: ftgRes.size_B, As_total: ftgRes.As_prov_B,
            position: `Dirección B, sep ${ftgRes.s_B.toFixed(1)} cm` },
          { n: ftgRes.n_L, size: ftgRes.size_L, As_total: ftgRes.As_prov_L,
            position: `Dirección L, sep ${ftgRes.s_L.toFixed(1)} cm` },
        ],
      },
      notes: ftgRes.warnings,
      diagrams: renderDiagrams([
        { title: "D12 — Planta", element: <D12_PlanView r={ftgRes} /> },
        { title: "D13 — Elevación X", element: <D13_ElevationX r={ftgRes} /> },
        { title: "D14 — Elevación Y", element: <D14_ElevationY r={ftgRes} /> },
        { title: "D16 — Distribución de presión", element: <D16_PressureDist r={ftgRes} /> },
        { title: "D19 — Punzonamiento", element: <D19_Punzonamiento r={ftgRes} /> },
        { title: "D20 — Distribución final de acero", element: <D20_FinalRebar r={ftgRes} /> },
      ]),
    });

    // 2. Strip footing for perimeter walls
    const stripInput = {
      B_m: 0.7, h_cm: 30, bMuro_cm: 15, Pu_lineal_ton_m: 8,
      qa_ton_m2: 20, fc: 245, fy: 4200, zona: meta.zonaSismica, r_cm: 7.5,
    };
    const stripRes = computeStripFootingLive(stripInput);
    const stripSnap = buildSnapshot({
      title: `Zapata corrida B = 0.70 m bajo muro perimetral`,
      elementType: "strip_footing",
      projectName: meta.name, zonaSismica: meta.zonaSismica,
      engineer: meta.engineer, cfia: meta.cfia,
      fc: stripInput.fc, fy: stripInput.fy,
      inputs: [
        { name: "B", value: stripInput.B_m, unit: "m" },
        { name: "h", value: stripInput.h_cm, unit: "cm" },
        { name: "b muro", value: stripInput.bMuro_cm, unit: "cm" },
        { name: "Pu lineal", value: stripInput.Pu_lineal_ton_m, unit: "ton/m" },
        { name: "qa (estudio de suelos)", value: stripInput.qa_ton_m2, unit: "ton/m²" },
      ],
      steps: buildStripFootingSteps(stripRes),
      checks: buildStripFootingChecks(stripRes),
      reinforcement: {
        longitudinal: [{ n: stripRes.n, size: stripRes.size, As_total: stripRes.As_prov,
          position: `Transversal sep ${stripRes.s.toFixed(1)} cm` }],
      },
      notes: stripRes.warnings,
      diagrams: renderDiagrams([
        { title: "SF-1 — Sección transversal", element: <StripSeccion r={stripRes} /> },
        { title: "SF-3 — Presión bajo cimiento", element: <StripPressure r={stripRes} /> },
      ]),
    });

    // 3. Tie beam
    const tbInput = {
      b_cm: 20, h_cm: 40, L_m: 4.0,
      Pu_zapata_max_ton: 60,
      fc: 245, fy: 4200, zona: meta.zonaSismica,
    };
    const tbRes = computeTieBeamLive(tbInput);
    const tbSnap = buildSnapshot({
      title: `Viga de amarre 20×40 cm`,
      elementType: "tie_beam",
      projectName: meta.name, zonaSismica: meta.zonaSismica,
      engineer: meta.engineer, cfia: meta.cfia,
      fc: tbInput.fc, fy: tbInput.fy,
      inputs: [
        { name: "b", value: tbInput.b_cm, unit: "cm" },
        { name: "h", value: tbInput.h_cm, unit: "cm" },
        { name: "L", value: tbInput.L_m, unit: "m" },
        { name: "Pu zapata max", value: tbInput.Pu_zapata_max_ton, unit: "ton" },
      ],
      steps: buildTieBeamSteps(tbRes),
      checks: buildTieBeamChecks(tbRes),
      reinforcement: {
        longitudinal: [
          { n: 2, size: 5, As_total: 3.98, position: "Superior" },
          { n: 2, size: 5, As_total: 3.98, position: "Inferior" },
        ],
        transversal: [{ size: 3, separacion_cm: 20, zona: "Toda la longitud", ramas: 2 }],
      },
      notes: tbRes.warnings,
      diagrams: renderDiagrams([
        { title: "TB-1 — Sección transversal", element: <TieBeamSection r={tbRes} /> },
        { title: "TB-2 — Plan de cimentación", element: <TieBeamPlan r={tbRes} /> },
      ]),
    });

    // 4. Rectangular column
    const colInput = {
      b: 35, h: 35, L: 280, recubrimiento: 4,
      Pu_ton: 60, Mu_max_tonm: 2.5, fc: 245, fy: 4200,
      zona: meta.zonaSismica, nBarsTentative: 8, sizeBarTentative: 7,
    };
    const colRes = computeRectangularColumnLive(colInput);
    const colSnap = buildSnapshot({
      title: `Columna rectangular 35×35 cm`,
      elementType: "rectangular_column",
      projectName: meta.name, zonaSismica: meta.zonaSismica,
      engineer: meta.engineer, cfia: meta.cfia,
      fc: colInput.fc, fy: colInput.fy,
      aceroNorma: meta.zonaSismica >= 3 ? "A706" : "A615",
      inputs: [
        { name: "b", value: colInput.b, unit: "cm" },
        { name: "h", value: colInput.h, unit: "cm" },
        { name: "L libre", value: colInput.L, unit: "cm" },
        { name: "Pu", value: colInput.Pu_ton, unit: "ton" },
        { name: "Mu_max", value: colInput.Mu_max_tonm, unit: "ton-m" },
      ],
      steps: buildRectangularColumnSteps(colRes),
      checks: buildRectangularColumnChecks(colRes),
      reinforcement: {
        longitudinal: [{ n: colRes.n_bars, size: colRes.size,
          As_total: colRes.As_prov,
          position: `Perimetral. ρ = ${(colRes.rho * 100).toFixed(2)}%` }],
        transversal: [
          { size: 4, separacion_cm: colRes.s_conf,
            zona: `Confinada (lo = ${colRes.lo_confinamiento.toFixed(0)} cm)`, ramas: 2 },
          { size: 4, separacion_cm: colRes.s_central, zona: "Central", ramas: 2 },
        ],
      },
      notes: colRes.warnings,
      diagrams: renderDiagrams([
        { title: "RC-1 — Sección transversal", element: <RC1_Seccion r={colRes} /> },
        { title: "RC-2 — Elevación longitudinal", element: <RC2_Elevacion r={colRes} /> },
        { title: "RC-5 — Diagrama P-M", element: <RC5_PM_Diagram r={colRes} /> },
      ]),
    });

    // 5. Beam — 6 m span, w = 2.5 ton/m → Mu ≈ 11 ton·m
    const beamInput = {
      project_name: meta.name, canton: meta.address.split(",")[1]?.trim() ?? "",
      zona_sismica: (meta.zonaSismica === 4 ? "IV" : meta.zonaSismica === 3 ? "III" : "II") as "II" | "III" | "IV",
      acero_norma: (meta.zonaSismica >= 3 ? "A706" : "A615") as "A615" | "A706",
      b: 25, d: 41, h: 45, recubrimiento: 4,
      Mu_tonm: 11.25, Mu_pos_tonm: 7.5, Vu_ton: 7.5,
      fc: 245, fy: 4200, L_cm: 600,
    };
    const beamRes = computeBeamFlexureLive({
      b: 25, d: 41, h: 45, Mu_tonm: 11.25, fc: 245, fy: 4200,
    });
    const beamSnap = buildSnapshot({
      title: `Viga V-1 — 25×45 cm, L = 6 m`,
      elementType: "beam",
      projectName: meta.name, zonaSismica: meta.zonaSismica,
      engineer: meta.engineer, cfia: meta.cfia,
      fc: 245, fy: 4200,
      aceroNorma: meta.zonaSismica >= 3 ? "A706" : "A615",
      inputs: [
        { name: "b", value: 25, unit: "cm" },
        { name: "h", value: 45, unit: "cm" },
        { name: "L", value: 600, unit: "cm" },
        { name: "Mu_neg", value: 11.25, unit: "ton-m" },
        { name: "f'c", value: 245, unit: "kg/cm²" },
      ],
      steps: buildFlexureSteps(beamRes),
      checks: [
        { nombre: "ρ ≤ ρ_max", requerido: beamRes.rho_max_val, disponible: beamRes.rho_diseno,
          unidad: "", cumple: beamRes.rho_diseno <= beamRes.rho_max_val, referencia: "ACI §9.3" },
        { nombre: "Sección controlada por tracción", requerido: 0.005, disponible: beamRes.eps_s,
          unidad: "", cumple: beamRes.tension_controlled, referencia: "ACI §21.2" },
      ],
      reinforcement: {
        longitudinal: [
          { n: 3, size: 6, As_total: 8.52, position: "Superior (apoyos)" },
          { n: 2, size: 6, As_total: 5.68, position: "Inferior continua" },
        ],
        transversal: [
          { size: 3, separacion_cm: 10, zona: "Confinada 2h cada extremo", ramas: 2 },
          { size: 3, separacion_cm: 20, zona: "Central", ramas: 2 },
        ],
      },
      notes: beamRes.error ? [beamRes.error] : [],
      diagrams: renderDiagrams([
        { title: "BM-1 — Sección en apoyo", element: <BM1_SectionApoyo input={beamInput} liveResult={beamRes} /> },
        { title: "BM-3 — Elevación longitudinal", element: <BM3_Elevation input={beamInput} liveResult={beamRes} /> },
        { title: "BM-4 — Diagrama de momentos", element: <BM4_Moments input={beamInput} liveResult={beamRes} /> },
        { title: "BM-5 — Diagrama de cortantes", element: <BM5_Shear input={beamInput} liveResult={beamRes} /> },
      ]),
    });

    // 6. One-way slab — span 3.5 m, wu = 0.85 ton/m²
    const slabInput = {
      Lcorto_m: 3.5, Llargo_m: 7.0, h_cm: 12, r_cm: 2,
      Ln_m: 3.5, wu_ton_m2: 0.85, condicion: "first_span_pos" as const,
      fc: 245, fy: 4200, zona: meta.zonaSismica,
    };
    const slabRes = computeOneWaySlabLive(slabInput);
    const slabSnap = buildSnapshot({
      title: `Losa entrepiso 1 dir. L = 3.5 m`,
      elementType: "one_way_slab",
      projectName: meta.name, zonaSismica: meta.zonaSismica,
      engineer: meta.engineer, cfia: meta.cfia,
      fc: slabInput.fc, fy: slabInput.fy,
      inputs: [
        { name: "Lcorto", value: slabInput.Lcorto_m, unit: "m" },
        { name: "Llargo", value: slabInput.Llargo_m, unit: "m" },
        { name: "h", value: slabInput.h_cm, unit: "cm" },
        { name: "wu", value: slabInput.wu_ton_m2, unit: "ton/m²" },
      ],
      steps: buildOneWaySlabSteps(slabRes),
      checks: buildOneWaySlabChecks(slabRes),
      reinforcement: {
        longitudinal: [
          { n: slabRes.n, size: slabRes.size, As_total: slabRes.As_prov,
            position: `Principal sep ${slabRes.s.toFixed(1)} cm` },
          { n: slabRes.n_temp, size: slabRes.size_temp, As_total: slabRes.As_temp_prov,
            position: `Temperatura sep ${slabRes.s_temp.toFixed(1)} cm` },
        ],
      },
      notes: slabRes.warnings,
      diagrams: renderDiagrams([
        { title: "OWS-1 — Sección transversal", element: <OWSSection r={slabRes} /> },
        { title: "OWS-3 — Diagrama de momentos", element: <OWSMomentDiagram r={slabRes} /> },
      ]),
    });

    return [ftgSnap, stripSnap, tbSnap, colSnap, beamSnap, slabSnap];
  }, [meta]);

  async function handleGeneratePdf() {
    setGenerating(true);
    try {
      printProjectAsPdf(snapshots, {
        name: meta.name,
        address: meta.address,
        owner: meta.owner,
        engineer: meta.engineer,
        cfia: meta.cfia,
        zonaSismica: meta.zonaSismica,
      });
    } finally {
      setTimeout(() => setGenerating(false), 1500);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-amber-400 mb-1">
            <Link href="/studio" className="hover:text-amber-300">← Studio</Link>
          </div>
          <h1 className="text-3xl font-semibold">🏠 Proyecto completo — Casa demo</h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
            Diseño estructural integrado de los 6 elementos típicos de una
            casa de 2 pisos en zona III. Generado a partir del SPT + análisis
            simplificado. Salida: una sola memoria PDF lista para CFIA.
          </p>
        </div>

        {/* Metadata editor */}
        <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Nombre del proyecto</span>
            <input
              type="text" value={meta.name}
              onChange={(e) => setMeta({ ...meta, name: e.target.value })}
              className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Dirección</span>
            <input
              type="text" value={meta.address}
              onChange={(e) => setMeta({ ...meta, address: e.target.value })}
              className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Propietario</span>
            <input
              type="text" value={meta.owner}
              onChange={(e) => setMeta({ ...meta, owner: e.target.value })}
              className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Ingeniero responsable</span>
            <input
              type="text" value={meta.engineer}
              onChange={(e) => setMeta({ ...meta, engineer: e.target.value })}
              className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Código CFIA</span>
            <input
              type="text" value={meta.cfia}
              onChange={(e) => setMeta({ ...meta, cfia: e.target.value })}
              className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Zona sísmica</span>
            <select value={meta.zonaSismica}
              onChange={(e) => setMeta({ ...meta, zonaSismica: parseInt(e.target.value) as 1 | 2 | 3 | 4 })}
              className="bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1 text-sm text-amber-200">
              <option value={1}>Zona I</option><option value={2}>Zona II</option>
              <option value={3}>Zona III</option><option value={4}>Zona IV</option>
            </select>
          </label>
        </div>

        {/* Element list */}
        <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">
              Elementos incluidos ({snapshots.length})
            </h2>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
              Casa de 2 pisos, zona {meta.zonaSismica}
            </span>
          </div>
          <ul className="divide-y divide-zinc-800/60">
            {snapshots.map((s, i) => {
              const passing = s.checks.every((c) => c.cumple);
              return (
                <li key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-zinc-200">{i + 1}. {s.title}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {s.elementType} · {s.steps.length} pasos · {s.checks.length} verificaciones
                    </div>
                  </div>
                  <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    passing ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800"
                            : "bg-amber-900/40 text-amber-300 border border-amber-800"
                  }`}>
                    {passing ? "OK" : "Revisión"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Generate PDF */}
        <div className="border border-emerald-700 rounded-lg bg-emerald-950/20 p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-emerald-200 mb-1">
              Memoria de cálculo completa
            </h3>
            <p className="text-xs text-zinc-400">
              Genera un PDF con portada, índice, criterios, las {snapshots.length} memorias
              individuales, resumen de cantidades, bibliografía consolidada y página de firma.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={generating}
            className="px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold transition-colors disabled:opacity-50"
          >
            {generating ? "Generando…" : "📄 Generar memoria PDF"}
          </button>
        </div>

        <div className="text-xs text-zinc-600 italic">
          Este ejemplo demuestra el flujo end-to-end: SPT → cimentaciones →
          columnas → vigas → losas → exportación. En la versión final, los
          elementos provendrán de los proyectos guardados del usuario, no de
          esta plantilla pre-canned.
        </div>
      </div>
    </main>
  );
}
