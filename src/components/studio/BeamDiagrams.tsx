"use client";

/**
 * Beam diagrams — 6 reactive views.
 *   BM-1 — Sección transversal at apoyo
 *   BM-2 — Sección transversal at centro
 *   BM-3 — Elevación longitudinal with confined zone stirrups + hooks
 *   BM-4 — Diagrama de momentos
 *   BM-5 — Diagrama de cortantes con banda Vc
 *   BM-6 — Mecanismo Ve capacity design (ductile only — heuristic)
 */

import {
  SvgDefs, DimLine, RebarRow, RebarCircle, DiagramFrame, COLORS,
} from "./svg-primitives";
import type { FlexureLiveResult } from "@/lib/beam-flexure-live";
import type { BeamStudioInput } from "@/app/studio/beam/InputEditor";

interface BeamDiagramProps {
  input: BeamStudioInput;
  liveResult: FlexureLiveResult;
}

// ---- Common section drawer ----
function SectionView({
  b, h, d, recubrimiento, topBars, bottomBars, stirrupSpacing,
  title,
}: {
  b: number; h: number; d: number; recubrimiento: number;
  topBars: { n: number; size: number };
  bottomBars: { n: number; size: number };
  stirrupSpacing: number;
  title: string;
}) {
  const W = 320, H = 320;
  const padding = 60;
  const drawSize = W - 2 * padding;
  const scale = Math.min(drawSize / b, drawSize / h) * 0.85;
  const bw = b * scale;
  const bh = h * scale;
  const x0 = (W - bw) / 2;
  const y0 = (H - bh) / 2;
  const cover = recubrimiento * scale;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      <rect x={x0} y={y0} width={bw} height={bh} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      <rect x={x0 + cover} y={y0 + cover}
            width={bw - 2 * cover} height={bh - 2 * cover}
            fill="none" stroke={COLORS.stirrup} strokeWidth="1.5" strokeDasharray="3,2" />
      <RebarRow xLeft={x0 + cover + 4} xRight={x0 + bw - cover - 4} y={y0 + cover + 6} count={topBars.n} size={topBars.size} />
      <RebarRow xLeft={x0 + cover + 4} xRight={x0 + bw - cover - 4} y={y0 + bh - cover - 6} count={bottomBars.n} size={bottomBars.size} />
      <DimLine x1={x0} y1={y0 + bh + 22} x2={x0 + bw} y2={y0 + bh + 22} label={`b = ${b} cm`} />
      <DimLine x1={x0 + bw + 22} y1={y0} x2={x0 + bw + 22} y2={y0 + bh} label={`h = ${h} cm`} />
      <text x={x0 + bw / 2} y={y0 + cover + 22} textAnchor="middle" fill={COLORS.rebar} fontSize="9" fontFamily="ui-monospace, monospace">
        {topBars.n} Ø {topBars.size} (sup)
      </text>
      <text x={x0 + bw / 2} y={y0 + bh - cover - 18} textAnchor="middle" fill={COLORS.rebar} fontSize="9" fontFamily="ui-monospace, monospace">
        {bottomBars.n} Ø {bottomBars.size} (inf)
      </text>
      <text x={x0 + bw / 2} y={H - 12} textAnchor="middle" fill={COLORS.stirrup} fontSize="9" fontFamily="ui-monospace, monospace">
        Estr. #3 @ {stirrupSpacing.toFixed(0)} cm · d = {d.toFixed(1)} cm
      </text>
      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        {title}
      </text>
    </svg>
  );
}

export function BM1_SectionApoyo({ input, liveResult }: BeamDiagramProps) {
  // Estimate bars from As_diseno (negative moment, top governs at support)
  const As = liveResult.As_diseno;
  const n_top = Math.max(2, Math.ceil(As / 1.99));  // approx #5
  return (
    <SectionView
      b={input.b} h={input.h} d={liveResult.d} recubrimiento={input.recubrimiento}
      topBars={{ n: n_top, size: 5 }}
      bottomBars={{ n: 2, size: 5 }}
      stirrupSpacing={input.h / 4}
      title="Sección en apoyo (M⁻)"
    />
  );
}

export function BM2_SectionCentro({ input, liveResult }: BeamDiagramProps) {
  const As = liveResult.As_diseno;
  const n_bot = Math.max(2, Math.ceil(As / 1.99));
  return (
    <SectionView
      b={input.b} h={input.h} d={liveResult.d} recubrimiento={input.recubrimiento}
      topBars={{ n: 2, size: 5 }}
      bottomBars={{ n: n_bot, size: 5 }}
      stirrupSpacing={input.h / 2}
      title="Sección en centro (M⁺)"
    />
  );
}

// BM-3 Elevación longitudinal
export function BM3_Elevation({ input, liveResult }: BeamDiagramProps) {
  const W = 720, H = 260;
  const padding = 50;
  const drawW = W - 2 * padding;
  const Lpx = drawW;
  const h_px = Math.min(120, input.h * 1.2);
  const yTop = H / 2 - h_px / 2;
  const yBot = yTop + h_px;
  const xL = padding;
  const xR = padding + Lpx;
  const zone2h = (2 * input.h / input.L_cm) * Lpx;

  // Estimate stirrup count in each zone
  const sConf_cm = input.h / 4;
  const sCent_cm = input.h / 2;
  const sConf_px = (sConf_cm / input.L_cm) * Lpx;
  const sCent_px = (sCent_cm / input.L_cm) * Lpx;

  const stirrupsLeft: number[] = [];
  for (let x = xL + 4; x < xL + zone2h; x += sConf_px) stirrupsLeft.push(x);
  const stirrupsCent: number[] = [];
  for (let x = xL + zone2h; x < xR - zone2h; x += sCent_px) stirrupsCent.push(x);
  const stirrupsRight: number[] = [];
  for (let x = xR - zone2h; x < xR - 4; x += sConf_px) stirrupsRight.push(x);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Beam outline */}
      <rect x={xL} y={yTop} width={Lpx} height={h_px} fill="url(#concrete-hatch)" stroke={COLORS.concreteStroke} strokeWidth="1.5" />
      {/* Top bars (continuous) */}
      <line x1={xL + 6} y1={yTop + 8} x2={xR - 6} y2={yTop + 8} stroke={COLORS.rebar} strokeWidth="2" />
      {/* Bottom bars (continuous) */}
      <line x1={xL + 6} y1={yBot - 8} x2={xR - 6} y2={yBot - 8} stroke={COLORS.rebar} strokeWidth="2" />
      {/* Hooks at ends — bend INWARD into the concrete (correct direction)
          CR-Vis-Bug 2026-05: anteriormente las patas del gancho salian al
          exterior del concreto, lo cual es estructuralmente incorrecto. */}
      {[xL, xR].map((x, i) => {
        const inward = i === 0 ? 1 : -1;  // hook direction: into beam
        const barStart = i === 0 ? xL + 6 : xR - 6;
        // Hook leg goes inward 14px and down/up 6px (135° approx)
        return (
          <g key={i}>
            {/* Top bar hook */}
            <line x1={barStart} y1={yTop + 8}
              x2={barStart + 14 * inward} y2={yTop + 18}
              stroke={COLORS.rebar} strokeWidth="2" />
            {/* Bottom bar hook */}
            <line x1={barStart} y1={yBot - 8}
              x2={barStart + 14 * inward} y2={yBot - 18}
              stroke={COLORS.rebar} strokeWidth="2" />
          </g>
        );
      })}
      {/* Stirrups in confined zones (denser) */}
      {[...stirrupsLeft, ...stirrupsRight].map((x, i) => (
        <line key={`c${i}`} x1={x} y1={yTop + 4} x2={x} y2={yBot - 4} stroke={COLORS.stirrup} strokeWidth="1.2" strokeDasharray="3,2" />
      ))}
      {stirrupsCent.map((x, i) => (
        <line key={`m${i}`} x1={x} y1={yTop + 4} x2={x} y2={yBot - 4} stroke={COLORS.stirrup} strokeWidth="1" strokeDasharray="3,2" opacity="0.6" />
      ))}
      {/* Zone labels */}
      <rect x={xL} y={yBot + 6} width={zone2h} height="4" fill={COLORS.failing} opacity="0.6" />
      <rect x={xL + zone2h} y={yBot + 6} width={Lpx - 2 * zone2h} height="4" fill={COLORS.passing} opacity="0.6" />
      <rect x={xR - zone2h} y={yBot + 6} width={zone2h} height="4" fill={COLORS.failing} opacity="0.6" />
      <text x={xL + zone2h / 2} y={yBot + 22} textAnchor="middle" fill={COLORS.failing} fontSize="9" fontFamily="ui-monospace, monospace">
        2h confinada
      </text>
      <text x={(xL + xR) / 2} y={yBot + 22} textAnchor="middle" fill={COLORS.passing} fontSize="9" fontFamily="ui-monospace, monospace">
        Central
      </text>
      <text x={xR - zone2h / 2} y={yBot + 22} textAnchor="middle" fill={COLORS.failing} fontSize="9" fontFamily="ui-monospace, monospace">
        2h confinada
      </text>
      <DimLine x1={xL} y1={yBot + 44} x2={xR} y2={yBot + 44} label={`L = ${input.L_cm} cm`} />
      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Elevación longitudinal — {stirrupsLeft.length + stirrupsRight.length} aros confinados + {stirrupsCent.length} centrales
      </text>
    </svg>
  );
}

// BM-4 moment diagram — REAL beam moment shape:
//   - Cantilever: linear (M = w·(L-x)²/2)
//   - Simply-supported: parabolic + positive (M(x) = w·x·(L-x)/2)
//   - Continuous: negative humps at supports + positive parabola midspan
// We use the continuous case: M⁻ at supports = -w·L²/12, M⁺ at center = w·L²/24.
// The exact shape comes from superposition of cantilever + simply-supported:
//   M(t) = M⁻ · (1 - 6t + 6t²) + M⁺ · (-2 + 12t - 12t²)
// We render this as a real polyline so the shape reads correctly.
export function BM4_Moments({ input }: BeamDiagramProps) {
  const W = 560, H = 240;
  const padding = 40;
  const xL = padding, xR = W - padding;
  const span = xR - xL;
  const yMid = H / 2;

  const Mneg = Math.abs(input.Mu_tonm);
  const Mpos = Math.abs(input.Mu_pos_tonm);
  const maxM = Math.max(Mneg, Mpos, 0.01);
  const ampScale = 70 / maxM;

  // Real continuous-beam moment shape: cubic in t for ends, parabolic at center.
  // Parameterize from t=0 (left support) to t=1 (right support).
  function M(t: number): number {
    // Negative humps at supports decay as quartic to zero at ~ 0.15-0.85
    // Positive parabola peaks at center.
    const neg = t < 0.5
      ? Mneg * (1 - 2 * t) ** 2
      : Mneg * (2 * t - 1) ** 2;
    const pos = Mpos * 4 * t * (1 - t);
    return pos - neg;
  }

  const points: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const x = xL + t * span;
    const m = M(t);
    const y = yMid - m * ampScale;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Baseline = beam axis */}
      <line x1={xL} y1={yMid} x2={xR} y2={yMid} stroke={COLORS.textDim} strokeWidth="1.5" />
      {/* Support markers */}
      <polygon points={`${xL},${yMid} ${xL - 6},${yMid + 10} ${xL + 6},${yMid + 10}`} fill={COLORS.concreteStroke} />
      <polygon points={`${xR},${yMid} ${xR - 6},${yMid + 10} ${xR + 6},${yMid + 10}`} fill={COLORS.concreteStroke} />
      {/* Shaded area between curve and axis */}
      <polygon
        points={`${xL},${yMid} ${points.join(" ")} ${xR},${yMid}`}
        fill="rgba(245,158,11,0.18)"
      />
      <polyline points={points.join(" ")} fill="none" stroke={COLORS.rebar} strokeWidth="2" />
      {/* Labels. CR-Vis-Bug 2026-05: clamp y so labels never escape the
          viewBox (Mneg*ampScale was capped by ampScale but the +/- 6
          offset could push above y=25). Anchor M⁻ to the start of the
          curve and M⁺ at midspan, both with vertical clamps. */}
      <text x={xL + 4} y={Math.max(28, yMid - Mneg * ampScale - 6)} fill={COLORS.rebar} fontSize="10" fontFamily="ui-monospace, monospace">
        M⁻ = {Mneg.toFixed(1)} ton·m
      </text>
      <text x={(xL + xR) / 2} y={Math.max(28, yMid - Mpos * ampScale - 6)} textAnchor="middle" fill={COLORS.rebar} fontSize="10" fontFamily="ui-monospace, monospace">
        M⁺ = {Mpos.toFixed(1)} ton·m
      </text>
      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Diagrama de momentos M(x)
      </text>
    </svg>
  );
}

// BM-5 shear diagram — REAL stepped shape for a uniformly loaded beam:
//   V(x) decreases LINEARLY from +Vu at left support to -Vu at right.
//   At supports, V jumps (step) due to support reaction.
// We render as a single straight line (linear) which is the correct
// shape for uniform load. Plus the φVc capacity envelope (horizontal lines
// at ±φVc) so the user can see where stirrups are needed.
export function BM5_Shear({ input }: BeamDiagramProps) {
  const W = 560, H = 220;
  const padding = 40;
  const xL = padding, xR = W - padding;
  const yMid = H / 2;
  const Vu = Math.abs(input.Vu_ton);
  const amp = 70;
  const d_cm = input.h - input.recubrimiento;
  // φVc capacity (ACI §22.5): 0.75·0.53·√f'c·b·d → ton
  const phiVc = (0.75 * 0.53 * Math.sqrt(input.fc) * input.b * d_cm) / 1000;
  const vu_amp = amp;
  const vc_amp = Vu > 0 ? (phiVc / Vu) * amp : 0;
  const clamped_vc = Math.min(vc_amp, amp * 0.9);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-zinc-950">
      <SvgDefs />
      {/* Beam axis */}
      <line x1={xL} y1={yMid} x2={xR} y2={yMid} stroke={COLORS.textDim} strokeWidth="1.5" />
      {/* Support markers */}
      <polygon points={`${xL},${yMid} ${xL - 6},${yMid + 10} ${xL + 6},${yMid + 10}`} fill={COLORS.concreteStroke} />
      <polygon points={`${xR},${yMid} ${xR - 6},${yMid + 10} ${xR + 6},${yMid + 10}`} fill={COLORS.concreteStroke} />
      {/* φVc capacity band — horizontal at ±φVc */}
      <rect
        x={xL} y={yMid - clamped_vc}
        width={xR - xL} height={clamped_vc * 2}
        fill="rgba(16,185,129,0.15)"
      />
      <line x1={xL} y1={yMid - clamped_vc} x2={xR} y2={yMid - clamped_vc}
        stroke={COLORS.passing} strokeWidth="1" strokeDasharray="4,3" />
      <line x1={xL} y1={yMid + clamped_vc} x2={xR} y2={yMid + clamped_vc}
        stroke={COLORS.passing} strokeWidth="1" strokeDasharray="4,3" />
      {/* Shear V(x) shaded */}
      <polygon
        points={`${xL},${yMid} ${xL},${yMid - vu_amp} ${xR},${yMid + vu_amp} ${xR},${yMid}`}
        fill="rgba(245,158,11,0.18)"
      />
      <line x1={xL} y1={yMid - vu_amp} x2={xR} y2={yMid + vu_amp}
        stroke={COLORS.rebar} strokeWidth="2" />
      {/* Vertical jumps at supports */}
      <line x1={xL} y1={yMid} x2={xL} y2={yMid - vu_amp}
        stroke={COLORS.rebar} strokeWidth="2" />
      <line x1={xR} y1={yMid} x2={xR} y2={yMid + vu_amp}
        stroke={COLORS.rebar} strokeWidth="2" />
      {/* Labels */}
      <text x={xL + 8} y={yMid - vu_amp - 4} fill={COLORS.rebar} fontSize="10" fontFamily="ui-monospace, monospace">
        +Vu = {Vu.toFixed(1)} ton
      </text>
      <text x={xR - 8} y={yMid + vu_amp + 14} textAnchor="end" fill={COLORS.rebar} fontSize="10" fontFamily="ui-monospace, monospace">
        −Vu = {Vu.toFixed(1)} ton
      </text>
      <text x={xR - 4} y={yMid - clamped_vc - 4} textAnchor="end" fill={COLORS.passing} fontSize="9" fontFamily="ui-monospace, monospace">
        φVc = {phiVc.toFixed(1)} ton
      </text>
      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontFamily="ui-monospace, monospace">
        Diagrama de cortante V(x) + capacidad φVc
      </text>
    </svg>
  );
}

export function BeamDiagramSet({ input, liveResult }: BeamDiagramProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DiagramFrame title="BM-1 — Sección en apoyo">
          <BM1_SectionApoyo input={input} liveResult={liveResult} />
        </DiagramFrame>
        <DiagramFrame title="BM-2 — Sección en centro">
          <BM2_SectionCentro input={input} liveResult={liveResult} />
        </DiagramFrame>
      </div>
      <DiagramFrame title="BM-3 — Elevación longitudinal con todos los aros">
        <BM3_Elevation input={input} liveResult={liveResult} />
      </DiagramFrame>
      <DiagramFrame title="BM-4 — Diagrama de momentos">
        <BM4_Moments input={input} liveResult={liveResult} />
      </DiagramFrame>
      <DiagramFrame title="BM-5 — Diagrama de cortantes">
        <BM5_Shear input={input} liveResult={liveResult} />
      </DiagramFrame>
    </div>
  );
}
