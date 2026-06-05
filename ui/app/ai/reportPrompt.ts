// ui/app/ai/reportPrompt.ts
//
// Prompt builder for the full-assessment AI Report (Davis-generated).
//
// Different from promptTemplates.ts which is per-capability. This one
// feeds Davis the whole assessment (all 9 capabilities + scores +
// failing-criteria summary) plus the SE's free-form question, so Davis
// can produce a tailored report — executive summary, QBR talking points,
// technical action plan, customer letter, etc.
//
// Same Q&A natural-language framing as promptTemplates v4 to avoid the
// GUARDRAIL_CHECK_FAILED rejection seen on task-style prompts.

import type { CapabilityResult } from "../hooks/useCoverageData";

/** Truncate long strings so the prompt body stays compact. */
function clamp(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Top-N worst-performing failed criteria for one capability — used to give
 *  Davis enough detail to be specific without flooding the prompt. */
function topFailing(cap: CapabilityResult, n: number): { id: string; value: number; label: string }[] {
  return cap.criteriaResults
    .filter(cr => cr.points === 0 && !cr.error)
    .sort((a, b) => a.value - b.value)
    .slice(0, n)
    .map(cr => ({ id: cr.id, value: cr.value, label: cr.label }));
}

/** Input metadata for the report builder. */
export interface ReportContext {
  tenant: string;
  date: string;
  overallCoverage: number;
  overallMaturity: number;
  capabilities: CapabilityResult[];
}

/** Output of the prompt builder — same triple as the per-capability one. */
export interface ReportPrompt {
  text: string;
  supplementary: string;
  instruction: string;
}

/**
 * Build the full-assessment prompt.
 *
 * @param ctx   tenant/date/scores + capabilities
 * @param userPrompt the free-form question the SE typed in the modal —
 *                   appended at the end as "Please …" so Davis treats it
 *                   as the explicit request.
 */
export function buildReportPrompt(ctx: ReportContext, userPrompt: string): ReportPrompt {
  const capLines = ctx.capabilities.map(cap => {
    const failed = cap.criteriaResults.filter(cr => cr.points === 0 && !cr.error).length;
    const total = cap.criteriaResults.length;
    const top = topFailing(cap, 3);
    const topStr = top.length > 0
      ? ` Worst-performing failed criteria: ${top.map(t => `${t.id} at ${t.value}%`).join(", ")}.`
      : "";
    // Tier breakdown lets Davis answer maturity-aware questions ("which
    // Foundation gates are still closed?") without us pre-digesting it.
    const f = cap.maturity.foundation;
    const b = cap.maturity.bestPractice;
    const e = cap.maturity.excellence;
    const tiers = `tiers F=${f.passed}/${f.total}, BP=${b.passed}/${b.total}, E=${e.passed}/${e.total}`;
    return `- ${cap.name}: coverage ${cap.score}%, maturity ${cap.maturity.maturityScore}/100 (${cap.maturity.levelLabel}), ${tiers}, ${failed}/${total} criteria failing.${topStr}`;
  }).join("\n");

  const cleanUserPrompt = clamp(userPrompt.trim(), 800);

  // v2 framing: put the user's question FIRST so Davis sees it as the
  // primary input, then offer the assessment data as supporting context.
  // The previous v1 wrapped the user prompt in quotes ("can you help me
  // with the following request: '...'") which tripped GUARDRAIL_CHECK
  // because Davis read it as a meta-task. Direct question works.
  const text =
    `${cleanUserPrompt}\n\n` +
    `Context: I just ran a Dynatrace coverage assessment for a customer ` +
    `(tenant ${ctx.tenant}). Overall coverage is ${ctx.overallCoverage}% ` +
    `and overall maturity is ${ctx.overallMaturity}/100. The 9 capability ` +
    `scores are:\n${capLines}\n\n` +
    `Please ground your answer in this assessment data and in the Dynatrace ` +
    `documentation.`;

  // No supplementary — everything in the question. Empty string ⇒ omitted
  // from the SDK context array by the caller.
  const supplementary = "";

  const instruction =
    `Please reply in plain markdown with headings (## or ###) for major ` +
    `sections, short paragraphs, and optional ordered or unordered lists ` +
    `where they aid scanning. Cite specific capability names and criterion ` +
    `IDs from the data above when relevant. Avoid code blocks, emoji, and ` +
    `links to external sites. Aim for a complete, useful report — do not ` +
    `truncate. If the user's request implies a specific length or format ` +
    `(executive summary, slide bullets, customer letter), honor that.`;

  return { text, supplementary, instruction };
}
