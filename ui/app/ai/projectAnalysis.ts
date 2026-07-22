// ui/app/ai/projectAnalysis.ts
//
// Davis analysis of a customer-declared observability project.
//
// Given a project (name + objective) and the current assessment context,
// asks Davis: which of the nine Pulse capabilities serve this objective,
// and what execution plan should the customer follow? The response text is
// stored on the project card; capability names detected in the text become
// coloured chips.
//
// Uses the embedded conversation skill (publicClient.recommenderConversation)
// rather than a native intent because we need the RESULT back in the app to
// persist on the card. Deeper conversations and deliverable generation then
// happen in the native Dynatrace Assist (see ProjectsPage deliverable
// starters). Prompt is question-form to pass the guardrail (v4+ lesson).

import { publicClient } from "@dynatrace-sdk/client-davis-copilot";
import { CAPABILITIES } from "../queries";
import { buildAssessmentContext, type ReportContext } from "./reportPrompt";
import type { ObservabilityProject } from "../hooks/useProjects";
import type { DavisError } from "./davisRecommendations";

export type ProjectAnalysisResult =
  | { ok: true; text: string; capabilities: string[] }
  | { ok: false; err: DavisError };

const CAP_NAMES = CAPABILITIES.map(c => c.name);

/** Find which of the 9 capability names Davis mentioned in its answer.
 *  Deterministic string match against our own list — no parsing of model
 *  structure required, so format drift can't break the chips. */
export function detectCapabilities(text: string): string[] {
  const lower = text.toLowerCase();
  return CAP_NAMES.filter(name => lower.includes(name.toLowerCase()));
}

function classifyError(err: unknown): DavisError {
  const e = err as {
    response?: { status?: number };
    body?: { error?: { message?: string }; message?: string };
    message?: string;
  };
  const status = e?.response?.status ?? 0;
  const message = (e?.body?.error?.message ?? e?.body?.message ?? e?.message ?? String(err)).slice(0, 240);
  let hint: string;
  switch (status) {
    case 401: hint = "Unauthorized. Sign out and back in."; break;
    case 403: hint = "Forbidden. The OAuth token is missing davis-copilot:conversations:execute."; break;
    case 404: hint = "Davis CoPilot may not be enabled on this tenant."; break;
    case 429: hint = "Rate-limited (25 questions/user/15min). Wait a few minutes."; break;
    case 0:   hint = "Network error or empty response. Try again."; break;
    default:  hint = `Unexpected error (HTTP ${status}).`;
  }
  return { status, message, hint };
}

/**
 * One-shot Davis call: map capabilities + propose an execution plan for the
 * declared project, grounded in the live assessment gaps. Not cached —
 * analysis is user-triggered per project (Analyze / Re-analyze buttons).
 */
export async function analyzeProject(
  project: ObservabilityProject,
  ctx: ReportContext,
): Promise<ProjectAnalysisResult> {
  const meta =
    (project.team
      ? ` Owning team: ${project.team}${project.teamIdentifier ? ` (Dynatrace Ownership identifier "${project.teamIdentifier}", used in dt.owner tags)` : ""}.`
      : "") +
    (project.targetDate ? ` Target date: ${project.targetDate}.` : "");

  const text =
    `My customer declared an internal observability project. ` +
    `Project name: "${project.name}". Objective: ${project.objective.slice(0, 1200)}.${meta}\n\n` +
    `Which of these nine Dynatrace Pulse capabilities are most relevant to this ` +
    `project, and what execution plan should the customer follow to achieve the ` +
    `objective? The capabilities are: ${CAP_NAMES.join(", ")}.\n\n` +
    `Could you structure the answer like this: first a line starting with ` +
    `"Relevant capabilities:" listing the exact names of the relevant ones; then ` +
    `a short explanation of why each matters for this objective; then a phased ` +
    `execution plan (first 30 days, 60 days, 90 days) grounded in the current ` +
    `assessment gaps below — naming the specific checks to fix and the concrete ` +
    `Dynatrace actions; and finally the quick wins the team can capture ` +
    `immediately?\n\n` +
    `Context: ${buildAssessmentContext(ctx)}\n\n` +
    `Please refer to every check by its plain-English name exactly as given — ` +
    `never internal codes.`;

  const instruction =
    "Write in a clear, friendly, professional tone, like an experienced " +
    "Dynatrace SE building a project plan with a customer. Plain markdown: " +
    "headings for the phases, short paragraphs, lists where useful. Refer to " +
    "assessment checks by their plain-English names only — never internal " +
    "codes like i15. Be concrete: name actual Dynatrace settings, " +
    "integrations, or attributes; do not invent features or URLs. Keep the " +
    "total under 450 words.";

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
          request_type: "project_analysis",
        },
      },
    });

    if (Array.isArray(resp) || !resp || resp.status === "FAILED" || !resp.text) {
      const metaSummary = !Array.isArray(resp) && resp?.metadata
        ? ` Metadata: ${JSON.stringify(resp.metadata).slice(0, 200)}`
        : "";
      return {
        ok: false,
        err: {
          status: 0,
          message: `Response status: ${Array.isArray(resp) ? "stream" : resp?.status ?? "empty"}.${metaSummary}`,
          hint: "Davis produced no usable answer. Try rephrasing the project objective more concretely.",
        },
      };
    }

    return { ok: true, text: resp.text, capabilities: detectCapabilities(resp.text) };
  } catch (err) {
    const classified = classifyError(err);
    // eslint-disable-next-line no-console
    console.warn(`[projectAnalysis] failed for "${project.name}":`, classified, err);
    return { ok: false, err: classified };
  }
}
