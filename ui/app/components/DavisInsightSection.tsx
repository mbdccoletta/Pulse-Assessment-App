// ui/app/components/DavisInsightSection.tsx
//
// Renders a Davis CoPilot recommendation for one capability inside the
// expanded capability card. Sits BELOW the static CRITERION_ACTIONS
// recommendations so a customer who has Davis CoPilot disabled still sees
// useful advice.
//
// States ─────────────────────────────────────────────────────────────────
//   loading  → Skeleton rows
//   success  → markdown body + provenance footer (Davis CoPilot badge,
//              "AI-generated" disclaimer, optional "from cache" indicator)
//   error    → discreet single-line note, no scary red
//   skipped  → renders nothing (capability scored 100%, no recommendation
//              was requested)
//
// Rendering ──────────────────────────────────────────────────────────────
// Davis returns markdown. We render a SAFE subset (headings, lists, bold,
// inline code, line breaks). No raw HTML, no link execution surprises.
// Strato's <Text> and <Flex> handle theme adaptation automatically.

import React from "react";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text, Strong } from "@dynatrace/strato-components/typography";
import { Skeleton, SkeletonText } from "@dynatrace/strato-components/content";
import type { DavisRecommendationState } from "../hooks/useDavisRecommendations";

interface Props {
  state: DavisRecommendationState | undefined;
  capabilityName: string;
}

/** Tiny markdown renderer — handles `**bold**`, `` `code` ``, `# heading`,
 *  `## subheading`, ordered/unordered lists, and blank-line paragraph
 *  breaks. No links (Davis output sometimes invents URLs; we suppress them
 *  to avoid sending users to 404s). */
function renderMarkdown(md: string, textColor: string, accentColor: string): React.ReactNode {
  // Strip any HTML tags defensively — we never want raw HTML execution.
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
            <Text style={{ fontSize: 12, color: accentColor, fontWeight: 600, minWidth: 18 }}>
              {isOl ? `${i + 1}.` : "•"}
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 1.55, color: textColor }}>
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
    if (line.trim() === "") {
      flushList();
      continue;
    }
    const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const h1Match = line.match(/^#\s+(.*)$/);
    const h2Match = line.match(/^##\s+(.*)$/);
    const h3Match = line.match(/^###\s+(.*)$/);
    if (h1Match || h2Match || h3Match) {
      flushList();
      const header = (h1Match || h2Match || h3Match)![1];
      const size = h1Match ? 14 : h2Match ? 13 : 12;
      out.push(
        <Text key={out.length} style={{
          fontSize: size, fontWeight: 700, color: textColor,
          marginTop: 6, marginBottom: 2,
        }}>
          {renderInline(header, textColor, accentColor)}
        </Text>
      );
      continue;
    }
    if (olMatch) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listBuf.push(olMatch[2]);
      continue;
    }
    if (ulMatch) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuf.push(ulMatch[1]);
      continue;
    }
    flushList();
    out.push(
      <Text key={out.length} style={{
        fontSize: 12, lineHeight: 1.55, color: textColor, marginBottom: 2,
      }}>
        {renderInline(line, textColor, accentColor)}
      </Text>
    );
  }
  flushList();
  return out;
}

/** Render inline tokens (bold, code) inside a single line. */
function renderInline(text: string, textColor: string, accentColor: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let i = 0;
  let buf = "";
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
            fontSize: 11, padding: "1px 4px", borderRadius: 3,
            color: accentColor,
            background: accentColor + "12",
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

export const DavisInsightSection: React.FC<Props> = ({ state, capabilityName }) => {
  const dk = useCurrentTheme() === "dark";

  if (!state || state.status === "skipped") return null;

  const textColor = Colors.Text.Neutral.Default;
  const subColor = Colors.Text.Neutral.Subdued;
  const accentColor = Colors.Text.Primary.Default;
  const borderColor = dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const bgColor = dk ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.04)";

  // ── Header (always shown for non-skipped states) ──
  const Header = (
    <Flex flexDirection="row" alignItems="center" gap={8} style={{ marginBottom: 6 }}>
      <Text style={{
        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: 0.5, color: accentColor,
      }}>
        AI Insight
      </Text>
      <Text style={{
        fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
        background: accentColor + "15", color: accentColor,
      }}>
        Davis CoPilot
      </Text>
    </Flex>
  );

  return (
    <Flex flexDirection="column" style={{
      marginTop: 8, padding: "8px 10px", borderRadius: 6,
      border: `1px solid ${borderColor}`, background: bgColor,
    }}>
      {Header}

      {state.status === "loading" && (
        <Flex flexDirection="column" gap={4} style={{ marginTop: 2 }}>
          <Skeleton height={10} width="60%" />
          <SkeletonText lines={3} />
        </Flex>
      )}

      {state.status === "error" && (
        <Text style={{ fontSize: 11, color: subColor, fontStyle: "italic" }}>
          Davis CoPilot is unavailable right now. The static recommendation above still applies.
        </Text>
      )}

      {state.status === "success" && state.rec && (
        <Flex flexDirection="column" gap={2}>
          {renderMarkdown(state.rec.text, textColor, accentColor)}

          <Flex flexDirection="row" alignItems="center" justifyContent="space-between"
            style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${borderColor}` }}>
            <Text style={{ fontSize: 10, color: subColor, fontStyle: "italic" }}>
              AI-generated · may contain inaccuracies · verify before acting
            </Text>
            {state.rec.fromCache && (
              <Text style={{ fontSize: 10, color: subColor }}>
                cached
              </Text>
            )}
          </Flex>
        </Flex>
      )}
    </Flex>
  );
};
DavisInsightSection.displayName = "DavisInsightSection";
