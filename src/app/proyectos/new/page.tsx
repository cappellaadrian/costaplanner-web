"use client";

/**
 * /proyectos/new — multi-step wizard to create a DesignProject.
 *
 * 5 screens:
 *   1. Metadata           (name, address, owner, engineer, CFIA)
 *   2. Estudio de sitio   (zona sísmica, qa, φ, c, γ, water table)
 *   3. Arquitectura       (# floors, gross area, building use)
 *   4. Sistema estructural (system, f'c, fy)
 *   5. Confirmación       (review + POST)
 *
 * On success → router.push(`/proyectos/<new-id>`).
 *
 * Phase 1 — no DB triggers beyond /api/design-projects POST. Backend deep-
 * merges metaJson on subsequent PATCHes from the dashboard's "Editar
 * criterios" modal.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface FormData {
  // Step 1
  name: string;
  address: string;
  province: string;
  canton: string;
  owner: string;
  engineerName: string;
  cfiaCode: string;
  // Step 2
  zonaSismica: 1 | 2 | 3 | 4 | "";
  qa_ton_m2: string;
  phi_deg: string;
  c_kPa: string;
  gamma_kN_m3: string;
  waterTable_m: string;
  // Step 3
  numFloors: string;
  grossArea_m2: string;
  buildingUse:
    | "residential"
    | "commercial"
    | "industrial"
    | "institutional"
    | "";
  // Step 4
  structuralSystem:
    | "marcos"
    | "muros"
    | "dual"
    | "mampostería_confinada"
    | "acero"
    | "";
  fc_default: string;
  fy_default: string;
}

const INITIAL: FormData = {
  name: "",
  address: "",
  province: "",
  canton: "",
  owner: "",
  engineerName: "",
  cfiaCode: "",
  zonaSismica: "",
  qa_ton_m2: "",
  phi_deg: "",
  c_kPa: "",
  gamma_kN_m3: "",
  waterTable_m: "",
  numFloors: "",
  grossArea_m2: "",
  buildingUse: "",
  structuralSystem: "",
  fc_default: "245",
  fy_default: "4200",
};

const ZONA_DESCRIPTIONS: Record<1 | 2 | 3 | 4, string> = {
  1: "Riesgo bajo — interior pacífico norte, Guanacaste interior",
  2: "Riesgo moderado — valle central oeste, parte del Caribe",
  3: "Riesgo alto — GAM, Pérez Zeledón, Limón",
  4: "Riesgo muy alto — Nicoya, Quepos, frontera sur",
};

export default function NuevoProyectoPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function validStep(n: number): string | null {
    if (n === 1) {
      if (!data.name.trim()) return "Nombre del proyecto es requerido.";
    }
    if (n === 2) {
      if (!data.zonaSismica) return "Selecciona una zona sísmica.";
    }
    if (n === 3) {
      if (!data.numFloors || Number(data.numFloors) < 1)
        return "Número de pisos debe ser ≥ 1.";
      if (!data.grossArea_m2 || Number(data.grossArea_m2) <= 0)
        return "Área bruta debe ser > 0.";
      if (!data.buildingUse) return "Selecciona el uso del edificio.";
    }
    if (n === 4) {
      if (!data.structuralSystem) return "Selecciona el sistema estructural.";
      if (!data.fc_default || Number(data.fc_default) <= 0)
        return "f'c debe ser > 0.";
      if (!data.fy_default || Number(data.fy_default) <= 0)
        return "fy debe ser > 0.";
    }
    return null;
  }

  function next() {
    const err = validStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(5, s + 1));
  }

  function prev() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const metaJson = {
        address: data.address || undefined,
        province: data.province || undefined,
        canton: data.canton || undefined,
        owner: data.owner || undefined,
        engineerName: data.engineerName || undefined,
        cfiaCode: data.cfiaCode || undefined,
        zonaSismica:
          data.zonaSismica === "" ? undefined : Number(data.zonaSismica),
        qa_ton_m2: data.qa_ton_m2 ? Number(data.qa_ton_m2) : undefined,
        phi_deg: data.phi_deg ? Number(data.phi_deg) : undefined,
        c_kPa: data.c_kPa ? Number(data.c_kPa) : undefined,
        gamma_kN_m3: data.gamma_kN_m3 ? Number(data.gamma_kN_m3) : undefined,
        waterTable_m: data.waterTable_m
          ? Number(data.waterTable_m)
          : undefined,
        numFloors: data.numFloors ? Number(data.numFloors) : undefined,
        grossArea_m2: data.grossArea_m2
          ? Number(data.grossArea_m2)
          : undefined,
        buildingUse: data.buildingUse || undefined,
        structuralSystem: data.structuralSystem || undefined,
        fc_default: data.fc_default ? Number(data.fc_default) : undefined,
        fy_default: data.fy_default ? Number(data.fy_default) : undefined,
        completedSteps: [],
      };
      const r = await fetch("/api/design-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name.trim() }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${r.status}`);
      }
      const created = await r.json();
      // POST doesn't accept metaJson directly (existing route stays minimal),
      // so we PATCH the meta right after. Two roundtrips, but keeps the
      // /api/design-projects POST contract stable.
      const p = await fetch(`/api/design-projects/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metaJson }),
      });
      if (!p.ok) {
        const e = await p.json().catch(() => ({}));
        throw new Error(
          `Proyecto creado pero los criterios no se guardaron: ${
            e.error || `HTTP ${p.status}`
          }`,
        );
      }
      router.push(`/proyectos/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Nuevo proyecto</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Captura los criterios una sola vez. Los usaremos en todos los
              cálculos del proyecto.
            </p>
          </div>
          <Link
            href="/proyectos"
            className="text-sm text-zinc-400 hover:text-amber-400"
          >
            Cancelar
          </Link>
        </div>

        {/* Stepper */}
        <Stepper step={step} />

        {/* Body */}
        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/30 p-6">
          {step === 1 && <Step1 data={data} update={update} />}
          {step === 2 && <Step2 data={data} update={update} />}
          {step === 3 && <Step3 data={data} update={update} />}
          {step === 4 && <Step4 data={data} update={update} />}
          {step === 5 && <Step5 data={data} />}

          {error && (
            <div className="mt-4 text-xs text-red-400 border border-red-900/40 bg-red-950/20 rounded p-3">
              {error}
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={prev}
            disabled={step === 1}
            className="px-4 py-2 rounded text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
          >
            ← Anterior
          </button>
          <div className="text-xs text-zinc-500">Paso {step} de 5</div>
          {step < 5 ? (
            <button
              onClick={next}
              className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold"
            >
              Siguiente →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-sm font-bold disabled:opacity-50"
            >
              {submitting ? "Creando…" : "Crear proyecto"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = [
    "Metadatos",
    "Estudio de sitio",
    "Arquitectura",
    "Sistema",
    "Confirmar",
  ];
  return (
    <ol className="flex items-center gap-2 text-xs flex-wrap">
      {labels.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border shrink-0 ${
                active
                  ? "border-amber-400 bg-amber-500/20 text-amber-300"
                  : done
                    ? "border-emerald-600 bg-emerald-600/20 text-emerald-300"
                    : "border-zinc-700 text-zinc-500"
              }`}
            >
              {done ? "✓" : n}
            </span>
            <span
              className={`hidden sm:inline ${
                active
                  ? "text-amber-300 font-medium"
                  : done
                    ? "text-emerald-400"
                    : "text-zinc-500"
              }`}
            >
              {label}
            </span>
            {/* On mobile, only the active step shows its label, keeping the
                stepper compact (4 circles + 1 label fits in 375px). */}
            {active && (
              <span className="sm:hidden text-amber-300 font-medium">
                {label}
              </span>
            )}
            {n < labels.length && (
              <span className="mx-1 text-zinc-700 hidden sm:inline">→</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Step Components ──────────────────────────────────────────────────────

interface StepProps {
  data: FormData;
  update: <K extends keyof FormData>(key: K, value: FormData[K]) => void;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <p className="text-[10px] text-zinc-500 mt-1">{hint}</p>}
    </label>
  );
}

const INPUT_CLS =
  "w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none";

function Step1({ data, update }: StepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Metadatos del proyecto</h2>
      <Field label="Nombre del proyecto *">
        <input
          className={INPUT_CLS}
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Edificio Avenida 23"
          autoFocus
        />
      </Field>
      <Field label="Dirección">
        <input
          className={INPUT_CLS}
          value={data.address}
          onChange={(e) => update("address", e.target.value)}
          placeholder="Avenida 23, 200m sur de…"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Provincia">
          <input
            className={INPUT_CLS}
            value={data.province}
            onChange={(e) => update("province", e.target.value)}
            placeholder="San José"
          />
        </Field>
        <Field label="Cantón">
          <input
            className={INPUT_CLS}
            value={data.canton}
            onChange={(e) => update("canton", e.target.value)}
            placeholder="Montes de Oca"
          />
        </Field>
      </div>
      <Field label="Dueño">
        <input
          className={INPUT_CLS}
          value={data.owner}
          onChange={(e) => update("owner", e.target.value)}
          placeholder="Inversiones Tropical SA"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Ingeniero responsable">
          <input
            className={INPUT_CLS}
            value={data.engineerName}
            onChange={(e) => update("engineerName", e.target.value)}
            placeholder="Ing. Juan Pérez"
          />
        </Field>
        <Field label="Código CFIA" hint="Ej. IC-12345">
          <input
            className={INPUT_CLS}
            value={data.cfiaCode}
            onChange={(e) => update("cfiaCode", e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function Step2({ data, update }: StepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Estudio de sitio</h2>

      <fieldset>
        <legend className="text-xs uppercase tracking-wide text-zinc-400 mb-2">
          Zona sísmica (CSCR-10) *
        </legend>
        <div className="grid grid-cols-1 gap-2">
          {([1, 2, 3, 4] as const).map((z) => (
            <label
              key={z}
              className={`flex items-start gap-3 rounded border p-3 cursor-pointer transition-colors ${
                data.zonaSismica === z
                  ? "border-amber-400 bg-amber-500/10"
                  : "border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <input
                type="radio"
                name="zona"
                checked={data.zonaSismica === z}
                onChange={() => update("zonaSismica", z)}
                className="mt-1 accent-amber-500"
              />
              <span>
                <span className="font-semibold">Zona {["I", "II", "III", "IV"][z - 1]}</span>{" "}
                <span className="text-xs text-zinc-500">— {ZONA_DESCRIPTIONS[z]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="qa admisible (ton/m²)"
        hint={
          <>
            ¿No sabe?{" "}
            <Link
              href="/studio/geotecnica/spt"
              className="text-amber-400 hover:underline"
            >
              Calcule con SPT →
            </Link>
          </>
        }
      >
        <input
          className={INPUT_CLS}
          type="number"
          step="0.5"
          value={data.qa_ton_m2}
          onChange={(e) => update("qa_ton_m2", e.target.value)}
          placeholder="20"
        />
      </Field>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Field label="φ (°)">
          <input
            className={INPUT_CLS}
            type="number"
            step="1"
            value={data.phi_deg}
            onChange={(e) => update("phi_deg", e.target.value)}
            placeholder="30"
          />
        </Field>
        <Field label="c (kPa)">
          <input
            className={INPUT_CLS}
            type="number"
            step="1"
            value={data.c_kPa}
            onChange={(e) => update("c_kPa", e.target.value)}
            placeholder="10"
          />
        </Field>
        <Field label="γ (kN/m³)">
          <input
            className={INPUT_CLS}
            type="number"
            step="0.5"
            value={data.gamma_kN_m3}
            onChange={(e) => update("gamma_kN_m3", e.target.value)}
            placeholder="18"
          />
        </Field>
      </div>

      <Field label="Nivel freático (m)" hint="Profundidad desde el nivel del terreno">
        <input
          className={INPUT_CLS}
          type="number"
          step="0.5"
          value={data.waterTable_m}
          onChange={(e) => update("waterTable_m", e.target.value)}
          placeholder="3.5"
        />
      </Field>
    </div>
  );
}

function Step3({ data, update }: StepProps) {
  const uses: Array<{
    key: FormData["buildingUse"];
    label: string;
    hint: string;
  }> = [
    {
      key: "residential",
      label: "Residencial",
      hint: "Vivienda unifamiliar, multifamiliar",
    },
    {
      key: "commercial",
      label: "Comercial",
      hint: "Locales, oficinas, retail",
    },
    {
      key: "industrial",
      label: "Industrial",
      hint: "Bodegas, naves, plantas",
    },
    {
      key: "institutional",
      label: "Institucional",
      hint: "Escuelas, hospitales, edificios gobierno",
    },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Arquitectura</h2>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Número de pisos *">
          <input
            className={INPUT_CLS}
            type="number"
            min="1"
            value={data.numFloors}
            onChange={(e) => update("numFloors", e.target.value)}
            placeholder="2"
          />
        </Field>
        <Field label="Área bruta total (m²) *">
          <input
            className={INPUT_CLS}
            type="number"
            step="1"
            min="0"
            value={data.grossArea_m2}
            onChange={(e) => update("grossArea_m2", e.target.value)}
            placeholder="240"
          />
        </Field>
      </div>
      <fieldset>
        <legend className="text-xs uppercase tracking-wide text-zinc-400 mb-2">
          Uso del edificio *
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {uses.map((u) => (
            <label
              key={u.key}
              className={`flex items-start gap-3 rounded border p-3 cursor-pointer transition-colors ${
                data.buildingUse === u.key
                  ? "border-amber-400 bg-amber-500/10"
                  : "border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <input
                type="radio"
                name="use"
                checked={data.buildingUse === u.key}
                onChange={() => update("buildingUse", u.key)}
                className="mt-1 accent-amber-500"
              />
              <span>
                <span className="font-semibold">{u.label}</span>{" "}
                <span className="text-xs text-zinc-500 block">{u.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function Step4({ data, update }: StepProps) {
  const systems: Array<{ key: FormData["structuralSystem"]; label: string }> = [
    { key: "marcos", label: "Marcos de concreto" },
    { key: "muros", label: "Muros de corte" },
    { key: "dual", label: "Dual (marcos + muros)" },
    { key: "mampostería_confinada", label: "Mampostería confinada" },
    { key: "acero", label: "Acero" },
  ];

  const z = data.zonaSismica;
  const sys = data.structuralSystem;
  const suggestion =
    z === 3 && sys === "marcos"
      ? "Para zona III con marcos, f'c ≥ 245 y fy ≥ 4200 son típicos."
      : z === 4
        ? "Para zona IV, considera muros o dual para mejor desempeño sísmico."
        : null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Sistema estructural</h2>
      <fieldset>
        <legend className="text-xs uppercase tracking-wide text-zinc-400 mb-2">
          Sistema sismorresistente *
        </legend>
        <div className="grid grid-cols-1 gap-2">
          {systems.map((s) => (
            <label
              key={s.key}
              className={`flex items-start gap-3 rounded border p-3 cursor-pointer transition-colors ${
                data.structuralSystem === s.key
                  ? "border-amber-400 bg-amber-500/10"
                  : "border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <input
                type="radio"
                name="sys"
                checked={data.structuralSystem === s.key}
                onChange={() => update("structuralSystem", s.key)}
                className="mt-1 accent-amber-500"
              />
              <span className="font-semibold">{s.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <h3 className="text-xs uppercase tracking-wide text-zinc-400 mb-2">
          Materiales por defecto
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="f'c (kg/cm²) *">
            <input
              className={INPUT_CLS}
              type="number"
              step="5"
              value={data.fc_default}
              onChange={(e) => update("fc_default", e.target.value)}
            />
          </Field>
          <Field label="fy (kg/cm²) *">
            <input
              className={INPUT_CLS}
              type="number"
              step="100"
              value={data.fy_default}
              onChange={(e) => update("fy_default", e.target.value)}
            />
          </Field>
        </div>
      </div>

      {suggestion && (
        <div className="text-xs text-amber-300 border border-amber-700/40 bg-amber-500/5 rounded p-3">
          💡 {suggestion}
        </div>
      )}
    </div>
  );
}

function Step5({ data }: { data: FormData }) {
  const Row = ({
    label,
    value,
  }: {
    label: string;
    value: string | number | undefined;
  }) => (
    <div className="flex items-baseline justify-between gap-4 py-1 border-b border-zinc-800/60">
      <span className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <span className="text-sm text-zinc-200 text-right">
        {value === "" || value === undefined ? "—" : value}
      </span>
    </div>
  );
  const zonaLabel =
    data.zonaSismica === "" ? "—" : `Zona ${["I", "II", "III", "IV"][Number(data.zonaSismica) - 1]}`;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Resumen</h2>
      <p className="text-xs text-zinc-400">
        Revisa los datos. Al confirmar crearemos el proyecto y abriremos el
        tablero donde podrás añadir cálculos.
      </p>

      <section>
        <h3 className="text-xs uppercase tracking-wide text-amber-400 mb-2">
          Identificación
        </h3>
        <Row label="Nombre" value={data.name} />
        <Row label="Dirección" value={data.address} />
        <Row
          label="Provincia / Cantón"
          value={[data.province, data.canton].filter(Boolean).join(" / ")}
        />
        <Row label="Dueño" value={data.owner} />
        <Row label="Ingeniero" value={data.engineerName} />
        <Row label="CFIA" value={data.cfiaCode} />
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wide text-amber-400 mb-2">
          Sitio
        </h3>
        <Row label="Zona sísmica" value={zonaLabel} />
        <Row label="qa admisible" value={data.qa_ton_m2 ? `${data.qa_ton_m2} ton/m²` : ""} />
        <Row label="φ" value={data.phi_deg ? `${data.phi_deg}°` : ""} />
        <Row label="c" value={data.c_kPa ? `${data.c_kPa} kPa` : ""} />
        <Row label="γ" value={data.gamma_kN_m3 ? `${data.gamma_kN_m3} kN/m³` : ""} />
        <Row label="Nivel freático" value={data.waterTable_m ? `${data.waterTable_m} m` : ""} />
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wide text-amber-400 mb-2">
          Arquitectura
        </h3>
        <Row label="Pisos" value={data.numFloors} />
        <Row label="Área bruta" value={data.grossArea_m2 ? `${data.grossArea_m2} m²` : ""} />
        <Row label="Uso" value={data.buildingUse} />
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wide text-amber-400 mb-2">
          Sistema y materiales
        </h3>
        <Row label="Sistema" value={data.structuralSystem} />
        <Row label="f'c" value={`${data.fc_default} kg/cm²`} />
        <Row label="fy" value={`${data.fy_default} kg/cm²`} />
      </section>
    </div>
  );
}
