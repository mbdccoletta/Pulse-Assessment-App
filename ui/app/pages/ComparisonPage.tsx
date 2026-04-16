import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Tooltip } from "../components/Tooltip";
import { CRITERION_ACTIONS } from "../remediationActions";
import { CRITERION_TIERS } from "../data/criterionTiers";
import { CAPABILITIES } from "../queries";
import type { AssessmentSnapshot } from "../hooks/useAssessmentHistory";
import type { CoverageData, CapabilityResult } from "../hooks/useCoverageData";
import { FOUNDATION_WEIGHT, BEST_PRACTICE_WEIGHT, EXCELLENCE_WEIGHT } from "../hooks/useCoverageData";

/** Lookup: criterion ID → true if it uses cross-entity ratio (queryB). Derived from static CAPABILITIES definition. */
const IS_RATIO_MAP: Record<string, boolean> = {};
for (const cap of CAPABILITIES) for (const cr of cap.criteria) if (cr.queryB) IS_RATIO_MAP[cr.id] = true;

interface CritDiff {
  id: string;
  label: string;
  currValue: number;
  prevValue: number;
  currPoints: number;
  prevPoints: number;
  pointsDelta: number;
  currError: boolean;
  prevError: boolean;
  isRatio: boolean;
}

interface CapDiff {
  name: string;
  color: string;
  currScore: number;
  prevScore: number;
  delta: number;
  currMaturity: number;
  prevMaturity: number;
  maturityDelta: number;
  critDiffs: CritDiff[];
  improved: CritDiff[];
  degraded: CritDiff[];
  unchanged: CritDiff[];
}

interface Props {
  snapshots: AssessmentSnapshot[];
  coverageData: CoverageData;
  saveSnapshot: (capabilities: CapabilityResult[], totalScore: number, tenant: string) => void;
}

/* ── helpers ── */
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

import { scoreColor } from "../utils/colors";

function deltaColor(d: number) {
  if (d > 0) return "#36B37E";
  if (d < 0) return "#CD3C44";
  return "#8e8ea0";
}

/** Compute maturity score for a capability's criteria using the CRITERION_TIERS lookup */
function computeMaturity(criteria: { id: string; points: number; error: boolean }[]): number {
  const tiers = { foundation: { total: 0, passed: 0 }, bestPractice: { total: 0, passed: 0 }, excellence: { total: 0, passed: 0 } };
  for (const cr of criteria) {
    const t = CRITERION_TIERS[cr.id] || "foundation";
    tiers[t].total++;
    if (!cr.error && cr.points > 0) tiers[t].passed++;
  }
  const fPct = tiers.foundation.total > 0 ? tiers.foundation.passed / tiers.foundation.total : 0;
  const bPct = tiers.bestPractice.total > 0 ? tiers.bestPractice.passed / tiers.bestPractice.total : 0;
  const ePct = tiers.excellence.total > 0 ? tiers.excellence.passed / tiers.excellence.total : 0;
  // Progressive: BP only counts if Foundation >= 80%, Excellence only if BP >= 60%
  const effB = fPct >= 0.8 ? bPct : 0;
  const effE = effB >= 0.6 ? ePct : 0;
  return Math.round(fPct * FOUNDATION_WEIGHT + effB * BEST_PRACTICE_WEIGHT + effE * EXCELLENCE_WEIGHT);
}

export const ComparisonPage: React.FC<Props> = ({ snapshots, coverageData, saveSnapshot }) => {
  const dk = useCurrentTheme() === "dark";
  const navigate = useNavigate();

  // Last 12 snapshots available for comparison
  const available = useMemo(() => snapshots.slice(0, 12), [snapshots]);
  const [idxA, setIdxA] = useState(0);                 // A = newer (default: most recent)
  const [idxB, setIdxB] = useState(available.length > 1 ? 1 : 0); // B = older (default: second)
  const [selectedCap, setSelectedCap] = useState<string | null>(null);
  const [showListA, setShowListA] = useState(false);
  const [showListB, setShowListB] = useState(false);
  const [dimension, setDimension] = useState<"coverage" | "maturity">("coverage");

  const bg = Colors.Background.Base.Default;
  const text = Colors.Text.Neutral.Default;
  const textSec = Colors.Text.Neutral.Subdued;
  const textTert = dk ? "#9a9abc" : "#6e6e82";
  const card = Colors.Background.Container.Neutral.Default;
  const border = Colors.Border.Neutral.Default;

  const snapA = available[idxA] ?? null;
  const snapB = available[idxB] ?? null;

  const comparison = useMemo(() => {
    if (!snapA || !snapB || idxA === idxB) return null;

    const capDiffs = snapA.capabilities.map((cc) => {
      const pc = snapB.capabilities.find((p) => p.name === cc.name);
      const prevScore = pc?.score ?? 0;
      const d = cc.score - prevScore;

      const critDiffs = cc.criteriaResults.map((cr) => {
        const pcr = pc?.criteriaResults.find((p) => p.id === cr.id);
        return {
          id: cr.id,
          label: cr.label,
          currValue: cr.value,
          prevValue: pcr?.value ?? 0,
          currPoints: cr.points,
          prevPoints: pcr?.points ?? 0,
          pointsDelta: cr.points - (pcr?.points ?? 0),
          currError: cr.error,
          prevError: pcr?.error ?? true,
          isRatio: !!IS_RATIO_MAP[cr.id],
        };
      });

      const currMat = computeMaturity(cc.criteriaResults);
      const prevMat = pc ? computeMaturity(pc.criteriaResults) : 0;

      return {
        name: cc.name,
        color: cc.color,
        currScore: cc.score,
        prevScore,
        delta: d,
        currMaturity: currMat,
        prevMaturity: prevMat,
        maturityDelta: currMat - prevMat,
        critDiffs,
        improved: critDiffs.filter((c) => c.pointsDelta > 0),
        degraded: critDiffs.filter((c) => c.pointsDelta < 0),
        unchanged: critDiffs.filter((c) => c.pointsDelta === 0),
      };
    });

    const elapsed = new Date(snapA.timestamp).getTime() - new Date(snapB.timestamp).getTime();
    const absDays = Math.round(Math.abs(elapsed) / 86400_000);
    const absHours = Math.round(Math.abs(elapsed) / 3600_000);
    const timeSpan = absDays >= 1 ? `${absDays} day${absDays !== 1 ? "s" : ""}` : `${absHours} hour${absHours !== 1 ? "s" : ""}`;

    const baselineMat = capDiffs.length > 0 ? Math.round(capDiffs.reduce((s, c) => s + c.prevMaturity, 0) / capDiffs.length) : 0;
    const currentMat = capDiffs.length > 0 ? Math.round(capDiffs.reduce((s, c) => s + c.currMaturity, 0) / capDiffs.length) : 0;

    return {
      baseline: { timestamp: snapB.timestamp, totalScore: snapB.totalScore },
      current: { timestamp: snapA.timestamp, totalScore: snapA.totalScore },
      totalDelta: snapA.totalScore - snapB.totalScore,
      baselineMaturity: baselineMat,
      currentMaturity: currentMat,
      maturityDelta: currentMat - baselineMat,
      timeSpan,
      capDiffs,
      improved: capDiffs.filter((c) => c.delta > 0),
      degraded: capDiffs.filter((c) => c.delta < 0),
      unchanged: capDiffs.filter((c) => c.delta === 0),
    };
  }, [snapA, snapB, idxA, idxB]);

  /* ── Empty state ── */
  if (available.length < 2) {
    return (
      <div style={{ fontFamily: "inherit", background: bg, color: text, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Not enough data</div>
        <div style={{ fontSize: 13, color: textSec, textAlign: "center", maxWidth: 320 }}>
          Run the assessment at least twice to compare evolution over time. Each run is saved automatically.
        </div>
        <button onClick={() => navigate("/")} style={{
          marginTop: 8, padding: "8px 20px", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6,
          border: `1px solid ${border}`, background: dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
          color: text,
        }}>← Back to Overview</button>
      </div>
    );
  }

  const snapPickerBtn = (label: string, snap: AssessmentSnapshot | null, isOpen: boolean, toggle: () => void, color: string) => {
    const mat = snap ? Math.round(snap.capabilities.reduce((s, c) => s + computeMaturity(c.criteriaResults), 0) / (snap.capabilities.length || 1)) : 0;
    return (
    <button onClick={(e) => { e.stopPropagation(); toggle(); }} style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 8,
      border: `1px solid ${color}55`,
      background: dk ? `${color}15` : `${color}08`,
      color: text, minWidth: 200, position: "relative",
    }}>
      <span style={{ fontWeight: 800, color, fontSize: 13 }}>{label}</span>
      {snap ? (
        <>
          <span>{fmtShort(snap.timestamp)}</span>
          <span style={{ fontWeight: 700, color }}>C{snap.totalScore}%</span>
          <span style={{ color: dk ? "#B07AE8" : "#7C3AED", fontWeight: 600, fontSize: 11 }}>M{mat}%</span>
          <span style={{ color: textTert, fontSize: 11 }}>{relativeTime(snap.timestamp)}</span>
        </>
      ) : (
        <span style={{ color: textTert, fontStyle: "italic" }}>Select…</span>
      )}
      <span style={{ marginLeft: "auto", fontSize: 10, color: textTert }}>{isOpen ? "▲" : "▼"}</span>
    </button>
    );
  };

  const snapDropdown = (selectedIdx: number, onSelect: (i: number) => void, otherIdx: number, color: string) => (
    <div style={{
      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, marginTop: 4,
      background: card, border: `1px solid ${border}`, borderRadius: 8,
      maxHeight: 260, overflowY: "auto", boxShadow: dk ? "0 8px 24px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.15)",
    }}>
      {available.map((snap, i) => {
        const isSelected = i === selectedIdx;
        const isDisabled = i === otherIdx;
        const mat = Math.round(snap.capabilities.reduce((s, c) => s + computeMaturity(c.criteriaResults), 0) / (snap.capabilities.length || 1));
        return (
          <div key={snap.id}
            onClick={(e) => { e.stopPropagation(); if (!isDisabled) onSelect(i); }}
            style={{
              padding: "8px 14px", cursor: isDisabled ? "not-allowed" : "pointer", fontSize: 12,
              display: "flex", alignItems: "center", gap: 10,
              opacity: isDisabled ? 0.35 : 1,
              background: isSelected ? (dk ? `${color}18` : `${color}0A`) : "transparent",
              borderLeft: isSelected ? `3px solid ${color}` : "3px solid transparent",
            }}>
            <span style={{ flex: 1 }}>{fmtShort(snap.timestamp)}</span>
            <span style={{ fontWeight: 700, minWidth: 36, textAlign: "right" }}>C{snap.totalScore}%</span>
            <span style={{ color: dk ? "#B07AE8" : "#7C3AED", fontWeight: 600, fontSize: 11, minWidth: 36, textAlign: "right" }}>M{mat}%</span>
            <span style={{ color: textTert, fontSize: 11, minWidth: 64, textAlign: "right" }}>{relativeTime(snap.timestamp)}</span>
            {isSelected && <span style={{ color, fontSize: 11, fontWeight: 700 }}>●</span>}
          </div>
        );
      })}
    </div>
  );

  return (
    <div onClick={() => { setSelectedCap(null); setShowListA(false); setShowListB(false); }} style={{ fontFamily: "inherit", background: bg, color: text, minHeight: "100vh", padding: "8px 12px", overflow: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Tooltip text="Return to the main assessment page." position="bottom">
        <button onClick={() => navigate("/")} style={{
          padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6,
          border: `1px solid ${border}`, background: dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
          color: text,
        }}>← Back</button>
        </Tooltip>
        <div style={{ flex: 1 }}>
          <Tooltip text="Compare two assessment snapshots side by side. Select Snapshot A and Snapshot B to see differences." position="bottom">
          <div style={{ fontSize: 16, fontWeight: 700, display: "inline-block" }}>Evolution Over Time</div>
          </Tooltip>
          <div style={{ fontSize: 12, color: textSec }}>
            {comparison
              ? `Comparing ${fmtShort(comparison.baseline.timestamp)} → ${fmtShort(comparison.current.timestamp)} (${comparison.timeSpan})`
              : "Select two different snapshots to compare"}
          </div>
        </div>
      </div>

      {/* A/B Snapshot Selectors */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ position: "relative" }}>
          {snapPickerBtn("A", snapA, showListA, () => { setShowListA(v => !v); setShowListB(false); }, "#4169E1")}
          {showListA && snapDropdown(idxA, (i) => { setIdxA(i); setShowListA(false); }, idxB, "#4169E1")}
        </div>
        <div style={{ display: "flex", alignItems: "center", color: textTert, fontSize: 16, fontWeight: 700 }}>vs</div>
        <div style={{ position: "relative" }}>
          {snapPickerBtn("B", snapB, showListB, () => { setShowListB(v => !v); setShowListA(false); }, "#E17041")}
          {showListB && snapDropdown(idxB, (i) => { setIdxB(i); setShowListB(false); }, idxA, "#E17041")}
        </div>
      </div>

      {idxA === idxB && (
        <div style={{ textAlign: "center", padding: 40, color: textSec, fontSize: 13 }}>Select two different snapshots to compare.</div>
      )}

      {comparison && (
        <>
          {/* Time context banner */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 16, padding: "10px 16px",
            background: dk ? "rgba(65,105,225,0.06)" : "rgba(65,105,225,0.04)", border: `1px solid ${dk ? "rgba(65,105,225,0.15)" : "rgba(65,105,225,0.1)"}`, borderRadius: 8,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#E17041", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>B (Older)</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtShort(comparison.baseline.timestamp)}</div>
              <div style={{ fontSize: 11, color: textTert }}>{relativeTime(comparison.baseline.timestamp)}</div>
            </div>
            <div style={{ fontSize: 11, color: textTert }}>
              <div style={{ textAlign: "center", fontSize: 18 }}>→</div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{comparison.timeSpan}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#4169E1", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>A (Newer)</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtShort(comparison.current.timestamp)}</div>
              <div style={{ fontSize: 11, color: textTert }}>{relativeTime(comparison.current.timestamp)}</div>
            </div>
          </div>

          {/* KPI Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
            <KpiCard dk={dk} card={card} border={border} label="Coverage" value={`${comparison.baseline.totalScore}% → ${comparison.current.totalScore}%`}
              sub={<span style={{ color: deltaColor(comparison.totalDelta), fontWeight: 700, fontSize: 14 }}>{comparison.totalDelta > 0 ? "+" : ""}{comparison.totalDelta}%</span>} />
            <KpiCard dk={dk} card={card} border={border} label="Maturity" value={`${comparison.baselineMaturity}% → ${comparison.currentMaturity}%`}
              sub={<span style={{ color: deltaColor(comparison.maturityDelta), fontWeight: 700, fontSize: 14 }}>{comparison.maturityDelta > 0 ? "+" : ""}{comparison.maturityDelta}%</span>} />
            <KpiCard dk={dk} card={card} border={border} label="Improved" value={`${comparison.improved.length}`}
              sub={<span style={{ color: "#00C853", fontSize: 11 }}>capabilities improved</span>}
              accent="#00C853" />
            <KpiCard dk={dk} card={card} border={border} label="Degraded" value={`${comparison.degraded.length}`}
              sub={<span style={{ color: "#E53935", fontSize: 11 }}>capabilities degraded</span>}
              accent="#E53935" />
            <KpiCard dk={dk} card={card} border={border} label="Unchanged" value={`${comparison.unchanged.length}`}
              sub={<span style={{ color: textTert, fontSize: 11 }}>capabilities stable</span>} />
          </div>

          {/* ══════ DIMENSION TOGGLE + RADAR + CAPABILITY BARS ══════ */}
          <div style={{ marginBottom: 24 }}>
            {/* Coverage / Maturity toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
              {(["coverage", "maturity"] as const).map((dim) => {
                const active = dimension === dim;
                const color = dim === "coverage" ? (dk ? "#4C9AFF" : "#2962FF") : (dk ? "#B07AE8" : "#7C3AED");
                return (
                  <button key={dim} onClick={() => setDimension(dim)} style={{
                    padding: "6px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 6,
                    border: active ? `2px solid ${color}` : `1px solid ${border}`,
                    background: active ? (dk ? `${color}18` : `${color}0C`) : "transparent",
                    color: active ? color : textSec,
                    textTransform: "uppercase", letterSpacing: 1,
                    transition: "all 0.15s ease",
                  }}>{dim}</button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0, position: "sticky", top: 0 }}>
                <ComparisonRadar capDiffs={comparison.capDiffs} dk={dk} card={card} border={border} textSec={textSec} textTert={textTert} dimension={dimension} onCapClick={(name) => setSelectedCap(selectedCap === name ? null : name)} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: textSec }}>Score per Capability</div>
                  {comparison.capDiffs.map((cap) => (
                    <CapabilityBar key={cap.name} cap={cap} dk={dk} border={border} textSec={textSec} textTert={textTert} dimension={dimension} forceOpen={selectedCap === cap.name} onHeaderClick={() => setSelectedCap(selectedCap === cap.name ? null : cap.name)} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ══════ DETAILED CHANGES ══════ */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Detailed Criteria Changes</div>
              {comparison.improved.length > 0 && (
                <DetailSection title="Improvements" icon="↑" color="#00C853" caps={comparison.improved} dk={dk} card={card} border={border} textSec={textSec} textTert={textTert} embedded />
              )}
              {comparison.degraded.length > 0 && (
                <div style={{ marginTop: comparison.improved.length > 0 ? 0 : 0 }}>
                  <DetailSection title="Regressions" icon="↓" color="#E53935" caps={comparison.degraded} dk={dk} card={card} border={border} textSec={textSec} textTert={textTert} embedded />
                </div>
              )}
              {comparison.unchanged.length > 0 && (
                <div style={{ marginTop: 12, padding: "10px 0 0 0", borderTop: `1px solid ${border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: textTert, marginBottom: 8 }}>Unchanged ({comparison.unchanged.length})</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {comparison.unchanged.map((cap) => (
                      <div key={cap.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, border: `1px solid ${border}`, fontSize: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: cap.color }} />
                        <span style={{ fontWeight: 600 }}>{cap.name}</span>
                        <span style={{ color: textTert }}>{cap.currScore}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
};

/* ── Sub-components ── */

/* ── Radar Chart ── */
function ComparisonRadar({ capDiffs, dk, card, border, textSec, textTert, onCapClick, dimension = "coverage" }: {
  capDiffs: CapDiff[]; dk: boolean; card: string; border: string; textSec: string; textTert: string; onCapClick?: (name: string) => void; dimension?: "coverage" | "maturity";
}) {
  const isMat = dimension === "maturity";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const rafRef = useRef(0);
  const dotPtsRef = useRef<{ x: number; y: number; idx: number }[]>([]);
  const prevDotPtsRef = useRef<{ x: number; y: number; idx: number }[]>([]);
  const labelPtsRef = useRef<{ x: number; y: number; w: number; h: number; idx: number }[]>([]);
  const radarGeoRef = useRef<{ cx: number; cy: number; R: number; N: number; SEG: number }>({ cx: 0, cy: 0, R: 0, N: 0, SEG: 0 });
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number; series: "curr" | "prev" } | null>(null);

  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr;
    ctx.scale(dpr, dpr);

    const N = capDiffs.length;
    if (N < 3) return;
    const cx = W / 2, cy = H / 2;
    const R = Math.min(cx, cy) - 90;
    const SEG = (Math.PI * 2) / N;
    const t = animRef.current;

    ctx.clearRect(0, 0, W, H);

    // Color palette — deep purple/blue like the reference
    const accentA = dk ? "#7B68EE" : "#5B4FCF"; // Current (solid purple)
    const accentB = dk ? "rgba(180,160,255,0.5)" : "rgba(120,100,200,0.5)"; // Previous (dashed)
    const fillA = dk ? "rgba(90,70,200,0.18)" : "rgba(90,70,200,0.12)";
    const fillB = dk ? "rgba(180,160,255,0.06)" : "rgba(120,100,200,0.06)";

    // Grid rings — concentric polygons (not circles, matching reference)
    for (let g = 1; g <= 5; g++) {
      const gr = (g / 5) * R;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = i * SEG - Math.PI / 2;
        const px = cx + Math.cos(a) * gr, py = cy + Math.sin(a) * gr;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
      ctx.lineWidth = g === 5 ? 1 : 0.5;
      ctx.stroke();

      // % label on the vertical axis
      ctx.fillStyle = dk ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
      ctx.font = "500 9px system-ui,sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${g * 20}`, cx + 4, cy - gr - 2);
    }

    // Axis lines
    for (let i = 0; i < N; i++) {
      const a = i * SEG - Math.PI / 2;
      const ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey);
      ctx.strokeStyle = dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
      ctx.lineWidth = 0.5; ctx.stroke();
    }

    // -- Compute polygon points --
    function polyPts(scores: number[]): { x: number; y: number }[] {
      return scores.map((s, i) => {
        const a = i * SEG - Math.PI / 2;
        const r = (s / 100) * R * t;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
      });
    }

    const prevPts = polyPts(capDiffs.map((c) => isMat ? c.prevMaturity : c.prevScore));
    const currPts = polyPts(capDiffs.map((c) => isMat ? c.currMaturity : c.currScore));

    // -- Previous polygon (B) — filled + dashed border --
    ctx.save();
    ctx.beginPath();
    prevPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = fillB;
    ctx.fill();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = accentB;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Previous dots — capability color (dimmed)
    const prevDotPositions: { x: number; y: number; idx: number }[] = [];
    prevPts.forEach((p, i) => {
      const capColor = capDiffs[i].color || (dk ? "rgba(180,160,255,0.4)" : "rgba(120,100,200,0.35)");
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = capColor;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = dk ? "#0d0d1a" : "#ffffff";
      ctx.fill();
      prevDotPositions.push({ x: p.x, y: p.y, idx: i });
    });
    prevDotPtsRef.current = prevDotPositions;

    // -- Current polygon (A) — filled + solid border with glow --
    ctx.save();
    ctx.shadowColor = accentA;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    currPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = fillA;
    ctx.fill();
    ctx.restore();

    // Solid border
    ctx.save();
    ctx.shadowColor = accentA;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    currPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.strokeStyle = accentA;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Current dots — colored by capability
    const dotPositions: { x: number; y: number; idx: number }[] = [];
    currPts.forEach((p, i) => {
      const capColor = capDiffs[i].color || accentA;
      ctx.save();
      ctx.shadowColor = capColor;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = capColor;
      ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = dk ? "#0d0d1a" : "#ffffff";
      ctx.fill();
      dotPositions.push({ x: p.x, y: p.y, idx: i });
    });
    dotPtsRef.current = dotPositions;
    radarGeoRef.current = { cx, cy, R, N, SEG };

    // -- Connector lines + Labels around the chart --
    const labelPositions: { x: number; y: number; w: number; h: number; idx: number }[] = [];
    for (let i = 0; i < N; i++) {
      const a = i * SEG - Math.PI / 2;
      const cosA = Math.cos(a), sinA = Math.sin(a);

      // Connector line from chart edge to label area
      const connStart = R + 4;
      const connEnd = R + 16;
      const sx = cx + cosA * connStart, sy = cy + sinA * connStart;
      const ex = cx + cosA * connEnd, ey = cy + sinA * connEnd;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
      ctx.strokeStyle = dk ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)";
      ctx.lineWidth = 1; ctx.stroke();

      // Small dot at connector end
      ctx.beginPath(); ctx.arc(ex, ey, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = dk ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)";
      ctx.fill();

      const labelDist = R + 28;
      const lx = cx + cosA * labelDist;
      const ly = cy + sinA * labelDist;

      ctx.save();
      const align = cosA < -0.1 ? "right" as const : cosA > 0.1 ? "left" as const : "center" as const;
      ctx.textAlign = align;

      // Text shadow for readability
      ctx.shadowColor = dk ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)";
      ctx.shadowBlur = 4;

      // Score line: "X → Y"
      const scoreY = sinA < -0.1 ? ly - 2 : sinA > 0.1 ? ly + 2 : ly;
      ctx.textBaseline = sinA < -0.1 ? "bottom" : sinA > 0.1 ? "top" : "middle";
      ctx.font = "600 11px system-ui,sans-serif";
      ctx.fillStyle = dk ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)";
      const pScore = isMat ? capDiffs[i].prevMaturity : capDiffs[i].prevScore;
      const cScore = isMat ? capDiffs[i].currMaturity : capDiffs[i].currScore;
      const scoreText = `${pScore} → ${cScore}`;
      ctx.fillText(scoreText, lx, scoreY);

      // Capability name — bold, larger, below/above score
      const nameY = sinA < -0.1 ? scoreY - 16 : sinA > 0.1 ? scoreY + 16 : ly + 16;
      ctx.textBaseline = sinA < -0.1 ? "bottom" : "top";
      ctx.font = "800 12px system-ui,sans-serif";
      ctx.fillStyle = dk ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.8)";
      ctx.fillText(capDiffs[i].name, lx, nameY);

      // Store label hit zone
      const nameW = ctx.measureText(capDiffs[i].name).width;
      const hitX = align === "right" ? lx - nameW - 4 : align === "center" ? lx - nameW / 2 - 4 : lx - 4;
      labelPositions.push({ x: hitX, y: Math.min(scoreY, nameY) - 10, w: nameW + 8, h: 36, idx: i });

      // Delta in parentheses, colored and bold
      const d = isMat ? capDiffs[i].maturityDelta : capDiffs[i].delta;
      if (d !== 0) {
        ctx.font = "600 11px system-ui,sans-serif";
        const scoreW = ctx.measureText(scoreText).width;
        const dText = `  (${d > 0 ? "+" : ""}${d})`;
        ctx.font = "800 11px system-ui,sans-serif";
        ctx.fillStyle = d > 0 ? "#00E676" : "#FF5252";
        ctx.shadowColor = d > 0 ? "rgba(0,230,118,0.3)" : "rgba(255,82,82,0.3)";
        ctx.shadowBlur = 6;
        ctx.textBaseline = sinA < -0.1 ? "bottom" : sinA > 0.1 ? "top" : "middle";
        if (align === "right") {
          ctx.textAlign = "right";
          ctx.fillText(dText, lx - scoreW, scoreY);
        } else if (align === "left") {
          ctx.textAlign = "left";
          ctx.fillText(dText, lx + scoreW, scoreY);
        } else {
          ctx.textAlign = "left";
          ctx.fillText(dText, lx + scoreW / 2, scoreY);
        }
      }

      ctx.restore();
    }
    labelPtsRef.current = labelPositions;
  }, [capDiffs, dk, isMat]);

  useEffect(() => {
    let start = 0;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      animRef.current = Math.min(1, elapsed / 800);
      draw();
      if (elapsed < 1000) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <div style={{
      background: card, border: `1px solid ${border}`, borderRadius: 10,
      padding: "16px 16px 12px",
      position: "relative",
    }}>
      <canvas ref={canvasRef} role="img" aria-label={`Comparison radar chart showing ${dimension} scores`} style={{ width: "100%", height: 420, display: "block", cursor: "default" }}
        onClick={(e) => {
          e.stopPropagation();
          if (!onCapClick) return;
          const rect = canvasRef.current!.getBoundingClientRect();
          const mx = e.clientX - rect.left, my = e.clientY - rect.top;
          // Hit test: dots
          for (const dot of dotPtsRef.current) {
            const dx = mx - dot.x, dy = my - dot.y;
            if (dx * dx + dy * dy <= 14 * 14) { onCapClick(capDiffs[dot.idx].name); return; }
          }
          // Hit test: labels
          for (const lb of labelPtsRef.current) {
            if (mx >= lb.x && mx <= lb.x + lb.w && my >= lb.y && my <= lb.y + lb.h) { onCapClick(capDiffs[lb.idx].name); return; }
          }
          // Hit test: axis lines (distance from line cx,cy → axis end)
          const geo = radarGeoRef.current;
          if (geo.N > 0) {
            for (let i = 0; i < geo.N; i++) {
              const a = i * geo.SEG - Math.PI / 2;
              const ex = geo.cx + Math.cos(a) * geo.R, ey = geo.cy + Math.sin(a) * geo.R;
              const dx = ex - geo.cx, dy = ey - geo.cy;
              const len2 = dx * dx + dy * dy;
              const t = Math.max(0, Math.min(1, ((mx - geo.cx) * dx + (my - geo.cy) * dy) / len2));
              const px = geo.cx + t * dx, py = geo.cy + t * dy;
              const dist2 = (mx - px) * (mx - px) + (my - py) * (my - py);
              if (dist2 <= 10 * 10 && t > 0.15) { onCapClick(capDiffs[i].name); return; }
            }
          }
        }}
        onMouseMove={(e) => {
          const rect = canvasRef.current!.getBoundingClientRect();
          const mx = e.clientX - rect.left, my = e.clientY - rect.top;
          let hit = false;
          let newTooltip: { idx: number; x: number; y: number; series: "curr" | "prev" } | null = null;
          // Current dots
          for (const dot of dotPtsRef.current) {
            const dx = mx - dot.x, dy = my - dot.y;
            if (dx * dx + dy * dy <= 14 * 14) { hit = true; newTooltip = { idx: dot.idx, x: dot.x, y: dot.y, series: "curr" }; break; }
          }
          // Previous dots
          if (!newTooltip) {
            for (const dot of prevDotPtsRef.current) {
              const dx = mx - dot.x, dy = my - dot.y;
              if (dx * dx + dy * dy <= 14 * 14) { hit = true; newTooltip = { idx: dot.idx, x: dot.x, y: dot.y, series: "prev" }; break; }
            }
          }
          // Labels
          if (!hit) {
            for (const lb of labelPtsRef.current) {
              if (mx >= lb.x && mx <= lb.x + lb.w && my >= lb.y && my <= lb.y + lb.h) { hit = true; newTooltip = { idx: lb.idx, x: mx, y: lb.y, series: "curr" }; break; }
            }
          }
          // Axis lines
          if (!hit) {
            const geo = radarGeoRef.current;
            if (geo.N > 0) {
              for (let i = 0; i < geo.N; i++) {
                const a = i * geo.SEG - Math.PI / 2;
                const ex = geo.cx + Math.cos(a) * geo.R, ey = geo.cy + Math.sin(a) * geo.R;
                const dx = ex - geo.cx, dy = ey - geo.cy;
                const len2 = dx * dx + dy * dy;
                const t = Math.max(0, Math.min(1, ((mx - geo.cx) * dx + (my - geo.cy) * dy) / len2));
                const px = geo.cx + t * dx, py = geo.cy + t * dy;
                const dist2 = (mx - px) * (mx - px) + (my - py) * (my - py);
                if (dist2 <= 10 * 10 && t > 0.15) { hit = true; newTooltip = { idx: i, x: mx, y: my, series: "curr" }; break; }
              }
            }
          }
          setTooltip(newTooltip);
          canvasRef.current!.style.cursor = hit ? "pointer" : "default";
        }}
        onMouseLeave={() => setTooltip(null)}
      />

      {/* Hover tooltip */}
      {tooltip && (() => {
        const cap = capDiffs[tooltip.idx];
        const prevScore = isMat ? cap.prevMaturity : cap.prevScore;
        const currScore = isMat ? cap.currMaturity : cap.currScore;
        const improved = cap.improved.length;
        const degraded = cap.degraded.length;
        const unchanged = cap.unchanged.length;
        const tipW = 210, tipH = 120;
        let tx = tooltip.x + 14;
        let ty = tooltip.y - tipH - 8;
        // Keep within bounds
        const cEl = canvasRef.current;
        if (cEl) {
          const cW = cEl.clientWidth;
          if (tx + tipW > cW - 8) tx = tooltip.x - tipW - 14;
          if (ty < 4) ty = tooltip.y + 14;
        }
        return (
          <div style={{
            position: "absolute", left: tx, top: ty, width: tipW,
            background: dk ? "rgba(20,20,35,0.96)" : "rgba(255,255,255,0.98)",
            border: `1px solid ${dk ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`,
            borderRadius: 8, padding: "10px 12px",
            boxShadow: dk ? "0 4px 20px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.12)",
            pointerEvents: "none", zIndex: 50,
            fontSize: 12, color: dk ? "#e8e8f0" : "#1a1a2e",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: cap.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 800, fontSize: 13 }}>{cap.name}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: dk ? "rgba(180,160,255,0.7)" : "rgba(120,100,200,0.7)" }}>Previous (B)</span>
              <span style={{ fontWeight: 700 }}>{prevScore}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: dk ? "#a8a8d0" : "#5a5a7e" }}>Current (A)</span>
              <span style={{ fontWeight: 700 }}>{currScore}%</span>
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 10, color: dk ? "#8e8ea0" : "#6e6e88" }}>
              {improved > 0 && <span style={{ color: "#00C853" }}>▲ {improved} improved</span>}
              {degraded > 0 && <span style={{ color: "#E53935" }}>▼ {degraded} regressed</span>}
              {unchanged > 0 && <span>● {unchanged} equal</span>}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: dk ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)", fontStyle: "italic" }}>Click to drill down</div>
          </div>
        );
      })()}

      {/* Legend at bottom */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, justifyContent: "center", paddingTop: 8, fontSize: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 18, height: 2, background: dk ? "#7B68EE" : "#5B4FCF", borderRadius: 1 }} />
          <span style={{ color: textSec }}>A (Newer)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 18, height: 0, borderTop: `2px dashed ${dk ? "rgba(180,160,255,0.5)" : "rgba(120,100,200,0.5)"}` }} />
          <span style={{ color: textSec }}>B (Older)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00C853" }} />
          <span style={{ color: textSec }}>Better</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#E53935" }} />
          <span style={{ color: textSec }}>Worse</span>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ dk, card, border, label, value, sub, accent }: { dk: boolean; card: string; border: string; label: string; value: string; sub: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: card, border: `1px solid ${accent ? accent + "33" : border}`, borderRadius: 8, padding: 14, textAlign: "center" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: accent || (dk ? "#8e8ea0" : "#6e6e88"), marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent || (dk ? "#e8e8f0" : "#1a1a2e") }}>{value}</div>
      <div style={{ marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function CapabilityBar({ cap, dk, border, textSec, textTert, forceOpen, onHeaderClick, dimension = "coverage" }: { cap: CapDiff; dk: boolean; border: string; textSec: string; textTert: string; forceOpen?: boolean; onHeaderClick?: () => void; dimension?: "coverage" | "maturity" }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = forceOpen ?? localOpen;
  const isMat = dimension === "maturity";
  const prev = isMat ? cap.prevMaturity : cap.prevScore;
  const curr = isMat ? cap.currMaturity : cap.currScore;
  const d = isMat ? cap.maturityDelta : cap.delta;
  const capBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forceOpen && capBarRef.current) {
      capBarRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [forceOpen]);

  return (
    <div ref={capBarRef} style={{ marginBottom: 8 }}>
      <div onClick={(e) => { e.stopPropagation(); if (onHeaderClick) onHeaderClick(); else setLocalOpen(!localOpen); }}
        role="button" tabIndex={0} aria-expanded={open}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (onHeaderClick) onHeaderClick(); else setLocalOpen(!localOpen); } }}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer", borderBottom: `1px solid ${border}` }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: cap.color, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{cap.name}</span>
        <span style={{ fontSize: 12, color: textSec, fontVariantNumeric: "tabular-nums" }}>{prev}%</span>
        <span style={{ fontSize: 12, color: textTert }}>→</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(curr), fontVariantNumeric: "tabular-nums" }}>{curr}%</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: deltaColor(d), minWidth: 42, textAlign: "right" }}>{d > 0 ? "+" : ""}{d}%</span>
        <span style={{ fontSize: 11, color: textTert, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▾</span>
      </div>
      {/* Score bar */}
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4, marginLeft: 18 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", position: "relative", overflow: "hidden" }}>
          {/* Previous score ghost bar */}
          <div style={{ position: "absolute", height: "100%", width: `${prev}%`, background: dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", borderRadius: 3 }} />
          {/* Current score bar */}
          <div style={{ position: "absolute", height: "100%", width: `${curr}%`, background: cap.color, borderRadius: 3, opacity: 0.7, transition: "width 0.5s" }} />
        </div>
      </div>
      {/* Expandable criteria details */}
      {open && (() => {
        const changed = cap.critDiffs.filter((c) => c.pointsDelta !== 0);
        const improvable = cap.critDiffs.filter((c) => c.pointsDelta === 0 && c.currPoints === 0);
        const healthy = cap.critDiffs.filter((c) => c.pointsDelta === 0 && c.currPoints > 0);

        /* tier grouping helpers for maturity view */
        const tierLabel: Record<string, string> = { foundation: "Foundation", bestPractice: "Best Practice", excellence: "Excellence" };
        const tierColor: Record<string, string> = { foundation: "#3B82F6", bestPractice: "#F59E0B", excellence: "#8B5CF6" };
        const tierOrder = ["foundation", "bestPractice", "excellence"] as const;
        const groupByTier = (list: typeof cap.critDiffs) => {
          const groups: Record<string, typeof list> = { foundation: [], bestPractice: [], excellence: [] };
          list.forEach((cr) => { const t = CRITERION_TIERS[cr.id] || "foundation"; groups[t].push(cr); });
          return groups;
        };

        return (
          <div style={{ marginLeft: 18, marginTop: 8, marginBottom: 4 }}>
            {changed.length > 0 && (
              <div style={{
                fontSize: 11, fontWeight: 800, color: dk ? "#aab" : "#556", marginBottom: 6,
                textTransform: "uppercase", letterSpacing: 0.8,
              }}>Changes ({changed.length})</div>
            )}
            {changed.map((cr) => {
              const rem = CRITERION_ACTIONS[cr.id];
              return (
                <div key={cr.id} style={{ padding: "3px 0", borderBottom: `1px solid ${border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: cr.pointsDelta > 0 ? "#00C853" : "#E53935", flexShrink: 0 }} />
                    <span style={{ flex: 1, color: textSec }}>{cr.label}</span>
                    <span style={{ color: textTert, fontSize: 11 }}>{cr.isRatio ? `${cr.prevValue}%` : cr.prevValue} → {cr.isRatio ? `${cr.currValue}%` : cr.currValue}</span>
                    <span style={{ fontWeight: 700, color: deltaColor(cr.pointsDelta), fontSize: 11, minWidth: 56, textAlign: "right" }}>
                      {cr.pointsDelta > 0 ? "✓ Gained" : "✗ Lost"}
                    </span>
                  </div>
                  {rem && (
                    <div style={{ marginTop: 3, paddingLeft: 14, fontSize: 11, lineHeight: "16px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                        background: cr.currPoints > 0
                          ? (dk ? "rgba(0,200,83,0.12)" : "rgba(0,200,83,0.10)")
                          : (dk ? "rgba(229,57,53,0.12)" : "rgba(229,57,53,0.10)"),
                        color: cr.currPoints > 0 ? "#00C853" : "#E53935",
                        border: `1px solid ${cr.currPoints > 0 ? "rgba(0,200,83,0.3)" : "rgba(229,57,53,0.3)"}`,
                        flexShrink: 0,
                      }}>
                        {cr.currPoints > 0 ? "✓ Applied" : "✗ Not applied"}
                      </span>
                      <span style={{ color: textSec }}>{rem.action}</span>
                      <a href={rem.docUrl} target="_blank" rel="noopener noreferrer"
                        style={{ marginLeft: 2, color: dk ? "#7ec8e3" : "#1a73e8", textDecoration: "none", fontWeight: 600 }}>
                        {rem.docLabel} ↗
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
            {/* ── Improvement opportunities / Healthy — grouped by tier when maturity ── */}
            {isMat ? (
              /* MATURITY VIEW: group all non-changed criteria by tier */
              tierOrder.map((tier) => {
                const tiered = [...improvable, ...healthy].filter((cr) => (CRITERION_TIERS[cr.id] || "foundation") === tier);
                if (tiered.length === 0) return null;
                const tc = tierColor[tier];
                return (
                  <React.Fragment key={tier}>
                    <div style={{
                      fontSize: 11, fontWeight: 800, color: tc, marginTop: 10, marginBottom: 6,
                      textTransform: "uppercase", letterSpacing: 0.8,
                      padding: "5px 10px", borderRadius: 5,
                      background: dk ? `${tc}18` : `${tc}0C`,
                      border: `1px solid ${dk ? `${tc}40` : `${tc}30`}`,
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                      {tierLabel[tier]} ({tiered.length})
                    </div>
                    {tiered.map((cr) => {
                      const rem = CRITERION_ACTIONS[cr.id];
                      const applied = cr.currPoints > 0;
                      return (
                        <div key={cr.id} style={{ padding: "3px 0", borderBottom: `1px solid ${border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: applied ? "#00C853" : tc, flexShrink: 0 }} />
                            <span style={{ flex: 1, color: textSec }}>{cr.label}</span>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                              background: applied
                                ? (dk ? "rgba(0,200,83,0.12)" : "rgba(0,200,83,0.10)")
                                : (dk ? "rgba(229,57,53,0.12)" : "rgba(229,57,53,0.10)"),
                              color: applied ? "#00C853" : "#E53935",
                              border: `1px solid ${applied ? "rgba(0,200,83,0.3)" : "rgba(229,57,53,0.3)"}`,
                            }}>{applied ? "✓ Applied" : "✗ Not applied"}</span>
                          </div>
                          {rem && (
                            <div style={{ marginTop: 3, paddingLeft: 14, fontSize: 11, lineHeight: "16px" }}>
                              <span style={{ color: textSec }}>{rem.action}</span>
                              <a href={rem.docUrl} target="_blank" rel="noopener noreferrer"
                                style={{ marginLeft: 6, color: dk ? "#7ec8e3" : "#1a73e8", textDecoration: "none", fontWeight: 600 }}>
                                {rem.docLabel} ↗
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })
            ) : (
              /* COVERAGE VIEW: original flat sections */
              <>
                {improvable.length > 0 && (
                  <>
                    <div style={{
                      fontSize: 11, fontWeight: 800, color: "#F5A623", marginTop: 10, marginBottom: 6,
                      textTransform: "uppercase", letterSpacing: 0.8,
                      padding: "5px 10px", borderRadius: 5,
                      background: dk ? "rgba(245,166,35,0.10)" : "rgba(245,166,35,0.08)",
                      border: `1px solid ${dk ? "rgba(245,166,35,0.25)" : "rgba(245,166,35,0.2)"}`,
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{ fontSize: 13 }}>💡</span> Improvement opportunities ({improvable.length})
                    </div>
                    {improvable.map((cr) => {
                      const rem = CRITERION_ACTIONS[cr.id];
                      return (
                        <div key={cr.id} style={{ padding: "3px 0", borderBottom: `1px solid ${border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F5A623", flexShrink: 0 }} />
                            <span style={{ flex: 1, color: textSec }}>{cr.label}</span>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                              background: dk ? "rgba(229,57,53,0.12)" : "rgba(229,57,53,0.10)",
                              color: "#E53935",
                              border: "1px solid rgba(229,57,53,0.3)",
                            }}>✗ Not applied</span>
                          </div>
                          {rem && (
                            <div style={{ marginTop: 3, paddingLeft: 14, fontSize: 11, lineHeight: "16px" }}>
                              <span style={{ color: textSec }}>{rem.action}</span>
                              <a href={rem.docUrl} target="_blank" rel="noopener noreferrer"
                                style={{ marginLeft: 6, color: dk ? "#7ec8e3" : "#1a73e8", textDecoration: "none", fontWeight: 600 }}>
                                {rem.docLabel} ↗
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
                {healthy.length > 0 && (
                  <>
                    <div style={{
                      fontSize: 11, fontWeight: 800, color: "#00C853", marginTop: 10, marginBottom: 6,
                      textTransform: "uppercase", letterSpacing: 0.8,
                      padding: "5px 10px", borderRadius: 5,
                      background: dk ? "rgba(0,200,83,0.08)" : "rgba(0,200,83,0.06)",
                      border: `1px solid ${dk ? "rgba(0,200,83,0.20)" : "rgba(0,200,83,0.15)"}`,
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{ fontSize: 13 }}>✅</span> Additional recommendations ({healthy.length})
                    </div>
                    {healthy.map((cr) => {
                      const rem = CRITERION_ACTIONS[cr.id];
                      return (
                        <div key={cr.id} style={{ padding: "3px 0", borderBottom: `1px solid ${border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C853", flexShrink: 0 }} />
                            <span style={{ flex: 1, color: textSec }}>{cr.label}</span>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                              background: dk ? "rgba(0,200,83,0.12)" : "rgba(0,200,83,0.10)",
                              color: "#00C853",
                              border: "1px solid rgba(0,200,83,0.3)",
                            }}>✓ Applied</span>
                          </div>
                          {rem && (
                            <div style={{ marginTop: 3, paddingLeft: 14, fontSize: 11, lineHeight: "16px" }}>
                              <span style={{ color: textSec }}>{rem.action}</span>
                              <a href={rem.docUrl} target="_blank" rel="noopener noreferrer"
                                style={{ marginLeft: 6, color: dk ? "#7ec8e3" : "#1a73e8", textDecoration: "none", fontWeight: 600 }}>
                                {rem.docLabel} ↗
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function DetailSection({ title, icon, color, caps, dk, card, border, textSec, textTert, embedded }: {
  title: string; icon: string; color: string; caps: CapDiff[]; dk: boolean; card: string; border: string; textSec: string; textTert: string; embedded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [expandedCaps, setExpandedCaps] = useState<Record<string, boolean>>({});
  const toggleCap = (name: string) => setExpandedCaps((p) => ({ ...p, [name]: !p[name] }));

  const outerStyle: React.CSSProperties = embedded
    ? { padding: "10px 0 0 0", borderTop: `1px solid ${border}`, marginBottom: 8 }
    : { background: card, border: `1px solid ${color}22`, borderRadius: 8, padding: 16, marginBottom: 16 };

  return (
    <div style={outerStyle}>
      <div
        onClick={() => setOpen(!open)}
        role="button" tabIndex={0} aria-expanded={open}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
        style={{ fontSize: 13, fontWeight: 700, color, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}
      >
        <span style={{ fontSize: 11, transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
        <span>{icon}</span> {title} — {caps.length} {caps.length === 1 ? "capability" : "capabilities"}
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          {caps.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).map((cap) => {
            const changed = cap.critDiffs.filter((c) => c.pointsDelta !== 0);
            const isExpanded = !!expandedCaps[cap.name];
            return (
              <div key={cap.name} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${color}18`, marginBottom: 6, background: `${color}06` }}>
                <div
                  onClick={() => toggleCap(cap.name)}
                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ fontSize: 10, color: textSec, transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cap.color }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{cap.name}</span>
                  <span style={{ fontSize: 12, color: textSec }}>{cap.prevScore}% → {cap.currScore}%</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color }}>{cap.delta > 0 ? "+" : ""}{cap.delta}%</span>
                </div>
                {isExpanded && changed.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {changed.map((cr) => {
                      const rem = CRITERION_ACTIONS[cr.id];
                      return (
                        <div key={cr.id} style={{ padding: "6px 0 6px 20px", borderTop: `1px solid ${border}`, marginTop: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                            <span style={{ color: deltaColor(cr.pointsDelta) }}>{cr.pointsDelta > 0 ? "▲" : "▼"}</span>
                            <span style={{ flex: 1, fontWeight: 600, color: textSec }}>{cr.label}</span>
                            <span style={{ color: textTert }}>{cr.isRatio ? `${cr.prevValue}%` : cr.prevValue} → {cr.isRatio ? `${cr.currValue}%` : cr.currValue}</span>
                            <span style={{ fontWeight: 700, color: deltaColor(cr.pointsDelta) }}>{cr.pointsDelta > 0 ? "✓ Gained" : "✗ Lost"}</span>
                          </div>
                          {rem && (
                            <div style={{ marginTop: 4, paddingLeft: 14, fontSize: 11, lineHeight: "16px" }}>
                              <span style={{ color: textSec }}>{rem.action}</span>
                              <a
                                href={rem.docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ marginLeft: 6, color: dk ? "#7ec8e3" : "#1a73e8", textDecoration: "none", fontWeight: 600 }}
                              >
                                📖 {rem.docLabel}
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Styles ── */
function btnStyle(dk: boolean): React.CSSProperties {
  return {
    padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", borderRadius: 6,
    border: `1px solid ${dk ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
    background: dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
    color: dk ? "#e8e8f0" : "#1a1a2e",
    fontFamily: "inherit",
  };
}
