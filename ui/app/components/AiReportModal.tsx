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

import React, { useState, useEffect, useRef } from "react";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Modal } from "@dynatrace/strato-components-preview/overlays";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text, Strong } from "@dynatrace/strato-components/typography";
import { SkeletonText } from "@dynatrace/strato-components/content";
import { DavisCoPilotIcon, ArrowUpIcon } from "@dynatrace/strato-icons";
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
    category: "Opportunities & Improvements",
    templates: [
      {
        title: "Where are the biggest opportunities?",
        body: "Looking at this assessment, where are the biggest opportunities to improve the customer's observability? Please identify the 5 highest-value improvements available right now. For each: name the capability and the specific criterion IDs involved, quote the current value and gap from the data, explain why it matters (what the customer gains in visibility or risk reduction), and rate the opportunity size as High / Medium / Low. Highlight any single change that would unlock multiple criteria at once.",
      },
      {
        title: "What quick wins can I capture?",
        body: "What are the fastest quick wins in this assessment — improvements that need little effort but lift the score meaningfully? Please identify failing criteria with the smallest gap to their passing threshold and capabilities likely to move with a single configuration change (a OneAgent flag, a cloud integration toggle, an OpenPipeline rule). Order by score-points gained per unit of effort, cite the criterion IDs, and group quick wins that share the same underlying setup so I can sequence them efficiently.",
      },
    ],
  },
  {
    category: "Action Priorities (customer-driven)",
    templates: [
      {
        title: "What should I prioritize?",
        body: "Given the current state of this assessment, what are the top 3 actions I should prioritize to maximise impact for the customer? Please order by impact-to-effort ratio. For each action: cite the capability and criterion IDs it addresses, quote the current values and gaps, estimate the resulting score lift, and note whether it's a Foundation-tier fix (which gates the Maturity formula) or a Best Practice / Excellence improvement. Explain the reasoning behind the ordering so I can defend it to the customer.",
      },
      {
        title: "Prioritize for a specific customer goal",
        body: "My customer's primary goal this quarter is: [DESCRIBE THE GOAL — e.g. reduce MTTR, prepare for a cloud migration, pass a security audit, improve digital experience]. Given that goal and this assessment data, which gaps should I prioritize and in what order? Please focus only on the capabilities and criteria that move the needle on this goal, cite the criterion IDs, quote the gaps, and explain how closing each one advances the stated objective. Ignore gaps that don't serve this goal.",
      },
    ],
  },
  {
    category: "Executive Report (Coverage & Maturity)",
    templates: [
      {
        title: "Executive summary — coverage & maturity",
        body: "What should I include in a 1-page executive summary of this assessment for the customer's CIO/CTO? Please structure it around two headline numbers — overall Coverage and overall Maturity — and explain what each means in plain business language. Then cover: the 2-3 strongest capabilities, the 2-3 weakest, what the maturity level tells us about how deeply the platform is adopted, and a single recommended 90-day focus. Avoid technical jargon — the audience is business leadership.",
      },
      {
        title: "Board-level narrative",
        body: "What is the story this assessment tells about the customer's observability posture, framed for a board / leadership conversation? Please compare their Coverage and Maturity scores to what a healthy enterprise Dynatrace adoption looks like, call out which capabilities show real investment vs. underinvestment, quantify the untapped value in the licence footprint they already pay for, and give me 3 talking points the customer's champion can take upward to justify continued or expanded investment.",
      },
    ],
  },
  {
    category: "Technical Report (how to advance)",
    templates: [
      {
        title: "Technical action plan with real steps",
        body: "Please give me a detailed technical action plan to advance this customer's coverage and maturity. Group the actions by capability. For each action provide: the exact Dynatrace feature, setting, or integration to enable (be specific — name the OneAgent setting, the cloud integration, the OpenPipeline rule, the OTel instrumentation, the Davis AI configuration), the criterion IDs it resolves, the prerequisites that must be in place first, a rough effort estimate (S/M/L), and the expected score lift. Order the plan by impact. Do not invent settings — if unsure, say so.",
      },
      {
        title: "Root cause & how to fix each gap",
        body: "For each failing criterion in this assessment, what is the most likely root cause in the customer's Dynatrace configuration, and exactly how do I fix it? Please identify the missing or misconfigured component for each gap (OneAgent flag, cloud integration, OpenPipeline rule, OTel instrumentation, Davis setting), describe the concrete steps to remediate, and note what incident or blind spot the customer is exposed to until it's fixed. Be specific and practical — I want steps I can hand to the customer's platform team.",
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
  const { status, conversation, errorDetail, generate, followUp, reset } = useAiReport(ctx);
  const scrollRef = useRef<HTMLDivElement>(null);

  const textColor = Colors.Text.Neutral.Default;
  const subColor = Colors.Text.Neutral.Subdued;
  const accentColor = Colors.Text.Primary.Default;
  const borderColor = dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const userBubble = dk ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.12)";
  const botBubble = dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";

  const hasThread = conversation.length > 0;
  const lastAnswer = [...conversation].reverse().find(t => t.role === "assistant")?.text ?? "";
  const transcript = conversation
    .map(t => (t.role === "user" ? `## Q: ${t.text}` : t.text))
    .join("\n\n---\n\n");

  // Auto-scroll the message area to the latest turn / loading indicator.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation, status]);

  const close = () => {
    onDismiss();
    setTimeout(() => { reset(); setDraft(""); setCopied(false); }, 250);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(lastAnswer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[AiReport] clipboard write failed:", err);
    }
  };

  const onDownload = () => {
    const blob = new Blob([transcript], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-assist-${ctx.tenant}-${ctx.date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /** Single send handler — starts the conversation or continues it. */
  const send = () => {
    const q = draft.trim();
    if (!q || status === "loading") return;
    setDraft("");
    if (hasThread) void followUp(q);
    else void generate(q);
  };

  // Flat list of suggestion chips for the empty state (one row, wraps).
  const suggestionChips = TEMPLATE_GROUPS.flatMap(g => g.templates);

  return (
    <Modal show={show} onDismiss={close} title="Assist" size="large">
      <Flex flexDirection="column" style={{ minWidth: 620, maxWidth: 860, height: 560 }}>

        {/* ── Header: Davis identity + context + actions ── */}
        <Flex flexDirection="row" alignItems="center" justifyContent="space-between"
          style={{ paddingBottom: 10, borderBottom: `1px solid ${borderColor}` }}>
          <Flex flexDirection="row" alignItems="center" gap={8}>
            <DavisCoPilotIcon size="large" />
            <Flex flexDirection="column">
              <Text style={{ fontSize: 13, fontWeight: 700, color: textColor }}>Davis CoPilot</Text>
              <Text style={{ fontSize: 11, color: subColor }}>
                {ctx.tenant} · {ctx.overallCoverage}% coverage · {ctx.overallMaturity}/100 maturity
              </Text>
            </Flex>
          </Flex>
          {hasThread && (
            <Flex flexDirection="row" gap={6}>
              <Button size="condensed" disabled={!lastAnswer} onClick={onCopy}>{copied ? "Copied" : "Copy"}</Button>
              <Button size="condensed" disabled={!lastAnswer} onClick={onDownload}>Download</Button>
              <Button size="condensed" onClick={() => { reset(); setCopied(false); }}>New chat</Button>
            </Flex>
          )}
        </Flex>

        {/* ── Message area (scrolls) ── */}
        <Flex flexDirection="column" gap={12} ref={scrollRef}
          style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 2px" }}>

          {/* Empty state — greeting + suggestion chips */}
          {!hasThread && (
            <Flex flexDirection="column" gap={12} alignItems="center"
              style={{ margin: "auto 0", padding: "0 24px", textAlign: "center" }}>
              <DavisCoPilotIcon size="large" />
              <Text style={{ fontSize: 15, fontWeight: 700, color: textColor }}>
                How can I help with this assessment?
              </Text>
              <Text style={{ fontSize: 12, color: subColor, lineHeight: 1.5, maxWidth: 460 }}>
                Ask anything about the {ctx.overallCoverage}% coverage and {ctx.overallMaturity}/100
                maturity result — or start with one of these:
              </Text>
              <Flex flexDirection="row" gap={6} flexWrap="wrap" justifyContent="center" style={{ maxWidth: 560 }}>
                {suggestionChips.map(t => (
                  <Button key={t.title} size="condensed" disabled={status === "loading"}
                    onClick={() => setDraft(t.body)}>
                    {t.title}
                  </Button>
                ))}
              </Flex>
            </Flex>
          )}

          {/* Conversation bubbles */}
          {conversation.map((turn, i) => {
            const isUser = turn.role === "user";
            if (isUser) {
              return (
                <Flex key={i} flexDirection="row" justifyContent="flex-end">
                  <Flex style={{
                    maxWidth: "80%", padding: "8px 12px", borderRadius: 12,
                    background: userBubble, color: textColor,
                  }}>
                    <Text style={{ fontSize: 13, lineHeight: 1.5, color: textColor }}>{turn.text}</Text>
                  </Flex>
                </Flex>
              );
            }
            return (
              <Flex key={i} flexDirection="row" gap={8} alignItems="flex-start">
                <Flex style={{ flexShrink: 0, marginTop: 2 }}><DavisCoPilotIcon /></Flex>
                <Flex flexDirection="column" gap={2} style={{
                  maxWidth: "85%", padding: "8px 12px", borderRadius: 12,
                  background: botBubble,
                }}>
                  {renderMarkdown(turn.text, textColor, accentColor)}
                </Flex>
              </Flex>
            );
          })}

          {/* Pending answer */}
          {status === "loading" && (
            <Flex flexDirection="row" gap={8} alignItems="flex-start">
              <Flex style={{ flexShrink: 0, marginTop: 2 }}><DavisCoPilotIcon /></Flex>
              <Flex flexDirection="column" gap={6} style={{
                flex: 1, maxWidth: "85%", padding: "8px 12px", borderRadius: 12, background: botBubble,
              }}>
                <SkeletonText lines={3} />
              </Flex>
            </Flex>
          )}

          {/* Error bubble — thread preserved above */}
          {status === "error" && (
            <Flex flexDirection="row" gap={8} alignItems="flex-start">
              <Flex style={{ flexShrink: 0, marginTop: 2 }}><DavisCoPilotIcon /></Flex>
              <Flex flexDirection="column" gap={4} style={{
                maxWidth: "85%", padding: "8px 12px", borderRadius: 12,
                border: `1px solid ${Colors.Text.Critical.Default}33`,
                background: dk ? "rgba(229,57,53,0.06)" : "rgba(229,57,53,0.04)",
              }}>
                <Text style={{ fontSize: 12, fontWeight: 700, color: Colors.Text.Critical.Default }}>
                  {errorDetail?.status ? `Davis error (HTTP ${errorDetail.status})` : "Davis unavailable"}
                </Text>
                {errorDetail?.hint && (
                  <Text style={{ fontSize: 11, color: subColor, lineHeight: 1.5 }}>{errorDetail.hint}</Text>
                )}
              </Flex>
            </Flex>
          )}
        </Flex>

        {/* ── Composer: chat input + send ── */}
        <Flex flexDirection="column" gap={4} style={{ paddingTop: 10, borderTop: `1px solid ${borderColor}` }}>
          <Flex flexDirection="row" gap={8} alignItems="center">
            <input
              type="text"
              value={draft}
              placeholder={hasThread ? "Ask a follow-up…" : "Ask Davis about this assessment…"}
              disabled={status === "loading"}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") send(); }}
              onKeyUp={(e) => e.stopPropagation()}
              style={{
                flex: 1, padding: "10px 14px", fontSize: 13, borderRadius: 20,
                border: `1px solid ${borderColor}`,
                background: dk ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.85)",
                color: textColor, fontFamily: "inherit", outline: "none",
              }}
            />
            <Button
              variant="emphasized" color="primary"
              disabled={!draft.trim() || status === "loading"}
              onClick={send}
              aria-label="Send"
            >
              <Button.Prefix><ArrowUpIcon /></Button.Prefix>
              Send
            </Button>
          </Flex>
          <Text style={{ fontSize: 10, color: subColor, fontStyle: "italic", textAlign: "center" }}>
            AI-generated · may contain inaccuracies · verify before sharing externally
          </Text>
        </Flex>
      </Flex>
    </Modal>
  );
};
AiReportModal.displayName = "AiReportModal";
