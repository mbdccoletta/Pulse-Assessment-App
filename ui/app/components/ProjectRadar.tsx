// ui/app/components/ProjectRadar.tsx
//
// Small per-project radar: one axis per capability the AI mapped to the
// project's objective, polygon = the CURRENT assessment coverage score of
// each capability (0-100). Shows at a glance how ready the involved
// capabilities are for the declared objective.
//
// SVG (no canvas/animation needed at this size). Axis endpoints are dots
// in the capability's colour, matching the chips next to the radar.
// Renders only with 3+ axes — below that a radar is degenerate; the card
// falls back to the score list.

import React from "react";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import Colors from "@dynatrace/strato-design-tokens/colors";

export interface RadarItem {
  name: string;
  color: string;
  /** 0-100 current coverage score. */
  value: number;
}

interface Props {
  items: RadarItem[];
  size?: number;
}

export const ProjectRadar: React.FC<Props> = ({ items, size = 190 }) => {
  const dk = useCurrentTheme() === "dark";
  const N = items.length;
  if (N < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.38;
  const gridStroke = dk ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)";
  const axisStroke = dk ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)";
  const accent = Colors.Text.Primary.Default;

  const angle = (i: number) => (i / N) * Math.PI * 2 - Math.PI / 2;
  const pt = (i: number, r: number) => ({
    x: cx + Math.cos(angle(i)) * r,
    y: cy + Math.sin(angle(i)) * r,
  });

  const ringPath = (r: number) =>
    items.map((_, i) => { const p = pt(i, r); return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ") + " Z";

  const valuePath =
    items.map((it, i) => {
      const p = pt(i, (Math.max(0, Math.min(100, it.value)) / 100) * R);
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ") + " Z";

  return (
    <svg width={size} height={size} role="img"
      aria-label={`Readiness radar: ${items.map(i => `${i.name} ${i.value}%`).join(", ")}`}>
      {/* Grid rings at 25/50/75/100 */}
      {[0.25, 0.5, 0.75, 1].map(f => (
        <path key={f} d={ringPath(R * f)} fill="none" stroke={gridStroke}
          strokeWidth={f === 1 ? 1.4 : 0.8} strokeDasharray={f === 1 ? undefined : "3,3"} />
      ))}
      {/* Axes */}
      {items.map((_, i) => {
        const p = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={axisStroke} strokeWidth={0.8} />;
      })}
      {/* Value polygon */}
      <path d={valuePath} fill={dk ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.18)"}
        stroke={accent} strokeWidth={1.6} strokeLinejoin="round" />
      {/* Value vertices + capability-coloured axis dots */}
      {items.map((it, i) => {
        const tip = pt(i, R);
        const val = pt(i, (Math.max(0, Math.min(100, it.value)) / 100) * R);
        return (
          <g key={it.name}>
            <circle cx={tip.x} cy={tip.y} r={4} fill={it.color} />
            <circle cx={val.x} cy={val.y} r={2.4} fill={accent} />
          </g>
        );
      })}
    </svg>
  );
};
ProjectRadar.displayName = "ProjectRadar";
