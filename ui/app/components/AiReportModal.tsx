// ui/app/components/AiReportModal.tsx
//
// Modal that lets the user type a free-form prompt and asks Davis CoPilot
// to generate a tailored report from the current assessment.
//
// UX:
//   1. Header + description + close button
//   2. Quick-template chips that prefill the textarea
//   3. Textarea (multiline) — the actual question Davis will answer
//   4. "Generate" button (disabled when empty / loading)
//   5. After loading: rendered markdown + Copy + Download + Refine
//
// The user can iterate without closing — typing into the textarea after
// a response is shown enables Generate again (replaces the response).

import React, { useState } from "react";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Modal } from "@dynatrace/strato-components-preview/overlays";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text, Strong } from "@dynatrace/strato-components/typography";
import { Skeleton, SkeletonText } from "@dynatrace/strato-components/content";
import { useAiReport } from "../hooks/useAiReport";
import type { ReportContext } from "../ai/reportPrompt";

interface Props {
  show: boolean;
  onDismiss: () => void;
  ctx: ReportContext;
}

/** Pre-filled templates the SE can pick. They translate to natural-language
 *  questions, not commands — same as the per-capability prompt strategy
 *  that gets past the Davis guardrail. */
// SE-grade question templates grouped by analytical angle. All in pure
// Q&A shape (What/How/Which/Where) so the Davis guardrail accepts them.
// Each asks Davis for INFORMATION the SE then uses to compose deliverables.
interface TemplateGroup {
  category: string;
  templates: { title: string; body: string }[];
}

const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    category: "Tactical",
    templates: [
      {
        title: "What should I prioritize?",
        body: "Given the current state of this assessment, what are the top 3 actions I should prioritize to maximise impact? Please order by impact-to-effort ratio. For each action: cite the specific capability and criterion IDs it addresses, quote the current values and gaps from the data, estimate the resulting score lift, and note whether it's a Foundation-tier fix (which gates the Maturity formula) or a Best Practice / Excellence improvement. Explain the reasoning behind the ordering so I can defend it to the customer.",
      },
      {
        title: "What are the points of attention?",
        body: "What are the most important warning signs and risk areas in this data? Please highlight in order of severity: (a) Foundation-tier failures that cap Maturity at L1, (b) criteria at exactly 0% that suggest disabled or missing integrations, (c) capabilities with several Excellence wins but failing Foundation — these flatter the score but mask structural gaps, (d) any capability below 50% coverage. Do not suggest fixes yet — just call out what deserves attention and why.",
      },
    ],
  },
  {
    category: "Technical deep-dive",
    templates: [
      {
        title: "Root cause & blind spots",
        body: "For each failing criterion in this assessment, what is the most likely root cause in the customer's Dynatrace configuration? Please identify the missing or misconfigured component (e.g. OneAgent flag, cloud integration, OpenPipeline rule, OpenTelemetry instrumentation, Davis AI setting). Then map each root cause to the type of incident the customer would NOT detect today — i.e. what blind spots does this assessment reveal? Be specific about which signals, alerts, or problem types are at risk.",
      },
      {
        title: "Architecture maturity review",
        body: "Looking at the pattern of failures across all 9 capabilities, what does it tell me about the customer's observability architecture maturity? Identify any architectural anti-patterns visible in the data — for example: cloud monitoring enabled but no log enrichment, OneAgent broadly deployed but Kubernetes clusters disconnected, RUM active without synthetic monitoring, or AI Observability without Davis problem coverage. Propose architectural-level improvements that would unlock multiple criteria at once before recommending tactical fixes.",
      },
      {
        title: "Feature adoption roadmap",
        body: "What is the optimal sequence of Dynatrace feature enablement to take this customer from their current overall coverage to 90%+? Please structure the answer as 3 phases (0-3 months, 3-6 months, 6-12 months). For each phase: list the specific features to enable, the criterion IDs that get unlocked, the prerequisites that must be satisfied first, and the expected lift in overall coverage and overall maturity at the end of the phase.",
      },
    ],
  },
  {
    category: "Strategy",
    templates: [
      {
        title: "How do I increase coverage?",
        body: "Looking specifically at coverage scores, what are the 5 fastest actions to lift the overall coverage average? Identify failing criteria with the smallest gap to threshold (quick wins) and capabilities likely to move with a single configuration change. Order by points-of-coverage gained per unit of effort, and group actions that share the same underlying integration (e.g. one cloud platform setup that unblocks several cloud-enrichment criteria) so we can sequence them efficiently.",
      },
      {
        title: "How do I increase maturity?",
        body: "How can I improve Maturity scores across the 9 capabilities? Remember the progressive formula: Foundation 60% weight, Best Practice 25% counts only if Foundation reaches 80%, Excellence 15% counts only if BP reaches 60%. Given each capability's current Maturity Level (L0-L3) and per-tier breakdown, what is the optimal sequence of actions to advance each capability one level? Foundation-tier failures first across all capabilities — they unlock the whole formula. For each capability, name the specific tier-gate to clear next and the action to clear it.",
      },
      {
        title: "12-month maturity roadmap",
        body: "Please build a 12-month roadmap to advance this customer's maturity. Break it into quarterly milestones. For each quarter: which capabilities are the focus, which actions get executed (cite criterion IDs), expected capability-level outcomes at end of quarter (L1→L2→L3), and resource implications (SE hours, customer effort, integration touchpoints). Account for the Foundation→BP→Excellence gating throughout. End with the expected overall coverage and overall maturity targets at month 12.",
      },
    ],
  },
  {
    category: "Business",
    templates: [
      {
        title: "ROI & business case",
        body: "What is the business case for the customer closing the top 5 gaps in this assessment? For each gap: estimated cost of an undetected incident in that area (downtime / revenue / brand), expected MTTR reduction once the gap is closed, FTE hours saved per quarter through better observability, and any compliance or regulatory exposure (SOC2, PCI, HIPAA, ISO 27001) the gap may create. Frame the answer in language suitable for a CTO-level budget discussion — concrete numbers where reasonable, ranges where uncertain.",
      },
      {
        title: "Executive narrative",
        body: "What story does this assessment tell about the customer's observability maturity, and how should I frame it for a CIO/CTO conversation? Cover: how does this posture compare to typical enterprise Dynatrace adoption, which capabilities indicate technological investment vs. underinvestment, what untapped value exists in the existing licence footprint, and what are 3 board-level talking points the customer can take to their leadership? Avoid jargon — the audience is business leadership.",
      },
      {
        title: "Licence optimization",
        body: "Based on the failing criteria patterns, where is the customer likely under-utilizing Dynatrace capabilities they already own? Identify features that are paid for but inactive (signals: criteria at 0% in capabilities with active foundations). Conversely, identify gaps that justify a capability upgrade or expansion (e.g. Log Management add-on, RUM, AppSec, Davis CoPilot). Give me a balanced view: optimize current spend AND surface expansion opportunities the SE can have a conversation about.",
      },
    ],
  },
];

// Flat view used by character counters / iteration.
const TEMPLATES = TEMPLATE_GROUPS.flatMap(g => g.templates);
// Suppress unused-var lint by re-exporting if needed; current code path
// only uses TEMPLATE_GROUPS for rendering.
void TEMPLATES;

// ── Minimal markdown renderer (same safe subset used by DavisInsightSection) ──
function renderMarkdown(md: string, textColor: string, accentColor: string): React.ReactNode {
  const safe = md.replace(/<[^>]*>/g, "");
  const lines = safe.split("\n");
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  let listType: "ol" | "ul" | null = null;
  const flushList = () => {
    if (listBuf.length === 0) return;
    const isOl = listType === "ol";
    out.push(
      <Flex key={`list-${out.length}`} flexDirection="column" gap={4}
        style={{ marginLeft: 12, marginTop: 4, marginBottom: 4 }}>
        {listBuf.map((item, i) => (
          <Flex key={i} flexDirection="row" gap={6} alignItems="flex-start">
            <Text style={{ fontSize: 13, color: accentColor, fontWeight: 600, minWidth: 22 }}>
              {isOl ? `${i + 1}.` : "•"}
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 1.55, color: textColor }}>
              {renderInline(item, textColor, accentColor)}
            </Text>
          </Flex>
        ))}
      </Flex>
    );
    listBuf = [];
    listType = null;
  };
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === "") { flushList(); continue; }
    const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const h1Match = line.match(/^#\s+(.*)$/);
    const h2Match = line.match(/^##\s+(.*)$/);
    const h3Match = line.match(/^###\s+(.*)$/);
    if (h1Match || h2Match || h3Match) {
      flushList();
      const header = (h1Match || h2Match || h3Match)![1];
      const size = h1Match ? 16 : h2Match ? 14 : 13;
      out.push(
        <Text key={out.length} style={{
          fontSize: size, fontWeight: 700, color: textColor,
          marginTop: 8, marginBottom: 2,
        }}>{renderInline(header, textColor, accentColor)}</Text>
      );
      continue;
    }
    if (olMatch) { if (listType !== "ol") flushList(); listType = "ol"; listBuf.push(olMatch[2]); continue; }
    if (ulMatch) { if (listType !== "ul") flushList(); listType = "ul"; listBuf.push(ulMatch[1]); continue; }
    flushList();
    out.push(
      <Text key={out.length} style={{
        fontSize: 13, lineHeight: 1.55, color: textColor, marginBottom: 2,
      }}>{renderInline(line, textColor, accentColor)}</Text>
    );
  }
  flushList();
  return out;
}

function renderInline(text: string, textColor: string, accentColor: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let i = 0, buf = "";
  const flush = () => { if (buf) { parts.push(buf); buf = ""; } };
  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end > -1) {
        flush();
        parts.push(<Strong key={parts.length} style={{ color: textColor }}>{text.slice(i + 2, end)}</Strong>);
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > -1) {
        flush();
        parts.push(
          <span key={parts.length} style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12, padding: "1px 4px", borderRadius: 3,
            color: accentColor, background: accentColor + "12",
          }}>{text.slice(i + 1, end)}</span>
        );
        i = end + 1;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  flush();
  return parts;
}

export const AiReportModal: React.FC<Props> = ({ show, onDismiss, ctx }) => {
  const dk = useCurrentTheme() === "dark";
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const { status, text, errorDetail, generate, reset } = useAiReport(ctx);

  const textColor = Colors.Text.Neutral.Default;
  const subColor = Colors.Text.Neutral.Subdued;
  const accentColor = Colors.Text.Primary.Default;
  const borderColor = dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const surface = Colors.Background.Surface.Default;

  const close = () => {
    onDismiss();
    // Defer reset so the closing animation doesn't show a blank state mid-flight.
    setTimeout(() => { reset(); setDraft(""); setCopied(false); }, 250);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[AiReport] clipboard write failed:", err);
    }
  };

  const onDownload = () => {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-report-${ctx.tenant}-${ctx.date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal show={show} onDismiss={close} title="Generate Report with Davis CoPilot" size="large">
      <Flex flexDirection="column" gap={12} style={{ minWidth: 600, maxWidth: 900 }}>
        <Text style={{ fontSize: 13, color: subColor, lineHeight: 1.5 }}>
          Describe the report you need. Davis CoPilot will analyse this
          assessment (tenant <Strong style={{ color: textColor }}>{ctx.tenant}</Strong>,
          date {ctx.date}, overall {ctx.overallCoverage}% coverage) and produce
          a tailored response. Pick a template below or write your own.
        </Text>

        {/* Templates — grouped by analytical angle (Tactical / Technical /
            Strategy / Business). Each category renders a small label above
            its chip row so the SE can see the analytical range available. */}
        <Flex flexDirection="column" gap={6}>
          {TEMPLATE_GROUPS.map(group => (
            <Flex key={group.category} flexDirection="column" gap={4}>
              <Text style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                textTransform: "uppercase", color: subColor,
              }}>
                {group.category}
              </Text>
              <Flex flexDirection="row" gap={6} flexWrap="wrap">
                {group.templates.map(t => (
                  <Button
                    key={t.title}
                    size="condensed"
                    onClick={() => setDraft(t.body)}
                    disabled={status === "loading"}
                  >
                    {t.title}
                  </Button>
                ))}
              </Flex>
            </Flex>
          ))}
        </Flex>

        {/* Textarea */}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Can you write a 2-page customer-facing report focusing on…"
          disabled={status === "loading"}
          rows={5}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 13,
            lineHeight: 1.5,
            borderRadius: 6,
            border: `1px solid ${borderColor}`,
            background: dk ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.6)",
            color: textColor,
            fontFamily: "inherit",
            outline: "none",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />

        {/* Generate row */}
        <Flex flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text style={{ fontSize: 11, color: subColor }}>
            {draft.length} chars · uses 1 Davis CoPilot call
          </Text>
          <Flex flexDirection="row" gap={8}>
            {status === "success" && (
              <Button size="condensed" onClick={onCopy}>
                {copied ? "Copied" : "Copy"}
              </Button>
            )}
            {status === "success" && (
              <Button size="condensed" onClick={onDownload}>
                Download .md
              </Button>
            )}
            <Button
              size="condensed"
              variant="emphasized"
              color="primary"
              disabled={!draft.trim() || status === "loading"}
              onClick={() => void generate(draft)}
            >
              {status === "loading" ? "Generating…" : status === "success" ? "Regenerate" : "Generate"}
            </Button>
          </Flex>
        </Flex>

        {/* Response area */}
        {status === "loading" && (
          <Flex flexDirection="column" gap={8} style={{
            padding: 16, borderRadius: 6,
            border: `1px solid ${borderColor}`,
            background: dk ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.04)",
          }}>
            <Skeleton height={16} width="40%" />
            <SkeletonText lines={5} />
            <Skeleton height={12} width="80%" />
            <SkeletonText lines={3} />
          </Flex>
        )}

        {status === "error" && (
          <Flex flexDirection="column" gap={4} style={{
            padding: 12, borderRadius: 6,
            border: `1px solid ${Colors.Text.Critical.Default}33`,
            background: dk ? "rgba(229,57,53,0.06)" : "rgba(229,57,53,0.04)",
          }}>
            <Text style={{ fontSize: 12, fontWeight: 700, color: Colors.Text.Critical.Default }}>
              {errorDetail?.status ? `Davis CoPilot error (HTTP ${errorDetail.status})` : "Davis CoPilot unavailable"}
            </Text>
            {errorDetail?.message && (
              <Text style={{
                fontSize: 11, color: textColor,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                padding: "4px 6px", borderRadius: 3,
                background: dk ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                wordBreak: "break-word",
              }}>{errorDetail.message}</Text>
            )}
            {errorDetail?.hint && (
              <Text style={{ fontSize: 11, color: subColor, lineHeight: 1.5 }}>
                {errorDetail.hint}
              </Text>
            )}
          </Flex>
        )}

        {status === "success" && text && (
          <Flex flexDirection="column" gap={4} style={{
            padding: 16, borderRadius: 6,
            border: `1px solid ${borderColor}`,
            background: dk ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.04)",
            maxHeight: 460, overflowY: "auto",
          }}>
            {renderMarkdown(text, textColor, accentColor)}
            <Flex style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${borderColor}` }}>
              <Text style={{ fontSize: 10, color: subColor, fontStyle: "italic" }}>
                AI-generated by Davis CoPilot · may contain inaccuracies · verify before sharing externally
              </Text>
            </Flex>
          </Flex>
        )}

        {/* Footer-style row at the bottom of the modal body. */}
        <Flex flexDirection="row" justifyContent="flex-end"
          style={{ marginTop: 4, paddingTop: 8, borderTop: `1px solid ${borderColor}` }}>
          <Button onClick={close}>Close</Button>
        </Flex>
      </Flex>
    </Modal>
  );
};
AiReportModal.displayName = "AiReportModal";
