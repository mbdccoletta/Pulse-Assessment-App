import React, { useRef, useEffect, useCallback } from "react";
import type { CapabilityResult } from "../hooks/useCoverageData";
import { maturity } from "./PolarChart";

const R_RATIO = 0.34;

interface Props {
  capabilities: CapabilityResult[];
  anim: number;
  activeIdx: number | null;
  size: number;
}

export const ConnectorLines: React.FC<Props> = React.memo(({ capabilities, anim, activeIdx, size }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const N = capabilities.length;
  const SEG = (Math.PI * 2) / N;

  const draw = useCallback(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr; c.height = size * dpr;
    c.style.width = size + "px"; c.style.height = size + "px";
    ctx.scale(dpr, dpr);
    const cx = size / 2, cy = size / 2, R = size * R_RATIO, labelR = R + size * 0.075;
    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < N; i++) {
      const cap = capabilities[i];
      const midA = i * SEG + SEG / 2 - Math.PI / 2;
      const cos = Math.cos(midA), sin = Math.sin(midA);
      const act = activeIdx === i, dim = activeIdx !== null && !act;
      const hubR = size * 0.09 + 8;
      const segR = Math.max((cap.score * anim / 100) * R, 6) + (act ? 14 : 0);
      const startR = Math.max(segR + 3, hubR);
      const sx = cx + cos * startR, sy = cy + sin * startR;
      const lx = cx + cos * labelR, ly = cy + sin * labelR;
      const alpha = dim ? 0.15 : act ? 0.9 : 0.5;
      const ml = maturity(cap.score);
      const isR = cos > 0.15, isL = cos < -0.15;
      const barY = ly + 16, barW = act ? 65 : 48;
      const barStartX = isR ? lx : isL ? lx - barW : lx - barW / 2;
      const barEndX = barStartX + barW;
      const barInnerX = isR ? barStartX : isL ? barEndX : lx;

      // Solid bar
      ctx.beginPath(); ctx.moveTo(barStartX, barY); ctx.lineTo(barEndX, barY);
      ctx.strokeStyle = ml.color; ctx.globalAlpha = act ? 0.85 : 0.45;
      ctx.lineWidth = act ? 3 : 2; ctx.lineCap = "round"; ctx.stroke(); ctx.lineCap = "butt";

      // Dashed line: segment tip → inner end of bar
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(barInnerX, barY);
      ctx.strokeStyle = ml.color; ctx.globalAlpha = alpha;
      ctx.setLineDash([5, 4]); ctx.lineWidth = act ? 2.5 : 1.5; ctx.stroke(); ctx.setLineDash([]);

      // Dot at segment tip
      ctx.beginPath(); ctx.arc(sx, sy, act ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = ml.color; ctx.globalAlpha = Math.min(alpha * 1.8, 1); ctx.fill();

      ctx.globalAlpha = 1;
    }
  }, [capabilities, anim, activeIdx, size, N, SEG]);

  useEffect(() => { draw(); }, [draw]);

  return <canvas ref={ref} aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, width: size, height: size, pointerEvents: "none" }} />;
});
