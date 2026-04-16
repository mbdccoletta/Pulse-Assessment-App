import React, { useRef, useEffect, useCallback } from "react";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import type { CapabilityResult } from "../hooks/useCoverageData";

function hexToRgb(h: string) { return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) }; }
function rgba(c: { r: number; g: number; b: number }, a: number) { return `rgba(${c.r},${c.g},${c.b},${a})`; }
function lighten(c: { r: number; g: number; b: number }, v: number) { return { r: Math.min(255, c.r + v), g: Math.min(255, c.g + v), b: Math.min(255, c.b + v) }; }
function darken(c: { r: number; g: number; b: number }, v: number) { return { r: Math.max(0, c.r - v), g: Math.max(0, c.g - v), b: Math.max(0, c.b - v) }; }

export function maturity(s: number) {
  if (s >= 80) return { label: "Excellent", color: "#36B37E" };
  if (s >= 60) return { label: "Good", color: "#5EB1A9" };
  if (s >= 40) return { label: "Moderate", color: "#EEA746" };
  if (s >= 20) return { label: "Low", color: "#DC671E" };
  return { label: "N/A", color: "#CD3C44" };
}

const R_RATIO = 0.34;

interface Props {
  capabilities: CapabilityResult[];
  anim: number;
  activeIdx: number | null;
  size: number;
}

export const PolarChart: React.FC<Props> = React.memo(({ capabilities, anim, activeIdx, size }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const dk = useCurrentTheme() === "dark";
  const N = capabilities.length;
  const SEG = (Math.PI * 2) / N;

  const draw = useCallback(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr; c.height = size * dpr;
    c.style.width = size + "px"; c.style.height = size + "px";
    ctx.scale(dpr, dpr);
    const cx = size / 2, cy = size / 2, R = size * R_RATIO;
    ctx.clearRect(0, 0, size, size);

    // Grid
    for (let g = 1; g <= 5; g++) {
      ctx.beginPath(); ctx.arc(cx, cy, (g / 5) * R, 0, Math.PI * 2);
      ctx.strokeStyle = dk ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.1)";
      ctx.lineWidth = g === 5 ? 1 : 0.5; ctx.stroke();
    }
    for (let i = 0; i < N; i++) {
      const a = i * SEG - Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.strokeStyle = dk ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.07)";
      ctx.lineWidth = 0.5; ctx.stroke();
    }

    // Segments
    for (let i = 0; i < N; i++) {
      const cap = capabilities[i];
      const v = cap.score * anim, act = activeIdx === i, dim = activeIdx !== null && !act;
      const sr = (v / 100) * R + (act ? 14 : 0);
      if (sr < 2) continue;
      const a1 = i * SEG - Math.PI / 2, a2 = a1 + SEG, b = hexToRgb(cap.color);
      if (act) {
        ctx.save(); ctx.shadowColor = cap.color; ctx.shadowBlur = 24;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, sr, a1, a2); ctx.closePath();
        ctx.fillStyle = rgba(b, dk ? 0.15 : 0.1); ctx.fill(); ctx.restore();
      }
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr);
      gr.addColorStop(0, rgba(lighten(b, dk ? 30 : 50), dim ? 0.2 : dk ? 0.95 : 0.92));
      gr.addColorStop(0.5, rgba(b, dim ? 0.15 : dk ? 0.85 : 0.78));
      gr.addColorStop(1, rgba(darken(b, dk ? 15 : 30), dim ? 0.18 : dk ? 0.9 : 0.88));
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, sr, a1, a2); ctx.closePath();
      ctx.fillStyle = gr; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, sr, a1, a2); ctx.closePath();
      ctx.strokeStyle = act ? rgba(lighten(b, 60), 0.8) : rgba(lighten(b, 50), dim ? 0.06 : 0.25);
      ctx.lineWidth = act ? 1.8 : 0.5; ctx.stroke();
    }

    // Center hub
    const avg = Math.round(capabilities.reduce((a, c) => a + c.score, 0) / N * anim);
    const ml = maturity(Math.round(capabilities.reduce((a, c) => a + c.score, 0) / N));
    const hR = Math.max(size * 0.09, 44);
    ctx.beginPath(); ctx.arc(cx, cy, hR + 6, 0, Math.PI * 2);
    ctx.strokeStyle = dk ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)";
    ctx.lineWidth = 0.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, hR, 0, Math.PI * 2);
    ctx.fillStyle = dk ? "#111122ee" : "#fffffffa";
    ctx.fill(); ctx.strokeStyle = dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
    ctx.lineWidth = 1; ctx.stroke();
    const ps = -Math.PI / 2, pe = ps + (Math.PI * 2) * (avg / 100);
    ctx.beginPath(); ctx.arc(cx, cy, hR + 3, ps, pe);
    ctx.strokeStyle = ml.color; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.globalAlpha = 0.65 * anim; ctx.stroke(); ctx.globalAlpha = 1; ctx.lineCap = "butt";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = ml.color;
    ctx.font = `700 ${Math.max(size * 0.038, 20)}px system-ui,sans-serif`;
    ctx.fillText(avg + "%", cx, cy - hR * 0.28);
    ctx.fillStyle = dk ? "#aaaacc" : "#666680";
    ctx.font = `600 ${Math.max(size * 0.013, 7)}px system-ui,sans-serif`;
    ctx.fillText("COVERAGE", cx, cy + hR * 0.08);
    ctx.fillStyle = ml.color;
    ctx.font = `700 ${Math.max(size * 0.016, 9)}px system-ui,sans-serif`;
    ctx.fillText(ml.label, cx, cy + hR * 0.42);
  }, [capabilities, anim, activeIdx, size, N, SEG, dk]);

  useEffect(() => { draw(); }, [draw]);

  return <canvas ref={ref} role="img" aria-label={`Polar chart showing coverage scores for ${N} capabilities`} style={{ position: "absolute", top: 0, left: 0, width: size, height: size, cursor: "pointer" }} />;
});
