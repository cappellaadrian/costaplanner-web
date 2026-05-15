/**
 * Provenance + state color palette for Beam Studio.
 *
 * Every numeric value on the page is annotated with where it came from so an
 * engineer reviewing the report can trust each line. The colors are reused
 * across StepRenderer, VerificationPanel, and the input form.
 */

export type Provenance =
  | "input"      // user-typed input variable
  | "default"    // code-prescribed default (phi=0.90, etc.)
  | "computed"   // produced by a prior step
  | "result";    // the output of THIS step

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  input: "entrada",
  default: "default codigo",
  computed: "calculado",
  result: "resultado",
};

// Tailwind class fragments. We avoid arbitrary values so the JIT picks them up.
export const PROVENANCE_TEXT: Record<Provenance, string> = {
  input: "text-amber-300",
  default: "text-zinc-500 italic",
  computed: "text-zinc-200",
  result: "text-emerald-300 font-semibold",
};

export const PROVENANCE_BG: Record<Provenance, string> = {
  input: "bg-amber-500/10 border-amber-700/40",
  default: "bg-zinc-800/50 border-zinc-700/40",
  computed: "bg-zinc-900 border-zinc-800",
  result: "bg-emerald-500/10 border-emerald-700/40",
};

/** Variables that are always user inputs (top-of-form), never computed. */
export const INPUT_VARS = new Set<string>([
  "b", "d", "h", "Mu_tonm", "fc", "fy",
  // beam loads
  "CP", "CT", "fR", "f1",
  "Mu_neg", "Mu_pos", "Mu_neg_izq", "Mu_neg_der", "Mu_pos_izq", "Mu_pos_der",
  "Vu",
  // column/footing loads (future)
  "Pu_ton", "Mu_tonm_col",
]);

/** Variables that come from code defaults (constants prescribed by ACI/CSCR). */
export const DEFAULT_VARS = new Set<string>([
  "phi",     // 0.90 strength reduction factor
]);

export function classifyVar(varName: string): Provenance {
  if (INPUT_VARS.has(varName)) return "input";
  if (DEFAULT_VARS.has(varName)) return "default";
  return "computed";
}

/** Verification (check) state colors. */
export const CHECK_BADGE: Record<"ok" | "review" | "fail", string> = {
  ok: "bg-emerald-900/40 text-emerald-300 border border-emerald-800",
  review: "bg-amber-900/40 text-amber-300 border border-amber-800",
  fail: "bg-red-900/40 text-red-300 border border-red-800",
};
