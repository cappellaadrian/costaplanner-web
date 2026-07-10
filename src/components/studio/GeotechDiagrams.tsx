"use client";

/**
 * GeotechDiagrams — SVG components for the 9 geotechnical tools.
 *
 * Each diagram is a stateless React component that returns an SVG. They use
 * the shared visual language from `svg-primitives.tsx` (concrete gray, soil
 * terra-cotta, water blue, blue dim lines, red force vectors) so the PDFs
 * match the look of the structural diagrams.
 *
 * Drawing language standard:
 *   - Soil   = #92400e / #78350f hatch        (matches COLORS.soil)
 *   - Water  = #3b82f6 (blue, dashed wave line for water table)
 *   - Rock / saprolite = #57534e (stone gray-brown)
 *   - Concrete (footing/wall) = #d4d4d8 hatch (matches COLORS.concrete)
 *   - Dim lines = blue arrowheads
 *   - Pass = emerald, Fail = red
 *
 * Every component is ~30-80 lines. Real engineering linework: solid black
 * outlines, simple flat fills, no AI-slop gradients.
 */

import { COLORS, SvgDefs, DimLine } from "./svg-primitives";
import type { SPTLiveResult, SPTInput } from "@/lib/spt-live";
import type { CPTLiveResult, CPTInput } from "@/lib/cpt-live";
import type { BearingResult } from "@/lib/bearing-capacity-live";
import type { SettlementResult, SettlementInput } from "@/lib/asentamientos-live";
import type { SpringResult, SpringInput } from "@/lib/rigidez-resorte-live";
import type { SlopeResult, SlopeInput } from "@/lib/taludes-live";
import type { LiqResult, LiqInput } from "@/lib/licuefaccion-live";
import type { ProfileResult } from "@/lib/perfil-live";
import type { WallResult, TipoMuro } from "@/lib/muros-tipologia-live";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Color per soil keyword. Terra-cotta family with shifts by grain/cohesion. */
function soilColor(soil: string): string {
  const s = soil.toLowerCase();
  if (s.includes("grava")) return "#78716c";
  if (s.includes("arena_limosa") || s.includes("arena limosa")) return "#a8784e";
  if (s.includes("arena_arcillosa") || s.includes("arena arcillosa")) return "#a06340";
  if (s.includes("arena")) return "#b87333";
  if (s.includes("limo")) return "#9a8056";
  if (s.includes("arcilla")) return "#7c4a2d";
  if (s.includes("toba") || s.includes("saprolit")) return "#8a7458";
  if (s.includes("ceniza") || s.includes("volcán")) return "#7a6354";
  return "#92400e";
}

/** Wavy water-table line. */
function WaterTableLine({ x1, x2, y, label }: { x1: number; x2: number; y: number; label?: string }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,3" />
      {/* Inverted triangle marker (groundwater symbol) */}
      <polygon
        points={`${x1 - 4},${y - 6} ${x1 + 4},${y - 6} ${x1},${y}`}
        fill="#3b82f6" stroke="#1d4ed8" strokeWidth="0.5"
      />
      {label && (
        <text x={x1 + 6} y={y - 2} fill="#60a5fa" fontSize="9" fontFamily="ui-monospace, monospace">
          {label}
        </text>
      )}
    </g>
  );
}

// ===========================================================================
// 1. SPTProfileSvg — depth strip with N60 readouts
// ===========================================================================

export function SPTProfileSvg({
  r,
  input,
}: {
  r: SPTLiveResult;
  input: SPTInput;
}) {
  const water_table_m = input.water_table_m;
  const W = 320, H = 600;
  const margin = { top: 30, left: 70, right: 90, bottom: 30 };
  const innerH = H - margin.top - margin.bottom;
  const maxDepth = Math.max(8, ...r.layers.map((l) => l.depth_m + 0.5));
  const yOf = (d: number) => margin.top + (d / maxDepth) * innerH;
  const colW = 120;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 360 }}>
      <SvgDefs />
      <rect x="0" y="0" width={W} height={H} fill={COLORS.background} />

      {/* Depth axis ticks every 1 m */}
      {Array.from({ length: Math.ceil(maxDepth) + 1 }).map((_, i) => (
        <g key={i}>
          <line
            x1={margin.left - 5} y1={yOf(i)} x2={margin.left} y2={yOf(i)}
            stroke={COLORS.textFaint} strokeWidth="0.6"
          />
          <text
            x={margin.left - 8} y={yOf(i) + 3} textAnchor="end"
            fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace"
          >
            {i}m
          </text>
        </g>
      ))}

      {/* Layer rectangles between successive depths */}
      {r.layers.map((l, i) => {
        const yTop = i === 0 ? margin.top : yOf((r.layers[i - 1].depth_m + l.depth_m) / 2);
        const yBot = i === r.layers.length - 1 ? yOf(maxDepth) : yOf((l.depth_m + r.layers[i + 1].depth_m) / 2);
        const soil = input.readings[i]?.soil ?? "arena";
        return (
          <g key={i}>
            <rect
              x={margin.left} y={yTop} width={colW} height={yBot - yTop}
              fill={soilColor(soil)} stroke={COLORS.textFaint} strokeWidth="0.4" opacity="0.85"
            />
            {/* SPT sample tick at exact depth */}
            <line
              x1={margin.left} y1={yOf(l.depth_m)} x2={margin.left + colW} y2={yOf(l.depth_m)}
              stroke="#000" strokeWidth="0.8" strokeDasharray="2,2"
            />
            {/* N60 label */}
            <text
              x={margin.left + colW + 6} y={yOf(l.depth_m) + 3}
              fill="#fbbf24" fontSize="11" fontFamily="ui-monospace, monospace" fontWeight="700"
            >
              N₆₀={l.N60.toFixed(0)}
            </text>
            {/* Soil-name caption (tiny) */}
            <text
              x={margin.left + 4} y={yTop + 11}
              fill="#fef3c7" fontSize="8" fontFamily="ui-monospace, monospace"
            >
              {soil.replace("_", " ")}
            </text>
          </g>
        );
      })}

      {/* Water table */}
      {water_table_m < 50 && water_table_m < maxDepth && (
        <WaterTableLine x1={margin.left} x2={margin.left + colW} y={yOf(water_table_m)} label="NF" />
      )}

      {/* Title */}
      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontWeight="700">
        Perfil SPT — N₆₀ por capa
      </text>
    </svg>
  );
}

// ===========================================================================
// 2. CPTProfileSvg — Robertson SBT zones + qc curve + Ic at right
// ===========================================================================

/** Robertson SBT zone colors (1-9 simplified). */
const SBT_COLORS: Record<number, string> = {
  1: "#52525b", 2: "#1c1917", 3: "#78350f", 4: "#92400e",
  5: "#b45309", 6: "#d97706", 7: "#f59e0b", 8: "#fbbf24", 9: "#fde68a",
};

export function CPTProfileSvg({
  r,
  input,
}: {
  r: CPTLiveResult;
  input: CPTInput;
}) {
  const water_table_m = input.water_table_m;
  const W = 360, H = 600;
  const margin = { top: 30, left: 60, right: 60, bottom: 30 };
  const innerH = H - margin.top - margin.bottom;
  const maxDepth = Math.max(5, ...r.layers.map((l) => l.depth_m + 0.5));
  const maxQc = Math.max(5, ...r.layers.map((l) => l.qc_MPa));
  const yOf = (d: number) => margin.top + (d / maxDepth) * innerH;
  const sbtW = 70;
  const qcW = 140;
  const xQc = margin.left + sbtW + 10;

  // qc polyline
  const pts = r.layers
    .map((l) => `${xQc + (l.qc_MPa / maxQc) * qcW},${yOf(l.depth_m)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 400 }}>
      <SvgDefs />
      <rect x="0" y="0" width={W} height={H} fill={COLORS.background} />

      {/* SBT zone column */}
      {r.layers.map((l, i) => {
        const yTop = i === 0 ? margin.top : yOf((r.layers[i - 1].depth_m + l.depth_m) / 2);
        const yBot = i === r.layers.length - 1 ? yOf(maxDepth) : yOf((l.depth_m + r.layers[i + 1].depth_m) / 2);
        return (
          <g key={i}>
            <rect
              x={margin.left} y={yTop} width={sbtW} height={yBot - yTop}
              fill={SBT_COLORS[l.SBT_zone] ?? "#92400e"} stroke="#000" strokeWidth="0.4"
            />
            <text
              x={margin.left + sbtW / 2} y={(yTop + yBot) / 2 + 3}
              textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700"
              fontFamily="ui-monospace, monospace"
            >
              SBT {l.SBT_zone}
            </text>
          </g>
        );
      })}

      {/* Depth ticks */}
      {Array.from({ length: Math.ceil(maxDepth) + 1 }).map((_, i) => (
        <g key={i}>
          <line x1={margin.left - 5} y1={yOf(i)} x2={margin.left} y2={yOf(i)} stroke={COLORS.textFaint} strokeWidth="0.6" />
          <text x={margin.left - 8} y={yOf(i) + 3} textAnchor="end" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">
            {i}m
          </text>
        </g>
      ))}

      {/* qc axis line */}
      <line x1={xQc} y1={margin.top} x2={xQc} y2={H - margin.bottom} stroke={COLORS.textFaint} strokeWidth="0.6" />
      <line x1={xQc} y1={H - margin.bottom} x2={xQc + qcW} y2={H - margin.bottom} stroke={COLORS.textFaint} strokeWidth="0.6" />
      <text x={xQc + qcW / 2} y={H - margin.bottom + 12} textAnchor="middle" fill={COLORS.textDim} fontSize="9">
        qc (MPa)
      </text>

      {/* qc curve */}
      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth="1.4" />
      {r.layers.map((l, i) => (
        <circle
          key={i}
          cx={xQc + (l.qc_MPa / maxQc) * qcW}
          cy={yOf(l.depth_m)}
          r="2.5" fill="#10b981"
        />
      ))}

      {/* Ic at right */}
      {r.layers.map((l, i) => (
        <text
          key={i}
          x={W - margin.right + 4} y={yOf(l.depth_m) + 3}
          fill="#fbbf24" fontSize="10" fontFamily="ui-monospace, monospace"
        >
          Ic={l.Ic.toFixed(2)}
        </text>
      ))}

      {/* Water table */}
      {water_table_m < 50 && water_table_m < maxDepth && (
        <WaterTableLine x1={margin.left} x2={xQc + qcW} y={yOf(water_table_m)} label="NF" />
      )}

      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontWeight="700">
        Perfil CPT — Robertson SBT + qc + Ic
      </text>
    </svg>
  );
}

// ===========================================================================
// 3. BearingFailureWedgeSvg — Prandtl-Terzaghi failure wedge
// ===========================================================================

export function BearingFailureWedgeSvg({ r }: { r: BearingResult }) {
  const W = 500, H = 320;
  const cx = W / 2;
  const groundY = 110;
  const { B_m, Df_m, phi_deg } = r.input;
  // Px scale: B → 140 px
  const scale = 140 / Math.max(0.5, B_m);
  const Bpx = B_m * scale;
  const Dfpx = Math.min(60, Df_m * scale);
  const baseY = groundY + Dfpx;
  const footX1 = cx - Bpx / 2;
  const footX2 = cx + Bpx / 2;

  // Wedge geometry (Prandtl):
  // Zone I (active, directly under): triangle from footing corners going down at (45 + φ/2)
  const phi_rad = (phi_deg * Math.PI) / 180;
  const zoneI_angle = Math.PI / 4 + phi_rad / 2;
  const zoneI_h = Math.min(110, (Bpx / 2) * Math.tan(zoneI_angle));
  const apexX = cx;
  const apexY = baseY + zoneI_h;

  // Zone III (passive Rankine) — slip rises back to ground at (45 - φ/2)
  const zoneIII_angle = Math.PI / 4 - phi_rad / 2;
  const slipRunL = zoneI_h / Math.tan(zoneIII_angle);
  const surfaceLX = footX1 - slipRunL;
  const surfaceRX = footX2 + slipRunL;

  // Log-spiral zone II — approximate with arc from apex through transition
  // Sample arc from apex up to ground intersection on left
  const arcLeftPts: string[] = [];
  const arcRightPts: string[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // Logarithmic spiral r = r0 · exp(θ·tan φ)
    const theta = t * Math.PI / 2; // 90° span
    const r0 = zoneI_h * 0.55;
    const rad = r0 * Math.exp(theta * Math.tan(phi_rad));
    // Right side: from apex sweep counter-clockwise upward to the slip outlet
    arcRightPts.push(`${apexX + rad * Math.sin(theta)},${apexY - rad * Math.cos(theta)}`);
    arcLeftPts.push(`${apexX - rad * Math.sin(theta)},${apexY - rad * Math.cos(theta)}`);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 540 }}>
      <SvgDefs />
      <rect x="0" y="0" width={W} height={H} fill={COLORS.background} />

      {/* Soil mass (background) */}
      <rect x={0} y={groundY} width={W} height={H - groundY} fill="url(#soil-hatch)" opacity="0.6" />
      {/* Ground line */}
      <line x1={0} y1={groundY} x2={W} y2={groundY} stroke="#000" strokeWidth="1.2" />

      {/* Excavation around footing (Df) */}
      <rect x={footX1} y={groundY} width={Bpx} height={Dfpx} fill={COLORS.background} stroke="none" />

      {/* Footing (concrete) */}
      <rect
        x={footX1} y={baseY - 20} width={Bpx} height="20"
        fill="url(#concrete-hatch)" stroke="#000" strokeWidth="1.2"
      />

      {/* Zone I — active wedge under footing */}
      <polygon
        points={`${footX1},${baseY} ${footX2},${baseY} ${apexX},${apexY}`}
        fill="rgba(220,38,38,0.12)" stroke={COLORS.force} strokeWidth="1" strokeDasharray="3,2"
      />
      <text x={apexX} y={baseY + 14} textAnchor="middle" fill={COLORS.force} fontSize="9" fontFamily="ui-monospace, monospace">I</text>

      {/* Zone II — log-spiral on both sides */}
      <polyline points={arcLeftPts.join(" ")} fill="rgba(245,158,11,0.10)" stroke="#f59e0b" strokeWidth="1" />
      <polyline points={arcRightPts.join(" ")} fill="rgba(245,158,11,0.10)" stroke="#f59e0b" strokeWidth="1" />
      <text x={apexX - zoneI_h * 0.55} y={apexY - zoneI_h * 0.3} fill="#f59e0b" fontSize="9" fontFamily="ui-monospace, monospace">II</text>
      <text x={apexX + zoneI_h * 0.45} y={apexY - zoneI_h * 0.3} fill="#f59e0b" fontSize="9" fontFamily="ui-monospace, monospace">II</text>

      {/* Zone III — passive Rankine on both sides (straight slip to ground) */}
      <polygon
        points={`${footX1},${baseY} ${surfaceLX},${groundY} ${arcLeftPts[arcLeftPts.length - 1]}`}
        fill="rgba(16,185,129,0.10)" stroke="#10b981" strokeWidth="1" strokeDasharray="3,2"
      />
      <polygon
        points={`${footX2},${baseY} ${surfaceRX},${groundY} ${arcRightPts[arcRightPts.length - 1]}`}
        fill="rgba(16,185,129,0.10)" stroke="#10b981" strokeWidth="1" strokeDasharray="3,2"
      />
      <text x={(footX1 + surfaceLX) / 2 - 4} y={groundY + 14} fill="#10b981" fontSize="9" fontFamily="ui-monospace, monospace">III</text>
      <text x={(footX2 + surfaceRX) / 2} y={groundY + 14} fill="#10b981" fontSize="9" fontFamily="ui-monospace, monospace">III</text>

      {/* φ angle at toe */}
      <text x={footX1 - 6} y={baseY - 4} textAnchor="end" fill={COLORS.dimText} fontSize="9" fontFamily="ui-monospace, monospace">
        φ={phi_deg.toFixed(0)}°
      </text>

      {/* Applied q arrow */}
      <line x1={cx} y1={baseY - 60} x2={cx} y2={baseY - 22} stroke={COLORS.force} strokeWidth="2" markerEnd="url(#arrow-force)" />
      <text x={cx + 6} y={baseY - 40} fill={COLORS.force} fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="700">
        q (kPa)
      </text>

      {/* Dim B */}
      <DimLine x1={footX1} y1={baseY + 26} x2={footX2} y2={baseY + 26} label={`B = ${B_m.toFixed(2)} m`} />
      {/* Dim Df */}
      <DimLine x1={footX2 + 22} y1={groundY} x2={footX2 + 22} y2={baseY} label={`Df = ${Df_m.toFixed(2)}`} />

      {/* qu callout */}
      <text x={W - 12} y={20} textAnchor="end" fill={COLORS.textPrimary} fontSize="10" fontFamily="ui-monospace, monospace">
        q_u (mín) = {Math.min(r.meyerhof.qu_kPa, r.hansen.qu_kPa, r.vesic.qu_kPa).toFixed(0)} kPa
      </text>
      <text x={W - 12} y={34} textAnchor="end" fill="#10b981" fontSize="10" fontFamily="ui-monospace, monospace" fontWeight="700">
        q_a recomendado = {r.qa_recomendado_kPa.toFixed(0)} kPa
      </text>
      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontWeight="700">
        Cuña de falla Prandtl-Terzaghi
      </text>
    </svg>
  );
}

// ===========================================================================
// 4. SettlementProfileSvg — stratigraphy with σ'v0 and Δσ
// ===========================================================================

export function SettlementProfileSvg({
  r,
  input,
}: {
  r: SettlementResult;
  input: SettlementInput;
}) {
  const W = 480, H = 440;
  const margin = { top: 50, left: 70, right: 110, bottom: 30 };
  const innerH = H - margin.top - margin.bottom;
  const maxDepth = Math.max(8, ...input.layers.map((l) => l.depth_bot_m + 1));
  const yOf = (d: number) => margin.top + (d / maxDepth) * innerH;
  const colW = 110;
  const xCol = margin.left;

  // Stress axis on the right
  const maxStress = Math.max(50, ...r.layers.map((l) => l.sigma_v0_kPa + l.delta_sigma_kPa));
  const stressW = 160;
  const xStress = xCol + colW + 30;
  const xStressOf = (s: number) => xStress + (s / maxStress) * stressW;

  // σ'v0 + Δσ polylines
  const sigmaPts = r.layers.map((l) => `${xStressOf(l.sigma_v0_kPa)},${yOf(l.z_mid_m)}`).join(" ");
  const deltaPts = r.layers.map((l) => `${xStressOf(l.sigma_v0_kPa + l.delta_sigma_kPa)},${yOf(l.z_mid_m)}`).join(" ");

  // Footing at top
  const footingY = yOf(input.Df_m);
  const footingX1 = xCol + 15, footingX2 = xCol + colW - 15;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 520 }}>
      <SvgDefs />
      <rect x="0" y="0" width={W} height={H} fill={COLORS.background} />

      {/* Layers */}
      {input.layers.map((l, i) => (
        <rect
          key={i}
          x={xCol} y={yOf(l.depth_top_m)} width={colW} height={yOf(l.depth_bot_m) - yOf(l.depth_top_m)}
          fill={l.type === "sand" ? "#b87333" : "#7c4a2d"}
          stroke="#000" strokeWidth="0.5" opacity="0.8"
        />
      ))}
      {input.layers.map((l, i) => (
        <text
          key={i}
          x={xCol + colW / 2}
          y={(yOf(l.depth_top_m) + yOf(l.depth_bot_m)) / 2 + 4}
          textAnchor="middle" fill="#fff" fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          {l.type === "sand" ? "Arena" : "Arcilla"}
        </text>
      ))}

      {/* Footing */}
      <rect
        x={footingX1} y={footingY - 14} width={footingX2 - footingX1} height="14"
        fill="url(#concrete-hatch)" stroke="#000" strokeWidth="1"
      />

      {/* Water table */}
      {input.water_table_m < 50 && input.water_table_m < maxDepth && (
        <WaterTableLine x1={xCol} x2={xCol + colW} y={yOf(input.water_table_m)} label="NF" />
      )}

      {/* Depth ticks */}
      {Array.from({ length: Math.ceil(maxDepth) + 1 }).map((_, i) => (
        <text key={i} x={xCol - 6} y={yOf(i) + 3} textAnchor="end" fill={COLORS.textDim} fontSize="8" fontFamily="ui-monospace, monospace">
          {i}m
        </text>
      ))}

      {/* Stress axis */}
      <line x1={xStress} y1={margin.top} x2={xStress} y2={H - margin.bottom} stroke={COLORS.textFaint} strokeWidth="0.6" />
      <line x1={xStress} y1={H - margin.bottom} x2={xStress + stressW} y2={H - margin.bottom} stroke={COLORS.textFaint} strokeWidth="0.6" />
      <text x={xStress + stressW / 2} y={H - margin.bottom + 12} textAnchor="middle" fill={COLORS.textDim} fontSize="9">
        kPa
      </text>
      <polyline points={sigmaPts} fill="none" stroke="#fbbf24" strokeWidth="1.4" />
      <polyline points={deltaPts} fill="none" stroke="#10b981" strokeWidth="1.4" strokeDasharray="3,2" />
      <text x={xStress + 4} y={margin.top - 4} fill="#fbbf24" fontSize="9" fontFamily="ui-monospace, monospace">σ′ᵥ₀</text>
      <text x={xStress + 60} y={margin.top - 4} fill="#10b981" fontSize="9" fontFamily="ui-monospace, monospace">σ′ᵥ₀+Δσ</text>

      {/* Total settlement arrow at top */}
      <line x1={W - 60} y1={20} x2={W - 60} y2={50} stroke={COLORS.force} strokeWidth="2" markerEnd="url(#arrow-force)" />
      <text x={W - 54} y={36} fill={COLORS.force} fontSize="10" fontWeight="700" fontFamily="ui-monospace, monospace">
        S = {(r.S_total_mm / 10).toFixed(2)} cm
      </text>

      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontWeight="700">
        Asentamiento — perfil de esfuerzos
      </text>
    </svg>
  );
}

// ===========================================================================
// 5. SubgradeSpringSvg — Winkler model footing on springs
// ===========================================================================

export function SubgradeSpringSvg({
  r,
  input,
}: {
  r: SpringResult;
  input: SpringInput;
}) {
  const W = 480, H = 280;
  const groundY = 90;
  const B = input.B_m, L = input.L_m;
  // px scale
  const scale = 220 / Math.max(B, L);
  const Bpx = B * scale;
  const cx = W / 2;
  const footX1 = cx - Bpx / 2;
  const footX2 = cx + Bpx / 2;
  const footThick = 18;
  const footTop = groundY;
  const footBot = groundY + footThick;

  // Springs: 7 springs across the base
  const nSpring = 7;
  const springTop = footBot;
  const springH = 90;
  const springBot = springTop + springH;

  // Compression varies: max at center (parabolic) to illustrate k_v·δ
  const compMax = 18;
  const compAt = (i: number) => {
    const t = (i / (nSpring - 1)) * 2 - 1;
    return compMax * (1 - t * t);
  };

  function springPath(x: number, comp: number): string {
    const coils = 6;
    const yA = springTop;
    const yB = springBot - comp; // compressed
    const usableH = yB - yA;
    const stepY = usableH / (coils * 2);
    let path = `M ${x} ${yA}`;
    for (let c = 0; c < coils; c++) {
      path += ` L ${x - 6} ${yA + stepY * (c * 2 + 1)}`;
      path += ` L ${x + 6} ${yA + stepY * (c * 2 + 2)}`;
    }
    path += ` L ${x} ${yB}`;
    return path;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 520 }}>
      <SvgDefs />
      <rect x="0" y="0" width={W} height={H} fill={COLORS.background} />

      {/* Footing */}
      <rect
        x={footX1} y={footTop} width={Bpx} height={footThick}
        fill="url(#concrete-hatch)" stroke="#000" strokeWidth="1.2"
      />

      {/* Springs */}
      {Array.from({ length: nSpring }).map((_, i) => {
        const x = footX1 + 18 + (i / (nSpring - 1)) * (Bpx - 36);
        return (
          <g key={i}>
            <path
              d={springPath(x, compAt(i))}
              fill="none" stroke="#10b981" strokeWidth="1.4"
            />
            {/* base plate */}
            <line
              x1={x - 8} y1={springBot} x2={x + 8} y2={springBot}
              stroke="#000" strokeWidth="1.5"
            />
            {/* downward hatch under base = fixed support */}
            {Array.from({ length: 4 }).map((_, j) => (
              <line
                key={j}
                x1={x - 8 + j * 4} y1={springBot}
                x2={x - 12 + j * 4} y2={springBot + 5}
                stroke="#000" strokeWidth="0.6"
              />
            ))}
          </g>
        );
      })}

      {/* k_v callout */}
      <text x={footX2 + 14} y={springTop + springH / 2 - 6} fill="#10b981" fontSize="11" fontFamily="ui-monospace, monospace" fontWeight="700">
        k_v = {(r.k_recomendado_kN_m3 / 1000).toFixed(1)} MN/m³
      </text>
      <text x={footX2 + 14} y={springTop + springH / 2 + 8} fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">
        K = {(r.K_spring_kN_m / 1000).toFixed(1)} MN/m
      </text>
      <text x={footX2 + 14} y={springTop + springH / 2 + 22} fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">
        F = k_v · δ
      </text>

      {/* Dim B and label for L */}
      <DimLine x1={footX1} y1={springBot + 24} x2={footX2} y2={springBot + 24} label={`B = ${B.toFixed(2)} m`} />
      <text x={footX1 - 10} y={(footTop + footBot) / 2 + 3} textAnchor="end" fill={COLORS.dimText} fontSize="9" fontFamily="ui-monospace, monospace">
        L = {L.toFixed(2)} m
      </text>

      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontWeight="700">
        Modelo Winkler — resorte equivalente
      </text>
    </svg>
  );
}

// ===========================================================================
// 6. SlopeStabilityCircleSvg — critical slip circle on slope cross-section
// ===========================================================================

export function SlopeStabilityCircleSvg({
  r,
  input,
}: {
  r: SlopeResult;
  input: SlopeInput;
}) {
  const W = 540, H = 360;
  const margin = { top: 30, left: 50, right: 30, bottom: 40 };
  const H_slope = input.height_m;
  const alpha = (input.angle_deg * Math.PI) / 180;
  const x_crown = H_slope / Math.tan(alpha);
  const x_extent = x_crown + 2 * H_slope; // back behind crown
  // Scale to fit
  const xScale = (W - margin.left - margin.right) / x_extent;
  const yScale = (H - margin.top - margin.bottom) / (2.5 * H_slope);
  const scale = Math.min(xScale, yScale);
  const toX = (xm: number) => margin.left + xm * scale;
  const toY = (ym: number) => H - margin.bottom - ym * scale;

  // Slope polygon: toe (0,0) -> up slope -> crown -> back -> off-right at H -> off-right at 0
  const slopePts = [
    `${toX(0)},${toY(0)}`,
    `${toX(x_crown)},${toY(H_slope)}`,
    `${toX(x_extent)},${toY(H_slope)}`,
    `${toX(x_extent)},${toY(-H_slope * 0.5)}`,
    `${toX(0)},${toY(-H_slope * 0.5)}`,
  ].join(" ");

  // Critical circle
  const cx = toX(r.critical.xc_m);
  const cy = toY(r.critical.yc_m);
  const R = r.critical.R_m * scale;

  // FS pass/fail
  const passFS = r.critical.FS_bishop >= 1.5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 600 }}>
      <SvgDefs />
      <rect x="0" y="0" width={W} height={H} fill={COLORS.background} />

      {/* Soil body */}
      <polygon points={slopePts} fill="url(#soil-hatch)" stroke="#000" strokeWidth="1" opacity="0.9" />

      {/* Layer lines */}
      {input.layers.slice(1).map((l, i) => (
        <line
          key={i}
          x1={toX(0)} y1={toY(H_slope - l.z_top_m)}
          x2={toX(x_extent)} y2={toY(H_slope - l.z_top_m)}
          stroke="#000" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5"
        />
      ))}

      {/* Water table */}
      {input.water_table_m < 50 && (
        <line
          x1={toX(0)} y1={toY(H_slope - input.water_table_m)}
          x2={toX(x_extent)} y2={toY(H_slope - input.water_table_m)}
          stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,3"
        />
      )}

      {/* Critical slip circle */}
      {R > 0 && (
        <>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={passFS ? "#10b981" : "#ef4444"} strokeWidth="1.6" strokeDasharray="6,3" />
          <circle cx={cx} cy={cy} r="3" fill={passFS ? "#10b981" : "#ef4444"} />
          <text x={cx + 6} y={cy - 6} fill={passFS ? "#10b981" : "#ef4444"} fontSize="9" fontFamily="ui-monospace, monospace">
            (xc={r.critical.xc_m.toFixed(1)}, yc={r.critical.yc_m.toFixed(1)})
          </text>
          <text x={cx + 6} y={cy + 8} fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">
            R={r.critical.R_m.toFixed(1)} m
          </text>
        </>
      )}

      {/* H dim */}
      <DimLine x1={toX(-1)} y1={toY(0)} x2={toX(-1)} y2={toY(H_slope)} label={`H=${H_slope}m`} />
      {/* α */}
      <text x={toX(x_crown / 2)} y={toY(H_slope / 2) + 16} fill={COLORS.dimText} fontSize="9" fontFamily="ui-monospace, monospace">
        α = {input.angle_deg}°
      </text>

      {/* FS badge */}
      <rect x={W - 130} y={6} width="120" height="28" rx="3"
        fill={COLORS.bgPanel} stroke={passFS ? "#10b981" : "#ef4444"} strokeWidth="1.4" />
      <text x={W - 70} y={18} textAnchor="middle" fill={COLORS.textDim} fontSize="9">FS Bishop</text>
      <text x={W - 70} y={30} textAnchor="middle" fill={passFS ? "#10b981" : "#ef4444"} fontSize="13" fontWeight="700"
        fontFamily="ui-monospace, monospace">
        {r.critical.FS_bishop.toFixed(2)} {passFS ? "✓" : "✗"}
      </text>

      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontWeight="700">
        Círculo crítico — análisis de estabilidad
      </text>
    </svg>
  );
}

// ===========================================================================
// 7. LiquefactionProfileSvg — depth-vs-FS plot, color-coded bars
// ===========================================================================

export function LiquefactionProfileSvg({
  r,
  input,
}: {
  r: LiqResult;
  input: LiqInput;
}) {
  const W = 420, H = 460;
  const margin = { top: 40, left: 60, right: 30, bottom: 40 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;
  const maxDepth = Math.max(20, ...r.layers.map((l) => l.depth_m + 1));
  const yOf = (d: number) => margin.top + (d / maxDepth) * innerH;
  const xOf = (fs: number) => margin.left + Math.min(2, Math.max(0, fs)) / 2 * innerW;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 460 }}>
      <SvgDefs />
      <rect x="0" y="0" width={W} height={H} fill={COLORS.background} />

      {/* Background bands */}
      <rect x={xOf(0)} y={margin.top} width={xOf(1) - xOf(0)} height={innerH} fill="rgba(239,68,68,0.10)" />
      <rect x={xOf(1)} y={margin.top} width={xOf(1.5) - xOf(1)} height={innerH} fill="rgba(245,158,11,0.10)" />
      <rect x={xOf(1.5)} y={margin.top} width={xOf(2) - xOf(1.5)} height={innerH} fill="rgba(16,185,129,0.10)" />

      {/* FS = 1.0 critical line */}
      <line x1={xOf(1)} y1={margin.top} x2={xOf(1)} y2={H - margin.bottom} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,2" />
      <text x={xOf(1)} y={margin.top - 4} textAnchor="middle" fill="#ef4444" fontSize="9" fontFamily="ui-monospace, monospace">FS=1.0</text>
      <line x1={xOf(1.5)} y1={margin.top} x2={xOf(1.5)} y2={H - margin.bottom} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,2" />
      <text x={xOf(1.5)} y={margin.top - 4} textAnchor="middle" fill="#f59e0b" fontSize="9" fontFamily="ui-monospace, monospace">1.5</text>

      {/* Axes */}
      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={H - margin.bottom} stroke={COLORS.textFaint} strokeWidth="0.6" />
      <line x1={margin.left} y1={H - margin.bottom} x2={W - margin.right} y2={H - margin.bottom} stroke={COLORS.textFaint} strokeWidth="0.6" />
      {/* depth ticks */}
      {Array.from({ length: Math.ceil(maxDepth / 5) + 1 }).map((_, i) => {
        const d = i * 5;
        return (
          <text key={i} x={margin.left - 6} y={yOf(d) + 3} textAnchor="end" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">
            {d}m
          </text>
        );
      })}
      <text x={W / 2} y={H - 8} textAnchor="middle" fill={COLORS.textDim} fontSize="9">FS licuefacción</text>

      {/* Water table */}
      {input.water_table_m < 50 && input.water_table_m < maxDepth && (
        <line x1={margin.left} y1={yOf(input.water_table_m)} x2={W - margin.right} y2={yOf(input.water_table_m)}
          stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,3" />
      )}

      {/* Per-layer bar (horizontal) */}
      {r.layers.map((l, i) => {
        const fs = isFinite(l.FS_liq) ? Math.min(2, l.FS_liq) : 2;
        const eligible = l.FS_liq < 999;
        const color = !eligible ? "#52525b" : fs < 1 ? "#ef4444" : fs < 1.5 ? "#f59e0b" : "#10b981";
        const barH = 14;
        return (
          <g key={i}>
            <rect x={margin.left} y={yOf(l.depth_m) - barH / 2} width={xOf(fs) - margin.left} height={barH} fill={color} opacity="0.85" />
            <text x={xOf(fs) + 4} y={yOf(l.depth_m) + 3} fill={color} fontSize="9" fontFamily="ui-monospace, monospace" fontWeight="700">
              {eligible ? `FS=${l.FS_liq.toFixed(2)}` : l.reason}
            </text>
            <text x={margin.left - 6} y={yOf(l.depth_m) + 3} textAnchor="end" fill={COLORS.textDim} fontSize="8" fontFamily="ui-monospace, monospace">
              {l.depth_m.toFixed(1)}m
            </text>
          </g>
        );
      })}

      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontWeight="700">
        Licuefacción — FS por profundidad
      </text>
    </svg>
  );
}

// ===========================================================================
// 8. SoilProfileLayersSvg — annotated stratigraphic column
// ===========================================================================

export function SoilProfileLayersSvg({ r }: { r: ProfileResult }) {
  const W = 440, H = 520;
  const margin = { top: 40, left: 90, right: 20, bottom: 30 };
  const innerH = H - margin.top - margin.bottom;
  const colX = margin.left;
  const colW = 130;
  const maxDepth = Math.max(6, r.total_depth_m);
  const yOf = (d: number) => margin.top + (d / maxDepth) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 480 }}>
      <SvgDefs />
      <rect x="0" y="0" width={W} height={H} fill={COLORS.background} />

      {r.layers.map((lr, i) => {
        const l = lr.layer;
        const yTop = yOf(l.depth_top_m);
        const yBot = yOf(l.depth_bot_m);
        return (
          <g key={i}>
            <rect x={colX} y={yTop} width={colW} height={yBot - yTop} fill={l.color} stroke="#000" strokeWidth="0.6" opacity="0.85" />
            {/* Soil name centered */}
            <text x={colX + colW / 2} y={(yTop + yBot) / 2 - 4} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700"
              fontFamily="ui-monospace, monospace">
              {l.soil_name}
            </text>
            <text x={colX + colW / 2} y={(yTop + yBot) / 2 + 9} textAnchor="middle" fill="#fef3c7" fontSize="8"
              fontFamily="ui-monospace, monospace">
              γ={l.gamma_kN_m3} · φ={l.phi_deg}° · c={l.c_kPa}
            </text>
            {/* Depth labels */}
            <text x={colX - 6} y={yTop + 3} textAnchor="end" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">
              {l.depth_top_m.toFixed(1)}m
            </text>
            <text x={colX - 6} y={yBot + 3} textAnchor="end" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">
              {l.depth_bot_m.toFixed(1)}m
            </text>
            {/* Right-side annotation: σ'v at base */}
            <text x={colX + colW + 10} y={yBot + 3} fill="#fbbf24" fontSize="9" fontFamily="ui-monospace, monospace">
              σ′ᵥ={lr.sigma_v_eff_bot_kPa.toFixed(0)} kPa
            </text>
          </g>
        );
      })}

      {/* Water table */}
      {r.water_table_m < 50 && r.water_table_m < maxDepth && (
        <WaterTableLine x1={colX} x2={colX + colW} y={yOf(r.water_table_m)} label={`NF ${r.water_table_m.toFixed(1)}m`} />
      )}

      <text x={W / 2} y={18} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontWeight="700">
        Perfil estratigráfico
      </text>
      <text x={W / 2} y={32} textAnchor="middle" fill={COLORS.textDim} fontSize="9" fontFamily="ui-monospace, monospace">
        γ̄={r.gamma_avg_kN_m3.toFixed(1)} · φ̄={r.phi_avg_deg.toFixed(0)}° · c̄={r.c_avg_kPa.toFixed(0)} kPa
      </text>
    </svg>
  );
}

// ===========================================================================
// 9. WallTypologyComparisonSvg — top-3 wall sketches with scores
// ===========================================================================

/** Draw a single mini-wall sketch by type. ~80×120 px area starting at (x,y). */
function WallMini({ x, y, type, h = 100, w = 70 }: { x: number; y: number; type: TipoMuro; h?: number; w?: number }) {
  const groundY = y + h - 8;
  const baseY = y + h - 4;
  switch (type) {
    case "voladizo": {
      // Inverted L: stem + heel
      const stemW = 10;
      const heelW = w * 0.7;
      return (
        <g>
          {/* soil behind */}
          <rect x={x + stemW} y={y + 10} width={w - stemW} height={baseY - y - 10} fill="url(#soil-hatch)" opacity="0.6" />
          {/* stem */}
          <rect x={x} y={y + 6} width={stemW} height={baseY - y - 6} fill="url(#concrete-hatch)" stroke="#000" strokeWidth="0.8" />
          {/* base */}
          <rect x={x - 6} y={baseY - 8} width={heelW + 6} height={8} fill="url(#concrete-hatch)" stroke="#000" strokeWidth="0.8" />
          <line x1={x - 8} y1={groundY} x2={x + w} y2={groundY} stroke="#000" strokeWidth="0.6" />
        </g>
      );
    }
    case "contrafuertes": {
      const stemW = 8;
      const heelW = w * 0.7;
      return (
        <g>
          <rect x={x + stemW} y={y + 10} width={w - stemW} height={baseY - y - 10} fill="url(#soil-hatch)" opacity="0.6" />
          <rect x={x} y={y + 6} width={stemW} height={baseY - y - 6} fill="url(#concrete-hatch)" stroke="#000" strokeWidth="0.8" />
          {/* counterfort triangles */}
          <polygon points={`${x + stemW},${y + 10} ${x + stemW + 18},${y + 12} ${x + stemW},${baseY - 8}`}
            fill="url(#concrete-hatch)" stroke="#000" strokeWidth="0.6" opacity="0.85" />
          <rect x={x - 6} y={baseY - 8} width={heelW + 6} height={8} fill="url(#concrete-hatch)" stroke="#000" strokeWidth="0.8" />
          <line x1={x - 8} y1={groundY} x2={x + w} y2={groundY} stroke="#000" strokeWidth="0.6" />
        </g>
      );
    }
    case "gravedad": {
      // Trapezoidal mass
      const topW = 14, botW = w * 0.55;
      return (
        <g>
          <rect x={x + topW} y={y + 10} width={w - topW} height={baseY - y - 10} fill="url(#soil-hatch)" opacity="0.6" />
          <polygon
            points={`${x},${y + 6} ${x + topW},${y + 6} ${x + botW},${baseY} ${x - 6},${baseY}`}
            fill="url(#concrete-hatch)" stroke="#000" strokeWidth="0.8"
          />
          <line x1={x - 8} y1={groundY} x2={x + w} y2={groundY} stroke="#000" strokeWidth="0.6" />
        </g>
      );
    }
    case "gaviones": {
      // Stack of 3 wire boxes
      return (
        <g>
          <rect x={x + 20} y={y + 10} width={w - 20} height={baseY - y - 10} fill="url(#soil-hatch)" opacity="0.6" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={x - 4 + i * 4} y={y + 8 + i * (baseY - y - 14) / 3}
              width={26 - i * 2} height={(baseY - y - 8) / 3 - 1}
              fill="#a8a29e" stroke="#000" strokeWidth="0.7" />
          ))}
          <line x1={x - 8} y1={groundY} x2={x + w} y2={groundY} stroke="#000" strokeWidth="0.6" />
        </g>
      );
    }
    case "anclado": {
      // Soldier piles + tieback diagonals
      return (
        <g>
          <rect x={x + 6} y={y + 8} width={w - 6} height={baseY - y - 8} fill="url(#soil-hatch)" opacity="0.6" />
          <rect x={x} y={y + 4} width={6} height={baseY - y - 4} fill="url(#concrete-hatch)" stroke="#000" strokeWidth="0.8" />
          {/* tiebacks */}
          {[0.25, 0.6].map((t, i) => (
            <g key={i}>
              <line x1={x + 6} y1={y + 6 + t * (baseY - y - 6)} x2={x + 30} y2={y + 6 + t * (baseY - y - 6) + 16}
                stroke="#fbbf24" strokeWidth="1.4" />
              <circle cx={x + 30} cy={y + 6 + t * (baseY - y - 6) + 16} r="2" fill="#fbbf24" />
            </g>
          ))}
          <line x1={x - 8} y1={groundY} x2={x + w} y2={groundY} stroke="#000" strokeWidth="0.6" />
        </g>
      );
    }
    case "tierra_armada": {
      // Reinforced earth — face panels + horizontal reinforcement strips
      return (
        <g>
          <rect x={x + 8} y={y + 8} width={w - 8} height={baseY - y - 8} fill="url(#soil-hatch)" opacity="0.55" />
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((t, i) => (
            <line key={i} x1={x + 8} y1={y + 8 + t * (baseY - y - 8)}
              x2={x + 32} y2={y + 8 + t * (baseY - y - 8)} stroke="#fbbf24" strokeWidth="0.8" />
          ))}
          <rect x={x} y={y + 4} width={8} height={baseY - y - 4} fill="#d4d4d8" stroke="#000" strokeWidth="0.8" />
          <line x1={x - 8} y1={groundY} x2={x + w} y2={groundY} stroke="#000" strokeWidth="0.6" />
        </g>
      );
    }
  }
}

export function WallTypologyComparisonSvg({ r }: { r: WallResult }) {
  const W = 540, H = 260;
  const top3 = r.ranking.slice(0, 3);
  const slotW = (W - 60) / 3;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 600 }}>
      <SvgDefs />
      <rect x="0" y="0" width={W} height={H} fill={COLORS.background} />

      {top3.map((opt, i) => {
        const xSlot = 30 + i * slotW;
        const rank = i + 1;
        const isWinner = i === 0;
        return (
          <g key={opt.tipo}>
            {/* card outline */}
            <rect
              x={xSlot} y={50} width={slotW - 20} height={H - 70}
              fill={COLORS.bgPanel}
              stroke={isWinner ? "#10b981" : COLORS.textFaint}
              strokeWidth={isWinner ? 1.6 : 0.6}
              rx="4"
            />
            {/* rank badge */}
            <circle cx={xSlot + 12} cy={62} r="10" fill={isWinner ? "#10b981" : "#71717a"} />
            <text x={xSlot + 12} y={66} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700"
              fontFamily="ui-monospace, monospace">
              {rank}
            </text>
            {/* score */}
            <text x={xSlot + slotW - 28} y={66} textAnchor="end" fill={isWinner ? "#10b981" : COLORS.textDim}
              fontSize="13" fontWeight="700" fontFamily="ui-monospace, monospace">
              {opt.score.toFixed(1)}
            </text>
            <text x={xSlot + slotW - 28} y={78} textAnchor="end" fill={COLORS.textDim} fontSize="8">score / 10</text>

            {/* mini wall drawing */}
            <WallMini x={xSlot + 30} y={84} type={opt.tipo} />

            {/* label */}
            <text x={xSlot + (slotW - 20) / 2} y={H - 24} textAnchor="middle" fill={COLORS.textPrimary} fontSize="9"
              fontFamily="ui-monospace, monospace">
              {opt.tipo.replace("_", " ")}
            </text>
          </g>
        );
      })}

      <text x={W / 2} y={20} textAnchor="middle" fill={COLORS.textPrimary} fontSize="11" fontWeight="700">
        Tipologías de muro — top 3
      </text>
      <text x={W / 2} y={36} textAnchor="middle" fill={COLORS.textDim} fontSize="9">
        Ranking multicriterio: altura, suelo, espacio, costo, sismo, agua
      </text>
    </svg>
  );
}
