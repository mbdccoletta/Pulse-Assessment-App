import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { jsPDF } from "jspdf";
import { useNavigate } from "react-router-dom";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import Colors from "@dynatrace/strato-design-tokens/colors";
import type { CoverageData, ViewMode, CapabilityResult } from "../hooks/useCoverageData";
import { PolarChart, maturity } from "../components/PolarChart";
import { ConnectorLines } from "../components/ConnectorLines";
import { ChartLabels } from "../components/ChartLabels";
import { CapabilityCards } from "../components/CapabilityCards";
import { Tooltip } from "../components/Tooltip";
import { CAPABILITIES } from "../queries";
import { CAP_SUMMARIES } from "../data/capSummaries";
import { CRITERION_IMPORTANCE } from "../data/criterionImportance";
import { CRITERION_REMEDIATION } from "../data/criterionRemediation";
import { APP_ICON } from "../data/appIcon";
import { usePreflight, type PreflightCheck } from "../hooks/usePreflight";
import type { useAssessmentHistory } from "../hooks/useAssessmentHistory";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  BarController,
  LineController,
  BubbleController,
  RadarController,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Tooltip as ChartTooltip,
  Filler,
  type ChartOptions,
} from "chart.js";
import { Chart, Bar, Radar, Bubble } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, RadialLinearScale, BarController, LineController, BubbleController, RadarController, BarElement, PointElement, LineElement, Legend, ChartTooltip, Filler);

const SCALE = [
  { l: "N/A", c: "#CD3C44", r: "0-19%", tip: "Critical gaps — the capability is barely adopted or has no data flowing." },
  { l: "Low", c: "#DC671E", r: "20-39%", tip: "Early adoption — some data exists but significant gaps remain." },
  { l: "Moderate", c: "#EEA746", r: "40-59%", tip: "Partial coverage — key areas configured but important criteria still missing." },
  { l: "Good", c: "#5EB1A9", r: "60-79%", tip: "Strong adoption — most criteria met with room for further optimization." },
  { l: "Excellent", c: "#36B37E", r: "80-100%", tip: "Full or near-full coverage — the capability is well-adopted and comprehensive." },
];

const R_RATIO = 0.34;

function formatRecords(n: number): string {
  return n.toLocaleString();
}

import { scoreColor as maturityBandColor } from "../utils/colors";

const TIER_META: { key: "foundation" | "bestPractice" | "excellence"; label: string; color: string }[] = [
  { key: "foundation", label: "Foundation", color: "#5B6ACF" },
  { key: "bestPractice", label: "Best Practice", color: "#EEA746" },
  { key: "excellence", label: "Excellence", color: "#36B37E" },
];

function criterionTooltipContent(id: string, description: string, tier: string): string {
  const tierLabel = tier === "foundation" ? "Foundation" : tier === "bestPractice" ? "Best Practice" : "Excellence";
  const importance = CRITERION_IMPORTANCE[id];
  const remediation = CRITERION_REMEDIATION[id];
  let tip = `${description}\n\nTier: ${tierLabel}`;
  if (importance) tip += `\n\nWhy it matters:\n${importance}`;
  if (remediation) tip += `\n\nHow to fix:\n${remediation.action}`;
  return tip;
}

function isTextSelection(): boolean {
  const sel = window.getSelection();
  return !!(sel && sel.toString().length > 0);
}

interface Props {
  history: ReturnType<typeof useAssessmentHistory>;
  coverageData: CoverageData;
}

export const CoverageAssessment: React.FC<Props> = ({ history, coverageData }) => {
  const { capabilities, totalScore, overallMaturityLevel, loading, idle, progress, error, tenant, date, stats, liveScannedRecords, start, refresh, reset, goHome, resume } = coverageData;
  const navigate = useNavigate();
  const lastSavedRef = useRef<string>("");
  const [anim, setAnim] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [chartSize, setChartSize] = useState(500);
  const [selectedCap, setSelectedCap] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("coverage");
  const [collapseKey, setCollapseKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reportMenu, setReportMenu] = useState(false);

  const t0 = useRef<number>(0);
  const dk = useCurrentTheme() === "dark";

  /* ── PDF Report Generator ── */
  const generateReport = useCallback((mode: "coverage" | "maturity") => {
    if (exporting || capabilities.length === 0) return;
    setExporting(true);
    setReportMenu(false);
    // Defer to next frame so the UI updates (shows "Generating...") before blocking
    setTimeout(() => {
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210, H = 297, M = 15, CW = W - 2 * M;
      let y = 0;
      const hexToRgb = (hex: string): [number, number, number] => [
        parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
      ];
      const paintBg = () => { pdf.setFillColor(11, 11, 26); pdf.rect(0, 0, W, H, "F"); };
      const ensureSpace = (need: number) => {
        if (y + need > H - M) { pdf.addPage(); paintBg(); y = M; }
      };
      const isCoverage = mode === "coverage";
      const modeLabel = isCoverage ? "Coverage" : "Maturity";

      /* ── Cover Page ── */
      paintBg();
      pdf.setTextColor(232, 232, 240);
      pdf.setFontSize(26); pdf.setFont("helvetica", "bold");
      pdf.text("Pulse Assessment Report", W / 2, 55, { align: "center" });
      pdf.setFontSize(13); pdf.setFont("helvetica", "normal");
      pdf.setTextColor(160, 160, 192);
      pdf.text(`${modeLabel} Analysis`, W / 2, 66, { align: "center" });
      pdf.setFontSize(10);
      pdf.text(`Tenant: ${tenant}`, W / 2, 82, { align: "center" });
      pdf.text(`Generated: ${new Date().toLocaleString()}`, W / 2, 88, { align: "center" });
      if (date) pdf.text(`Assessment Date: ${date}`, W / 2, 94, { align: "center" });

      // Overall score
      const ov = maturity(totalScore);
      const ovScore = isCoverage ? totalScore : Math.round(capabilities.reduce((s, c) => s + c.maturity.maturityScore, 0) / capabilities.length);
      const ovM = maturity(ovScore);
      pdf.setFontSize(44); pdf.setFont("helvetica", "bold");
      const [ovR, ovG, ovB] = hexToRgb(ovM.color);
      pdf.setTextColor(ovR, ovG, ovB);
      pdf.text(`${ovScore}%`, W / 2, 128, { align: "center" });
      pdf.setFontSize(13); pdf.setTextColor(160, 160, 192);
      pdf.text(`Overall ${modeLabel}: ${ovM.label}`, W / 2, 138, { align: "center" });

      if (stats) {
        pdf.setFontSize(9);
        pdf.text(`${stats.succeeded}/${stats.total} queries OK  |  ${formatRecords(stats.scannedRecords)} records scanned`, W / 2, 152, { align: "center" });
      }

      // Summary table
      y = 170;
      pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
      pdf.setTextColor(100, 100, 130);
      pdf.text("CAPABILITY", M, y);
      if (isCoverage) {
        pdf.text("COVERAGE", M + 95, y);
        pdf.text("BAND", M + 140, y);
      } else {
        pdf.text("MATURITY", M + 95, y);
        pdf.text("LEVEL", M + 130, y);
        pdf.text("F / BP / E", M + 158, y);
      }
      y += 2;
      pdf.setDrawColor(50, 50, 70); pdf.line(M, y, W - M, y);
      y += 5;
      pdf.setFont("helvetica", "normal");
      capabilities.forEach((cap) => {
        const score = isCoverage ? cap.score : cap.maturity.maturityScore;
        const m = maturity(score);
        const [cr, cg, cb] = hexToRgb(cap.color);
        pdf.setFillColor(cr, cg, cb);
        pdf.circle(M + 2, y - 1.2, 1.5, "F");
        pdf.setTextColor(220, 220, 235); pdf.setFontSize(8);
        pdf.text(cap.name, M + 6, y);
        // Bar
        const barX = M + 95, barW = 32, barH = 3;
        pdf.setFillColor(30, 30, 50);
        pdf.roundedRect(barX, y - 3, barW, barH, 1, 1, "F");
        const [mr, mg, mb] = hexToRgb(m.color);
        pdf.setFillColor(mr, mg, mb);
        if (score > 0) pdf.roundedRect(barX, y - 3, Math.max(barW * score / 100, 2), barH, 1, 1, "F");
        pdf.setTextColor(mr, mg, mb);
        pdf.text(`${score}%`, barX + barW + 2, y);
        if (isCoverage) {
          pdf.setTextColor(150, 150, 175);
          pdf.text(m.label, M + 140, y);
        } else {
          pdf.setTextColor(150, 150, 175);
          pdf.text(cap.maturity.levelLabel, M + 130, y);
          pdf.setTextColor(120, 120, 150); pdf.setFontSize(7);
          pdf.text(`${cap.maturity.foundation.passed}/${cap.maturity.foundation.total}  ${cap.maturity.bestPractice.passed}/${cap.maturity.bestPractice.total}  ${cap.maturity.excellence.passed}/${cap.maturity.excellence.total}`, M + 158, y);
        }
        y += 7;
      });

      /* ── Capability Detail Pages ── */
      capabilities.forEach((cap, ci) => {
        pdf.addPage(); paintBg(); y = M;
        const score = isCoverage ? cap.score : cap.maturity.maturityScore;
        const m = maturity(score);

        // Header
        const [hR, hG, hB] = hexToRgb(cap.color);
        pdf.setFillColor(hR, hG, hB);
        pdf.roundedRect(M, y, CW, 16, 2, 2, "F");
        pdf.setFontSize(13); pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        pdf.text(`${ci + 1}. ${cap.name}`, M + 6, y + 10);
        const [smr, smg, smb] = hexToRgb(m.color);
        pdf.setFontSize(11);
        pdf.text(`${score}%`, W - M - 6, y + 10, { align: "right" });
        y += 22;

        // Score details
        pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
        if (isCoverage) {
          pdf.setTextColor(smr, smg, smb);
          pdf.text(`Coverage: ${cap.score}% (${maturity(cap.score).label})`, M, y);
          pdf.setTextColor(140, 140, 170);
          pdf.text(`Maturity: ${cap.maturity.levelLabel}  |  Maturity Score: ${cap.maturity.maturityScore}%`, M + 80, y);
        } else {
          pdf.setTextColor(smr, smg, smb);
          pdf.text(`Maturity Score: ${cap.maturity.maturityScore}% (${cap.maturity.maturityBand})`, M, y);
          pdf.setTextColor(140, 140, 170);
          pdf.text(`Level: ${cap.maturity.levelLabel}  |  Coverage: ${cap.score}%`, M + 85, y);
        }
        y += 5;

        // Tier breakdown
        pdf.setFontSize(8); pdf.setTextColor(120, 120, 155);
        const { foundation, bestPractice, excellence } = cap.maturity;
        pdf.text(`Foundation: ${foundation.passed}/${foundation.total}  |  Best Practice: ${bestPractice.passed}/${bestPractice.total}  |  Excellence: ${excellence.passed}/${excellence.total}`, M, y);
        y += 5;

        // Capability summary
        const summary = CAP_SUMMARIES[cap.name];
        if (summary) {
          pdf.setFontSize(7.5); pdf.setTextColor(150, 150, 185);
          const sumLines = pdf.splitTextToSize(summary, CW);
          ensureSpace(sumLines.length * 4 + 4);
          pdf.text(sumLines, M, y);
          y += sumLines.length * 4 + 3;
        }

        // Separator
        pdf.setDrawColor(50, 50, 70); pdf.line(M, y, W - M, y);
        y += 5;

        // Group criteria by tier for maturity mode, flat list for coverage
        const tiers: { key: string; label: string; color: string; criteria: typeof cap.criteriaResults }[] = isCoverage
          ? [{ key: "all", label: "", color: "", criteria: cap.criteriaResults }]
          : [
              { key: "foundation", label: "Foundation (60% weight)", color: "#5B6ACF", criteria: cap.criteriaResults.filter(cr => cr.tier === "foundation") },
              { key: "bestPractice", label: "Best Practice (25% weight)", color: "#EEA746", criteria: cap.criteriaResults.filter(cr => cr.tier === "bestPractice") },
              { key: "excellence", label: "Excellence (15% weight)", color: "#36B37E", criteria: cap.criteriaResults.filter(cr => cr.tier === "excellence") },
            ];

        tiers.forEach((tierGroup) => {
          if (tierGroup.criteria.length === 0) return;

          // Tier header (maturity mode only)
          if (!isCoverage) {
            ensureSpace(10);
            const [tR, tG, tB] = hexToRgb(tierGroup.color);
            pdf.setFillColor(tR, tG, tB);
            pdf.roundedRect(M, y - 1, 3, 5, 1, 1, "F");
            pdf.setFontSize(10); pdf.setFont("helvetica", "bold");
            pdf.setTextColor(tR, tG, tB);
            pdf.text(tierGroup.label, M + 5, y + 2.5);
            const passed = tierGroup.criteria.filter(cr => cr.points > 0).length;
            pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
            pdf.setTextColor(140, 140, 170);
            pdf.text(`${passed}/${tierGroup.criteria.length} passed`, M + 75, y + 2.5);
            y += 8;
          }

          tierGroup.criteria.forEach((cr) => {
            const passed = cr.points > 0;
            const tierLabel = cr.tier === "foundation" ? "Foundation" : cr.tier === "bestPractice" ? "Best Practice" : "Excellence";

            // Calculate space needed
            const labelLines = pdf.splitTextToSize(cr.label, 100);
            let needH = labelLines.length * 4.5 + 4;
            const descLines = pdf.splitTextToSize(cr.description, CW - 10);
            needH += descLines.length * 4;
            const importance = CRITERION_IMPORTANCE[cr.id];
            if (importance) needH += 12;
            if (!passed && CRITERION_REMEDIATION[cr.id]) needH += 12;
            ensureSpace(Math.min(needH + 8, 70));

            // Status bar
            pdf.setFillColor(passed ? 54 : 205, passed ? 179 : 60, passed ? 126 : 68);
            pdf.rect(M, y - 2.5, 1.5, 4, "F");

            // Label
            pdf.setFontSize(8.5); pdf.setFont("helvetica", "bold");
            pdf.setTextColor(225, 225, 240);
            pdf.text(labelLines, M + 4, y);

            // Right side: tier + value + status
            pdf.setFontSize(7); pdf.setFont("helvetica", "normal");
            if (isCoverage) {
              pdf.setTextColor(110, 110, 145);
              pdf.text(tierLabel, W - M - 52, y);
            }
            pdf.setTextColor(160, 160, 195);
            pdf.text(`${cr.value}`, W - M - 22, y);
            pdf.setTextColor(passed ? 54 : 205, passed ? 179 : 60, passed ? 126 : 68);
            pdf.setFont("helvetica", "bold");
            pdf.text(passed ? "PASS" : "FAIL", W - M - 8, y);

            y += Math.max(labelLines.length * 4.5, 5) + 1;

            // Description
            pdf.setFontSize(7); pdf.setFont("helvetica", "normal");
            pdf.setTextColor(120, 120, 155);
            ensureSpace(descLines.length * 4);
            pdf.text(descLines, M + 5, y);
            y += descLines.length * 4;

            // Importance
            if (importance) {
              pdf.setFontSize(7); pdf.setTextColor(95, 95, 135);
              const impLines = pdf.splitTextToSize(`Why it matters: ${importance}`, CW - 10);
              y += 1;
              ensureSpace(impLines.length * 4);
              pdf.text(impLines, M + 5, y);
              y += impLines.length * 4;
            }

            // Remediation (failed only)
            if (!passed) {
              const rem = CRITERION_REMEDIATION[cr.id];
              if (rem) {
                pdf.setFontSize(7);
                pdf.setTextColor(220, 130, 40);
                const remLines = pdf.splitTextToSize(`Fix: ${rem.action}`, CW - 10);
                y += 1;
                ensureSpace(remLines.length * 4);
                pdf.text(remLines, M + 5, y);
                y += remLines.length * 4;
              }
            }

            y += 4;
            pdf.setDrawColor(35, 35, 55);
            pdf.line(M + 4, y, W - M, y);
            y += 5;
          });

          if (!isCoverage) y += 3; // extra space between tiers
        });
      });

      /* ── Footer on every page ── */
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(6.5); pdf.setFont("helvetica", "normal");
        pdf.setTextColor(70, 70, 100);
        pdf.text(`Pulse Assessment - ${modeLabel} Report  |  ${tenant}  |  ${date}`, M, H - 5);
        pdf.text(`Page ${i} / ${pageCount}`, W - M, H - 5, { align: "right" });
      }

      pdf.save(`pulse-${mode}-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
    }, 0);
  }, [capabilities, exporting, tenant, date, stats, totalScore]);

  /* ── Summary Report (Coverage vs Maturity) ── */
  const generateSummaryReport = useCallback(() => {
    if (exporting || capabilities.length === 0) return;
    setExporting(true);
    setReportMenu(false);
    setTimeout(() => {
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210, H = 297, M = 15, CW = W - 2 * M;
      let y = 0;
      const hexToRgb = (hex: string): [number, number, number] => [
        parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
      ];
      const paintBg = () => { pdf.setFillColor(11, 11, 26); pdf.rect(0, 0, W, H, "F"); };
      const ensureSpace = (need: number) => {
        if (y + need > H - M) { pdf.addPage(); paintBg(); y = M; }
      };

      const ovCov = totalScore;
      const ovMat = Math.round(capabilities.reduce((s, c) => s + c.maturity.maturityScore, 0) / capabilities.length);
      const mCov = maturity(ovCov);
      const mMat = maturity(ovMat);
      const totalCriteria = capabilities.reduce((s, c) => s + c.criteriaResults.length, 0);
      const passedCriteria = capabilities.reduce((s, c) => s + c.criteriaResults.filter(cr => cr.points > 0).length, 0);

      /* ── Cover Page ── */
      paintBg();
      pdf.setTextColor(232, 232, 240);
      pdf.setFontSize(26); pdf.setFont("helvetica", "bold");
      pdf.text("Pulse Assessment", W / 2, 50, { align: "center" });
      pdf.setFontSize(14); pdf.setFont("helvetica", "normal");
      pdf.setTextColor(160, 160, 192);
      pdf.text("Summary Report", W / 2, 62, { align: "center" });
      pdf.setFontSize(10);
      pdf.text(`Tenant: ${tenant}`, W / 2, 78, { align: "center" });
      pdf.text(`Generated: ${new Date().toLocaleString()}`, W / 2, 85, { align: "center" });
      if (date) pdf.text(`Assessment Date: ${date}`, W / 2, 92, { align: "center" });

      if (stats) {
        pdf.setFontSize(8); pdf.setTextColor(100, 100, 135);
        pdf.text(`${stats.succeeded}/${stats.total} queries OK  |  ${formatRecords(stats.scannedRecords)} records  |  ${passedCriteria}/${totalCriteria} criteria passed`, W / 2, 102, { align: "center" });
      }

      // Two score boxes
      const boxW = 72, boxH = 44, gap = 16;
      const boxY = 115;
      const covX = W / 2 - boxW - gap / 2;
      const matX = W / 2 + gap / 2;

      pdf.setFillColor(20, 20, 40);
      pdf.roundedRect(covX, boxY, boxW, boxH, 3, 3, "F");
      pdf.setFontSize(9); pdf.setFont("helvetica", "bold");
      pdf.setTextColor(130, 130, 165);
      pdf.text("COVERAGE", covX + boxW / 2, boxY + 10, { align: "center" });
      const [ccR, ccG, ccB] = hexToRgb(mCov.color);
      pdf.setFontSize(30); pdf.setTextColor(ccR, ccG, ccB);
      pdf.text(`${ovCov}%`, covX + boxW / 2, boxY + 28, { align: "center" });
      pdf.setFontSize(9); pdf.text(mCov.label, covX + boxW / 2, boxY + 38, { align: "center" });

      pdf.setFillColor(20, 20, 40);
      pdf.roundedRect(matX, boxY, boxW, boxH, 3, 3, "F");
      pdf.setFontSize(9); pdf.setFont("helvetica", "bold");
      pdf.setTextColor(130, 130, 165);
      pdf.text("MATURITY", matX + boxW / 2, boxY + 10, { align: "center" });
      const [mmR, mmG, mmB] = hexToRgb(mMat.color);
      pdf.setFontSize(30); pdf.setTextColor(mmR, mmG, mmB);
      pdf.text(`${ovMat}%`, matX + boxW / 2, boxY + 28, { align: "center" });
      pdf.setFontSize(9); pdf.text(mMat.label, matX + boxW / 2, boxY + 38, { align: "center" });

      /* ═══════════════════════════════════════
         SECTION 1 — COVERAGE
         ═══════════════════════════════════════ */
      y = boxY + boxH + 22;

      // Section header
      pdf.setFillColor(30, 55, 120);
      pdf.roundedRect(M, y - 4, CW, 12, 2, 2, "F");
      pdf.setFontSize(12); pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("Coverage", M + 6, y + 4);
      pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
      pdf.setTextColor(200, 210, 240);
      pdf.text(`Overall: ${ovCov}% (${mCov.label})`, W - M - 6, y + 4, { align: "right" });
      y += 16;

      // Coverage table header
      pdf.setFontSize(7.5); pdf.setFont("helvetica", "bold");
      pdf.setTextColor(100, 100, 135);
      pdf.text("CAPABILITY", M, y);
      pdf.text("SCORE", M + 90, y);
      pdf.text("BAND", M + 140, y);
      y += 2;
      pdf.setDrawColor(50, 50, 70); pdf.line(M, y, W - M, y);
      y += 5;

      capabilities.forEach((cap) => {
        ensureSpace(9);
        const sc = cap.score;
        const mc = maturity(sc);
        const [cr, cg, cb] = hexToRgb(cap.color);

        pdf.setFillColor(cr, cg, cb);
        pdf.circle(M + 2, y - 1.2, 1.5, "F");
        pdf.setTextColor(220, 220, 235); pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "normal");
        pdf.text(cap.name, M + 6, y);

        // Bar
        const barX = M + 90, barW = 36, barH = 3.5;
        pdf.setFillColor(30, 30, 50);
        pdf.roundedRect(barX, y - 3.2, barW, barH, 1, 1, "F");
        const [mr, mg, mb] = hexToRgb(mc.color);
        pdf.setFillColor(mr, mg, mb);
        if (sc > 0) pdf.roundedRect(barX, y - 3.2, Math.max(barW * sc / 100, 2), barH, 1, 1, "F");
        pdf.setFontSize(8); pdf.setTextColor(mr, mg, mb);
        pdf.text(`${sc}%`, barX + barW + 3, y);

        pdf.setTextColor(150, 150, 175); pdf.setFontSize(7.5);
        pdf.text(mc.label, M + 140, y);

        y += 8;
      });

      /* ═══════════════════════════════════════
         SECTION 2 — MATURITY
         ═══════════════════════════════════════ */
      y += 6;
      ensureSpace(30);

      // Section header
      pdf.setFillColor(80, 50, 20);
      pdf.roundedRect(M, y - 4, CW, 12, 2, 2, "F");
      pdf.setFontSize(12); pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("Maturity", M + 6, y + 4);
      pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
      pdf.setTextColor(240, 210, 170);
      pdf.text(`Overall: ${ovMat}% (${mMat.label})`, W - M - 6, y + 4, { align: "right" });
      y += 16;

      // Maturity table header
      pdf.setFontSize(7.5); pdf.setFont("helvetica", "bold");
      pdf.setTextColor(100, 100, 135);
      pdf.text("CAPABILITY", M, y);
      pdf.text("SCORE", M + 78, y);
      pdf.text("LEVEL", M + 122, y);
      pdf.text("FOUNDATION", M + 148, y);
      pdf.text("BEST PRACTICE", M + 166, y);
      y += 2;
      pdf.setDrawColor(50, 50, 70); pdf.line(M, y, W - M, y);
      y += 5;

      capabilities.forEach((cap) => {
        ensureSpace(9);
        const sc = cap.maturity.maturityScore;
        const mm = maturity(sc);
        const [cr, cg, cb] = hexToRgb(cap.color);

        pdf.setFillColor(cr, cg, cb);
        pdf.circle(M + 2, y - 1.2, 1.5, "F");
        pdf.setTextColor(220, 220, 235); pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "normal");
        pdf.text(cap.name, M + 6, y);

        // Bar
        const barX = M + 78, barW = 30, barH = 3.5;
        pdf.setFillColor(30, 30, 50);
        pdf.roundedRect(barX, y - 3.2, barW, barH, 1, 1, "F");
        const [mr, mg, mb] = hexToRgb(mm.color);
        pdf.setFillColor(mr, mg, mb);
        if (sc > 0) pdf.roundedRect(barX, y - 3.2, Math.max(barW * sc / 100, 2), barH, 1, 1, "F");
        pdf.setFontSize(8); pdf.setTextColor(mr, mg, mb);
        pdf.text(`${sc}%`, barX + barW + 3, y);

        // Level
        pdf.setTextColor(150, 150, 175); pdf.setFontSize(7.5);
        pdf.text(cap.maturity.levelLabel, M + 122, y);

        // Tier breakdown
        pdf.setTextColor(120, 120, 155); pdf.setFontSize(7);
        const { foundation, bestPractice, excellence } = cap.maturity;
        pdf.text(`${foundation.passed}/${foundation.total}`, M + 152, y);
        pdf.text(`${bestPractice.passed}/${bestPractice.total}`, M + 173, y);

        y += 8;
      });

      /* ── Footer ── */
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(6.5); pdf.setFont("helvetica", "normal");
        pdf.setTextColor(70, 70, 100);
        pdf.text(`Pulse Assessment - Summary Report  |  ${tenant}  |  ${date}`, M, H - 5);
        pdf.text(`Page ${i} / ${pageCount}`, W - M, H - 5, { align: "right" });
      }

      pdf.save(`pulse-summary-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
    }, 0);
  }, [capabilities, exporting, tenant, date, stats, totalScore]);


  // Auto-save snapshot when assessment completes
  useEffect(() => {
    if (!loading && capabilities.length > 0) {
      const sig = capabilities.map(c => `${c.name}:${c.score}`).join(",");
      if (sig !== lastSavedRef.current) {
        lastSavedRef.current = sig;
        history.saveSnapshot(capabilities, totalScore, tenant);
      }
    }
  }, [loading, capabilities, totalScore, tenant, history]);

  // Animate on data load
  useEffect(() => {
    if (loading || capabilities.length === 0) return;
    setAnim(0);
    t0.current = performance.now();
    const run = (now: number) => {
      const p = Math.min((now - t0.current) / 1400, 1);
      setAnim(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }, [loading, capabilities]);

  // Auto-size chart
  useEffect(() => {
    const calc = () => {
      const vh = window.innerHeight;
      const vw = rootRef.current ? rootRef.current.offsetWidth : window.innerWidth;
      setChartSize(Math.max(Math.min(vh - 200, vw - 16, 720), 300));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const hitTest = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2, R = rect.width * R_RATIO;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const dx = mx - cx, dy = my - cy, d = Math.sqrt(dx * dx + dy * dy);
    if (d > R + 14 || d < chartSize * 0.09) return -1;
    let a = Math.atan2(dy, dx) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    const N = capabilities.length;
    return Math.floor(a / ((Math.PI * 2) / N));
  }, [capabilities.length, chartSize]);

  // Theme colors — using Strato design tokens for automatic dark/light adaptation
  const bg = Colors.Background.Base.Default;
  const bgSurface = Colors.Background.Surface.Default;
  const bgSubtle = Colors.Background.Container.Neutral.Subdued;
  const bgPrimary = Colors.Background.Container.Primary.Default;
  const text = Colors.Text.Neutral.Default;
  const textSec = Colors.Text.Neutral.Subdued;
  const textTert = dk ? "#9a9abc" : "#6e6e82";
  const accent = Colors.Text.Primary.Default;
  const border = Colors.Border.Neutral.Default;
  const borderPri = Colors.Border.Primary.Default;

  return (
    <div ref={rootRef}
      onMouseDown={(e) => { mouseDownPos.current = { x: e.clientX, y: e.clientY }; }}
      onClick={(e) => {
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) return;
        const dp = mouseDownPos.current;
        if (dp && (Math.abs(e.clientX - dp.x) > 5 || Math.abs(e.clientY - dp.y) > 5)) return;
        setActiveIdx(null); setSelectedCap(null); setCollapseKey(k => k + 1); setReportMenu(false);
      }}
      style={{
      display: "flex", flexDirection: "column", height: "100%",
      overflow: "hidden", boxSizing: "border-box", padding: "8px 0",
      fontFamily: "inherit",
      background: bg, color: text, transition: "background 0.4s, color 0.4s",
    }}>
      {/* Idle State — capability overview + start */}
      {idle && !loading && (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "380px 1fr", gridTemplateRows: "minmax(0,1fr)", minHeight: 0, overflow: "hidden" }}>
          {/* Left panel — memoized so it never re-renders on card interactions */}
          <IdleLeftPanel
            dk={dk} text={text} textSec={textSec} textTert={textTert}
            accent={accent} bgSubtle={bgSubtle} bgPrimary={bgPrimary}
            border={border} borderPri={borderPri}
            tenant={tenant} start={start} resume={resume}
            totalScore={totalScore} hasResults={capabilities.length > 0}
          />

          {/* Right panel — Capability cards */}
          <div onClick={(e) => e.stopPropagation()} style={{ overflowY: "scroll", padding: "20px 24px", minHeight: 0 }}>
            {selectedCap ? (
              <IdleCapDetail
                cap={CAPABILITIES.find(c => c.name === selectedCap)!}
                dk={dk} text={text} textSec={textSec} textTert={textTert}
                bgSubtle={bgSubtle} border={border}
                onBack={() => setSelectedCap(null)}
                collapseKey={collapseKey}
              />
            ) : (
              <>
              <div style={{ marginBottom: 18, padding: "12px 16px", borderRadius: 10, background: bgPrimary, borderLeft: `3px solid ${accent}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 4 }}>{CAPABILITIES.length} Capabilities Evaluated</div>
                <div style={{ fontSize: 12, color: textSec, lineHeight: 1.6 }}>
                  Each card shows what a capability evaluates. Click to see the <strong style={{ color: text }}>full list of criteria</strong>, the DQL query behind each one, and what the app looks for in your environment.
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                {CAPABILITIES.map((cap) => (
                  <IdleCapCard key={cap.name} cap={cap} dk={dk} text={text} textSec={textSec} textTert={textTert}
                    bgSurface={bgSurface} bgSubtle={bgSubtle} border={border}
                    onClick={() => setSelectedCap(cap.name)} />
                ))}
              </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ fontSize: 14, color: textSec }}>Running assessment... {progress}%</div>
          <div style={{ width: 240, height: 6, borderRadius: 3, background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3, background: "#5B6ACF",
              width: `${progress}%`, transition: "width 0.3s",
            }} />
          </div>
          <div style={{ fontSize: 12, color: textTert }}>Querying {capabilities.length > 0 ? capabilities.length : CAPABILITIES.length} capabilities via DQL</div>
          {liveScannedRecords > 0 && (
            <div style={{ fontSize: 12, color: textSec, marginTop: 4 }}>
              Records scanned: <span style={{ fontWeight: 600, color: text }}>{formatRecords(liveScannedRecords)}</span>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {!idle && !loading && capabilities.length > 0 && (
        <>
          {/* Toolbar */}
          <div style={{
            padding: "6px 16px", flexShrink: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            borderBottom: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
          }}>
            <button onClick={goHome} style={{
              padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6,
              border: `1px solid ${dk ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              background: dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              color: dk ? "#e8e8f0" : "#1a1a2e",
            }}>← Back</button>
            <button onClick={refresh} style={{
              padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6,
              border: `1px solid ${dk ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              background: dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              color: dk ? "#e8e8f0" : "#1a1a2e",
            }}>↻ Refresh</button>
            {/* View Mode Toggle */}
            <div style={{
              display: "flex", borderRadius: 8, overflow: "hidden",
              border: `1px solid ${dk ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
              marginLeft: 4,
            }}>
              {([
                { key: "coverage" as ViewMode, label: "Coverage" },
                { key: "maturity" as ViewMode, label: "Maturity" },
                { key: "recommendations" as ViewMode, label: "Executive Summary" },
              ]).map((m) => (
                <button key={m.key} onClick={(e) => { e.stopPropagation(); setViewMode(m.key); }} style={{
                  padding: "5px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  border: "none",
                  background: viewMode === m.key
                    ? (dk ? "rgba(65,105,225,0.25)" : "rgba(65,105,225,0.12)")
                    : "transparent",
                  color: viewMode === m.key ? "#5B6ACF" : (dk ? "#a0a0c0" : "#666"),
                  transition: "background 0.2s, color 0.2s",
                }}>{m.label}</button>
              ))}
            </div>
            <button onClick={() => navigate("/compare")} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #5B6ACF 0%, #4A5AB5 100%)",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(65,105,225,0.35)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(65,105,225,0.5)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(65,105,225,0.35)"; }}
            >
              Evolution Over Time
              {history.snapshots.length > 0 && (
                <span style={{
                  fontSize: 12, fontWeight: 800, color: "#5B6ACF",
                  background: "#fff", borderRadius: 8,
                  padding: "1px 6px", minWidth: 14, textAlign: "center",
                  lineHeight: "14px",
                }}>{Math.min(history.snapshots.length, 12)}</span>
              )}
            </button>
            <div style={{ position: "relative" }}>
              <button onClick={(e) => { e.stopPropagation(); setReportMenu(v => !v); }} disabled={exporting} style={{
                padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: exporting ? "wait" : "pointer", borderRadius: 6,
                border: `1px solid ${dk ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                background: dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                color: dk ? "#e8e8f0" : "#1a1a2e",
                opacity: exporting ? 0.5 : 1,
              }}>{exporting ? "Generating..." : "Generate Report"}</button>
              {reportMenu && (
                <div onClick={(e) => e.stopPropagation()} style={{
                  position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 100,
                  background: dk ? "#1a1a2e" : "#fff",
                  border: `1px solid ${dk ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
                  borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.3)", overflow: "hidden", minWidth: 180,
                }}>
                  {(["summary", "coverage", "maturity"] as const).map((key) => {
                    const info = key === "summary"
                      ? { label: "Summary Report", desc: "Coverage vs Maturity overview" }
                      : key === "coverage"
                      ? { label: "Coverage Report", desc: "Criteria pass/fail details" }
                      : { label: "Maturity Report", desc: "Tier-based analysis (F/BP/E)" };
                    return (
                      <button key={key} onClick={() => key === "summary" ? generateSummaryReport() : generateReport(key)} style={{
                        display: "block", width: "100%", padding: "10px 14px", border: "none", cursor: "pointer", textAlign: "left",
                        background: "transparent", transition: "background 0.15s",
                        borderBottom: key === "summary" ? `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}` : "none",
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: dk ? "#e8e8f0" : "#1a1a2e" }}>{info.label}</div>
                        <div style={{ fontSize: 11, color: dk ? "#8888aa" : "#888", marginTop: 2 }}>{info.desc}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <span style={{ marginLeft: "auto", fontSize: 12, color: textSec }}>
              Tenant: <span style={{ fontWeight: 600, color: text }}>{tenant}</span> · {date}
              {stats && (
                <span style={{ marginLeft: 8, fontSize: 12, color: stats.failed > 0 ? "#EEA746" : "#36B37E" }}>
                  · {stats.succeeded}/{stats.total} queries OK{stats.failed > 0 ? ` (${stats.failed} failed)` : ""}
                </span>
              )}
              {stats && stats.scannedRecords > 0 && (
                <span style={{ marginLeft: 8, fontSize: 12, color: dk ? "#b0b0d0" : textSec }}>
                  · {formatRecords(stats.scannedRecords)} records scanned
                </span>
              )}
            </span>
          </div>
          {/* Main content: chart left, cards right */}
          <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
          {viewMode === "coverage" ? (<>
            {/* Left: chart + scale */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minHeight: 0, minWidth: 0, overflow: "hidden", paddingTop: 24 }}>
              <div style={{ position: "relative", width: chartSize, height: chartSize }}
                onClick={(e) => {
                  e.stopPropagation();
                  const idx = hitTest(e);
                  const N = capabilities.length;
                  setActiveIdx(idx >= 0 && idx < N ? (activeIdx === idx ? null : idx) : null);
                }}>
                <PolarChart capabilities={capabilities} anim={anim} activeIdx={activeIdx} size={chartSize} />
                <ConnectorLines capabilities={capabilities} anim={anim} activeIdx={activeIdx} size={chartSize} />
                <ChartLabels capabilities={capabilities} anim={anim} activeIdx={activeIdx} size={chartSize} onSelect={(idx: number | null) => {
                  setActiveIdx(idx);
                  if (idx !== null) {
                    setTimeout(() => {
                      const card = document.querySelector(`[data-cap-idx="${idx}"]`);
                      card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }, 100);
                  }
                }} />
              </div>
              {/* Scale */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5, flexWrap: "wrap",
                padding: "6px 0", flexShrink: 0,
              }}>
                {SCALE.map((x) => (
                  <Tooltip key={x.l} text={x.tip}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 6,
                    background: x.c + (dk ? "20" : "12"),
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: x.c }} />
                    <span style={{ fontSize: 12, color: dk ? "#ffffff" : "#000000", fontWeight: 600 }}>{x.l}</span>
                    <span style={{ fontSize: 12, color: dk ? "#ffffff" : "#000000", fontWeight: 500 }}>{x.r}</span>
                  </div>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Right: scrollable cards */}
            <div style={{
              width: 360, minWidth: 320, flexShrink: 0, overflowY: "scroll", padding: "6px 10px",
              borderLeft: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
            }}>
              <CapabilityCards capabilities={capabilities} anim={anim} activeIdx={activeIdx} onSelect={setActiveIdx} />
            </div>
          </>) : viewMode === "maturity" ? (
            <MaturityView capabilities={capabilities} dk={dk} text={text} textSec={textSec} textTert={textTert} overallMaturityLevel={overallMaturityLevel} collapseKey={collapseKey} />
          ) : (
            <RecommendationsView capabilities={capabilities} dk={dk} text={text} textSec={textSec} textTert={textTert} totalScore={totalScore} overallMaturityLevel={overallMaturityLevel} collapseKey={collapseKey} history={history} onDrilldown={setViewMode} />
          )}
          </div>

          {/* How to Analyze — footer */}
          {viewMode === "coverage" ? (<div style={{
            flexShrink: 0,
            padding: "12px 20px 14px",
            borderTop: `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
            background: dk ? "rgba(65,105,225,0.04)" : "rgba(65,105,225,0.02)",
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: text, marginBottom: 8, letterSpacing: 0.2 }}>How to Analyze — Coverage View</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>

              <div style={{
                padding: "8px 10px", borderRadius: 6,
                background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 3 }}>What You're Seeing</div>
                <div style={{ fontSize: 12, color: textSec, lineHeight: 1.55 }}>
                  The radar chart shows <strong style={{ color: text }}>how much</strong> of each capability is used. Each of the <strong style={{ color: text }}>{capabilities.length} axes</strong> represents one capability. The <strong style={{ color: text }}>filled area</strong> reveals adoption breadth.
                </div>
              </div>

              <div style={{
                padding: "8px 10px", borderRadius: 6,
                background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 3 }}>How to Read the Score</div>
                <div style={{ fontSize: 12, color: textSec, lineHeight: 1.55 }}>
                  Each capability scores <strong style={{ color: text }}>0–100%</strong> based on <strong style={{ color: text }}>criteria met</strong>. <span style={{ color: "#36B37E", fontWeight: 700 }}>Green</span> = met, <span style={{ color: "#CD3C44", fontWeight: 700 }}>red</span> = not met. Click a capability to drill down.
                </div>
              </div>

              <div style={{
                padding: "8px 10px", borderRadius: 6,
                background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 3 }}>What to Look For</div>
                <div style={{ fontSize: 12, color: textSec, lineHeight: 1.55 }}>
                  <strong style={{ color: text }}>Flat axes</strong> = low adoption. <strong style={{ color: text }}>Asymmetric shapes</strong> = uneven usage. Aim for a <strong style={{ color: text }}>balanced, expanded radar</strong>.
                </div>
              </div>

              <div style={{
                padding: "8px 10px", borderRadius: 6,
                background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 3 }}>Color Scale</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {[
                    { l: "N/A", c: "#CD3C44", t: "0–19% Critical gaps" },
                    { l: "Low", c: "#DC671E", t: "20–39% Early adoption" },
                    { l: "Moderate", c: "#EEA746", t: "40–59% Partial" },
                    { l: "Good", c: "#5EB1A9", t: "60–79% Strong" },
                    { l: "Excellent", c: "#36B37E", t: "80–100% Full" },
                  ].map((s) => (
                    <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.c, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: s.c, minWidth: 55 }}>{s.l}</span>
                      <span style={{ fontSize: 12, color: textSec }}>{s.t}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>) : viewMode === "maturity" ? (<div style={{
            flexShrink: 0,
            padding: "12px 20px 14px",
            borderTop: `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
            background: dk ? "rgba(65,105,225,0.04)" : "rgba(65,105,225,0.02)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: text, marginBottom: 14, letterSpacing: 0.2 }}>How to Analyze — Maturity View</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>

              <div style={{
                padding: "12px 14px", borderRadius: 8,
                background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 6 }}>What You're Seeing</div>
                <div style={{ fontSize: 12, color: textSec, lineHeight: 1.65 }}>
                  Each card shows a <strong style={{ color: text }}>weighted maturity score</strong> (0–100%) per capability. The score combines three tiers with progressive scaling: <strong style={{ color: "#5B6ACF" }}>Foundation</strong> (60% weight), <strong style={{ color: "#EEA746" }}>Best Practice</strong> (25% — only counts if Foundation &ge; 80%), and <strong style={{ color: "#36B37E" }}>Excellence</strong> (15% — only counts if Best Practice &ge; 60%). Cards are sorted from lowest to highest maturity.
                </div>
              </div>

              <div style={{
                padding: "12px 14px", borderRadius: 8,
                background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 6 }}>Weighted Tiers</div>
                <div style={{ fontSize: 12, color: textSec, lineHeight: 1.65 }}>
                  <strong style={{ color: "#5B6ACF" }}>Foundation (60%)</strong> — the essentials (hosts, services, basic data flow).
                  <strong style={{ color: "#EEA746" }}> Best Practice (25%)</strong> — deeper adoption (trace correlation, advanced metrics). Only counts if Foundation &ge; 80%.
                  <strong style={{ color: "#36B37E" }}> Excellence (15%)</strong> — advanced maturity (multi-service traces, guardrails, cost tracking). Only counts if Best Practice &ge; 60%.
                </div>
              </div>

              <div style={{
                padding: "12px 14px", borderRadius: 8,
                background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 6 }}>Maturity Bands</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, lineHeight: 1.6 }}>
                  <div><span style={{ color: "#CD3C44", fontWeight: 700 }}>N/A</span> <span style={{ color: textSec }}>0–19% — Minimal or no adoption</span></div>
                  <div><span style={{ color: "#DC671E", fontWeight: 700 }}>Low</span> <span style={{ color: textSec }}>20–39% — Early stage, significant gaps</span></div>
                  <div><span style={{ color: "#EEA746", fontWeight: 700 }}>Moderate</span> <span style={{ color: textSec }}>40–59% — Partial adoption, key areas configured</span></div>
                  <div><span style={{ color: "#5EB1A9", fontWeight: 700 }}>Good</span> <span style={{ color: textSec }}>60–79% — Strong adoption, room to optimize</span></div>
                  <div><span style={{ color: "#36B37E", fontWeight: 700 }}>Excellent</span> <span style={{ color: textSec }}>80–100% — Comprehensive maturity</span></div>
                </div>
              </div>

              <div style={{
                padding: "12px 14px", borderRadius: 8,
                background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                border: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 6 }}>What to Look For</div>
                <div style={{ fontSize: 12, color: textSec, lineHeight: 1.65 }}>
                  Focus on <strong style={{ color: text }}>Foundation tier first</strong> — it carries the most weight (60%) and unlocks Best Practice scoring. Low-scoring capabilities need immediate attention. Click any card to see <strong style={{ color: text }}>which specific criteria</strong> are missing in each tier. Use <strong style={{ color: text }}>Evolution Over Time</strong> to track progress.
                </div>
              </div>

            </div>
          </div>) : null}
        </>
      )}

      {/* Error State */}
      {error && (
        <div style={{ textAlign: "center", padding: 24, color: "#CD3C44" }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>Assessment failed</div>
          <div style={{ fontSize: 12, color: textSec }}>{error}</div>
        </div>
      )}
    </div>
  );
};

/* ── MATURITY VIEW ── */
const maturityAnimStyle = `
@keyframes matFadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
@keyframes matBarFill { from { width: 0%; } }
@keyframes matScaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes matCountUp { from { opacity: 0; } to { opacity: 1; } }
`;

function MaturityView({ capabilities, dk, text, textSec, textTert, overallMaturityLevel, collapseKey }: {
  capabilities: CapabilityResult[];
  dk: boolean; text: string; textSec: string; textTert: string;
  overallMaturityLevel: number; collapseKey: number;
}) {
  const matBand = overallMaturityLevel >= 80 ? "Excellent" : overallMaturityLevel >= 60 ? "Good" : overallMaturityLevel >= 40 ? "Moderate" : overallMaturityLevel >= 20 ? "Low" : "N/A";
  const matColor = maturityBandColor(overallMaturityLevel);

  const totals = useMemo(() => capabilities.reduce((acc, c) => ({
    fnd: acc.fnd + c.maturity.foundation.passed,
    fndT: acc.fndT + c.maturity.foundation.total,
    bp: acc.bp + c.maturity.bestPractice.passed,
    bpT: acc.bpT + c.maturity.bestPractice.total,
    exc: acc.exc + c.maturity.excellence.passed,
    excT: acc.excT + c.maturity.excellence.total,
  }), { fnd: 0, fndT: 0, bp: 0, bpT: 0, exc: 0, excT: 0 }), [capabilities]);

  const sorted = useMemo(() => [...capabilities].sort((a, b) => a.maturity.maturityScore - b.maturity.maturityScore), [capabilities]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
      <style>{maturityAnimStyle}</style>

      {/* ── Overall maturity hero ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 20, marginBottom: 20, padding: "16px 22px",
        background: dk ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.015)",
        border: `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
        borderRadius: 12,
        animation: "matFadeUp 0.5s ease both",
      }}>
        {/* Score + band */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: matColor, fontFamily: "system-ui, sans-serif", animation: "matCountUp 0.6s ease both 0.2s" }}>{overallMaturityLevel}%</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: matColor, opacity: 0.85 }}>{matBand}</span>
        </div>
        <span style={{ width: 1, alignSelf: "stretch", margin: "4px 0", background: dk ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", borderRadius: 1 }} />

        {/* Overall bar */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: textSec, letterSpacing: 0.5 }}>Overall Maturity Level</span>
          <div style={{ height: 8, borderRadius: 4, overflow: "hidden", background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${overallMaturityLevel}%`,
              background: `linear-gradient(90deg, ${matColor}99, ${matColor})`,
              animation: "matBarFill 0.9s ease both 0.3s",
            }} />
          </div>
        </div>

        {/* Tier pills */}
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          {([
            { label: "FND", color: "#5B6ACF", passed: totals.fnd, total: totals.fndT },
            { label: "BP", color: "#EEA746", passed: totals.bp, total: totals.bpT },
            { label: "EXC", color: "#36B37E", passed: totals.exc, total: totals.excT },
          ] as const).map((t, i) => {
            const pct = t.total > 0 ? Math.round((t.passed / t.total) * 100) : 0;
            return (
              <div key={t.label} style={{
                textAlign: "center", padding: "6px 12px", borderRadius: 8,
                background: t.color + (dk ? "12" : "08"),
                border: `1px solid ${t.color}20`,
                animation: `matScaleIn 0.35s ease both ${0.4 + i * 0.1}s`,
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: t.color, lineHeight: 1 }}>{t.passed}/{t.total}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.color, opacity: 0.75, marginTop: 2, letterSpacing: 0.5 }}>{t.label} · {pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Capability cards grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {sorted.map((cap, i) => (
          <div key={cap.name} style={{ animation: `matFadeUp 0.4s ease both ${0.15 + i * 0.06}s` }}>
            <MaturityCard cap={cap} dk={dk} text={text} textSec={textSec} textTert={textTert} collapseKey={collapseKey} />
          </div>
        ))}
      </div>

      {/* Quick-start guide */}
      <div style={{
        marginTop: 22, padding: "14px 18px", borderRadius: 10,
        background: dk ? "rgba(0,200,83,0.05)" : "rgba(0,200,83,0.03)",
        border: `1px solid ${dk ? "rgba(0,200,83,0.12)" : "rgba(0,200,83,0.08)"}`,
        animation: `matFadeUp 0.4s ease both ${0.15 + sorted.length * 0.06 + 0.1}s`,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 6 }}>Suggested Approach</div>
        <div style={{ fontSize: 12, color: textSec, lineHeight: 1.7 }}>
          <strong style={{ color: text }}>1.</strong> Identify capabilities with <strong style={{ color: "#CD3C44" }}>low maturity scores</strong> — these need the most attention.{" "}
          <strong style={{ color: text }}>2.</strong> For each, complete the <strong style={{ color: "#5B6ACF" }}>Foundation</strong> tier first — it carries <strong style={{ color: text }}>60% weight</strong> and unlocks Best Practice scoring.{" "}
          <strong style={{ color: text }}>3.</strong> Then advance to <strong style={{ color: "#EEA746" }}>Best Practice</strong> (25% weight, requires Foundation &ge; 80%) and <strong style={{ color: "#36B37E" }}>Excellence</strong> (15% weight, requires Best Practice &ge; 60%).{" "}
          <strong style={{ color: text }}>4.</strong> Click any card to see <strong style={{ color: text }}>which specific criteria</strong> are missing in each tier.
        </div>
      </div>
    </div>
  );
}

/* ── EXECUTIVE SUMMARY VIEW ── */

const recAnimStyle = `
@keyframes recFadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
@keyframes recBarFill { from { width: 0%; } }
@keyframes recScaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes recCountUp { from { opacity: 0; } to { opacity: 1; } }
@media print {
  body, html { background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  * { animation: none !important; transition: none !important; box-shadow: none !important; }
  [data-rec-root] { overflow: visible !important; height: auto !important; padding: 0 !important; }
  [data-no-print] { display: none !important; }
  [data-rec-card] { break-inside: avoid; page-break-inside: avoid; }
}
`;

function RecommendationsView({ capabilities, dk, text, textSec, textTert, totalScore, overallMaturityLevel, collapseKey, history, onDrilldown }: {
  capabilities: CapabilityResult[];
  dk: boolean; text: string; textSec: string; textTert: string;
  totalScore: number; overallMaturityLevel: number; collapseKey: number;
  history: ReturnType<typeof useAssessmentHistory>;
  onDrilldown: (mode: ViewMode) => void;
}) {
  const borderSub = dk ? "rgba(91,106,207,0.25)" : "rgba(0,0,0,0.08)";
  const card = dk ? "rgba(20,22,40,0.85)" : "rgba(248,249,252,0.9)";
  const cardGlow = dk ? "0 0 12px rgba(91,106,207,0.12), inset 0 1px 0 rgba(255,255,255,0.04)" : "0 1px 6px rgba(0,0,0,0.06)";
  const COV_C = "#4C9AFF";
  const MAT_C = "#B07AE8";
  const covBandC = maturityBandColor(totalScore);
  const matBandC = maturityBandColor(overallMaturityLevel);
  const gridC = dk ? "rgba(91,106,207,0.12)" : "rgba(0,0,0,0.06)";
  const labelC = dk ? "#d0d0e8" : "#4a4a5e";
  const bandLabel = (s: number) => s >= 80 ? "Excellent" : s >= 60 ? "Good" : s >= 40 ? "Moderate" : s >= 20 ? "Low" : "N/A";

  // ── Criterion → Tier map ──
  const tierMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const cap of capabilities) for (const cr of cap.criteriaResults) m[cr.id] = cr.tier;
    return m;
  }, [capabilities]);

  // ── Snapshots sorted chronologically ──
  const sortedSnaps = useMemo(() =>
    [...history.snapshots].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [history.snapshots]
  );

  // ── Evolution data ──
  const evolution = useMemo(() => sortedSnaps.map(snap => {
    const ti: Record<string, { t: number; p: number }> = { foundation: { t: 0, p: 0 }, bestPractice: { t: 0, p: 0 }, excellence: { t: 0, p: 0 } };
    for (const cap of snap.capabilities)
      for (const cr of cap.criteriaResults) {
        const tier = tierMap[cr.id];
        if (tier && ti[tier]) { ti[tier].t++; if (!cr.error && cr.points > 0) ti[tier].p++; }
      }
    const fP = ti.foundation.t > 0 ? ti.foundation.p / ti.foundation.t : 0;
    const bP = ti.bestPractice.t > 0 ? ti.bestPractice.p / ti.bestPractice.t : 0;
    const eP = ti.excellence.t > 0 ? ti.excellence.p / ti.excellence.t : 0;
    const effB = fP >= 0.8 ? bP : 0;
    const effE = effB >= 0.6 ? eP : 0;
    return { date: snap.timestamp, cov: snap.totalScore, mat: Math.round(fP * 60 + effB * 25 + effE * 15) };
  }), [sortedSnaps, tierMap]);

  // ── Deltas from previous snapshot ──
  const prevSnap = evolution.length >= 2 ? evolution[evolution.length - 2] : null;
  const covDelta = prevSnap ? totalScore - prevSnap.cov : null;
  const matDelta = prevSnap ? overallMaturityLevel - prevSnap.mat : null;

  // ── Per-capability gaps ──
  const capGaps = useMemo(() =>
    capabilities.map(cap => {
      const gaps = cap.criteriaResults.filter(cr => !cr.error && cr.points === 0);
      const critical = gaps.filter(cr => cr.value === 0).length;
      const quickWin = gaps.filter(cr => cr.isRatio && cr.value > 0 && cr.value < 100).length;
      const other = gaps.length - critical - quickWin;
      return { name: cap.name, color: cap.color, cov: cap.score, mat: cap.maturity.maturityScore, total: gaps.length, critical, quickWin, other };
    }).sort((a, b) => b.total - a.total),
    [capabilities]
  );
  const totalGaps = capGaps.reduce((s, c) => s + c.total, 0);

  // ── Chart.js — Combo Bar (Coverage) + Line (Maturity) ──
  const sorted = useMemo(() => [...capabilities].sort((a, b) => a.name.localeCompare(b.name)), [capabilities]);

  const RADAR_COV = dk ? "#00E5FF" : "#0097A7";  // cyan (dark) / dark cyan (light)
  const RADAR_MAT = dk ? "#D500F9" : "#9C27B0"; // magenta (dark) / purple (light)

  const comboData = useMemo(() => ({
    labels: sorted.map(c => c.name),
    datasets: [
      {
        label: "Coverage %",
        data: sorted.map(c => c.score),
        fill: true,
        backgroundColor: RADAR_COV + "18",
        borderColor: RADAR_COV,
        borderWidth: 2,
        borderDash: [],
        pointBackgroundColor: sorted.map(c => c.color),
        pointBorderColor: sorted.map(c => c.color),
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointHoverBackgroundColor: sorted.map(c => c.color),
      },
      {
        label: "Maturity %",
        data: sorted.map(c => c.maturity.maturityScore),
        fill: true,
        backgroundColor: RADAR_MAT + "18",
        borderColor: RADAR_MAT,
        borderWidth: 2,
        borderDash: [6, 3],
        pointBackgroundColor: sorted.map(c => c.color),
        pointBorderColor: sorted.map(c => c.color),
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointHoverBackgroundColor: sorted.map(c => c.color),
      },
    ],
  }), [sorted, dk]);

  const comboOptions = useMemo<ChartOptions<"radar">>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1200,
      easing: "easeOutQuart" as const,
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: dk ? "#FFFFFF" : "#1A1A2E",
          font: { size: 12, weight: "bold" },
          usePointStyle: true,
          pointStyle: "line",
          pointStyleWidth: 20,
          padding: 12,
          generateLabels: (chart: any) =>
            chart.data.datasets.map((ds: any, i: number) => ({
              text: ds.label,
              fontColor: dk ? "#FFFFFF" : "#1A1A2E",
              fillStyle: "transparent",
              strokeStyle: ds.borderColor,
              lineWidth: 2,
              lineDash: ds.borderDash || [],
              pointStyle: "line",
              hidden: !chart.isDatasetVisible(i),
              datasetIndex: i,
            })),
        },
      },
      tooltip: {
        backgroundColor: dk ? "rgba(18,20,36,0.95)" : "#fff",
        titleColor: labelC,
        bodyColor: labelC,
        borderColor: dk ? "rgba(91,106,207,0.35)" : "rgba(0,0,0,0.1)",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.r}%`,
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        beginAtZero: true,
        ticks: {
          stepSize: 20,
          color: labelC,
          font: { size: 12, weight: "600" as any },
          backdropColor: "transparent",
          callback: (v: any) => `${v}%`,
        },
        pointLabels: {
          color: labelC,
          font: { size: 12, weight: "600" as any },
        },
        grid: { color: gridC },
        angleLines: { color: gridC },
      },
    },
  }), [dk, labelC, gridC]);

  // ── KPI helpers ──
  const totalCriteria = capabilities.reduce((s, c) => s + c.criteriaResults.length, 0);
  const passedCriteria = capabilities.reduce((s, c) => s + c.criteriaResults.filter(cr => !cr.error && cr.points > 0).length, 0);
  const totalCritical = capGaps.reduce((s, c) => s + c.critical, 0);
  const totalQuickWin = capGaps.reduce((s, c) => s + c.quickWin, 0);
  const totalOther = capGaps.reduce((s, c) => s + c.other, 0);
  const topGapCap = capGaps.length > 0 ? capGaps[0] : null;
  const bestCap = [...capabilities].sort((a, b) => b.score - a.score)[0] ?? null;
  const worstCap = [...capabilities].sort((a, b) => a.score - b.score)[0] ?? null;
  const bestMatCap = [...capabilities].sort((a, b) => b.maturity.maturityScore - a.maturity.maturityScore)[0] ?? null;
  const worstMatCap = [...capabilities].sort((a, b) => a.maturity.maturityScore - b.maturity.maturityScore)[0] ?? null;
  const excellentCount = capabilities.filter(c => c.score >= 80).length;
  const goodCount = capabilities.filter(c => c.score >= 60 && c.score < 80).length;
  const criticalCount = capabilities.filter(c => c.score < 20).length;
  const lowCount = capabilities.filter(c => c.score >= 20 && c.score < 40).length;
  const fullCoverageCaps = capabilities.filter(c => c.score === 100);
  const zeroCoverageCaps = capabilities.filter(c => c.score === 0);

  const MiniBar = ({ pct, color, h = 6, delay = 0.3 }: { pct: number; color: string; h?: number; delay?: number }) => (
    <div style={{ width: "100%", height: h, borderRadius: h / 2, background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, borderRadius: h / 2, background: `linear-gradient(90deg, ${color}99, ${color})` }} />
    </div>
  );

  return (
    <div data-rec-root style={{ flex: 1, overflow: "hidden", padding: "12px 20px", display: "flex", flexDirection: "column" as const }}>
      <style>{recAnimStyle}</style>

      <div style={{ fontSize: 14, fontWeight: 800, color: text, marginBottom: 2, letterSpacing: 0.2, animation: "recFadeUp 0.3s ease both" }}>
        Executive Summary
      </div>
      <div style={{ fontSize: 12, color: textSec, marginBottom: 12, lineHeight: 1.4, animation: "recFadeUp 0.3s ease both 0.05s" }}>
        Overall assessment of observability coverage and maturity across {capabilities.length} capabilities · {totalCriteria} criteria evaluated
      </div>

      {/* ═══ SECTION 1: Highlights ═══ */}
      <div style={{
        borderRadius: 10, border: `1px solid ${borderSub}`, background: card,
        padding: "14px 18px", boxShadow: cardGlow, marginBottom: 14,
        animation: "recFadeUp 0.5s ease both",
      }}>

        {/* ── Row 1: Scores ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 12, flexWrap: "wrap" as const }}>

          {/* Coverage score */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 200px", padding: "6px 0" }}>
            <div style={{ width: 4, height: 36, borderRadius: 2, background: covBandC, boxShadow: dk ? `0 0 6px ${covBandC}40` : "none" }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: labelC, letterSpacing: 0.4, marginBottom: 1 }}>COVERAGE</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: covBandC, fontFamily: "system-ui, sans-serif", lineHeight: 1 }}>{totalScore}%</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: covBandC, opacity: 0.8 }}>{bandLabel(totalScore)}</span>
                {covDelta !== null && covDelta !== 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: covDelta > 0 ? "#36B37E" : "#CD3C44" }}>
                    {covDelta > 0 ? "\u25B2" : "\u25BC"}{Math.abs(covDelta)}pp
                  </span>
                )}
              </div>
            </div>
            <MiniBar pct={totalScore} color={covBandC} />
          </div>

          <div style={{ width: 1, height: 32, background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", margin: "0 16px", flexShrink: 0 }} />

          {/* Maturity score */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 200px", padding: "6px 0" }}>
            <div style={{ width: 4, height: 36, borderRadius: 2, background: matBandC, boxShadow: dk ? `0 0 6px ${matBandC}40` : "none" }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: labelC, letterSpacing: 0.4, marginBottom: 1 }}>MATURITY</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: matBandC, fontFamily: "system-ui, sans-serif", lineHeight: 1 }}>{overallMaturityLevel}%</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: matBandC, opacity: 0.8 }}>{bandLabel(overallMaturityLevel)}</span>
                {matDelta !== null && matDelta !== 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: matDelta > 0 ? "#36B37E" : "#CD3C44" }}>
                    {matDelta > 0 ? "\u25B2" : "\u25BC"}{Math.abs(matDelta)}pp
                  </span>
                )}
              </div>
            </div>
            <MiniBar pct={overallMaturityLevel} color={matBandC} />
          </div>

          <div style={{ width: 1, height: 32, background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", margin: "0 16px", flexShrink: 0 }} />

          {/* Quick stats */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
            <div style={{ textAlign: "center" as const }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#5B6ACF", lineHeight: 1 }}>{capabilities.length}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: labelC, marginTop: 2, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Capabilities</div>
            </div>
            <div style={{ textAlign: "center" as const }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#5B6ACF", lineHeight: 1 }}>{passedCriteria}<span style={{ fontSize: 12, fontWeight: 600, color: labelC }}>/{totalCriteria}</span></div>
              <div style={{ fontSize: 12, fontWeight: 700, color: labelC, marginTop: 2, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Criteria Met</div>
            </div>
          </div>
        </div>

        {/* ── Row 2: Achievements vs Gaps (side by side) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

          {/* Achievements column */}
          <div style={{
            borderRadius: 8, padding: "10px 14px",
            background: dk ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
            borderLeft: "3px solid #36B37E",
            animation: "recScaleIn 0.35s ease both 0.55s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>✓</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#36B37E", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Achievements</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: text, marginLeft: "auto", fontFamily: "system-ui, sans-serif" }}>{passedCriteria}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: labelC }}>Criteria passed</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: text }}>{passedCriteria}<span style={{ color: labelC, fontWeight: 600 }}>/{totalCriteria}</span></span>
              </div>

              {/* Excellent capabilities */}
              {excellentCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: labelC }}>Excellent capabilities (≥80%)</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: text }}>{excellentCount}</span>
                </div>
              )}

              {/* Good capabilities */}
              {goodCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: labelC }}>Good capabilities (60–79%)</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: text }}>{goodCount}</span>
                </div>
              )}

              {/* Full coverage */}
              {fullCoverageCaps.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: labelC }}>Full coverage (100%)</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: text }}>{fullCoverageCaps.length}</span>
                </div>
              )}

              {/* Best capability */}
              {bestCap && (
                <div style={{ marginTop: 4, padding: "6px 10px", borderRadius: 6, background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: labelC, marginBottom: 2, textTransform: "uppercase" as const, letterSpacing: 0.4 }}>TOP CAPABILITY</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{bestCap.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: maturityBandColor(bestCap.score), fontFamily: "system-ui, sans-serif", flexShrink: 0, marginLeft: 8 }}>{bestCap.score}%</span>
                  </div>
                </div>
              )}

              {/* Best maturity */}
              {bestMatCap && bestMatCap.name !== bestCap?.name && (
                <div style={{ padding: "6px 10px", borderRadius: 6, background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: labelC, marginBottom: 2, textTransform: "uppercase" as const, letterSpacing: 0.4 }}>TOP MATURITY</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{bestMatCap.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: maturityBandColor(bestMatCap.maturity.maturityScore), fontFamily: "system-ui, sans-serif", flexShrink: 0, marginLeft: 8 }}>{bestMatCap.maturity.maturityScore}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Gaps column */}
          <div style={{
            borderRadius: 8, padding: "10px 14px",
            background: dk ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
            borderLeft: "3px solid #CD3C44",
            animation: "recScaleIn 0.35s ease both 0.65s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>✗</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#CD3C44", letterSpacing: 0.5, textTransform: "uppercase" as const }}>Gaps</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: totalGaps > 0 ? "#CD3C44" : "#36B37E", marginLeft: "auto", fontFamily: "system-ui, sans-serif" }}>{totalGaps}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
              {/* Gap breakdown */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: labelC }}>Critical gaps (value = 0)</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: totalCritical > 0 ? "#CD3C44" : text }}>{totalCritical}</span>
              </div>

              {/* Low/Critical caps */}
              {criticalCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: labelC }}>Critical capabilities (&lt;20%)</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#CD3C44" }}>{criticalCount}</span>
                </div>
              )}
              {lowCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: labelC }}>Low capabilities (20–39%)</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#DC671E" }}>{lowCount}</span>
                </div>
              )}

              {/* Worst capability */}
              {worstCap && (
                <div style={{ marginTop: 4, padding: "6px 10px", borderRadius: 6, background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: labelC, marginBottom: 2, textTransform: "uppercase" as const, letterSpacing: 0.4 }}>NEEDS MOST ATTENTION</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{worstCap.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: maturityBandColor(worstCap.score), fontFamily: "system-ui, sans-serif", flexShrink: 0, marginLeft: 8 }}>{worstCap.score}%</span>
                  </div>
                </div>
              )}

              {/* Most gaps capability */}
              {topGapCap && topGapCap.name !== worstCap?.name && (
                <div style={{ padding: "6px 10px", borderRadius: 6, background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: labelC, marginBottom: 2, textTransform: "uppercase" as const, letterSpacing: 0.4 }}>MOST GAPS</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{topGapCap.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: "#EEA746", flexShrink: 0, marginLeft: 8 }}>{topGapCap.total} gaps</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ═══ SECTIONS 2 & 3: Charts side by side ═══ */}
      <div style={{ display: "flex", gap: 12, marginBottom: 0 }}>
        {/* ── Combo Bar-Line Chart — Coverage vs Maturity ── */}
        <div data-rec-card style={{
          flex: "1 1 0", minWidth: 340,
          borderRadius: 12, border: `1px solid ${borderSub}`, background: card,
          padding: "12px 14px 8px",
          boxShadow: cardGlow,
          animation: "recFadeUp 0.4s ease both 0.75s",
          display: "flex", flexDirection: "column" as const,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: labelC, letterSpacing: 0.5, marginBottom: 6 }}>
            Coverage vs Maturity by Capability
          </div>
          <div style={{ height: "calc(100vh - 560px)", minHeight: 160 }}>
            <Radar data={comboData as any} options={comboOptions as any} />
          </div>
        </div>

        {/* ── Bubble Chart — Capability Map ── */}
        <div data-rec-card style={{
          flex: "1 1 0", minWidth: 340,
          borderRadius: 12, border: `1px solid ${borderSub}`, background: card,
          padding: "12px 14px 8px",
          boxShadow: cardGlow,
          animation: "recFadeUp 0.4s ease both 0.85s",
          display: "flex", flexDirection: "column" as const,
        }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: labelC, letterSpacing: 0.5, marginBottom: 6 }}>
          Capability Map — Coverage × Maturity × Gaps
        </div>
        <div style={{ height: "calc(100vh - 560px)", minHeight: 160 }}>
          <Bubble
            data={{
              datasets: capabilities.map(c => {
                const gaps = c.criteriaResults.filter(cr => !cr.error && cr.points === 0).length;
                return {
                  label: c.name,
                  data: [{ x: c.score, y: c.maturity.maturityScore, r: Math.max(6, Math.min(30, gaps * 4)) }],
                  backgroundColor: c.color + "70",
                  borderColor: c.color,
                  borderWidth: 1.5,
                  hoverBackgroundColor: c.color + "A0",
                  hoverBorderWidth: 2,
                };
              }),
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: {
                duration: 1400,
                easing: "easeOutQuart" as const,
              },
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: dk ? "rgba(18,20,36,0.95)" : "#fff",
                  titleColor: labelC,
                  bodyColor: labelC,
                  borderColor: dk ? "rgba(91,106,207,0.35)" : "rgba(0,0,0,0.1)",
                  borderWidth: 1,
                  padding: 12,
                  cornerRadius: 8,
                  callbacks: {
                    label: (ctx: any) => {
                      const d = ctx.raw;
                      const gaps = Math.round((d.r - 2) / 4);
                      return [`Coverage: ${d.x}%`, `Maturity: ${d.y}%`, `Gaps: ${gaps > 0 ? gaps : 0}`];
                    },
                  },
                },
              },
              scales: {
                x: {
                  min: 0, max: 100,
                  title: { display: true, text: "Coverage %", color: labelC, font: { size: 12, weight: "bold" } },
                  ticks: { color: labelC, font: { size: 12, weight: "600" as any }, stepSize: 20, callback: (v: any) => `${v}%` },
                  grid: { color: gridC },
                  border: { color: dk ? "rgba(91,106,207,0.2)" : "rgba(0,0,0,0.08)" },
                },
                y: {
                  min: 0, max: 100,
                  title: { display: true, text: "Maturity %", color: labelC, font: { size: 12, weight: "bold" } },
                  ticks: { color: labelC, font: { size: 12, weight: "600" as any }, stepSize: 20, callback: (v: any) => `${v}%` },
                  grid: { color: gridC },
                  border: { color: dk ? "rgba(91,106,207,0.2)" : "rgba(0,0,0,0.08)" },
                },
              },
            }}
          />
        </div>
      </div>
      </div>

      {/* ═══ Unified Legend ═══ */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center",
        gap: "6px 16px", marginBottom: 0, marginTop: 10, padding: "8px 14px",
        borderRadius: 10, border: `1px solid ${borderSub}`, background: card, boxShadow: cardGlow,
      }}>
        {/* Capability dots */}
        {capabilities.map(c => (
          <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: c.color, boxShadow: dk ? `0 0 4px ${c.color}80` : "none" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: labelC }}>{c.name}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

/* ── Single Maturity Card ── */
function MaturityCard({ cap, dk, text, textSec, textTert, collapseKey }: {
  cap: CapabilityResult;
  dk: boolean; text: string; textSec: string; textTert: string; collapseKey: number;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setExpanded(false); }, [collapseKey]);
  const m = cap.maturity;
  const scoreColor = maturityBandColor(m.maturityScore);

  return (
    <div
      onClick={(e) => { e.stopPropagation(); if (isTextSelection()) return; setExpanded(!expanded); }}
      style={{
        background: dk ? "#161630" : "#ffffff",
        border: `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
        borderRadius: 12, padding: "16px 18px",
        borderLeft: `4px solid ${cap.color}`,
        cursor: "pointer",
        transition: "box-shadow 0.2s, transform 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 20px ${cap.color}22`; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: text, flex: 1 }}>{cap.name}</span>
        <span style={{
          fontSize: 12, fontWeight: 800, padding: "2px 10px", borderRadius: 6,
          background: scoreColor + (dk ? "25" : "15"),
          color: scoreColor, fontFamily: "system-ui, sans-serif",
        }}>{m.maturityScore}%</span>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
          color: scoreColor, opacity: 0.8,
        }}>{m.maturityBand}</span>
        <span style={{ fontSize: 12, color: textSec, fontWeight: 600 }}>{expanded ? "▾" : "▸"}</span>
      </div>

      {/* Overall maturity bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          height: 8, borderRadius: 4, overflow: "hidden",
          background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        }}>
          <div style={{
            height: "100%", borderRadius: 4,
            width: `${m.maturityScore}%`,
            background: `linear-gradient(90deg, ${scoreColor}cc, ${scoreColor})`,
            animation: "matBarFill 0.8s ease both 0.3s",
          }} />
        </div>
      </div>

      {/* Tier bars */}
      {TIER_META.map((t, ti) => {
        const tier = m[t.key];
        const pct = tier.total > 0 ? Math.round((tier.passed / tier.total) * 100) : 0;
        const weight = t.key === "foundation" ? "60%" : t.key === "bestPractice" ? "25%" : "15%";
        return (
          <div key={t.key} style={{ marginBottom: 5 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: textSec }}>{t.label} <span style={{ fontWeight: 400, color: textTert }}>({weight})</span></span>
              <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? "#36B37E" : pct > 0 ? text : textTert }}>
                {tier.passed}/{tier.total}
              </span>
            </div>
            <div style={{
              height: 5, borderRadius: 3, overflow: "hidden",
              background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
            }}>
              <div style={{
                height: "100%", borderRadius: 3,
                width: `${pct}%`,
                background: pct === 100 ? "#36B37E" : t.color,
                animation: `matBarFill 0.7s ease both ${0.45 + ti * 0.15}s`,
              }} />
            </div>
          </div>
        );
      })}

      {/* Expanded: show criteria by tier with drilldown */}
      {expanded && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, paddingTop: 10 }}>
          {TIER_META.map(t => {
            const criteria = cap.criteriaResults.filter(cr => cr.tier === t.key);
            if (criteria.length === 0) return null;
            return (
              <div key={t.key} style={{ marginBottom: 10 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: t.color,
                  textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4,
                }}>{t.label}</div>
                {criteria.map(cr => (
                  <MaturityCriterionRow key={cr.id} cr={cr} dk={dk} text={text} textSec={textSec} textTert={textTert} collapseKey={collapseKey} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Card for grid view (click to zoom) ── */
/* ── Single criterion row inside MaturityCard with drilldown ── */
function MaturityCriterionRow({ cr, dk, text, textSec, textTert, collapseKey }: {
  cr: CapabilityResult["criteriaResults"][number];
  dk: boolean; text: string; textSec: string; textTert: string; collapseKey: number;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [collapseKey]);
  const passed = !cr.error && cr.points > 0;
  const importance = CRITERION_IMPORTANCE[cr.id] || "";
  const remediation = CRITERION_REMEDIATION[cr.id];

  return (
    <div style={{ marginBottom: 2 }}>
      <div
        onClick={(e) => { e.stopPropagation(); if (isTextSelection()) return; setOpen(!open); }}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "5px 6px", fontSize: 12, borderRadius: 6, cursor: "pointer",
          background: open ? (dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)") : "transparent",
          transition: "background 0.15s",
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: passed ? "#36B37E" : "#CD3C44",
        }} />
        <Tooltip text={criterionTooltipContent(cr.id, cr.description, cr.tier)} containerStyle={{ flex: 1 }} maxWidth={340}>
          <span style={{ color: passed ? text : textSec }}>{cr.label}</span>
        </Tooltip>
        {cr.value > 0 && (
          <span style={{ fontSize: 12, color: textTert, fontWeight: 600 }}>{cr.isRatio ? `${cr.value}%` : cr.value.toLocaleString()}</span>
        )}
        <span style={{ fontSize: 12, color: textTert, fontWeight: 600 }}>{open ? "▾" : "▸"}</span>
      </div>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            margin: "4px 0 8px 16px", padding: "10px 14px", borderRadius: 8,
            background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.015)",
            border: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
            borderLeft: `3px solid ${passed ? "#36B37E" : "#CD3C44"}`,
            animation: "fadeIn 0.2s ease",
          }}
        >
          {/* Description */}
          <div style={{ fontSize: 12, color: textSec, lineHeight: 1.6, marginBottom: 10 }}>
            {cr.description}
          </div>

          {/* Measured value badge — shows current vs target for failed criteria */}
          {!passed && !cr.error && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 10,
              padding: "6px 12px", borderRadius: 6,
              background: dk ? "rgba(229,57,53,0.08)" : "rgba(229,57,53,0.05)",
              border: `1px solid ${dk ? "rgba(229,57,53,0.18)" : "rgba(229,57,53,0.12)"}`,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 12, color: textTert }}>Measured:</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#CD3C44" }}>
                  {cr.isRatio ? `${cr.value}%` : cr.value.toLocaleString()}
                </span>
              </div>
              <span style={{ color: dk ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)" }}>│</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 12, color: textTert }}>Minimum:</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#36B37E" }}>
                  {cr.isRatio
                    ? `${cr.thresholds.split(", ").pop()?.match(/≥(\d+)/)?.[1] ?? "1"}%`
                    : cr.thresholds.split(", ").pop()?.match(/≥(\d+)/)?.[1] ?? "1"
                  }
                </span>
              </div>
            </div>
          )}

          {/* Error badge */}
          {cr.error && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10,
              padding: "6px 12px", borderRadius: 6,
              background: dk ? "rgba(229,57,53,0.08)" : "rgba(229,57,53,0.05)",
              border: `1px solid ${dk ? "rgba(229,57,53,0.18)" : "rgba(229,57,53,0.12)"}`,
              fontSize: 12, color: "#CD3C44", fontWeight: 600,
            }}>
              ⚠ Query execution failed — check connectivity and permissions
            </div>
          )}

          {/* Why it matters */}
          {importance && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: textTert, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Why it matters</div>
              <div style={{ fontSize: 12, color: text, lineHeight: 1.6 }}>{importance}</div>
            </div>
          )}

          {/* How to evolve */}
          {remediation && !passed && (
            <div style={{
              padding: "8px 12px", borderRadius: 6,
              background: dk ? "rgba(0,200,83,0.06)" : "rgba(0,200,83,0.03)",
              border: `1px solid ${dk ? "rgba(0,200,83,0.12)" : "rgba(0,200,83,0.08)"}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#36B37E", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>
                How to Evolve
              </div>
              <div style={{ fontSize: 12, color: text, lineHeight: 1.6 }}>
                {remediation.action}
              </div>
              {remediation.docLink && (
                <a
                  href={remediation.docLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "inline-block", marginTop: 6,
                    fontSize: 12, fontWeight: 700, color: "#5B6ACF",
                    textDecoration: "none",
                  }}
                >
                  Open Dynatrace Docs →
                </a>
              )}
            </div>
          )}

          {/* Passed — confirmation */}
          {passed && (
            <div style={{
              padding: "6px 10px", borderRadius: 6,
              background: dk ? "rgba(0,200,83,0.06)" : "rgba(0,200,83,0.03)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 14 }}>✓</span>
              <span style={{ fontSize: 12, color: "#36B37E", fontWeight: 600 }}>
                {cr.isRatio
                  ? `Criterion met — ${cr.value}% coverage`
                  : cr.value > 0
                    ? `Criterion met — ${cr.value.toLocaleString()} detected`
                    : `Criterion met`
                }
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Left panel — memoized to prevent re-renders during card interactions ── */
const IdleLeftPanel = React.memo(function IdleLeftPanel({ dk, text, textSec, textTert, accent, bgSubtle, bgPrimary, border, borderPri, tenant, start, resume, totalScore, hasResults }: {
  dk: boolean; text: string; textSec: string; textTert: string;
  accent: string; bgSubtle: string; bgPrimary: string; border: string; borderPri: string;
  tenant: string; start: () => void; resume: () => void;
  totalScore: number; hasResults: boolean;
}) {
  const preflight = usePreflight();

  const handleRunClick = useCallback(async () => {
    if (preflight.validated) {
      start();
      return;
    }
    await preflight.runPreflight();
  }, [preflight.validated, preflight.runPreflight, start]);

  // Auto-start assessment when preflight passes
  useEffect(() => {
    if (preflight.allPassed) {
      preflight.markValidated();
      preflight.reset();
      start();
    }
  }, [preflight.allPassed, preflight.markValidated, preflight.reset, start]);
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", textAlign: "center",
      padding: "36px 28px", gap: 22, overflowY: "auto",
      background: bgSubtle,
      borderRight: `1px solid ${border}`,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: accent, marginBottom: 8, opacity: 0.8 }}>
          Dynatrace Platform
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <img src={APP_ICON} alt="" width={36} height={36} style={{ borderRadius: 8 }} />
          <div style={{ fontSize: 20, fontWeight: 800, color: text, letterSpacing: -0.5, lineHeight: 1.2 }}>
            Pulse Assessment
          </div>
        </div>
      </div>

      {/* Run Assessment button + preflight — right below title */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Preflight validation results */}
        {(preflight.running || preflight.hasFails) && (
          <div style={{
            width: "100%", maxWidth: 340, marginBottom: 12, borderRadius: 10,
            background: dk ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.03)",
            border: `1px solid ${preflight.hasFails ? Colors.Border.Critical.Default : border}`,
            overflow: "hidden",
          }}>
            <div style={{
              padding: "10px 14px", fontSize: 12, fontWeight: 700,
              color: preflight.hasFails ? Colors.Text.Critical.Default : accent,
              borderBottom: `1px solid ${border}`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              {preflight.running ? "⏳" : preflight.hasFails ? "⚠" : "✓"} Pre-flight Validation
            </div>
            <div style={{ padding: "8px 14px" }}>
              {preflight.checks.map(c => (
                <div key={c.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "6px 0", borderBottom: `1px solid ${border}20`,
                }}>
                  <span style={{ fontSize: 14, lineHeight: 1.2, flexShrink: 0, marginTop: 1 }}>
                    {c.status === "pending" ? "○" : c.status === "running" ? "◌" : c.status === "ok" ? "✓" : "✗"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600,
                      color: c.status === "ok" ? Colors.Text.Success.Default : c.status === "fail" ? Colors.Text.Critical.Default : textSec,
                    }}>
                      {c.label}
                    </div>
                    {c.status === "fail" && c.detail && (
                      <div style={{ fontSize: 11, color: Colors.Text.Critical.Default, marginTop: 2, lineHeight: 1.4 }}>
                        {c.detail}
                      </div>
                    )}
                    {c.status === "fail" && (
                      <div style={{ fontSize: 11, color: textTert, marginTop: 2, lineHeight: 1.4 }}>
                        Required scope: <code style={{ fontSize: 10, padding: "1px 4px", borderRadius: 3, background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>{c.scope}</code>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {preflight.hasFails && (
              <div style={{
                padding: "10px 14px", borderTop: `1px solid ${border}`,
                fontSize: 11, color: textSec, lineHeight: 1.6,
                background: dk ? "rgba(205,60,68,0.06)" : "rgba(205,60,68,0.03)",
              }}>
                <strong style={{ color: Colors.Text.Critical.Default }}>Assessment blocked.</strong> Grant the missing scopes to this app in
                <strong style={{ color: text }}> Settings → Authorization → OAuth clients</strong>, or verify the app manifest includes all required scopes.
                <div style={{ marginTop: 6 }}>
                  <button
                    onClick={() => preflight.reset()}
                    style={{
                      padding: "4px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                      background: "transparent", color: accent,
                      border: `1px solid ${accent}`, borderRadius: 6,
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <button
          onClick={preflight.running ? undefined : handleRunClick}
          disabled={preflight.running}
          style={{
            padding: "12px 36px", fontSize: 14, fontWeight: 700,
            cursor: preflight.running ? "wait" : "pointer",
            background: preflight.running ? (dk ? "rgba(71,79,207,0.4)" : "rgba(71,79,207,0.5)") : Colors.Background.Container.Primary.Accent,
            color: "#fff",
            border: "none", borderRadius: 10,
            boxShadow: "0 4px 16px rgba(71,79,207,0.35)",
            transition: "transform 0.15s, box-shadow 0.15s",
            opacity: preflight.running ? 0.7 : 1,
          }}
          onMouseEnter={(e) => { if (!preflight.running) { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(71,79,207,0.5)"; } }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(71,79,207,0.35)"; }}
        >
          {preflight.running ? "◌ Validating…" : "▶ Run Assessment"}
        </button>
        {hasResults && (
          <button
            onClick={resume}
            style={{
              marginTop: 10, padding: "8px 24px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: "transparent", color: accent,
              border: `1px solid ${accent}`, borderRadius: 8,
              transition: "transform 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = dk ? "rgba(71,79,207,0.1)" : "rgba(71,79,207,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            ← View Last Results ({totalScore}%)
          </button>
        )}
        <div style={{ fontSize: 12, color: textTert, marginTop: 10 }}>
          Tenant: <span style={{ fontWeight: 600, color: textSec }}>{tenant}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        {[
          { value: String(CAPABILITIES.length), label: "Capabilities", color: accent, tip: `${CAPABILITIES.length} Dynatrace platform capabilities evaluated: ${CAPABILITIES.map(c => c.name).join(", ")}.` },
          { value: String(CAPABILITIES.reduce((s, c) => s + c.criteria.length, 0)), label: "Criteria", color: Colors.Text.Success.Default, tip: "Total criteria evaluated via live DQL queries. Some criteria use cross-entity coverage (two queries) to measure real adoption depth." },
        ].map((kpi) => (
          <Tooltip key={kpi.label} text={kpi.tip}>
          <div style={{ textAlign: "center", padding: "10px 20px", borderRadius: 10, background: kpi.color + (dk ? "15" : "10"), border: `1px solid ${kpi.color}30` }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: 12, color: text, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>{kpi.label}</div>
          </div>
          </Tooltip>
        ))}
      </div>

      <div style={{ fontSize: 12, color: textSec, lineHeight: 1.7, maxWidth: 320, textAlign: "left" }}>
        <div style={{ fontWeight: 700, color: accent, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>How it works</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <span style={{ color: accent, fontWeight: 800, fontSize: 14, lineHeight: 1.3 }}>1.</span>
          <span>Click <strong style={{ color: text }}>Run Assessment</strong> — the app executes <strong style={{ color: text }}>{CAPABILITIES.reduce((s, c) => s + c.criteria.length, 0)} DQL criteria</strong> against your environment. Some criteria use <strong style={{ color: text }}>cross-entity coverage</strong> (e.g., % of hosts with CPU metrics) for deeper adoption measurement.</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <span style={{ color: accent, fontWeight: 800, fontSize: 14, lineHeight: 1.3 }}>2.</span>
          <span>Results appear in <strong style={{ color: text }}>three views</strong> you can toggle anytime:</span>
        </div>
        <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ padding: "8px 12px", borderRadius: 6, background: bgPrimary, border: `1px solid ${borderPri}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: accent, marginBottom: 2 }}>Coverage</div>
            <div style={{ fontSize: 12, color: textSec, lineHeight: 1.5 }}>
              Radar chart showing <strong style={{ color: text }}>how much</strong> of each capability is adopted (0–100%). Ideal for spotting gaps and understanding breadth of platform usage.
            </div>
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 6, background: Colors.Background.Container.Success.Default, border: `1px solid ${Colors.Border.Success.Default}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: Colors.Text.Success.Default, marginBottom: 2 }}>Maturity</div>
            <div style={{ fontSize: 12, color: textSec, lineHeight: 1.5 }}>
              Cards showing <strong style={{ color: text }}>how deeply</strong> each capability is used across 3 weighted tiers (Foundation → Best Practice → Excellence). Shows a <strong style={{ color: text }}>0–100% maturity score</strong> per capability using the same color scale as coverage.
            </div>
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 6, background: dk ? "rgba(91,106,207,0.08)" : "rgba(91,106,207,0.04)", border: `1px solid ${dk ? "rgba(91,106,207,0.15)" : "rgba(91,106,207,0.1)"}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6ACF", marginBottom: 2 }}>Executive Summary</div>
            <div style={{ fontSize: 12, color: textSec, lineHeight: 1.5 }}>
              Consolidated dashboard with <strong style={{ color: text }}>coverage vs maturity comparison</strong>, gap analysis, achievements, and interactive charts for a complete overview.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <span style={{ color: accent, fontWeight: 800, fontSize: 14, lineHeight: 1.3 }}>3.</span>
          <span>A <strong style={{ color: text }}>snapshot is saved automatically</strong> for historical comparison. Use <strong style={{ color: text }}>Evolution Over Time</strong> to track progress and identify regressions.</span>
        </div>
        <div style={{ fontSize: 12, color: textTert, marginTop: 4, lineHeight: 1.5 }}>
          Each failed criterion includes <strong style={{ color: textSec }}>remediation guidance</strong> with links to Dynatrace docs.
        </div>
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 12, lineHeight: 1.5, background: Colors.Background.Container.Success.Default, border: `1px solid ${Colors.Border.Success.Default}`, color: textSec }}>
          <strong style={{ color: Colors.Text.Success.Default }}>Tip:</strong> Before running, explore the cards on the right to understand what each capability evaluates and how scores are calculated.
        </div>
      </div>
    </div>
  );
});

/* ── Card for grid view (click to zoom) ── */
function IdleCapCard({ cap, dk, text, textSec, bgSurface, bgSubtle, border, onClick }: {
  cap: { name: string; color: string; criteria: { id: string; label: string }[] };
  dk: boolean; text: string; textSec: string; textTert: string;
  bgSurface: string; bgSubtle: string; border: string;
  onClick: () => void;
}) {
  const summary = CAP_SUMMARIES[cap.name] || "";
  return (
    <div style={{
      background: bgSurface,
      border: `1px solid ${border}`,
      borderRadius: 12, padding: "20px 22px", borderLeft: `4px solid ${cap.color}`,
      cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s",
      display: "flex", flexDirection: "column" as const,
    }}
    onClick={(e) => { e.stopPropagation(); if (isTextSelection()) return; onClick(); }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 16px ${cap.color}25`; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ width: 14, height: 14, borderRadius: "50%", background: cap.color, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: text, flex: 1 }}>{cap.name}</span>
        <span style={{ fontSize: 12, color: textSec, fontWeight: 700, background: bgSubtle, padding: "3px 10px", borderRadius: 10 }}>{cap.criteria.length}</span>
      </div>
      <div style={{ fontSize: 12, color: textSec, lineHeight: 1.7, marginLeft: 24, flex: 1 }}>
        {summary}
      </div>
      <div style={{ fontSize: 12, color: textSec, marginTop: 14, marginLeft: 24, fontWeight: 600, opacity: 0.6 }}>
        See what is analyzed →
      </div>
    </div>
  );
}

/* ── Zoomed detail view for a single capability ── */
function IdleCapDetail({ cap, dk, text, textSec, textTert, bgSubtle, border, onBack, collapseKey }: {
  cap: { name: string; color: string; criteria: { id: string; label: string; description: string }[] };
  dk: boolean; text: string; textSec: string; textTert: string;
  bgSubtle: string; border: string;
  onBack: () => void; collapseKey: number;
}) {
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ animation: "fadeIn 0.2s ease" }}>
      {/* Back button + header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: bgSubtle,
          border: `1px solid ${border}`,
          borderRadius: 8, padding: "6px 14px", cursor: "pointer",
          fontSize: 12, color: textSec, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
        }}>
          ← Back
        </button>
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: cap.color, flexShrink: 0 }} />
        <span style={{ fontSize: 20, fontWeight: 800, color: text }}>{cap.name}</span>
        <span style={{ fontSize: 12, color: textTert, marginLeft: "auto" }}>{cap.criteria.length} checks</span>
      </div>

      {/* Summary */}
      <div style={{
        fontSize: 14, color: textSec, lineHeight: 1.6, marginBottom: 16,
        padding: "12px 16px", borderRadius: 10,
        background: "transparent",
        borderLeft: `3px solid ${border}`,
      }}>
        {CAP_SUMMARIES[cap.name]}
      </div>

      {/* Criteria list — detailed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 16 }}>
        {cap.criteria.map((cr, i) => (
          <CriterionRow key={cr.id} cr={cr} idx={i} capColor={cap.color} dk={dk} text={text} textSec={textSec} collapseKey={collapseKey} />
        ))}
      </div>
    </div>
  );
}

/* ── Single criterion row with hover tooltip ── */

/* Helper: generate human-readable explanation from a DQL query */
function describeQuery(q: string): string {
  if (!q) return "";
  // timeseries ... by:{entity} → "Aggregates <metric> grouped by <entity>, then counts distinct entities"
  const tsMatch = q.match(/timeseries\s+\w+=\w+\(([^)]+)\).*?by:\{([^}]+)\}/);
  if (tsMatch) {
    const metric = tsMatch[1].replace(/dt\./g, "");
    const entity = tsMatch[2].replace(/dt\.entity\./g, "").replace(/_/g, " ");
    return `Aggregates metric "${metric}" per ${entity}, then counts how many distinct entities report this metric.`;
  }
  // fetch dt.entity.X ... belongs_to → "Counts parent entities that have child relationships"
  const relMatch = q.match(/fetch\s+(dt\.entity\.\w+).*?belongs_to\[(dt\.entity\.\w+)\]/);
  if (relMatch) {
    const child = relMatch[1].replace("dt.entity.", "").replace(/_/g, " ");
    const parent = relMatch[2].replace("dt.entity.", "").replace(/_/g, " ");
    return `Counts distinct ${parent} entities that have associated ${child} entities (relationship-based coverage).`;
  }
  // fetch logs/spans ... filter isNotNull(X) ... countDistinct(entity)
  const logDistinctMatch = q.match(/fetch\s+(logs|spans).*?filter\s+.*?isNotNull\(([^)]+)\).*?countDistinct\(([^)]+)\)/s);
  if (logDistinctMatch) {
    const source = logDistinctMatch[1];
    const field = logDistinctMatch[2];
    const entity = logDistinctMatch[3].replace(/dt\.entity\./g, "").replace(/_/g, " ");
    return `Queries ${source} for records where "${field}" is present, then counts how many distinct ${entity} entities are covered.`;
  }
  // fetch logs/spans ... filter ... summarize count()
  const logCountMatch = q.match(/fetch\s+(logs|spans|events|bizevents).*?filter\s+(.*?)\s*\|\s*summarize\s+count\(\)/s);
  if (logCountMatch) {
    return `Counts ${logCountMatch[1]} records matching the specified filters.`;
  }
  // fetch dt.entity.X | summarize count()
  const entityCount = q.match(/fetch\s+(dt\.entity\.\w+)\s*\|\s*summarize\s+count\(\)/);
  if (entityCount) {
    const entity = entityCount[1].replace("dt.entity.", "").replace(/_/g, " ");
    return `Counts the total number of ${entity} entities in the environment.`;
  }
  // fetch dt.davis.problems
  if (q.includes("dt.davis.problems")) {
    return "Queries Davis AI problems to find affected entities within the recent time window.";
  }
  // Generic fallback
  if (q.includes("summarize count")) return "Counts the number of matching records.";
  return "Executes a DQL query against Grail and returns a numeric result.";
}

/* ── Inline DQL code block with copy button ── */
function QueryCode({ query, dk }: { query: string; dk: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(query).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };
  return (
    <div style={{ position: "relative" }}>
      <code style={{
        display: "block", fontSize: 12, padding: "8px 12px 8px 12px", borderRadius: 6,
        background: dk ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.04)",
        color: dk ? "#b0b0d0" : "#555",
        fontFamily: "monospace",
        overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
        border: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
      }}>{query}</code>
      <button onClick={copy} style={{
        position: "absolute", top: 4, right: 4,
        padding: "2px 8px", fontSize: 11, cursor: "pointer",
        background: copied ? (dk ? "rgba(0,200,83,0.15)" : "rgba(0,200,83,0.1)") : (dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
        border: `1px solid ${copied ? "#36B37E" : (dk ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)")}`,
        borderRadius: 4, color: copied ? "#36B37E" : (dk ? "#9898b0" : "#666"),
        fontWeight: 600, transition: "all 0.2s",
      }}>{copied ? "✓" : "⎘"}</button>
    </div>
  );
}

function CriterionRow({ cr, idx, capColor, dk, text, textSec, collapseKey }: {
  cr: { id: string; label: string; description: string; query?: string; queryB?: string; thresholds?: { min: number }[] }; idx: number;
  capColor: string; dk: boolean; text: string; textSec: string; collapseKey: number;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setExpanded(false); }, [collapseKey]);
  const importance = CRITERION_IMPORTANCE[cr.id] || "";
  return (
    <div
      style={{
        display: "flex", gap: 12, padding: "12px 16px", borderRadius: 10,
        background: "transparent",
        border: `1px solid ${Colors.Border.Neutral.Default}`,
        cursor: "pointer",
        transition: "border-color 0.2s",
        borderColor: expanded ? Colors.Border.Neutral.Accent : Colors.Border.Neutral.Default,
      }}
      onClick={(e) => { e.stopPropagation(); if (isTextSelection()) return; setExpanded(!expanded); }}
    >
      <span style={{
        fontSize: 12, fontWeight: 700, color: textSec,
        background: Colors.Background.Container.Neutral.Subdued, borderRadius: 8,
        width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginTop: 2,
      }}>{idx + 1}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Tooltip text={CRITERION_IMPORTANCE[cr.id] || cr.description} maxWidth={340}>
            <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{cr.label}</div>
          </Tooltip>
          <span style={{
            fontSize: 12, color: textSec,
            transition: "all 0.2s", fontWeight: 600, flexShrink: 0,
          }}>{expanded ? "▾" : "▸"}</span>
        </div>
        <div style={{ fontSize: 12, color: textSec, lineHeight: 1.5 }}>{cr.description}</div>
        {/* Inline expansion with details */}
        {expanded && (
          <div style={{
            marginTop: 10, padding: "10px 14px", borderRadius: 8,
            background: "transparent",
            borderLeft: `3px solid ${Colors.Border.Neutral.Default}`,
            animation: "fadeIn 0.2s ease",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            {/* ── Section 1: Why it matters ── */}
            {importance && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: textSec, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Why it matters</div>
                <div style={{ fontSize: 12, color: text, lineHeight: 1.6 }}>{importance}</div>
              </div>
            )}
            {/* ── Section 2: How the score is calculated ── */}
            {cr.query && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: textSec, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>How the score is calculated</div>
                <div style={{
                  padding: "12px 14px", borderRadius: 8,
                  background: dk ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.02)",
                  border: `1px solid ${dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  {cr.queryB ? (
                    <>
                      {/* Numerator (A) */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6ACF", marginBottom: 4 }}>Numerator (A)</div>
                        <div style={{ fontSize: 12, color: textSec, lineHeight: 1.5, marginBottom: 6 }}>{describeQuery(cr.query)}</div>
                        <QueryCode query={cr.query} dk={dk} />
                      </div>
                      {/* Divider */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: dk ? "#9898b0" : "#888", fontSize: 14 }}>
                        <span style={{ flex: 1, borderBottom: `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}` }} />
                        <span style={{ fontWeight: 700 }}>÷</span>
                        <span style={{ flex: 1, borderBottom: `1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}` }} />
                      </div>
                      {/* Denominator (B) */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6ACF", marginBottom: 4 }}>Denominator (B)</div>
                        <div style={{ fontSize: 12, color: textSec, lineHeight: 1.5, marginBottom: 6 }}>{describeQuery(cr.queryB)}</div>
                        <QueryCode query={cr.queryB} dk={dk} />
                      </div>
                      {/* Expected Result */}
                      <div style={{
                        padding: "8px 12px", borderRadius: 6,
                        background: dk ? "rgba(91,106,207,0.08)" : "rgba(91,106,207,0.04)",
                        border: `1px solid ${dk ? "rgba(91,106,207,0.15)" : "rgba(91,106,207,0.1)"}`,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6ACF", marginBottom: 2 }}>Expected Result</div>
                        <div style={{ fontSize: 12, color: text, lineHeight: 1.6 }}>
                          Result = A ÷ B × 100 → a <strong>coverage percentage</strong>. The app compares this value against the pass thresholds below to determine the maturity tier (Foundation / Best Practice / Excellence).
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: textSec, lineHeight: 1.5 }}>{describeQuery(cr.query)}</div>
                      <QueryCode query={cr.query} dk={dk} />
                      <div style={{
                        padding: "8px 12px", borderRadius: 6,
                        background: dk ? "rgba(91,106,207,0.08)" : "rgba(91,106,207,0.04)",
                        border: `1px solid ${dk ? "rgba(91,106,207,0.15)" : "rgba(91,106,207,0.1)"}`,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6ACF", marginBottom: 2 }}>Expected Result</div>
                        <div style={{ fontSize: 12, color: text, lineHeight: 1.6 }}>
                          Returns a <strong>numeric count</strong>. The app compares this value against the pass thresholds below to determine the maturity tier.
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            {/* ── Section 3: Pass thresholds ── */}
            {cr.thresholds && cr.thresholds.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: textSec, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Pass thresholds</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[...cr.thresholds].sort((a, b) => b.min - a.min).map((t, ti) => (
                    <span key={ti} style={{
                      fontSize: 12, padding: "3px 10px", borderRadius: 6,
                      background: Colors.Background.Container.Neutral.Subdued,
                      color: textSec, fontWeight: 600,
                    }}>≥ {t.min}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
