"use client";

/**
 * 9 reactive engineering diagrams for the isolated footing.
 * Ported from PDF B (Luis Maldonado / Structural Tech). Every diagram
 * binds to IsolatedFootingLiveResult — full reactivity on input edit.
 *
 * Diagrams (D12–D20):
 *   D12 — Plan view (L × S, column centered, soil layers in plan)
 *   D13 — Elevación dirección X (terreno + piso + zapata + columna)
 *   D14 — Elevación dirección Y
 *   D15 — Anclaje L_db detail at column rebar entering footing
 *   D16 — Pressure distribution under footing (auto trapezoidal / triangular)
 *   D17 — Cortante 1-dir L at d from face
 *   D18 — Cortante 1-dir S at d from face
 *   D19 — Punzonamiento perimeter at d/2 (plan with dashed b_o)
 *   D20 — Final rebar layout (plan + section, concentrated band + edge bars)
 */

import {
  SvgDefs, DimLine, DistributedDownLoad,
  PressureDistribution, RebarRow, RebarCircle, StirrupRect,
  DiagramFrame, COLORS,
} from "./svg-primitives";
import type { IsolatedFootingLiveResult } from "@/lib/isolated-footing-live";

interface Frame2D {
  W: number; H: number;
  ox: number; oy: number;
  scale: number;
}

// ===========================================================================
// D12 — Plan view
// ===========================================================================

export function D12_PlanView({ r }: { r: IsolatedFootingLiveResult }) {
  const W = 460, H = 460;
  const padding = 50;
  const drawW = W - 2 * padding;
  const drawH = H - 2 * padding;
  const scale = Math.min(drawW / r.B, drawH / r.L) * 0.85;
  const fw = r.B * scale;
  const fh = r.L * scale;
  const fx = (W - fw) / 2;
  const fy = (H - fh) / 2;
  const cw = (r.bc / 100) * scale;
  const ch = (r.lc / 100) * scale;
  const cx = fx + (fw - cw) / 2;
  const cy = fy + (fh - ch) / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <rect x={fx} y={fy} width={fw} height={fh} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      <rect x={cx} y={cy} width={cw} height={ch} fill="#52525b" stroke={COLORS.rebarStroke} strokeWidth="1.5" />
      <DimLine x1={fx} y1={fy + fh + 22} x2={fx + fw} y2={fy + fh + 22} label={`L = ${r.B.toFixed(2)} m`} />
      <DimLine x1={fx + fw + 22} y1={fy} x2={fx + fw + 22} y2={fy + fh} label={`S = ${r.L.toFixed(2)} m`} />
      <DimLine x1={cx} y1={cy + ch + 6} x2={cx + cw} y2={cy + ch + 6} label={`C₁ = ${r.bc} cm`} textBg={false} />
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Planta — columna {r.bc}×{r.lc} cm centrada
      </text>
    </svg>
  );
}

// ===========================================================================
// D13/D14 — Elevations with soil layers
// ===========================================================================

function ElevationView({ r, dir }: { r: IsolatedFootingLiveResult; dir: "X" | "Y" }) {
  const W = 420, H = 360;
  // Pretend layers: terreno (sky), piso (light gray), zapata, column
  const padding = 50;
  const drawW = W - 2 * padding;
  const fwBase = dir === "X" ? r.B : r.L;
  const cwBase = dir === "X" ? r.bc / 100 : r.lc / 100;
  const scale = drawW / Math.max(fwBase, 2);
  const fw = fwBase * scale;
  // Heights (m): terreno_top ~ 2.5 m, piso 0.15 m, zapata h, column from zapata top to ground
  const h_terreno = 2.5; // arbitrary visual
  const h_piso = 0.15;
  const h_zapata = r.h / 100;
  const total_h_m = h_terreno + h_zapata + 0.4;  // 0.4 m of column above ground for clarity
  const yScale = (H - 60) / total_h_m;
  const baseY = H - 30;
  const zapataTopY = baseY - h_zapata * yScale;
  const pisoTopY = zapataTopY - h_piso * yScale;
  const groundY = zapataTopY - h_terreno * yScale;
  const fx = (W - fw) / 2;
  const cw = cwBase * scale;
  const cx = fx + (fw - cw) / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Terreno (soil) */}
      <rect x={0} y={groundY} width={W} height={baseY - groundY} fill="url(#soil-hatch)" opacity="0.5" />
      {/* Piso de concreto */}
      <rect x={0} y={pisoTopY} width={W} height={h_piso * yScale} fill={COLORS.concrete} stroke={COLORS.concreteStroke} strokeWidth="0.5" />
      <text x={W - 10} y={pisoTopY - 2} textAnchor="end" fill={COLORS.textDim} fontSize="8" fontFamily="ui-monospace, monospace">
        Piso de concreto
      </text>
      <text x={W - 10} y={groundY - 4} textAnchor="end" fill={COLORS.textDim} fontSize="8" fontFamily="ui-monospace, monospace">
        Terreno
      </text>
      {/* Zapata */}
      <rect x={fx} y={zapataTopY} width={fw} height={h_zapata * yScale} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Column rising through */}
      <rect x={cx} y={pisoTopY - 0.6 * yScale} width={cw} height={(zapataTopY - pisoTopY) + 0.6 * yScale} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Dimensions */}
      <DimLine x1={fx} y1={baseY + 12} x2={fx + fw} y2={baseY + 12} label={`${dir === "X" ? "L" : "S"} = ${fwBase.toFixed(2)} m`} />
      <DimLine x1={fx - 14} y1={zapataTopY} x2={fx - 14} y2={baseY} label={`h = ${r.h} cm`} />
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Elevación dirección {dir}
      </text>
    </svg>
  );
}

export function D13_ElevationX({ r }: { r: IsolatedFootingLiveResult }) {
  return <ElevationView r={r} dir="X" />;
}

export function D14_ElevationY({ r }: { r: IsolatedFootingLiveResult }) {
  return <ElevationView r={r} dir="Y" />;
}

// ===========================================================================
// D15 — Anclaje L_db detail
// ===========================================================================

export function D15_AnclajeLdb({ r }: { r: IsolatedFootingLiveResult }) {
  const W = 380, H = 240;
  const padding = 50;
  // Show a zoomed-in section: column entering zapata, bar bent with hook
  const zapata_h = 90;  // fixed visual height
  const zapata_w = 280;
  const zx = (W - zapata_w) / 2;
  const zy = H - padding - zapata_h;
  const colW = 60;
  const colX = zx + (zapata_w - colW) / 2;

  // Bar properties: 5/8" default, length scaled
  const barLength = 60; // visual
  const hookOffset = 12;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Zapata */}
      <rect x={zx} y={zy} width={zapata_w} height={zapata_h} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Column */}
      <rect x={colX} y={padding - 20} width={colW} height={zy - padding + 20} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Two longitudinal rebars in column going down with 90° hook into zapata */}
      {[colX + 8, colX + colW - 8].map((bx, i) => (
        <g key={i}>
          <line x1={bx} y1={padding - 10} x2={bx} y2={zy + zapata_h - 10} stroke={COLORS.rebar} strokeWidth="2" />
          {/* 90° hook */}
          <line
            x1={bx} y1={zy + zapata_h - 10}
            x2={bx + (i === 0 ? -hookOffset : hookOffset)} y2={zy + zapata_h - 10}
            stroke={COLORS.rebar} strokeWidth="2"
          />
        </g>
      ))}
      {/* L_db dimension */}
      <DimLine
        x1={colX - 14} y1={zy}
        x2={colX - 14} y2={zy + zapata_h - 10}
        label="L_db"
      />
      {/* CR-Vis-Bug 2026-05: previously offset=-30 pushed the h_z label
          past the SVG left edge (padding=50). Render the dim line
          inboard of the zapata edge instead. */}
      <DimLine x1={zx + 14} y1={zy} x2={zx + 14} y2={zy + zapata_h} label={`h_z = ${r.h} cm`} />
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Anclaje del acero de la columna en la zapata
      </text>
    </svg>
  );
}

// ===========================================================================
// D16 — Pressure distribution under footing
// ===========================================================================

export function D16_PressureDist({ r }: { r: IsolatedFootingLiveResult }) {
  const W = 500, H = 260;
  const padding = 50;
  const baseY = H - 80;
  const fw = W - 2 * padding;
  const xL = padding;
  const xR = padding + fw;

  const maxQ = Math.max(r.qu_max, 0.01);
  const hMax = 90;
  const hLeft = (r.qu_min / maxQ) * hMax;
  const hRight = hMax;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Mini footing outline */}
      <rect x={xL} y={baseY - 20} width={fw} height={20} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1" />
      <line x1={xL - 10} y1={baseY} x2={xR + 10} y2={baseY} stroke={COLORS.textPrimary} strokeWidth="2" />
      <PressureDistribution
        xLeft={xL} xRight={xR} yBase={baseY}
        direction="up-into-base"
        hLeft={hLeft} hRight={hRight}
        labelLeft={`q_min = ${r.qu_min.toFixed(2)} kg/cm²`}
        labelRight={`q_max = ${r.qu_max.toFixed(2)} kg/cm²`}
      />
      <DimLine x1={xL} y1={baseY + 50} x2={xR} y2={baseY + 50} label={`B = ${r.B.toFixed(2)} m`} />
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        {r.caso_presion}
      </text>
    </svg>
  );
}

// ===========================================================================
// D17 / D18 — Cortante crítico a d de la cara, en L y S
// ===========================================================================

function ShearCritical({ r, dir }: { r: IsolatedFootingLiveResult; dir: "L" | "S" }) {
  const W = 460, H = 240;
  const padding = 50;
  const fwBase = dir === "L" ? r.B : r.L;
  const cwBase = dir === "L" ? r.bc / 100 : r.lc / 100;
  const scale = (W - 2 * padding) / fwBase;
  const fw = fwBase * scale;
  const fx = (W - fw) / 2;
  const cw = cwBase * scale;
  const cx = fx + (fw - cw) / 2;
  const baseY = H - 70;
  const fh = (r.h / 100) * scale * 2; // amplify for clarity
  const colH = 40;
  const d_offset = (r.d_cm / 100) * scale;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Footing section */}
      <rect x={fx} y={baseY - fh} width={fw} height={fh} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Column */}
      <rect x={cx} y={baseY - fh - colH} width={cw} height={colH} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Critical section dashed lines at d from each face */}
      <line x1={cx - d_offset} y1={baseY - fh} x2={cx - d_offset} y2={baseY} stroke={COLORS.critical} strokeWidth="1.5" strokeDasharray="5,3" />
      <line x1={cx + cw + d_offset} y1={baseY - fh} x2={cx + cw + d_offset} y2={baseY} stroke={COLORS.critical} strokeWidth="1.5" strokeDasharray="5,3" />
      <text x={cx - d_offset - 4} y={baseY + 12} textAnchor="end" fill={COLORS.critical} fontSize="9" fontFamily="ui-monospace, monospace">
        d = {r.d_cm} cm
      </text>
      {/* Soil pressure arrows pushing up */}
      <PressureDistribution
        xLeft={fx} xRight={fx + fw} yBase={baseY}
        direction="up-into-base"
        hLeft={(r.qu_min / Math.max(r.qu_max, 0.01)) * 50}
        hRight={50}
      />
      <DimLine x1={fx} y1={baseY + 50} x2={fx + fw} y2={baseY + 50} label={`${dir === "L" ? "L" : "S"} = ${fwBase.toFixed(2)} m`} />
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Cortante 1-dir en {dir} (sección crítica a d)
      </text>
    </svg>
  );
}

export function D17_ShearL({ r }: { r: IsolatedFootingLiveResult }) {
  return <ShearCritical r={r} dir="L" />;
}

export function D18_ShearS({ r }: { r: IsolatedFootingLiveResult }) {
  return <ShearCritical r={r} dir="S" />;
}

// ===========================================================================
// D19 — Punzonamiento perimeter
// ===========================================================================

export function D19_Punzonamiento({ r }: { r: IsolatedFootingLiveResult }) {
  const W = 420, H = 420;
  const padding = 50;
  const drawW = W - 2 * padding;
  const drawH = H - 2 * padding;
  const scale = Math.min(drawW / r.B, drawH / r.L) * 0.85;
  const fw = r.B * scale;
  const fh = r.L * scale;
  const fx = (W - fw) / 2;
  const fy = (H - fh) / 2;
  const cw = (r.bc / 100) * scale;
  const ch = (r.lc / 100) * scale;
  const cx = fx + (fw - cw) / 2;
  const cy = fy + (fh - ch) / 2;
  const d_half = (r.d_cm / 2 / 100) * scale;

  // Clip the critical perimeter to inside the footing rect so the dashed
  // square doesn't draw "in the air" when d/2 exceeds the footing
  // overhang. CR-Vis-Bug 2026-05.
  const clippedX = Math.max(fx, cx - d_half);
  const clippedY = Math.max(fy, cy - d_half);
  const clippedRight = Math.min(fx + fw, cx + cw + d_half);
  const clippedBottom = Math.min(fy + fh, cy + ch + d_half);
  const clippedW = Math.max(0, clippedRight - clippedX);
  const clippedH = Math.max(0, clippedBottom - clippedY);
  const perimeterClipped = clippedRight < cx + cw + d_half ||
    clippedBottom < cy + ch + d_half ||
    clippedX > cx - d_half ||
    clippedY > cy - d_half;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Footing plan */}
      <rect x={fx} y={fy} width={fw} height={fh} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Column */}
      <rect x={cx} y={cy} width={cw} height={ch} fill="#52525b" stroke={COLORS.rebarStroke} strokeWidth="1.5" />
      {/* Critical perimeter at d/2 — clipped to footing */}
      <rect
        x={clippedX} y={clippedY}
        width={clippedW} height={clippedH}
        fill="rgba(239,68,68,0.10)" stroke={COLORS.critical} strokeWidth="1.5" strokeDasharray="5,3"
      />
      {/* Warning if perimeter exceeds footing edge */}
      {perimeterClipped && (
        <text x={W / 2} y={H - 6} textAnchor="middle" fill={COLORS.failing} fontSize="9" fontFamily="ui-monospace, monospace">
          ⚠ Perímetro crítico excede borde — verificar geometría
        </text>
      )}
      {/* d/2 callouts on all 4 sides. CR-Vis-Bug 2026-05: clamp x so the
          label never renders outside the SVG when clippedX ≈ fx (column
          near the edge). */}
      <text x={Math.max(clippedX - 4, 60)} y={cy + ch / 2 + 3} textAnchor={clippedX - 4 < 60 ? "start" : "end"} fill={COLORS.critical} fontSize="9" fontFamily="ui-monospace, monospace">
        d/2 = {(r.d_cm / 2).toFixed(1)} cm
      </text>
      {/* b_o label */}
      <text x={cx + cw / 2} y={clippedY - 4} textAnchor="middle" fill={COLORS.critical} fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="700">
        b_o = {r.bo.toFixed(0)} cm
      </text>
      <DimLine x1={fx} y1={fy + fh + 22} x2={fx + fw} y2={fy + fh + 22} label={`L = ${r.B.toFixed(2)} m`} />
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Perímetro de punzonamiento (a d/2 de la columna)
      </text>
    </svg>
  );
}

// ===========================================================================
// D20 — Final rebar layout (plan + elevation)
// ===========================================================================

export function D20_FinalRebar({ r }: { r: IsolatedFootingLiveResult }) {
  const W = 720, H = 340;
  // Left half = plan view; right half = elevation
  const half = W / 2;
  const padding = 30;
  // PLAN
  const planScale = Math.min((half - 2 * padding) / r.B, (H - 2 * padding) / r.L) * 0.85;
  const fw = r.B * planScale;
  const fh = r.L * planScale;
  const fx = padding + ((half - 2 * padding) - fw) / 2;
  const fy = (H - fh) / 2;
  const cw = (r.bc / 100) * planScale;
  const ch = (r.lc / 100) * planScale;
  const cx = fx + (fw - cw) / 2;
  const cy = fy + (fh - ch) / 2;

  // Bar lines in plan: closely spaced under column, wider toward edges
  const bandLength = fh * 0.35;
  const bandFx = fx + (fw - bandLength) / 2 + 0;
  // For simplicity: rebars run in B direction (horizontal in plan)
  const nBars_B = r.n_B;
  const sep_B = (fw - 16) / Math.max(nBars_B, 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* PLAN */}
      <rect x={fx} y={fy} width={fw} height={fh} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Bars in B direction (horizontal in plan) */}
      {Array.from({ length: nBars_B }).map((_, i) => {
        const yLine = fy + 8 + i * sep_B;
        return <line key={`b${i}`} x1={fx + 4} y1={yLine} x2={fx + fw - 4} y2={yLine} stroke={COLORS.rebar} strokeWidth="1.2" />;
      })}
      {/* Bars in L direction (vertical in plan) */}
      {Array.from({ length: r.n_L }).map((_, i) => {
        const xLine = fx + 8 + i * ((fw - 16) / r.n_L);
        return <line key={`l${i}`} x1={xLine} y1={fy + 4} x2={xLine} y2={fy + fh - 4} stroke={COLORS.rebar} strokeWidth="1" opacity="0.6" />;
      })}
      {/* Column rectangle */}
      <rect x={cx} y={cy} width={cw} height={ch} fill="#52525b" stroke={COLORS.rebarStroke} strokeWidth="1.5" />
      <text x={fx + fw / 2} y={fy - 6} textAnchor="middle" fill={COLORS.textPrimary} fontSize="10" fontFamily="ui-monospace, monospace">
        Planta — {r.n_B} Ø{r.size_B} (B) + {r.n_L} Ø{r.size_L} (L)
      </text>

      {/* ELEVATION (right half) */}
      {(() => {
        const elFx = half + padding;
        const elFw = half - 2 * padding;
        const elBaseY = H - 50;
        const elH = (r.h / 100) * planScale * 3;
        const elTopY = elBaseY - elH;
        return (
          <>
            <rect x={elFx} y={elTopY} width={elFw} height={elH} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
            {/* Bars at bottom */}
            {Array.from({ length: r.n_B }).map((_, i) => {
              const cxBar = elFx + 6 + i * ((elFw - 12) / Math.max(r.n_B - 1, 1));
              return <RebarCircle key={i} cx={cxBar} cy={elBaseY - 8} size={r.size_B} />;
            })}
            <DimLine x1={elFx} y1={elBaseY + 12} x2={elFx + elFw} y2={elBaseY + 12} label={`B = ${r.B.toFixed(2)} m`} />
            <DimLine x1={elFx - 14} y1={elTopY} x2={elFx - 14} y2={elBaseY} label={`h = ${r.h} cm`} />
            <text x={elFx + elFw / 2} y={elTopY - 6} textAnchor="middle" fill={COLORS.textPrimary} fontSize="10" fontFamily="ui-monospace, monospace">
              Sección — armadura inferior
            </text>
          </>
        );
      })()}
    </svg>
  );
}

// ===========================================================================
// Wrapper
// ===========================================================================

export function IsolatedFootingDiagramSet({ r }: { r: IsolatedFootingLiveResult }) {
  return (
    <div className="space-y-3">
      <DiagramFrame title="D12 — Planta">
        <D12_PlanView r={r} />
      </DiagramFrame>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DiagramFrame title="D13 — Elevación X">
          <D13_ElevationX r={r} />
        </DiagramFrame>
        <DiagramFrame title="D14 — Elevación Y">
          <D14_ElevationY r={r} />
        </DiagramFrame>
      </div>
      <DiagramFrame title="D15 — Detalle de anclaje L_db">
        <D15_AnclajeLdb r={r} />
      </DiagramFrame>
      <DiagramFrame title="D16 — Distribución de presión bajo zapata">
        <D16_PressureDist r={r} />
      </DiagramFrame>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DiagramFrame title="D17 — Cortante 1-dir en L">
          <D17_ShearL r={r} />
        </DiagramFrame>
        <DiagramFrame title="D18 — Cortante 1-dir en S">
          <D18_ShearS r={r} />
        </DiagramFrame>
      </div>
      <DiagramFrame title="D19 — Perímetro de punzonamiento">
        <D19_Punzonamiento r={r} />
      </DiagramFrame>
      <DiagramFrame title="D20 — Distribución final de acero">
        <D20_FinalRebar r={r} />
      </DiagramFrame>
    </div>
  );
}
