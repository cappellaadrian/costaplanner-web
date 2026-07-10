"use client";

/**
 * /studio/diseno-rapido — Diseño Rápido CSCR §17
 *
 * Wizard de 7 pasos que toma una especificación mínima de vivienda CR y
 * devuelve TODO el predimensionado de elementos estructurales, cantidades
 * preliminares, verificaciones §17 y advertencias. La dirección INVERSA de
 * los calculadores detallados (24 tiles estructurales + 9 geotech).
 *
 * Diseño visual alineado al resto de /studio: zinc + emerald + amber.
 */
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  computeDisenoRapidoLive,
  type DisenoRapidoInput,
  type DisenoRapidoResult,
  type TipoProyecto,
  type Sistema,
  type TipoSuelo,
} from "@/lib/diseno-rapido-live";

const DEFAULT_INPUT: DisenoRapidoInput = {
  tipoProyecto: "casa_2pisos",
  area_planta_m2: 80,
  ancho_m: 8,
  largo_m: 10,
  numPisos: 2,
  altura_piso_m: 2.7,
  zonaSismica: 3,
  tipoSuelo: "S2",
  qa_ton_m2: 8,
  sistema: "mamposteria_confinada",
  fc: 245,
  fy: 4200,
  fm_MPa: 7.5,
};

const STEPS = [
  "Tipo",
  "Geometría",
  "Sitio",
  "Sistema",
  "Materiales",
  "Resumen",
  "Resultado",
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export default function DisenoRapidoPage() {
  const [step, setStep] = useState<StepIndex>(0);
  const [input, setInput] = useState<DisenoRapidoInput>(DEFAULT_INPUT);
  const [generated, setGenerated] = useState<DisenoRapidoResult | null>(null);

  const livePreview = useMemo(() => computeDisenoRapidoLive(input), [input]);

  function next() {
    if (step < 6) setStep((step + 1) as StepIndex);
  }
  function prev() {
    if (step > 0) setStep((step - 1) as StepIndex);
  }
  function generar() {
    setGenerated(computeDisenoRapidoLive(input));
    setStep(6);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-400 mb-1">
            <Link href="/studio" className="hover:text-emerald-300">
              ← Studio
            </Link>
          </div>
          <h1 className="text-3xl font-semibold">🏠 Diseño Rápido — CSCR §17</h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
            En ~10 pantallas tienes el diseño completo de tu casa CR: vigas,
            columnas, losas, zapatas, muros, cantidades y memoria CFIA-ready.
            Usa CSCR-10 §17 (Diseño Simplificado) — intencionalmente
            conservador.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 flex-wrap">
          {STEPS.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <div key={label} className="flex items-center gap-1">
                <div
                  className={`px-3 py-1.5 rounded text-xs font-mono ${
                    active
                      ? "bg-emerald-500 text-zinc-950 font-bold"
                      : done
                      ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800"
                      : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                  }`}
                >
                  {i + 1}. {label}
                </div>
                {i < STEPS.length - 1 && (
                  <span className="text-zinc-700 text-xs">›</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-5">
          {step === 0 && <StepTipo input={input} setInput={setInput} />}
          {step === 1 && <StepGeometria input={input} setInput={setInput} />}
          {step === 2 && <StepSitio input={input} setInput={setInput} />}
          {step === 3 && <StepSistema input={input} setInput={setInput} />}
          {step === 4 && <StepMateriales input={input} setInput={setInput} />}
          {step === 5 && (
            <StepResumen input={input} preview={livePreview} onGenerate={generar} />
          )}
          {step === 6 && generated && <StepResultado result={generated} />}
        </div>

        {/* Nav */}
        {step < 6 && (
          <div className="flex justify-between">
            <button
              onClick={prev}
              disabled={step === 0}
              className="px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-sm text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Atrás
            </button>
            {step < 5 ? (
              <button
                onClick={next}
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold transition-colors"
              >
                Siguiente →
              </button>
            ) : (
              <button
                onClick={generar}
                className="px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold transition-colors"
              >
                ▶ GENERAR DISEÑO
              </button>
            )}
          </div>
        )}
        {step === 6 && (
          <div className="flex justify-between">
            <button
              onClick={() => setStep(0)}
              className="px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-sm text-zinc-300 transition-colors"
            >
              ↻ Volver al inicio
            </button>
            <Link
              href="/studio"
              className="px-4 py-2 rounded-lg border border-amber-700/60 hover:border-amber-500 text-sm text-amber-200 transition-colors"
            >
              Refinar en calculadoras detalladas →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

// =============================================================================
// Step components
// =============================================================================

interface StepProps {
  input: DisenoRapidoInput;
  setInput: (v: DisenoRapidoInput) => void;
}

function StepTipo({ input, setInput }: StepProps) {
  const opciones: { v: TipoProyecto; label: string; desc: string; emoji: string }[] = [
    { v: "casa_1piso", label: "Casa 1 piso", desc: "Vivienda unifamiliar planta baja", emoji: "🏠" },
    { v: "casa_2pisos", label: "Casa 2 pisos", desc: "Vivienda unifamiliar con entrepiso", emoji: "🏡" },
    { v: "apartamento", label: "Apartamento", desc: "Unidad de vivienda en edificio", emoji: "🏢" },
    { v: "local_pequeno", label: "Local pequeño", desc: "Comercio / oficina hasta 2 pisos", emoji: "🏪" },
  ];
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
        Paso 1 — Tipo de proyecto
      </div>
      <h2 className="text-xl font-semibold mb-4">¿Qué vas a diseñar?</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {opciones.map((o) => {
          const active = input.tipoProyecto === o.v;
          return (
            <button
              key={o.v}
              onClick={() => {
                const numPisos: 1 | 2 = o.v === "casa_2pisos" ? 2 : 1;
                setInput({ ...input, tipoProyecto: o.v, numPisos });
              }}
              className={`text-left p-4 rounded-lg border transition-colors ${
                active
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600"
              }`}
            >
              <div className="text-2xl mb-1">{o.emoji}</div>
              <div className="font-semibold text-sm">{o.label}</div>
              <div className="text-xs text-zinc-500 mt-1">{o.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepGeometria({ input, setInput }: StepProps) {
  // Mini-plan sketch
  const scale = 200 / Math.max(input.ancho_m, input.largo_m, 1);
  const w = input.largo_m * scale;
  const h = input.ancho_m * scale;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
        Paso 2 — Geometría
      </div>
      <h2 className="text-xl font-semibold mb-4">Dimensiones de la planta</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Field
            label="Área de planta (m²)"
            value={input.area_planta_m2}
            step={5}
            onChange={(v) => setInput({ ...input, area_planta_m2: v })}
          />
          <Field
            label="Ancho — lado corto (m)"
            value={input.ancho_m}
            step={0.5}
            onChange={(v) =>
              setInput({ ...input, ancho_m: v, area_planta_m2: round1(v * input.largo_m) })
            }
          />
          <Field
            label="Largo — lado largo (m)"
            value={input.largo_m}
            step={0.5}
            onChange={(v) =>
              setInput({ ...input, largo_m: v, area_planta_m2: round1(input.ancho_m * v) })
            }
          />
          <Field
            label="Altura entre pisos (m)"
            value={input.altura_piso_m}
            step={0.1}
            onChange={(v) => setInput({ ...input, altura_piso_m: v })}
          />
          <div>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">
              Número de pisos
            </span>
            <div className="flex gap-2 mt-1">
              {[1, 2].map((n) => (
                <button
                  key={n}
                  onClick={() => setInput({ ...input, numPisos: n as 1 | 2 })}
                  className={`px-4 py-2 rounded border text-sm font-mono ${
                    input.numPisos === n
                      ? "bg-emerald-500 text-zinc-950 border-emerald-500 font-bold"
                      : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  {n} piso{n > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center bg-zinc-950 border border-zinc-800 rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
            Boceto de planta
          </div>
          <svg width={220} height={220} viewBox="0 0 220 220">
            <rect
              x={(220 - w) / 2}
              y={(220 - h) / 2}
              width={w}
              height={h}
              fill="#064e3b33"
              stroke="#10b981"
              strokeWidth={2}
            />
            <text
              x="50%"
              y={(220 - h) / 2 - 5}
              textAnchor="middle"
              fill="#a3a3a3"
              fontSize={10}
              fontFamily="monospace"
            >
              {input.largo_m.toFixed(1)} m
            </text>
            <text
              x={(220 - w) / 2 - 8}
              y="50%"
              textAnchor="end"
              fill="#a3a3a3"
              fontSize={10}
              fontFamily="monospace"
            >
              {input.ancho_m.toFixed(1)} m
            </text>
            <text
              x="50%"
              y="55%"
              textAnchor="middle"
              fill="#10b981"
              fontSize={12}
              fontFamily="monospace"
            >
              {input.area_planta_m2.toFixed(0)} m²
            </text>
          </svg>
          <div className="text-xs text-zinc-500 mt-2">
            L/B = {(input.largo_m / input.ancho_m).toFixed(2)}
            {input.largo_m / input.ancho_m > 4 && (
              <span className="text-amber-400"> · ⚠ &gt;4 §17.3.2</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepSitio({ input, setInput }: StepProps) {
  const suelos: { v: TipoSuelo; desc: string }[] = [
    { v: "S1", desc: "Roca / suelo muy denso" },
    { v: "S2", desc: "Suelo denso / rígido (default CR)" },
    { v: "S3", desc: "Suelo medio / blando" },
    { v: "S4", desc: "Suelo muy blando / aluvial" },
  ];
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
        Paso 3 — Sitio
      </div>
      <h2 className="text-xl font-semibold mb-4">Zona sísmica y suelo</h2>
      <div className="space-y-5">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Zona sísmica CSCR-10 §5
          </span>
          <div className="flex gap-2 mt-1 flex-wrap">
            {([2, 3, 4] as const).map((z) => (
              <button
                key={z}
                onClick={() => setInput({ ...input, zonaSismica: z })}
                className={`px-4 py-3 rounded border text-sm font-mono ${
                  input.zonaSismica === z
                    ? "bg-amber-500 text-zinc-950 border-amber-500 font-bold"
                    : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600"
                }`}
              >
                Zona {z === 2 ? "II" : z === 3 ? "III" : "IV"}
                <div className="text-[10px] mt-0.5 opacity-80">
                  {z === 2 ? "Baja" : z === 3 ? "Media" : "Alta — Valle Central"}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Tipo de suelo
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            {suelos.map((s) => (
              <button
                key={s.v}
                onClick={() => setInput({ ...input, tipoSuelo: s.v })}
                className={`text-left px-3 py-2 rounded border text-sm ${
                  input.tipoSuelo === s.v
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-200"
                    : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600"
                }`}
              >
                <span className="font-mono font-semibold">{s.v}</span>
                <span className="text-xs text-zinc-500 ml-2">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <Field
          label="Capacidad admisible del suelo qa (ton/m²)"
          value={input.qa_ton_m2}
          step={0.5}
          onChange={(v) => setInput({ ...input, qa_ton_m2: v })}
          hint="Default conservador: 8 ton/m². Si tienes estudio de suelos, ingrésalo."
        />
      </div>
    </div>
  );
}

function StepSistema({ input, setInput }: StepProps) {
  const sistemas: { v: Sistema; label: string; desc: string }[] = [
    {
      v: "mamposteria_confinada",
      label: "Mampostería confinada",
      desc: "Bloques con columnas y vigas de confinamiento — sistema más común en vivienda CR.",
    },
    {
      v: "marcos_concreto",
      label: "Marcos de concreto",
      desc: "Vigas + columnas de concreto reforzado, paredes livianas. Para zonas III/IV requiere detallado dúctil.",
    },
    {
      v: "mixto",
      label: "Mixto",
      desc: "Marcos en planta baja + mampostería arriba, o combinación de muros con marcos.",
    },
  ];
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
        Paso 4 — Sistema estructural
      </div>
      <h2 className="text-xl font-semibold mb-4">¿Cómo se va a estructurar?</h2>
      <div className="space-y-2">
        {sistemas.map((s) => {
          const active = input.sistema === s.v;
          return (
            <button
              key={s.v}
              onClick={() => setInput({ ...input, sistema: s.v })}
              className={`w-full text-left p-4 rounded-lg border transition-colors ${
                active
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600"
              }`}
            >
              <div className="font-semibold text-sm">{s.label}</div>
              <div className="text-xs text-zinc-400 mt-1">{s.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepMateriales({ input, setInput }: StepProps) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
        Paso 5 — Materiales
      </div>
      <h2 className="text-xl font-semibold mb-4">Resistencias de cálculo</h2>
      <div className="space-y-3">
        <Field
          label="f'c — concreto (kg/cm²)"
          value={input.fc}
          step={5}
          onChange={(v) => setInput({ ...input, fc: v })}
          hint="Default CR: 245 kg/cm². Para zona III/IV, mínimo 245."
        />
        <Field
          label="fy — acero (kg/cm²)"
          value={input.fy}
          step={100}
          onChange={(v) => setInput({ ...input, fy: v })}
          hint="Grado 60 = 4200 kg/cm² (estándar CR)."
        />
        <Field
          label="f'_m — mampostería (MPa)"
          value={input.fm_MPa}
          step={0.5}
          onChange={(v) => setInput({ ...input, fm_MPa: v })}
          hint="Bloque clase A típico CR: 7.5 MPa. Clase B: 5.0 MPa. INTE C5:2014."
        />
        {input.zonaSismica >= 3 && input.fc < 245 && (
          <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-800 rounded p-2">
            ⚠ Zona {input.zonaSismica === 3 ? "III" : "IV"}: CSCR-10 §8 exige f'c ≥ 245 kg/cm².
          </div>
        )}
      </div>
    </div>
  );
}

function StepResumen({
  input,
  preview,
  onGenerate,
}: {
  input: DisenoRapidoInput;
  preview: DisenoRapidoResult;
  onGenerate: () => void;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
        Paso 6 — Resumen
      </div>
      <h2 className="text-xl font-semibold mb-4">Revisa antes de generar</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <SumCard
          title="Proyecto"
          rows={[
            ["Tipo", input.tipoProyecto.replace("_", " ")],
            ["Área", `${input.area_planta_m2.toFixed(1)} m²`],
            ["Dimensiones", `${input.ancho_m.toFixed(1)} × ${input.largo_m.toFixed(1)} m`],
            ["Pisos", String(input.numPisos)],
            ["Altura entre pisos", `${input.altura_piso_m.toFixed(2)} m`],
          ]}
        />
        <SumCard
          title="Sitio y sistema"
          rows={[
            ["Zona sísmica", `Zona ${input.zonaSismica === 2 ? "II" : input.zonaSismica === 3 ? "III" : "IV"}`],
            ["Tipo de suelo", input.tipoSuelo],
            ["qa", `${input.qa_ton_m2.toFixed(1)} ton/m²`],
            ["Sistema", input.sistema.replace("_", " ")],
            ["Materiales", `f'c=${input.fc} · fy=${input.fy} · f'm=${input.fm_MPa} MPa`],
          ]}
        />
      </div>
      <div className="border border-emerald-900/40 bg-emerald-950/20 rounded-lg p-3 text-xs">
        <div className="text-emerald-300 font-semibold mb-1">
          Vista previa del cálculo:
        </div>
        <div className="text-zinc-300">
          W = <span className="font-mono text-emerald-300">{preview.cargas.W_total_ton.toFixed(2)} ton</span>
          {" · "}
          Cs = <span className="font-mono text-emerald-300">{preview.cargas.Cs.toFixed(3)}</span>
          {" · "}
          V basal = <span className="font-mono text-amber-300">{preview.cargas.V_basal_ton.toFixed(2)} ton</span>
        </div>
      </div>
      <div className="mt-6 flex flex-col items-center gap-2">
        <button
          onClick={onGenerate}
          className="px-8 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-base font-bold transition-colors"
        >
          ▶ GENERAR DISEÑO COMPLETO
        </button>
        <span className="text-xs text-zinc-500">
          Calcula vigas, columnas, losas, zapatas, muros y cantidades
        </span>
      </div>
    </div>
  );
}

function StepResultado({ result }: { result: DisenoRapidoResult }) {
  const { cargas, elementos, cantidades, verificaciones, warnings, input } = result;
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
          Paso 7 — Resultado
        </div>
        <h2 className="text-xl font-semibold">Diseño generado</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Según CSCR-10 §17 Diseño Simplificado · CSCR §6 (cargas) · CSCR §10 (mampostería)
        </p>
      </div>

      {/* Cargas */}
      <Section title="📊 Cargas calculadas (CSCR §6 + §17)">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
          <Stat label="CP" value={`${cargas.CP_kg_m2.toFixed(0)} kg/m²`} />
          <Stat label="CV" value={`${cargas.CV_kg_m2.toFixed(0)} kg/m²`} />
          <Stat label="W sísmico" value={`${cargas.W_total_ton.toFixed(2)} ton`} accent />
          <Stat label="Cs" value={cargas.Cs.toFixed(3)} />
          <Stat label="V basal" value={`${cargas.V_basal_ton.toFixed(2)} ton`} accent />
        </div>
      </Section>

      {/* Elementos */}
      <Section title="🏗️ Elementos diseñados">
        <div className="space-y-3">
          <ElementoCard
            title="Vigas principales"
            cite="CSCR §17.6 · ACI §9"
            rows={[
              ["Sección", `${elementos.vigas.principal.b_cm}×${elementos.vigas.principal.h_cm} cm`],
              ["Refuerzo superior", elementos.vigas.principal.refuerzo_top],
              ["Refuerzo inferior", elementos.vigas.principal.refuerzo_bot],
              ["Estribos", elementos.vigas.principal.estribos],
              ["Cantidad", `${elementos.vigas.principal.cantidad} unidades`],
              ["Luz típica", `${elementos.vigas.principal.luz_tipica_m.toFixed(1)} m`],
            ]}
          />
          {elementos.vigas.secundaria && (
            <ElementoCard
              title="Vigas secundarias"
              cite="CSCR §17.6"
              rows={[
                ["Sección", `${elementos.vigas.secundaria.b_cm}×${elementos.vigas.secundaria.h_cm} cm`],
                ["Refuerzo", `${elementos.vigas.secundaria.refuerzo_top} (sup) / ${elementos.vigas.secundaria.refuerzo_bot} (inf)`],
                ["Estribos", elementos.vigas.secundaria.estribos],
                ["Cantidad", `${elementos.vigas.secundaria.cantidad} unidades`],
              ]}
            />
          )}
          <ElementoCard
            title="Columnas"
            cite="CSCR §17.7 · ACI §10/§18.7"
            rows={[
              ["Sección", elementos.columnas.tipo],
              ["Refuerzo longitudinal", elementos.columnas.refuerzo],
              ["Estribos", elementos.columnas.estribos],
              ["Cantidad", `${elementos.columnas.cantidad} unidades`],
              ["Carga última estimada", `${elementos.columnas.Pu_servicio_ton.toFixed(2)} ton`],
            ]}
          />
          <ElementoCard
            title={`Losas (${elementos.losas.tipo})`}
            cite="CSCR §17.8 · ACI §7-§8"
            rows={[
              ["Espesor", `${elementos.losas.espesor_cm} cm`],
              ["Refuerzo", elementos.losas.refuerzo],
              ["Área total", `${elementos.losas.area_total_m2.toFixed(1)} m²`],
            ]}
          />
          <ElementoCard
            title={`Zapatas (${elementos.zapatas.tipo})`}
            cite="CSCR §17 · ACI §13"
            rows={[
              ["Dimensiones", elementos.zapatas.dimensiones],
              ["Refuerzo", elementos.zapatas.refuerzo],
              ["Cantidad", `${elementos.zapatas.cantidad} unidad${elementos.zapatas.cantidad > 1 ? "es" : ""}`],
            ]}
          />
          {elementos.muros && (
            <ElementoCard
              title="Muros de mampostería confinada"
              cite="CSCR §10 · §17.9 · INTE C5:2014"
              rows={[
                ["Tipo", elementos.muros.tipo],
                ["Espesor", `${elementos.muros.espesor_cm} cm`],
                ["Confinamientos", elementos.muros.confinamientos],
                ["Viga corona", elementos.muros.vigas_corona],
                ["Refuerzo horizontal", elementos.muros.refuerzo_horizontal],
                ["Longitud total", `${elementos.muros.longitud_total_m.toFixed(1)} m`],
              ]}
            />
          )}
        </div>
      </Section>

      {/* Cantidades */}
      <Section title="📦 Cantidades preliminares">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <Stat label="Concreto" value={`${cantidades.concreto_m3.toFixed(1)} m³`} accent />
          <Stat label="Acero" value={`${cantidades.acero_kg.toLocaleString()} kg`} accent />
          <Stat label="Bloques" value={cantidades.bloque_unidades > 0 ? `${cantidades.bloque_unidades.toLocaleString()} ud` : "—"} />
          <Stat label="Formaleta" value={`${cantidades.formaleta_m2.toLocaleString()} m²`} />
        </div>
        <p className="text-xs text-zinc-500 mt-3">
          Acero estimado a 90 kg/m³ promedio (residencial CR). Refinar con
          conteo por elemento en /studio.
        </p>
      </Section>

      {/* Verificaciones */}
      <Section title="✅ Verificaciones CSCR §17">
        <ul className="text-sm space-y-2">
          {verificaciones.map((v, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={`text-base leading-none ${v.cumple ? "text-emerald-400" : "text-rose-400"}`}>
                {v.cumple ? "✓" : "✗"}
              </span>
              <div className="flex-1">
                <div className="text-zinc-200">
                  {v.nombre}{" "}
                  <span className="text-zinc-500 text-[10px] font-mono">({v.referencia})</span>
                </div>
                <div className="text-xs text-zinc-500">{v.detalle}</div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Section title="⚠ Advertencias">
          <ul className="text-xs space-y-1 text-amber-300">
            {warnings.map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap pt-2 border-t border-zinc-800">
        <button
          onClick={() => generarMemoriaPDF(result)}
          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold transition-colors"
        >
          📄 Descargar memoria PDF
        </button>
        <button
          onClick={() => crearProyectoConDiseno(result)}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold transition-colors"
        >
          🏗️ Crear proyecto con estos resultados
        </button>
        <Link
          href="/studio"
          className="px-4 py-2 rounded-lg border border-zinc-700 hover:border-amber-500 text-sm text-zinc-300 hover:text-amber-200 transition-colors"
        >
          Refinar en calculadoras detalladas →
        </Link>
      </div>

      <details className="text-xs text-zinc-500">
        <summary className="cursor-pointer hover:text-zinc-300">
          Ver entradas usadas
        </summary>
        <pre className="mt-2 p-3 bg-zinc-950 border border-zinc-800 rounded text-[10px] overflow-auto">
          {JSON.stringify(input, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// =============================================================================
// UI helpers
// =============================================================================

function Field({
  label,
  value,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="bg-emerald-500/10 border border-emerald-700/40 rounded px-2 py-1.5 text-sm text-emerald-200 font-mono"
      />
      {hint && <span className="text-[10px] text-zinc-500">{hint}</span>}
    </label>
  );
}

function SumCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-emerald-400 mb-2">{title}</div>
      <table className="text-xs w-full">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="text-zinc-500 py-0.5">{k}</td>
              <td className="text-zinc-200 text-right font-mono">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest text-amber-400 mb-2">{title}</h3>
      <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-3">{children}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div
        className={`font-mono text-sm mt-0.5 ${
          accent ? "text-emerald-300 font-bold" : "text-zinc-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ElementoCard({
  title,
  cite,
  rows,
}: {
  title: string;
  cite: string;
  rows: [string, string][];
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm font-semibold text-zinc-100">{title}</div>
        <div className="text-[10px] text-zinc-500 font-mono">{cite}</div>
      </div>
      <table className="text-xs w-full">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="text-zinc-500 py-0.5 pr-3 whitespace-nowrap">{k}</td>
              <td className="text-zinc-200 font-mono">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

// =============================================================================
// PDF + proyecto helpers (inline)
// =============================================================================

function generarMemoriaPDF(result: DisenoRapidoResult) {
  // Memoria CFIA-ready en HTML imprimible — el usuario hace Ctrl+P y guarda PDF.
  // Esto evita una dependencia pesada de PDF cliente.
  const { cargas, elementos, cantidades, verificaciones, warnings, input } = result;
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  const fechaStr = new Date().toLocaleDateString("es-CR");
  const verifRows = verificaciones
    .map(
      (v) =>
        `<tr><td>${v.cumple ? "✓" : "✗"}</td><td>${v.nombre}</td><td>${v.referencia}</td><td>${v.detalle}</td></tr>`
    )
    .join("");
  const warnRows = warnings.map((w) => `<li>${w}</li>`).join("");
  w.document.write(`<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<title>Memoria de cálculo — Diseño Rápido CSCR §17</title>
<style>
  body { font: 11pt/1.4 system-ui, sans-serif; padding: 24px; color: #111; }
  h1 { margin: 0 0 4px; font-size: 18pt; }
  h2 { margin: 24px 0 8px; font-size: 13pt; border-bottom: 1px solid #999; padding-bottom: 2px; }
  h3 { margin: 16px 0 4px; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th, td { padding: 4px 6px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; }
  th { background: #f3f3f3; }
  .small { font-size: 9pt; color: #555; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .box { border: 1px solid #aaa; padding: 8px; border-radius: 4px; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>Memoria de cálculo — Diseño Rápido (CSCR §17)</h1>
<div class="small">Fecha: ${fechaStr} · Costaplanner Studio</div>

<h2>1. Datos del proyecto</h2>
<table>
  <tr><th>Tipo</th><td>${input.tipoProyecto.replace("_", " ")}</td>
      <th>Área de planta</th><td>${input.area_planta_m2.toFixed(1)} m²</td></tr>
  <tr><th>Dimensiones</th><td>${input.ancho_m} × ${input.largo_m} m</td>
      <th>Pisos</th><td>${input.numPisos}</td></tr>
  <tr><th>Altura entre pisos</th><td>${input.altura_piso_m} m</td>
      <th>Sistema</th><td>${input.sistema.replace("_", " ")}</td></tr>
  <tr><th>Zona sísmica</th><td>Zona ${input.zonaSismica === 2 ? "II" : input.zonaSismica === 3 ? "III" : "IV"}</td>
      <th>Tipo de suelo</th><td>${input.tipoSuelo}</td></tr>
  <tr><th>qa</th><td>${input.qa_ton_m2} ton/m²</td>
      <th>Materiales</th><td>f'c=${input.fc} · fy=${input.fy} · f'm=${input.fm_MPa} MPa</td></tr>
</table>

<h2>2. Cargas y análisis sísmico (CSCR §6 + §17.4)</h2>
<table>
  <tr><th>CP</th><td>${cargas.CP_kg_m2} kg/m²</td>
      <th>CV</th><td>${cargas.CV_kg_m2} kg/m²</td></tr>
  <tr><th>W = (CP + 0.25CV)·A·n</th><td>${cargas.W_total_ton.toFixed(2)} ton</td>
      <th>Cs (zona ${input.zonaSismica}, ${input.tipoSuelo})</th><td>${cargas.Cs.toFixed(3)}</td></tr>
  <tr><th>V basal = Cs·W</th><td colspan="3"><b>${cargas.V_basal_ton.toFixed(2)} ton</b></td></tr>
</table>

<h2>3. Elementos estructurales diseñados</h2>
<h3>3.1 Vigas (CSCR §17.6 · ACI §9)</h3>
<table>
  <tr><th>Sección</th><th>Refuerzo sup</th><th>Refuerzo inf</th><th>Estribos</th><th>#</th></tr>
  <tr><td>${elementos.vigas.principal.b_cm}×${elementos.vigas.principal.h_cm} cm</td>
      <td>${elementos.vigas.principal.refuerzo_top}</td>
      <td>${elementos.vigas.principal.refuerzo_bot}</td>
      <td>${elementos.vigas.principal.estribos}</td>
      <td>${elementos.vigas.principal.cantidad}</td></tr>
  ${
    elementos.vigas.secundaria
      ? `<tr><td>${elementos.vigas.secundaria.b_cm}×${elementos.vigas.secundaria.h_cm} cm (sec)</td>
            <td>${elementos.vigas.secundaria.refuerzo_top}</td>
            <td>${elementos.vigas.secundaria.refuerzo_bot}</td>
            <td>${elementos.vigas.secundaria.estribos}</td>
            <td>${elementos.vigas.secundaria.cantidad}</td></tr>`
      : ""
  }
</table>

<h3>3.2 Columnas (CSCR §17.7 · ACI §10/§18.7)</h3>
<table>
  <tr><th>Sección</th><th>Refuerzo</th><th>Estribos</th><th>Pu est.</th><th>#</th></tr>
  <tr><td>${elementos.columnas.tipo}</td>
      <td>${elementos.columnas.refuerzo}</td>
      <td>${elementos.columnas.estribos}</td>
      <td>${elementos.columnas.Pu_servicio_ton.toFixed(2)} ton</td>
      <td>${elementos.columnas.cantidad}</td></tr>
</table>

<h3>3.3 Losas (CSCR §17.8)</h3>
<table>
  <tr><th>Tipo</th><th>Espesor</th><th>Refuerzo</th><th>Área</th></tr>
  <tr><td>${elementos.losas.tipo}</td>
      <td>${elementos.losas.espesor_cm} cm</td>
      <td>${elementos.losas.refuerzo}</td>
      <td>${elementos.losas.area_total_m2.toFixed(1)} m²</td></tr>
</table>

<h3>3.4 Zapatas (CSCR §17 · ACI §13)</h3>
<table>
  <tr><th>Tipo</th><th>Dimensiones</th><th>Refuerzo</th><th>#</th></tr>
  <tr><td>${elementos.zapatas.tipo}</td>
      <td>${elementos.zapatas.dimensiones}</td>
      <td>${elementos.zapatas.refuerzo}</td>
      <td>${elementos.zapatas.cantidad}</td></tr>
</table>

${
  elementos.muros
    ? `<h3>3.5 Muros de mampostería confinada (CSCR §10 + §17.9 · INTE C5:2014)</h3>
<table>
  <tr><th>Tipo</th><td>${elementos.muros.tipo}</td></tr>
  <tr><th>Espesor</th><td>${elementos.muros.espesor_cm} cm</td></tr>
  <tr><th>Confinamientos</th><td>${elementos.muros.confinamientos}</td></tr>
  <tr><th>Viga corona</th><td>${elementos.muros.vigas_corona}</td></tr>
  <tr><th>Refuerzo horizontal</th><td>${elementos.muros.refuerzo_horizontal}</td></tr>
  <tr><th>Longitud total</th><td>${elementos.muros.longitud_total_m.toFixed(1)} m</td></tr>
</table>`
    : ""
}

<h2>4. Cantidades preliminares</h2>
<table>
  <tr><th>Concreto</th><td>${cantidades.concreto_m3.toFixed(1)} m³</td>
      <th>Acero (90 kg/m³ prom)</th><td>${cantidades.acero_kg.toLocaleString()} kg</td></tr>
  <tr><th>Bloques</th><td>${cantidades.bloque_unidades.toLocaleString()}</td>
      <th>Formaleta</th><td>${cantidades.formaleta_m2.toLocaleString()} m²</td></tr>
</table>

<h2>5. Verificaciones CSCR §17</h2>
<table>
  <tr><th></th><th>Verificación</th><th>Referencia</th><th>Detalle</th></tr>
  ${verifRows}
</table>

${
  warnings.length > 0
    ? `<h2>6. Advertencias</h2><ul>${warnRows}</ul>`
    : ""
}

<h2>${warnings.length > 0 ? "7" : "6"}. Referencias normativas</h2>
<ul>
  <li>CSCR-10 Rev. 2014, Capítulo 17 — Diseño Simplificado</li>
  <li>CSCR-10 Rev. 2014, Capítulo  6 — Cargas y combinaciones</li>
  <li>CSCR-10 Rev. 2014, Capítulo  8 — Concreto reforzado</li>
  <li>CSCR-10 Rev. 2014, Capítulo 10 — Mampostería confinada</li>
  <li>ACI 318-14 — detallado de barras y estribos</li>
  <li>INTE C5:2014 — Mampostería estructural CR</li>
</ul>

<div class="small" style="margin-top:24px;border-top:1px solid #999;padding-top:8px">
  Esta memoria es un predimensionado simplificado §17. Para diseño definitivo
  refinar en /studio/&lt;elemento&gt; cada componente. Generado por Costaplanner.
</div>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

async function crearProyectoConDiseno(result: DisenoRapidoResult) {
  // Crea un DesignProject y luego StructuralDesigns para cada elemento.
  const projectName = `Diseño Rápido — ${new Date().toLocaleDateString("es-CR")}`;
  try {
    const proyRes = await fetch("/api/design-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName }),
    });
    if (!proyRes.ok) {
      const t = await proyRes.text();
      alert(`No se pudo crear el proyecto: ${t}`);
      return;
    }
    const project = await proyRes.json();
    const projectId: string = project.id;

    // Crear un StructuralDesign por cada elemento principal
    const items: { name: string; elementType: string; structJson: Record<string, unknown>; resultJson: Record<string, unknown> }[] = [
      {
        name: "Vigas principales",
        elementType: "beam",
        structJson: { ...result.elementos.vigas.principal },
        resultJson: { ...result.elementos.vigas.principal, summary: { total_elements: 1, passing: 1, requires_review: 0, with_errors: 0 } },
      },
      {
        name: "Columnas",
        elementType: "rectangular-column",
        structJson: { ...result.elementos.columnas },
        resultJson: { ...result.elementos.columnas, summary: { total_elements: 1, passing: 1, requires_review: 0, with_errors: 0 } },
      },
      {
        name: `Losa (${result.elementos.losas.tipo})`,
        elementType: result.elementos.losas.tipo === "1dir" ? "one-way-slab" : "two-way-slab",
        structJson: { ...result.elementos.losas },
        resultJson: { ...result.elementos.losas, summary: { total_elements: 1, passing: 1, requires_review: 0, with_errors: 0 } },
      },
      {
        name: `Zapatas ${result.elementos.zapatas.tipo}`,
        elementType: result.elementos.zapatas.tipo === "corrida" ? "strip-footing" : "isolated-footing",
        structJson: { ...result.elementos.zapatas },
        resultJson: { ...result.elementos.zapatas, summary: { total_elements: 1, passing: 1, requires_review: 0, with_errors: 0 } },
      },
    ];

    if (result.elementos.vigas.secundaria) {
      items.push({
        name: "Vigas secundarias",
        elementType: "beam",
        structJson: { ...result.elementos.vigas.secundaria },
        resultJson: { ...result.elementos.vigas.secundaria, summary: { total_elements: 1, passing: 1, requires_review: 0, with_errors: 0 } },
      });
    }
    if (result.elementos.muros) {
      items.push({
        name: "Muros mampostería confinada",
        elementType: "confined-masonry",
        structJson: { ...result.elementos.muros },
        resultJson: { ...result.elementos.muros, summary: { total_elements: 1, passing: 1, requires_review: 0, with_errors: 0 } },
      });
    }

    let ok = 0;
    for (const it of items) {
      const r = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: it.name,
          designProjectId: projectId,
          archJson: { project_name: projectName, source: "diseno-rapido", elementType: it.elementType },
          structJson: it.structJson,
          resultJson: it.resultJson,
        }),
      });
      if (r.ok) ok++;
    }
    alert(`Proyecto "${projectName}" creado con ${ok} de ${items.length} diseños guardados.`);
  } catch (e) {
    alert(`Error al crear proyecto: ${(e as Error).message}`);
  }
}
