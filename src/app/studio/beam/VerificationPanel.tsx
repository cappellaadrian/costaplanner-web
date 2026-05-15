"use client";

/**
 * Right-side verification panel.
 *
 * In Live mode we synthesize a curated set of checks from the FlexureLiveResult
 * that update the moment a user changes any input. These cover the
 * verifications that depend only on flexure data — geometry limits, rho
 * limits, tension-controlled section, doubly-reinforcement flag, and the
 * actual As required vs computed.
 *
 * In Official mode we display the full canonical Check[] returned by the
 * costaplanner /design/structural endpoint (which includes shear, Mpr,
 * capacity-design Ve, punching, etc.) — the same shape REVARA's existing
 * /structural page renders.
 *
 * Each row can be clicked to scroll-highlight the upstream step(s) that
 * produced the values shown.
 */
import type { FlexureLiveResult } from "@/lib/beam-flexure-live";
import { CHECK_BADGE } from "./colors";

interface LiveCheck {
  nombre: string;
  requerido: number;
  disponible: number;
  unidad: string;
  cumple: boolean;
  referencia: string;
  /** Optional step ids whose values feed this check (for click-to-trace). */
  source_steps?: string[];
}

export interface OfficialCheck {
  nombre: string;
  requerido: number;
  disponible: number;
  unidad: string;
  cumple: boolean;
  referencia: string;
  critical: boolean;
}

interface Props {
  /** Live recompute source — set when in Live mode. */
  liveResult?: FlexureLiveResult;
  /** Set when in Official mode and we've received the canonical Check list. */
  officialChecks?: OfficialCheck[];
  /** Set when in Official mode and the result has populated reinforcement. */
  officialRefuerzo?: {
    longitudinal?: Array<{ n: number; size: number; As_total: number; position: string }>;
    transversal?: Array<{ size: number; separacion: number; ramas: number; zona: string }>;
  };
  /** Optional click handler to navigate to a step by id. */
  onCheckClick?: (sourceStepIds: string[]) => void;
  /** Optional L luz in cm for L_libre check. */
  L_cm?: number;
}

function fmt(n: number, unit: string): string {
  if (!isFinite(n)) return "∞";
  if (Math.abs(n) >= 1000) return n.toLocaleString("es-CR", { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toPrecision(4);
}

function buildLiveChecks(r: FlexureLiveResult, L_cm: number): LiveCheck[] {
  // L_libre approximation: full luz minus two times typical column width (~50cm)
  const L_libre = Math.max(0, L_cm - 50);

  const ratio_b_over_h = r.h > 0 ? r.b / r.h : 0;

  return [
    {
      nombre: "§8.2.1(d) b/h >= 0.30",
      requerido: 0.30,
      disponible: ratio_b_over_h,
      unidad: "",
      cumple: ratio_b_over_h >= 0.30,
      referencia: "CSCR-10 §8.2.1(d)",
      source_steps: [],
    },
    {
      nombre: "§8.2.1(e) b >= 25 cm",
      requerido: 25,
      disponible: r.b,
      unidad: "cm",
      cumple: r.b >= 25,
      referencia: "CSCR-10 §8.2.1(e)",
      source_steps: [],
    },
    {
      nombre: "L_libre > 4d",
      requerido: 4 * r.d,
      disponible: L_libre,
      unidad: "cm",
      cumple: L_libre > 4 * r.d,
      referencia: "CSCR-10 §8.2.1(c)",
      source_steps: [],
    },
    {
      nombre: "rho_diseño <= rho_max",
      requerido: r.rho_max_val,
      disponible: r.rho_diseno,
      unidad: "",
      cumple: r.rho_diseno <= r.rho_max_val,
      referencia: "ACI 318-14 §21.2.2",
      source_steps: ["flexure.verif_01_rho_diseno"],
    },
    {
      nombre: "Sección controlada por tracción (ε_s >= 0.005)",
      requerido: 0.005,
      disponible: isFinite(r.eps_s) ? r.eps_s : 1,
      unidad: "",
      cumple: r.tension_controlled,
      referencia: "ACI 318-14 §21.2.2",
      source_steps: ["flexure.verif_04_eps_s"],
    },
    {
      nombre: "Sección sin doble refuerzo requerido",
      requerido: 0,
      disponible: r.requires_doubly ? 1 : 0,
      unidad: "",
      cumple: !r.requires_doubly,
      referencia: "ACI 318-14 §9.3.3",
      source_steps: [
        "flexure.step_07_one_minus_arg",
        "flexure.verif_01_rho_diseno",
      ],
    },
  ];
}

export function VerificationPanel({
  liveResult,
  officialChecks,
  officialRefuerzo,
  onCheckClick,
  L_cm = 625,
}: Props) {
  const mode = officialChecks ? "official" : liveResult ? "live" : "empty";

  const checksToShow: (LiveCheck | OfficialCheck)[] =
    mode === "official"
      ? (officialChecks as OfficialCheck[])
      : mode === "live"
      ? buildLiveChecks(liveResult as FlexureLiveResult, L_cm)
      : [];

  const passing = checksToShow.filter((c) => c.cumple).length;
  const failing = checksToShow.length - passing;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 pb-1 mb-2 flex items-center justify-between">
          <span>
            Verificaciones {mode === "live" ? "(vivo)" : mode === "official" ? "(oficial)" : ""}
          </span>
          {checksToShow.length > 0 && (
            <span className="text-zinc-600">
              {passing}/{checksToShow.length}
            </span>
          )}
        </div>

        {checksToShow.length === 0 && (
          <div className="text-xs text-zinc-500 italic">
            Ajusta las entradas para ver las verificaciones en vivo.
          </div>
        )}

        <div className="space-y-1.5">
          {checksToShow.map((c, i) => {
            const liveCheck = c as LiveCheck;
            const onClick = () => {
              if (liveCheck.source_steps && liveCheck.source_steps.length > 0) {
                onCheckClick?.(liveCheck.source_steps);
              }
            };
            return (
              <button
                key={`${c.nombre}-${i}`}
                type="button"
                onClick={onClick}
                className="w-full text-left rounded border border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 transition-colors p-2.5 group"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-xs text-zinc-200 font-medium group-hover:text-amber-100">
                    {c.nombre}
                  </div>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                      c.cumple ? CHECK_BADGE.ok : CHECK_BADGE.fail
                    }`}
                  >
                    {c.cumple ? "OK" : "Falla"}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 tabular-nums">
                  Req: {fmt(c.requerido, c.unidad)}{" "}
                  {c.unidad && <span className="text-zinc-600">{c.unidad}</span>}
                  {" · "}
                  Disp: {fmt(c.disponible, c.unidad)}{" "}
                  {c.unidad && <span className="text-zinc-600">{c.unidad}</span>}
                </div>
                {c.referencia && (
                  <div className="text-[10px] text-zinc-600 italic mt-0.5">
                    {c.referencia}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reinforcement summary in Live mode: just the As_diseno from flexure */}
      {mode === "live" && liveResult && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 pb-1 mb-2">
            Acero de diseño
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950/50 p-3 space-y-1">
            <div className="text-xs text-zinc-500">As requerido</div>
            <div className="font-mono text-emerald-300 text-base font-semibold tabular-nums">
              {liveResult.As_diseno.toFixed(2)}{" "}
              <span className="text-xs text-zinc-500">cm²</span>
            </div>
            <div className="text-[10px] text-zinc-600 mt-2 italic">
              Calcula oficialmente para ver la selección de barras (#).
            </div>
          </div>
        </div>
      )}

      {/* Reinforcement detail in Official mode */}
      {mode === "official" && officialRefuerzo && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 pb-1 mb-2">
            Refuerzo
          </div>
          <div className="space-y-2">
            {officialRefuerzo.longitudinal && officialRefuerzo.longitudinal.length > 0 && (
              <div className="rounded border border-zinc-800 bg-zinc-950/50 p-2.5 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Longitudinal
                </div>
                {officialRefuerzo.longitudinal.map((b, i) => (
                  <div key={i} className="text-xs text-zinc-200 font-mono">
                    {b.n} #{b.size} (As {b.As_total.toFixed(2)} cm²)
                    <span className="text-zinc-500 text-[10px] ml-2">{b.position}</span>
                  </div>
                ))}
              </div>
            )}
            {officialRefuerzo.transversal && officialRefuerzo.transversal.length > 0 && (
              <div className="rounded border border-zinc-800 bg-zinc-950/50 p-2.5 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Transversal (estribos)
                </div>
                {officialRefuerzo.transversal.map((s, i) => (
                  <div key={i} className="text-xs text-zinc-200 font-mono">
                    #{s.size} @ {s.separacion} cm, {s.ramas} ramas
                    <span className="text-zinc-500 text-[10px] ml-2">{s.zona}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
