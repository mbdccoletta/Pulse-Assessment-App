import React, { useRef, useEffect, useCallback, useState, useImperativeHandle, forwardRef } from "react";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import { Flex } from "@dynatrace/strato-components/layouts";

function hexToRgb(h: string) { return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) }; }
function rgba(c: { r: number; g: number; b: number }, a: number) { return `rgba(${c.r},${c.g},${c.b},${a})`; }
function lighten(c: { r: number; g: number; b: number }, v: number) { return { r: Math.min(255, c.r + v), g: Math.min(255, c.g + v), b: Math.min(255, c.b + v) }; }

function bandForScore(s: number) {
  if (s >= 80) return { label: "Excellent", color: "#36B37E" };
  if (s >= 60) return { label: "Good", color: "#5EB1A9" };
  if (s >= 40) return { label: "Moderate", color: "#EEA746" };
  if (s >= 20) return { label: "Low", color: "#DC671E" };
  return { label: "N/A", color: "#CD3C44" };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = cur + " " + words[i];
    if (ctx.measureText(test).width <= maxWidth) { cur = test; }
    else { lines.push(cur); cur = words[i]; }
  }
  lines.push(cur);
  return lines;
}

const BANDS = [
  { min: 0, max: 20, label: "N/A", color: "#CD3C44" },
  { min: 20, max: 40, label: "Low", color: "#DC671E" },
  { min: 40, max: 60, label: "Moderate", color: "#EEA746" },
  { min: 60, max: 80, label: "Good", color: "#5EB1A9" },
  { min: 80, max: 100, label: "Excellent", color: "#36B37E" },
];

interface DataPoint {
  name: string;
  coverage: number;
  maturity: number;
  color: string;
}

interface Props {
  data: DataPoint[];
  coverageColor?: string;
  maturityColor?: string;
  legendLabels?: [string, string];
  activeIdx?: number | null;
  onSelect?: (idx: number | null) => void;
}

export interface CovMatRadarHandle {
  toDataURL: () => string | null;
}

export const CovMatRadar = React.memo(forwardRef<CovMatRadarHandle, Props>(function CovMatRadar({ data, coverageColor, maturityColor, legendLabels, activeIdx: controlledIdx, onSelect }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dk = useCurrentTheme() === "dark";
  const COV_C = coverageColor ?? (dk ? "#00E5FF" : "#0097A7");
  const MAT_C = maturityColor ?? (dk ? "#D500F9" : "#9C27B0");
  const [internalIdx, setInternalIdx] = useState<number | null>(null);
  const activeIdx = controlledIdx !== undefined ? controlledIdx : internalIdx;
  const geoRef = useRef<{ cx: number; cy: number; R: number; N: number; SEG: number }>({ cx: 0, cy: 0, R: 0, N: 0, SEG: 0 });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;

    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);

    const N = data.length;
    if (N === 0) return;
    const SEG = (Math.PI * 2) / N;
    const legendSpace = 22;
    const cx = w / 2;
    const cy = (h - legendSpace) / 2;
    const labelMarginW = Math.max(w * 0.46, 160); // horizontal margin based on width
    const labelMarginH = Math.max(h * 0.38, 130); // vertical margin based on height
    const R = Math.min((w - labelMarginW) / 2, (h - legendSpace - labelMarginH) / 2);
    geoRef.current = { cx, cy, R, N, SEG };

    ctx.clearRect(0, 0, w, h);

    // ── Concentric ring backgrounds (outer to inner — matches TechRadar) ──
    for (let i = BANDS.length - 1; i >= 0; i--) {
      const band = BANDS[i];
      const outerR = (band.max / 100) * R;
      const b = hexToRgb(band.color);
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.fillStyle = rgba(b, dk ? 0.05 : 0.045);
      ctx.fill();
    }

    // ── Ring borders ──
    for (let i = 1; i <= 5; i++) {
      const rr = (i * 20 / 100) * R;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.strokeStyle = dk ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.15)";
      ctx.lineWidth = i === 5 ? 2 : 1;
      ctx.setLineDash(i === 5 ? [] : [4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Sector dividing lines ──
    for (let i = 0; i < N; i++) {
      const a = i * SEG - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.strokeStyle = dk ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }

    // ── Coverage polygon ──
    const hR = Math.max(Math.min(w, h) * 0.065, 28);
    const dotSizeBase = Math.max(Math.min(w, h) * 0.018, 10);
    const minBlipR = hR + 6 + dotSizeBase + 4; // hub visual edge + dot radius + gap
    drawPoly(ctx, data.map(d => d.coverage), cx, cy, R, N, SEG, COV_C, dk, false, minBlipR);

    // ── Maturity polygon ──
    drawPoly(ctx, data.map(d => d.maturity), cx, cy, R, N, SEG, MAT_C, dk, true, minBlipR);

    // ── Center hub (drawn before blips so blips appear on top) ──
    const avgCov = Math.round(data.reduce((a, d) => a + d.coverage, 0) / N);
    const avgMat = Math.round(data.reduce((a, d) => a + d.maturity, 0) / N);

    ctx.beginPath(); ctx.arc(cx, cy, hR + 5, 0, Math.PI * 2);
    ctx.strokeStyle = dk ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)";
    ctx.lineWidth = 0.5; ctx.stroke();

    ctx.beginPath(); ctx.arc(cx, cy, hR, 0, Math.PI * 2);
    ctx.fillStyle = dk ? "#111122ee" : "#fffffffa";
    ctx.fill();
    ctx.strokeStyle = dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
    ctx.lineWidth = 1; ctx.stroke();

    // Progress arcs
    const ps = -Math.PI / 2;
    ctx.lineCap = "round";
    const covEnd = ps + Math.PI * 2 * (avgCov / 100);
    ctx.beginPath(); ctx.arc(cx, cy, hR + 3, ps, covEnd);
    ctx.strokeStyle = COV_C; ctx.lineWidth = 3;
    ctx.globalAlpha = 0.7; ctx.stroke();
    const matEnd = ps + Math.PI * 2 * (avgMat / 100);
    ctx.beginPath(); ctx.arc(cx, cy, hR + 6, ps, matEnd);
    ctx.strokeStyle = MAT_C; ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineCap = "butt";

    // Center text
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const fSize = Math.max(Math.min(w, h) * 0.028, 14);
    ctx.fillStyle = COV_C;
    ctx.font = `800 ${fSize}px system-ui,sans-serif`;
    ctx.fillText(avgCov + "%", cx, cy - hR * 0.22);
    ctx.fillStyle = MAT_C;
    ctx.fillText(avgMat + "%", cx, cy + hR * 0.22);
    ctx.fillStyle = dk ? "#c0c0e0" : "#555570";
    ctx.font = `600 ${Math.max(fSize * 0.42, 7)}px system-ui,sans-serif`;
    const hubLabel1 = legendLabels ? "A" : "COV";
    const hubLabel2 = legendLabels ? "B" : "MAT";
    ctx.fillText(hubLabel1, cx, cy - hR * 0.55);
    ctx.fillText(hubLabel2, cx, cy + hR * 0.55);

    // ── Blips with gradient & score (drawn after hub so they appear on top) ──
    const dotBase = dotSizeBase;
    for (let i = 0; i < N; i++) {
      const midA = i * SEG + SEG / 2 - Math.PI / 2;
      const act = activeIdx === i;
      const dim = activeIdx !== null && activeIdx !== undefined && !act;
      const dotSize = act ? dotBase * 1.35 : dotBase;

      // Coverage blip (circle)
      const covR = minBlipR + (data[i].coverage / 100) * (R - minBlipR);
      let covX = cx + Math.cos(midA) * covR;
      let covY = cy + Math.sin(midA) * covR;

      // Maturity blip (diamond)
      const matR = minBlipR + (data[i].maturity / 100) * (R - minBlipR);
      let matX = cx + Math.cos(midA) * matR;
      let matY = cy + Math.sin(midA) * matR;

      // Separate overlapping blips perpendicular to radial axis
      const blipDist = Math.hypot(covX - matX, covY - matY);
      const minSep = dotSize * 2.6;
      if (blipDist < minSep) {
        const perpX = -Math.sin(midA);
        const perpY = Math.cos(midA);
        const offset = (minSep - blipDist) / 2 + 2;
        covX += perpX * offset;
        covY += perpY * offset;
        matX -= perpX * offset;
        matY -= perpY * offset;
      }

      drawGradientBlip(ctx, covX, covY, dotSize, COV_C, data[i].coverage, dk, false, act, dim);
      drawGradientBlip(ctx, matX, matY, dotSize, MAT_C, data[i].maturity, dk, true, act, dim);
    }

    // ── Connector lines + capability labels ──
    const labelR = R + Math.max(Math.min(w, h) * 0.10, 44);
    const fs1 = Math.max(Math.min(w, h) * 0.018, 10);
    const fs2 = Math.max(Math.min(w, h) * 0.015, 8);
    const maxLabelW = Math.max(w * 0.26, 110);
    const labelPad = 6;

    for (let i = 0; i < N; i++) {
      const midA = i * SEG + SEG / 2 - Math.PI / 2;
      const cos = Math.cos(midA);
      const sin = Math.sin(midA);
      const act = activeIdx === i;
      const dim = activeIdx !== null && activeIdx !== undefined && !act;
      const isR = cos > 0.15, isL = cos < -0.15;

      // Outermost blip radius (max of coverage and maturity)
      const covBR = minBlipR + (data[i].coverage / 100) * (R - minBlipR);
      const matBR = minBlipR + (data[i].maturity / 100) * (R - minBlipR);
      const outerBlipR = Math.max(covBR, matBR);
      const blipDotSize = (act ? dotBase * 1.35 : dotBase) + 4;
      const startR = outerBlipR + blipDotSize;

      // Label anchor position — clamped to canvas bounds
      let lx = cx + cos * labelR;
      const ly = cy + sin * labelR;
      if (isR) lx = Math.min(lx, w - maxLabelW - labelPad);
      else if (isL) lx = Math.max(lx, maxLabelW + labelPad);

      // Average color from coverage band
      const avgScore = (data[i].coverage + data[i].maturity) / 2;
      const ml = bandForScore(avgScore);
      const alpha = dim ? 0.2 : act ? 0.95 : 0.6;

      // ── Compute text block layout ──
      ctx.font = `${act ? 800 : 700} ${fs1}px system-ui,sans-serif`;
      const nameLines = wrapText(ctx, data[i].name, maxLabelW);
      const lineH = fs1 + 2;
      const nameBlockH = nameLines.length * lineH;
      const scorePrefix1 = legendLabels ? "A" : "C";
      const scorePrefix2 = legendLabels ? "B" : "M";
      const scoreText = `${scorePrefix1} ${Math.round(data[i].coverage)}% / ${scorePrefix2} ${Math.round(data[i].maturity)}%`;
      const totalTextH = nameBlockH + 2 + fs2;
      const textTopY = ly - totalTextH / 2;
      const nameStartY = textTopY;
      const scoreY = textTopY + nameBlockH + 2;

      // ── Dashed connector line — radial from blip, stops before text ──
      const stopR = labelR - totalTextH / 2 - 8;
      if (startR < stopR) {
        const sx = cx + cos * startR, sy = cy + sin * startR;
        const ex = cx + cos * stopR, ey = cy + sin * stopR;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
        ctx.strokeStyle = ml.color; ctx.globalAlpha = alpha;
        ctx.setLineDash([5, 4]); ctx.lineWidth = act ? 3 : 2; ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // ── Draw text ──
      ctx.textAlign = isR ? "left" : isL ? "right" : "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = dim ? 0.35 : 1;
      ctx.fillStyle = act ? data[i].color : dk ? "#e0e0f0" : "#1a1a2e";
      ctx.font = `${act ? 800 : 700} ${fs1}px system-ui,sans-serif`;
      for (let li = 0; li < nameLines.length; li++) {
        ctx.fillText(nameLines[li], lx, nameStartY + li * lineH + lineH / 2);
      }
      // Score line — centered below name
      const maxNameW = Math.max(...nameLines.map(l => ctx.measureText(l).width));
      const nameCenterX = isR ? lx + maxNameW / 2 : isL ? lx - maxNameW / 2 : lx;
      ctx.fillStyle = ml.color;
      ctx.font = `700 ${fs2}px system-ui,sans-serif`;
      const savedAlign = ctx.textAlign;
      ctx.textAlign = "center";
      ctx.fillText(scoreText, nameCenterX, scoreY + fs2 / 2);
      ctx.textAlign = savedAlign;
      ctx.globalAlpha = 1;
    }

    // ── Legend ──
    const legFont = Math.max(Math.min(w * 0.016, 9), 7);
    const legY = h - 8;
    ctx.font = `700 ${legFont}px system-ui,sans-serif`;
    // Measure text widths for centering
    const covLabel = legendLabels?.[0] ?? "Coverage";
    const matLabel = legendLabels?.[1] ?? "Maturity";
    const covW = ctx.measureText(covLabel).width;
    const matW = ctx.measureText(matLabel).width;
    const iconR = 5;
    const iconGap = 8;
    const itemGap = 20;
    const totalW = iconR * 2 + iconGap + covW + itemGap + iconR * 2 + iconGap + matW;
    const startX = cx - totalW / 2;
    // Coverage
    ctx.fillStyle = COV_C;
    ctx.beginPath();
    ctx.arc(startX + iconR, legY, iconR, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = dk ? "#e0e0f8" : "#2a2a3e";
    ctx.fillText(covLabel, startX + iconR * 2 + iconGap, legY);
    // Maturity
    const matIconX = startX + iconR * 2 + iconGap + covW + itemGap + iconR;
    ctx.fillStyle = MAT_C;
    ctx.beginPath();
    ctx.moveTo(matIconX, legY - iconR);
    ctx.lineTo(matIconX + iconR, legY);
    ctx.lineTo(matIconX, legY + iconR);
    ctx.lineTo(matIconX - iconR, legY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dk ? "#e0e0f8" : "#2a2a3e";
    ctx.fillText(matLabel, matIconX + iconR + iconGap, legY);
  }, [data, dk, COV_C, MAT_C, activeIdx, legendLabels]);

  const hitTest = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return -1;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { cx, cy, R, N, SEG } = geoRef.current;
    if (N === 0) return -1;
    const w = rect.width;
    const h = rect.height;

    // Check label areas first (higher priority)
    const labelR = R + Math.max(Math.min(w, h) * 0.10, 44);
    const fs1 = Math.max(Math.min(w, h) * 0.018, 10);
    const fs2 = Math.max(Math.min(w, h) * 0.015, 8);
    const totalTextH = (fs1 + 2) + 2 + fs2; // single-line name + gap + score
    for (let i = 0; i < N; i++) {
      const midA = i * SEG + SEG / 2 - Math.PI / 2;
      const cos = Math.cos(midA), sin = Math.sin(midA);
      const lx = cx + cos * labelR;
      const ly = cy + sin * labelR;
      const isR = cos > 0.15, isL = cos < -0.15;
      const labelW = 130;
      const left = isR ? lx - 4 : isL ? lx - labelW + 4 : lx - labelW / 2;
      const top = ly - totalTextH / 2 - 4;
      if (mx >= left && mx <= left + labelW && my >= top && my <= top + totalTextH + 16) {
        return i;
      }
    }

    // Check blip positions
    const hR2 = Math.max(Math.min(w, h) * 0.065, 28);
    const dotSz = Math.max(Math.min(w, h) * 0.018, 10);
    const minR2 = hR2 + 6 + dotSz + 4;
    const hitRadius = dotSz * 2.2;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < N; i++) {
      const midA = i * SEG + SEG / 2 - Math.PI / 2;
      for (const val of [data[i].coverage, data[i].maturity]) {
        const r = minR2 + (val / 100) * (R - minR2);
        const bx = cx + Math.cos(midA) * r;
        const by = cy + Math.sin(midA) * r;
        const d = Math.hypot(mx - bx, my - by);
        if (d < hitRadius && d < bestD) { best = i; bestD = d; }
      }
    }
    if (best >= 0) return best;

    // Fallback: click anywhere in a sector selects that capability
    const dx = mx - cx, dy = my - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > hR2 + 10 && dist < labelR) {
      let angle = Math.atan2(dy, dx) + Math.PI / 2; // rotate so 0 is top
      if (angle < 0) angle += Math.PI * 2;
      const sectorIdx = Math.floor(angle / SEG);
      if (sectorIdx >= 0 && sectorIdx < N) return sectorIdx;
    }
    return best;
  }, [data]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const idx = hitTest(e);
    const next = idx >= 0 ? (activeIdx === idx ? null : idx) : null;
    if (onSelect) onSelect(next);
    else setInternalIdx(next);
  }, [hitTest, activeIdx, onSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const idx = hitTest(e);
    setHoveredIdx(idx >= 0 ? idx : null);
    if (idx >= 0) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, [hitTest]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null);
  }, []);

  useImperativeHandle(ref, () => ({
    toDataURL: () => canvasRef.current?.toDataURL("image/png") ?? null,
  }), []);

  useEffect(() => {
    draw();
    const obs = new ResizeObserver(() => draw());
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [draw]);

  const hovered = hoveredIdx !== null && hoveredIdx >= 0 ? data[hoveredIdx] : null;

  return (
    <Flex ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", cursor: hoveredIdx !== null && hoveredIdx >= 0 ? "pointer" : "default", touchAction: "none" }}
        onClick={handleClick}
        onDoubleClick={(e) => e.preventDefault()}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {hovered && (
        <div style={{
          position: "absolute",
          left: tooltipPos.x + 14,
          top: tooltipPos.y - 10,
          pointerEvents: "none",
          zIndex: 20,
          background: dk ? "rgba(15,17,35,0.95)" : "rgba(255,255,255,0.97)",
          border: `1px solid ${dk ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`,
          borderRadius: 8,
          padding: "8px 12px",
          boxShadow: dk ? "0 4px 16px rgba(0,0,0,0.5)" : "0 4px 16px rgba(0,0,0,0.12)",
          whiteSpace: "nowrap",
          fontSize: 12,
          lineHeight: 1.5,
          fontFamily: "system-ui, sans-serif",
          color: dk ? "#e0e0f0" : "#1a1a2e",
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: hovered.color }}>{hovered.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: COV_C, display: "inline-block" }} />
            <span>Coverage: <strong>{Math.round(hovered.coverage)}%</strong></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, background: MAT_C, display: "inline-block", transform: "rotate(45deg)" }} />
            <span>Maturity: <strong>{Math.round(hovered.maturity)}%</strong></span>
          </div>
        </div>
      )}
    </Flex>
  );
}));

function drawPoly(ctx: CanvasRenderingContext2D, values: number[], cx: number, cy: number, R: number, N: number, SEG: number, color: string, dk: boolean, dashed: boolean, minR = 3) {
  const b = hexToRgb(color);
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const midA = i * SEG + SEG / 2 - Math.PI / 2;
    const r = minR + (values[i] / 100) * (R - minR);
    const px = cx + Math.cos(midA) * r;
    const py = cy + Math.sin(midA) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = rgba(b, dk ? 0.12 : 0.10);
  ctx.fill();
  ctx.setLineDash(dashed ? [6, 4] : []);
  ctx.strokeStyle = rgba(b, dk ? 0.35 : 0.30);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGradientBlip(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, score: number, dk: boolean, isDiamond: boolean, act = false, dim = false) {
  const b = hexToRgb(color);
  const band = bandForScore(score);
  const mlb = hexToRgb(band.color);

  // Glow on active
  if (act) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    if (isDiamond) { diamondPath(ctx, x, y, size + 5); }
    else { ctx.arc(x, y, size + 5, 0, Math.PI * 2); }
    ctx.fillStyle = rgba(b, 0.15);
    ctx.fill();
    ctx.restore();
  }

  // Outer ring (band color)
  ctx.beginPath();
  if (isDiamond) {
    diamondPath(ctx, x, y, size + 3);
  } else {
    ctx.arc(x, y, size + 3, 0, Math.PI * 2);
  }
  ctx.fillStyle = rgba(mlb, dim ? 0.2 : dk ? 0.65 : 0.5);
  ctx.fill();

  // Main gradient fill
  const grad = ctx.createRadialGradient(x - size * 0.3, y - size * 0.3, 0, x, y, size);
  grad.addColorStop(0, rgba(lighten(b, dk ? 80 : 90), dim ? 0.4 : 1));
  grad.addColorStop(0.6, rgba(b, dim ? 0.35 : 1));
  grad.addColorStop(1, rgba(mlb, dim ? 0.3 : 0.95));
  ctx.beginPath();
  if (isDiamond) {
    diamondPath(ctx, x, y, size);
  } else {
    ctx.arc(x, y, size, 0, Math.PI * 2);
  }
  ctx.fillStyle = grad;
  ctx.fill();

  // Border
  ctx.beginPath();
  if (isDiamond) {
    diamondPath(ctx, x, y, size);
  } else {
    ctx.arc(x, y, size, 0, Math.PI * 2);
  }
  ctx.strokeStyle = act ? rgba(lighten(b, 100), 1) : rgba(lighten(b, 60), dim ? 0.15 : 0.75);
  ctx.lineWidth = act ? 3 : 2;
  ctx.stroke();

  // Score text inside blip
  if (size >= 7) {
    const txt = Math.round(score) + "";
    const fontSize = Math.max(size * 0.9, 10);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `800 ${fontSize}px system-ui,sans-serif`;
    ctx.globalAlpha = dim ? 0.4 : 1;
    // Dark outline for contrast on bright backgrounds
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeText(txt, x, y + 0.5);
    ctx.fillStyle = "#fff";
    ctx.fillText(txt, x, y + 0.5);
    ctx.globalAlpha = 1;
  }
}

function diamondPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s, y);
  ctx.closePath();
}

/**
 * Renders the CovMatRadar chart to an offscreen canvas and returns a PNG data URL.
 * Used by PDF report generators to embed a pixel-perfect chart image.
 */
export function renderRadarToDataURL(
  data: DataPoint[],
  size: number,
  options?: { coverageColor?: string; maturityColor?: string; darkBg?: boolean },
): string {
  const w = Math.round(size * 1.35); // wider to fit label text
  const h = size;
  const dk = options?.darkBg ?? true;
  const COV_C = options?.coverageColor ?? (dk ? "#00E5FF" : "#0097A7");
  const MAT_C = options?.maturityColor ?? (dk ? "#D500F9" : "#9C27B0");

  const canvas = document.createElement("canvas");
  const dpr = 2; // high-res for PDF
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const N = data.length;
  if (N === 0) return canvas.toDataURL("image/png");
  const SEG = (Math.PI * 2) / N;
  const legendSpace = 22;
  const cx = w / 2;
  const cy = (h - legendSpace) / 2;
  const labelMargin = Math.max(h * 0.32, 120);
  const R = (h - legendSpace - labelMargin) / 2;

  // Background
  if (dk) {
    ctx.fillStyle = "#0b0d21";
    ctx.fillRect(0, 0, w, h);
  }

  // Concentric ring backgrounds
  for (let i = BANDS.length - 1; i >= 0; i--) {
    const band = BANDS[i];
    const outerR = (band.max / 100) * R;
    const b = hexToRgb(band.color);
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = rgba(b, dk ? 0.05 : 0.045);
    ctx.fill();
  }

  // Ring borders
  for (let i = 1; i <= 5; i++) {
    const rr = (i * 20 / 100) * R;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.strokeStyle = dk ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.15)";
    ctx.lineWidth = i === 5 ? 2 : 1;
    ctx.setLineDash(i === 5 ? [] : [4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Sector dividing lines
  for (let i = 0; i < N; i++) {
    const a = i * SEG - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.strokeStyle = dk ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  // Polygons
  const hR = Math.max(Math.min(w, h) * 0.09, 40);
  const dotSizeBase = Math.max(Math.min(w, h) * 0.016, 9);
  const minBlipR = hR + 6 + dotSizeBase + 4;
  drawPoly(ctx, data.map(d => d.coverage), cx, cy, R, N, SEG, COV_C, dk, false, minBlipR);
  drawPoly(ctx, data.map(d => d.maturity), cx, cy, R, N, SEG, MAT_C, dk, true, minBlipR);

  // Center hub
  const avgCov = Math.round(data.reduce((a, d) => a + d.coverage, 0) / N);
  const avgMat = Math.round(data.reduce((a, d) => a + d.maturity, 0) / N);
  ctx.beginPath(); ctx.arc(cx, cy, hR + 5, 0, Math.PI * 2);
  ctx.strokeStyle = dk ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)";
  ctx.lineWidth = 0.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, hR, 0, Math.PI * 2);
  ctx.fillStyle = dk ? "#111122ee" : "#fffffffa";
  ctx.fill();
  ctx.strokeStyle = dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1; ctx.stroke();

  // Progress arcs
  const ps = -Math.PI / 2;
  ctx.lineCap = "round";
  const covEnd = ps + Math.PI * 2 * (avgCov / 100);
  ctx.beginPath(); ctx.arc(cx, cy, hR + 3, ps, covEnd);
  ctx.strokeStyle = COV_C; ctx.lineWidth = 3;
  ctx.globalAlpha = 0.7; ctx.stroke();
  const matEnd = ps + Math.PI * 2 * (avgMat / 100);
  ctx.beginPath(); ctx.arc(cx, cy, hR + 6, ps, matEnd);
  ctx.strokeStyle = MAT_C; ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.globalAlpha = 1; ctx.lineCap = "butt";

  // Center text
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const fSize = Math.max(Math.min(w, h) * 0.032, 16);
  ctx.fillStyle = COV_C;
  ctx.font = `800 ${fSize}px system-ui,sans-serif`;
  ctx.fillText(avgCov + "%", cx, cy - hR * 0.22);
  ctx.fillStyle = MAT_C;
  ctx.fillText(avgMat + "%", cx, cy + hR * 0.22);
  ctx.fillStyle = dk ? "#c0c0e0" : "#555570";
  ctx.font = `600 ${Math.max(fSize * 0.42, 7)}px system-ui,sans-serif`;
  ctx.fillText("COV", cx, cy - hR * 0.55);
  ctx.fillText("MAT", cx, cy + hR * 0.55);

  // Blips
  const dotBase = dotSizeBase;
  for (let i = 0; i < N; i++) {
    const midA = i * SEG + SEG / 2 - Math.PI / 2;
    const dotSize = dotBase;
    const covR2 = minBlipR + (data[i].coverage / 100) * (R - minBlipR);
    const covX2 = cx + Math.cos(midA) * covR2;
    const covY2 = cy + Math.sin(midA) * covR2;
    drawGradientBlip(ctx, covX2, covY2, dotSize, COV_C, data[i].coverage, dk, false, false, false);
    const matR2 = minBlipR + (data[i].maturity / 100) * (R - minBlipR);
    const matX2 = cx + Math.cos(midA) * matR2;
    const matY2 = cy + Math.sin(midA) * matR2;
    drawGradientBlip(ctx, matX2, matY2, dotSize, MAT_C, data[i].maturity, dk, true, false, false);
  }

  // Connector lines + capability labels
  const labelR = R + Math.max(Math.min(w, h) * 0.075, 34);
  const fs1 = Math.max(Math.min(w, h) * 0.020, 10);
  const fs2 = Math.max(Math.min(w, h) * 0.016, 8);
  const labelH = fs1 + fs2 + 6;
  for (let i = 0; i < N; i++) {
    const midA = i * SEG + SEG / 2 - Math.PI / 2;
    const cos = Math.cos(midA);
    const sin = Math.sin(midA);
    const isR = cos > 0.15, isL = cos < -0.15;
    const covBR = minBlipR + (data[i].coverage / 100) * (R - minBlipR);
    const matBR = minBlipR + (data[i].maturity / 100) * (R - minBlipR);
    const outerBlipR = Math.max(covBR, matBR);
    const blipDotSize = dotBase + 4;
    const startR2 = outerBlipR + blipDotSize;
    const lx = cx + cos * labelR;
    const ly = cy + sin * labelR;
    const stopR = labelR - labelH / 2 - 6;
    const avgScore = (data[i].coverage + data[i].maturity) / 2;
    const ml = bandForScore(avgScore);

    if (startR2 < stopR) {
      const sx = cx + cos * startR2, sy = cy + sin * startR2;
      const ex = cx + cos * stopR, ey = cy + sin * stopR;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
      ctx.strokeStyle = ml.color; ctx.globalAlpha = 0.55;
      ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    }

    const barY = ly + labelH / 2 + 3;
    const barW = 44;
    const barStartX = isR ? lx : isL ? lx - barW : lx - barW / 2;
    ctx.beginPath(); ctx.moveTo(barStartX, barY); ctx.lineTo(barStartX + barW, barY);
    ctx.strokeStyle = ml.color; ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.stroke(); ctx.lineCap = "butt";

    ctx.textAlign = isR ? "left" : isL ? "right" : "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 1;
    ctx.fillStyle = data[i].color;
    ctx.font = `700 ${fs1}px system-ui,sans-serif`;
    // Clamp label x so text stays within canvas
    let clampedLx = lx;
    if (isR) { clampedLx = Math.min(lx, w - ctx.measureText(data[i].name).width - 4); }
    else if (isL) { clampedLx = Math.max(lx, ctx.measureText(data[i].name).width + 4); }
    ctx.fillText(data[i].name, clampedLx, ly - fs2 / 2 - 1);
    ctx.fillStyle = ml.color;
    ctx.font = `700 ${fs2}px system-ui,sans-serif`;
    ctx.fillText(`C ${Math.round(data[i].coverage)}% / M ${Math.round(data[i].maturity)}%`, clampedLx, ly + fs1 / 2 + 1);
    ctx.globalAlpha = 1;
  }

  // Legend
  const legFont = Math.max(w * 0.024, 11);
  const legY = h - 8;
  ctx.font = `700 ${legFont}px system-ui,sans-serif`;
  const covLabel = "Coverage";
  const matLabel = "Maturity";
  const covW2 = ctx.measureText(covLabel).width;
  const matW2 = ctx.measureText(matLabel).width;
  const iconR = 5;
  const iconGap = 8;
  const itemGap = 20;
  const totalW = iconR * 2 + iconGap + covW2 + itemGap + iconR * 2 + iconGap + matW2;
  const startX = cx - totalW / 2;
  ctx.fillStyle = COV_C;
  ctx.beginPath(); ctx.arc(startX + iconR, legY, iconR, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = dk ? "#e0e0f8" : "#2a2a3e";
  ctx.fillText(covLabel, startX + iconR * 2 + iconGap, legY);
  const matIconX = startX + iconR * 2 + iconGap + covW2 + itemGap + iconR;
  ctx.fillStyle = MAT_C;
  ctx.beginPath();
  ctx.moveTo(matIconX, legY - iconR);
  ctx.lineTo(matIconX + iconR, legY);
  ctx.lineTo(matIconX, legY + iconR);
  ctx.lineTo(matIconX - iconR, legY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dk ? "#e0e0f8" : "#2a2a3e";
  ctx.fillText(matLabel, matIconX + iconR + iconGap, legY);

  return canvas.toDataURL("image/png");
}
