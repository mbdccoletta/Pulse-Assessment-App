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
const TEMPLATES: { title: string; body: string }[] = [
  {
    title: "Executive summary",
    body: "Can you draft a 1-page executive summary of this assessment for a customer's CTO? Highlight overall posture, the 2-3 most important strengths, the top 2-3 gaps, and a recommended 90-day priority. Avoid jargon — the audience is business leadership.",
  },
  {
    title: "Technical action plan",
    body: "Can you produce a technical action plan for the next quarter? Group actions by capability, list each action with the criteria it addresses, the expected score lift, and rough effort (S/M/L). Order by impact.",
  },
  {
    title: "QBR talking points",
    body: "Can you give me talking points for a quarterly business review with this customer? Cover what is working well, what needs investment, ROI framing for closing the top 3 gaps, and 2 questions to ask the customer to drive engagement.",
  },
  {
    title: "Customer-facing letter",
    body: "Can you write a customer-facing letter (formal but warm tone) summarizing the assessment results and recommending the next 3 priorities? Include a brief opening, a per-capability paragraph for the lowest 3 scores, and a closing call-to-action.",
  },
];

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

        {/* Templates */}
        <Flex flexDirection="row" gap={6} flexWrap="wrap">
          {TEMPLATES.map(t => (
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
