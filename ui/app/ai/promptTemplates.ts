// ui/app/ai/promptTemplates.ts
//
// Versioned prompt templates for Davis CoPilot recommendations.
//
// Why versioned ──────────────────────────────────────────────────────────
// The cache key for AI responses includes PROMPT_VERSION. Bumping the
// constant invalidates every cached response, forcing the next run to
// regenerate against the new prompt. Without this, an edit to the prompt
// would silently return stale answers from the cache.
//
// Bump PROMPT_VERSION whenever you change buildCapabilityPrompt() in any
// way that should produce a different response. Pure formatting changes
// (whitespace, comments) do not need a bump.

import type { CapabilityResult } from "../hooks/useCoverageData";

/** Bump on any semantic change to buildCapabilityPrompt below. */
export const PROMPT_VERSION = "v1";

/** Shape of the criterion data we feed to the model. Kept minimal to keep
 *  the prompt short and the inputs anonymizable — no host IDs, no IPs. */
interface FailedCriterionInput {
  id: string;
  label: string;
  value: number;          // observed coverage %
  threshold: string;      // e.g. "≥90, ≥50, ≥1"
  tier: "foundation" | "bestPractice" | "excellence";
}

/** Top-level prompt builder for a single capability.
 *
 *  Output text is fed verbatim into ConversationRequest.text. The model
 *  is also given a separate `supplementary` context with the same data as
 *  JSON, so it can reason structurally rather than just from prose. */
export function buildCapabilityPrompt(cap: CapabilityResult): {
  text: string;
  supplementary: string;
  instruction: string;
} {
  const failed: FailedCriterionInput[] = cap.criteriaResults
    .filter(cr => cr.points === 0 && !cr.error)
    .map(cr => ({
      id: cr.id,
      label: cr.label,
      value: cr.value,
      threshold: cr.thresholds,
      tier: cr.tier,
    }));

  const text =
    `The customer's "${cap.name}" capability scored ${cap.score}% (coverage) ` +
    `and ${cap.maturity.maturityScore}/100 (maturity, band ${cap.maturity.maturityBand}). ` +
    `${failed.length} of ${cap.criteriaResults.length} criteria are below threshold. ` +
    `Produce 3 prioritized recommendations to lift this capability's score, ordered by ` +
    `(1) Foundation-tier failures first since they gate Best Practice and Excellence in our ` +
    `Maturity formula, (2) highest customer impact next, (3) easiest enablement last. ` +
    `For each: state the concrete action, where to enable it in the Dynatrace platform, ` +
    `and the expected lift in capability score. Total response under 220 words. ` +
    `Use plain markdown, no emoji, no code fences.`;

  const supplementary = JSON.stringify({
    capability: cap.name,
    coverageScore: cap.score,
    maturityScore: cap.maturity.maturityScore,
    maturityBand: cap.maturity.maturityBand,
    maturityLevel: cap.maturity.level,
    maturityLevelLabel: cap.maturity.levelLabel,
    tierBreakdown: {
      foundation: cap.maturity.foundation,
      bestPractice: cap.maturity.bestPractice,
      excellence: cap.maturity.excellence,
    },
    failedCriteria: failed,
  }, null, 2);

  const instruction =
    `Use 3 numbered markdown headings ("1. ...", "2. ...", "3. ..."), each followed by ` +
    `one short paragraph. No preamble, no closing summary. The capability name and score ` +
    `are already known to the user — do not restate them.`;

  return { text, supplementary, instruction };
}

/** Build a signature of the failed-criteria set. Same signature → same
 *  recommendations should be returned, so this is the cache key salt.
 *
 *  We deliberately ignore exact values and use only id+passed/failed status,
 *  so a customer who moves a single criterion from 49% to 51% (still failing
 *  the ≥50 threshold) does not invalidate the cache. */
export function failureSignature(cap: CapabilityResult): string {
  const ids = cap.criteriaResults
    .filter(cr => cr.points === 0 && !cr.error)
    .map(cr => cr.id)
    .sort()
    .join(",");
  return `${PROMPT_VERSION}:${cap.name}:${ids}`;
}
