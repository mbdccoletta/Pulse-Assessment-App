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
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { status, conversation, errorDetail, generate, followUp, reset } = useAiReport(ctx);

  const textColor = Colors.Text.Neutral.Default;
  const subColor = Colors.Text.Neutral.Subdued;
  const accentColor = Colors.Text.Primary.Default;
  const borderColor = dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const surface = Colors.Background.Surface.Default;

  const hasThread = conversation.length > 0;
  const lastAnswer = [...conversation].reverse().find(t => t.role === "assistant")?.text ?? "";
  /** Full transcript for download — every turn, labelled. */
  const transcript = conversation
    .map(t => (t.role === "user" ? `## Q: ${t.text}` : t.text))
    .join("\n\n---\n\n");

  const close = () => {
    onDismiss();
    // Defer reset so the closing animation doesn't show a blank state mid-flight.
    setTimeout(() => { reset(); setDraft(""); setFollowUpDraft(""); setCopied(false); }, 250);
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

  const clearResult = () => { reset(); setFollowUpDraft(""); setCopied(false); };

  const submitFollowUp = () => {
    if (!followUpDraft.trim() || status === "loading") return;
    const q = followUpDraft;
    setFollowUpDraft("");
    void followUp(q);
  };

  return (
    <Modal show={show} onDismiss={close} title="Assist" size="large">
      <Flex flexDirection="column" gap={16} style={{ minWidth: 600, maxWidth: 880 }}>

        {/* Compact context line */}
        <Text style={{ fontSize: 12, color: subColor }}>
          Tenant <Strong style={{ color: textColor }}>{ctx.tenant}</Strong> ·{" "}
          {ctx.overallCoverage}% coverage · {ctx.overallMaturity}/100 maturity
        </Text>

        {/* ════ START SCREEN — only before the first question ════ */}
        {!hasThread && (
          <>
            {/* PRIMARY: custom prompt */}
            <Flex flexDirection="column" gap={6}>
              <Text style={{ fontSize: 13, fontWeight: 700, color: textColor }}>
                Ask anything about this assessment
              </Text>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  "Type your question. Examples:\n" +
                  "• Which 3 gaps should I fix first and why?\n" +
                  "• Summarise coverage and maturity for a CTO.\n" +
                  "• How do I raise Infrastructure from L1 to L2 — give exact steps."
                }
                disabled={status === "loading"}
                rows={6}
                style={{
                  width: "100%", padding: "12px 14px", fontSize: 13, lineHeight: 1.55,
                  borderRadius: 8, border: `1px solid ${borderColor}`,
                  background: dk ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.75)",
                  color: textColor, fontFamily: "inherit", outline: "none",
                  resize: "vertical", boxSizing: "border-box",
                }}
              />
              <Flex flexDirection="row" justifyContent="space-between" alignItems="center">
                <Flex flexDirection="row" gap={8} alignItems="center">
                  <Button size="condensed" disabled={!draft || status === "loading"} onClick={() => setDraft("")}>
                    Clear
                  </Button>
                  {draft.trim() && (
                    <Text style={{ fontSize: 11, color: subColor }}>{draft.length} chars · 1 Davis call</Text>
                  )}
                </Flex>
                <Button
                  variant="emphasized" color="primary"
                  disabled={!draft.trim() || status === "loading"}
                  onClick={() => void generate(draft)}
                >
                  {status === "loading" ? "Asking…" : "Ask Davis"}
                </Button>
              </Flex>
            </Flex>

            {/* SECONDARY: collapsible suggestions */}
            <Flex flexDirection="column" gap={6}>
              <Text
                onClick={() => setShowSuggestions(v => !v)}
                style={{ fontSize: 12, fontWeight: 600, color: accentColor, cursor: "pointer", userSelect: "none" }}
              >
                {showSuggestions ? "▾ Hide example prompts" : "▸ Need ideas? Show example prompts"}
              </Text>
              {showSuggestions && (
                <Flex flexDirection="column" gap={12} style={{
                  padding: 12, borderRadius: 8, border: `1px solid ${borderColor}`,
                  background: dk ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
                }}>
                  {TEMPLATE_GROUPS.map(group => (
                    <Flex key={group.category} flexDirection="column" gap={4}>
                      <Text style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: subColor }}>
                        {group.category}
                      </Text>
                      <Flex flexDirection="row" gap={6} flexWrap="wrap">
                        {group.templates.map(t => (
                          <Button key={t.title} size="condensed" disabled={status === "loading"}
                            onClick={() => { setDraft(t.body); setShowSuggestions(false); }}>
                            {t.title}
                          </Button>
                        ))}
                      </Flex>
                    </Flex>
                  ))}
                </Flex>
              )}
            </Flex>
          </>
        )}

        {/* ════ CONVERSATION SCREEN — once a question has been asked ════ */}
        {hasThread && (
          <Flex flexDirection="column" gap={8}>
            {/* Conversation toolbar */}
            <Flex flexDirection="row" justifyContent="space-between" alignItems="center">
              <Text style={{ fontSize: 13, fontWeight: 700, color: textColor }}>Conversation</Text>
              <Flex flexDirection="row" gap={6}>
                <Button size="condensed" disabled={!lastAnswer} onClick={onCopy}>{copied ? "Copied" : "Copy answer"}</Button>
                <Button size="condensed" disabled={!lastAnswer} onClick={onDownload}>Download .md</Button>
                <Button size="condensed" onClick={clearResult}>New conversation</Button>
              </Flex>
            </Flex>

            {/* Thread */}
            <Flex flexDirection="column" gap={12} style={{
              padding: 14, borderRadius: 8, border: `1px solid ${borderColor}`,
              background: dk ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.04)",
              maxHeight: 420, overflowY: "auto",
            }}>
              {conversation.map((turn, i) => {
                const isUser = turn.role === "user";
                return (
                  <Flex key={i} flexDirection="column"
                    style={{
                      marginLeft: isUser ? 0 : 0,
                      paddingLeft: isUser ? 10 : 0,
                      borderLeft: isUser ? `2px solid ${accentColor}66` : undefined,
                    }}>
                    {isUser && (
                      <Text style={{ fontSize: 10, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
                        You asked
                      </Text>
                    )}
                    {isUser
                      ? <Text style={{ fontSize: 13, color: textColor, lineHeight: 1.5 }}>{turn.text}</Text>
                      : <Flex flexDirection="column" gap={2}>{renderMarkdown(turn.text, textColor, accentColor)}</Flex>}
                  </Flex>
                );
              })}

              {/* In-thread loading skeleton for the pending answer */}
              {status === "loading" && (
                <Flex flexDirection="column" gap={6} style={{ marginTop: 2 }}>
                  <Skeleton height={12} width="50%" />
                  <SkeletonText lines={3} />
                </Flex>
              )}

              {/* In-thread error — thread preserved above */}
              {status === "error" && (
                <Flex flexDirection="column" gap={4} style={{
                  marginTop: 4, padding: 10, borderRadius: 6,
                  border: `1px solid ${Colors.Text.Critical.Default}33`,
                }}>
                  <Text style={{ fontSize: 12, fontWeight: 700, color: Colors.Text.Critical.Default }}>
                    {errorDetail?.status ? `Davis error (HTTP ${errorDetail.status})` : "Davis unavailable"}
                  </Text>
                  {errorDetail?.hint && (
                    <Text style={{ fontSize: 11, color: subColor, lineHeight: 1.5 }}>{errorDetail.hint}</Text>
                  )}
                </Flex>
              )}
            </Flex>

            {/* Follow-up input — keep interacting with the answer */}
            <Flex flexDirection="row" gap={6} alignItems="center">
              <input
                type="text"
                value={followUpDraft}
                placeholder="Ask a follow-up question…"
                disabled={status === "loading"}
                onChange={(e) => setFollowUpDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") submitFollowUp();
                }}
                onKeyUp={(e) => e.stopPropagation()}
                style={{
                  flex: 1, padding: "8px 12px", fontSize: 13, borderRadius: 8,
                  border: `1px solid ${borderColor}`,
                  background: dk ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.75)",
                  color: textColor, fontFamily: "inherit", outline: "none",
                }}
              />
              <Button
                variant="emphasized" color="primary"
                disabled={!followUpDraft.trim() || status === "loading"}
                onClick={submitFollowUp}
              >
                {status === "loading" ? "…" : "Send"}
              </Button>
            </Flex>

            <Text style={{ fontSize: 10, color: subColor, fontStyle: "italic" }}>
              AI-generated · may contain inaccuracies · verify before sharing externally
            </Text>
          </Flex>
        )}

        {/* Footer */}
        <Flex flexDirection="row" justifyContent="flex-end"
          style={{ marginTop: 4, paddingTop: 8, borderTop: `1px solid ${borderColor}` }}>
          <Button onClick={close}>Close</Button>
        </Flex>
      </Flex>
    </Modal>
  );
};
AiReportModal.displayName = "AiReportModal";
