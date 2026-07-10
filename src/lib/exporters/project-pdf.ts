/**
 * Multi-element project PDF exporter — "Memoria de cálculo completa".
 *
 * Takes N DesignSnapshots (one per structural element) plus project
 * metadata and emits a single printable HTML document with:
 *   1. Cover page — title, project name, address, engineer + CFIA stamp slot
 *   2. Tabla de contenido — list of elements + page anchors
 *   3. Criterios de diseño — codes used, materials, seismic zone
 *   4. Per-element memoria — each snapshot rendered with inputs, steps,
 *      reinforcement, checks (re-uses the same layout as single-element PDF)
 *   5. Resumen de cantidades — kg de acero por tamaño, m³ de concreto
 *   6. Bibliografía consolidada — unique references across all elements
 *   7. Signature page — engineer sign block + CFIA
 *
 * Uses the same iframe + window.print() pattern as pdf.ts, so users get
 * their browser's native "Save as PDF" or "Print" dialog. No PDF library.
 */

import katex from "katex";
import type { DesignSnapshot } from "./types";

interface ProjectMeta {
  name: string;
  address?: string;
  owner?: string;
  engineer?: string;
  cfia?: string;
  zonaSismica?: number | string;
  date?: string;
  revision?: string;
  /** Optional CFIA stamp image (data URL). */
  stampDataUrl?: string;
}

function renderEquation(latex: string): string {
  try {
    return katex.renderToString(latex, {
      output: "html", displayMode: true, throwOnError: false,
    });
  } catch {
    return `<code>${latex}</code>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(n: number | string): string {
  if (typeof n === "string") return n;
  if (!isFinite(n)) return "∞";
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 100000) return n.toLocaleString("es-CR", { maximumFractionDigits: 0 });
  if (abs >= 1) return n.toLocaleString("es-CR", { maximumFractionDigits: 3 });
  return n.toPrecision(4);
}

interface RebarRow {
  size: number;
  total_kg: number;
}

/** Bar unit weight kg/m per ACI / typical CR practice */
const BAR_KG_M: Record<number, number> = {
  3: 0.560, 4: 0.994, 5: 1.552, 6: 2.235, 7: 3.042,
  8: 3.973, 9: 5.060, 10: 6.404, 11: 7.907,
};

/** Sum rebar across all snapshots, grouped by size. */
function aggregateRebar(snapshots: DesignSnapshot[]): RebarRow[] {
  const bySize = new Map<number, number>();
  for (const s of snapshots) {
    const longBars = s.reinforcement?.longitudinal ?? [];
    for (const b of longBars) {
      // Heuristic: assume 1 m of bar per cm² of As provided (rough conversion)
      // This is for indicative material takeoff, not pricing.
      const m_est = (b.As_total / 2) * 1.0; // crude proxy
      const kg = m_est * (BAR_KG_M[b.size] ?? 1);
      bySize.set(b.size, (bySize.get(b.size) ?? 0) + kg);
    }
    const stirrups = s.reinforcement?.transversal ?? [];
    for (const t of stirrups) {
      // Stirrup running meters guess: ~3 m per element on average
      const m_est = 3.0;
      const kg = m_est * (BAR_KG_M[t.size] ?? 1);
      bySize.set(t.size, (bySize.get(t.size) ?? 0) + kg);
    }
  }
  const rows: RebarRow[] = [];
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

export function printProjectAsPdf(
  snapshots: DesignSnapshot[],
  meta: ProjectMeta,
): void {
  const date = meta.date ?? new Date().toLocaleDateString("es-CR", {
    year: "numeric", month: "long", day: "numeric",
  });

  const coverBlock = `
    <section class="cover">
      <div class="brand">COSTAPLANNER</div>
      <div class="cover-title">Memoria de cálculo estructural</div>
      <div class="cover-subtitle">Diseño completo de todos los elementos del proyecto</div>
      <table class="cover-meta">
        <tr><th>Proyecto</th><td>${escapeHtml(meta.name)}</td></tr>
        <tr><th>Dirección</th><td>${escapeHtml(meta.address ?? "—")}</td></tr>
        <tr><th>Propietario</th><td>${escapeHtml(meta.owner ?? "—")}</td></tr>
        <tr><th>Ingeniero responsable</th><td>${escapeHtml(meta.engineer ?? "_______________________")}</td></tr>
        <tr><th>CFIA</th><td>${escapeHtml(meta.cfia ?? "_______________")}</td></tr>
        <tr><th>Zona sísmica</th><td>${escapeHtml(String(meta.zonaSismica ?? "—"))}</td></tr>
        <tr><th>Fecha</th><td>${escapeHtml(date)}</td></tr>
        <tr><th>Revisión</th><td>${escapeHtml(meta.revision ?? "Rev. 0")}</td></tr>
      </table>
      <div class="stamp-slot">
        ${meta.stampDataUrl
          ? `<img src="${meta.stampDataUrl}" alt="Sello CFIA" />`
          : `<div class="stamp-placeholder">Sello CFIA</div>`}
      </div>
    </section>
  `;

  const tocBlock = `
    <section class="toc">
      <h2>Tabla de contenido</h2>
      <ol>
        ${snapshots.map((s, i) => `
          <li><a href="#sec-${i + 1}">${escapeHtml(s.title)}</a>
              <span class="toc-type">${escapeHtml(s.elementType)}</span></li>
        `).join("")}
        <li><a href="#quantities">Resumen de cantidades</a></li>
        <li><a href="#refs">Bibliografía consolidada</a></li>
        <li><a href="#sign">Firma del profesional</a></li>
      </ol>
    </section>
  `;

  const criteriaBlock = `
    <section class="criteria">
      <h2>Criterios de diseño</h2>
      <ul>
        <li><strong>Código sísmico:</strong> CSCR-10 Rev. 2014 (Costa Rica)</li>
        <li><strong>Código de concreto:</strong> ACI 318-14</li>
        <li><strong>Cimentaciones:</strong> Código de Cimentaciones de Costa Rica (2009)</li>
        <li><strong>Concreto mínimo:</strong> INTE C85:2017 por zona sísmica</li>
        <li><strong>Zona sísmica del proyecto:</strong> ${escapeHtml(String(meta.zonaSismica ?? "—"))}</li>
      </ul>
      <p class="criteria-note">
        Todas las verificaciones aplicadas en este reporte siguen las normas
        anteriores. Cada paso del cálculo lleva la cita de la sección
        específica usada.
      </p>
    </section>
  `;

  const elementsBlock = snapshots.map((s, idx) => {
    const stepsHtml = s.steps.map((step, i) => {
      const inputsList = Object.entries(step.inputs)
        .map(([k, v]) => `<span class="var"><code>${escapeHtml(k)}</code> = ${formatNumber(v)}</span>`)
        .join(", ");
      return `
        <div class="step">
          <div class="step-header">
            <span class="step-num">${String(i + 1).padStart(2, "0")}</span>
            <span class="step-name">${escapeHtml(step.name)}</span>
            ${step.code_ref ? `<span class="step-ref">${escapeHtml(step.code_ref)}</span>` : ""}
          </div>
          <div class="step-eq">${renderEquation(step.equation_latex)}</div>
          ${inputsList ? `<div class="step-inputs">${inputsList}</div>` : ""}
          <div class="step-result">
            ▸ <code>${escapeHtml(step.output_var)}</code> =
            <strong>${formatNumber(step.output_value)}</strong>
            ${step.output_unit ? `<span class="unit">${escapeHtml(step.output_unit)}</span>` : ""}
          </div>
          ${step.note ? `<div class="step-note">${escapeHtml(step.note)}</div>` : ""}
        </div>
      `;
    }).join("");

    const inputsRows = s.inputs.map((i) => `
      <tr><td><code>${escapeHtml(i.name)}</code></td>
          <td class="num">${escapeHtml(String(i.value))}</td>
          <td>${escapeHtml(i.unit ?? "")}</td></tr>
    `).join("");

    const checksRows = s.checks.map((c) => `
      <tr class="${c.cumple ? "ok" : "fail"}">
        <td>${escapeHtml(c.nombre)}</td>
        <td class="num">${formatNumber(c.requerido)} ${escapeHtml(c.unidad)}</td>
        <td class="num">${formatNumber(c.disponible)} ${escapeHtml(c.unidad)}</td>
        <td class="status">${c.cumple ? "✓" : "✗"}</td>
        <td>${escapeHtml(c.referencia)}</td>
      </tr>
    `).join("");

    const longBarsTable = s.reinforcement?.longitudinal?.length
      ? `<h4>Longitudinal</h4>
         <table class="rebar">
           <thead><tr><th>#</th><th>Tamaño</th><th>As (cm²)</th><th>Posición</th></tr></thead>
           <tbody>${s.reinforcement.longitudinal.map((b) =>
             `<tr><td class="num">${b.n}</td><td>Ø #${b.size}</td><td class="num">${b.As_total.toFixed(2)}</td><td>${escapeHtml(b.position ?? "")}</td></tr>`
           ).join("")}</tbody>
         </table>`
      : "";
    const stirrupsTable = s.reinforcement?.transversal?.length
      ? `<h4>Transversal (estribos)</h4>
         <table class="rebar">
           <thead><tr><th>Tamaño</th><th>Separación (cm)</th><th>Ramas</th><th>Zona</th></tr></thead>
           <tbody>${s.reinforcement.transversal.map((t) =>
             `<tr><td>Ø #${t.size}</td><td class="num">${t.separacion.toFixed(1)}</td><td class="num">${t.ramas}</td><td>${escapeHtml(t.zona)}</td></tr>`
           ).join("")}</tbody>
         </table>`
      : "";

    const diagramsHtml = s.diagrams && s.diagrams.length > 0
      ? `<h3>Diagramas</h3>
         <div class="diagrams-grid">
           ${s.diagrams.map((d) => `
             <figure class="diagram">
               <figcaption>${escapeHtml(d.title)}</figcaption>
               <div class="svg-wrap">${d.svgMarkup}</div>
             </figure>
           `).join("")}
         </div>`
      : "";

    return `
      <section class="element" id="sec-${idx + 1}">
        <h2>${idx + 1}. ${escapeHtml(s.title)}</h2>
        <div class="element-meta">
          <span>f'c = ${s.materials.fc} kg/cm²</span>
          <span>fy = ${s.materials.fy} kg/cm²</span>
          <span>Tipo: ${escapeHtml(s.elementType)}</span>
        </div>
        <h3>Datos de entrada</h3>
        <table class="inputs">
          <thead><tr><th>Variable</th><th>Valor</th><th>Unidad</th></tr></thead>
          <tbody>${inputsRows}</tbody>
        </table>
        ${diagramsHtml}
        <h3>Procedimiento de cálculo</h3>
        ${stepsHtml}
        ${(longBarsTable || stirrupsTable) ? `
          <h3>Refuerzo</h3>
          ${longBarsTable}
          ${stirrupsTable}
        ` : ""}
        <h3>Verificaciones</h3>
        <table class="checks">
          <thead><tr><th>Verificación</th><th>Requerido</th><th>Disponible</th><th>Cumple</th><th>Referencia</th></tr></thead>
          <tbody>${checksRows}</tbody>
        </table>
        ${(s.notes && s.notes.length > 0) ? `
          <h3>Notas</h3><ul>${s.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
        ` : ""}
      </section>
    `;
  }).join("");

  const quantitiesRows = aggregateRebar(snapshots);
  const totalKg = quantitiesRows.reduce((acc, r) => acc + r.total_kg, 0);

  const quantitiesBlock = `
    <section class="quantities" id="quantities">
      <h2>Resumen de cantidades</h2>
      <p class="hint">Estimación indicativa de acero, basada en las áreas
      provistas por elemento. NO sustituye al cómputo detallado por planos.</p>
      <table class="checks">
        <thead><tr><th>Tamaño</th><th>kg estimados</th></tr></thead>
        <tbody>
          ${quantitiesRows.map((r) =>
            `<tr><td>Ø #${r.size}</td><td class="num">${r.total_kg.toFixed(1)}</td></tr>`
          ).join("")}
          <tr class="total"><td><strong>Total</strong></td><td class="num"><strong>${totalKg.toFixed(1)} kg</strong></td></tr>
        </tbody>
      </table>
    </section>
  `;

  const refsList = uniqueRefs(snapshots);
  const refsBlock = `
    <section class="refs-section" id="refs">
      <h2>Bibliografía consolidada</h2>
      <p class="hint">Referencias citadas a lo largo de este reporte.</p>
      <ul>
        ${refsList.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
      </ul>
      <h3>Códigos costarricenses aplicados</h3>
      <ul>
        <li>CSCR-10 Rev. 2014 — Código Sísmico de Costa Rica</li>
        <li>Código de Cimentaciones de Costa Rica (2009) — CFIA</li>
        <li>INTE C85:2017 — Concreto estructural</li>
        <li>Ley 833 de Construcciones y su Reglamento</li>
      </ul>
      <h3>Códigos internacionales adoptados</h3>
      <ul>
        <li>ACI 318-14 — Building Code Requirements for Structural Concrete</li>
        <li>ASCE 7-16 — Minimum Design Loads</li>
        <li>ASTM A615/A706 — Standard Specifications for Deformed Bars</li>
      </ul>
    </section>
  `;

  const signBlock = `
    <section class="sign" id="sign">
      <h2>Firma del profesional</h2>
      <div class="sign-line">
        <hr />
        <div class="sign-meta">
          <div><strong>${escapeHtml(meta.engineer ?? "_______________________")}</strong></div>
          <div>Ingeniero Civil — CFIA ${escapeHtml(meta.cfia ?? "________")}</div>
          <div>${escapeHtml(date)}</div>
        </div>
      </div>
      <p class="disclaimer">
        El que suscribe declara que el presente cálculo estructural fue
        realizado de acuerdo con los códigos vigentes citados y que asume
        responsabilidad profesional sobre su contenido.
      </p>
    </section>
  `;

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(meta.name)} — Memoria estructural</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css" />
<style>
  @page { size: letter; margin: 1.8cm; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 10pt; line-height: 1.45; margin: 0; }
  h1 { font-size: 16pt; margin: 0 0 6pt; }
  h2 { font-size: 13pt; margin: 18pt 0 8pt; padding-bottom: 3pt; border-bottom: 1.5pt solid #333; }
  h3 { font-size: 11pt; margin: 12pt 0 6pt; color: #333; }
  h4 { font-size: 10pt; margin: 8pt 0 4pt; color: #555; }
  section.cover { page-break-after: always; padding-top: 60pt; }
  section.toc, section.criteria { page-break-after: always; }
  section.element { page-break-before: always; }
  section.quantities, section.refs-section { page-break-before: always; }
  section.sign { page-break-before: always; }
  .brand { font-size: 11pt; color: #b6770f; text-transform: uppercase; letter-spacing: 2pt; }
  .cover-title { font-size: 24pt; font-weight: 700; margin: 16pt 0 8pt; }
  .cover-subtitle { font-size: 12pt; color: #555; margin-bottom: 36pt; }
  table.cover-meta { width: 100%; border-collapse: collapse; margin-bottom: 30pt; }
  table.cover-meta th { background: #f4f4f4; padding: 8pt; text-align: left; font-weight: 600; width: 30%; border: 0.5pt solid #ddd; }
  table.cover-meta td { padding: 8pt; border: 0.5pt solid #ddd; }
  .stamp-slot { border: 1.5pt dashed #999; padding: 24pt; text-align: center; margin: 36pt 0 0; min-height: 100pt; }
  .stamp-placeholder { color: #999; font-style: italic; font-size: 11pt; padding: 30pt 0; }
  .stamp-slot img { max-width: 200pt; max-height: 200pt; }
  section.toc ol { padding-left: 24pt; font-size: 11pt; }
  section.toc li { padding: 4pt 0; }
  .toc-type { color: #999; font-size: 9pt; margin-left: 8pt; }
  section.criteria ul li { padding: 3pt 0; }
  .criteria-note { color: #555; font-size: 9pt; font-style: italic; margin-top: 12pt; }
  .element-meta { color: #555; font-size: 9pt; margin-bottom: 12pt; display: flex; gap: 16pt; }
  table.inputs, table.checks { border-collapse: collapse; width: 100%; font-size: 9pt; margin-bottom: 8pt; }
  table.inputs th, table.checks th { background: #f4f4f4; text-align: left; padding: 4pt 6pt; font-weight: 600; }
  table.inputs td, table.checks td { padding: 4pt 6pt; border-bottom: 0.5pt solid #eee; }
  .num { text-align: right; font-family: monospace; }
  .step { margin-bottom: 10pt; padding: 6pt 8pt; border: 0.5pt solid #ddd; border-radius: 3pt; page-break-inside: avoid; }
  .step-header { display: flex; gap: 8pt; align-items: baseline; margin-bottom: 4pt; }
  .step-num { font-size: 8pt; color: #888; }
  .step-name { font-weight: 600; }
  .step-ref { margin-left: auto; font-size: 8pt; color: #888; font-style: italic; }
  .step-eq { padding: 4pt; background: #fafafa; margin-bottom: 4pt; }
  .step-inputs { font-size: 9pt; color: #555; margin-bottom: 4pt; }
  .step-inputs .var { display: inline-block; margin-right: 10pt; }
  .step-result { font-size: 10pt; }
  .step-result strong { color: #035d3e; }
  .step-note { font-size: 8pt; color: #888; font-style: italic; margin-top: 4pt; }
  .unit { color: #888; font-size: 9pt; }
  table.checks tr.ok td.status { color: #035d3e; font-weight: 700; }
  table.checks tr.fail td.status { color: #a01010; font-weight: 700; }
  table.checks tr.total td { border-top: 1pt solid #333; padding-top: 6pt; }
  .hint { color: #666; font-size: 9pt; font-style: italic; margin-bottom: 6pt; }
  .sign-line { margin-top: 60pt; }
  .sign-line hr { border: 0; border-top: 0.8pt solid #333; width: 60%; }
  .sign-meta { font-size: 10pt; margin-top: 6pt; }
  .disclaimer { margin-top: 36pt; font-size: 9pt; color: #555; font-style: italic; }
  code { font-family: ui-monospace, "SF Mono", monospace; font-size: 0.92em; }

  /* Diagrams embedded per element */
  .diagrams-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; margin: 6pt 0 12pt; }
  .diagram { margin: 0; padding: 6pt; border: 0.5pt solid #ccc; border-radius: 3pt; background: #fafafa; page-break-inside: avoid; }
  .diagram figcaption { font-size: 8pt; font-weight: 600; color: #444; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 4pt; }
  .diagram .svg-wrap { background: #18181b; border-radius: 2pt; padding: 4pt; }
  .diagram svg { max-width: 100%; height: auto; display: block; }

  /* Reinforcement table style consistent with the rest */
  table.rebar { border-collapse: collapse; width: 100%; font-size: 9pt; margin-bottom: 8pt; }
  table.rebar th { background: #f4f4f4; text-align: left; padding: 4pt 6pt; font-weight: 600; border-bottom: 0.8pt solid #999; }
  table.rebar td { padding: 4pt 6pt; border-bottom: 0.5pt solid #eee; }

  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  ${coverBlock}
  ${tocBlock}
  ${criteriaBlock}
  ${elementsBlock}
  ${quantitiesBlock}
  ${refsBlock}
  ${signBlock}
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    alert("No se pudo abrir la ventana de impresión.");
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const trigger = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }
  };

  if (iframe.contentDocument?.readyState === "complete") {
    setTimeout(trigger, 500);
  } else {
    iframe.onload = () => setTimeout(trigger, 500);
  }
}
