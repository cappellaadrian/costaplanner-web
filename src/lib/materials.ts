/**
 * Shared bar-area / diameter / unit-weight tables and bar selection.
 * TS mirror of python_port/materials.py — keeps every element TS port in
 * lockstep with the Python canonical.
 */

const BAR_AREAS_CM2: Record<number, number> = {
  3: 0.71, 4: 1.27, 5: 1.99, 6: 2.84, 7: 3.87,
  8: 5.10, 9: 6.45, 10: 8.19, 11: 10.06, 14: 14.52, 18: 25.81,
};
const BAR_DIAMETERS_CM: Record<number, number> = {
  3: 0.953, 4: 1.27, 5: 1.588, 6: 1.905, 7: 2.222,
  8: 2.54, 9: 2.865, 10: 3.226, 11: 3.581, 14: 4.300, 18: 5.733,
};
const BAR_WEIGHT_KG_M: Record<number, number> = {
  3: 0.560, 4: 0.994, 5: 1.552, 6: 2.235, 7: 3.042,
  8: 3.973, 9: 5.060, 10: 6.404, 11: 7.907, 14: 11.380, 18: 20.240,
};

export function asBar(size: number): number {
  return BAR_AREAS_CM2[size] ?? 0;
}
export function dbBar(size: number): number {
  return BAR_DIAMETERS_CM[size] ?? 0;
}
export function unitWeight(size: number): number {
  return BAR_WEIGHT_KG_M[size] ?? 0;
}

/**
 * Pick the smallest bar size from the allowed list and the smallest count
 * that meets As_required. Returns (size, count, As_provided).
 */
export function selectBars(
  asReq: number,
  sizes: number[],
): { size: number; n: number; AsProv: number } {
  let best = { size: sizes[sizes.length - 1], n: 1, AsProv: asBar(sizes[sizes.length - 1]) };
  let bestExcess = Infinity;
  for (const s of sizes) {
    const ab = asBar(s);
    if (ab <= 0) continue;
    const n = Math.max(2, Math.ceil(asReq / ab));
    const provided = n * ab;
    const excess = provided - asReq;
    if (excess < bestExcess && excess >= 0) {
      best = { size: s, n, AsProv: provided };
      bestExcess = excess;
    }
  }
  return best;
}

export function beta1(fc: number): number {
  if (fc <= 280) return 0.85;
  if (fc >= 560) return 0.65;
  return 0.85 - (0.05 * (fc - 280)) / 70;
}

export const PHI_V = 0.75;
