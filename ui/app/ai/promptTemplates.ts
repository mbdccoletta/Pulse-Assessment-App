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
import { CRITERION_ACTIONS } from "../remediationActions";

/** Bump on any semantic change to buildCapabilityPrompt below. */
export const PROMPT_VERSION = "v2";

/** Shape of the criterion data we feed to the model. Kept minimal but rich
 *  enough that Davis can write a specific, data-grounded recommendation
 *  instead of a generic "enable X" line. */
interface FailedCriterionInput {
  /** Stable ID like "i1", "a5" — Davis is told to cite these in its reply. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Full description of what the criterion measures (taken from queries.ts).
   *  This is what lets Davis say "this measures host CPU coverage from
   *  OneAgent OR cloud integration" instead of guessing. */
  description: string;
  /** Observed value (0-100%). */
  currentValue: number;
  /** Lowest threshold that would have passed this criterion (so Davis can
   *  state the gap exactly). */
  passingThreshold: number;
  /** Gap to passing = passingThreshold - currentValue (clamped at 0). */
  gap: number;
  /** Tier label so Davis can prioritise foundation issues. */
  tier: "foundation" | "bestPractice" | "excellence";
  /** Static remediation hint from CRITERION_ACTIONS — the SE-curated
   *  baseline that Davis is allowed to refine, not invent from scratch. */
  remediationHint: string;
  /** Dynatrace doc URL paired with the hint. Davis may cite this in its
   *  reply but is told NOT to invent new URLs. */
  docUrl: string;
}

/** Parse the threshold string (e.g. "≥90, ≥50, ≥1") and return the LOWEST
 *  threshold — that's the bar we need to cross for points=1. */
function lowestThreshold(thresholds: string): number {
  // Format from useCoverageData.ts:
  //   thresholds.sort((a,b) => b.min - a.min).map(t => `≥${t.min}`).join(", ")
  // → "≥90, ≥50, ≥1" (descending). Lowest is the LAST one.
  const matches = thresholds.match(/(\d+(?:\.\d+)?)/g);
  if (!matches || matches.length === 0) return 50; // safe default
  const nums = matches.map(s => parseFloat(s));
  return Math.min(...nums);
}

/** Top-level prompt builder for a single capability.
 *
 *  Output: text + supplementary + instruction. The text is the question;
 *  the supplementary is the structured JSON Davis reasons over; the
 *  instruction shapes the response format. */
export function buildCapabilityPrompt(cap: CapabilityResult): {
  text: string;
  supplementary: string;
  instruction: string;
} {
  // Build the per-criterion record set.
  const failed: FailedCriterionInput[] = cap.criteriaResults
    .filter(cr => cr.points === 0 && !cr.error)
    .map(cr => {
      const passingThreshold = lowestThreshold(cr.thresholds);
      const gap = Math.max(0, passingThreshold - cr.value);
      const rem = CRITERION_ACTIONS[cr.id];
      return {
        id: cr.id,
        label: cr.label,
        description: cr.description,
        currentValue: cr.value,
        passingThreshold,
        gap,
        tier: cr.tier,
        remediationHint: rem?.action ?? "(no static remediation registered for this criterion)",
        docUrl: rem?.docUrl ?? "",
      };
    });

  // Compute aggregates Davis should use to scope effort.
  const foundationFailing = failed.filter(f => f.tier === "foundation").length;
  const bpFailing = failed.filter(f => f.tier === "bestPractice").length;
  const excellenceFailing = failed.filter(f => f.tier === "excellence").length;
  const biggestGap = failed.reduce((max, f) => f.gap > max ? f.gap : max, 0);

  // ── PROMPT TEXT ─────────────────────────────────────────────────────
  // The text is what the model "reads first". Keep it focused on the
  // analytical task. The structured data lives in `supplementary` so the
  // model can quote exact numbers from it.
  const text =
    `You are a senior Dynatrace Solutions Engineer reviewing an observability ` +
    `coverage assessment for a customer. Analyse the deficiencies in the ` +
    `"${cap.name}" capability and recommend the next 3 concrete actions to ` +
    `lift this score, ordered by impact.\n\n` +

    `Current state:\n` +
    `- Coverage score: ${cap.score}/100 (band ${cap.maturity.maturityBand})\n` +
    `- Maturity score: ${cap.maturity.maturityScore}/100 (level ${cap.maturity.levelLabel})\n` +
    `- Failed criteria: ${failed.length} of ${cap.criteriaResults.length}\n` +
    `  • Foundation tier: ${foundationFailing} failing\n` +
    `  • Best Practice tier: ${bpFailing} failing\n` +
    `  • Excellence tier: ${excellenceFailing} failing\n` +
    `- Largest single-criterion gap: ${biggestGap.toFixed(1)} points below passing threshold\n\n` +

    `Failed criteria with observed gaps are in the supplementary JSON. ` +
    `Each entry has: id, label, description, currentValue (%), passingThreshold (%), ` +
    `gap (points below threshold), tier, and a static remediationHint that the SE ` +
    `team curated as the baseline action.\n\n` +

    `Your task:\n` +
    `For each of the 3 recommendations:\n` +
    `1. Cite the specific criterion IDs it addresses (e.g. "i1, i4, i7").\n` +
    `2. Quote the observed gap with exact numbers from the data ` +
    `("Host CPU coverage is 32% against a 50% threshold — gap of 18 points").\n` +
    `3. Name the precise Dynatrace feature, integration, or setting to enable ` +
    `(use the remediationHint as your starting point and refine it for the ` +
    `customer's situation).\n` +
    `4. Predict the score lift IF executed (e.g. "would lift coverage by ` +
    `roughly +13 points").\n\n` +

    `Ordering rules (strict):\n` +
    `1. Foundation-tier failures FIRST — they gate Best Practice and Excellence ` +
    `in the Maturity formula. Even one Foundation failure caps Maturity at L1.\n` +
    `2. Highest-leverage action SECOND — prefer one action that unblocks ` +
    `multiple criteria over one that fixes only one.\n` +
    `3. Easiest enablement THIRD — toggle in UI > deploy OneAgent > multi-step ` +
    `cloud integration. Smaller effort = faster win for the customer.\n\n` +

    `Hard constraints:\n` +
    `- Do NOT invent Dynatrace features, settings, or URLs. If unsure, use the ` +
    `remediationHint as-is.\n` +
    `- Do NOT restate the capability name or scores in your reply — the user ` +
    `already sees them.\n` +
    `- Do NOT add a preamble or a closing summary.\n` +
    `- Total response under 280 words.`;

  // ── SUPPLEMENTARY (structured) ──────────────────────────────────────
  const supplementary = JSON.stringify({
    capability: cap.name,
    coverageScore: cap.score,
    maturityScore: cap.maturity.maturityScore,
    maturityBand: cap.maturity.maturityBand,
    maturityLevel: cap.maturity.level,
    maturityLevelLabel: cap.maturity.levelLabel,
    tierBreakdown: {
      foundation:   { passed: cap.maturity.foundation.passed,   total: cap.maturity.foundation.total },
      bestPractice: { passed: cap.maturity.bestPractice.passed, total: cap.maturity.bestPractice.total },
      excellence:   { passed: cap.maturity.excellence.passed,   total: cap.maturity.excellence.total },
    },
    failedCriteria: failed,
  }, null, 2);

  // ── INSTRUCTION (format) ────────────────────────────────────────────
  const instruction =
    `Output format (strict):\n` +
    `Three sections only. Each starts with a numbered markdown heading ` +
    `("## 1. <title>", "## 2. <title>", "## 3. <title>"). ` +
    `Under each heading, write ONE short paragraph (3–5 sentences) covering ` +
    `the action, the criterion IDs addressed, the observed gap, and the ` +
    `expected score lift. ` +
    `Use **bold** for the action verb at the start of each paragraph. ` +
    `Do NOT use bullet lists, code fences, emoji, or external URLs.`;

  return { text, supplementary, instruction };
}

/** Instruction passed alongside follow-up turns. Davis already has the full
 *  conversation history via `state`, so we just need to enforce concise
 *  output and the same no-invention rule. */
export function buildFollowUpInstruction(): string {
  return (
    `You are continuing a conversation about a Dynatrace coverage ` +
    `assessment. Answer the user's follow-up question concisely. ` +
    `Hard constraints:\n` +
    `- Do NOT invent Dynatrace features, settings, or URLs.\n` +
    `- Stay grounded in the prior context (the capability, its failed ` +
    `criteria, the SE-curated remediationHints, and the Dynatrace docs).\n` +
    `- Plain markdown only — short paragraphs, optional ordered list. ` +
    `No code fences, no emoji, no preamble like "Sure, here is...".\n` +
    `- Total reply under 150 words unless the user explicitly asks for ` +
    `more detail.`
  );
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
