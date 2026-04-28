import React, { useState } from "react";
import Typography from "@dynatrace/strato-design-tokens/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text, Strong, Code } from "@dynatrace/strato-components/typography";

interface Props {
  query: string;
  dk: boolean;
  textSec?: string;
  inline?: boolean;
}

const CopyBtn: React.FC<{ text: string; dk: boolean; label?: string; small?: boolean }> = ({ text, dk, label, small }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };
  return (
    <Button
      onClick={handleCopy}
      size="condensed"
      color={copied ? "success" : "neutral"}
      aria-label={copied ? "Copied" : (label || "Copy query")}
    >{copied ? (small ? "✓" : "✓ Copied") : (small ? "⎎" : "⎎ Copy")}</Button>
  );
};

export const CopyableQuery: React.FC<Props> = ({ query, dk, textSec, inline }) => {
  const isDual = query.includes("\n÷ ");
  const [queryA, queryB] = isDual ? query.split("\n÷ ") : [query, ""];

  const codeStyle = {
    display: "block" as const, fontSize: 12, padding: "8px 12px", borderRadius: 6,
    background: dk ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.04)",
    color: dk ? "#b0b0d0" : "#555", fontFamily: Typography.Code.Small.Default.Family,
    overflowX: "auto" as const, whiteSpace: "pre" as const,
    border: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
  };

  if (inline) {
    return (
      <Flex flexDirection="row" alignItems="baseline" gap={4}>
        <Text style={{ color: dk ? "#7878a0" : "#888" }}>DQL: </Text>
        <Code style={{
          fontSize: 11, fontFamily: Typography.Code.Small.Default.Family, wordBreak: "break-all",
          color: dk ? "#b0b0d0" : "#555", flex: 1,
        }}>{queryA}</Code>
        <CopyBtn text={queryA} dk={dk} small />
      </Flex>
    );
  }

  if (isDual) {
    return (
      <Flex flexDirection="column">
        <Flex flexDirection="row" alignItems="center" justifyContent="space-between" style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: 0.8 }}>Numerator (A)</Text>
          <CopyBtn text={queryA} dk={dk} />
        </Flex>
        <Code style={codeStyle}>{queryA}</Code>
        <Flex flexDirection="row" alignItems="center" justifyContent="center" gap={6} style={{ margin: "6px 0", color: dk ? "#9898b0" : "#888", fontSize: 13 }}>
          <Text style={{ flex: 1, borderBottom: `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}` }} />
          <Strong>÷</Strong>
          <Text style={{ flex: 1, borderBottom: `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}` }} />
        </Flex>
        <Flex flexDirection="row" alignItems="center" justifyContent="space-between" style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: 0.8 }}>Denominator (B)</Text>
          <CopyBtn text={queryB} dk={dk} />
        </Flex>
        <Code style={codeStyle}>{queryB}</Code>
        <Text style={{ fontSize: 11, color: dk ? "#7878a0" : "#999", marginTop: 6, fontStyle: "italic" }}>
          Result = A ÷ B × 100 (cross-entity coverage %)
        </Text>
      </Flex>
    );
  }

  return (
    <Flex flexDirection="column">
      <Flex flexDirection="row" alignItems="center" justifyContent="space-between" style={{ marginBottom: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: 0.8 }}>DQL Query</Text>
        <CopyBtn text={query} dk={dk} />
      </Flex>
      <Code style={codeStyle}>{query}</Code>
    </Flex>
  );
};
