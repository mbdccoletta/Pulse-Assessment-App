// ui/app/ai/conversationStarters.ts
//
// Conversation starters for the Assist panel — following the Dynatrace Davis
// CoPilot "conversation starters" pattern: pre-defined, context-aware prompt
// suggestions shown when the Assist panel opens, so the user can kick off a
// useful conversation with one click.
//
// Two axes:
//   1. PAGE_STARTERS  — suggestions relevant to the SCREEN the user is on
//      (insights, tips, priorities, analyses for that view).
//   2. TEAM_REPORTS   — dynamic reports tailored to a specific TEAM/audience,
//      each in a format that team actually consumes.
//
// All starters are phrased as natural questions/requests so the Davis
// guardrail accepts them (see promptTemplates v4-v6 for why).

/** Which screen the Assist panel was opened from. Drives PAGE_STARTERS. */
export type AssistPage = "coverage" | "maturity" | "executive" | "comparison";

export interface Starter {
  /** Chip label (short). */
  title: string;
  /** The prompt inserted into the composer when the chip is clicked. */
  body: string;
}

export interface StarterGroup {
  category: string;
  starters: Starter[];
}

// ─── 1. Page-contextual starters ────────────────────────────────────────

export const PAGE_STARTERS: Record<AssistPage, StarterGroup[]> = {
  // Coverage radar view — breadth, gaps, quick wins, priorities.
  coverage: [
    {
      category: "Insights & priorities",
      starters: [
        {
          title: "What should I prioritize?",
          body: "Given this assessment, what are the top 3 actions I should prioritize to maximise impact? Order by impact-to-effort. For each, name the capability and the checks it addresses (by their names), quote the current value and gap, note whether it's a Foundation fix that unlocks the maturity formula, and estimate the score lift.",
        },
        {
          title: "Where are my biggest gaps?",
          body: "Which capabilities and checks are the weakest in this assessment, and what does each gap mean for the customer in practical terms (what they can't see or detect today)? List them from most to least severe and explain the real-world risk of each.",
        },
        {
          title: "What quick wins can I capture?",
          body: "What are the fastest quick wins — checks with the smallest gap to passing, or capabilities that move with a single configuration change? Order by score-points gained per unit of effort and group actions that share the same underlying Dynatrace setup.",
        },
      ],
    },
  ],
  // Maturity view — tier progression, gates, levels.
  maturity: [
    {
      category: "Maturity analysis",
      starters: [
        {
          title: "How do I raise maturity?",
          body: "How can I advance the Maturity scores across the 9 capabilities? Remember the progressive formula (Foundation 60%, Best Practice 25% only if Foundation reaches 80%, Excellence 15% only if BP reaches 60%). For each capability, tell me the specific tier gate that needs to be cleared next and the concrete action to clear it. Prioritise Foundation gaps first since they unlock the whole formula.",
        },
        {
          title: "Which Foundation gates are blocking me?",
          body: "Which capabilities have failing Foundation-tier checks that are capping their Maturity at L1 regardless of Best Practice or Excellence progress? List them, name the specific Foundation checks that are failing, and give the concrete fix for each so the tier unlocks.",
        },
        {
          title: "Plan each capability to the next level",
          body: "For each capability, what is the shortest path to advance it one maturity level (L0→L1, L1→L2, or L2→L3)? Give the specific checks to pass and the Dynatrace actions to pass them, in the order the progressive gates require.",
        },
      ],
    },
  ],
  // Executive summary view — leadership framing.
  executive: [
    {
      category: "Executive framing",
      starters: [
        {
          title: "Executive summary",
          body: "What should I include in a one-page executive summary of this assessment for the customer's CIO/CTO? Structure it around the two headline numbers — overall Coverage and overall Maturity — in plain business language, cover the 2-3 strongest and weakest capabilities, and end with a single recommended 90-day focus. Avoid technical jargon.",
        },
        {
          title: "Board-level narrative",
          body: "What is the story this assessment tells about the customer's observability posture, framed for a board or leadership conversation? Compare the Coverage and Maturity scores to a healthy enterprise Dynatrace adoption, call out investment vs. underinvestment, and give me 3 talking points the champion can take upward.",
        },
      ],
    },
  ],
  // Evolution / comparison view — change over time.
  comparison: [
    {
      category: "Change analysis",
      starters: [
        {
          title: "What changed between snapshots?",
          body: "Comparing these two assessment snapshots, what are the most significant changes? Highlight which capabilities improved and which regressed, by how many points, and what the likely cause of each change is. Focus on the changes that matter most for the customer's observability posture.",
        },
        {
          title: "Summarise progress for a status update",
          body: "Write a short progress update I can send to the customer, summarising how their observability coverage and maturity changed between these two snapshots. Lead with the wins, acknowledge any regressions honestly, and end with the recommended next focus.",
        },
        {
          title: "What regressed and why?",
          body: "Which capabilities or checks regressed between these two snapshots? For each regression, explain the most likely cause (a disabled integration, an expired data window, a decommissioned host group) and the concrete step to investigate or recover it.",
        },
      ],
    },
  ],
};

// ─── 2. Team-oriented dynamic reports (multiple formats) ─────────────────
// Each starter asks Davis for a report shaped for how that team consumes
// information. The audience + format is baked into the request.

export const TEAM_REPORTS: StarterGroup[] = [
  {
    category: "Leadership",
    starters: [
      {
        title: "CIO one-pager",
        body: "Produce a one-page executive briefing for a CIO. Open with overall Coverage and Maturity in plain language, then 3 short sections: what's strong, what's at risk, and the recommended 90-day investment. Use short paragraphs and a few bullet points. No jargon.",
      },
      {
        title: "Board talking points",
        body: "Give me 5 concise board-level talking points about the customer's observability posture based on this assessment, each one sentence, framed around business value and risk rather than technology.",
      },
    ],
  },
  {
    category: "Platform / SRE",
    starters: [
      {
        title: "Technical action plan",
        body: "Produce a technical action plan for the platform/SRE team. Group actions by capability. For each: the exact Dynatrace setting/integration to enable, the checks it resolves (by name), prerequisites, rough effort (S/M/L), and expected score lift. Order by impact. Format as clear sections with short bullet steps.",
      },
      {
        title: "Reliability gaps checklist",
        body: "Give me a checklist of the reliability and monitoring gaps this assessment reveals, phrased as actionable to-do items an SRE can tick off. Group by capability, most critical first, and note for each what incident it would help detect.",
      },
    ],
  },
  {
    category: "Security",
    starters: [
      {
        title: "Security posture report",
        body: "Summarise the customer's security and threat observability posture from this assessment. Cover Application Security and Threat Observability specifically: what's covered, what's missing, and the concrete steps to close the top gaps. Note any compliance-relevant blind spots (audit trails, attack surface visibility).",
      },
    ],
  },
  {
    category: "Developers",
    starters: [
      {
        title: "Developer enablement notes",
        body: "What should application developers do to improve observability based on this assessment? Focus on Application Observability, AI Observability, and tracing/log quality. Give concrete, developer-facing actions (instrumentation, tagging, structured logging, OpenTelemetry) with a short why for each.",
      },
    ],
  },
  {
    category: "FinOps / Value",
    starters: [
      {
        title: "Licence optimization view",
        body: "Based on the failing checks, where is the customer likely under-utilizing Dynatrace capabilities they already pay for (signals: checks at 0% in capabilities with active foundations)? Also identify gaps that justify a capability expansion (Log Management, RUM, AppSec, Davis CoPilot). Give a balanced optimize-and-expand view a FinOps or account conversation can use.",
      },
      {
        title: "Business value narrative",
        body: "Frame the value of closing the top 5 gaps in business terms: for each, the risk it removes (downtime, MTTR, undetected incidents, compliance exposure) and the observability outcome the customer gains. Keep it concrete and suitable for a value-realisation discussion.",
      },
    ],
  },
];
