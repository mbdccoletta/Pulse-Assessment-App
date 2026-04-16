import React, { useState } from "react";
import Typography from "@dynatrace/strato-design-tokens/typography";

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
    <button
      onClick={handleCopy}
      style={{
        flexShrink: 0, padding: small ? "2px 6px" : "3px 10px", fontSize: 11, cursor: "pointer",
        background: copied ? (dk ? "rgba(0,200,83,0.15)" : "rgba(0,200,83,0.1)") : "transparent",
        border: `1px solid ${copied ? "#36B37E" : (dk ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)")}`,
        borderRadius: 4,
        color: copied ? "#36B37E" : (dk ? "#9898b0" : "#666"),
        fontWeight: 600, transition: "all 0.2s",
      }}
      aria-label={copied ? "Copied" : (label || "Copy query")}
    >{copied ? (small ? "✓" : "✓ Copied") : (small ? "⎘" : "⎘ Copy")}</button>
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
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ color: dk ? "#7878a0" : "#888" }}>DQL: </span>
        <code style={{
          fontSize: 11, fontFamily: Typography.Code.Small.Default.Family, wordBreak: "break-all",
          color: dk ? "#b0b0d0" : "#555", flex: 1,
        }}>{queryA}</code>
        <CopyBtn text={queryA} dk={dk} small />
      </div>
    );
  }

  if (isDual) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: 0.8 }}>Numerator (A)</div>
          <CopyBtn text={queryA} dk={dk} />
        </div>
        <code style={codeStyle}>{queryA}</code>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: "6px 0", color: dk ? "#9898b0" : "#888", fontSize: 13 }}>
          <span style={{ flex: 1, borderBottom: `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}` }} />
          <span style={{ fontWeight: 700 }}>÷</span>
          <span style={{ flex: 1, borderBottom: `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}` }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: 0.8 }}>Denominator (B)</div>
          <CopyBtn text={queryB} dk={dk} />
        </div>
        <code style={codeStyle}>{queryB}</code>
        <div style={{ fontSize: 11, color: dk ? "#7878a0" : "#999", marginTop: 6, fontStyle: "italic" }}>
          Result = A ÷ B × 100 (cross-entity coverage %)
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: 0.8 }}>DQL Query</div>
        <CopyBtn text={query} dk={dk} />
      </div>
      <code style={codeStyle}>{query}</code>
    </div>
  );
};
