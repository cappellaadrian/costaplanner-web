"use client";

/**
 * Shared SVG primitives — the visual language for every Costaplanner diagram.
 *
 * Every studio page composes engineering drawings from this toolbox so the
 * look-and-feel is uniform: concrete hatch, soil hatch, dimension lines with
 * blue arrowheads, red force vectors whose LENGTH binds to magnitude, amber
 * longitudinal rebar circles, emerald dashed stirrups, real 135° / 90° hook
 * geometry, pressure distribution that auto-switches triangular/trapezoidal/
 * rectangular based on eccentricity.
 *
 * Drawing language standard (matches the user's source PDFs from
 * Luis Maldonado / Structural Tech):
 *   - Concrete = #d4d4d8 fill with 45° hatch pattern in #71717a
 *   - Soil = #b45309 fill with horizontal hatch in #78350f
 *   - Longitudinal rebar = amber circles (#f59e0b) sized by bar diameter
 *   - Stirrups/ties = emerald dashed lines (#10b981, 3,2)
 *   - Spirals = continuous helix in emerald
 *   - Dimension lines = blue (#3b82f6) with arrowheads + numeric callout
 *   - Force vectors = red (#dc2626), length proportional to value
 *   - Critical sections = dashed red (#ef4444, 4,3)
 *   - Pass glow = emerald box-shadow; fail glow = red
 *   - Hooks = real bends, NOT schematic
 *
 * Every primitive is a stateless React component that takes pure props +
 * draws SVG. No animation libraries — React re-renders are the animation.
 */

import type { ReactNode } from "react";
import { ExpandableDiagram } from "./DiagramExpand";

// ===========================================================================
// Style tokens — single source of truth
// ===========================================================================

export const COLORS = {
  concrete: "#d4d4d8",
  concreteStroke: "#71717a",
  concreteHatch: "#a1a1aa",
  soil: "#92400e",
  soilHatch: "#78350f",
  rebar: "#f59e0b",
  rebarStroke: "#fbbf24",
  stirrup: "#10b981",
  spiral: "#10b981",
  dim: "#3b82f6",
  dimText: "#bfdbfe",
  force: "#dc2626",
  forceLight: "#fca5a5",
  critical: "#ef4444",
  passing: "#10b981",
  failing: "#ef4444",
  textPrimary: "#e4e4e7",
  textDim: "#a1a1aa",
  textFaint: "#71717a",
  background: "#09090b",
  bgPanel: "#18181b",
} as const;

// ===========================================================================
// Reusable <defs> patterns — drop in via <SvgDefs /> once per SVG
// ===========================================================================

export function SvgDefs() {
  return (
    <defs>
      {/* Concrete 45° hatch */}
      <pattern
        id="concrete-hatch"
        patternUnits="userSpaceOnUse"
        width="6"
        height="6"
        patternTransform="rotate(45)"
      >
        <rect width="6" height="6" fill={COLORS.concrete} />
        <line x1="0" y1="0" x2="0" y2="6" stroke={COLORS.concreteHatch} strokeWidth="0.8" />
      </pattern>
      {/* Soil horizontal hatch */}
      <pattern
        id="soil-hatch"
        patternUnits="userSpaceOnUse"
        width="10"
        height="10"
      >
        <rect width="10" height="10" fill={COLORS.soil} opacity="0.6" />
        <line x1="0" y1="3" x2="10" y2="3" stroke={COLORS.soilHatch} strokeWidth="0.6" />
        <line x1="0" y1="7" x2="10" y2="7" stroke={COLORS.soilHatch} strokeWidth="0.6" />
      </pattern>
      {/* Arrowhead — blue, dimension */}
      <marker
        id="arrow-dim"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.dim} />
      </marker>
      {/* Arrowhead — red, force */}
      <marker
        id="arrow-force"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.force} />
      </marker>
      {/* Arrowhead — red filled triangle for distributed-load arrows */}
      <marker
        id="arrow-load"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.force} />
      </marker>
    </defs>
  );
}

// ===========================================================================
// DimLine — labeled dimension with arrowheads at both ends
// ===========================================================================

interface DimLineProps {
  x1: number; y1: number; x2: number; y2: number;
  label: string;
  offset?: number;
  textBg?: boolean;
}

export function DimLine({ x1, y1, x2, y2, label, offset = 0, textBg = true }: DimLineProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const nx = len > 0 ? -dy / len : 0;
  const ny = len > 0 ? dx / len : 0;
  const ox1 = x1 + nx * offset;
  const oy1 = y1 + ny * offset;
  const ox2 = x2 + nx * offset;
  const oy2 = y2 + ny * offset;
  const midX = (ox1 + ox2) / 2;
  const midY = (oy1 + oy2) / 2;
  const textW = Math.max(28, label.length * 6.5);
  // If the dim line is too short to fit the label without colliding with
  // the arrowheads, suppress the background rect so the arrowheads remain
  // visible. (CR-Vis-Bug 2026-05: short lines used to hide both arrows
  // behind the textBg.)
  const showTextBg = textBg && len > textW + 14;
  return (
    <g>
      <line
        x1={ox1} y1={oy1} x2={ox2} y2={oy2}
        stroke={COLORS.dim} strokeWidth="1"
        markerStart="url(#arrow-dim)" markerEnd="url(#arrow-dim)"
      />
      {showTextBg && (
        <rect
          x={midX - textW / 2} y={midY - 7}
          width={textW} height="14"
          fill={COLORS.background} stroke={COLORS.dim} strokeWidth="0.5" rx="2"
        />
      )}
      <text
        x={midX} y={midY + 4} textAnchor="middle"
        fill={COLORS.dimText} fontSize="10" fontFamily="ui-monospace, monospace"
      >
        {label}
      </text>
    </g>
  );
}

// ===========================================================================
// ForceArrow — red vector with length proportional to magnitude
// ===========================================================================

interface ForceArrowProps {
  x: number; y: number;
  angle: number; // radians, 0 = right, π/2 = down
  magnitude: number;
  scale?: number; // px per unit magnitude
  label?: string;
  maxLength?: number;
}

export function ForceArrow({
  x, y, angle, magnitude, scale = 1, label, maxLength = 80,
}: ForceArrowProps) {
  // Logarithmic scaling so small AND large magnitudes are both visually
  // distinguishable. log10(1+|F|·scale) keeps small forces visible while
  // preventing 500 kN arrows from extending off canvas.
  // (CR-Vis-Bug 2026-05: linear scaling clamped at maxLength=70 made
  //  every retaining-wall force vector saturate to the same length.)
  const absMag = Math.abs(magnitude);
  const rawLength = absMag > 0 ? (Math.log10(1 + absMag * scale) / Math.log10(1 + 200 * scale)) * maxLength : 0;
  const length = Math.max(8, Math.min(rawLength, maxLength));
  const x2 = x + length * Math.cos(angle);
  const y2 = y + length * Math.sin(angle);
  // Position label perpendicular to the arrow
  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);
  const labelX = (x + x2) / 2 + perpX * 10;
  const labelY = (y + y2) / 2 + perpY * 10;
  return (
    <g>
      <line
        x1={x} y1={y} x2={x2} y2={y2}
        stroke={COLORS.force} strokeWidth="2"
        markerEnd="url(#arrow-force)"
      />
      {label && (
        <text
          x={labelX} y={labelY} textAnchor="middle"
          fill={COLORS.force} fontSize="10" fontFamily="ui-monospace, monospace"
          fontWeight="700"
        >
          {label}
        </text>
      )}
    </g>
  );
}

// ===========================================================================
// DistributedLoad — row of small downward arrows over a horizontal span
// ===========================================================================

interface DistributedLoadProps {
  x: number; y: number; width: number;
  height?: number;
  count?: number;
  label?: string;
  angle?: number; // for inclined loads
}

export function DistributedLoad({
  x, y, width, height = 18, count, label, angle = Math.PI / 2,
}: DistributedLoadProps) {
  const n = count ?? Math.max(3, Math.floor(width / 12));
  const arrowDx = Math.cos(angle) * height;
  const arrowDy = Math.sin(angle) * height;
  return (
    <g>
      <line
        x1={x} y1={y - height} x2={x + width} y2={y - height}
        stroke={COLORS.force} strokeWidth="1.5"
      />
      {Array.from({ length: n + 1 }).map((_, i) => {
        const cx = x + (i / n) * width;
        return (
          <line
            key={i}
            x1={cx} y1={y - height}
            x2={cx + arrowDx - height * Math.cos(angle)}
            y2={cx === x ? y - height + arrowDy : y - height + arrowDy}
            stroke={COLORS.force} strokeWidth="1.2"
            markerEnd="url(#arrow-load)"
          />
        );
      })}
      {/* Cleaner version: a row of straight arrows */}
      {label && (
        <text
          x={x + width / 2} y={y - height - 6} textAnchor="middle"
          fill={COLORS.force} fontSize="10" fontFamily="ui-monospace, monospace"
        >
          {label}
        </text>
      )}
    </g>
  );
}

// Simpler distributed load: a top line + N vertical arrows pointing down.
interface DistributedDownLoadProps {
  xLeft: number; xRight: number; yTop: number; arrowLen?: number;
  count?: number; label?: string;
}

export function DistributedDownLoad({
  xLeft, xRight, yTop, arrowLen = 16, count, label,
}: DistributedDownLoadProps) {
  const width = xRight - xLeft;
  const n = count ?? Math.max(4, Math.floor(width / 15));
  return (
    <g>
      <line
        x1={xLeft} y1={yTop} x2={xRight} y2={yTop}
        stroke={COLORS.force} strokeWidth="1.5"
      />
      {Array.from({ length: n + 1 }).map((_, i) => {
        const cx = xLeft + (i / n) * width;
        return (
          <line
            key={i}
            x1={cx} y1={yTop}
            x2={cx} y2={yTop + arrowLen}
            stroke={COLORS.force} strokeWidth="1.2"
            markerEnd="url(#arrow-load)"
          />
        );
      })}
      {label && (
        <text
          x={xLeft + width / 2} y={yTop - 6} textAnchor="middle"
          fill={COLORS.force} fontSize="10" fontFamily="ui-monospace, monospace"
        >
          {label}
        </text>
      )}
    </g>
  );
}

// ===========================================================================
// PressureDistribution — triangular / rectangular / trapezoidal under a base
// ===========================================================================

interface PressureDistributionProps {
  /** Left x of the base */
  xLeft: number;
  /** Right x of the base */
  xRight: number;
  /** Y of the base line */
  yBase: number;
  /** Drawing direction. "down" = arrows point upward into base (soil pushes up).
   *  "up" = arrows point downward (e.g. weight). */
  direction?: "up-into-base" | "down-from-base";
  /** Heights at left and right ends, in pixels. 0 means triangular. */
  hLeft: number;
  hRight: number;
  labelLeft?: string;
  labelRight?: string;
  fill?: string;
  centroidLabel?: string;
}

export function PressureDistribution({
  xLeft, xRight, yBase,
  direction = "up-into-base",
  hLeft, hRight,
  labelLeft, labelRight,
  fill = "rgba(220, 38, 38, 0.18)",
  centroidLabel,
}: PressureDistributionProps) {
  const sign = direction === "up-into-base" ? -1 : 1;
  const yL = yBase + sign * hLeft;
  const yR = yBase + sign * hRight;

  const points = `${xLeft},${yBase} ${xLeft},${yL} ${xRight},${yR} ${xRight},${yBase}`;

  // Centroid for trapezoid (or triangle): area-weighted centroid x.
  const x_c =
    hLeft + hRight > 0
      ? xLeft + ((xRight - xLeft) * (hLeft + 2 * hRight)) / (3 * (hLeft + hRight))
      : (xLeft + xRight) / 2;
  const arrowCount = Math.max(3, Math.floor((xRight - xLeft) / 18));

  return (
    <g>
      <polygon points={points} fill={fill} stroke={COLORS.force} strokeWidth="1.2" />
      {/* Distributed arrows */}
      {Array.from({ length: arrowCount + 1 }).map((_, i) => {
        const t = i / arrowCount;
        const cx = xLeft + t * (xRight - xLeft);
        const h = hLeft + t * (hRight - hLeft);
        if (h < 2) return null;
        const yArrowStart = yBase + sign * h;
        return (
          <line
            key={i}
            x1={cx} y1={yArrowStart}
            x2={cx} y2={yBase}
            stroke={COLORS.force} strokeWidth="0.9"
            markerEnd="url(#arrow-load)"
          />
        );
      })}
      {labelLeft && (
        <text
          x={xLeft - 6} y={yL + (sign < 0 ? -4 : 12)}
          textAnchor="end" fill={COLORS.force}
          fontSize="9" fontFamily="ui-monospace, monospace"
        >
          {labelLeft}
        </text>
      )}
      {labelRight && (
        <text
          x={xRight + 6} y={yR + (sign < 0 ? -4 : 12)}
          textAnchor="start" fill={COLORS.force}
          fontSize="9" fontFamily="ui-monospace, monospace"
        >
          {labelRight}
        </text>
      )}
      {centroidLabel && (
        <g>
          <circle cx={x_c} cy={yBase + (sign * Math.max(hLeft, hRight)) / 2} r="3" fill={COLORS.force} />
          <text
            x={x_c} y={yBase + sign * (Math.max(hLeft, hRight) / 2 + 14)}
            textAnchor="middle" fill={COLORS.force} fontSize="9"
            fontFamily="ui-monospace, monospace"
          >
            {centroidLabel}
          </text>
        </g>
      )}
    </g>
  );
}

// ===========================================================================
// Rebar primitives — single bar, row of bars, perimeter distribution
// ===========================================================================

export function RebarCircle({
  cx, cy, size, label,
}: {
  cx: number; cy: number; size: number; label?: string;
}) {
  const r = Math.max(2.5, 1.5 + size * 0.4);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={COLORS.rebar} stroke={COLORS.rebarStroke} strokeWidth="0.8" />
      {label && (
        <text
          x={cx} y={cy - r - 2}
          textAnchor="middle" fill={COLORS.rebar}
          fontSize="8" fontFamily="ui-monospace, monospace"
        >
          {label}
        </text>
      )}
    </g>
  );
}

export function RebarRow({
  xLeft, xRight, y, count, size,
}: {
  xLeft: number; xRight: number; y: number; count: number; size: number;
}) {
  if (count <= 0) return null;
  if (count === 1) {
    return <RebarCircle cx={(xLeft + xRight) / 2} cy={y} size={size} />;
  }
  return (
    <g>
      {Array.from({ length: count }).map((_, i) => {
        const cx = xLeft + (i / (count - 1)) * (xRight - xLeft);
        return <RebarCircle key={i} cx={cx} cy={y} size={size} />;
      })}
    </g>
  );
}

/** Distribute N bars around a rectangular perimeter (4 corners + sides). */
export function RebarPerimeter({
  x, y, w, h, count, size, cover,
}: {
  x: number; y: number; w: number; h: number;
  count: number; size: number; cover: number;
}) {
  const n = Math.max(4, count);
  const inX = x + cover;
  const inY = y + cover;
  const inW = w - 2 * cover;
  const inH = h - 2 * cover;
  const positions: Array<[number, number]> = [];
  // Corners
  positions.push([inX, inY], [inX + inW, inY], [inX + inW, inY + inH], [inX, inY + inH]);
  // Distribute remaining around 4 sides
  const remaining = Math.max(0, n - 4);
  const perSide = Math.floor(remaining / 4);
  const extra = remaining % 4;
  const counts = [perSide, perSide, perSide, perSide];
  for (let i = 0; i < extra; i++) counts[i]++;
  // Top intermediate
  for (let i = 0; i < counts[0]; i++) {
    const t = (i + 1) / (counts[0] + 1);
    positions.push([inX + t * inW, inY]);
  }
  // Right
  for (let i = 0; i < counts[1]; i++) {
    const t = (i + 1) / (counts[1] + 1);
    positions.push([inX + inW, inY + t * inH]);
  }
  // Bottom
  for (let i = 0; i < counts[2]; i++) {
    const t = (i + 1) / (counts[2] + 1);
    positions.push([inX + inW - t * inW, inY + inH]);
  }
  // Left
  for (let i = 0; i < counts[3]; i++) {
    const t = (i + 1) / (counts[3] + 1);
    positions.push([inX, inY + inH - t * inH]);
  }
  return (
    <g>
      {positions.map(([cx, cy], i) => (
        <RebarCircle key={i} cx={cx} cy={cy} size={size} />
      ))}
    </g>
  );
}

/** Distribute N bars on a circle (for circular columns). */
export function RebarCircular({
  cx, cy, radius, count, size,
}: {
  cx: number; cy: number; radius: number; count: number; size: number;
}) {
  const n = Math.max(6, count);
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * 2 * Math.PI - Math.PI / 2;
        return (
          <RebarCircle
            key={i}
            cx={cx + radius * Math.cos(a)}
            cy={cy + radius * Math.sin(a)}
            size={size}
          />
        );
      })}
    </g>
  );
}

// ===========================================================================
// Stirrups — closed rectangle (with optional 135° hook ticks)
// ===========================================================================

export function StirrupRect({
  x, y, w, h, label, withHook = true,
}: {
  x: number; y: number; w: number; h: number; label?: string; withHook?: boolean;
}) {
  // Hook = small diagonal ticks at the top-left corner
  return (
    <g>
      <rect
        x={x} y={y} width={w} height={h}
        fill="none" stroke={COLORS.stirrup} strokeWidth="1.4"
        strokeDasharray="3,2"
      />
      {withHook && (
        <line
          x1={x + 1} y1={y + 1}
          x2={x + 6} y2={y - 4}
          stroke={COLORS.stirrup} strokeWidth="1.4"
          strokeDasharray="3,2"
        />
      )}
      {label && (
        <text
          x={x + w / 2} y={y + h + 12}
          textAnchor="middle" fill={COLORS.stirrup}
          fontSize="8" fontFamily="ui-monospace, monospace"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** Stirrup ring projection for circular column elevation (a single horizontal line). */
export function StirrupRing({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <line
      x1={x1} y1={y} x2={x2} y2={y}
      stroke={COLORS.stirrup} strokeWidth="1.2" strokeDasharray="3,2"
    />
  );
}

/** Spiral projection on a column elevation. */
export function SpiralElevation({
  xLeft, xRight, yTop, yBottom, pitch_px,
}: {
  xLeft: number; xRight: number; yTop: number; yBottom: number; pitch_px: number;
}) {
  const width = xRight - xLeft;
  const height = yBottom - yTop;
  const turns = Math.max(2, Math.floor(height / pitch_px));
  const pts: string[] = [];
  const steps = turns * 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const yi = yTop + t * height;
    const phase = (t * turns) * 2 * Math.PI;
    // Project the helix: x oscillates sinusoidally between xLeft and xRight
    const xi = xLeft + (width / 2) * (1 + Math.sin(phase));
    pts.push(`${xi.toFixed(2)},${yi.toFixed(2)}`);
  }
  return (
    <polyline
      points={pts.join(" ")}
      fill="none" stroke={COLORS.spiral} strokeWidth="1.2"
    />
  );
}

// ===========================================================================
// 135° seismic hook detail — used in callouts for ties and beam stirrups
// ===========================================================================

export function Hook135({
  x, y, scale = 1, label, valid = true,
}: {
  x: number; y: number; scale?: number; label?: string; valid?: boolean;
}) {
  const s = scale;
  const color = valid ? COLORS.stirrup : COLORS.failing;
  // Tie goes horizontally then bends 135° upward+left
  const x1 = x;
  const x2 = x + 30 * s;
  const xb = x2 + 8 * s * Math.cos(Math.PI / 4);
  const yb = y - 8 * s * Math.sin(Math.PI / 4);
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="2" />
      <line x1={x2} y1={y} x2={xb} y2={yb} stroke={color} strokeWidth="2" />
      {!valid && (
        <>
          <line x1={x - 5} y1={y - 12} x2={xb + 5} y2={y + 5} stroke={COLORS.failing} strokeWidth="2" />
          <line x1={x - 5} y1={y + 5} x2={xb + 5} y2={y - 12} stroke={COLORS.failing} strokeWidth="2" />
        </>
      )}
      {label && (
        <text
          x={(x1 + xb) / 2} y={y + 18}
          textAnchor="middle" fill={color}
          fontSize="9" fontFamily="ui-monospace, monospace"
        >
          {label}
        </text>
      )}
    </g>
  );
}

// ===========================================================================
// Status badge inside SVGs (pass/fail readouts for FS, capacity checks, etc.)
// ===========================================================================

export function StatusReadout({
  x, y, label, value, pass,
}: {
  x: number; y: number; label: string; value: string; pass: boolean;
}) {
  const color = pass ? COLORS.passing : COLORS.failing;
  return (
    <g>
      <rect
        x={x} y={y - 12} width="130" height="30"
        fill={COLORS.bgPanel} stroke={color} strokeWidth="1.5" rx="4"
      />
      <text
        x={x + 65} y={y - 1}
        textAnchor="middle" fill={COLORS.textDim}
        fontSize="9" fontFamily="ui-monospace, monospace"
        letterSpacing="0.5"
      >
        {label}
      </text>
      <text
        x={x + 65} y={y + 13}
        textAnchor="middle" fill={color}
        fontSize="12" fontFamily="ui-monospace, monospace"
        fontWeight="700"
      >
        {value} {pass ? "✓" : "✗"}
      </text>
    </g>
  );
}

// ===========================================================================
// Section number badge — 1, 2, 3, 4 as in the retaining wall 4-section diagram
// ===========================================================================

export function SectionBadge({
  x, y, n, color,
}: {
  x: number; y: number; n: number; color: string;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r="11" fill={color} stroke={COLORS.textPrimary} strokeWidth="1" />
      <text
        x={x} y={y + 4} textAnchor="middle"
        fill={COLORS.background} fontSize="13" fontWeight="700"
        fontFamily="ui-monospace, monospace"
      >
        {n}
      </text>
    </g>
  );
}

// ===========================================================================
// Diagram wrapper — gives every diagram a consistent header + frame
// ===========================================================================

interface DiagramFrameProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgePass?: boolean;
  children: ReactNode;
}

export function DiagramFrame({ title, subtitle, badge, badgePass, children }: DiagramFrameProps) {
  // Defer importing ExpandableDiagram to keep this file usable in any
  // context. It's a regular import below — no circular reference.
  return (
    <div className="border border-zinc-800 rounded-lg bg-zinc-900/30">
      <div className="flex items-baseline justify-between gap-2 px-3 py-2 border-b border-zinc-800">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">{title}</div>
          {subtitle && <div className="text-[9px] text-zinc-600 mt-0.5">{subtitle}</div>}
        </div>
        {badge && (
          <span
            className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
              badgePass
                ? "bg-emerald-900/40 text-emerald-300 border-emerald-800"
                : "bg-red-900/40 text-red-300 border-red-800"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="p-2">
        <ExpandableDiagram title={title}>{children}</ExpandableDiagram>
      </div>
    </div>
  );
}

// ===========================================================================
// Curved rotation arrow — for overturning safety-factor diagram
// ===========================================================================

export function RotationArrow({
  cx, cy, radius, startAngle, endAngle, color = COLORS.force,
}: {
  cx: number; cy: number; radius: number;
  startAngle: number; endAngle: number; color?: string;
}) {
  const x1 = cx + radius * Math.cos(startAngle);
  const y1 = cy + radius * Math.sin(startAngle);
  const x2 = cx + radius * Math.cos(endAngle);
  const y2 = cy + radius * Math.sin(endAngle);
  const sweepFlag = endAngle > startAngle ? 1 : 0;
  const path = `M ${x1} ${y1} A ${radius} ${radius} 0 0 ${sweepFlag} ${x2} ${y2}`;
  return (
    <path
      d={path} fill="none" stroke={color} strokeWidth="2"
      markerEnd="url(#arrow-force)"
    />
  );
}
