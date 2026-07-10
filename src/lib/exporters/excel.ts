/**
 * Excel exporter for studio design snapshots — formatted, not bare cells.
 *
 * Uses exceljs so we can apply cell fills, borders, fonts, and merged title
 * cells. Output looks like an actual Hacienda-style memorando — not a CSV
 * dump.
 *
 * Sheets:
 *   1. Portada — title block, project meta, materials, inputs
 *   2. Pasos — every CalculationStep with banded rows + colored result cell
 *   3. Verificaciones — pass/fail table with green/red status fills
 *   4. Refuerzo — longitudinal + transversal tables (optional)
 */

import ExcelJS from "exceljs";
import type { DesignSnapshot } from "./types";

// --- Style tokens (Costaplanner amber + slate) ---
const BRAND_AMBER = "FFB6770F";
const BRAND_AMBER_SOFT = "FFFCE7BC";
const HEADER_FILL = "FF1F2937"; // slate-800
const HEADER_TEXT = "FFE5E7EB";  // slate-200
const BAND_FILL = "FFF8FAFC";    // slate-50
const BORDER_GRAY = "FFCBD5E1";  // slate-300
const PASS_FILL = "FFD1FAE5";    // emerald-100
const FAIL_FILL = "FFFEE2E2";    // red-100
const PASS_TEXT = "FF065F46";    // emerald-800
const FAIL_TEXT = "FF991B1B";    // red-800

function thinBorder(): Partial<ExcelJS.Borders> {
  const s: Partial<ExcelJS.Border> = { style: "thin", color: { argb: BORDER_GRAY } };
  return { top: s, left: s, right: s, bottom: s };
}

function setHeaderRow(ws: ExcelJS.Worksheet, rowIdx: number, labels: string[]) {
  const row = ws.getRow(rowIdx);
  labels.forEach((l, i) => {
    const cell = row.getCell(i + 1);
    cell.value = l;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = thinBorder();
  });
  row.height = 22;
}

function setDataCell(
  cell: ExcelJS.Cell,
  value: string | number,
  opts: { numFmt?: string; align?: "left" | "right" | "center"; band?: boolean } = {},
) {
  cell.value = value;
  cell.font = { name: "Calibri", size: 10, color: { argb: "FF111827" } };
  cell.alignment = { vertical: "middle", horizontal: opts.align ?? "left", wrapText: true };
  cell.border = thinBorder();
  if (opts.numFmt) cell.numFmt = opts.numFmt;
  if (opts.band) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND_FILL } };
  }
}

export async function exportDesignAsExcel(
  snapshot: DesignSnapshot,
  fileName?: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Costaplanner";
  wb.created = new Date();
  wb.title = `${snapshot.title} — Memoria estructural`;

  // -----------------------------------------------------------------------
  // Sheet 1 — Portada
  // -----------------------------------------------------------------------
  const ws1 = wb.addWorksheet("Portada", {
    properties: { defaultRowHeight: 18 },
  });
  ws1.columns = [
    { width: 24 }, { width: 40 }, { width: 16 }, { width: 24 },
  ];

  // Brand block
  ws1.mergeCells("A1:D1");
  const brand = ws1.getCell("A1");
  brand.value = "COSTAPLANNER";
  brand.font = { name: "Calibri", size: 12, bold: true, color: { argb: BRAND_AMBER } };
  brand.alignment = { vertical: "middle" };
  ws1.getRow(1).height = 22;

  ws1.mergeCells("A2:D2");
  const memorando = ws1.getCell("A2");
  memorando.value = "Memoria de cálculo estructural";
  memorando.font = { name: "Calibri", size: 18, bold: true };
  ws1.getRow(2).height = 28;

  ws1.mergeCells("A3:D3");
  const subtitle = ws1.getCell("A3");
  subtitle.value = snapshot.title;
  subtitle.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF6B7280" } };
  ws1.getRow(3).height = 18;

  // Project meta block — 2-column header/value layout
  const metaRows: Array<[string, string | number, string, string | number]> = [
    ["Proyecto", snapshot.project.name, "Cantón", snapshot.project.canton ?? "—"],
    ["Elemento", snapshot.title, "Zona sísmica", String(snapshot.project.zona_sismica ?? "—")],
    ["f'c (kg/cm²)", snapshot.materials.fc, "fy (kg/cm²)", snapshot.materials.fy],
    ["Norma acero", snapshot.materials.acero_norma ?? "—", "Generado", new Date().toLocaleDateString("es-CR")],
    ["Ingeniero", snapshot.project.engineer ?? "_______________________", "CFIA", snapshot.project.cfia_code ?? "_______________"],
  ];

  metaRows.forEach((r, i) => {
    const rIdx = 5 + i;
    const labelA = ws1.getCell(rIdx, 1);
    const valueA = ws1.getCell(rIdx, 2);
    const labelB = ws1.getCell(rIdx, 3);
    const valueB = ws1.getCell(rIdx, 4);

    for (const lbl of [labelA, labelB]) {
      lbl.font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_TEXT } };
      lbl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      lbl.alignment = { vertical: "middle", horizontal: "left" };
      lbl.border = thinBorder();
    }
    labelA.value = r[0];
    labelB.value = r[2];

    for (const v of [valueA, valueB]) {
      v.font = { name: "Calibri", size: 10 };
      v.alignment = { vertical: "middle", horizontal: "left" };
      v.border = thinBorder();
    }
    valueA.value = r[1];
    valueB.value = r[3];
  });

  // Inputs table — title row + header row + data
  const inputsTitleRow = 5 + metaRows.length + 2;
  ws1.mergeCells(inputsTitleRow, 1, inputsTitleRow, 4);
  const inputsTitle = ws1.getCell(inputsTitleRow, 1);
  inputsTitle.value = "Datos de entrada";
  inputsTitle.font = { name: "Calibri", size: 12, bold: true, color: { argb: BRAND_AMBER } };
  inputsTitle.alignment = { vertical: "middle" };

  setHeaderRow(ws1, inputsTitleRow + 1, ["Variable", "Valor", "Unidad", "Origen"]);
  snapshot.inputs.forEach((inp, i) => {
    const rIdx = inputsTitleRow + 2 + i;
    setDataCell(ws1.getCell(rIdx, 1), inp.name, { band: i % 2 === 1 });
    setDataCell(ws1.getCell(rIdx, 2), inp.value as string | number, {
      band: i % 2 === 1,
      align: "right",
      numFmt: typeof inp.value === "number" ? "0.000" : undefined,
    });
    setDataCell(ws1.getCell(rIdx, 3), inp.unit ?? "", { band: i % 2 === 1 });
    setDataCell(ws1.getCell(rIdx, 4), "entrada", { band: i % 2 === 1 });
  });

  // -----------------------------------------------------------------------
  // Sheet 2 — Pasos
  // -----------------------------------------------------------------------
  const ws2 = wb.addWorksheet("Pasos");
  ws2.columns = [
    { width: 5 },   // #
    { width: 34 },  // Nombre
    { width: 44 },  // Ecuación (LaTeX)
    { width: 36 },  // Variables
    { width: 14 },  // Resultado
    { width: 10 },  // Unidad
    { width: 22 },  // Referencia
    { width: 30 },  // Nota
  ];

  ws2.mergeCells("A1:H1");
  const t2 = ws2.getCell("A1");
  t2.value = `${snapshot.title} — Procedimiento`;
  t2.font = { name: "Calibri", size: 14, bold: true };
  t2.alignment = { vertical: "middle" };
  ws2.getRow(1).height = 26;

  setHeaderRow(ws2, 2, [
    "#", "Paso", "Ecuación", "Variables", "Resultado", "Unidad", "Referencia", "Nota",
  ]);

  snapshot.steps.forEach((s, i) => {
    const rIdx = 3 + i;
    const band = i % 2 === 1;
    setDataCell(ws2.getCell(rIdx, 1), i + 1, { band, align: "center" });
    setDataCell(ws2.getCell(rIdx, 2), s.name, { band });
    setDataCell(ws2.getCell(rIdx, 3), s.equation_latex, { band });

    const varsStr = Object.entries(s.inputs)
      .map(([k, v]) => `${k} = ${typeof v === "number" ? v.toFixed(4) : v}`)
      .join(", ");
    setDataCell(ws2.getCell(rIdx, 4), varsStr, { band });

    const resultCell = ws2.getCell(rIdx, 5);
    resultCell.value = typeof s.output_value === "number"
      ? Number(s.output_value.toFixed(4))
      : s.output_value;
    resultCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: PASS_TEXT } };
    resultCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PASS_FILL } };
    resultCell.alignment = { vertical: "middle", horizontal: "right" };
    resultCell.border = thinBorder();
    resultCell.numFmt = "0.0000";

    setDataCell(ws2.getCell(rIdx, 6), s.output_unit, { band, align: "center" });
    setDataCell(ws2.getCell(rIdx, 7), s.code_ref, { band });
    setDataCell(ws2.getCell(rIdx, 8), s.note ?? "", { band });

    ws2.getRow(rIdx).height = Math.max(20, Math.min(60, 16 + varsStr.length / 6));
  });

  // Freeze header row
  ws2.views = [{ state: "frozen", ySplit: 2 }];

  // -----------------------------------------------------------------------
  // Sheet 3 — Verificaciones
  // -----------------------------------------------------------------------
  const ws3 = wb.addWorksheet("Verificaciones");
  ws3.columns = [
    { width: 42 }, // Verificación
    { width: 16 }, // Requerido
    { width: 16 }, // Disponible
    { width: 10 }, // Unidad
    { width: 10 }, // Cumple
    { width: 24 }, // Referencia
  ];

  ws3.mergeCells("A1:F1");
  const t3 = ws3.getCell("A1");
  t3.value = `${snapshot.title} — Verificaciones`;
  t3.font = { name: "Calibri", size: 14, bold: true };
  t3.alignment = { vertical: "middle" };
  ws3.getRow(1).height = 26;

  setHeaderRow(ws3, 2, [
    "Verificación", "Requerido", "Disponible", "Unidad", "Cumple", "Referencia",
  ]);

  snapshot.checks.forEach((c, i) => {
    const rIdx = 3 + i;
    const band = i % 2 === 1;
    setDataCell(ws3.getCell(rIdx, 1), c.nombre, { band });
    setDataCell(ws3.getCell(rIdx, 2), Number(c.requerido.toFixed(4)), {
      band, align: "right", numFmt: "0.0000",
    });
    setDataCell(ws3.getCell(rIdx, 3), Number(c.disponible.toFixed(4)), {
      band, align: "right", numFmt: "0.0000",
    });
    setDataCell(ws3.getCell(rIdx, 4), c.unidad, { band, align: "center" });

    const statusCell = ws3.getCell(rIdx, 5);
    statusCell.value = c.cumple ? "✓ CUMPLE" : "✗ FALLA";
    statusCell.font = {
      name: "Calibri", size: 10, bold: true,
      color: { argb: c.cumple ? PASS_TEXT : FAIL_TEXT },
    };
    statusCell.fill = {
      type: "pattern", pattern: "solid",
      fgColor: { argb: c.cumple ? PASS_FILL : FAIL_FILL },
    };
    statusCell.alignment = { vertical: "middle", horizontal: "center" };
    statusCell.border = thinBorder();

    setDataCell(ws3.getCell(rIdx, 6), c.referencia, { band });
  });

  ws3.views = [{ state: "frozen", ySplit: 2 }];

  // -----------------------------------------------------------------------
  // Sheet 4 — Refuerzo (optional)
  // -----------------------------------------------------------------------
  if (snapshot.reinforcement) {
    const ws4 = wb.addWorksheet("Refuerzo");
    ws4.columns = [
      { width: 10 }, { width: 14 }, { width: 16 }, { width: 30 },
    ];

    ws4.mergeCells("A1:D1");
    const t4 = ws4.getCell("A1");
    t4.value = `${snapshot.title} — Refuerzo`;
    t4.font = { name: "Calibri", size: 14, bold: true };
    ws4.getRow(1).height = 26;

    let cursor = 3;
    if (snapshot.reinforcement.longitudinal?.length) {
      ws4.mergeCells(cursor, 1, cursor, 4);
      const sec = ws4.getCell(cursor, 1);
      sec.value = "Longitudinal";
      sec.font = { name: "Calibri", size: 12, bold: true, color: { argb: BRAND_AMBER } };
      cursor++;

      setHeaderRow(ws4, cursor, ["# barras", "Tamaño", "As total (cm²)", "Posición"]);
      cursor++;
      snapshot.reinforcement.longitudinal.forEach((bar, i) => {
        const band = i % 2 === 1;
        setDataCell(ws4.getCell(cursor, 1), bar.n, { band, align: "center" });
        setDataCell(ws4.getCell(cursor, 2), `#${bar.size}`, { band, align: "center" });
        setDataCell(ws4.getCell(cursor, 3), Number(bar.As_total.toFixed(2)), {
          band, align: "right", numFmt: "0.00",
        });
        setDataCell(ws4.getCell(cursor, 4), bar.position ?? "", { band });
        cursor++;
      });
      cursor++;
    }

    if (snapshot.reinforcement.transversal?.length) {
      ws4.mergeCells(cursor, 1, cursor, 4);
      const sec = ws4.getCell(cursor, 1);
      sec.value = "Transversal (estribos)";
      sec.font = { name: "Calibri", size: 12, bold: true, color: { argb: BRAND_AMBER } };
      cursor++;

      setHeaderRow(ws4, cursor, ["Tamaño", "Separación (cm)", "Ramas", "Zona"]);
      cursor++;
      snapshot.reinforcement.transversal.forEach((stir, i) => {
        const band = i % 2 === 1;
        setDataCell(ws4.getCell(cursor, 1), `#${stir.size}`, { band, align: "center" });
        setDataCell(ws4.getCell(cursor, 2), Number(stir.separacion.toFixed(1)), {
          band, align: "right", numFmt: "0.0",
        });
        setDataCell(ws4.getCell(cursor, 3), stir.ramas, { band, align: "center" });
        setDataCell(ws4.getCell(cursor, 4), stir.zona, { band });
        cursor++;
      });
    }
  }

  // -----------------------------------------------------------------------
  // Save / download
  // -----------------------------------------------------------------------
  const safeProject = snapshot.project.name.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const safeElement = snapshot.title.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const finalName = fileName ?? `costaplanner_${safeProject}_${safeElement}.xlsx`;

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
