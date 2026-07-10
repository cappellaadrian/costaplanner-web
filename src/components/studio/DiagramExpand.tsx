"use client";

/**
 * DiagramExpand — full-screen lightbox for any diagram.
 *
 * The inline diagram is rendered normally (drag, click, etc. all work).
 * A small "⤢ Ampliar" pill in the top-right corner opens a backdrop
 * modal with zoom + pan. ESC closes. Wheel zooms. Drag pans.
 *
 * We use an overlay button instead of wrapping the child in a button
 * because some diagrams (like the 3D rotatable wall) have their own
 * drag handlers that would conflict with a wrapping button.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
}

export function ExpandableDiagram({ title, children }: Props) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(5, z + 0.25));
      if (e.key === "-" || e.key === "_") setZoom((z) => Math.max(0.5, z - 0.25));
      if (e.key === "0") { setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) { setZoom(1); setPan({ x: 0, y: 0 }); }
  }, [open]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((z) => Math.max(0.4, Math.min(6, z + delta)));
  }
  function onMouseDown(e: React.MouseEvent) {
    dragging.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return;
    setPan({ x: e.clientX - dragging.current.x, y: e.clientY - dragging.current.y });
  }
  function onMouseUp() { dragging.current = null; }

  return (
    <div className="relative group">
      {/* Inline diagram. Conditional render (not display:none) so the
          inline copy is UNMOUNTED when the modal opens — otherwise the
          duplicate SVG <defs> IDs (concrete-hatch, arrow-dim, etc.) would
          coexist in the DOM and browsers would resolve url(#...) refs to
          the first match instead of the modal's own copy. */}
      {!open && children}
      {/* Overlay expand button — only shows on hover, top-right corner */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="absolute top-2 right-2 z-10 px-2 py-1 rounded bg-zinc-950/85 border border-zinc-700 text-[10px] text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-zinc-950 hover:border-amber-700 hover:text-amber-300 transition-all"
        title="Ampliar diagrama"
      >
        ⤢ Ampliar
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-zinc-950/95 backdrop-blur flex flex-col"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-950">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-amber-400">Diagrama ampliado</div>
              <div className="text-sm text-zinc-100 font-semibold">{title}</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.4, z - 0.25))}
                className="w-9 h-9 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 hover:border-amber-700">−</button>
              <span className="text-xs text-zinc-400 font-mono min-w-[3rem] text-center">{(zoom * 100).toFixed(0)}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(6, z + 0.25))}
                className="w-9 h-9 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 hover:border-amber-700">+</button>
              <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                className="px-3 h-9 rounded bg-zinc-900 border border-zinc-700 text-zinc-400 text-xs hover:border-amber-700">Reset</button>
              <button type="button" onClick={() => setOpen(false)}
                className="w-9 h-9 rounded bg-red-900/40 border border-red-700 text-red-200 hover:bg-red-900/60">✕</button>
            </div>
          </div>
          <div
            className="flex-1 overflow-hidden flex items-center justify-center select-none"
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            style={{ cursor: dragging.current ? "grabbing" : "grab" }}
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center",
                transition: dragging.current ? "none" : "transform 0.05s linear",
                width: "min(90vw, 1400px)",
                maxHeight: "85vh",
              }}
            >
              {children}
            </div>
          </div>
          <div className="px-6 py-2 border-t border-zinc-800 bg-zinc-950 text-[11px] text-zinc-500 flex items-center gap-4 font-mono">
            <span>Rueda: zoom</span>
            <span>Arrastra: pan</span>
            <span>+ / − / 0 / ESC</span>
          </div>
        </div>
      )}
    </div>
  );
}
