/**
 * PDF exporter via browser print.
 *
 * Spins up an off-screen iframe, writes a Hacienda-ready memorando into it,
 * then triggers window.print(). User chooses "Save as PDF" in the print
 * dialog. No bundled PDF lib needed — the print stylesheet handles layout.
 *
 * The memo follows CFIA's typical layout: title block with project metadata
 * and an engineer's CFIA code slot, body with each step as a numbered
 * paragraph rendering its equation via KaTeX (server-side rendered to MathML
 * for print fidelity), and a verifications table at the end.
 */

import katex from "katex";
import type { DesignSnapshot } from "./types";

function renderEquation(latex: string): string {
  try {
    return katex.renderToString(latex, {
      output: "html",
      displayMode: true,
      throwOnError: false,
    });
  } catch {
    return `<code>${latex}</code>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
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

export function printDesignAsPdf(snapshot: DesignSnapshot): void {
  const titleBlock = `
    <div class="title-block">
      <div class="brand">Costaplanner</div>
      <div class="memorando">Memoria de cálculo estructural</div>
      <table class="meta">
        <tr><th>Proyecto</th><td>${escapeHtml(snapshot.project.name)}</td>
            <th>Cantón</th><td>${escapeHtml(snapshot.project.canton ?? "—")}</td></tr>
        <tr><th>Elemento</th><td>${escapeHtml(snapshot.title)}</td>
            <th>Zona sísmica</th><td>${escapeHtml(String(snapshot.project.zona_sismica ?? "—"))}</td></tr>
        <tr><th>f'c</th><td>${snapshot.materials.fc} kg/cm²</td>
            <th>fy</th><td>${snapshot.materials.fy} kg/cm²</td></tr>
        <tr><th>Ingeniero</th><td>${escapeHtml(snapshot.project.engineer ?? "_______________________")}</td>
            <th>CFIA</th><td>${escapeHtml(snapshot.project.cfia_code ?? "_______________")}</td></tr>
      </table>
    </div>
  `;

  const inputsBlock = `
    <h2>Datos de entrada</h2>
    <table class="inputs">
      <thead><tr><th>Variable</th><th>Valor</th><th>Unidad</th></tr></thead>
      <tbody>
        ${snapshot.inputs
          .map(
            (i) => `
          <tr>
            <td><code>${escapeHtml(i.name)}</code></td>
            <td class="num">${escapeHtml(String(i.value))}</td>
            <td>${escapeHtml(i.unit ?? "")}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;

  const stepsBlock = `
    <h2>Procedimiento</h2>
    ${snapshot.steps
      .map((s, i) => {
        const inputsList = Object.entries(s.inputs)
          .map(
            ([k, v]) =>
              `<span class="var"><code>${escapeHtml(k)}</code> = ${formatNumber(v)}</span>`,
          )
          .join(", ");
        return `
        <div class="step">
          <div class="step-header">
            <span class="step-num">${String(i + 1).padStart(2, "0")}</span>
            <span class="step-name">${escapeHtml(s.name)}</span>
            ${s.code_ref ? `<span class="step-ref">${escapeHtml(s.code_ref)}</span>` : ""}
          </div>
          <div class="step-eq">${renderEquation(s.equation_latex)}</div>
          ${inputsList ? `<div class="step-inputs">${inputsList}</div>` : ""}
          <div class="step-result">
            ▸ <code>${escapeHtml(s.output_var)}</code> =
            <strong>${formatNumber(s.output_value)}</strong>
            ${s.output_unit ? `<span class="unit">${escapeHtml(s.output_unit)}</span>` : ""}
          </div>
          ${s.note ? `<div class="step-note">${escapeHtml(s.note)}</div>` : ""}
        </div>`;
      })
      .join("")}
  `;

  const checksBlock = `
    <h2>Verificaciones</h2>
    <table class="checks">
      <thead>
        <tr>
          <th>Verificación</th>
          <th>Requerido</th>
          <th>Disponible</th>
          <th>Cumple</th>
          <th>Referencia</th>
        </tr>
      </thead>
      <tbody>
        ${snapshot.checks
          .map(
            (c) => `
          <tr class="${c.cumple ? "ok" : "fail"}">
            <td>${escapeHtml(c.nombre)}</td>
            <td class="num">${formatNumber(c.requerido)} ${escapeHtml(c.unidad)}</td>
            <td class="num">${formatNumber(c.disponible)} ${escapeHtml(c.unidad)}</td>
            <td class="status">${c.cumple ? "✓" : "✗"}</td>
            <td>${escapeHtml(c.referencia)}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;

  const reinforcementBlock = snapshot.reinforcement
    ? `
      <h2>Refuerzo de diseño</h2>
      ${
        snapshot.reinforcement.longitudinal?.length
          ? `<h3>Refuerzo longitudinal</h3>
             <table class="rebar">
               <thead><tr>
                 <th>#</th><th>Tamaño</th><th>As (cm²)</th><th>Posición</th>
               </tr></thead>
               <tbody>
                 ${snapshot.reinforcement.longitudinal.map((b) => `
                   <tr>
                     <td class="num">${b.n}</td>
                     <td>Ø #${b.size}</td>
                     <td class="num">${b.As_total.toFixed(2)}</td>
                     <td>${escapeHtml(b.position ?? "")}</td>
                   </tr>
                 `).join("")}
               </tbody>
             </table>`
          : ""
      }
      ${
        snapshot.reinforcement.transversal?.length
          ? `<h3>Refuerzo transversal (estribos)</h3>
             <table class="rebar">
               <thead><tr>
                 <th>Tamaño</th><th>Separación (cm)</th><th>Ramas</th><th>Zona</th>
               </tr></thead>
               <tbody>
                 ${snapshot.reinforcement.transversal.map((s) => `
                   <tr>
                     <td>Ø #${s.size}</td>
                     <td class="num">${s.separacion.toFixed(1)}</td>
                     <td class="num">${s.ramas}</td>
                     <td>${escapeHtml(s.zona)}</td>
                   </tr>
                 `).join("")}
               </tbody>
             </table>`
          : ""
      }
    `
    : "";

  // Diagrams block — inline the rendered SVG markup
  const diagramsBlock = snapshot.diagrams && snapshot.diagrams.length > 0
    ? `
      <h2>Diagramas</h2>
      <div class="diagrams-grid">
        ${snapshot.diagrams.map((d) => `
          <figure class="diagram">
            <figcaption>${escapeHtml(d.title)}</figcaption>
            <div class="svg-wrap">${d.svgMarkup}</div>
            ${d.caption ? `<div class="diag-caption">${escapeHtml(d.caption)}</div>` : ""}
          </figure>
        `).join("")}
      </div>
    `
    : "";

  const notesBlock =
    snapshot.notes && snapshot.notes.length > 0
      ? `<h2>Notas</h2><ul>${snapshot.notes
          .map((n) => `<li>${escapeHtml(n)}</li>`)
          .join("")}</ul>`
      : "";

  const signBlock = `
    <div class="sign">
      <div class="sign-line">
        <hr />
        <div>Profesional responsable — CFIA ${escapeHtml(snapshot.project.cfia_code ?? "________")}</div>
      </div>
    </div>
  `;

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(snapshot.title)} — Costaplanner</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css" />
<style>
  @page { size: letter; margin: 1.6cm; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; font-size: 10pt; line-height: 1.4; }
  h1 { font-size: 14pt; margin: 0 0 4pt; }
  h2 { font-size: 11pt; margin: 16pt 0 6pt; padding-bottom: 2pt; border-bottom: 1pt solid #999; }
  h3 { font-size: 10pt; margin: 10pt 0 4pt; color: #444; }
  table { border-collapse: collapse; width: 100%; font-size: 9pt; }
  table.meta { margin-bottom: 8pt; }
  table.meta th { text-align: left; background: #f4f4f4; padding: 3pt 6pt; font-weight: 600; width: 80pt; }
  table.meta td { padding: 3pt 6pt; border-bottom: 0.5pt solid #ddd; }
  table.inputs th, table.checks th { background: #f4f4f4; text-align: left; padding: 3pt 6pt; font-weight: 600; }
  table.inputs td, table.checks td { padding: 3pt 6pt; border-bottom: 0.5pt solid #eee; }
  .num { text-align: right; font-family: monospace; }
  .title-block { border: 1pt solid #333; padding: 8pt; margin-bottom: 12pt; }
  .brand { font-size: 9pt; color: #b6770f; text-transform: uppercase; letter-spacing: 1pt; }
  .memorando { font-size: 14pt; font-weight: 600; margin-bottom: 6pt; }
  .step { margin-bottom: 10pt; padding: 6pt 8pt; border: 0.5pt solid #ddd; border-radius: 3pt; page-break-inside: avoid; }
  .step-header { display: flex; gap: 8pt; align-items: baseline; margin-bottom: 4pt; }
  .step-num { font-size: 8pt; color: #888; }
  .step-name { font-weight: 600; }
  .step-ref { margin-left: auto; font-size: 8pt; color: #888; font-style: italic; }
  .step-eq { padding: 4pt; background: #fafafa; margin-bottom: 4pt; }
  .step-inputs { font-size: 9pt; color: #555; margin-bottom: 4pt; }
  .step-inputs .var { display: inline-block; margin-right: 8pt; }
  .step-result { font-size: 10pt; }
  .step-result strong { color: #035d3e; }
  .step-note { font-size: 8pt; color: #888; font-style: italic; margin-top: 4pt; }
  .unit { color: #888; font-size: 9pt; }
  table.checks tr.ok td.status { color: #035d3e; font-weight: 700; }
  table.checks tr.fail td.status { color: #a01010; font-weight: 700; }
  .sign { margin-top: 36pt; }
  .sign-line { width: 60%; }
  .sign-line hr { border: 0; border-top: 0.5pt solid #333; }
  .sign-line div { font-size: 9pt; color: #444; margin-top: 4pt; }
  code { font-family: ui-monospace, "SF Mono", monospace; font-size: 0.92em; }

  /* Diagrams */
  .diagrams-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; margin-top: 6pt; }
  .diagram { margin: 0; padding: 6pt; border: 0.5pt solid #ccc; border-radius: 3pt; background: #fafafa; page-break-inside: avoid; }
  .diagram figcaption { font-size: 8.5pt; font-weight: 600; color: #444; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 4pt; }
  .diagram .svg-wrap { background: #18181b; border-radius: 2pt; padding: 4pt; }
  .diagram svg { max-width: 100%; height: auto; display: block; }
  .diag-caption { font-size: 8pt; color: #666; font-style: italic; margin-top: 4pt; }

  /* Reinforcement table */
  table.rebar { border-collapse: collapse; width: 100%; font-size: 9pt; margin-bottom: 8pt; }
  table.rebar th { background: #f4f4f4; text-align: left; padding: 4pt 6pt; font-weight: 600; border-bottom: 0.8pt solid #999; }
  table.rebar td { padding: 4pt 6pt; border-bottom: 0.5pt solid #eee; }

  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  ${titleBlock}
  ${inputsBlock}
  ${diagramsBlock}
  ${stepsBlock}
  ${reinforcementBlock}
  ${checksBlock}
  ${notesBlock}
  ${signBlock}
</body>
</html>`;

  // Open in a same-window iframe so we don't get blocked by popup blockers.
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

  // Wait for KaTeX CSS to load and the body to render before printing.
  const trigger = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1500);
    }
  };

  if (iframe.contentDocument?.readyState === "complete") {
    setTimeout(trigger, 400);
  } else {
    iframe.onload = () => setTimeout(trigger, 400);
  }
}
