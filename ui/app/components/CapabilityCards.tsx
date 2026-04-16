import React, { useState } from "react";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { CopyableQuery } from "./CopyableQuery";
import { Tooltip } from "./Tooltip";

function isTextSelection(): boolean {
  const sel = window.getSelection();
  return !!(sel && sel.toString().length > 0);
}
import type { CapabilityResult } from "../hooks/useCoverageData";
import { maturity } from "./PolarChart";
import { CRITERION_ACTIONS } from "../remediationActions";
import { CRITERION_IMPORTANCE } from "../data/criterionImportance";
import { CAP_SUMMARIES } from "../data/capSummaries";

interface Props {
  capabilities: CapabilityResult[];
  anim: number;
  activeIdx: number | null;
  onSelect: (idx: number | null) => void;
}

const CriterionRow: React.FC<{ cr: CapabilityResult["criteriaResults"][0]; dk: boolean }> = ({ cr, dk }) => {
  const [open, setOpen] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={`${cr.label}: ${cr.error ? "Error" : cr.points > 0 ? "Passed" : "Not met"}`}
      style={{ borderRadius: 4, cursor: "pointer", transition: "background 0.15s",
        background: "transparent",
      }}
      onClick={(e) => { e.stopPropagation(); if (isTextSelection()) return; setOpen(!open); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen(!open); } }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 12, padding: "4px 6px",
        color: cr.error ? (dk ? "#CD3C44" : "#B02A3A") : (dk ? "#9898b0" : "#5a5a72"),
      }}>
        <Tooltip text={
          <div>
            <div style={{ lineHeight: 1.6, marginBottom: CRITERION_IMPORTANCE[cr.id] ? 8 : 0 }}>{cr.description}</div>
            {CRITERION_IMPORTANCE[cr.id] && <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>{CRITERION_IMPORTANCE[cr.id].split(". ")[0]}.</div>}
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 5 }}>Click to expand details</div>
          </div>
        } maxWidth={320} containerStyle={{ flex: 1 }}>
          <span>{cr.label}</span>
        </Tooltip>
        <span style={{
          fontWeight: 600,
          color: cr.error ? "#CD3C44" : cr.points > 0 ? "#36B37E" : (dk ? "#5e5e78" : "#8e8ea0"),
        }}>
          {cr.error ? "ERR" : cr.points > 0 ? `${cr.value} → ✓` : `${cr.value} → ✗`}
        </span>
      </div>
      {open && (
        <div style={{
          padding: "6px 10px 8px", fontSize: 12, lineHeight: 1.6,
          borderLeft: `2px solid ${dk ? "#4a4a6a" : "#c0c0d0"}`,
          marginLeft: 6, marginBottom: 6,
          color: dk ? "#b0b0d0" : "#444",
        }}>
          <div style={{ fontStyle: "italic", marginBottom: 3, color: dk ? "#c8c8e0" : "#333" }}>
            {cr.description}
          </div>
          <div>
            <CopyableQuery query={cr.query} dk={dk} inline />
          </div>
          <div>
            <span style={{ color: dk ? "#7878a0" : "#888" }}>Pass threshold: </span>
            <span>{cr.thresholds}</span>
          </div>
          <div style={{ fontWeight: 600, color: cr.error ? "#CD3C44" : "#36B37E" }}>
            {cr.error ? "Query failed" : cr.points > 0 ? `${cr.value} found → ✓ Met` : `${cr.value} found → ✗ Not met`}
          </div>
          {(() => {
            const rem = CRITERION_ACTIONS[cr.id];
            if (!rem) return null;
            return (
              <div style={{
                marginTop: 6, paddingTop: 6,
                borderTop: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#5B6ACF" }}>
                    Recommendation
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                    background: cr.points > 0
                      ? (dk ? "rgba(0,200,83,0.12)" : "rgba(0,200,83,0.10)")
                      : (dk ? "rgba(229,57,53,0.12)" : "rgba(229,57,53,0.10)"),
                    color: cr.points > 0 ? "#36B37E" : "#CD3C44",
                    border: `1px solid ${cr.points > 0 ? "rgba(0,200,83,0.3)" : "rgba(229,57,53,0.3)"}`,
                  }}>
                    {cr.points > 0 ? "✓ Applied" : "✗ Not applied"}
                  </span>
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: dk ? "#d0d0e8" : "#333" }}>
                  {rem.action}
                </div>
                <a
                  href={rem.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    marginTop: 4, fontSize: 12, fontWeight: 600,
                    color: "#5B6ACF", textDecoration: "none",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                >
                  📖 {rem.docLabel} →
                </a>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export const CapabilityCards: React.FC<Props> = React.memo(({ capabilities, anim, activeIdx, onSelect }) => {
  const dk = useCurrentTheme() === "dark";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {capabilities.map((cap, i) => {
        const ml = maturity(cap.score);
        const act = activeIdx === i;
        return (
          <div key={i} data-cap-idx={i}
            role="button"
            tabIndex={0}
            aria-expanded={act}
            aria-label={`${cap.name}: ${Math.round(cap.score * anim)}% — ${ml.label}`}
            onClick={(e) => { e.stopPropagation(); if (isTextSelection()) return; onSelect(act ? null : i); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(act ? null : i); } }}
            style={{
              padding: "10px 14px", borderRadius: 10, cursor: "pointer",
              transition: "all 0.3s ease",
              border: act ? `2px solid ${cap.color}` : `1px solid ${Colors.Border.Neutral.Default}`,
              background: Colors.Background.Surface.Default,
              boxShadow: "none",
              opacity: activeIdx !== null && !act ? 0.35 : 1,
            }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", background: cap.color,
                  boxShadow: act ? `0 0 10px ${cap.color}70` : "none",
                }} />
                <span style={{ fontSize: 14, fontWeight: act ? 700 : 500, color: Colors.Text.Neutral.Default }}>
                    {cap.name}
                  </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: cap.color, fontFamily: "system-ui, sans-serif" }}>
                  {Math.round(cap.score * anim)}%
                </span>
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 6,
                  background: ml.color + (dk ? "25" : "18"), color: ml.color, fontWeight: 600,
                }}>{ml.label}</span>
              </div>
            </div>
            <div style={{ height: 4, borderRadius: 3, background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3, background: cap.color,
                width: `${cap.score * anim}%`, transition: "width 1.4s cubic-bezier(0.4,0,0.2,1)",
                opacity: act ? 0.9 : 0.55,
              }} />
            </div>
            {act && (
              <div style={{ marginTop: 6 }}>
                {cap.criteriaResults.map((cr) => (
                  <CriterionRow key={cr.id} cr={cr} dk={dk} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
