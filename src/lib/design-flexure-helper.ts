/**
 * Internal helper — runs the beam flexure procedure but as a callable
 * function for use inside slab/footing/lintel designs. Re-exports
 * computeBeamFlexureLive so we keep one source of truth for flexure math.
 */
import { computeBeamFlexureLive } from "./beam-flexure-live";
import type { FlexureLiveResult } from "./beam-flexure-live";

export type { FlexureLiveResult };

export function designFlexure(args: {
  b: number;
  d: number;
  h: number;
  Mu_tonm: number;
  fc: number;
  fy: number;
}): FlexureLiveResult {
  return computeBeamFlexureLive({
    b: args.b,
    d: args.d,
    h: args.h,
    Mu_tonm: args.Mu_tonm,
    fc: args.fc,
    fy: args.fy,
  });
}
