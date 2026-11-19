// ui/app/ai/reportPrompt.ts
//
// The one prompt builder of the app: the assessment as context, the page's
// lens and computed facts (./pageIntelligence.ts), and the person's question.
// Used by the Intelligence bar on every page, the Smart report and the
// hand-off to Dynatrace Assist.
//
// Questions are phrased as questions: task-style prompts were rejected with
// GUARDRAIL_CHECK_FAILED.

import { DEFAULT_CUTS } from "../diagnosis";

/** Share of active users from which adoption counts as high (../diagnosis.ts). */
const HIGH_ADOPTION_RATE = DEFAULT_CUTS.adoptionRate;

/** Minimal capability shape the report builder needs. Both the live
 *  CapabilityResult and the lighter snapshot capability (Evolution page)
 *  satisfy this — utilization detail is optional and defaulted when absent. */
export interface ReportCapability {
  name: string;
  /** The score shown on screen (coverage, utilization and adoption combined). */
  score: number;
  coverageScore?: number;
  adoptionRate?: number | null;
  /** Adoption as scored and shown on screen (0-100). */
  adoptionScore?: number | null;
  criteriaResults: { id: string; label: string; value: number; points: number; error: boolean; /** Could not be measured: never a failure. */ notAssessed?: boolean }[];
  /** Utilization as shown on screen (after any consolidation factor). */
  effectiveUtilizationScore?: number;
  utilization?: {
    utilizationScore: number;
    levelLabel: string;
    foundation: { passed: number; total: number };
    bestPractice: { passed: number; total: number };
    excellence: { passed: number; total: number };
  };
}

/** Truncate long strings so the prompt body stays compact. */
function clamp(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Top-N worst-performing failed criteria for one capability — used to give
 *  Davis enough detail to be specific without flooding the prompt. */
function topFailing(cap: ReportCapability, n: number): { id: string; value: number; label: string }[] {
  return cap.criteriaResults
    .filter(cr => cr.points === 0 && !cr.error && !cr.notAssessed)
    .sort((a, b) => a.value - b.value)
    .slice(0, n)
    .map(cr => ({ id: cr.id, value: cr.value, label: cr.label }));
}

/** Input metadata for the report builder. */
export interface ReportContext {
  tenant: string;
  date: string;
  overallCoverage: number;
  overallUtilization: number;
  capabilities: ReportCapability[];
  /** Optional change context — e.g. a snapshot-to-snapshot delta summary
   *  from the Evolution page. When present it's appended so Davis can
   *  answer "what changed" questions. */
  comparisonNote?: string;
  /** Measured FinOps facts from Cost & Carbon Optimization (../finopsData.ts). */
  finopsNote?: string;
  /** What the current page shows, already computed (../ai/pageIntelligence.ts). */
  pageNote?: string;
  /** How the model must read the current page; prepended to the instruction. */
  lens?: string;
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
/**
 * Build the assessment context block — the full picture of the current run
 * (overall scores, per-capability detail, optional snapshot delta) in the
 * plain-English form Davis understands. Shared by:
 *   - buildReportPrompt (embedded chat, dev fallback)
 *   - assistIntent.ts   (native Dynatrace Assist conversation starters,
 *     where it becomes the hidden `supplementary` context — 100K char cap)
 */
export function buildAssessmentContext(ctx: ReportContext, weakest = 4): string {
  const page = ctx.pageNote ? `\n\n${clamp(ctx.pageNote, 6000)}` : "";
  // The Guide can be opened before any run: only the page facts exist then.
  if (ctx.capabilities.length === 0) return `No assessment has been run in this session yet.${page}`;
  const capLines = ctx.capabilities.map(cap => {
    // A criterion that could not be measured is not a failure and is never
    // reported as one: the screen says "Not assessed", and so does the prompt.
    const notAssessed = cap.criteriaResults.filter(cr => cr.notAssessed || cr.error).length;
    const failed = cap.criteriaResults.filter(cr => cr.points === 0 && !cr.error && !cr.notAssessed).length;
    const total = cap.criteriaResults.length - notAssessed;
    const na = notAssessed > 0 ? ` ${notAssessed} criteria could not be assessed in this environment and are not failures.` : "";
    const top = weakest > 0 ? topFailing(cap, weakest) : [];
    // Reference each failing check by its plain-English NAME only — never
    // the internal id (e.g. "i15"). The name is the ground truth and is the
    // only thing the reader understands; sending the id makes Davis echo a
    // cryptic code back.
    const topStr = top.length > 0
      ? ` Weakest checks: ${top.map(t => `"${t.label.replace(/\s*\(%\)\s*$/, "")}" at ${t.value}%`).join("; ")}.`
      : "";
    // Tier breakdown lets Davis answer utilization-aware questions ("which
    // Foundation gates are still closed?") without us pre-digesting it.
    // Snapshot capabilities (Evolution page) omit utilization detail — in that
    // case we report coverage + failing count only.
    const m = cap.utilization;
    if (m) {
      // Shares, floored like the screen: tallies ("2/13") invite the model to
      // quote counts as headlines and to derive percentages of its own.
      const pctOf = (t: { passed: number; total: number }) => (t.total > 0 ? Math.floor((t.passed / t.total) * 100) : 0);
      const tiers = `criteria met by tier: Foundation ${pctOf(m.foundation)}%, Best practice ${pctOf(m.bestPractice)}%, Excellence ${pctOf(m.excellence)}%`;
      const parts = `coverage ${cap.coverageScore ?? cap.score}%, utilization ${cap.effectiveUtilizationScore ?? m.utilizationScore}%` +
        // The score is what the screen shows; the share behind it is given once,
        // labelled, so the two are never confused (13% of users is a HIGH adoption).
        (cap.adoptionScore != null
          ? `, adoption ${cap.adoptionScore}%${cap.adoptionRate != null ? ` (from ${cap.adoptionRate}% of active users opening its apps, which is ${cap.adoptionRate >= HIGH_ADOPTION_RATE ? "HIGH" : "LOW"} adoption: high starts at ${HIGH_ADOPTION_RATE}%)` : ""}`
          : cap.adoptionRate != null ? `, adoption share ${cap.adoptionRate}% of active users` : ", adoption not measured");
      return `- ${cap.name}: score ${cap.score}% (${parts}), ${tiers}, ${failed} of ${total} assessed criteria not met.${na}${topStr}`;
    }
    return `- ${cap.name}: score ${cap.score}%, ${failed} of ${total} assessed criteria not met.${na}${topStr}`;
  }).join("\n");

  return (
    `I just ran a Dynatrace observability coverage assessment (Pulse ` +
    `Assessment app) for a customer, tenant ${ctx.tenant}, on ${ctx.date}. ` +
    `The overall score is ${ctx.overallCoverage}% and overall utilization is ` +
    `${ctx.overallUtilization}%. Each capability score is the average of ` +
    `three equal parts: coverage, utilization, and adoption (share of active ` +
    `users opening its apps, where 20% counts as full; when adoption could not ` +
    `be measured the score is the average of the other two). These are the numbers ` +
    `the user sees on screen — quote them exactly and never compute a ` +
    `percentage of your own. The capability scores are:\n${capLines}` +
    (ctx.comparisonNote
      ? `\nChange since the previous snapshot:\n${clamp(ctx.comparisonNote, 900)}`
      : "") +
    (ctx.finopsNote ? `\n\n${clamp(ctx.finopsNote, 2200)}` : "") +
    page
  );
}

/** Room for the question plus the context inside the request text. */
const TEXT_BUDGET = 9000;

/** Hard platform limit of the "instruction" context (HTTP 400 above it). */
export const INSTRUCTION_MAX = 2500;

/** The instruction every AI surface of the app sends: the page lens first,
 *  then the rules that keep the answer inside what was measured. */
export function buildInstruction(ctx: Pick<ReportContext, "lens">): string {
  const base =
    `Write like an experienced SE: clear, precise, plain markdown with ## headings, ` +
    `short paragraphs and bulleted or numbered lists. No tables, checkboxes, code ` +
    `fences or emoji. Write in the language of the request.\n\n` +
    `Naming: refer to every check by its plain-English name exactly as written in ` +
    `the context. Never use internal codes and never rename what a check measures.\n\n` +
    `Stay inside what was measured:\n` +
    `- The assessment measures how much of the Dynatrace platform is in use. It has ` +
    `no revenue, downtime cost or MTTR, and it has cloud cost ONLY if the context ` +
    `contains "FinOps data from Cost & Carbon Optimization" (then quote those ` +
    `figures as they are).\n` +
    `- If the request asks for something the data cannot answer, open with a short ` +
    `section "What this assessment can and cannot tell you", then answer with what ` +
    `the data supports.\n` +
    `- Every number you write must appear in the context. NEVER invent monetary ` +
    `amounts, savings, expected scores, targets, baselines, durations or ROI, not ` +
    `even as an illustration.\n` +
    `- Do not promise an outcome: say what a change makes visible or possible.\n\n` +
    `Recommendations:\n` +
    `- Tie each one to a check that is not met, quoting its name and current value.\n` +
    `- Name the capability, app or data field involved. Give a menu path only when ` +
    `the Dynatrace documentation states it; otherwise describe the goal. Do not ` +
    `invent features, settings or URLs, and do not name a product feature (such as Session Replay) that no check in the context measures.\n` +
    `- Order them by how directly they serve the request and say which are ` +
    `prerequisites.\n\n` +
    `Honor any length or format the request implies. Do not truncate.`;

  const lens = ctx.lens ? clamp(ctx.lens, INSTRUCTION_MAX - base.length - 2) + "\n\n" : "";
  return (lens + base).slice(0, INSTRUCTION_MAX);
}

export function buildReportPrompt(ctx: ReportContext, userPrompt: string): ReportPrompt {
  const cleanUserPrompt = clamp(userPrompt.trim(), 800);

  // v2 framing: put the user's question FIRST so Davis sees it as the
  // primary input, then offer the assessment data as supporting context.
  // The previous v1 wrapped the user prompt in quotes ("can you help me
  // with the following request: '...'") which tripped GUARDRAIL_CHECK
  // because Davis read it as a meta-task. Direct question works.
  // The service rejects a text that is too long (HTTP 400, "Constraints
  // violated", seen just above 10,000 characters). The page facts carry the
  // ranked criteria, so the per-capability "weakest checks" give way first.
  let context = buildAssessmentContext(ctx);
  for (const n of [2, 0]) {
    if (cleanUserPrompt.length + context.length <= TEXT_BUDGET) break;
    context = buildAssessmentContext(ctx, n);
  }
  if (cleanUserPrompt.length + context.length > TEXT_BUDGET) context = clamp(context, Math.max(1000, TEXT_BUDGET - cleanUserPrompt.length));
  const text =
    `${cleanUserPrompt}\n\n` +
    `Context: ${context}\n\n` +
    `Please ground your answer in this assessment data and in the Dynatrace ` +
    `documentation. When you mention a check, refer to it by the exact name ` +
    `shown above — never invent or rename what it measures, and never use an ` +
    `internal code.`;

  // No supplementary — everything in the question. Empty string ⇒ omitted
  // from the SDK context array by the caller.
  const supplementary = "";

  const instruction = buildInstruction(ctx);

  return { text, supplementary, instruction };
}
