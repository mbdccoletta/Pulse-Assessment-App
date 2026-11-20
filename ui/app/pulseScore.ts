// ui/app/pulseScore.ts
//
// One score per capability, from three equal parts:
//   Coverage     — share of criteria met (is the data and practice there?)
//   Utilization  — depth across Foundation / Best practice / Excellence
//   Adoption     — share of active users who open the capability's apps,
//                  scaled so ADOPTION_FULL_RATE (20% of active users) = 100.
//
// ADOPTION_FULL_RATE is an app reference (the same cut the verdicts use for
// "high adoption"), not a Dynatrace rule. When adoption could not be measured
// the score is the average of the two parts that were.
//
// Rollback: PULSE_SCORE_PARTS = "coverage" restores the coverage-only score.

import type { CapabilityResult } from "./hooks/useCoverageData";

export const ADOPTION_FULL_RATE = 20;
export const PULSE_SCORE_PARTS: "three" | "coverage" = "three";

export function adoptionPoints(rate: number): number {
  return Math.min(100, Math.floor((rate / ADOPTION_FULL_RATE) * 100));
}

export interface AdoptionInput {
  /** False while loading or when the usage query was unavailable. */
  known: boolean;
  byCapability: Record<string, { rate: number }>;
}

/** Returns capabilities with `score` = the combined score; the parts stay on
 *  `coverageScore`, `effectiveUtilizationScore` and `adoptionScore`. */
export function withPulseScore(caps: CapabilityResult[], adoption: AdoptionInput): CapabilityResult[] {
  if (PULSE_SCORE_PARTS === "coverage") return caps;
  return caps.map(c => {
    const coverage = c.coverageScore ?? c.score;
    const parts = [coverage, c.effectiveUtilizationScore];
    let adoptionScore: number | null = null;
    let adoptionRate: number | null = null;
    if (adoption.known) {
      adoptionRate = adoption.byCapability[c.name]?.rate ?? 0;
      adoptionScore = adoptionPoints(adoptionRate);
      parts.push(adoptionScore);
    }
    const score = Math.floor(parts.reduce((s, v) => s + v, 0) / parts.length);
    return { ...c, score, coverageScore: coverage, adoptionScore, adoptionRate };
  });
}

/** Utilization as the scanner computes it: Best practice counts once Foundation
 *  is at 80%, Excellence once Best practice is at 60%. Weights 60 / 25 / 15. */
function utilizationOf(f: number, b: number, e: number): number {
  const effB = f >= 0.8 ? b : 0;
  const effE = effB >= 0.6 ? e : 0;
  return Math.floor(f * 60 + effB * 25 + effE * 15 + 1e-9);
}

/** Points the capability score gains if this one unmet criterion were met.
 *  Recomputes coverage and utilization with it passing; adoption is unchanged. */
export function gainIfMet(cap: CapabilityResult, tier: "foundation" | "bestPractice" | "excellence"): number {
  const u = cap.utilization;
  const frac = (t: { passed: number; total: number }, add: number) => (t.total > 0 ? Math.min(1, (t.passed + add) / t.total) : 0);
  const utilNow = utilizationOf(frac(u.foundation, 0), frac(u.bestPractice, 0), frac(u.excellence, 0));
  const utilThen = utilizationOf(
    frac(u.foundation, tier === "foundation" ? 1 : 0),
    frac(u.bestPractice, tier === "bestPractice" ? 1 : 0),
    frac(u.excellence, tier === "excellence" ? 1 : 0),
  );
  const coverageGain = cap.assessedCount > 0 ? 100 / cap.assessedCount : 0;
  const parts = PULSE_SCORE_PARTS === "coverage" ? 1 : cap.adoptionScore != null ? 3 : 2;
  const gain = PULSE_SCORE_PARTS === "coverage" ? coverageGain : (coverageGain + (utilThen - utilNow)) / parts;
  // Floored to one decimal: a gain is never shown larger than it is.
  return Math.max(0, Math.floor(gain * 10 + 1e-9) / 10);
}
