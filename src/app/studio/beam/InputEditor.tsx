"use client";

/**
 * Live input form for Beam Studio.
 *
 * Edits propagate immediately to the parent (debounced by useDeferredValue
 * upstream for the actual recompute). Each input is color-coded as a user
 * input (amber). The form covers the inputs needed by the 15-step flexure
 * procedure plus the seismic moment + Vu so the verification panel has
 * everything it needs to flip pass/fail in real time.
 */
import type { FlexureInput } from "@/lib/beam-flexure-live";

export interface BeamStudioInput extends FlexureInput {
  // Loads beyond Mu_tonm (negative-face) for verifications
  Mu_pos_tonm: number;
  Vu_ton: number;
  // Optional cover override for d derivation
  recubrimiento: number;
  // Display-only project bits (sent to API on official run)
  project_name: string;
  canton: string;
  zona_sismica: "II" | "III" | "IV";
  acero_norma: "A615" | "A706";
  L_cm: number;
}

export const DEFAULT_BEAM_INPUT: BeamStudioInput = {
  project_name: "Casa Demo",
  canton: "Escazu",
  zona_sismica: "III",
  acero_norma: "A706",
  // Flexure
  b: 30,
  d: 54,        // derived display, real d = h - recubrimiento on submit
  h: 60,
  recubrimiento: 4,
  Mu_tonm: 22.3,
  fc: 245,
  fy: 4200,
  // Loads for verifications
  Mu_pos_tonm: 15.0,
  Vu_ton: 12.5,
  L_cm: 625,
};

interface Props {
  value: BeamStudioInput;
  onChange: (next: BeamStudioInput) => void;
  disabled?: boolean;
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  step = 1,
  disabled,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
        {unit && <span className="text-zinc-600"> ({unit})</span>}
      </span>
      <input
        type="number"
        step={step}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        className="w-full bg-amber-500/5 text-amber-200 border border-amber-700/40 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-500 disabled:opacity-50"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-950 text-zinc-200 border border-zinc-800 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
      />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: T[];
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full bg-zinc-950 text-zinc-200 border border-zinc-800 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

export function InputEditor({ value, onChange, disabled }: Props) {
  const set = <K extends keyof BeamStudioInput>(key: K, v: BeamStudioInput[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      {/* Project / context */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 pb-1">
          Proyecto
        </div>
        <TextField
          label="Nombre"
          value={value.project_name}
          onChange={(v) => set("project_name", v)}
          disabled={disabled}
        />
        <TextField
          label="Canton"
          value={value.canton}
          onChange={(v) => set("canton", v)}
          disabled={disabled}
        />
        <SelectField
          label="Zona sismica"
          value={value.zona_sismica}
          onChange={(v) => set("zona_sismica", v)}
          options={["II", "III", "IV"]}
          disabled={disabled}
        />
      </div>

      {/* Materials */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 pb-1">
          Materiales
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="f'c"
            unit="kg/cm²"
            value={value.fc}
            onChange={(v) => set("fc", v)}
            disabled={disabled}
          />
          <NumberField
            label="fy"
            unit="kg/cm²"
            value={value.fy}
            onChange={(v) => set("fy", v)}
            disabled={disabled}
          />
        </div>
        <SelectField
          label="Acero"
          value={value.acero_norma}
          onChange={(v) => set("acero_norma", v)}
          options={["A615", "A706"]}
          disabled={disabled}
        />
      </div>

      {/* Geometry */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 pb-1">
          Geometria
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="b"
            unit="cm"
            value={value.b}
            onChange={(v) => set("b", v)}
            disabled={disabled}
          />
          <NumberField
            label="h"
            unit="cm"
            value={value.h}
            onChange={(v) => {
              // h changed: recompute d from cover so live mode tracks both
              onChange({ ...value, h: v, d: v - value.recubrimiento });
            }}
            disabled={disabled}
          />
          <NumberField
            label="d efectivo"
            unit="cm"
            value={value.d}
            onChange={(v) => set("d", v)}
            disabled={disabled}
          />
          <NumberField
            label="Recubrimiento"
            unit="cm"
            value={value.recubrimiento}
            onChange={(v) => {
              onChange({ ...value, recubrimiento: v, d: value.h - v });
            }}
            step={0.5}
            disabled={disabled}
          />
          <NumberField
            label="L luz"
            unit="cm"
            value={value.L_cm}
            onChange={(v) => set("L_cm", v)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Loads */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800 pb-1">
          Cargas
        </div>
        <div className="grid grid-cols-1 gap-2">
          <NumberField
            label="Mu negativo (gobierna flexion)"
            unit="ton-m"
            value={value.Mu_tonm}
            onChange={(v) => set("Mu_tonm", v)}
            step={0.1}
            disabled={disabled}
          />
          <NumberField
            label="Mu positivo"
            unit="ton-m"
            value={value.Mu_pos_tonm}
            onChange={(v) => set("Mu_pos_tonm", v)}
            step={0.1}
            disabled={disabled}
          />
          <NumberField
            label="Vu"
            unit="ton"
            value={value.Vu_ton}
            onChange={(v) => set("Vu_ton", v)}
            step={0.1}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
