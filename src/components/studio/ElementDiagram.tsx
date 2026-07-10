"use client";

/**
 * ElementDiagram — SVG cross-section / elevation per element type.
 *
 * Each variant draws a labeled engineering drawing: dimensions, hatching for
 * the concrete cross-section, colored circles for longitudinal bars, dashed
 * lines for stirrups, dimension lines with arrowheads. Designed to be read
 * by an engineer like a cuaderno page — exactly the kind of thing missing
 * from the Excel-only workflow that "was never accurate".
 *
 * All variants accept a single Props shape and pick the fields they need.
 */

interface CommonProps {
  /** Optional title shown above the diagram. */
  title?: string;
}

// ===========================================================================
// Beam cross-section
// ===========================================================================

interface BeamDiagramProps extends CommonProps {
  kind: "beam";
  b_cm: number;
  h_cm: number;
  d_cm: number;
  recubrimiento_cm: number;
  topBars?: { n: number; size: number };
  bottomBars?: { n: number; size: number };
  stirrupSize?: number;
  stirrupSpacing_cm?: number;
}

// ===========================================================================
// Rectangular column cross-section
// ===========================================================================

interface RectColumnDiagramProps extends CommonProps {
  kind: "rect_column";
  b_cm: number;
  h_cm: number;
  recubrimiento_cm: number;
  nBars: number;
  barSize: number;
  stirrupSize?: number;
  stirrupSpacingConf_cm?: number;
}

// ===========================================================================
// Circular column cross-section
// ===========================================================================

interface CircularColumnDiagramProps extends CommonProps {
  kind: "circ_column";
  D_cm: number;
  recubrimiento_cm: number;
  nBars: number;
  barSize: number;
  spiralSpacing_cm?: number;
}

// ===========================================================================
// Isolated footing (plan + section)
// ===========================================================================

interface IsolatedFootingDiagramProps extends CommonProps {
  kind: "isolated_footing";
  B_m: number;
  L_m: number;
  h_cm: number;
  bc_cm: number;
  lc_cm: number;
}

// ===========================================================================
// Strip footing section
// ===========================================================================

interface StripFootingDiagramProps extends CommonProps {
  kind: "strip_footing";
  B_m: number;
  h_cm: number;
  bMuro_cm: number;
}

// ===========================================================================
// Slab section (one-way / two-way generic)
// ===========================================================================

interface SlabDiagramProps extends CommonProps {
  kind: "slab";
  span_m: number;
  h_cm: number;
  label: string;
}

// ===========================================================================
// Shear wall elevation
// ===========================================================================

interface ShearWallDiagramProps extends CommonProps {
  kind: "shear_wall";
  lw_m: number;
  hw_m: number;
  t_cm: number;
  dosCortinas: boolean;
}

// ===========================================================================
// Stair section
// ===========================================================================

interface StairDiagramProps extends CommonProps {
  kind: "stair";
  L_m: number;
  C_cm: number;
  H_cm: number;
  h_cm: number;
}

// ===========================================================================
// Lintel section
// ===========================================================================

interface LintelDiagramProps extends CommonProps {
  kind: "lintel";
  a_cm: number;
  b_cm: number;
  h_cm: number;
}

type DiagramProps =
  | BeamDiagramProps
  | RectColumnDiagramProps
  | CircularColumnDiagramProps
  | IsolatedFootingDiagramProps
  | StripFootingDiagramProps
  | SlabDiagramProps
  | ShearWallDiagramProps
  | StairDiagramProps
  | LintelDiagramProps;

// ---------------------------------------------------------------------------

const CONCRETE_FILL = "#27272a";
const CONCRETE_HATCH = "#3f3f46";
const STEEL_FILL = "#f59e0b";
const STEEL_STROKE = "#fbbf24";
const STIRRUP_STROKE = "#10b981";
const DIM_STROKE = "#a1a1aa";
const TEXT_COLOR = "#e4e4e7";

function arrowMarkers() {
  return (
    <defs>
      <marker
        id="arrow-end"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={DIM_STROKE} />
      </marker>
      <pattern
        id="concrete-hatch"
        patternUnits="userSpaceOnUse"
        width="6"
        height="6"
        patternTransform="rotate(45)"
      >
        <rect width="6" height="6" fill={CONCRETE_FILL} />
        <line x1="0" y1="0" x2="0" y2="6" stroke={CONCRETE_HATCH} strokeWidth="1" />
      </pattern>
    </defs>
  );
}

function DimLine({
  x1, y1, x2, y2, label,
}: {
  x1: number; y1: number; x2: number; y2: number; label: string;
}) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  // CR-Vis-Bug 2026-05: Size text background to the label width so dim
  // line + arrowheads stay visible. Suppress entirely if the line is too
  // short to fit both the label box and arrowheads (≥14 px padding).
  const len = Math.hypot(x2 - x1, y2 - y1);
  const textW = Math.max(28, label.length * 6.5);
  const showBg = len > textW + 14;
  return (
    <g>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={DIM_STROKE} strokeWidth="1"
        markerStart="url(#arrow-end)" markerEnd="url(#arrow-end)"
      />
      {showBg && (
        <rect
          x={midX - textW / 2} y={midY - 8} width={textW} height="14"
          fill="#09090b" stroke={DIM_STROKE} strokeWidth="0.5"
        />
      )}
      <text
        x={midX} y={midY + 3} textAnchor="middle"
        fill={TEXT_COLOR} fontSize="10" fontFamily="monospace"
      >
        {label}
      </text>
    </g>
  );
}

// ===========================================================================
// Renderers
// ===========================================================================

function BeamDiagram(p: BeamDiagramProps) {
  // Frame: 360 wide × 280 tall, draw cross-section centered with margins
  const W = 360, H = 280;
  const margin = 50;
  const drawW = W - 2 * margin;
  const drawH = H - 2 * margin;
  // Scale so that h fills 70% of drawH
  const scale = Math.min(drawW / Math.max(p.b_cm, 30), drawH / Math.max(p.h_cm, 40)) * 0.75;
  const bw = p.b_cm * scale;
  const bh = p.h_cm * scale;
  const x0 = (W - bw) / 2;
  const y0 = (H - bh) / 2;
  const cover = p.recubrimiento_cm * scale;

  function placeRow(n: number, yPos: number, size: number) {
    if (n <= 0) return null;
    const innerW = bw - 2 * cover;
    const spacing = n > 1 ? innerW / (n - 1) : 0;
    const barR = Math.max(3, 1.5 + size * 0.5);
    return Array.from({ length: n }).map((_, i) => (
      <circle
        key={`${yPos}-${i}`}
        cx={x0 + cover + (n > 1 ? i * spacing : innerW / 2)}
        cy={yPos}
        r={barR}
        fill={STEEL_FILL}
        stroke={STEEL_STROKE}
        strokeWidth="1"
      />
    ));
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {arrowMarkers()}
      {/* Concrete */}
      <rect x={x0} y={y0} width={bw} height={bh} fill="url(#concrete-hatch)" stroke={CONCRETE_HATCH} strokeWidth="2" />
      {/* Stirrup outline */}
      <rect
        x={x0 + cover} y={y0 + cover}
        width={bw - 2 * cover} height={bh - 2 * cover}
        fill="none" stroke={STIRRUP_STROKE} strokeWidth="1.5" strokeDasharray="3,2"
      />
      {/* Top bars */}
      {p.topBars && placeRow(p.topBars.n, y0 + cover + 5, p.topBars.size)}
      {/* Bottom bars */}
      {p.bottomBars && placeRow(p.bottomBars.n, y0 + bh - cover - 5, p.bottomBars.size)}
      {/* Width dimension */}
      <DimLine x1={x0} y1={y0 + bh + 24} x2={x0 + bw} y2={y0 + bh + 24} label={`b = ${p.b_cm} cm`} />
      {/* Height dimension */}
      <DimLine x1={x0 + bw + 24} y1={y0} x2={x0 + bw + 24} y2={y0 + bh} label={`h = ${p.h_cm} cm`} />
      {/* Effective depth note */}
      <text x={x0 + bw / 2} y={y0 - 12} textAnchor="middle" fill={TEXT_COLOR} fontSize="10" fontFamily="monospace">
        d = {p.d_cm.toFixed(1)} cm · r = {p.recubrimiento_cm} cm
      </text>
      {/* Reinforcement labels */}
      {p.bottomBars && (
        <text x={x0 + bw / 2} y={y0 + bh - cover - 12} textAnchor="middle" fill={STEEL_FILL} fontSize="9" fontFamily="monospace">
          {p.bottomBars.n} #{p.bottomBars.size} (inf)
        </text>
      )}
      {p.topBars && (
        <text x={x0 + bw / 2} y={y0 + cover + 18} textAnchor="middle" fill={STEEL_FILL} fontSize="9" fontFamily="monospace">
          {p.topBars.n} #{p.topBars.size} (sup)
        </text>
      )}
      {p.stirrupSize && p.stirrupSpacing_cm && (
        <text x={x0 + bw / 2} y={H - 8} textAnchor="middle" fill={STIRRUP_STROKE} fontSize="9" fontFamily="monospace">
          Estr. #{p.stirrupSize} @ {p.stirrupSpacing_cm.toFixed(0)} cm
        </text>
      )}
    </svg>
  );
}

function RectColumnDiagram(p: RectColumnDiagramProps) {
  const W = 320, H = 320;
  const margin = 60;
  const drawW = W - 2 * margin;
  const drawH = H - 2 * margin;
  const scale = Math.min(drawW / Math.max(p.b_cm, 25), drawH / Math.max(p.h_cm, 25)) * 0.8;
  const bw = p.b_cm * scale;
  const bh = p.h_cm * scale;
  const x0 = (W - bw) / 2;
  const y0 = (H - bh) / 2;
  const cover = p.recubrimiento_cm * scale;

  // Distribute bars on perimeter — assume nBars divisible by 4 for corners + sides
  const n = Math.max(4, p.nBars);
  const perSide = Math.ceil(n / 4); // bars per side incl corner
  const positions: Array<[number, number]> = [];
  const innerW = bw - 2 * cover;
  const innerH = bh - 2 * cover;

  // Build by walking perimeter — corner bars shared
  const top: Array<[number, number]> = [];
  const bottom: Array<[number, number]> = [];
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  // Compute bars-per-side as evenly as possible
  const remaining = n - 4;
  const perSidePlus = Math.floor(remaining / 4);
  const extra = remaining % 4;
  const sideCounts = [perSidePlus, perSidePlus, perSidePlus, perSidePlus];
  for (let i = 0; i < extra; i++) sideCounts[i]++;

  // Corners
  positions.push([x0 + cover, y0 + cover]);
  positions.push([x0 + bw - cover, y0 + cover]);
  positions.push([x0 + bw - cover, y0 + bh - cover]);
  positions.push([x0 + cover, y0 + bh - cover]);

  // Top intermediate (between corners 0 and 1)
  for (let i = 0; i < sideCounts[0]; i++) {
    const t = (i + 1) / (sideCounts[0] + 1);
    positions.push([x0 + cover + t * innerW, y0 + cover]);
  }
  // Right (between 1 and 2)
  for (let i = 0; i < sideCounts[1]; i++) {
    const t = (i + 1) / (sideCounts[1] + 1);
    positions.push([x0 + bw - cover, y0 + cover + t * innerH]);
  }
  // Bottom (between 2 and 3)
  for (let i = 0; i < sideCounts[2]; i++) {
    const t = (i + 1) / (sideCounts[2] + 1);
    positions.push([x0 + bw - cover - t * innerW, y0 + bh - cover]);
  }
  // Left (between 3 and 0)
  for (let i = 0; i < sideCounts[3]; i++) {
    const t = (i + 1) / (sideCounts[3] + 1);
    positions.push([x0 + cover, y0 + bh - cover - t * innerH]);
  }

  const barR = Math.max(3, 1.5 + p.barSize * 0.5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {arrowMarkers()}
      <rect x={x0} y={y0} width={bw} height={bh} fill="url(#concrete-hatch)" stroke={CONCRETE_HATCH} strokeWidth="2" />
      <rect
        x={x0 + cover} y={y0 + cover}
        width={innerW} height={innerH}
        fill="none" stroke={STIRRUP_STROKE} strokeWidth="1.5" strokeDasharray="3,2"
      />
      {positions.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={barR} fill={STEEL_FILL} stroke={STEEL_STROKE} strokeWidth="1" />
      ))}
      <DimLine x1={x0} y1={y0 + bh + 24} x2={x0 + bw} y2={y0 + bh + 24} label={`b = ${p.b_cm} cm`} />
      <DimLine x1={x0 + bw + 24} y1={y0} x2={x0 + bw + 24} y2={y0 + bh} label={`h = ${p.h_cm} cm`} />
      <text x={x0 + bw / 2} y={y0 - 12} textAnchor="middle" fill={STEEL_FILL} fontSize="10" fontFamily="monospace">
        {p.nBars} #{p.barSize}
      </text>
      {p.stirrupSize && p.stirrupSpacingConf_cm && (
        <text x={x0 + bw / 2} y={H - 8} textAnchor="middle" fill={STIRRUP_STROKE} fontSize="9" fontFamily="monospace">
          Aros #{p.stirrupSize} @ {p.stirrupSpacingConf_cm.toFixed(0)} cm (conf.)
        </text>
      )}
    </svg>
  );
}

function CircularColumnDiagram(p: CircularColumnDiagramProps) {
  const W = 320, H = 320;
  const cx = W / 2;
  const cy = H / 2;
  const margin = 60;
  const scale = Math.min(W - 2 * margin, H - 2 * margin) / Math.max(p.D_cm, 30);
  const R = (p.D_cm * scale) / 2;
  const cover = p.recubrimiento_cm * scale;
  const Rinner = R - cover;
  const n = Math.max(6, p.nBars);
  const barR = Math.max(3, 1.5 + p.barSize * 0.5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {arrowMarkers()}
      <circle cx={cx} cy={cy} r={R} fill="url(#concrete-hatch)" stroke={CONCRETE_HATCH} strokeWidth="2" />
      <circle cx={cx} cy={cy} r={Rinner} fill="none" stroke={STIRRUP_STROKE} strokeWidth="1.5" strokeDasharray="3,2" />
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * 2 * Math.PI - Math.PI / 2;
        return (
          <circle
            key={i}
            cx={cx + Rinner * Math.cos(a)}
            cy={cy + Rinner * Math.sin(a)}
            r={barR}
            fill={STEEL_FILL}
            stroke={STEEL_STROKE}
            strokeWidth="1"
          />
        );
      })}
      <DimLine x1={cx - R} y1={cy + R + 30} x2={cx + R} y2={cy + R + 30} label={`D = ${p.D_cm} cm`} />
      <text x={cx} y={cy - R - 12} textAnchor="middle" fill={STEEL_FILL} fontSize="10" fontFamily="monospace">
        {p.nBars} #{p.barSize} con espiral
      </text>
      {p.spiralSpacing_cm && (
        <text x={cx} y={H - 8} textAnchor="middle" fill={STIRRUP_STROKE} fontSize="9" fontFamily="monospace">
          Espiral @ {p.spiralSpacing_cm.toFixed(1)} cm
        </text>
      )}
    </svg>
  );
}

function IsolatedFootingDiagram(p: IsolatedFootingDiagramProps) {
  // Plan view on top + section below
  const W = 380, H = 340;
  // Plan
  const planMaxW = 320, planMaxH = 160;
  const planScale = Math.min(planMaxW / Math.max(p.B_m, 0.5), planMaxH / Math.max(p.L_m, 0.5)) * 0.85;
  const pw = p.B_m * planScale;
  const ph = p.L_m * planScale;
  const px0 = (W - pw) / 2;
  const py0 = 24;

  // Column on plan
  const cw = (p.bc_cm / 100) * planScale;
  const ch = (p.lc_cm / 100) * planScale;
  const cx0 = px0 + (pw - cw) / 2;
  const cy0 = py0 + (ph - ch) / 2;

  // Section below
  const secY = py0 + ph + 60;
  const secH = (p.h_cm / 100) * planScale * 4; // amplify for visibility
  const secX0 = px0;
  const secW = pw;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {arrowMarkers()}
      <text x={W / 2} y={14} textAnchor="middle" fill={TEXT_COLOR} fontSize="10">Planta</text>
      <rect x={px0} y={py0} width={pw} height={ph} fill="url(#concrete-hatch)" stroke={CONCRETE_HATCH} strokeWidth="2" />
      <rect x={cx0} y={cy0} width={cw} height={ch} fill="#52525b" stroke={STEEL_STROKE} strokeWidth="1" />
      <DimLine x1={px0} y1={py0 + ph + 18} x2={px0 + pw} y2={py0 + ph + 18} label={`B = ${p.B_m} m`} />
      <DimLine x1={px0 + pw + 18} y1={py0} x2={px0 + pw + 18} y2={py0 + ph} label={`L = ${p.L_m} m`} />

      <text x={W / 2} y={secY - 8} textAnchor="middle" fill={TEXT_COLOR} fontSize="10">Sección</text>
      <rect x={secX0} y={secY} width={secW} height={secH} fill="url(#concrete-hatch)" stroke={CONCRETE_HATCH} strokeWidth="2" />
      {/* Mat reinforcement */}
      {Array.from({ length: 6 }).map((_, i) => (
        <line
          key={i}
          x1={secX0 + (i + 1) * (secW / 7)}
          y1={secY + secH - 8}
          x2={secX0 + (i + 1) * (secW / 7)}
          y2={secY + secH - 4}
          stroke={STEEL_FILL}
          strokeWidth="2"
        />
      ))}
      <DimLine x1={secX0 + secW + 18} y1={secY} x2={secX0 + secW + 18} y2={secY + secH} label={`h = ${p.h_cm} cm`} />
    </svg>
  );
}

function StripFootingDiagram(p: StripFootingDiagramProps) {
  const W = 360, H = 240;
  const margin = 60;
  const scale = Math.min((W - 2 * margin) / Math.max(p.B_m, 0.5), 120 / Math.max(p.h_cm, 20)) * 0.7;
  const bw = p.B_m * scale * 1.0;
  const bh = p.h_cm * scale * 1.5;
  const x0 = (W - bw) / 2;
  const y0 = 60;
  const wallW = (p.bMuro_cm / 100) * scale * 1.0;
  const wallX = x0 + (bw - wallW) / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {arrowMarkers()}
      {/* Wall */}
      <rect x={wallX} y={y0 - 50} width={wallW} height={50} fill="#3f3f46" stroke={CONCRETE_HATCH} />
      {/* Footing */}
      <rect x={x0} y={y0} width={bw} height={bh} fill="url(#concrete-hatch)" stroke={CONCRETE_HATCH} strokeWidth="2" />
      {/* Transverse rebar */}
      {Array.from({ length: 8 }).map((_, i) => (
        <circle key={i} cx={x0 + 10 + i * ((bw - 20) / 7)} cy={y0 + bh - 8} r={3} fill={STEEL_FILL} stroke={STEEL_STROKE} />
      ))}
      <DimLine x1={x0} y1={y0 + bh + 18} x2={x0 + bw} y2={y0 + bh + 18} label={`B = ${p.B_m} m`} />
      <DimLine x1={x0 + bw + 18} y1={y0} x2={x0 + bw + 18} y2={y0 + bh} label={`h = ${p.h_cm} cm`} />
      <text x={wallX + wallW / 2} y={y0 - 26} textAnchor="middle" fill={TEXT_COLOR} fontSize="9">muro {p.bMuro_cm} cm</text>
    </svg>
  );
}

function SlabDiagram(p: SlabDiagramProps) {
  const W = 380, H = 200;
  const margin = 50;
  const scale = (W - 2 * margin) / Math.max(p.span_m, 1.0);
  const sw = p.span_m * scale;
  const sh = Math.max(20, (p.h_cm / 100) * scale * 4);
  const x0 = (W - sw) / 2;
  const y0 = (H - sh) / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {arrowMarkers()}
      <rect x={x0} y={y0} width={sw} height={sh} fill="url(#concrete-hatch)" stroke={CONCRETE_HATCH} strokeWidth="2" />
      {/* Bottom bars */}
      {Array.from({ length: 12 }).map((_, i) => (
        <circle
          key={`b${i}`}
          cx={x0 + 8 + i * ((sw - 16) / 11)}
          cy={y0 + sh - 6}
          r={2.5}
          fill={STEEL_FILL}
          stroke={STEEL_STROKE}
        />
      ))}
      {/* Top bars */}
      {Array.from({ length: 12 }).map((_, i) => (
        <circle
          key={`t${i}`}
          cx={x0 + 8 + i * ((sw - 16) / 11)}
          cy={y0 + 6}
          r={2}
          fill={STEEL_FILL}
          stroke={STEEL_STROKE}
          opacity="0.5"
        />
      ))}
      <DimLine x1={x0} y1={y0 + sh + 18} x2={x0 + sw} y2={y0 + sh + 18} label={`L = ${p.span_m.toFixed(2)} m`} />
      <DimLine x1={x0 + sw + 18} y1={y0} x2={x0 + sw + 18} y2={y0 + sh} label={`h = ${p.h_cm} cm`} />
      <text x={W / 2} y={16} textAnchor="middle" fill={TEXT_COLOR} fontSize="10">{p.label}</text>
    </svg>
  );
}

function ShearWallDiagram(p: ShearWallDiagramProps) {
  const W = 320, H = 360;
  const margin = 60;
  const scaleH = (H - margin * 2) / Math.max(p.hw_m, 1.5);
  const scaleW = (W - margin * 2) / Math.max(p.lw_m, 1.5);
  const scale = Math.min(scaleH, scaleW) * 0.75;
  const ww = p.lw_m * scale;
  const wh = p.hw_m * scale;
  const x0 = (W - ww) / 2;
  const y0 = (H - wh) / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {arrowMarkers()}
      <rect x={x0} y={y0} width={ww} height={wh} fill="url(#concrete-hatch)" stroke={CONCRETE_HATCH} strokeWidth="2" />
      {/* Vertical reinforcement curtain(s) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <line
          key={`v${i}`}
          x1={x0 + 6 + i * ((ww - 12) / 5)}
          y1={y0 + 6}
          x2={x0 + 6 + i * ((ww - 12) / 5)}
          y2={y0 + wh - 6}
          stroke={STEEL_FILL}
          strokeWidth="1"
          opacity={p.dosCortinas ? "0.9" : "0.6"}
        />
      ))}
      {/* Horizontal reinforcement */}
      {Array.from({ length: 8 }).map((_, i) => (
        <line
          key={`h${i}`}
          x1={x0 + 6}
          y1={y0 + 6 + i * ((wh - 12) / 7)}
          x2={x0 + ww - 6}
          y2={y0 + 6 + i * ((wh - 12) / 7)}
          stroke={STIRRUP_STROKE}
          strokeWidth="1"
          strokeDasharray="2,2"
        />
      ))}
      <DimLine x1={x0} y1={y0 + wh + 22} x2={x0 + ww} y2={y0 + wh + 22} label={`lw = ${p.lw_m} m`} />
      <DimLine x1={x0 + ww + 22} y1={y0} x2={x0 + ww + 22} y2={y0 + wh} label={`hw = ${p.hw_m} m`} />
      <text x={W / 2} y={H - 14} textAnchor="middle" fill={TEXT_COLOR} fontSize="9" fontFamily="monospace">
        t = {p.t_cm} cm · {p.dosCortinas ? "doble cortina" : "una cortina"}
      </text>
    </svg>
  );
}

function StairDiagram(p: StairDiagramProps) {
  const W = 380, H = 260;
  const margin = 40;
  const scale = (W - 2 * margin) / Math.max(p.L_m, 1.5) * 0.9;
  const lw = p.L_m * scale;
  const lh = (p.L_m * (p.C_cm / p.H_cm)) * scale * 0.4 + 60;
  const x0 = margin;
  const y0 = H - margin;

  // Build inclined slab as polyline of steps
  const steps = Math.max(3, Math.floor((p.L_m * 100) / p.H_cm));
  const stepW = lw / steps;
  const stepH = lh / steps;
  const points: string[] = [];
  points.push(`${x0},${y0}`);
  for (let i = 0; i < steps; i++) {
    const xa = x0 + i * stepW;
    const ya = y0 - i * stepH;
    points.push(`${xa},${ya}`);
    points.push(`${xa + stepW},${ya}`);
    points.push(`${xa + stepW},${ya - stepH}`);
  }
  points.push(`${x0 + lw},${y0 - lh}`);
  // Close along bottom
  const tCm = p.h_cm;
  const tScale = tCm / 100 * scale * 1.2;
  points.push(`${x0 + lw + tScale * 0.6},${y0 - lh + tScale * 0.6}`);
  points.push(`${x0 - tScale * 0.2},${y0 + tScale * 0.6}`);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {arrowMarkers()}
      <polygon points={points.join(" ")} fill="url(#concrete-hatch)" stroke={CONCRETE_HATCH} strokeWidth="2" />
      <text x={W / 2} y={20} textAnchor="middle" fill={TEXT_COLOR} fontSize="10" fontFamily="monospace">
        C = {p.C_cm} cm · H = {p.H_cm} cm · h losa = {p.h_cm} cm
      </text>
      <DimLine x1={x0} y1={y0 + 28} x2={x0 + lw} y2={y0 + 28} label={`L = ${p.L_m.toFixed(2)} m`} />
    </svg>
  );
}

function LintelDiagram(p: LintelDiagramProps) {
  // Show as a small beam with span a above an opening
  const W = 360, H = 220;
  const margin = 50;
  const beamW = (W - 2 * margin);
  const beamH = Math.max(30, p.h_cm * 1.5);
  const x0 = margin;
  const y0 = 50;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {arrowMarkers()}
      {/* Walls */}
      <rect x={x0 - 30} y={y0} width={30} height={beamH + 60} fill="#3f3f46" />
      <rect x={x0 + beamW} y={y0} width={30} height={beamH + 60} fill="#3f3f46" />
      {/* Lintel */}
      <rect x={x0} y={y0} width={beamW} height={beamH} fill="url(#concrete-hatch)" stroke={CONCRETE_HATCH} strokeWidth="2" />
      {/* Bars */}
      {[2, 4].map((cy, i) => (
        Array.from({ length: 2 }).map((_, j) => (
          <circle
            key={`${i}-${j}`}
            cx={x0 + (j === 0 ? 8 : beamW - 8)}
            cy={y0 + (cy === 2 ? 6 : beamH - 6)}
            r={3}
            fill={STEEL_FILL}
            stroke={STEEL_STROKE}
          />
        ))
      ))}
      <DimLine x1={x0} y1={y0 + beamH + 20} x2={x0 + beamW} y2={y0 + beamH + 20} label={`a = ${p.a_cm} cm`} />
      <DimLine x1={x0 + beamW + 18} y1={y0} x2={x0 + beamW + 18} y2={y0 + beamH} label={`h = ${p.h_cm} cm`} />
      <text x={W / 2} y={H - 10} textAnchor="middle" fill={TEXT_COLOR} fontSize="9" fontFamily="monospace">
        b = {p.b_cm} cm
      </text>
    </svg>
  );
}

// ===========================================================================
// Dispatcher
// ===========================================================================

export function ElementDiagram(p: DiagramProps) {
  let body: React.ReactNode;
  switch (p.kind) {
    case "beam": body = <BeamDiagram {...p} />; break;
    case "rect_column": body = <RectColumnDiagram {...p} />; break;
    case "circ_column": body = <CircularColumnDiagram {...p} />; break;
    case "isolated_footing": body = <IsolatedFootingDiagram {...p} />; break;
    case "strip_footing": body = <StripFootingDiagram {...p} />; break;
    case "slab": body = <SlabDiagram {...p} />; break;
    case "shear_wall": body = <ShearWallDiagram {...p} />; break;
    case "stair": body = <StairDiagram {...p} />; break;
    case "lintel": body = <LintelDiagram {...p} />; break;
  }
  return (
    <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/30">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
        {p.title ?? "Diagrama"}
      </div>
      {body}
    </div>
  );
}
