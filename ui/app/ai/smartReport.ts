// ui/app/ai/smartReport.ts
//
// Smart Report — dynamic, intelligent reports generated from a free-text
// user request via Davis CoPilot (Dynatrace Assist).
//
// Two delivery paths, both fed by the SAME guardrail-safe prompt builder
// (../ai/reportPrompt.ts — question-form, plain check names, no internal
// codes):
//   1. Open in Assist  — native intent to the Dynatrace Assist app
//      (handled by ../ai/assistIntent.ts at the call site).
//   2. Generate PDF    — this module calls the Davis CoPilot SDK directly,
//      returns the markdown answer, and the caller renders it through
//      ../reports/aiNarrativePdf.ts into the app's PDF shell.
//
// DEV ONLY: like every Davis surface in this app, Smart Reports are gated
// in production since v2.5.6; the call only happens on explicit submit.

import { publicClient } from "@dynatrace-sdk/client-davis-copilot";
import { buildReportPrompt, type ReportContext } from "./reportPrompt";
import { classifyError, type DavisError } from "./davisError";

export type SmartReportResult =
  | { ok: true; markdown: string }
  | { ok: false; err: DavisError };

/** Question-form starters — imperative phrasing trips GUARDRAIL_CHECK. */
export const SMART_REPORT_SUGGESTIONS: { label: string; ask: string }[] = [
  {
    label: "Board briefing",
    ask: "What would a board-level briefing of our observability posture look like: where we are strong, where the exposure is according to the unmet criteria, and one clear ask at the end?",
  },
  {
    label: "Team plan",
    ask: "How should each team act on this assessment? Which capability does each stream of work belong to, in what order, and what does each change make visible or possible?",
  },
  {
    label: "Risk narrative",
    ask: "Which gaps in this assessment expose us to the most operational risk, and what is the story behind each one — what could go wrong, and how would we notice today?",
  },
  {
    label: "Value story",
    ask: "How do I present the value we already get from Dynatrace to leadership, using the strongest capabilities in this assessment as evidence?",
  },
];

/**
 * Ask Davis CoPilot for a report-shaped markdown answer grounded in the
 * assessment. One call, no cache — smart reports are request-specific.
 */
export async function generateSmartReportText(
  ctx: ReportContext,
  userAsk: string,
): Promise<SmartReportResult> {
  const { text, instruction } = buildReportPrompt(ctx, userAsk);
  try {
    const resp = await publicClient.recommenderConversation({
      body: {
        text,
        context: [
          { type: "instruction", value: instruction },
          { type: "document-retrieval", value: "dynatrace" },
        ],
        annotations: {
          origin_app: "my.pulse.assessment",
          prompt_version: "smart-report-v2",
        },
      },
    });

    if (Array.isArray(resp)) {
      return { ok: false, err: { status: 0, message: "Unexpected event-stream response", hint: "Davis returned a streaming response when JSON was expected." } };
    }
    if (!resp || resp.status === "FAILED" || !resp.text) {
      const metaSummary = resp?.metadata ? ` Metadata: ${JSON.stringify(resp.metadata).slice(0, 200)}` : "";
      return {
        ok: false,
        err: {
          status: 0,
          message: `Response status: ${resp?.status ?? "empty"}.${metaSummary}`,
          hint: "Davis processed the request but produced no usable answer. Rephrase the request as a question (What/How/Which) and try again.",
        },
      };
    }
    return { ok: true, markdown: resp.text };
  } catch (err) {
    return { ok: false, err: classifyError(err) };
  }
}
