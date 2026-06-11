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
    const top = topFailing(cap, 4);
    // CRITICAL: include the real LABEL for each failing criterion. Without
    // it, Davis only sees "i15 at 0%" and hallucinates the meaning (e.g.
    // calling i15 "network monitoring" when it's actually "Cloud region
    // enrichment"). The label is the criterion's ground truth.
    const topStr = top.length > 0
      ? ` Worst-performing failed criteria: ${top.map(t => `${t.id} "${clamp(t.label, 55)}" at ${t.value}%`).join("; ")}.`
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
    `documentation. When you mention a criterion, use the exact label shown ` +
    `next to its ID above — do not infer or rename what a criterion measures.`;

  // No supplementary — everything in the question. Empty string ⇒ omitted
  // from the SDK context array by the caller.
  const supplementary = "";

  const instruction =
    `Please reply in plain markdown with headings (## or ###) for major ` +
    `sections, short paragraphs, and lists where they aid scanning.\n\n` +
    `Accuracy rules (important):\n` +
    `- When you reference a criterion by ID, describe it using the EXACT ` +
    `label given next to that ID in the data. Never guess or invent what a ` +
    `criterion measures — if a label says "Cloud region enrichment", do not ` +
    `call it "network monitoring".\n` +
    `- Do not invent Dynatrace features, settings, or URLs. If you are not ` +
    `certain a setting exists, describe the goal instead of naming a fake control.\n\n` +
    `Make every recommendation concrete and illustrated:\n` +
    `- For each action, give a specific, real example of HOW to do it in ` +
    `Dynatrace — e.g. "In Settings > Cloud and virtualization > AWS, add the ` +
    `connection and enable supporting services so logs carry cloud.region", ` +
    `or "Add an OpenPipeline processor that extracts cloud.account.id from ` +
    `the log record". Name the actual UI path, integration, or attribute.\n` +
    `- State the expected outcome in numbers (e.g. "this should lift ` +
    `Infrastructure coverage by ~4 points and move it from L1 to L2").\n` +
    `- Prefer worked examples over abstract advice. The reader is an SE who ` +
    `wants to hand concrete steps to the customer's platform team.\n\n` +
    `Avoid code fences and emoji. Aim for a complete report — do not truncate. ` +
    `If the user's request implies a specific length or format (executive ` +
    `summary, talking points, action plan), honor that.`;

  return { text, supplementary, instruction };
}
