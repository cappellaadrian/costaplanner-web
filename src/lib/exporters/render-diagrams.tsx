"use client";

/**
 * Render any React-based diagram component to a static SVG markup string
 * (or HTML string for compound diagrams like the retaining wall set).
 *
 * Used when building DesignSnapshots so the PDF/Excel exporters can inline
 * the actual on-screen diagrams instead of just text.
 *
 * Important: only client-safe components — they cannot use useState or
 * hooks the way `renderToStaticMarkup` walks the tree. For interactive
 * components (Rotatable3DWall, ExpandableDiagram), the renderToStaticMarkup
 * call evaluates them at their initial state (no events) which is exactly
 * what we want for a print snapshot.
 */
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { SnapshotDiagram } from "./types";

/**
 * Render a React element to a SnapshotDiagram entry. The element should
 * return an SVG root or a div containing an SVG.
 */
export function renderDiagram(title: string, element: ReactElement, caption?: string): SnapshotDiagram {
  let svgMarkup = "";
  try {
    svgMarkup = renderToStaticMarkup(element);
  } catch (e) {
    console.error(`[renderDiagram] failed to render '${title}':`, e);
    svgMarkup = `<div style="color:#a00;font-size:9pt">⚠ Diagrama no disponible: ${e instanceof Error ? e.message : String(e)}</div>`;
  }
  return { title, svgMarkup, caption };
}

/**
 * Render multiple diagrams in one call. Filters out nulls.
 */
export function renderDiagrams(
  list: Array<{ title: string; element: ReactElement | null; caption?: string }>,
): SnapshotDiagram[] {
  const out: SnapshotDiagram[] = [];
  for (const item of list) {
    if (item.element) {
      out.push(renderDiagram(item.title, item.element, item.caption));
    }
  }
  return out;
}
