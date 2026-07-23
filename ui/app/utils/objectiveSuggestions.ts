// ui/app/utils/objectiveSuggestions.ts
//
// Deterministic small-objective suggestions derived from the assessment.
//
// The Objectives screen lets users define SMALL, achievable objectives
// grounded in real assessment data instead of blank-page prose. This
// module computes the suggestions — no LLM involved, pure data:
//
//   Quick win        failing checks with the smallest gap to passing
//   Foundation gate  capabilities closest to unlocking their Foundation
//                    tier (which gates the whole maturity formula)
//   Capability lift  the lowest-coverage capabilities, with a modest
//                    (+~10pt, rounded) target — never "get to 100%"
//
// Clicking a suggestion prefills the objective form; the user can edit
// before saving. The stored shape stays ObservabilityProject.

import type { CapabilityResult } from "../hooks/useCoverageData";

export interface ObjectiveSuggestion {
  category: "Quick win" | "Foundation gate" | "Capability lift";
  /** Prefill for the objective name field. */
  name: string;
  /** Prefill for the objective description — grounded with the numbers. */
  objective: string;
  /** One-line detail shown in the suggestion picker. */
  detail: string;
  capability: string;
}

/** Lowest numeric bar in the check's thresholds string ("≥90, ≥50, ≥1"). */
function lowestThreshold(thresholds: string): number {
  const nums = (thresholds.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  return nums.length ? Math.min(...nums) : 50;
}

const stripPct = (label: string) => label.replace(/\s*\(%\)\s*$/, "");

export function buildObjectiveSuggestions(caps: CapabilityResult[]): ObjectiveSuggestion[] {
  const out: ObjectiveSuggestion[] = [];
  if (caps.length === 0) return out;

  // ── Quick wins: smallest gap to passing across all failing checks ──
  const failing = caps.flatMap(cap =>
    cap.criteriaResults
      .filter(cr => cr.points === 0 && !cr.error)
      .map(cr => {
        const th = lowestThreshold(cr.thresholds);
        return {
          cap: cap.name,
          label: stripPct(cr.label),
          value: cr.value,
          th,
          gap: Math.max(0, th - cr.value),
        };
      }),
  ).sort((a, b) => a.gap - b.gap);

  for (const f of failing.slice(0, 5)) {
    out.push({
      category: "Quick win",
      capability: f.cap,
      name: `Fix: ${f.label}`,
      detail: `${f.cap} — at ${f.value}%, needs ≥${f.th}% (gap ${f.gap.toFixed(0)}pts)`,
      objective:
        `Pass the "${f.label}" check in ${f.cap}. It is currently at ${f.value}% ` +
        `and needs ≥${f.th}% — a gap of ${f.gap.toFixed(0)} points. Small, focused ` +
        `fix with immediate score impact.`,
    });
  }

  // ── Foundation gates: closest to unlocking, max 3 ──
  const gates = caps
    .filter(cap => cap.maturity.foundation.passed < cap.maturity.foundation.total)
    .map(cap => ({
      cap,
      missing: cap.criteriaResults
        .filter(cr => cr.tier === "foundation" && cr.points === 0 && !cr.error)
        .map(cr => stripPct(cr.label)),
    }))
    .filter(g => g.missing.length > 0)
    .sort((a, b) => a.missing.length - b.missing.length)
    .slice(0, 3);

  for (const g of gates) {
    const f = g.cap.maturity.foundation;
    out.push({
      category: "Foundation gate",
      capability: g.cap.name,
      name: `Unlock Foundation: ${g.cap.name}`,
      detail: `${f.passed}/${f.total} Foundation checks passing — caps maturity progression`,
      objective:
        `Close the failing Foundation check${g.missing.length > 1 ? "s" : ""} in ` +
        `${g.cap.name} (${g.missing.join(", ")}). Foundation gates the maturity ` +
        `formula — Best Practice and Excellence only count once it is solid.`,
    });
  }

  // ── Capability lifts: two lowest by coverage, modest +10pt target ──
  const lifts = [...caps].sort((a, b) => a.score - b.score).slice(0, 2);
  for (const cap of lifts) {
    if (cap.score >= 90) continue;
    const target = Math.min(100, Math.ceil((cap.score + 10) / 5) * 5);
    out.push({
      category: "Capability lift",
      capability: cap.name,
      name: `Lift ${cap.name} to ${target}%`,
      detail: `currently ${cap.score}% coverage · maturity ${cap.maturity.maturityScore}/100`,
      objective:
        `Raise ${cap.name} coverage from ${cap.score}% to ${target}% by closing ` +
        `its smallest-gap failing checks first. Keep scope small — one batch of ` +
        `related checks at a time, not the whole capability at once.`,
    });
  }

  return out;
}
