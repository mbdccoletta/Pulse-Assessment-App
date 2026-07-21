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
import { PAGE_STARTERS, TEAM_REPORTS, type AssistPage, type StarterGroup } from "../ai/conversationStarters";

interface Props {
  show: boolean;
  onDismiss: () => void;
  ctx: ReportContext;
  /** Which screen opened Assist — drives the page-contextual conversation
   *  starters. Defaults to "coverage". */
  page?: AssistPage;
}

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

export const AiReportModal: React.FC<Props> = ({ show, onDismiss, ctx, page = "coverage" }) => {
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

  // Page-contextual starters (top) + team report starters (below).
  const pageGroups: StarterGroup[] = PAGE_STARTERS[page] ?? PAGE_STARTERS.coverage;

  /** Render a labelled row of starter chips. */
  const renderStarterGroups = (groups: StarterGroup[]) => groups.map(group => (
    <Flex key={group.category} flexDirection="column" gap={4} alignItems="center">
      <Text style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        textTransform: "uppercase", color: subColor,
      }}>
        {group.category}
      </Text>
      <Flex flexDirection="row" gap={6} flexWrap="wrap" justifyContent="center" style={{ maxWidth: 620 }}>
        {group.starters.map(s => (
          <Button key={s.title} size="condensed" disabled={status === "loading"}
            onClick={() => setDraft(s.body)}>
            {s.title}
          </Button>
        ))}
      </Flex>
    </Flex>
  ));

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

          {/* Empty state — greeting + page-contextual starters + team reports */}
          {!hasThread && (
            <Flex flexDirection="column" gap={16} alignItems="center"
              style={{ margin: "auto 0", padding: "0 16px", textAlign: "center" }}>
              <DavisCoPilotIcon size="large" />
              <Text style={{ fontSize: 15, fontWeight: 700, color: textColor }}>
                How can I help with this assessment?
              </Text>
              <Text style={{ fontSize: 12, color: subColor, lineHeight: 1.5, maxWidth: 480 }}>
                Ask anything about the {ctx.overallCoverage}% coverage and {ctx.overallMaturity}/100
                maturity result, or start with a suggestion below.
              </Text>

              {/* Page-contextual starters */}
              <Flex flexDirection="column" gap={8} alignItems="center">
                {renderStarterGroups(pageGroups)}
              </Flex>

              {/* Team-oriented dynamic reports */}
              <Flex flexDirection="column" gap={6} alignItems="center"
                style={{ marginTop: 4, paddingTop: 12, borderTop: `1px solid ${borderColor}`, width: "100%" }}>
                <Text style={{ fontSize: 11, fontWeight: 700, color: textColor }}>
                  Generate a report for a team
                </Text>
                <Flex flexDirection="column" gap={8} alignItems="center">
                  {renderStarterGroups(TEAM_REPORTS)}
                </Flex>
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
