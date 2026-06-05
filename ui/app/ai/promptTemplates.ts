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

/** Bump on any semantic change to buildCapabilityPrompt below.
 *  v3 (current): compact prompt — failed criteria inlined as a brief text
 *    table instead of a heavy JSON supplementary. Davis returned `status:
 *    FAILED` on the v2 supplementary-heavy form; v3 keeps total payload
 *    under ~1.5 KB and uses prose instead of nested JSON.
 *  v2: structured supplementary JSON + verbose prompt.
 *  v1: original generic prompt. */
export const PROMPT_VERSION = "v3";

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

/** Truncate long strings so the prompt body stays compact. */
function clamp(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Top-level prompt builder for a single capability.
 *
 *  v3 design: inline the failed-criteria table directly into the text body,
 *  no supplementary JSON. Smaller payload, simpler structure — Davis was
 *  returning status:FAILED on the heavier v2 form. */
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
        remediationHint: rem?.action ?? "(no static remediation registered)",
        docUrl: rem?.docUrl ?? "",
      };
    });

  // Sort: foundation first, then by gap descending (worst gap first within
  // each tier). Davis is asked to follow this ordering for the response.
  const tierRank = (t: string) => t === "foundation" ? 0 : t === "bestPractice" ? 1 : 2;
  failed.sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || b.gap - a.gap);

  // ── PROMPT TEXT (compact, inline criteria table) ────────────────────
  const criteriaLines = failed.map(f =>
    `- ${f.id} [${f.tier}] ${clamp(f.label, 60)} — ${f.currentValue}% (gap ${f.gap.toFixed(0)}pts vs ≥${f.passingThreshold}%). Hint: ${clamp(f.remediationHint, 140)}`
  ).join("\n");

  const text =
    `You are a senior Dynatrace SE. Analyse the failing criteria below ` +
    `for the "${cap.name}" capability (coverage ${cap.score}%, maturity ${cap.maturity.maturityScore}/100). ` +
    `Recommend 3 prioritized actions to lift the score.\n\n` +
    `Failing criteria (sorted by tier, then gap):\n${criteriaLines}\n\n` +
    `Rules for the 3 recommendations:\n` +
    `1. Foundation-tier failures first; highest-leverage action second; easiest enablement third.\n` +
    `2. Each action must cite the criterion IDs it addresses (e.g. "addresses i1, i4").\n` +
    `3. Quote the gap with exact numbers from the table above.\n` +
    `4. Refine the Hint into a concrete Dynatrace action — do NOT invent settings or URLs.\n` +
    `5. Predict the score lift if executed.\n` +
    `Do NOT restate the capability name, scores, or repeat the table.`;

  // No supplementary in v3 — everything is in `text`. Empty string is
  // safer than omitting the key because the SDK may treat undefined and
  // empty differently across versions.
  const supplementary = "";

  // ── INSTRUCTION (format) ────────────────────────────────────────────
  const instruction =
    `Format: three sections only — "## 1. <title>", "## 2. <title>", ` +
    `"## 3. <title>". Each followed by one short paragraph (3–5 sentences). ` +
    `Bold the lead action verb. No bullet lists, no code fences, no emoji, ` +
    `no external URLs. Total under 240 words.`;

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
