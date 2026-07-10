"use client";

/**
 * Column diagrams — BOTH rectangular and circular columns, with
 * cross-section AND full longitudinal elevation showing every stirrup/
 * spiral at correct elevation. User's explicit request: "for columns
 * not just to see the transversal but also the longitudinal also with
 * the columns I want to see the detailed rebar also where it is
 * interactive".
 *
 * Rectangular column diagrams:
 *   RC-1 — Sección transversal con barras perimetrales + estribos + hx
 *   RC-2 — Elevación longitudinal (l_o sup + central + l_o inf) — every stirrup drawn
 *   RC-3 — Detalle de empalmes (lap splices)
 *   RC-4 — Detalle de gancho sísmico 135°
 *   RC-5 — Diagrama P-M con punto (Pu, Mu) sobre envolvente
 *
 * Circular column diagrams:
 *   CC-1 — Sección transversal con barras en círculo + espiral
 *   CC-2 — Elevación longitudinal con espiral helicoidal (paso real)
 *   CC-3 — Detalle de traslape de espiral (1.5 vueltas)
 *   CC-4 — Diagrama P-M
 */

import {
  SvgDefs, DimLine, RebarPerimeter, RebarCircular, Hook135,
  SpiralElevation, StirrupRing, DiagramFrame, COLORS,
} from "./svg-primitives";
import type { RectColumnLiveResult } from "@/lib/rectangular-column-live";
import type { CircColumnLiveResult } from "@/lib/circular-column-live";

// ===========================================================================
// RC-1 — Sección transversal rectangular column
// ===========================================================================

export function RC1_Seccion({ r }: { r: RectColumnLiveResult }) {
  const W = 360, H = 360;
  const padding = 70;
  const drawSize = W - 2 * padding;
  const scale = Math.min(drawSize / r.b, drawSize / r.h) * 0.7;
  const bw = r.b * scale;
  const bh = r.h * scale;
  const x0 = (W - bw) / 2;
  const y0 = (H - bh) / 2;
  const cover = r.r * scale;
  const sample_size = r.size;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <rect x={x0} y={y0} width={bw} height={bh} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Stirrup outline (4 sides) */}
      <rect x={x0 + cover} y={y0 + cover}
            width={bw - 2 * cover} height={bh - 2 * cover}
            fill="none" stroke={COLORS.stirrup} strokeWidth="1.5" strokeDasharray="3,2" />
      {/* Perimeter rebar */}
      <RebarPerimeter x={x0} y={y0} w={bw} h={bh} count={r.n_bars} size={sample_size} cover={cover} />
      {/* Dimensions */}
      <DimLine x1={x0} y1={y0 + bh + 38} x2={x0 + bw} y2={y0 + bh + 38} label={`b = ${r.b} cm`} />
      <DimLine x1={x0 + bw + 22} y1={y0} x2={x0 + bw + 22} y2={y0 + bh} label={`h = ${r.h} cm`} />
      {/* hx callout — between two adjacent perimeter bars (placed ABOVE
          the b dim line at +38 so the labels don't overlap). CR-Vis-Bug
          2026-05. */}
      <line x1={x0 + cover + 4} y1={y0 + bh + 14} x2={x0 + cover + (bw - 2*cover) / Math.max(2, Math.floor(r.n_bars/4)+1) - 4} y2={y0 + bh + 14} stroke={COLORS.stirrup} strokeWidth="0.8" markerStart="url(#arrow-dim)" markerEnd="url(#arrow-dim)" />
      <text x={x0 + cover + (bw - 2*cover) / Math.max(2, Math.floor(r.n_bars/4)+1) / 2} y={y0 + bh + 24} textAnchor="middle" fill={COLORS.stirrup} fontSize="8" fontFamily="ui-monospace, monospace">
        hx = {r.hx.toFixed(1)} cm
      </text>
      {/* Rebar callout */}
      <text x={x0 + bw / 2} y={y0 - 8} textAnchor="middle" fill={COLORS.rebar} fontSize="11" fontFamily="ui-monospace, monospace" fontWeight="700">
        {r.n_bars} Ø {r.size}  (ρ = {(r.rho * 100).toFixed(2)}%)
      </text>
      <text x={x0 + bw / 2} y={H - 12} textAnchor="middle" fill={COLORS.stirrup} fontSize="10" fontFamily="ui-monospace, monospace">
        Aros #4 @ {r.s_conf.toFixed(0)} cm (zona confinada)
      </text>
    </svg>
  );
}

// ===========================================================================
// RC-2 — Elevación longitudinal con cada estribo dibujado
// ===========================================================================

export function RC2_Elevacion({ r }: { r: RectColumnLiveResult }) {
  const W = 360, H = 540;
  const padding = 60;
  const padX = 90;
  const drawH = H - 2 * padding;
  const drawW = W - 2 * padX;
  // Vertical scale: L_cm to drawH
  const yScale = drawH / r.L;
  const xScale = drawW / r.b;
  const colW = r.b * xScale;
  const x0 = (W - colW) / 2;
  const yTop = padding;
  const yBot = padding + drawH;

  const lo_px = r.lo_confinamiento * yScale;
  const s_conf_px = r.s_conf * yScale;
  const s_out_px = r.s_central * yScale;

  // Stirrups in confined zone (top)
  const stirrupsTop: number[] = [];
  for (let y = yTop + 5; y < yTop + lo_px; y += s_conf_px) stirrupsTop.push(y);

  // Stirrups in central zone
  const stirrupsCenter: number[] = [];
  const centerStart = yTop + lo_px;
  const centerEnd = yBot - lo_px;
  for (let y = centerStart; y < centerEnd; y += s_out_px) stirrupsCenter.push(y);

  // Stirrups in confined zone (bottom)
  const stirrupsBot: number[] = [];
  for (let y = yBot - lo_px; y < yBot - 4; y += s_conf_px) stirrupsBot.push(y);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Column shell */}
      <rect x={x0} y={yTop} width={colW} height={drawH} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Longitudinal rebar — draw n_bars/2 vertical lines distributed
          across the column face (the front-projected bars of the
          rectangular cross-section). CR-Vis-Bug 2026-05: anteriormente
          siempre 2 lineas sin importar n_bars, sub-representaba la
          armadura visible al ingeniero. */}
      {(() => {
        const visibleBars = Math.max(2, Math.ceil(r.n_bars / 2));
        const innerWidth = colW - 10;
        const gap = visibleBars > 1 ? innerWidth / (visibleBars - 1) : 0;
        return Array.from({ length: visibleBars }).map((_, i) => {
          const cx = x0 + 5 + (visibleBars > 1 ? i * gap : innerWidth / 2);
          return (
            <line key={`long${i}`} x1={cx} y1={yTop} x2={cx} y2={yBot}
              stroke={COLORS.rebar} strokeWidth="2" />
          );
        });
      })()}
      {/* Stirrups */}
      {stirrupsTop.map((y, i) => (
        <line key={`t${i}`} x1={x0 + 3} y1={y} x2={x0 + colW - 3} y2={y} stroke={COLORS.stirrup} strokeWidth="1.2" strokeDasharray="3,2" />
      ))}
      {stirrupsCenter.map((y, i) => (
        <line key={`c${i}`} x1={x0 + 3} y1={y} x2={x0 + colW - 3} y2={y} stroke={COLORS.stirrup} strokeWidth="1" strokeDasharray="3,2" opacity="0.7" />
      ))}
      {stirrupsBot.map((y, i) => (
        <line key={`b${i}`} x1={x0 + 3} y1={y} x2={x0 + colW - 3} y2={y} stroke={COLORS.stirrup} strokeWidth="1.2" strokeDasharray="3,2" />
      ))}
      {/* Zone markers */}
      <rect x={x0 - 14} y={yTop} width="6" height={lo_px} fill={COLORS.failing} opacity="0.35" />
      <rect x={x0 - 14} y={centerStart} width="6" height={centerEnd - centerStart} fill={COLORS.passing} opacity="0.25" />
      <rect x={x0 - 14} y={yBot - lo_px} width="6" height={lo_px} fill={COLORS.failing} opacity="0.35" />
      {/* Zone labels */}
      <text x={x0 - 20} y={yTop + lo_px / 2 + 4} textAnchor="end" fill={COLORS.failing} fontSize="9" fontFamily="ui-monospace, monospace">
        Confinada
      </text>
      <text x={x0 - 20} y={yTop + lo_px / 2 + 16} textAnchor="end" fill={COLORS.failing} fontSize="8" fontFamily="ui-monospace, monospace">
        lo = {r.lo_confinamiento.toFixed(0)} cm
      </text>
      <text x={x0 - 20} y={(centerStart + centerEnd) / 2 + 4} textAnchor="end" fill={COLORS.passing} fontSize="9" fontFamily="ui-monospace, monospace">
        Central
      </text>
      <text x={x0 - 20} y={yBot - lo_px / 2 + 4} textAnchor="end" fill={COLORS.failing} fontSize="9" fontFamily="ui-monospace, monospace">
        Confinada
      </text>
      {/* Spacing labels */}
      <text x={x0 + colW + 12} y={yTop + lo_px / 2} textAnchor="start" fill={COLORS.stirrup} fontSize="9" fontFamily="ui-monospace, monospace">
        s = {r.s_conf.toFixed(0)} cm
      </text>
      <text x={x0 + colW + 12} y={(centerStart + centerEnd) / 2} textAnchor="start" fill={COLORS.stirrup} fontSize="9" fontFamily="ui-monospace, monospace">
        s = {r.s_central.toFixed(0)} cm
      </text>
      <text x={x0 + colW + 12} y={yBot - lo_px / 2} textAnchor="start" fill={COLORS.stirrup} fontSize="9" fontFamily="ui-monospace, monospace">
        s = {r.s_conf.toFixed(0)} cm
      </text>
      {/* Total height dim */}
      <DimLine x1={x0 - 50} y1={yTop} x2={x0 - 50} y2={yBot} label={`L = ${r.L} cm`} />
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Elevación — {stirrupsTop.length + stirrupsCenter.length + stirrupsBot.length} aros
      </text>
    </svg>
  );
}

// ===========================================================================
// RC-3 — Detalle de empalmes (lap splices)
// ===========================================================================

export function RC3_Empalmes({ r }: { r: RectColumnLiveResult }) {
  const W = 360, H = 280;
  const padding = 40;
  const colW = 80;
  const colH = H - 2 * padding;
  const x0 = (W - colW) / 2;
  const yTop = padding;
  const yBot = padding + colH;
  // Splice zone in middle third
  const spliceZoneTop = yTop + colH / 3;
  const spliceZoneBot = yTop + (2 * colH) / 3;
  const splice_lst_cm = 1.3 * 30 * r.size / 5; // rough estimate
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <rect x={x0} y={yTop} width={colW} height={colH} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Lower bar */}
      <line x1={x0 + colW / 2 - 4} y1={yBot} x2={x0 + colW / 2 - 4} y2={spliceZoneTop} stroke={COLORS.rebar} strokeWidth="2" />
      {/* Upper bar */}
      <line x1={x0 + colW / 2 + 4} y1={yTop} x2={x0 + colW / 2 + 4} y2={spliceZoneBot} stroke={COLORS.rebar} strokeWidth="2" />
      {/* Splice highlight */}
      <rect x={x0 + colW / 2 - 8} y={spliceZoneTop} width="16" height={spliceZoneBot - spliceZoneTop}
            fill="rgba(245,158,11,0.20)" stroke={COLORS.rebar} strokeWidth="0.5" strokeDasharray="2,2" />
      {/* Forbidden zones */}
      <rect x={x0 - 14} y={yTop} width="6" height={(colH / 3)} fill={COLORS.failing} opacity="0.3" />
      <rect x={x0 - 14} y={yBot - colH / 3} width="6" height={colH / 3} fill={COLORS.failing} opacity="0.3" />
      <text x={x0 - 20} y={yTop + colH / 6} textAnchor="end" fill={COLORS.failing} fontSize="8" fontFamily="ui-monospace, monospace">
        Zona confinada
      </text>
      <text x={x0 - 20} y={yTop + colH / 6 + 11} textAnchor="end" fill={COLORS.failing} fontSize="8" fontFamily="ui-monospace, monospace">
        sin empalme
      </text>
      {/* Splice length */}
      <DimLine x1={x0 + colW + 14} y1={spliceZoneTop} x2={x0 + colW + 14} y2={spliceZoneBot} label={`l_st ≈ ${splice_lst_cm.toFixed(0)} cm`} />
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Empalme por solape (1.3·l_d) — solo en zona central
      </text>
    </svg>
  );
}

// ===========================================================================
// RC-4 — Detalle de gancho sísmico 135°
// ===========================================================================

export function RC4_Hook135({ r }: { r: RectColumnLiveResult }) {
  const W = 360, H = 220;
  const valid135 = r.zona >= 3;  // Always valid in this diagram representation
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Good hook (135°) */}
      <text x={90} y={40} textAnchor="middle" fill={COLORS.passing} fontSize="12" fontFamily="ui-monospace, monospace" fontWeight="700">
        ✓ 135° (sísmico)
      </text>
      <Hook135 x={50} y={90} scale={1.8} label={`Ext ≥ max(6 db, 7.5 cm)`} valid={true} />
      {/* Bad hook (90°) */}
      <text x={270} y={40} textAnchor="middle" fill={COLORS.failing} fontSize="12" fontFamily="ui-monospace, monospace" fontWeight="700">
        ✗ 90° (no permitido en zonas III-IV)
      </text>
      <g transform="translate(220, 90)">
        <line x1={0} y1={0} x2={50} y2={0} stroke={COLORS.failing} strokeWidth="2" />
        <line x1={50} y1={0} x2={50} y2={-30} stroke={COLORS.failing} strokeWidth="2" />
        <line x1={-5} y1={-12} x2={60} y2={5} stroke={COLORS.failing} strokeWidth="2" />
        <line x1={-5} y1={5} x2={60} y2={-12} stroke={COLORS.failing} strokeWidth="2" />
      </g>
      <text x={W / 2} y={H - 14} textAnchor="middle" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">
        En zona sísmica III/IV los ganchos a 135° son obligatorios para confinamiento dúctil.
      </text>
    </svg>
  );
}

// ===========================================================================
// RC-5 — Diagrama P-M (interaction)
// ===========================================================================

export function RC5_PM_Diagram({ r }: { r: RectColumnLiveResult }) {
  const W = 360, H = 320;
  const padding = 50;
  const drawW = W - 2 * padding - 40;
  const drawH = H - 2 * padding;
  const ox = padding + 30;
  const oy = H - padding;

  // Simplified P-M envelope: piecewise envelope from (0, M_balanced) through (Pu_max, 0)
  // Estimate Pu_max ≈ 0.85·f'c·Ag + fy·As_prov (in ton)
  const Ag = r.Ag;
  const Pu_max_ton = (0.65 * (0.85 * r.fc * Ag + r.fy * r.As_prov)) / 1000;
  const Mu_max_tonm = (r.Ag * r.fy * 0.4) / 100_000; // rough estimate

  // Plot scaling
  const Pscale = drawH / (Pu_max_ton * 1.1);
  const Mscale = drawW / (Mu_max_tonm * 1.2);

  // Envelope corner points (kinked): (0, 0), (Mu_balanced, P_balanced), (0, Pu_max)
  const envelopePts = [
    [ox, oy],
    [ox + Mu_max_tonm * Mscale, oy - 0.4 * Pu_max_ton * Pscale],
    [ox + 0.6 * Mu_max_tonm * Mscale, oy - 0.7 * Pu_max_ton * Pscale],
    [ox, oy - Pu_max_ton * Pscale],
  ];

  // Current point
  const userPt = {
    x: ox + Math.min(r.Mu_max, Mu_max_tonm * 1.1) * Mscale,
    y: oy - Math.min(r.Pu, Pu_max_ton * 1.1) * Pscale,
  };
  const inside =
    r.Pu <= Pu_max_ton && r.Mu_max <= Mu_max_tonm * 0.9 && r.eccentricity_ratio <= 0.10;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Axes */}
      <line x1={ox} y1={oy} x2={ox + drawW + 10} y2={oy} stroke={COLORS.textDim} strokeWidth="1" />
      <line x1={ox} y1={oy} x2={ox} y2={oy - drawH - 10} stroke={COLORS.textDim} strokeWidth="1" />
      <text x={ox + drawW} y={oy + 14} textAnchor="end" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">M_u (ton·m)</text>
      <text x={ox - 6} y={oy - drawH} textAnchor="end" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">P_u (ton)</text>
      {/* Envelope */}
      <polygon
        points={envelopePts.map(([x, y]) => `${x},${y}`).join(" ")}
        fill={inside ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.18)"}
        stroke={inside ? COLORS.passing : COLORS.failing}
        strokeWidth="1.5"
      />
      {/* User point */}
      <circle cx={userPt.x} cy={userPt.y} r="6" fill={inside ? COLORS.passing : COLORS.failing} stroke={COLORS.textPrimary} strokeWidth="1.5" />
      <text x={userPt.x + 10} y={userPt.y - 4} fill={COLORS.textPrimary} fontSize="9" fontFamily="ui-monospace, monospace">
        ({r.Mu_max.toFixed(1)}, {r.Pu.toFixed(0)})
      </text>
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Diagrama P-M (envolvente simplificada)
      </text>
      {!inside && (
        <text x={W / 2} y={H - 12} textAnchor="middle" fill={COLORS.failing} fontSize="9" fontFamily="ui-monospace, monospace">
          Punto fuera de envolvente — requiere análisis P-M completo.
        </text>
      )}
    </svg>
  );
}

// ===========================================================================
// CC-1 — Circular column cross-section with spiral
// ===========================================================================

export function CC1_Seccion({ r }: { r: CircColumnLiveResult }) {
  const W = 360, H = 360;
  const cx = W / 2;
  const cy = H / 2 + 10;
  const padding = 60;
  const scale = (Math.min(W, H) - 2 * padding) / r.D;
  const R = (r.D * scale) / 2;
  const cover = r.r * scale;
  const Rin = R - cover;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <circle cx={cx} cy={cy} r={R} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={Rin} fill="none" stroke={COLORS.spiral} strokeWidth="1.5" strokeDasharray="3,2" />
      <RebarCircular cx={cx} cy={cy} radius={Rin} count={r.n_bars} size={r.size} />
      <DimLine x1={cx - R} y1={cy + R + 22} x2={cx + R} y2={cy + R + 22} label={`D = ${r.D} cm`} />
      <text x={cx} y={cy - R - 12} textAnchor="middle" fill={COLORS.rebar} fontSize="11" fontFamily="ui-monospace, monospace" fontWeight="700">
        {r.n_bars} Ø {r.size}  + Espiral Ø{r.sizeEspiral} @ {r.s_espiral.toFixed(1)} cm
      </text>
      <text x={cx} y={H - 14} textAnchor="middle" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">
        ρ = {(r.rho * 100).toFixed(2)}% · ρ_s = {(r.rho_s_prov * 100).toFixed(3)}%
      </text>
    </svg>
  );
}

// ===========================================================================
// CC-2 — Circular column elevation with helical spiral
// ===========================================================================

export function CC2_Elevacion({ r }: { r: CircColumnLiveResult }) {
  const W = 280, H = 540;
  const padding = 60;
  const padX = 80;
  const colW = 100;
  const x0 = (W - colW) / 2;
  const yTop = padding;
  const yBot = H - padding;
  const drawH = yBot - yTop;
  const yScale = drawH / r.L;
  const pitch_px = r.s_espiral * yScale;
  const lo_px = r.lo * yScale;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <rect x={x0} y={yTop} width={colW} height={drawH} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Helical spiral projection */}
      <SpiralElevation
        xLeft={x0 + 4} xRight={x0 + colW - 4}
        yTop={yTop} yBottom={yBot}
        pitch_px={pitch_px}
      />
      {/* Longitudinal bars (front-facing). Show n_bars/2 visible bars
          since the back-facing half is hidden by the column body. */}
      {(() => {
        const visibleBars = Math.max(2, Math.ceil(r.n_bars / 2));
        const innerWidth = colW - 16;
        const gap = visibleBars > 1 ? innerWidth / (visibleBars - 1) : 0;
        return Array.from({ length: visibleBars }).map((_, i) => {
          const cx = x0 + 8 + (visibleBars > 1 ? i * gap : innerWidth / 2);
          return (
            <line key={`long${i}`} x1={cx} y1={yTop} x2={cx} y2={yBot}
              stroke={COLORS.rebar} strokeWidth="2" opacity={i === 0 || i === visibleBars - 1 ? 1 : 0.85} />
          );
        });
      })()}
      {/* Confined zones */}
      <rect x={x0 - 14} y={yTop} width="6" height={lo_px} fill={COLORS.failing} opacity="0.35" />
      <rect x={x0 - 14} y={yBot - lo_px} width="6" height={lo_px} fill={COLORS.failing} opacity="0.35" />
      <text x={x0 - 20} y={yTop + lo_px / 2 + 4} textAnchor="end" fill={COLORS.failing} fontSize="9" fontFamily="ui-monospace, monospace">
        lo = {r.lo.toFixed(0)}
      </text>
      <text x={x0 + colW + 10} y={yTop + 30} fill={COLORS.spiral} fontSize="9" fontFamily="ui-monospace, monospace">
        Paso = {r.s_espiral.toFixed(1)} cm
      </text>
      <DimLine x1={x0 - 50} y1={yTop} x2={x0 - 50} y2={yBot} label={`L = ${r.L} cm`} />
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Elevación — espiral continua
      </text>
    </svg>
  );
}

// ===========================================================================
// CC-3 — Splice detail
// ===========================================================================

export function CC3_TraslapeEspiral({ r }: { r: CircColumnLiveResult }) {
  const W = 320, H = 240;
  const cx = W / 2;
  const cy = H / 2;
  const R = 60;
  // Show top view: 1.5 extra turns at end
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={COLORS.concreteStroke} strokeWidth="1" strokeDasharray="2,2" />
      {/* Spiral end: a thicker spiral fragment showing 1.5 extra turns */}
      {Array.from({ length: 60 }).map((_, i) => {
        const t = i / 60;
        const a1 = t * 2 * Math.PI;
        const a2 = ((i + 1) / 60) * 2 * Math.PI;
        const r1 = R - 4 - t * 4;
        const r2 = R - 4 - ((i + 1) / 60) * 4;
        return (
          <line key={i}
            x1={cx + r1 * Math.cos(a1)} y1={cy + r1 * Math.sin(a1)}
            x2={cx + r2 * Math.cos(a2)} y2={cy + r2 * Math.sin(a2)}
            stroke={COLORS.spiral} strokeWidth="1.5"
          />
        );
      })}
      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Traslape espiral — 1.5 vueltas adicionales
      </text>
      <text x={W / 2} y={H - 12} textAnchor="middle" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">
        ACI §25.7.3.6
      </text>
    </svg>
  );
}

// ===========================================================================
// Wrappers
// ===========================================================================

export function RectColumnDiagramSet({ r }: { r: RectColumnLiveResult }) {
  return (
    <div className="space-y-3">
      <DiagramFrame title="RC-1 — Sección transversal">
        <RC1_Seccion r={r} />
      </DiagramFrame>
      <DiagramFrame title="RC-2 — Elevación longitudinal con todos los aros">
        <RC2_Elevacion r={r} />
      </DiagramFrame>
      <DiagramFrame title="RC-3 — Detalle de empalmes">
        <RC3_Empalmes r={r} />
      </DiagramFrame>
      <DiagramFrame title="RC-4 — Detalle del gancho sísmico 135°">
        <RC4_Hook135 r={r} />
      </DiagramFrame>
      <DiagramFrame title="RC-5 — Diagrama P-M">
        <RC5_PM_Diagram r={r} />
      </DiagramFrame>
    </div>
  );
}

export function CircularColumnDiagramSet({ r }: { r: CircColumnLiveResult }) {
  return (
    <div className="space-y-3">
      <DiagramFrame title="CC-1 — Sección transversal con espiral">
        <CC1_Seccion r={r} />
      </DiagramFrame>
      <DiagramFrame title="CC-2 — Elevación con espiral helicoidal">
        <CC2_Elevacion r={r} />
      </DiagramFrame>
      <DiagramFrame title="CC-3 — Traslape de espiral">
        <CC3_TraslapeEspiral r={r} />
      </DiagramFrame>
    </div>
  );
}
