"use client";

/**
 * Remaining element diagrams — strip footing, slabs (1-way + 2-way),
 * tie beam, shear wall, stair, lintel. Each exports its own
 * `<ElementDiagramSet>` wrapper used by its studio page.
 */

import {
  SvgDefs, DimLine, RebarRow, RebarCircle, DiagramFrame, COLORS,
  PressureDistribution, DistributedDownLoad, Hook135,
} from "./svg-primitives";
import type { StripFootingLiveResult } from "@/lib/strip-footing-live";
import type { OneWaySlabLiveResult } from "@/lib/one-way-slab-live";
import type { TwoWaySlabLiveResult } from "@/lib/two-way-slab-live";
import type { TieBeamLiveResult } from "@/lib/tie-beam-live";
import type { ShearWallLiveResult } from "@/lib/shear-wall-live";
import type { StairLiveResult } from "@/lib/stair-slab-live";
import type { LintelLiveResult } from "@/lib/lintel-live";

// ===========================================================================
// STRIP FOOTING
// ===========================================================================

export function StripSeccion({ r }: { r: StripFootingLiveResult }) {
  const W = 460, H = 320;
  const padding = 60;
  const scale = (W - 2 * padding) / Math.max(r.B, 1);
  const fw = r.B * scale;
  const fh = Math.min(110, r.h * 1.5);
  const x0 = (W - fw) / 2;
  const y0 = H - 80 - fh;
  const wallW = (r.b_muro / 100) * scale;
  const wallX = x0 + (fw - wallW) / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <rect x={wallX} y={y0 - 70} width={wallW} height={70} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      <rect x={x0} y={y0} width={fw} height={fh} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      <RebarRow xLeft={x0 + 8} xRight={x0 + fw - 8} y={y0 + fh - 8} count={r.n} size={r.size} />
      <line x1={x0 + 8} y1={y0 + 6} x2={x0 + fw - 8} y2={y0 + 6} stroke={COLORS.rebar} strokeWidth="1.5" opacity="0.6" />
      <DimLine x1={x0} y1={y0 + fh + 22} x2={x0 + fw} y2={y0 + fh + 22} label={`B = ${r.B.toFixed(2)} m`} />
      <DimLine x1={x0 + fw + 22} y1={y0} x2={x0 + fw + 22} y2={y0 + fh} label={`h = ${r.h} cm`} />
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Sección — {r.n} Ø{r.size} @ {r.s.toFixed(0)} cm
      </text>
    </svg>
  );
}

export function StripPressure({ r }: { r: StripFootingLiveResult }) {
  const W = 460, H = 220;
  const padding = 60;
  const scale = (W - 2 * padding) / Math.max(r.B, 1);
  const fw = r.B * scale;
  const x0 = (W - fw) / 2;
  const baseY = H - 60;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <rect x={x0} y={baseY - 20} width={fw} height={20} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1" />
      <line x1={x0 - 10} y1={baseY} x2={x0 + fw + 10} y2={baseY} stroke={COLORS.textPrimary} strokeWidth="2" />
      <PressureDistribution
        xLeft={x0} xRight={x0 + fw} yBase={baseY}
        direction="up-into-base"
        hLeft={(r.qu / Math.max(r.q_cap, 0.01)) * 70}
        hRight={(r.qu / Math.max(r.q_cap, 0.01)) * 70}
        labelRight={`q_u = ${r.qu.toFixed(2)} ton/m²`}
      />
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Reacción uniforme bajo la zapata
      </text>
    </svg>
  );
}

export function StripFootingDiagramSet({ r }: { r: StripFootingLiveResult }) {
  return (
    <div className="space-y-3">
      <DiagramFrame title="SF-1 — Sección transversal">
        <StripSeccion r={r} />
      </DiagramFrame>
      <DiagramFrame title="SF-2 — Reacción del suelo">
        <StripPressure r={r} />
      </DiagramFrame>
    </div>
  );
}

// ===========================================================================
// ONE-WAY SLAB
// ===========================================================================

export function OWSSection({ r }: { r: OneWaySlabLiveResult }) {
  const W = 460, H = 200;
  const padding = 40;
  const sw = W - 2 * padding;
  const sh = Math.min(80, r.h * 4);
  const x0 = padding;
  const y0 = H / 2 - sh / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <rect x={x0} y={y0} width={sw} height={sh} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Bottom bars (main) */}
      {Array.from({ length: 10 }).map((_, i) => {
        const cx = x0 + 10 + (i * (sw - 20)) / 9;
        return <RebarCircle key={`b${i}`} cx={cx} cy={y0 + sh - 6} size={r.size} />;
      })}
      {/* Top bars (temperature) */}
      {Array.from({ length: 6 }).map((_, i) => {
        const cx = x0 + 10 + (i * (sw - 20)) / 5;
        return <RebarCircle key={`t${i}`} cx={cx} cy={y0 + 6} size={r.size_temp} />;
      })}
      <DimLine x1={x0} y1={y0 + sh + 18} x2={x0 + sw} y2={y0 + sh + 18} label={`L = ${r.Ln.toFixed(2)} m`} />
      <DimLine x1={x0 + sw + 14} y1={y0} x2={x0 + sw + 14} y2={y0 + sh} label={`h = ${r.h} cm`} />
      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Sección por metro — Ø{r.size}@{r.s.toFixed(0)}cm + temp Ø{r.size_temp}@{r.s_temp.toFixed(0)}cm
      </text>
    </svg>
  );
}

export function OWSMomentDiagram({ r }: { r: OneWaySlabLiveResult }) {
  const W = 560, H = 200;
  const padding = 40;
  const xL = padding, xR = W - padding;
  const yMid = H / 2;
  // CR-Vis-Bug 2026-05: previously `50 * sign(Cm) * |Cm| * 10` produced
  // amplitudes up to ±500 that overflowed the H=200 viewBox. Clamp the
  // moment-arc amplitude to fit within H/2 - 20 px headroom.
  const maxAmp = H / 2 - 20;
  const rawAmp = Math.sign(r.Cm || 1) * Math.abs(r.Cm) * 600;
  const amp = Math.max(-maxAmp, Math.min(maxAmp, rawAmp));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <line x1={xL} y1={yMid} x2={xR} y2={yMid} stroke={COLORS.textDim} strokeWidth="1" />
      <path d={`M ${xL} ${yMid} Q ${(xL + xR) / 2} ${yMid - amp} ${xR} ${yMid}`}
        fill="none" stroke={COLORS.rebar} strokeWidth="2" />
      <text x={(xL + xR) / 2} y={yMid - amp - 8} textAnchor="middle" fill={COLORS.rebar} fontSize="10" fontFamily="ui-monospace, monospace">
        Mu = {r.Mu.toFixed(2)} ton·m/m
      </text>
      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Diagrama de momento — Cm = {r.Cm.toFixed(4)}
      </text>
    </svg>
  );
}

export function OneWaySlabDiagramSet({ r }: { r: OneWaySlabLiveResult }) {
  return (
    <div className="space-y-3">
      <DiagramFrame title="OWS-1 — Sección por metro">
        <OWSSection r={r} />
      </DiagramFrame>
      <DiagramFrame title="OWS-2 — Diagrama de momento">
        <OWSMomentDiagram r={r} />
      </DiagramFrame>
    </div>
  );
}

// ===========================================================================
// TWO-WAY SLAB
// ===========================================================================

export function TWSPlan({ r }: { r: TwoWaySlabLiveResult }) {
  const W = 420, H = 360;
  const padding = 50;
  const drawW = W - 2 * padding;
  const drawH = H - 2 * padding;
  const scale = Math.min(drawW / r.b, drawH / r.a) * 0.85;
  const pw = r.b * scale;
  const ph = r.a * scale;
  const x0 = (W - pw) / 2;
  const y0 = (H - ph) / 2;
  // Column strips: 1/4 of each side
  const colStripW = pw / 4;
  const colStripH = ph / 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <rect x={x0} y={y0} width={pw} height={ph} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Column strips overlay */}
      <rect x={x0} y={y0} width={colStripW} height={ph} fill="rgba(245,158,11,0.10)" stroke={COLORS.rebar} strokeWidth="0.5" strokeDasharray="2,2" />
      <rect x={x0 + pw - colStripW} y={y0} width={colStripW} height={ph} fill="rgba(245,158,11,0.10)" stroke={COLORS.rebar} strokeWidth="0.5" strokeDasharray="2,2" />
      <rect x={x0} y={y0} width={pw} height={colStripH} fill="rgba(245,158,11,0.10)" stroke={COLORS.rebar} strokeWidth="0.5" strokeDasharray="2,2" />
      <rect x={x0} y={y0 + ph - colStripH} width={pw} height={colStripH} fill="rgba(245,158,11,0.10)" stroke={COLORS.rebar} strokeWidth="0.5" strokeDasharray="2,2" />
      {/* Corners (columns). CR-Vis-Bug 2026-05: previously the 16×16
          rects were centered on the slab corner, so half hung outside
          the plan polygon. Render them flush INSIDE each corner so the
          columns visually support the slab. */}
      {[[x0, y0], [x0 + pw - 14, y0], [x0, y0 + ph - 14], [x0 + pw - 14, y0 + ph - 14]].map(([rx, ry], i) => (
        <rect key={i} x={rx} y={ry} width="14" height="14" fill="#52525b" stroke={COLORS.textPrimary} strokeWidth="1" />
      ))}
      {/* Direction arrows */}
      <line x1={x0 + 20} y1={y0 + ph / 2} x2={x0 + pw - 20} y2={y0 + ph / 2} stroke={COLORS.rebar} strokeWidth="1.5" markerEnd="url(#arrow-force)" />
      <text x={x0 + pw / 2} y={y0 + ph / 2 - 6} textAnchor="middle" fill={COLORS.rebar} fontSize="9" fontFamily="ui-monospace, monospace">
        b = {r.b.toFixed(2)} m
      </text>
      <line x1={x0 + pw / 2} y1={y0 + 20} x2={x0 + pw / 2} y2={y0 + ph - 20} stroke={COLORS.rebar} strokeWidth="1.5" markerEnd="url(#arrow-force)" />
      <text x={x0 + pw / 2 + 6} y={y0 + ph / 2 + 14} fill={COLORS.rebar} fontSize="9" fontFamily="ui-monospace, monospace">
        a = {r.a.toFixed(2)} m
      </text>
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Planta — franjas de columna (sombreadas) vs central · m = {r.m_ratio.toFixed(2)}
      </text>
    </svg>
  );
}

export function TwoWaySlabDiagramSet({ r }: { r: TwoWaySlabLiveResult }) {
  return (
    <div className="space-y-3">
      <DiagramFrame title="TWS-1 — Planta + franjas">
        <TWSPlan r={r} />
      </DiagramFrame>
    </div>
  );
}

// ===========================================================================
// TIE BEAM
// ===========================================================================

export function TieBeamSection({ r }: { r: TieBeamLiveResult }) {
  const W = 280, H = 280;
  const padding = 50;
  const drawSize = W - 2 * padding;
  const scale = Math.min(drawSize / r.b, drawSize / r.h) * 0.8;
  const bw = r.b * scale;
  const bh = r.h * scale;
  const x0 = (W - bw) / 2;
  const y0 = (H - bh) / 2;
  const cover = 4 * scale;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <rect x={x0} y={y0} width={bw} height={bh} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      <rect x={x0 + cover} y={y0 + cover}
        width={bw - 2 * cover} height={bh - 2 * cover}
        fill="none" stroke={COLORS.stirrup} strokeWidth="1.5" strokeDasharray="3,2" />
      <RebarRow xLeft={x0 + cover + 4} xRight={x0 + bw - cover - 4} y={y0 + cover + 6} count={2} size={5} />
      <RebarRow xLeft={x0 + cover + 4} xRight={x0 + bw - cover - 4} y={y0 + bh - cover - 6} count={2} size={5} />
      <DimLine x1={x0} y1={y0 + bh + 18} x2={x0 + bw} y2={y0 + bh + 18} label={`b = ${r.b} cm`} />
      <DimLine x1={x0 + bw + 18} y1={y0} x2={x0 + bw + 18} y2={y0 + bh} label={`h = ${r.h} cm`} />
      <text x={W / 2} y={H - 12} textAnchor="middle" fill={COLORS.rebar} fontSize="10" fontFamily="ui-monospace, monospace">
        2 Ø5 sup + 2 Ø5 inf + Estr. #3 @ 20 cm
      </text>
    </svg>
  );
}

export function TieBeamPlan({ r }: { r: TieBeamLiveResult }) {
  const W = 460, H = 280;
  const padding = 40;
  // Sample 3x3 grid of zapatas + tie beams
  const grid = 3;
  const gw = W - 2 * padding;
  const gh = H - 2 * padding;
  const stepX = gw / (grid - 1);
  const stepY = gh / (grid - 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Zapatas at grid intersections */}
      {Array.from({ length: grid }).flatMap((_, i) =>
        Array.from({ length: grid }).map((_, j) => {
          const cx = padding + i * stepX;
          const cy = padding + j * stepY;
          return <rect key={`${i}${j}`} x={cx - 14} y={cy - 14} width="28" height="28" fill={COLORS.concrete} stroke={COLORS.concreteStroke} strokeWidth="1" />;
        })
      )}
      {/* Tie beams connecting */}
      {Array.from({ length: grid }).flatMap((_, i) =>
        Array.from({ length: grid - 1 }).map((_, j) => {
          const x1 = padding + i * stepX;
          const y1 = padding + j * stepY + 14;
          const y2 = padding + (j + 1) * stepY - 14;
          return <line key={`v${i}${j}`} x1={x1} y1={y1} x2={x1} y2={y2} stroke={COLORS.rebar} strokeWidth="3" />;
        })
      )}
      {Array.from({ length: grid - 1 }).flatMap((_, i) =>
        Array.from({ length: grid }).map((_, j) => {
          const y1 = padding + j * stepY;
          const x1 = padding + i * stepX + 14;
          const x2 = padding + (i + 1) * stepX - 14;
          return <line key={`h${i}${j}`} x1={x1} y1={y1} x2={x2} y2={y1} stroke={COLORS.rebar} strokeWidth="3" />;
        })
      )}
      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Plan de cimentación — vigas de amarre entre zapatas
      </text>
      <text x={W / 2} y={H - 10} textAnchor="middle" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">
        L = {r.L.toFixed(1)} m entre zapatas
      </text>
    </svg>
  );
}

export function TieBeamDiagramSet({ r }: { r: TieBeamLiveResult }) {
  return (
    <div className="space-y-3">
      <DiagramFrame title="TB-1 — Sección transversal">
        <TieBeamSection r={r} />
      </DiagramFrame>
      <DiagramFrame title="TB-2 — Plan de cimentación">
        <TieBeamPlan r={r} />
      </DiagramFrame>
    </div>
  );
}

// ===========================================================================
// SHEAR WALL
// ===========================================================================

export function ShearWallElevation({ r }: { r: ShearWallLiveResult }) {
  const W = 360, H = 460;
  const padding = 60;
  const drawW = W - 2 * padding;
  const drawH = H - 2 * padding;
  const scale = Math.min(drawW / r.lw, drawH / r.hw) * 0.85;
  const ww = r.lw * scale;
  const wh = r.hw * scale;
  const x0 = (W - ww) / 2;
  const y0 = (H - wh) / 2;
  const nv = r.dos_cortinas ? 12 : 7;
  const nh = Math.floor(wh / 30);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <rect x={x0} y={y0} width={ww} height={wh} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Vertical bars */}
      {Array.from({ length: nv }).map((_, i) => {
        const cx = x0 + 6 + (i * (ww - 12)) / (nv - 1);
        return <line key={`v${i}`} x1={cx} y1={y0 + 4} x2={cx} y2={y0 + wh - 4} stroke={COLORS.rebar} strokeWidth="1.5" opacity={r.dos_cortinas ? 0.9 : 0.7} />;
      })}
      {/* Horizontal bars */}
      {Array.from({ length: nh }).map((_, i) => {
        const cy = y0 + 6 + (i * (wh - 12)) / (nh - 1);
        return <line key={`h${i}`} x1={x0 + 4} y1={cy} x2={x0 + ww - 4} y2={cy} stroke={COLORS.stirrup} strokeWidth="1" strokeDasharray="3,2" />;
      })}
      <DimLine x1={x0} y1={y0 + wh + 22} x2={x0 + ww} y2={y0 + wh + 22} label={`lw = ${r.lw} m`} />
      <DimLine x1={x0 + ww + 22} y1={y0} x2={x0 + ww + 22} y2={y0 + wh} label={`hw = ${r.hw} m`} />
      <text x={W / 2} y={H - 12} textAnchor="middle" fill={COLORS.textPrimary} fontSize="10" fontFamily="ui-monospace, monospace">
        {r.dos_cortinas ? "Doble cortina" : "Una cortina"} · t = {r.t} cm · ρ = {(r.rho_min * 100).toFixed(3)}%
      </text>
    </svg>
  );
}

export function ShearWallDiagramSet({ r }: { r: ShearWallLiveResult }) {
  return (
    <div className="space-y-3">
      <DiagramFrame title="SW-1 — Elevación con cortinas">
        <ShearWallElevation r={r} />
      </DiagramFrame>
    </div>
  );
}

// ===========================================================================
// STAIR
// ===========================================================================

export function StairProfile({ r }: { r: StairLiveResult }) {
  const W = 540, H = 320;
  const padding = 40;
  const scale = (W - 2 * padding) / Math.max(r.L_horiz, 1);
  const Lpx = r.L_horiz * scale;
  const rise = r.C;
  const tread = r.H;
  const totalRise = (r.L_horiz * (rise / tread));
  // CR-Vis-Bug 2026-05: clamp RisePx so the stair polygon never
  // exceeds the available H-2*padding and never back-tracks through
  // the step edges when totalRise is large.
  const maxRise = H - 2 * padding - 40;
  const RisePx = Math.min(maxRise, totalRise * scale * 0.4);
  const x0 = padding;
  const y0 = H - 40;
  const steps = Math.max(3, Math.floor((r.L_horiz * 100) / tread));
  const stepW = Lpx / steps;
  const stepH = RisePx / steps;
  const pts: string[] = [`${x0},${y0}`];
  for (let i = 0; i < steps; i++) {
    const xa = x0 + i * stepW;
    const ya = y0 - i * stepH;
    pts.push(`${xa},${ya}`);
    pts.push(`${xa + stepW},${ya}`);
    pts.push(`${xa + stepW},${ya - stepH}`);
  }
  // Bottom face of slab — parallel to the stair stringer (offset
  // perpendicular by ~16 px) so the polygon stays simple (no
  // self-intersecting edges). Previously the bottom return ran
  // backward through the steps when RisePx was large.
  const slabT = 16;
  pts.push(`${x0 + Lpx},${y0 - RisePx + slabT}`);
  pts.push(`${x0},${y0 + slabT}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <polygon points={pts.join(" ")} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Escalera — C = {r.C} cm · H = {r.H} cm · 2C+H = {r.ergo} cm
      </text>
      <DimLine x1={x0} y1={y0 + 36} x2={x0 + Lpx} y2={y0 + 36} label={`L horiz = ${r.L_horiz.toFixed(2)} m`} />
    </svg>
  );
}

export function StairDiagramSet({ r }: { r: StairLiveResult }) {
  return (
    <div className="space-y-3">
      <DiagramFrame title="ST-1 — Perfil"
        badge={r.ergo >= 60 && r.ergo <= 66 ? "Ergonomía OK" : "Fuera de rango"}
        badgePass={r.ergo >= 60 && r.ergo <= 66}>
        <StairProfile r={r} />
      </DiagramFrame>
    </div>
  );
}

// ===========================================================================
// LINTEL
// ===========================================================================

export function LintelElevation({ r }: { r: LintelLiveResult }) {
  const W = 420, H = 260;
  const padding = 50;
  const drawW = W - 2 * padding;
  const fwBase = Math.max(r.a, 100);
  const scale = drawW / fwBase;
  const lintelW = r.a * scale;
  const lintelH = Math.max(30, r.h * 1.4);
  const x0 = (W - lintelW) / 2;
  const y0 = H / 2 - lintelH / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Masonry walls on sides */}
      <rect x={x0 - 40} y={y0} width="40" height={lintelH + 70} fill="#3f3f46" />
      <rect x={x0 + lintelW} y={y0} width="40" height={lintelH + 70} fill="#3f3f46" />
      <rect x={x0} y={y0} width={lintelW} height={lintelH} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Bottom bars */}
      <line x1={x0 + 6} y1={y0 + lintelH - 6} x2={x0 + lintelW - 6} y2={y0 + lintelH - 6} stroke={COLORS.rebar} strokeWidth="2" />
      <line x1={x0 + 6} y1={y0 + 6} x2={x0 + lintelW - 6} y2={y0 + 6} stroke={COLORS.rebar} strokeWidth="1.5" opacity="0.7" />
      <DimLine x1={x0} y1={y0 + lintelH + 24} x2={x0 + lintelW} y2={y0 + lintelH + 24} label={`a = ${r.a} cm`} />
      <DimLine x1={x0 + lintelW + 16} y1={y0} x2={x0 + lintelW + 16} y2={y0 + lintelH} label={`h = ${r.h} cm`} />
      {r.deepBeam && (
        <text x={W / 2} y={H - 12} textAnchor="middle" fill={COLORS.failing} fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="700">
          a/d = {r.a_d_ratio.toFixed(2)} &lt; 2 → viga profunda
        </text>
      )}
      {!r.deepBeam && (
        <text x={W / 2} y={H - 12} textAnchor="middle" fill={COLORS.passing} fontSize="10" fontFamily="ui-monospace, monospace">
          {r.n} Ø{r.size} (inferior)
        </text>
      )}
    </svg>
  );
}

export function LintelDiagramSet({ r }: { r: LintelLiveResult }) {
  return (
    <div className="space-y-3">
      <DiagramFrame title="LT-1 — Elevación sobre vano">
        <LintelElevation r={r} />
      </DiagramFrame>
    </div>
  );
}
