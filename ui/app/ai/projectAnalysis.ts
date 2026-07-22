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
  | { ok: true; text: string; capabilities: string[]; teams: string[] }
  | { ok: false; err: DavisError };

const CAP_NAMES = CAPABILITIES.map(c => c.name);

/** Find which of the 9 capability names Davis mentioned in its answer.
 *  Deterministic string match against our own list — no parsing of model
 *  structure required, so format drift can't break the chips. */
export function detectCapabilities(text: string): string[] {
  const lower = text.toLowerCase();
  return CAP_NAMES.filter(name => lower.includes(name.toLowerCase()));
}

/** Same deterministic trick for teams: which of the tenant's OFFICIAL
 *  Ownership team names did Davis mention in the plan? */
export function detectTeams(text: string, officialTeamNames: string[]): string[] {
  const lower = text.toLowerCase();
  return officialTeamNames.filter(name => name && lower.includes(name.toLowerCase()));
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
  /** Official Ownership team names — when provided, Davis is asked which
   *  of them should be involved, and mentions are detected for the card. */
  officialTeamNames: string[] = [],
  /** Discovered ownership matrix (dt.owner sweep) as plain English — which
   *  team owns how many components per capability. Grounds the involved-
   *  teams answer in real data instead of inference. */
  ownershipSummary = "",
): Promise<ProjectAnalysisResult> {
  const meta =
    (project.team
      ? ` Owning team: ${project.team}${project.teamIdentifier ? ` (Dynatrace Ownership identifier "${project.teamIdentifier}", used in dt.owner tags)` : ""}.`
      : "") +
    (project.segmentName
      ? ` The project is identified by the platform Segment "${project.segmentName}" — scope recommendations and any suggested views or queries to that segment where it helps.`
      : "") +
    (project.targetDate ? ` Target date: ${project.targetDate}.` : "");

  const text =
    `My customer declared an internal project with a business objective. ` +
    `Project name: "${project.name}". Objective: ${project.objective.slice(0, 1200)}.${meta}\n\n` +
    `Which of these nine Dynatrace Pulse capabilities are most relevant to this ` +
    `project, and what execution plan should the customer follow to ACHIEVE THE ` +
    `OBJECTIVE ITSELF? The capabilities are: ${CAP_NAMES.join(", ")}.\n\n` +
    `Important framing: the deliverable of this plan is the customer's business ` +
    `outcome (for example: cloud cost actually reduced, MTTR actually lowered, ` +
    `the audit actually passed) — NOT an improvement of assessment scores or a ` +
    `list of Dynatrace configurations. Use the assessment data in two ways: ` +
    `(1) capabilities that are already strong are TOOLS — say concretely how to ` +
    `use the data they already collect to deliver the objective now (for a ` +
    `cost-reduction objective that means things like: use utilization metrics ` +
    `and Davis forecasts to find idle or over-provisioned hosts and rightsize ` +
    `or decommission them, tune Kubernetes requests/limits, reduce log ` +
    `ingestion waste, identify workloads for commitment discounts); ` +
    `(2) recommend fixing an assessment check ONLY when that specific gap ` +
    `genuinely blocks the objective, and state what decision it unblocks.\n\n` +
    (officialTeamNames.length > 0
      ? `The customer's teams (Dynatrace Ownership) are: ${officialTeamNames.join(", ")}. ` +
        `Which of these teams should be involved in executing the plan?\n\n`
      : "") +
    (ownershipSummary
      ? `Component ownership discovered from dt.owner tags (real data — use it to ` +
        `decide which teams must be involved and where):\n${ownershipSummary.slice(0, 4000)}\n\n`
      : "") +
    `Could you structure the answer like this: first a line starting with ` +
    `"Relevant capabilities:" listing the exact names of the relevant ones; ` +
    (officialTeamNames.length > 0
      ? `then a line starting with "Involved teams:" listing the exact team names; `
      : "") +
    `then a short explanation of why each matters for this objective; then a ` +
    `realistic, detailed execution plan on a WEEK-BY-WEEK timeline (Weeks 1-2, ` +
    `3-4, 5-8, 9-12) where every block is defined by outcomes toward the ` +
    `objective — observability enablement only as a supporting step, never the ` +
    `goal — and each block has 1-2 SMALL, ACHIEVABLE milestones. For EACH ` +
    `milestone give: the owning team; the concrete steps including WHERE in ` +
    `Dynatrace the work happens (which app or view — e.g. Hosts, Kubernetes, ` +
    `Notebooks with a DQL over utilization metrics, Davis forecast — and what ` +
    `to look at); dependencies and approvals needed before acting (change ` +
    `windows, sign-off to decommission); a clear definition of done; and a ` +
    `CONSERVATIVE numeric target with the assumption behind it stated (e.g. ` +
    `"assuming ~30% of pilot instances show <20% utilization, expect 5-8% ` +
    `savings on that group" — do not promise aggressive totals like 25% in 90 ` +
    `days unless the data justifies it). Start with a pilot and expand what ` +
    `works. Then: the weekly operating cadence (who meets, what report is ` +
    `reviewed); the top 3 risks with mitigations; the quick wins in the ` +
    `objective's own units; and the success metrics to track.\n\n` +
    `Context: ${buildAssessmentContext(ctx)}\n\n` +
    `Please refer to every check by its plain-English name exactly as given — ` +
    `never internal codes.`;

  const instruction =
    "Write in a clear, friendly, professional tone, like an experienced " +
    "Dynatrace SE building a project plan with a customer. Plain markdown: " +
    "headings for the phases, short paragraphs, lists where useful. Refer to " +
    "assessment checks by their plain-English names only — never internal " +
    "codes like i15. Be concrete: name actual Dynatrace settings, " +
    "integrations, or attributes; do not invent features or URLs. State " +
    "expected outcomes in the OBJECTIVE'S own units (e.g. estimated cost " +
    "saved, minutes of MTTR, audit controls covered) rather than assessment " +
    "score points, whenever possible. Every milestone must be small and " +
    "attainable: narrow scope, one owning team, a definition of done, and a " +
    "modest numeric target — never sweeping goals like 'optimize all cloud " +
    "resources'. Targets must be conservative and defensible, with the " +
    "assumption behind each number stated. Use week-range headings for the " +
    "timeline. Keep the total under 800 words.";

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

    return {
      ok: true,
      text: resp.text,
      capabilities: detectCapabilities(resp.text),
      teams: detectTeams(resp.text, officialTeamNames),
    };
  } catch (err) {
    const classified = classifyError(err);
    // eslint-disable-next-line no-console
    console.warn(`[projectAnalysis] failed for "${project.name}":`, classified, err);
    return { ok: false, err: classified };
  }
}
