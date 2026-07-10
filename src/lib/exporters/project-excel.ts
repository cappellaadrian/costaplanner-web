/**
 * Project-level Excel exporter — "Memoria de cálculo completa" as a workbook.
 *
 * Mirrors what `printProjectAsPdf` produces (cover + criteria + per-element
 * detail + quantities + bibliography) but emits a single .xlsx file. Per
 * element gets its own worksheet so engineers can pivot/filter/etc.
 *
 * Sheet layout (in order):
 *   1.  Portada            — project meta + design count
 *   2.  Resumen            — one row per element (#, type, status, counts)
 *   3.  Cargas y materiales — project-wide f'c, fy, qa, zona sísmica, …
 *   4…N. <element slug>     — per-element full detail (inputs/steps/checks/refuerzo)
 *   N+1. Cantidades         — aggregated rebar + concrete + formwork totals
 *   N+2. Bibliografía       — dedup'd code_refs + bundled CR/intl references
 *
 * Style: emerald (success) + amber (Costaplanner brand) on a slate-200 grid.
 * Bold header rows, frozen first row on every detail sheet, auto-ish widths
 * via fixed column declarations.
 *
 * The per-element Excel exporter at `excel.ts` is untouched — this file is
 * the project roll-up only.
 */

import ExcelJS from "exceljs";
import type { DesignSnapshot } from "./types";

// ─── Style tokens (brand: emerald primary + amber accent) ──────────────────
const BRAND_AMBER = "FFB6770F";
const BRAND_EMERALD = "FF065F46";       // emerald-800 (body accents)
const BRAND_EMERALD_DARK = "FF064E3B";  // emerald-900 (header fill)
const HEADER_FILL = "FF064E3B";         // emerald-900
const HEADER_TEXT = "FFECFDF5";         // emerald-50
const SECTION_FILL = "FFFEF3C7";        // amber-100 (section banners)
const SECTION_TEXT = "FF92400E";        // amber-800
const BAND_FILL = "FFF0FDF4";           // emerald-50
const BORDER_GRAY = "FFCBD5E1";         // slate-300
const PASS_FILL = "FFD1FAE5";           // emerald-100
const FAIL_FILL = "FFFEE2E2";           // red-100
const PASS_TEXT = "FF065F46";           // emerald-800
const FAIL_TEXT = "FF991B1B";           // red-800
const META_LABEL_FILL = "FF1F2937";     // slate-800
const META_LABEL_TEXT = "FFE5E7EB";     // slate-200

// ─── Tiny styling helpers ──────────────────────────────────────────────────

function thinBorder(): Partial<ExcelJS.Borders> {
  const s: Partial<ExcelJS.Border> = {
    style: "thin",
    color: { argb: BORDER_GRAY },
  };
  return { top: s, left: s, right: s, bottom: s };
}

function setHeaderRow(
  ws: ExcelJS.Worksheet,
  rowIdx: number,
  labels: string[],
) {
  const row = ws.getRow(rowIdx);
  labels.forEach((l, i) => {
    const cell = row.getCell(i + 1);
    cell.value = l;
    cell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: HEADER_TEXT },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = thinBorder();
  });
  row.height = 22;
}

function setSectionBanner(
  ws: ExcelJS.Worksheet,
  rowIdx: number,
  colSpan: number,
  text: string,
) {
  ws.mergeCells(rowIdx, 1, rowIdx, colSpan);
  const cell = ws.getCell(rowIdx, 1);
  cell.value = text;
  cell.font = {
    name: "Calibri",
    size: 12,
    bold: true,
    color: { argb: SECTION_TEXT },
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: SECTION_FILL },
  };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(rowIdx).height = 22;
}

function setDataCell(
  cell: ExcelJS.Cell,
  value: string | number,
  opts: {
    numFmt?: string;
    align?: "left" | "right" | "center";
    band?: boolean;
    bold?: boolean;
  } = {},
) {
  cell.value = value;
  cell.font = {
    name: "Calibri",
    size: 10,
    bold: !!opts.bold,
    color: { argb: "FF111827" },
  };
  cell.alignment = {
    vertical: "middle",
    horizontal: opts.align ?? "left",
    wrapText: true,
  };
  cell.border = thinBorder();
  if (opts.numFmt) cell.numFmt = opts.numFmt;
  if (opts.band) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BAND_FILL },
    };
  }
}

function setMetaPair(
  ws: ExcelJS.Worksheet,
  rowIdx: number,
  label: string,
  value: string | number,
) {
  const lblCell = ws.getCell(rowIdx, 1);
  lblCell.value = label;
  lblCell.font = {
    name: "Calibri",
    size: 10,
    bold: true,
    color: { argb: META_LABEL_TEXT },
  };
  lblCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: META_LABEL_FILL },
  };
  lblCell.alignment = { vertical: "middle", horizontal: "left" };
  lblCell.border = thinBorder();

  const valCell = ws.getCell(rowIdx, 2);
  valCell.value = value;
  valCell.font = { name: "Calibri", size: 10 };
  valCell.alignment = { vertical: "middle", horizontal: "left" };
  valCell.border = thinBorder();
}

// Excel sheet names: 31-char max, no : \ / ? * [ ]
function safeSheetName(raw: string, used: Set<string>): string {
  let name = raw.replace(/[:\\/?*[\]]/g, "_").slice(0, 31);
  if (!name.trim()) name = "Hoja";
  let candidate = name;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = `_${i}`;
    candidate = `${name.slice(0, 31 - suffix.length)}${suffix}`;
    i += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

// ─── Rebar aggregation (mirrors project-pdf.ts approach) ───────────────────

const BAR_KG_M: Record<number, number> = {
  3: 0.560, 4: 0.994, 5: 1.552, 6: 2.235, 7: 3.042,
  8: 3.973, 9: 5.060, 10: 6.404, 11: 7.907,
};

interface RebarTotalRow {
  size: number;
  total_kg: number;
}

/** Cross-element rebar takeoff — same heuristic as project-pdf.aggregateRebar.
 *  Kept local to this file to avoid changing the PDF exporter's surface. */
function aggregateRebar(snapshots: DesignSnapshot[]): RebarTotalRow[] {
  const bySize = new Map<number, number>();
  for (const s of snapshots) {
    for (const b of s.reinforcement?.longitudinal ?? []) {
      const m_est = (b.As_total / 2) * 1.0; // crude proxy
      const kg = m_est * (BAR_KG_M[b.size] ?? 1);
      bySize.set(b.size, (bySize.get(b.size) ?? 0) + kg);
    }
    for (const t of s.reinforcement?.transversal ?? []) {
      const m_est = 3.0; // ~3 m per element guess
      const kg = m_est * (BAR_KG_M[t.size] ?? 1);
      bySize.set(t.size, (bySize.get(t.size) ?? 0) + kg);
    }
  }
  const rows: RebarTotalRow[] = [];
  bySize.forEach((kg, size) => rows.push({ size, total_kg: kg }));
  return rows.sort((a, b) => a.size - b.size);
}

function uniqueRefs(snapshots: DesignSnapshot[]): string[] {
  const set = new Set<string>();
  for (const s of snapshots) {
    for (const step of s.steps) {
      if (step.code_ref) set.add(step.code_ref);
    }
    for (const c of s.checks) {
      if (c.referencia) set.add(c.referencia);
    }
  }
  return Array.from(set).sort();
}

// ─── Public meta type ──────────────────────────────────────────────────────

export interface ProjectExcelMeta {
  name: string;
  address?: string;
  owner?: string;
  engineer?: string;
  cfia?: string;
  zonaSismica?: number | string;
  // Project-wide structural defaults (Sheet 3 — Cargas y materiales)
  fc?: number;
  fy?: number;
  qa_ton_m2?: number;
  phi_deg?: number;
  c_kPa?: number;
  gamma_kN_m3?: number;
  numFloors?: number;
  grossArea_m2?: number;
  structuralSystem?: string;
  buildingUse?: string;
}

// ─── Main export ───────────────────────────────────────────────────────────

export async function exportProjectAsExcel(
  snapshots: DesignSnapshot[],
  projectMeta: ProjectExcelMeta,
  fileName?: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Costaplanner";
  wb.created = new Date();
  wb.title = `${projectMeta.name} — Memoria estructural`;

  const usedSheetNames = new Set<string>();
  const reserve = (name: string) => safeSheetName(name, usedSheetNames);

  // ─────────────────────────────────────────────────────────────────────────
  // Sheet 1 — Portada
  // ─────────────────────────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet(reserve("Portada"), {
    properties: { defaultRowHeight: 18 },
  });
  ws1.columns = [{ width: 28 }, { width: 52 }];

  // Brand line
  ws1.mergeCells("A1:B1");
  const brand = ws1.getCell("A1");
  brand.value = "COSTAPLANNER";
  brand.font = {
    name: "Calibri",
    size: 12,
    bold: true,
    color: { argb: BRAND_AMBER },
  };
  brand.alignment = { vertical: "middle" };
  ws1.getRow(1).height = 22;

  ws1.mergeCells("A2:B2");
  const title = ws1.getCell("A2");
  title.value = "Memoria de cálculo estructural";
  title.font = { name: "Calibri", size: 20, bold: true };
  ws1.getRow(2).height = 32;

  ws1.mergeCells("A3:B3");
  const subtitle = ws1.getCell("A3");
  subtitle.value = projectMeta.name;
  subtitle.font = {
    name: "Calibri",
    size: 12,
    italic: true,
    color: { argb: BRAND_EMERALD },
  };
  ws1.getRow(3).height = 20;

  const date = new Date().toLocaleDateString("es-CR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Meta block — vertical 2-column layout (label / value)
  let r = 5;
  setMetaPair(ws1, r++, "Proyecto", projectMeta.name);
  setMetaPair(ws1, r++, "Dirección", projectMeta.address ?? "—");
  setMetaPair(ws1, r++, "Propietario", projectMeta.owner ?? "—");
  setMetaPair(ws1, r++, "Ingeniero", projectMeta.engineer ?? "—");
  setMetaPair(ws1, r++, "CFIA", projectMeta.cfia ?? "—");
  setMetaPair(
    ws1,
    r++,
    "Zona sísmica",
    String(projectMeta.zonaSismica ?? "—"),
  );
  setMetaPair(ws1, r++, "Fecha de generación", date);
  setMetaPair(ws1, r++, "Cantidad de diseños", snapshots.length);

  // ─────────────────────────────────────────────────────────────────────────
  // Sheet 2 — Resumen
  // ─────────────────────────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet(reserve("Resumen"));
  ws2.columns = [
    { width: 5 },   // #
    { width: 20 },  // Tipo
    { width: 36 },  // Título
    { width: 14 },  // Status
    { width: 12 },  // # Inputs
    { width: 12 },  // # Steps
    { width: 16 },  // Checks pasados
    { width: 16 },  // Checks fallidos
  ];
  ws2.mergeCells("A1:H1");
  const t2 = ws2.getCell("A1");
  t2.value = `${projectMeta.name} — Resumen de elementos`;
  t2.font = { name: "Calibri", size: 14, bold: true };
  ws2.getRow(1).height = 26;

  setHeaderRow(ws2, 2, [
    "#",
    "Tipo",
    "Título",
    "Status",
    "# Inputs",
    "# Steps",
    "# Checks pasados",
    "# Checks fallidos",
  ]);

  snapshots.forEach((s, i) => {
    const rowIdx = 3 + i;
    const band = i % 2 === 1;
    const passed = s.checks.filter((c) => c.cumple).length;
    const failed = s.checks.filter((c) => !c.cumple).length;
    const status =
      s.checks.length === 0 ? "Sin checks" : failed === 0 ? "CUMPLE" : "Revisión";

    setDataCell(ws2.getCell(rowIdx, 1), i + 1, { band, align: "center" });
    setDataCell(ws2.getCell(rowIdx, 2), s.elementType, { band });
    setDataCell(ws2.getCell(rowIdx, 3), s.title, { band });

    // Status cell with color
    const statusCell = ws2.getCell(rowIdx, 4);
    statusCell.value = status;
    statusCell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: {
        argb:
          status === "CUMPLE"
            ? PASS_TEXT
            : status === "Revisión"
              ? FAIL_TEXT
              : "FF6B7280",
      },
    };
    statusCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb:
          status === "CUMPLE"
            ? PASS_FILL
            : status === "Revisión"
              ? FAIL_FILL
              : "FFF3F4F6",
      },
    };
    statusCell.alignment = { vertical: "middle", horizontal: "center" };
    statusCell.border = thinBorder();

    setDataCell(ws2.getCell(rowIdx, 5), s.inputs.length, {
      band,
      align: "right",
    });
    setDataCell(ws2.getCell(rowIdx, 6), s.steps.length, {
      band,
      align: "right",
    });
    setDataCell(ws2.getCell(rowIdx, 7), passed, { band, align: "right" });
    setDataCell(ws2.getCell(rowIdx, 8), failed, { band, align: "right" });
  });

  ws2.views = [{ state: "frozen", ySplit: 2 }];

  // ─────────────────────────────────────────────────────────────────────────
  // Sheet 3 — Cargas y materiales
  // ─────────────────────────────────────────────────────────────────────────
  const ws3 = wb.addWorksheet(reserve("Cargas y materiales"));
  ws3.columns = [{ width: 30 }, { width: 22 }, { width: 12 }];

  ws3.mergeCells("A1:C1");
  const t3 = ws3.getCell("A1");
  t3.value = `${projectMeta.name} — Cargas y materiales`;
  t3.font = { name: "Calibri", size: 14, bold: true };
  ws3.getRow(1).height = 26;

  setHeaderRow(ws3, 2, ["Parámetro", "Valor", "Unidad"]);

  // Pick a reasonable f'c / fy fallback by looking at the first snapshot.
  const fcFallback = snapshots[0]?.materials.fc;
  const fyFallback = snapshots[0]?.materials.fy;

  const matRows: Array<[string, string | number, string]> = [
    ["f'c (resistencia del concreto)", projectMeta.fc ?? fcFallback ?? "—", "kg/cm²"],
    ["fy (fluencia del acero)", projectMeta.fy ?? fyFallback ?? "—", "kg/cm²"],
    ["Zona sísmica", projectMeta.zonaSismica ?? "—", "—"],
    ["qa (capacidad portante admisible)", projectMeta.qa_ton_m2 ?? "—", "ton/m²"],
    ["φ (ángulo de fricción interna)", projectMeta.phi_deg ?? "—", "°"],
    ["c (cohesión)", projectMeta.c_kPa ?? "—", "kPa"],
    ["γ (peso unitario del suelo)", projectMeta.gamma_kN_m3 ?? "—", "kN/m³"],
    ["# pisos", projectMeta.numFloors ?? "—", "—"],
    ["Área bruta", projectMeta.grossArea_m2 ?? "—", "m²"],
    ["Sistema estructural", projectMeta.structuralSystem ?? "—", "—"],
    ["Uso de edificación", projectMeta.buildingUse ?? "—", "—"],
  ];

  matRows.forEach((row, i) => {
    const rIdx = 3 + i;
    const band = i % 2 === 1;
    setDataCell(ws3.getCell(rIdx, 1), row[0], { band, bold: true });
    setDataCell(ws3.getCell(rIdx, 2), row[1], {
      band,
      align: "right",
      numFmt: typeof row[1] === "number" ? "0.00" : undefined,
    });
    setDataCell(ws3.getCell(rIdx, 3), row[2], { band, align: "center" });
  });

  ws3.views = [{ state: "frozen", ySplit: 2 }];

  // ─────────────────────────────────────────────────────────────────────────
  // Sheets 4..N — one per element
  // ─────────────────────────────────────────────────────────────────────────
  snapshots.forEach((s, idx) => {
    const rawName = `${idx + 1}_${s.elementType || s.title}`;
    const sheetName = reserve(rawName);
    const ws = wb.addWorksheet(sheetName);

    // Wide columns: name(40), value(20), unit(10), ref/note(28), extra(28)
    ws.columns = [
      { width: 6 },   // #
      { width: 36 },  // Paso / variable
      { width: 40 },  // Ecuación / valor
      { width: 30 },  // Variables
      { width: 14 },  // Resultado
      { width: 10 },  // Unidad
      { width: 22 },  // Referencia
      { width: 28 },  // Nota
    ];

    // Title row
    ws.mergeCells("A1:H1");
    const tEl = ws.getCell("A1");
    tEl.value = `${idx + 1}. ${s.title}`;
    tEl.font = { name: "Calibri", size: 14, bold: true };
    tEl.alignment = { vertical: "middle" };
    ws.getRow(1).height = 26;

    // Element meta strip
    ws.mergeCells("A2:H2");
    const tMeta = ws.getCell("A2");
    tMeta.value = `Tipo: ${s.elementType}  ·  f'c = ${s.materials.fc} kg/cm²  ·  fy = ${s.materials.fy} kg/cm²  ·  Acero: ${s.materials.acero_norma ?? "—"}`;
    tMeta.font = {
      name: "Calibri",
      size: 10,
      italic: true,
      color: { argb: BRAND_EMERALD_DARK },
    };
    ws.getRow(2).height = 18;

    let cursor = 4;

    // ── Inputs ────────────────────────────────────────────────────────────
    setSectionBanner(ws, cursor++, 8, "Datos de entrada");
    setHeaderRow(ws, cursor, ["Variable", "Valor", "Unidad", "Origen"]);
    // Span variable col across cols 2..(use first 4 cols only here)
    cursor++;
    if (s.inputs.length === 0) {
      ws.mergeCells(cursor, 1, cursor, 8);
      const empty = ws.getCell(cursor, 1);
      empty.value = "(sin datos)";
      empty.font = { italic: true, color: { argb: "FF9CA3AF" } };
      empty.alignment = { horizontal: "left" };
      empty.border = thinBorder();
      cursor++;
    } else {
      s.inputs.forEach((inp, i) => {
        const band = i % 2 === 1;
        setDataCell(ws.getCell(cursor, 1), inp.name, { band });
        setDataCell(ws.getCell(cursor, 2), inp.value as string | number, {
          band,
          align: "right",
          numFmt: typeof inp.value === "number" ? "0.000" : undefined,
        });
        setDataCell(ws.getCell(cursor, 3), inp.unit ?? "", { band });
        setDataCell(ws.getCell(cursor, 4), "entrada", { band });
        cursor++;
      });
    }
    cursor++; // spacer

    // ── Steps ─────────────────────────────────────────────────────────────
    setSectionBanner(ws, cursor++, 8, "Procedimiento de cálculo");
    setHeaderRow(ws, cursor, [
      "#",
      "Paso",
      "Ecuación",
      "Variables",
      "Resultado",
      "Unidad",
      "Referencia",
      "Nota",
    ]);
    cursor++;
    if (s.steps.length === 0) {
      ws.mergeCells(cursor, 1, cursor, 8);
      const empty = ws.getCell(cursor, 1);
      empty.value = "(no se reconstruyeron pasos para este elemento)";
      empty.font = { italic: true, color: { argb: "FF9CA3AF" } };
      empty.border = thinBorder();
      cursor++;
    } else {
      s.steps.forEach((step, i) => {
        const band = i % 2 === 1;
        setDataCell(ws.getCell(cursor, 1), i + 1, { band, align: "center" });
        setDataCell(ws.getCell(cursor, 2), step.name, { band });
        setDataCell(ws.getCell(cursor, 3), step.equation_latex, { band });
        const varsStr = Object.entries(step.inputs)
          .map(
            ([k, v]) =>
              `${k} = ${typeof v === "number" ? v.toFixed(4) : v}`,
          )
          .join(", ");
        setDataCell(ws.getCell(cursor, 4), varsStr, { band });

        // Result cell — highlight emerald
        const resCell = ws.getCell(cursor, 5);
        resCell.value =
          typeof step.output_value === "number"
            ? Number(step.output_value.toFixed(4))
            : step.output_value;
        resCell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: PASS_TEXT },
        };
        resCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: PASS_FILL },
        };
        resCell.alignment = { vertical: "middle", horizontal: "right" };
        resCell.border = thinBorder();
        resCell.numFmt = "0.0000";

        setDataCell(ws.getCell(cursor, 6), step.output_unit, {
          band,
          align: "center",
        });
        setDataCell(ws.getCell(cursor, 7), step.code_ref, { band });
        setDataCell(ws.getCell(cursor, 8), step.note ?? "", { band });

        // Hint a taller row when the variable list is long
        ws.getRow(cursor).height = Math.max(
          20,
          Math.min(60, 16 + varsStr.length / 6),
        );

        cursor++;
      });
    }
    cursor++;

    // ── Checks ────────────────────────────────────────────────────────────
    setSectionBanner(ws, cursor++, 8, "Verificaciones");
    setHeaderRow(ws, cursor, [
      "Verificación",
      "Requerido",
      "Disponible",
      "Unidad",
      "Cumple",
      "Referencia",
    ]);
    cursor++;
    if (s.checks.length === 0) {
      ws.mergeCells(cursor, 1, cursor, 8);
      const empty = ws.getCell(cursor, 1);
      empty.value = "(no se generaron verificaciones)";
      empty.font = { italic: true, color: { argb: "FF9CA3AF" } };
      empty.border = thinBorder();
      cursor++;
    } else {
      s.checks.forEach((c, i) => {
        const band = i % 2 === 1;
        setDataCell(ws.getCell(cursor, 1), c.nombre, { band });
        setDataCell(ws.getCell(cursor, 2), Number(c.requerido.toFixed(4)), {
          band,
          align: "right",
          numFmt: "0.0000",
        });
        setDataCell(ws.getCell(cursor, 3), Number(c.disponible.toFixed(4)), {
          band,
          align: "right",
          numFmt: "0.0000",
        });
        setDataCell(ws.getCell(cursor, 4), c.unidad, {
          band,
          align: "center",
        });

        const statusCell = ws.getCell(cursor, 5);
        statusCell.value = c.cumple ? "✓ CUMPLE" : "✗ FALLA";
        statusCell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: c.cumple ? PASS_TEXT : FAIL_TEXT },
        };
        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: c.cumple ? PASS_FILL : FAIL_FILL },
        };
        statusCell.alignment = { vertical: "middle", horizontal: "center" };
        statusCell.border = thinBorder();

        setDataCell(ws.getCell(cursor, 6), c.referencia, { band });
        cursor++;
      });
    }
    cursor++;

    // ── Reinforcement (optional) ──────────────────────────────────────────
    if (s.reinforcement) {
      if (s.reinforcement.longitudinal?.length) {
        setSectionBanner(ws, cursor++, 8, "Refuerzo longitudinal");
        setHeaderRow(ws, cursor, [
          "# barras",
          "Tamaño",
          "As total (cm²)",
          "Posición",
        ]);
        cursor++;
        s.reinforcement.longitudinal.forEach((bar, i) => {
          const band = i % 2 === 1;
          setDataCell(ws.getCell(cursor, 1), bar.n, { band, align: "center" });
          setDataCell(ws.getCell(cursor, 2), `#${bar.size}`, {
            band,
            align: "center",
          });
          setDataCell(
            ws.getCell(cursor, 3),
            Number(bar.As_total.toFixed(2)),
            { band, align: "right", numFmt: "0.00" },
          );
          setDataCell(ws.getCell(cursor, 4), bar.position ?? "", { band });
          cursor++;
        });
        cursor++;
      }

      if (s.reinforcement.transversal?.length) {
        setSectionBanner(ws, cursor++, 8, "Refuerzo transversal (estribos)");
        setHeaderRow(ws, cursor, [
          "Tamaño",
          "Separación (cm)",
          "Ramas",
          "Zona",
        ]);
        cursor++;
        s.reinforcement.transversal.forEach((stir, i) => {
          const band = i % 2 === 1;
          setDataCell(ws.getCell(cursor, 1), `#${stir.size}`, {
            band,
            align: "center",
          });
          setDataCell(
            ws.getCell(cursor, 2),
            Number(stir.separacion.toFixed(1)),
            { band, align: "right", numFmt: "0.0" },
          );
          setDataCell(ws.getCell(cursor, 3), stir.ramas, {
            band,
            align: "center",
          });
          setDataCell(ws.getCell(cursor, 4), stir.zona, { band });
          cursor++;
        });
      }
    }

    ws.views = [{ state: "frozen", ySplit: 2 }];
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Sheet N+1 — Cantidades
  // ─────────────────────────────────────────────────────────────────────────
  const wsQ = wb.addWorksheet(reserve("Cantidades"));
  wsQ.columns = [{ width: 14 }, { width: 22 }, { width: 12 }];

  wsQ.mergeCells("A1:C1");
  const tQ = wsQ.getCell("A1");
  tQ.value = `${projectMeta.name} — Resumen de cantidades`;
  tQ.font = { name: "Calibri", size: 14, bold: true };
  wsQ.getRow(1).height = 26;

  // Hint about heuristic
  wsQ.mergeCells("A2:C2");
  const hint = wsQ.getCell("A2");
  hint.value =
    "Estimación indicativa basada en As provista por elemento. NO sustituye el cómputo detallado por planos.";
  hint.font = { italic: true, color: { argb: "FF6B7280" } };
  wsQ.getRow(2).height = 16;

  setHeaderRow(wsQ, 4, ["Tamaño", "Total estimado", "Unidad"]);

  const rebarRows = aggregateRebar(snapshots);
  let totalKg = 0;
  rebarRows.forEach((row, i) => {
    const rIdx = 5 + i;
    const band = i % 2 === 1;
    setDataCell(wsQ.getCell(rIdx, 1), `Ø #${row.size}`, {
      band,
      align: "center",
    });
    setDataCell(wsQ.getCell(rIdx, 2), Number(row.total_kg.toFixed(1)), {
      band,
      align: "right",
      numFmt: "0.0",
    });
    setDataCell(wsQ.getCell(rIdx, 3), "kg", { band, align: "center" });
    totalKg += row.total_kg;
  });

  // Total row
  const totalRow = 5 + rebarRows.length;
  setDataCell(wsQ.getCell(totalRow, 1), "TOTAL acero", { bold: true });
  setDataCell(wsQ.getCell(totalRow, 2), Number(totalKg.toFixed(1)), {
    bold: true,
    align: "right",
    numFmt: "0.0",
  });
  setDataCell(wsQ.getCell(totalRow, 3), "kg", { bold: true, align: "center" });

  // (Optional concrete / formwork totals could go here — left for future
  //  when extractQuantities expands beyond beams.)

  wsQ.views = [{ state: "frozen", ySplit: 4 }];

  // ─────────────────────────────────────────────────────────────────────────
  // Sheet N+2 — Bibliografía
  // ─────────────────────────────────────────────────────────────────────────
  const wsB = wb.addWorksheet(reserve("Bibliografía"));
  wsB.columns = [{ width: 8 }, { width: 80 }];

  wsB.mergeCells("A1:B1");
  const tB = wsB.getCell("A1");
  tB.value = "Bibliografía consolidada";
  tB.font = { name: "Calibri", size: 14, bold: true };
  wsB.getRow(1).height = 26;

  let bRow = 3;

  // Refs from step.code_ref and check.referencia
  setSectionBanner(wsB, bRow++, 2, "Referencias citadas en los cálculos");
  setHeaderRow(wsB, bRow++, ["#", "Referencia"]);

  const refs = uniqueRefs(snapshots);
  if (refs.length === 0) {
    wsB.mergeCells(bRow, 1, bRow, 2);
    const empty = wsB.getCell(bRow, 1);
    empty.value = "(ninguna)";
    empty.font = { italic: true, color: { argb: "FF9CA3AF" } };
    empty.border = thinBorder();
    bRow++;
  } else {
    refs.forEach((ref, i) => {
      const band = i % 2 === 1;
      setDataCell(wsB.getCell(bRow, 1), i + 1, { band, align: "center" });
      setDataCell(wsB.getCell(bRow, 2), ref, { band });
      bRow++;
    });
  }

  bRow++;

  // Bundled CR references (mirrors what /codigo would supply)
  setSectionBanner(wsB, bRow++, 2, "Códigos costarricenses aplicados");
  const crRefs = [
    "CSCR-10 Rev. 2014 — Código Sísmico de Costa Rica",
    "Código de Cimentaciones de Costa Rica (2009) — CFIA",
    "INTE C85:2017 — Concreto estructural",
    "Ley 833 de Construcciones y su Reglamento",
  ];
  crRefs.forEach((ref, i) => {
    const band = i % 2 === 1;
    setDataCell(wsB.getCell(bRow, 1), i + 1, { band, align: "center" });
    setDataCell(wsB.getCell(bRow, 2), ref, { band });
    bRow++;
  });

  bRow++;

  setSectionBanner(wsB, bRow++, 2, "Códigos internacionales adoptados");
  const intlRefs = [
    "ACI 318-14 — Building Code Requirements for Structural Concrete",
    "ASCE 7-16 — Minimum Design Loads",
    "ASTM A615/A706 — Standard Specifications for Deformed Bars",
  ];
  intlRefs.forEach((ref, i) => {
    const band = i % 2 === 1;
    setDataCell(wsB.getCell(bRow, 1), i + 1, { band, align: "center" });
    setDataCell(wsB.getCell(bRow, 2), ref, { band });
    bRow++;
  });

  wsB.views = [{ state: "frozen", ySplit: 2 }];

  // ─────────────────────────────────────────────────────────────────────────
  // Save / download
  // ─────────────────────────────────────────────────────────────────────────
  const safeProject = projectMeta.name.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const dateSlug = new Date().toISOString().slice(0, 10);
  const finalName =
    fileName ?? `costaplanner_${safeProject}_memoria_${dateSlug}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
