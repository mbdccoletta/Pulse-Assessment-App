import React, { useRef, useState, useEffect, useCallback } from "react";

export interface ScatterPoint {
  name: string;
  x: number;   // Coverage %
  y: number;   // Maturity %
  color: string;
}

interface Props {
  data: ScatterPoint[];
  dotRadius?: number;
  xLabel?: string;
  yLabel?: string;
  activeIdx?: number | null;
  onSelect?: (idx: number | null) => void;
  showLegend?: boolean;
}

const PAD = { top: 18, right: 24, bottom: 38, left: 46 };
const LEGEND_H = 56;
const GRID_COLOR = "rgba(140,140,140,0.18)";
const AXIS_COLOR = "rgba(160,160,160,0.5)";
const TICK_FONT = "11px -apple-system, BlinkMacSystemFont, sans-serif";
const LABEL_FONT = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
const NAME_FONT = "bold 10px -apple-system, BlinkMacSystemFont, sans-serif";

export const CapabilityScatter: React.FC<Props> = ({
  data,
  dotRadius = 9,
  xLabel = "Coverage %",
  yLabel = "Maturity %",
  activeIdx: controlledIdx,
  onSelect,
  showLegend = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [internalIdx, setInternalIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeIdx = controlledIdx !== undefined ? controlledIdx : internalIdx;

  /** Resolve plot area dimensions */
  const getPlot = useCallback((w: number, h: number) => {
    const legendSpace = showLegend ? LEGEND_H : 0;
    const plotW = w - PAD.left - PAD.right;
    const plotH = h - PAD.top - PAD.bottom - legendSpace;
    return { plotL: PAD.left, plotT: PAD.top, plotW, plotH };
  }, [showLegend]);

  /** Convert data point index to canvas coords */
  const pointToCanvas = useCallback((idx: number, w: number, h: number) => {
    const { plotL, plotT, plotW, plotH } = getPlot(w, h);
    const pt = data[idx];
    return {
      cx: plotL + (pt.x / 100) * plotW,
      cy: plotT + plotH - (pt.y / 100) * plotH,
    };
  }, [data, getPlot]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const { plotL, plotT, plotW, plotH } = getPlot(w, h);
    const hasSelection = activeIdx !== null && activeIdx !== undefined;

    // Determine tick color from computed style (theme-aware)
    const textColor = getComputedStyle(container).color || "rgba(160,160,160,0.9)";

    // Grid lines
    const ticks = [0, 20, 40, 60, 80, 100];

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const v of ticks) {
      const x = plotL + (v / 100) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, plotT);
      ctx.lineTo(x, plotT + plotH);
      ctx.stroke();
    }
    for (const v of ticks) {
      const y = plotT + plotH - (v / 100) * plotH;
      ctx.beginPath();
      ctx.moveTo(plotL, y);
      ctx.lineTo(plotL + plotW, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Axes
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plotL, plotT);
    ctx.lineTo(plotL, plotT + plotH);
    ctx.lineTo(plotL + plotW, plotT + plotH);
    ctx.stroke();

    // Tick labels
    ctx.font = TICK_FONT;
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const v of ticks) {
      const x = plotL + (v / 100) * plotW;
      ctx.fillText(`${v}`, x, plotT + plotH + 6);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const v of ticks) {
      const y = plotT + plotH - (v / 100) * plotH;
      ctx.fillText(`${v}`, plotL - 8, y);
    }

    // Axis labels
    ctx.font = LABEL_FONT;
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(xLabel, plotL + plotW / 2, plotT + plotH + 22);

    ctx.save();
    ctx.translate(14, plotT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // ── Draw dots ──
    for (let i = 0; i < data.length; i++) {
      const pt = data[i];
      const { cx, cy } = pointToCanvas(i, w, h);
      const isActive = activeIdx === i;
      const dimmed = hasSelection && !isActive;

      const r = isActive ? dotRadius * 1.35 : dotRadius;
      const alpha = dimmed ? 0.25 : 0.92;

      // glow
      ctx.save();
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = isActive ? r * 2 : r * 1.2;
      ctx.globalAlpha = dimmed ? 0.12 : 0.45;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = pt.color;
      ctx.fill();
      ctx.restore();

      // solid dot
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      // highlight ring
      ctx.beginPath();
      ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = isActive ? 2.5 : 1.5;
      ctx.globalAlpha = dimmed ? 0.1 : isActive ? 0.7 : 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Name label on active dot
      if (isActive) {
        ctx.font = NAME_FONT;
        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(pt.name, cx, cy - r - 6);
        // Coordinates
        ctx.font = TICK_FONT;
        ctx.globalAlpha = 0.7;
        ctx.textBaseline = "top";
        ctx.fillText(`C ${Math.round(pt.x)}% / M ${Math.round(pt.y)}%`, cx, cy + r + 6);
        ctx.globalAlpha = 1;
      }
    }

    // ── Legend (multi-row wrap) ──
    if (showLegend) {
      const legendStartY = plotT + plotH + PAD.bottom + 4;
      ctx.font = TICK_FONT;
      const gap = 14;
      const dotR = 5;
      const rowH = 18;
      const items = data.map(pt => ({
        name: pt.name,
        color: pt.color,
        textW: ctx.measureText(pt.name).width,
      }));

      // Build rows that fit within plotW
      const rows: { start: number; end: number; totalW: number }[] = [];
      let ri = 0;
      while (ri < items.length) {
        let rowW = 0;
        const start = ri;
        while (ri < items.length) {
          const itemW = dotR * 2 + 4 + items[ri].textW + (ri > start ? gap : 0);
          if (rowW + itemW > plotW && ri > start) break;
          rowW += itemW;
          ri++;
        }
        rows.push({ start, end: ri, totalW: rowW });
      }

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const legendY = legendStartY + r * rowH;
        let curX = plotL + (plotW - row.totalW) / 2;

        for (let i = row.start; i < row.end; i++) {
          const it = items[i];
          const isAct = activeIdx === i;
          const dim = hasSelection && !isAct;

          // dot
          ctx.beginPath();
          ctx.arc(curX + dotR, legendY + 6, dotR, 0, Math.PI * 2);
          ctx.fillStyle = it.color;
          ctx.globalAlpha = dim ? 0.3 : 1;
          ctx.fill();
          ctx.globalAlpha = 1;

          // name
          ctx.fillStyle = textColor;
          ctx.globalAlpha = dim ? 0.35 : 1;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(it.name, curX + dotR * 2 + 4, legendY + 6);
          ctx.globalAlpha = 1;

          curX += dotR * 2 + 4 + it.textW + gap;
        }
      }
    }
  }, [data, dotRadius, xLabel, yLabel, activeIdx, getPlot, pointToCanvas, showLegend]);

  /** Click hit-testing */
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = container.clientWidth;
    const h = container.clientHeight;

    // Check legend items first
    if (showLegend) {
      const { plotL, plotT, plotW, plotH } = getPlot(w, h);
      const legendStartY = plotT + plotH + PAD.bottom + 4;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.font = TICK_FONT;
        const gap = 14;
        const dotR = 5;
        const rowH = 18;
        const items = data.map(pt => ({
          textW: ctx.measureText(pt.name).width,
        }));

        const rows: { start: number; end: number; totalW: number }[] = [];
        let ri = 0;
        while (ri < items.length) {
          let rowW = 0;
          const start = ri;
          while (ri < items.length) {
            const itemW = dotR * 2 + 4 + items[ri].textW + (ri > start ? gap : 0);
            if (rowW + itemW > plotW && ri > start) break;
            rowW += itemW;
            ri++;
          }
          rows.push({ start, end: ri, totalW: rowW });
        }

        for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          const legendY = legendStartY + r * rowH;
          let curX = plotL + (plotW - row.totalW) / 2;
          for (let i = row.start; i < row.end; i++) {
            const itW = dotR * 2 + 4 + items[i].textW;
            if (mx >= curX && mx <= curX + itW && my >= legendY - 6 && my <= legendY + 16) {
              const next = activeIdx === i ? null : i;
              if (onSelect) onSelect(next);
              else setInternalIdx(next);
              return;
            }
            curX += itW + gap;
          }
        }
      }
    }

    // Check dots
    const hitR = dotRadius * 1.8;
    for (let i = data.length - 1; i >= 0; i--) {
      const { cx, cy } = pointToCanvas(i, w, h);
      const dx = mx - cx;
      const dy = my - cy;
      if (dx * dx + dy * dy <= hitR * hitR) {
        const next = activeIdx === i ? null : i;
        if (onSelect) onSelect(next);
        else setInternalIdx(next);
        return;
      }
    }

    // Click on empty area → deselect
    if (onSelect) onSelect(null);
    else setInternalIdx(null);
  }, [data, dotRadius, activeIdx, onSelect, getPlot, pointToCanvas, showLegend]);

  /** Hover hit-testing for tooltip */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const hitR = dotRadius * 1.8;

    for (let i = data.length - 1; i >= 0; i--) {
      const { cx, cy } = pointToCanvas(i, w, h);
      const dx = mx - cx;
      const dy = my - cy;
      if (dx * dx + dy * dy <= hitR * hitR) {
        setHoverIdx(i);
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        return;
      }
    }
    setHoverIdx(null);
  }, [data, dotRadius, pointToCanvas]);

  const handleMouseLeave = useCallback(() => {
    setHoverIdx(null);
  }, []);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%", cursor: "pointer" }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {hoverIdx !== null && data[hoverIdx] && (
        <div
          ref={tooltipRef}
          style={{
            position: "absolute",
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translate(-50%, -100%) translateY(-12px)",
            background: "rgba(20, 22, 40, 0.94)",
            color: "#fff",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 500,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            border: `2px solid ${data[hoverIdx].color}`,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: data[hoverIdx].color }}>
            {data[hoverIdx].name}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <span>C: <strong>{Math.round(data[hoverIdx].x)}%</strong></span>
            <span>M: <strong>{Math.round(data[hoverIdx].y)}%</strong></span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Renders the CapabilityScatter chart to an offscreen canvas and returns a PNG data URL.
 * Used by PDF report generators to embed a pixel-perfect chart image.
 */
export function renderScatterToDataURL(
  data: ScatterPoint[],
  width = 1200,
  opts?: { darkBg?: boolean },
): string {
  const darkBg = opts?.darkBg ?? true;
  const h = Math.round(width * 0.7);
  const w = width;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  if (darkBg) {
    ctx.fillStyle = "#11121e";
    ctx.fillRect(0, 0, w, h);
  }

  const pad = { top: 40, right: 50, bottom: 70, left: 80 };
  const plotL = pad.left;
  const plotT = pad.top;
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const textColor = darkBg ? "rgba(200,200,225,0.9)" : "rgba(40,40,60,0.9)";
  const dotR = Math.max(w * 0.014, 12);

  // Grid
  const ticks = [0, 20, 40, 60, 80, 100];
  ctx.strokeStyle = darkBg ? "rgba(140,140,140,0.18)" : "rgba(140,140,140,0.25)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (const v of ticks) {
    const x = plotL + (v / 100) * plotW;
    ctx.beginPath(); ctx.moveTo(x, plotT); ctx.lineTo(x, plotT + plotH); ctx.stroke();
  }
  for (const v of ticks) {
    const y = plotT + plotH - (v / 100) * plotH;
    ctx.beginPath(); ctx.moveTo(plotL, y); ctx.lineTo(plotL + plotW, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Axes
  ctx.strokeStyle = darkBg ? "rgba(160,160,160,0.5)" : "rgba(100,100,100,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plotL, plotT); ctx.lineTo(plotL, plotT + plotH); ctx.lineTo(plotL + plotW, plotT + plotH);
  ctx.stroke();

  // Tick labels
  const tickFont = `${Math.max(w * 0.013, 13)}px system-ui,sans-serif`;
  ctx.font = tickFont;
  ctx.fillStyle = textColor;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (const v of ticks) {
    const x = plotL + (v / 100) * plotW;
    ctx.fillText(`${v}`, x, plotT + plotH + 10);
  }
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (const v of ticks) {
    const y = plotT + plotH - (v / 100) * plotH;
    ctx.fillText(`${v}`, plotL - 14, y);
  }

  // Axis labels
  const lblFont = `bold ${Math.max(w * 0.016, 15)}px system-ui,sans-serif`;
  ctx.font = lblFont; ctx.fillStyle = textColor;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText("Coverage %", plotL + plotW / 2, plotT + plotH + 36);
  ctx.save();
  ctx.translate(24, plotT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("Maturity %", 0, 0);
  ctx.restore();

  // Dots with name labels
  const nameFont = `bold ${Math.max(w * 0.013, 13)}px system-ui,sans-serif`;
  const scoreFont = `${Math.max(w * 0.011, 11)}px system-ui,sans-serif`;
  for (let i = 0; i < data.length; i++) {
    const pt = data[i];
    const cx = plotL + (pt.x / 100) * plotW;
    const cy = plotT + plotH - (pt.y / 100) * plotH;

    // Glow
    ctx.save();
    ctx.shadowColor = pt.color;
    ctx.shadowBlur = dotR * 1.5;
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fillStyle = pt.color; ctx.fill();
    ctx.restore();

    // Solid dot
    ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fillStyle = pt.color; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;

    // Ring
    ctx.beginPath(); ctx.arc(cx, cy, dotR + 2, 0, Math.PI * 2);
    ctx.strokeStyle = pt.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.4; ctx.stroke(); ctx.globalAlpha = 1;

    // Name label above dot
    ctx.font = nameFont; ctx.fillStyle = textColor;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText(pt.name, cx, cy - dotR - 8);

    // Score below dot
    ctx.font = scoreFont; ctx.fillStyle = textColor;
    ctx.globalAlpha = 0.7;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(`C ${Math.round(pt.x)}% / M ${Math.round(pt.y)}%`, cx, cy + dotR + 6);
    ctx.globalAlpha = 1;
  }

  return canvas.toDataURL("image/png");
}
