"use client";

/**
 * 11 reactive engineering diagrams for the cantilever retaining wall.
 * Each diagram binds to live values from RetainingWallLiveResult — when
 * the user edits any input on the studio page, every SVG redraws within
 * one render cycle (<16ms).
 *
 * Diagrams (D1–D11 in the plan):
 *   D1 — Cross-section with annotated dimensions + soil layers + surcharge arrows
 *   D2 — Isometric 3D oblique view
 *   D3 — Triangular empuje activo with E1 vector at H/3
 *   D4 — Rectangular empuje sobrecarga with E2 vector at H/2
 *   D5 — Triangular empuje pasivo on toe at D/3
 *   D6 — 4-section weight breakdown (colored areas + weight table)
 *   D7 — Vuelco rotation diagram with live FS readout
 *   D8 — Deslizamiento sliding diagram with live FS readout
 *   D9 — Pressure distribution selector (trapezoidal ↔ rectangular B')
 *   D10 — Pantalla bending + shear diagrams
 *   D11 — Final reinforcement scaled elevation (all bars labeled)
 */

import {
  SvgDefs, DimLine, ForceArrow, DistributedDownLoad,
  PressureDistribution, StatusReadout, SectionBadge,
  RotationArrow, DiagramFrame, COLORS,
} from "./svg-primitives";
import { Rotatable3DWall } from "./Rotatable3DWall";
import type { RetainingWallLiveResult } from "@/lib/retaining-wall-live";

// ===========================================================================
// Layout helpers — convert physical (m) to SVG (px) using a per-diagram scale
// ===========================================================================

interface Frame {
  width: number;
  height: number;
  scale_m_to_px: number;
  // Origin of "world coordinates" in svg space (toe of footing on base line)
  ox: number;
  oy: number;
}

function makeFrame(W: number, H: number, B_m: number, Htot_m: number): Frame {
  const padX = 100;
  const padTop = 50;
  const padBottom = 80;
  const sx = (W - 2 * padX) / Math.max(B_m * 1.4, 4);
  const sy = (H - padTop - padBottom) / Math.max(Htot_m * 1.1, 6);
  const scale = Math.min(sx, sy);
  return {
    width: W, height: H,
    scale_m_to_px: scale,
    ox: padX + (W - 2 * padX) / 2 - (B_m * scale) / 2,
    oy: H - padBottom,
  };
}

function px(f: Frame, x_m: number, y_m: number): [number, number] {
  return [f.ox + x_m * f.scale_m_to_px, f.oy - y_m * f.scale_m_to_px];
}

// ===========================================================================
// Wall outline path — used by multiple diagrams
// ===========================================================================

function wallOutlinePoints(f: Frame, r: RetainingWallLiveResult): string {
  const { c_m, ct_m, b_m, H_m, Hz_m, Bp_m } = r.input;
  const B = r.B_m;
  // Outline points in physical coordinates, going clockwise from top-left of corona
  const p: Array<[number, number]> = [
    [b_m, Hz_m + H_m],                 // top-left of corona
    [b_m + c_m, Hz_m + H_m],           // top-right of corona
    [b_m + ct_m, Hz_m],                // bottom-right of pantalla (triangular slope)
    [B, Hz_m],                          // top-right of zapata
    [B, 0],                             // bottom-right of zapata
    [0, 0],                             // bottom-left of zapata
    [0, Hz_m],                          // top-left of zapata
    [b_m, Hz_m],                        // bottom-left of pantalla
  ];
  return p.map(([x, y]) => px(f, x, y).join(",")).join(" ");
}

// ===========================================================================
// D1 — Cross-section with dimensions + soil layers + surcharge
// ===========================================================================

export function D1_CrossSection({ r }: { r: RetainingWallLiveResult }) {
  const f = makeFrame(600, 420, r.B_m, r.H_total_m);
  const { c_m, ct_m, b_m, H_m, Hz_m, Bp_m, D_m } = r.input;
  const B = r.B_m;
  const [, yTop] = px(f, 0, r.H_total_m);
  const [xBaseL] = px(f, 0, 0);
  const [xBaseR] = px(f, B, 0);
  // Soil region behind the wall (above zapata back)
  const [xBackBottom] = px(f, b_m + ct_m, Hz_m);
  const [, yBackTop] = px(f, 0, r.H_total_m);
  // Front soil (toe) region above zapata
  const [xFrontL] = px(f, 0, Hz_m);
  const [xFrontR] = px(f, b_m, Hz_m);
  const [, yFrontTop] = px(f, 0, Hz_m + D_m);

  return (
    <svg viewBox={`0 0 ${f.width} ${f.height}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Soil behind wall (full height) */}
      <polygon
        points={`${xBackBottom},${yBackTop} ${xBaseR},${yBackTop} ${xBaseR},${px(f, B, Hz_m)[1]} ${xBackBottom},${px(f, b_m + ct_m, Hz_m)[1]}`}
        fill="url(#soil-hatch)"
      />
      {/* Soil in front of toe (only D meters above zapata) */}
      <polygon
        points={`${xFrontL},${yFrontTop} ${xFrontR},${yFrontTop} ${xFrontR},${px(f, b_m, Hz_m)[1]} ${xFrontL},${px(f, 0, Hz_m)[1]}`}
        fill="url(#soil-hatch)"
      />
      {/* Wall concrete */}
      <polygon points={wallOutlinePoints(f, r)} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />

      {/* Surcharge arrows on top of back-soil */}
      <DistributedDownLoad
        xLeft={xBackBottom}
        xRight={xBaseR}
        yTop={yBackTop - 24}
        label={`q = ${r.input.qSC.toFixed(0)} kN/m²`}
      />

      {/* Dimensions */}
      <DimLine
        x1={px(f, 0, 0)[0]} y1={f.oy + 20}
        x2={px(f, B, 0)[0]} y2={f.oy + 20}
        label={`B = ${B.toFixed(2)} m`}
      />
      <DimLine
        x1={px(f, 0, 0)[0]} y1={px(f, 0, Hz_m)[1]}
        x2={px(f, 0, 0)[0]} y2={px(f, 0, 0)[1]}
        offset={-20}
        label={`Hz = ${Hz_m.toFixed(2)}`}
      />
      <DimLine
        x1={px(f, B, 0)[0]} y1={px(f, B, Hz_m)[1]}
        x2={px(f, B, 0)[0]} y2={px(f, B, r.H_total_m)[1]}
        offset={20}
        label={`H = ${H_m.toFixed(2)} m`}
      />
      {/* CR-Vis-Bug 2026-05: previously b/ct/Bp all stacked at f.oy + 40
          and overlapped each other. Stagger them at +40 (b, Bp on
          opposite ends) and +56 (ct centered) so each label has clear
          room. */}
      <DimLine
        x1={px(f, 0, 0)[0]} y1={f.oy + 40}
        x2={px(f, b_m, 0)[0]} y2={f.oy + 40}
        label={`b = ${b_m.toFixed(2)}`}
      />
      <DimLine
        x1={px(f, b_m + ct_m, 0)[0]} y1={f.oy + 40}
        x2={px(f, B, 0)[0]} y2={f.oy + 40}
        label={`Bp = ${Bp_m.toFixed(2)}`}
      />
      <DimLine
        x1={px(f, b_m, 0)[0]} y1={f.oy + 56}
        x2={px(f, b_m + ct_m, 0)[0]} y2={f.oy + 56}
        label={`ct = ${ct_m.toFixed(2)}`}
      />

      {/* Soil parameters callout */}
      <g transform={`translate(${px(f, b_m + ct_m + Bp_m / 2, r.H_total_m / 2)[0] - 50}, ${px(f, 0, r.H_total_m / 2)[1] - 30})`}>
        <rect width="120" height="48" fill={COLORS.bgPanel} stroke={COLORS.soilHatch} strokeWidth="1" rx="3" opacity="0.92" />
        <text x="60" y="14" textAnchor="middle" fill={COLORS.rebar} fontSize="10" fontFamily="ui-monospace, monospace">
          γ_s = {r.input.gamma_r} kN/m³
        </text>
        <text x="60" y="28" textAnchor="middle" fill={COLORS.rebar} fontSize="10" fontFamily="ui-monospace, monospace">
          φ = {r.input.phi_deg}°
        </text>
        <text x="60" y="42" textAnchor="middle" fill={COLORS.rebar} fontSize="10" fontFamily="ui-monospace, monospace">
          c = {r.input.cohesion} kN/m²
        </text>
      </g>
    </svg>
  );
}

// ===========================================================================
// D2 — 3D oblique view
// ===========================================================================

export function D2_Isometric({ r }: { r: RetainingWallLiveResult }) {
  const W = 540, H = 320;
  const scale = 30;
  const dx = 60, dy = -25; // oblique offset for depth
  const { c_m, ct_m, b_m, H_m, Hz_m, Bp_m } = r.input;
  const B = r.B_m;
  const Htot = r.H_total_m;
  const ox = 80, oy = H - 60;

  // Helper
  const front2d = (x: number, y: number) => [ox + x * scale, oy - y * scale];
  const back2d = (x: number, y: number) => [ox + x * scale + dx, oy - y * scale + dy];

  // Front face (cross-section)
  const front = [
    front2d(b_m, Hz_m + H_m),
    front2d(b_m + c_m, Hz_m + H_m),
    front2d(b_m + ct_m, Hz_m),
    front2d(B, Hz_m),
    front2d(B, 0),
    front2d(0, 0),
    front2d(0, Hz_m),
    front2d(b_m, Hz_m),
  ];
  const back = front.map(([_, __], i) => back2d(
    [b_m, b_m + c_m, b_m + ct_m, B, B, 0, 0, b_m][i],
    [Hz_m + H_m, Hz_m + H_m, Hz_m, Hz_m, 0, 0, Hz_m, Hz_m][i]
  ));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Side face (left strip) */}
      <polygon
        points={[front[0], back[0], back[1], front[1]].map((p) => p.join(",")).join(" ")}
        fill={COLORS.concrete} stroke={COLORS.concreteStroke} strokeWidth="1"
      />
      <polygon
        points={[front[4], back[4], back[5], front[5]].map((p) => p.join(",")).join(" ")}
        fill={COLORS.concrete} stroke={COLORS.concreteStroke} strokeWidth="1"
      />
      {/* Top face of zapata */}
      <polygon
        points={[front[6], back[6], back[3], front[3]].map((p) => p.join(",")).join(" ")}
        fill={COLORS.concrete} stroke={COLORS.concreteStroke} strokeWidth="1"
      />
      {/* Back face */}
      <polygon points={back.map((p) => p.join(",")).join(" ")} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1" opacity="0.7" />
      {/* Front face */}
      <polygon points={front.map((p) => p.join(",")).join(" ")} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />

      {/* "1 m" depth label */}
      <line x1={back[5][0]} y1={back[5][1]} x2={back[5][0] + 60} y2={back[5][1]} stroke={COLORS.dim} strokeWidth="1" strokeDasharray="2,2" />
      <text x={back[5][0] - 8} y={back[5][1] - 4} textAnchor="end" fill={COLORS.dimText} fontSize="10" fontFamily="ui-monospace, monospace">
        100 cm (1 m de fondo)
      </text>

      {/* Title */}
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Vista isométrica — diseño por metro lineal
      </text>
    </svg>
  );
}

// ===========================================================================
// D3 — Triangular empuje activo
// ===========================================================================

export function D3_EmpujeActivo({ r }: { r: RetainingWallLiveResult }) {
  const W = 320, H = 320;
  const padding = 50;
  const baseY = H - padding;
  const topY = padding;
  const drawableH = baseY - topY;
  const baseX = padding + 40;
  // Triangle base width proportional to p_max
  const maxArrowLen = 140;
  const baseLen = maxArrowLen;
  // Resultant arrow position
  const Z1_y = baseY - (drawableH * (1 / 3)); // H/3 from base

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Wall edge (vertical line) */}
      <line x1={baseX} y1={topY} x2={baseX} y2={baseY} stroke={COLORS.concreteStroke} strokeWidth="2" />
      {/* Soil behind */}
      <rect x={baseX} y={topY} width={W - baseX - padding} height={drawableH} fill="url(#soil-hatch)" opacity="0.4" />
      {/* Triangular pressure */}
      <polygon
        points={`${baseX},${topY} ${baseX},${baseY} ${baseX + baseLen},${baseY}`}
        fill="rgba(220,38,38,0.18)" stroke={COLORS.force} strokeWidth="1.2"
      />
      {/* Pressure arrows distributed along height */}
      {[0.15, 0.35, 0.55, 0.75, 0.9].map((t, i) => {
        const y = topY + t * drawableH;
        const arrowLen = baseLen * t;
        return (
          <line
            key={i}
            x1={baseX + arrowLen} y1={y}
            x2={baseX + 4} y2={y}
            stroke={COLORS.force} strokeWidth="1"
            markerEnd="url(#arrow-load)"
          />
        );
      })}
      {/* Resultant arrow at H/3 */}
      <ForceArrow
        x={baseX + 80} y={Z1_y} angle={Math.PI}
        magnitude={r.E1_kN} scale={1.5} maxLength={70}
        label={`E₁ = ${r.E1_kN.toFixed(1)} kN/m`}
      />
      <line x1={baseX - 4} y1={Z1_y} x2={baseX + 20} y2={Z1_y} stroke={COLORS.force} strokeWidth="0.7" strokeDasharray="2,2" />
      <text x={baseX - 8} y={Z1_y + 3} textAnchor="end" fill={COLORS.force} fontSize="9" fontFamily="ui-monospace, monospace">
        Z₁ = H/3 = {r.Z1_m.toFixed(2)} m
      </text>
      {/* Max pressure label */}
      <text x={baseX + baseLen + 8} y={baseY + 3} textAnchor="start" fill={COLORS.force} fontSize="9" fontFamily="ui-monospace, monospace">
        γH·Ka = {r.pa_max_kPa.toFixed(1)} kPa
      </text>
      {/* H label */}
      <DimLine
        x1={baseX - 25} y1={topY} x2={baseX - 25} y2={baseY}
        label={`H = ${r.H_total_m.toFixed(2)} m`}
      />
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Empuje activo (Rankine)
      </text>
    </svg>
  );
}

// ===========================================================================
// D4 — Rectangular sobrecarga
// ===========================================================================

export function D4_EmpujeSobrecarga({ r }: { r: RetainingWallLiveResult }) {
  const W = 320, H = 320;
  const padding = 50;
  const baseY = H - padding;
  const topY = padding;
  const drawableH = baseY - topY;
  const baseX = padding + 40;
  const rectLen = 60; // uniform rectangular load
  const Z2_y = baseY - (drawableH * (1 / 2));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <line x1={baseX} y1={topY} x2={baseX} y2={baseY} stroke={COLORS.concreteStroke} strokeWidth="2" />
      <rect x={baseX} y={topY} width={W - baseX - padding} height={drawableH} fill="url(#soil-hatch)" opacity="0.4" />
      {/* Surcharge on top */}
      <DistributedDownLoad
        xLeft={baseX} xRight={baseX + (W - baseX - padding)}
        yTop={topY - 24} arrowLen={18}
        label={`q = ${r.input.qSC.toFixed(0)} kN/m²`}
      />
      {/* Rectangular lateral pressure */}
      <polygon
        points={`${baseX},${topY} ${baseX + rectLen},${topY} ${baseX + rectLen},${baseY} ${baseX},${baseY}`}
        fill="rgba(220,38,38,0.18)" stroke={COLORS.force} strokeWidth="1.2"
      />
      {[0.15, 0.35, 0.55, 0.75, 0.9].map((t, i) => {
        const y = topY + t * drawableH;
        return (
          <line key={i}
            x1={baseX + rectLen} y1={y}
            x2={baseX + 4} y2={y}
            stroke={COLORS.force} strokeWidth="1"
            markerEnd="url(#arrow-load)"
          />
        );
      })}
      <ForceArrow
        x={baseX + 60} y={Z2_y} angle={Math.PI}
        magnitude={r.E2_kN} scale={2} maxLength={55}
        label={`E₂ = ${r.E2_kN.toFixed(1)} kN/m`}
      />
      <line x1={baseX - 4} y1={Z2_y} x2={baseX + 20} y2={Z2_y} stroke={COLORS.force} strokeWidth="0.7" strokeDasharray="2,2" />
      <text x={baseX - 8} y={Z2_y + 3} textAnchor="end" fill={COLORS.force} fontSize="9" fontFamily="ui-monospace, monospace">
        Z₂ = H/2 = {r.Z2_m.toFixed(2)} m
      </text>
      <text x={baseX + rectLen + 8} y={baseY - drawableH / 2 + 3} textAnchor="start" fill={COLORS.force} fontSize="9" fontFamily="ui-monospace, monospace">
        q·Ka = {r.pSC_kPa.toFixed(1)} kPa
      </text>
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Empuje por sobrecarga
      </text>
    </svg>
  );
}

// ===========================================================================
// D5 — Triangular empuje pasivo on toe
// ===========================================================================

export function D5_EmpujePasivo({ r }: { r: RetainingWallLiveResult }) {
  const W = 320, H = 240;
  const padding = 50;
  const baseY = H - padding;
  const topY = padding + 40;
  const drawableH = baseY - topY;
  const wallX = W - padding - 30;
  const baseLen = 70;
  const Zp_y = baseY - (drawableH * (1 / 3));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <line x1={wallX} y1={topY} x2={wallX} y2={baseY} stroke={COLORS.concreteStroke} strokeWidth="2" />
      <rect x={padding} y={topY} width={wallX - padding} height={drawableH} fill="url(#soil-hatch)" opacity="0.4" />
      <polygon
        points={`${wallX},${topY} ${wallX},${baseY} ${wallX - baseLen},${baseY}`}
        fill="rgba(16,185,129,0.22)" stroke={COLORS.passing} strokeWidth="1.2"
      />
      {[0.2, 0.45, 0.7, 0.92].map((t, i) => {
        const y = topY + t * drawableH;
        const al = baseLen * t;
        return (
          <line key={i}
            x1={wallX - al} y1={y}
            x2={wallX - 4} y2={y}
            stroke={COLORS.passing} strokeWidth="1"
            markerEnd="url(#arrow-load)"
          />
        );
      })}
      <ForceArrow
        x={wallX - 50} y={Zp_y} angle={0}
        magnitude={r.Ep_kN} scale={1.5} maxLength={60}
        label={`E_p = ${r.Ep_kN.toFixed(1)} kN/m`}
      />
      <DimLine
        x1={wallX + 18} y1={topY} x2={wallX + 18} y2={baseY}
        label={`D = ${r.input.D_m.toFixed(2)} m`}
      />
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Empuje pasivo (estabiliza al deslizamiento)
      </text>
    </svg>
  );
}

// ===========================================================================
// D6 — 4-section weight breakdown
// ===========================================================================

const SECTION_COLORS = ["#3b82f6", "#06b6d4", "#84cc16", "#f59e0b"];

export function D6_SectionWeights({ r }: { r: RetainingWallLiveResult }) {
  const W = 720, H = 400;
  const leftW = 400;
  const f = makeFrame(leftW, H, r.B_m, r.H_total_m);
  const { c_m, ct_m, b_m, H_m, Hz_m, Bp_m } = r.input;
  const B = r.B_m;

  // Section polygons (in physical coords, converted to px)
  const poly = (pts: [number, number][]) => pts.map(([x, y]) => px(f, x, y).join(",")).join(" ");

  // ① cimentación rect
  const s1 = poly([[0, 0], [B, 0], [B, Hz_m], [0, Hz_m]]);
  // ② pantalla triangular
  const s2 = poly([[b_m + c_m, Hz_m + H_m], [b_m + ct_m, Hz_m], [b_m + c_m, Hz_m]]);
  // ③ pantalla rectangular
  const s3 = poly([[b_m, Hz_m], [b_m + c_m, Hz_m], [b_m + c_m, Hz_m + H_m], [b_m, Hz_m + H_m]]);
  // ④ relleno
  const s4 = poly([[b_m + ct_m, Hz_m], [B, Hz_m], [B, Hz_m + H_m], [b_m + ct_m, Hz_m + H_m]]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <polygon points={s1} fill={SECTION_COLORS[0]} opacity="0.55" stroke={SECTION_COLORS[0]} strokeWidth="1.2" />
      <polygon points={s2} fill={SECTION_COLORS[1]} opacity="0.55" stroke={SECTION_COLORS[1]} strokeWidth="1.2" />
      <polygon points={s3} fill={SECTION_COLORS[2]} opacity="0.55" stroke={SECTION_COLORS[2]} strokeWidth="1.2" />
      <polygon points={s4} fill={SECTION_COLORS[3]} opacity="0.4" stroke={SECTION_COLORS[3]} strokeWidth="1.2" />
      {/* Section badges at centroids */}
      <SectionBadge x={px(f, B / 2, Hz_m / 2)[0]} y={px(f, 0, Hz_m / 2)[1]} n={1} color={SECTION_COLORS[0]} />
      <SectionBadge x={px(f, b_m + c_m + (ct_m - c_m) / 3, Hz_m + H_m / 3)[0]} y={px(f, 0, Hz_m + H_m / 3)[1]} n={2} color={SECTION_COLORS[1]} />
      <SectionBadge x={px(f, b_m + c_m / 2, Hz_m + H_m / 2)[0]} y={px(f, 0, Hz_m + H_m / 2)[1]} n={3} color={SECTION_COLORS[2]} />
      <SectionBadge x={px(f, b_m + ct_m + Bp_m / 2, Hz_m + H_m / 2)[0]} y={px(f, 0, Hz_m + H_m / 2)[1]} n={4} color={SECTION_COLORS[3]} />

      {/* Vertical-load arrows pointing down at each centroid */}
      {r.sections.map((s, i) => {
        const cx = px(f, s.arm_m, Hz_m + H_m / 2)[0];
        return (
          <line
            key={i}
            x1={cx} y1={px(f, 0, Hz_m + H_m + 0.3)[1]}
            x2={cx} y2={px(f, 0, Hz_m + H_m / 2)[1]}
            stroke={COLORS.force} strokeWidth="1.5"
            markerEnd="url(#arrow-force)"
          />
        );
      })}

      {/* Table on the right */}
      <g transform={`translate(${leftW + 10}, 60)`}>
        <text fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace" fontWeight="700">
          Pesos por sección
        </text>
        <text x="8" y={20} textAnchor="middle" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">ID</text>
        <text x="40" y={20} textAnchor="end" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">Peso</text>
        <text x="90" y={20} textAnchor="end" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">Z (m)</text>
        <text x="160" y={20} textAnchor="end" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">M_R</text>
        {r.sections.map((s, i) => (
          <g key={s.id} transform={`translate(0, ${40 + i * 22})`}>
            <circle cx="8" cy="-3" r="7" fill={SECTION_COLORS[i]} />
            <text x="8" y="0" textAnchor="middle" fill="#09090b" fontSize="9" fontWeight="700">{s.id}</text>
            {/* CR-Vis-Bug 2026-05: SVG text collapses runs of leading
                whitespace, so padStart inside <text> rendered as a
                single space and the columns were misaligned. Render
                each column as its own <text> with a fixed x-anchor. */}
            <text x="40" y="0" textAnchor="end" fill={COLORS.textPrimary} fontSize="10" fontFamily="ui-monospace, monospace">
              {s.weight_kN.toFixed(1)}
            </text>
            <text x="90" y="0" textAnchor="end" fill={COLORS.textPrimary} fontSize="10" fontFamily="ui-monospace, monospace">
              {s.arm_m.toFixed(2)}
            </text>
            <text x="160" y="0" textAnchor="end" fill={COLORS.textPrimary} fontSize="10" fontFamily="ui-monospace, monospace">
              {s.moment_kNm.toFixed(1)}
            </text>
          </g>
        ))}
        <line x1="0" y1={40 + r.sections.length * 22 + 4} x2="280" y2={40 + r.sections.length * 22 + 4} stroke={COLORS.textFaint} strokeWidth="0.5" />
        <text y={40 + r.sections.length * 22 + 22} fill={COLORS.passing} fontSize="11" fontFamily="ui-monospace, monospace" fontWeight="700">
          ΣF_v = {r.sumFv_kN.toFixed(1)} kN/m
        </text>
        <text y={40 + r.sections.length * 22 + 40} fill={COLORS.passing} fontSize="11" fontFamily="ui-monospace, monospace" fontWeight="700">
          ΣM_R = {r.sumMr_kNm.toFixed(1)} kN·m/m
        </text>
      </g>
    </svg>
  );
}

// ===========================================================================
// D7 — Vuelco (overturning) with rotation arrow
// ===========================================================================

export function D7_Vuelco({ r }: { r: RetainingWallLiveResult }) {
  const W = 380, H = 320;
  const f = makeFrame(W, H, r.B_m, r.H_total_m);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <polygon points={wallOutlinePoints(f, r)} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Rotation arc about toe */}
      <RotationArrow
        cx={px(f, 0, 0)[0]} cy={px(f, 0, 0)[1]}
        radius={Math.min(120, r.H_total_m * f.scale_m_to_px * 0.85)}
        startAngle={-Math.PI * 0.95} endAngle={-Math.PI * 0.5}
      />
      {/* Force arrows: ΣF_h pushing right */}
      <ForceArrow
        x={px(f, r.input.b_m + r.input.ct_m, r.H_total_m / 2)[0]} y={px(f, 0, r.H_total_m / 2)[1]}
        angle={0} magnitude={r.sumFh_kN} scale={0.6}
        label={`ΣF_h = ${r.sumFh_kN.toFixed(1)} kN`}
      />
      <StatusReadout
        x={W - 145} y={H - 50}
        label="FS Vuelco"
        value={`${r.FS_vuelco.toFixed(2)} (req ≥ ${r.FS_vuelco_min})`}
        pass={r.FS_vuelco_ok}
      />
    </svg>
  );
}

// ===========================================================================
// D8 — Deslizamiento (sliding) horizontal arrow
// ===========================================================================

export function D8_Deslizamiento({ r }: { r: RetainingWallLiveResult }) {
  const W = 380, H = 320;
  const f = makeFrame(W, H, r.B_m, r.H_total_m);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <polygon points={wallOutlinePoints(f, r)} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Sliding arrow */}
      <ForceArrow
        x={px(f, r.input.b_m + r.input.ct_m, r.input.Hz_m / 2)[0]} y={px(f, 0, r.input.Hz_m / 2)[1]}
        angle={0} magnitude={r.sumFh_kN} scale={0.6}
        label="ΣF_h"
      />
      {/* Friction reaction (opposite direction) */}
      <ForceArrow
        x={px(f, r.input.b_m, r.input.Hz_m / 2)[0]} y={px(f, 0, r.input.Hz_m / 2)[1]}
        angle={Math.PI} magnitude={r.Fr_friccion_kN} scale={0.5}
        label={`μ·ΣF_v = ${r.Fr_friccion_kN.toFixed(1)}`}
      />
      {/* Passive contribution */}
      {r.Ep_kN > 0 && (
        <ForceArrow
          x={px(f, 0, r.input.Hz_m + r.input.D_m / 2)[0] - 12} y={px(f, 0, r.input.Hz_m + r.input.D_m / 2)[1]}
          angle={Math.PI} magnitude={r.Ep_kN} scale={0.5}
          label={`E_p = ${r.Ep_kN.toFixed(1)}`}
        />
      )}
      <StatusReadout
        x={W - 145} y={H - 50}
        label="FS Deslizamiento"
        value={`${r.FS_desliz.toFixed(2)} (req ≥ ${r.FS_desliz_min})`}
        pass={r.FS_desliz_ok}
      />
    </svg>
  );
}

// ===========================================================================
// D9 — Pressure distribution selector (trapezoidal ↔ rectangular)
// ===========================================================================

export function D9_PressureDistribution({ r }: { r: RetainingWallLiveResult }) {
  const W = 540, H = 280;
  const padX = 60, padBottom = 80;
  const baseY = H - padBottom;
  const wallTopY = 60;
  const B_px = W - 2 * padX;
  const xL = padX;
  const xR = padX + B_px;

  // Heights of pressure diagram (scaled)
  const maxQ = Math.max(r.qmax_kPa, 1);
  const hMax = 90;
  const hLeft = (r.qmin_kPa / maxQ) * hMax;
  const hRight = hMax;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Mini wall outline above */}
      <rect x={xL + B_px * 0.25} y={wallTopY - 30} width="30" height={baseY - wallTopY + 30} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1" />
      {/* Base line */}
      <line x1={xL - 20} y1={baseY} x2={xR + 20} y2={baseY} stroke={COLORS.textPrimary} strokeWidth="2" />
      {r.presionCase === "trapezoidal" ? (
        <PressureDistribution
          xLeft={xL} xRight={xR} yBase={baseY}
          direction="up-into-base"
          hLeft={hLeft} hRight={hRight}
          labelLeft={`q_min = ${r.qmin_kPa.toFixed(1)} kPa`}
          labelRight={`q_max = ${r.qmax_kPa.toFixed(1)} kPa`}
        />
      ) : (
        <>
          {/* Effective width centered */}
          {(() => {
            const Bp = B_px * (r.Befectivo_m / r.B_m);
            const x0 = xL + (B_px - Bp) / 2;
            return (
              <>
                <PressureDistribution
                  xLeft={x0} xRight={x0 + Bp} yBase={baseY}
                  direction="up-into-base"
                  hLeft={hMax} hRight={hMax}
                  labelLeft="" labelRight={`q_act = ${r.qact_kPa.toFixed(1)} kPa`}
                />
                <DimLine
                  x1={x0} y1={baseY + 30} x2={x0 + Bp} y2={baseY + 30}
                  label={`B' = ${r.Befectivo_m.toFixed(2)} m`}
                />
              </>
            );
          })()}
        </>
      )}
      <DimLine x1={xL} y1={baseY + 55} x2={xR} y2={baseY + 55} label={`B = ${r.B_m.toFixed(2)} m`} />
      <StatusReadout
        x={W - 150} y={H - 25}
        label={r.presionCase === "trapezoidal" ? "Trapezoidal" : "Rectangular B'"}
        value={`e = ${r.e_m.toFixed(3)} m`}
        pass={r.e_ok}
      />
    </svg>
  );
}

// ===========================================================================
// D10 — Pantalla bending + shear (4 diagrams stacked)
// ===========================================================================

export function D10_PantallaBendingShear({ r }: { r: RetainingWallLiveResult }) {
  const W = 720, H = 280;
  const slotW = 160;
  const baseY = H - 50;
  const topY = 30;
  const drawH = baseY - topY;

  // Each slot draws a moment / shear shape
  function Slot({ x, title, magAtBase, kind }: { x: number; title: string; magAtBase: number; kind: "parabolic" | "linear" | "triangular" }) {
    const scaleFn = (t: number) => {
      // t in [0,1], 0 = top, 1 = base
      if (kind === "parabolic") return t * t;
      if (kind === "linear") return t * (2 - t); // grows like sobrecarga shear
      return t;
    };
    const points: string[] = [`${x},${topY}`];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const yy = topY + t * drawH;
      const xx = x + scaleFn(t) * 80;
      points.push(`${xx},${yy}`);
    }
    points.push(`${x},${baseY}`);
    return (
      <g>
        <text x={x + 40} y={topY - 6} textAnchor="middle" fill={COLORS.textPrimary} fontSize="10" fontFamily="ui-monospace, monospace">
          {title}
        </text>
        {/* Wall edge */}
        <line x1={x} y1={topY} x2={x} y2={baseY} stroke={COLORS.concreteStroke} strokeWidth="1.5" />
        <polygon points={points.join(" ")} fill="rgba(245,158,11,0.18)" stroke={COLORS.rebar} strokeWidth="1.2" />
        <text x={x + 90} y={baseY + 12} fill={COLORS.rebar} fontSize="9" fontFamily="ui-monospace, monospace">
          {magAtBase.toFixed(1)}
        </text>
      </g>
    );
  }

  // Compute pantalla-only forces for shear/moment magnitudes
  const E1pant = 0.5 * r.input.gamma_r * r.input.H_m * r.input.H_m * r.Ka;
  const E2pant = r.input.qSC * r.Ka * r.input.H_m;
  const Mpant1 = E1pant * (r.input.H_m / 3);
  const Mpant2 = E2pant * (r.input.H_m / 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <Slot x={40} title="M empuje activo" magAtBase={Mpant1} kind="parabolic" />
      <Slot x={40 + slotW} title="M sobrecarga" magAtBase={Mpant2} kind="linear" />
      <Slot x={40 + slotW * 2} title="V empuje activo" magAtBase={E1pant} kind="triangular" />
      <Slot x={40 + slotW * 3} title="V sobrecarga" magAtBase={E2pant} kind="triangular" />
      <text x={W / 2} y={H - 15} textAnchor="middle" fill={COLORS.textDim} fontSize="10" fontFamily="ui-monospace, monospace">
        Pantalla — análisis a flexión y corte (sin factor de carga)
      </text>
    </svg>
  );
}

// ===========================================================================
// D11 — Final reinforcement scaled elevation (all bars labeled)
// ===========================================================================

export function D11_FinalReinforcement({ r }: { r: RetainingWallLiveResult }) {
  const W = 720, H = 540;
  const f = makeFrame(W, H, r.B_m, r.H_total_m);
  const { c_m, ct_m, b_m, H_m, Hz_m, Bp_m } = r.input;
  const B = r.B_m;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <polygon points={wallOutlinePoints(f, r)} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />

      {/* Acero vertical pantalla — interior (back face) */}
      {(() => {
        const x_back = b_m + c_m + (ct_m - c_m) / 2;
        const [px_back] = px(f, x_back, 0);
        const [, y_top] = px(f, 0, Hz_m + H_m - 0.1);
        const [, y_bot] = px(f, 0, Hz_m + 0.05);
        const lines: Array<{ x: number; label: string; color: string }> = [];
        lines.push({ x: px_back - 4, label: `${r.As_pantalla_size}× Ø${r.As_pantalla_size} @ ${r.As_pantalla_sep_cm.toFixed(0)} cm`, color: COLORS.rebar });
        return (
          <>
            <line x1={lines[0].x} y1={y_top} x2={lines[0].x} y2={y_bot} stroke={lines[0].color} strokeWidth="2" />
            <text x={lines[0].x + 10} y={y_top + 14} fill={lines[0].color} fontSize="10" fontFamily="ui-monospace, monospace">
              Ø{r.As_pantalla_size} @ {r.As_pantalla_sep_cm.toFixed(0)} cm (interior)
            </text>
          </>
        );
      })()}

      {/* Acero vertical pantalla — exterior (front face) */}
      {(() => {
        const x_front = b_m + 0.04;
        const [px_front] = px(f, x_front, 0);
        const [, y_top] = px(f, 0, Hz_m + H_m - 0.1);
        const [, y_bot] = px(f, 0, Hz_m + 0.05);
        return (
          <>
            <line x1={px_front + 4} y1={y_top} x2={px_front + 4} y2={y_bot} stroke={COLORS.rebar} strokeWidth="1.5" strokeDasharray="0" />
            <text x={px_front - 8} y={y_top + 14} textAnchor="end" fill={COLORS.rebar} fontSize="10" fontFamily="ui-monospace, monospace">
              Ø{r.As_pantalla_ext_size} @ {r.As_pantalla_ext_sep_cm.toFixed(0)} cm (exterior)
            </text>
          </>
        );
      })()}

      {/* Acero horizontal pantalla (estribos representados como líneas horizontales) */}
      {(() => {
        const x0 = px(f, b_m + 0.04, 0)[0];
        const x1 = px(f, b_m + ct_m - 0.04, 0)[0];
        const y_top = px(f, 0, Hz_m + H_m - 0.1)[1];
        const y_bot = px(f, 0, Hz_m + 0.1)[1];
        const nStir = 8;
        return Array.from({ length: nStir }).map((_, i) => {
          const t = i / (nStir - 1);
          const y = y_top + t * (y_bot - y_top);
          // Triangular pantalla: x1 shrinks toward top
          const xRight = px(f, b_m + ct_m - (ct_m - c_m) * (1 - t) - 0.04, 0)[0];
          return (
            <line key={i} x1={x0} y1={y} x2={xRight} y2={y}
              stroke={COLORS.stirrup} strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
          );
        });
      })()}

      {/* Acero zapata — talón posterior (longitudinal arriba) */}
      {(() => {
        const x0 = px(f, b_m + ct_m + 0.05, Hz_m)[0];
        const x1 = px(f, B - 0.05, Hz_m)[0];
        const y = px(f, 0, Hz_m - 0.06)[1];
        return (
          <>
            <line x1={x0} y1={y} x2={x1} y2={y} stroke={COLORS.rebar} strokeWidth="2" />
            <text x={(x0 + x1) / 2} y={y - 8} textAnchor="middle" fill={COLORS.rebar} fontSize="10" fontFamily="ui-monospace, monospace">
              Ø{r.As_talonPost_size} @ {r.As_talonPost_sep_cm.toFixed(0)} cm (talón post)
            </text>
          </>
        );
      })()}

      {/* Acero zapata — talón delantero (abajo) */}
      {(() => {
        const x0 = px(f, 0.05, 0)[0];
        const x1 = px(f, b_m - 0.05, 0)[0];
        const y = px(f, 0, 0.06)[1];
        return (
          <>
            <line x1={x0} y1={y} x2={x1} y2={y} stroke={COLORS.rebar} strokeWidth="2" />
            <text x={(x0 + x1) / 2} y={y + 14} textAnchor="middle" fill={COLORS.rebar} fontSize="10" fontFamily="ui-monospace, monospace">
              Ø{r.As_talonDel_size} @ {r.As_talonDel_sep_cm.toFixed(0)} cm (punta)
            </text>
          </>
        );
      })()}

      {/* Dimensions */}
      <DimLine x1={px(f, 0, 0)[0]} y1={f.oy + 24} x2={px(f, B, 0)[0]} y2={f.oy + 24} label={`B = ${B.toFixed(2)} m`} />

      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Esquema final de distribución de acero
      </text>
    </svg>
  );
}

// ===========================================================================
// Wrapper that renders all 11 diagrams in a vertical stack
// ===========================================================================

export function RetainingWallDiagramSet({ r }: { r: RetainingWallLiveResult }) {
  return (
    <div className="space-y-3">
      <DiagramFrame title="D1 — Sección + cargas">
        <D1_CrossSection r={r} />
      </DiagramFrame>
      <DiagramFrame title="D2 — Vista 3D rotable">
        <Rotatable3DWall r={r} />
      </DiagramFrame>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <DiagramFrame title="D3 — Empuje activo">
          <D3_EmpujeActivo r={r} />
        </DiagramFrame>
        <DiagramFrame title="D4 — Empuje sobrecarga">
          <D4_EmpujeSobrecarga r={r} />
        </DiagramFrame>
        <DiagramFrame title="D5 — Empuje pasivo">
          <D5_EmpujePasivo r={r} />
        </DiagramFrame>
      </div>
      <DiagramFrame title="D6 — Pesos por sección">
        <D6_SectionWeights r={r} />
      </DiagramFrame>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DiagramFrame title="D7 — Vuelco" badge={r.FS_vuelco_ok ? "OK" : "FALLA"} badgePass={r.FS_vuelco_ok}>
          <D7_Vuelco r={r} />
        </DiagramFrame>
        <DiagramFrame title="D8 — Deslizamiento" badge={r.FS_desliz_ok ? "OK" : "FALLA"} badgePass={r.FS_desliz_ok}>
          <D8_Deslizamiento r={r} />
        </DiagramFrame>
      </div>
      <DiagramFrame title="D9 — Distribución de presión bajo zapata" badge={r.qadm_ok ? "OK" : "REVISAR"} badgePass={r.qadm_ok}>
        <D9_PressureDistribution r={r} />
      </DiagramFrame>
      <DiagramFrame title="D10 — Flexión y cortante en pantalla">
        <D10_PantallaBendingShear r={r} />
      </DiagramFrame>
      <DiagramFrame title="D11 — Esquema final de armadura">
        <D11_FinalReinforcement r={r} />
      </DiagramFrame>
    </div>
  );
}
