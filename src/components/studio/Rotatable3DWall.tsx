"use client";

/**
 * Rotatable 3D parallel-projection of the cantilever retaining wall.
 *
 * Replaces the static oblique D2_Isometric. The user can drag horizontally
 * to change yaw (Y-axis rotation) and vertically to change pitch (X-axis
 * rotation). Geometry is built from the same RetainingWallLiveResult, so
 * any input edit on the studio page redraws this 3D view in lockstep.
 *
 * Why parallel projection instead of Three.js?
 *  - Engineering drawings traditionally use isometric / cavalier projection
 *    (parallel lines stay parallel) so dimensions can be read directly.
 *  - Zero JS dependencies beyond React + SVG.
 *  - Performant — 16 ms re-render for every drag event.
 *  - Matches the Structural Tech / Luis Maldonado source PDF aesthetic.
 *
 * The wall is broken into 6 boxes (zapata, pantalla rectangular core,
 * pantalla triangular wedge, optional toe extension, optional heel
 * extension, optional soil block). Each box's 8 vertices are projected
 * through yaw + pitch, then we sort faces back-to-front and draw them as
 * polygons. Hidden surface removal is done via simple depth sort.
 */
import { useState, useRef } from "react";
import type { RetainingWallLiveResult } from "@/lib/retaining-wall-live";

interface Vec3 { x: number; y: number; z: number }

interface Face {
  v: number[]; // indices into the wall's vertex list
  fill: string;
  stroke: string;
  // Average depth for back-to-front sort
  depth: number;
}

// Project a 3D point through yaw (around Y) + pitch (around X), then
// orthographic-project by dropping z. Returns 2D screen coords.
function project(p: Vec3, yaw: number, pitch: number): [number, number, number] {
  // Yaw: rotate around Y axis (vertical). x and z change.
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  const y1 = p.y;
  // Pitch: rotate around X axis. y and z change.
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y2 = y1 * cp - z1 * sp;
  const z2 = y1 * sp + z1 * cp;
  return [x1, y2, z2]; // (screen x, screen y projected, depth z2)
}

interface Props {
  r: RetainingWallLiveResult;
}

export function Rotatable3DWall({ r }: Props) {
  // Default angles approximate the source PDF's oblique view
  const [yaw, setYaw] = useState(-0.65);
  const [pitch, setPitch] = useState(0.22);
  const dragging = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);

  function onMouseDown(e: React.MouseEvent) {
    dragging.current = { x: e.clientX, y: e.clientY, yaw, pitch };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    setYaw(dragging.current.yaw + dx * 0.012);
    setPitch(Math.max(-1.2, Math.min(1.2, dragging.current.pitch + dy * 0.012)));
  }
  function onMouseUp() {
    dragging.current = null;
  }

  function reset() {
    setYaw(-0.65);
    setPitch(0.22);
  }

  // Build wall geometry (units: meters, but we'll scale to px in render).
  // Guard every linear dimension so a malformed input never produces NaN polygons.
  const { c_m, ct_m, b_m, H_m, Hz_m } = r.input;
  const B = Math.max(0.5, r.B_m);
  const H_total = Math.max(1.0, r.H_total_m);
  const safeC = Math.max(0.1, c_m);
  const safeCt = Math.max(safeC + 0.05, ct_m);
  const safeB = Math.max(0.05, b_m);
  const safeH = Math.max(0.5, H_m);
  const safeHz = Math.max(0.15, Hz_m);
  const depth_m = 1.0; // 1 m de fondo, as in source PDF

  // Vertices: we build the wall as ONE concave prism extruded into the page.
  // Front-face polygon (the cross-section) — the same outline used in 2D.
  const frontOutline: Array<[number, number]> = [
    [safeB, safeHz + safeH],            // 0: top-left of corona
    [safeB + safeC, safeHz + safeH],    // 1: top-right of corona
    [safeB + safeCt, safeHz],           // 2: bottom-right of pantalla (after taper)
    [B, safeHz],                        // 3: top-right of zapata
    [B, 0],                             // 4: bottom-right of zapata
    [0, 0],                             // 5: bottom-left of zapata
    [0, safeHz],                        // 6: top-left of zapata
    [safeB, safeHz],                    // 7: bottom-left of pantalla
  ];

  // Front vertices (z = 0)
  const front: Vec3[] = frontOutline.map(([x, y]) => ({ x, y, z: 0 }));
  // Back vertices (z = depth_m), in same order — we offset by depth on the Z axis
  const back: Vec3[] = frontOutline.map(([x, y]) => ({ x, y, z: -depth_m }));
  // All vertices: front (0..7), back (8..15)
  const verts: Vec3[] = [...front, ...back];
  const N = frontOutline.length;

  // Build face list:
  //   - Front face: 0..N-1
  //   - Back face:  N..2N-1 (reversed for outward normal)
  //   - Side faces: between each pair of consecutive outline points
  const faces: Face[] = [];

  // Front
  faces.push({
    v: Array.from({ length: N }, (_, i) => i),
    fill: "url(#concrete-hatch)",
    stroke: "#71717a",
    depth: 0,
  });
  // Back
  faces.push({
    v: Array.from({ length: N }, (_, i) => N + (N - 1 - i)),
    fill: "#3f3f46",
    stroke: "#71717a",
    depth: 0,
  });
  // Sides (quads)
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    faces.push({
      v: [i, j, N + j, N + i],
      fill: "#52525b",
      stroke: "#71717a",
      depth: 0,
    });
  }

  // Project all vertices (centered on origin so rotation pivots correctly)
  const projected = verts.map((v) => {
    const [px, py, pz] = project(
      { x: v.x - B / 2, y: v.y - H_total / 2, z: v.z + depth_m / 2 },
      yaw,
      pitch,
    );
    return { x: px, y: py, z: pz };
  });

  // Compute face depths (mean z)
  for (const f of faces) {
    f.depth = f.v.reduce((acc, idx) => acc + projected[idx].z, 0) / f.v.length;
  }
  // Sort back-to-front (largest depth first — farthest away drawn first)
  faces.sort((a, b) => a.depth - b.depth);

  // Frame dimensions
  const W = 560, H = 360;
  const scale = Math.min(W / (B * 1.6), H / (H_total * 1.6));
  const ox = W / 2;
  const oy = H / 2;

  function toScreen(p: { x: number; y: number }): [number, number] {
    return [ox + p.x * scale, oy - p.y * scale];
  }

  // Build axis indicator at the wall origin (front-bottom-left corner)
  const axisOrigin: Vec3 = { x: -B / 2 + 0.1, y: -H_total / 2 + 0.1, z: depth_m / 2 };
  const axisLen = 0.6;
  const ax = project(axisOrigin, yaw, pitch);
  const axX = project({ ...axisOrigin, x: axisOrigin.x + axisLen }, yaw, pitch);
  const axY = project({ ...axisOrigin, y: axisOrigin.y + axisLen }, yaw, pitch);
  const axZ = project({ ...axisOrigin, z: axisOrigin.z - axisLen }, yaw, pitch);

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto bg-zinc-950 select-none"
        style={{ cursor: dragging.current ? "grabbing" : "grab", touchAction: "none" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <defs>
          <pattern
            id="concrete-hatch"
            patternUnits="userSpaceOnUse"
            width="6" height="6"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="#d4d4d8" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#a1a1aa" strokeWidth="0.8" />
          </pattern>
        </defs>

        {/* Faces back-to-front */}
        {faces.map((f, i) => {
          const pts = f.v.map((idx) => toScreen(projected[idx]).join(",")).join(" ");
          return (
            <polygon
              key={i}
              points={pts}
              fill={f.fill}
              stroke={f.stroke}
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          );
        })}

        {/* Coordinate axis indicator (X = red, Y = green, Z = blue) */}
        <g opacity="0.85">
          <line x1={ox + ax[0] * scale} y1={oy - ax[1] * scale} x2={ox + axX[0] * scale} y2={oy - axX[1] * scale} stroke="#ef4444" strokeWidth="1.5" />
          <text x={ox + axX[0] * scale + 4} y={oy - axX[1] * scale + 3} fill="#fca5a5" fontSize="9" fontFamily="ui-monospace, monospace">X</text>
          <line x1={ox + ax[0] * scale} y1={oy - ax[1] * scale} x2={ox + axY[0] * scale} y2={oy - axY[1] * scale} stroke="#10b981" strokeWidth="1.5" />
          <text x={ox + axY[0] * scale + 4} y={oy - axY[1] * scale + 3} fill="#6ee7b7" fontSize="9" fontFamily="ui-monospace, monospace">Y</text>
          <line x1={ox + ax[0] * scale} y1={oy - ax[1] * scale} x2={ox + axZ[0] * scale} y2={oy - axZ[1] * scale} stroke="#3b82f6" strokeWidth="1.5" />
          <text x={ox + axZ[0] * scale + 4} y={oy - axZ[1] * scale + 3} fill="#93c5fd" fontSize="9" fontFamily="ui-monospace, monospace">Z</text>
        </g>

        {/* Title + hint */}
        <text x={W / 2} y={22} textAnchor="middle" fill="#e4e4e7" fontSize="12" fontFamily="ui-monospace, monospace">
          Vista 3D — arrastra para rotar
        </text>
        <text x={W / 2} y={H - 8} textAnchor="middle" fill="#71717a" fontSize="9" fontFamily="ui-monospace, monospace">
          yaw = {((yaw * 180) / Math.PI).toFixed(0)}° · pitch = {((pitch * 180) / Math.PI).toFixed(0)}° · 1 m de fondo
        </text>
      </svg>
      {/* Controls */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <label className="flex items-center gap-2 text-zinc-400">
          <span className="text-zinc-500 w-12 font-mono">Yaw</span>
          <input
            type="range" min="-3.14" max="3.14" step="0.05"
            value={yaw}
            onChange={(e) => setYaw(parseFloat(e.target.value))}
            className="flex-1 max-w-[180px] accent-amber-500"
          />
          <span className="font-mono w-12 text-right text-amber-300">
            {((yaw * 180) / Math.PI).toFixed(0)}°
          </span>
        </label>
        <label className="flex items-center gap-2 text-zinc-400">
          <span className="text-zinc-500 w-12 font-mono">Pitch</span>
          <input
            type="range" min="-1.2" max="1.2" step="0.05"
            value={pitch}
            onChange={(e) => setPitch(parseFloat(e.target.value))}
            className="flex-1 max-w-[180px] accent-amber-500"
          />
          <span className="font-mono w-12 text-right text-amber-300">
            {((pitch * 180) / Math.PI).toFixed(0)}°
          </span>
        </label>
        <button
          type="button"
          onClick={reset}
          className="px-3 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-amber-700 transition-colors"
          title="Reset vista"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
