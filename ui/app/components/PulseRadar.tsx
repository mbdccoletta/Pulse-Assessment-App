// ui/app/components/PulseRadar.tsx
//
// The Overview radar. One sector per capability; inside each sector three
// radial bars — coverage, utilization, adoption — whose length is the value of
// that part. The score sits outside, next to the capability name, and the
// overall score in the centre. Everything drawn is a measured number:
//   bar length  = the part (0–100)
//   bar colour  = the part (coverage / utilization / adoption); outer arc = the capability
//   score colour = its band (the judgement)
// The bars grow once when the data arrives; nothing loops.

import React, { useMemo, useState } from "react";
import Colors from "@dynatrace/strato-design-tokens/colors";
import type { CapabilityResult } from "../hooks/useCoverageData";
import { scoreBand } from "../utils/colors";

interface Props {
  capabilities: CapabilityResult[];
  totalScore: number;
  /** Outer diameter of the plot in px (labels are drawn outside it). */
  size: number;
  onOpen: (idx: number) => void;
  /** Click on the centre: open the detailed view of the whole assessment. */
  onOpenOverall?: () => void;
}

// One colour per PART, the same in every sector, so a bar is read by its
// colour anywhere on the chart. (Shades of the capability colour were not
// tellable apart.) The capability keeps its own colour on the outer arc.
const PARTS = [
  { key: "coverage", label: "Coverage", short: "C", color: Colors.Charts.Categorical.Color01.Default },
  { key: "utilization", label: "Utilization", short: "U", color: Colors.Charts.Categorical.Color08.Default },
  { key: "adoption", label: "Adoption", short: "A", color: Colors.Charts.Categorical.Color07.Default },
] as const;

/** Short names for the centre readout, which is only as wide as the hole. */
const SHORT: Record<string, string> = {
  "Infrastructure Observability": "Infrastructure",
  "Application Observability": "Application",
  "Digital Experience": "Digital Exp.",
  "Application Security": "App Security",
  "Threat Observability": "Threat",
  "AI/LLM Observability": "AI/LLM",
  "Business Observability": "Business",
  "Software Delivery": "Delivery",
  "Platform Governance": "Governance",
  "FinOps & Sustainability": "FinOps",
};

const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
const pt = (r: number, deg: number) => [Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r] as const;

/** Annular sector from angle a0 to a1 (degrees), radius r0 to r1. */
function sector(r0: number, r1: number, a0: number, a1: number): string {
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
}

export const PulseRadar: React.FC<Props> = ({ capabilities, totalScore, size, onOpen, onOpenOverall }) => {
  const [hover, setHover] = useState<number | null>(null);
  const [centre, setCentre] = useState(false);
  /** Parts switched off from the legend. At least one always stays on. */
  const [off, setOff] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setOff(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else if (next.size < PARTS.length - 1) next.add(key);
    return next;
  });
  const N = capabilities.length;
  const R = size / 2;
  const hole = R * 0.34;
  const padX = Math.max(260, R * 0.85), padY = 76;
  const W = 2 * (R + padX), H = 2 * (R + padY);
  const step = 360 / Math.max(1, N);
  const gap = Math.min(5, step * 0.12);
  const ink = Colors.Text.Neutral.Default, sub = Colors.Text.Neutral.Subdued, line = Colors.Border.Neutral.Default;
  const total = scoreBand(totalScore);

  const sectors = useMemo(() => capabilities.map((c, i) => {
    const a0 = i * step + gap / 2, a1 = (i + 1) * step - gap / 2;
    const values = [c.coverageScore ?? c.score, c.effectiveUtilizationScore, c.adoptionScore ?? null];
    // The parts left on share the sector, so a filtered view uses the full width.
    const shown = PARTS.map((p, k) => ({ ...p, v: values[k] })).filter(p => !off.has(p.key));
    const w = (a1 - a0) / shown.length;
    return { c, i, a0, a1, mid: (a0 + a1) / 2, bars: shown.map((p, k) => ({ ...p, b0: a0 + k * w + 0.6, b1: a0 + (k + 1) * w - 0.6 })) };
  }), [capabilities, step, gap, off]);

  return (
    <svg viewBox={`${-W / 2} ${-H / 2} ${W} ${H}`} width="100%" height={H} style={{ maxWidth: W, display: "block" }}
      role="img" aria-label={`Score ${totalScore}% across ${N} capabilities`}>
      <style>{`
        @keyframes pulseRadarGrow { from { transform: scale(0.3); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        .pr-bars { transform-origin: 0 0; animation: pulseRadarGrow .9s cubic-bezier(.2,.7,.2,1) both; }
        .pr-sector { cursor: pointer; }
        .pr-sector:focus-visible .pr-hit { stroke: ${ink}; stroke-width: 2; }
        @media (prefers-reduced-motion: reduce) { .pr-bars { animation: none; } }
      `}</style>

      {/* scale rings: 25 / 50 / 75 / 100 */}
      {[0.25, 0.5, 0.75, 1].map(k => (
        <circle key={k} r={hole + (R - hole) * k} fill="none" stroke={line} strokeDasharray={k === 1 ? undefined : "2 6"} />
      ))}
      {sectors.map(s => {
        const band = scoreBand(s.c.score);
        const on = hover === s.i, dim = hover != null && !on;
        // Leader line: from the sector's rim out to an elbow, then level to the name.
        const [ax, ay] = pt(R + 10, s.mid);
        const [ex, ey] = pt(R + 30, s.mid);
        const side = Math.abs(ex) < R * 0.25 ? 0 : ex > 0 ? 1 : -1;
        const lx = ex + side * 22, ly = ey;
        const anchor = side === 0 ? "middle" : side > 0 ? "start" : "end";
        // Names stay on one straight line; the side padding is sized for the longest.
        const two = false;
        // Labels grow downward from their anchor: lift the ones above the
        // plot by their own height so they never run into the bars.
        const lines = (two ? 2 : 1) + 1;
        // Side labels sit level with the line's end; top and bottom ones clear it.
        const lift = side !== 0 ? 4 : ly < 0 ? -(lines - 1) * 16 - 4 : 16;
        return (
          <g key={s.c.name} className="pr-sector" role="button" tabIndex={0}
            aria-label={`${s.c.name}: score ${s.c.score}%, ${band.label}`}
            opacity={dim ? 0.3 : 1}
            // The pointed sector lifts 8px outward along its own axis.
            transform={on ? `translate(${pt(8, s.mid)[0]}, ${pt(8, s.mid)[1]})` : undefined}
            style={{ transition: "opacity .2s, transform .18s ease-out" }}
            onMouseEnter={() => setHover(s.i)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(s.i)} onBlur={() => setHover(null)}
            onClick={() => onOpen(s.i)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(s.i); } }}>
            {/* the whole sector is the click target */}
            <path className="pr-hit" d={sector(hole, R + 2, s.a0 - gap / 2, s.a1 + gap / 2)} fill={on ? s.c.color : "transparent"} fillOpacity={on ? 0.16 : 0}
              stroke={on ? s.c.color : "none"} strokeWidth={1.5} strokeOpacity={0.7} />
            {/* tracks: what 100 would look like */}
            {s.bars.map(b => <path key={b.key} d={sector(hole, R, b.b0, b.b1)} fill={Colors.Background.Container.Neutral.Default} opacity={0.55} />)}
            {/* capability identity: its colour on the outer arc */}
            <path d={sector(R + 4, on ? R + 12 : R + 8, s.a0, s.a1)} fill={s.c.color} />
            <g className="pr-bars">
              {s.bars.map(b => b.v == null ? null : (
                <path key={b.key} d={sector(hole, hole + (R - hole) * Math.max(0.02, Math.min(100, b.v) / 100), b.b0, b.b1)} fill={b.color} />
              ))}
            </g>
            <polyline points={side === 0 ? `${ax},${ay} ${ex},${ey}` : `${ax},${ay} ${ex},${ey} ${ex + side * 16},${ey}`} fill="none" stroke={s.c.color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={ax} cy={ay} r={2.5} fill={s.c.color} />
            <text x={lx} y={ly + lift} textAnchor={anchor} fontSize={13} fontWeight={700} fill={ink}>
              {s.c.name}
              <tspan x={lx} dy="1.35em" fontSize={13} fontWeight={700} fill={band.token} style={{ fontVariantNumeric: "tabular-nums" }}>{s.c.score}%</tspan>
              <tspan dx={6} fontSize={11} fontWeight={600} fill={band.token}>{band.label}</tspan>
            </text>
          </g>
        );
      })}

      {/* centre: the overall score — or, while a capability is pointed at, its three parts by name */}
      <circle r={hole - 6} fill={Colors.Background.Surface.Default} stroke={centre && onOpenOverall ? total.token : line} strokeWidth={centre && onOpenOverall ? 2 : 1}
        className="pr-centre" role={onOpenOverall ? "button" : undefined} tabIndex={onOpenOverall ? 0 : undefined}
        aria-label={onOpenOverall ? `Overall score ${totalScore}%: open the overall score page` : undefined}
        style={{ cursor: onOpenOverall ? "pointer" : undefined, transition: "stroke .2s" }}
        onMouseEnter={() => setCentre(true)} onMouseLeave={() => setCentre(false)}
        onFocus={() => setCentre(true)} onBlur={() => setCentre(false)}
        onClick={onOpenOverall}
        onKeyDown={e => { if (onOpenOverall && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpenOverall(); } }} />
      {hover == null ? (
        <g style={{ pointerEvents: "none" }}>
          <text textAnchor="middle" y={hole * 0.08} fontSize={hole * 0.52} fontWeight={700} fill={total.token} style={{ fontVariantNumeric: "tabular-nums" }}>{totalScore}%</text>
          <text textAnchor="middle" y={hole * 0.42} fontSize={11} fontWeight={600} fill={total.token}>{total.label}</text>
          <text textAnchor="middle" y={-hole * 0.5} fontSize={10} fill={sub} letterSpacing={1.2}>OVERALL SCORE</text>
        </g>
      ) : (
        <g style={{ pointerEvents: "none" }}>
          <text textAnchor="middle" y={-hole * 0.56} fontSize={12} fontWeight={700} fill={ink}>{SHORT[sectors[hover].c.name] ?? sectors[hover].c.name}</text>
          {/* the capability's own score, in its band colour, above its parts */}
          <text textAnchor="middle" y={-hole * 0.24} fontSize={hole * 0.26} fontWeight={700} fill={scoreBand(sectors[hover].c.score).token} style={{ fontVariantNumeric: "tabular-nums" }}>{sectors[hover].c.score}%</text>
          {/* label on the left edge, value on the right edge of the same row: they cannot collide */}
          {sectors[hover].bars.map((b, k) => (
            <g key={b.key} transform={`translate(0, ${hole * 0.04 + k * hole * 0.24})`}>
              <rect x={-hole * 0.66} width={8} height={8} y={-7.5} rx={2} fill={b.color} />
              <text x={-hole * 0.66 + 13} fontSize={10.5} fill={sub}>{b.label}</text>
              <text x={hole * 0.66} textAnchor="end" fontSize={11} fontWeight={700} fill={ink} style={{ fontVariantNumeric: "tabular-nums" }}>{b.v == null ? "—" : `${b.v}%`}</text>
            </g>
          ))}
        </g>
      )}

      {/* Legend and filter: click a part to hide or show its bars */}
      <g transform={`translate(${-W / 2 + 12}, ${-H / 2 + 22})`}>
        {PARTS.map((p, k) => {
          const isOff = off.has(p.key);
          return (
            <g key={p.key} transform={`translate(0, ${k * 26})`} role="button" tabIndex={0} aria-pressed={!isOff}
              aria-label={`${isOff ? "Show" : "Hide"} ${p.label}`} style={{ cursor: "pointer" }}
              onClick={() => toggle(p.key)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(p.key); } }}>
              <rect x={-6} y={-17} width={124} height={24} rx={6} fill="transparent" />
              <rect width={14} height={14} y={-11} rx={3} fill={isOff ? "none" : p.color} stroke={p.color} strokeWidth={1.5} />
              <text x={22} fontSize={13} fontWeight={600} fill={isOff ? sub : ink} textDecoration={isOff ? "line-through" : undefined}>{p.label}</text>
            </g>
          );
        })}
        <text y={PARTS.length * 26 + 6} fontSize={11} fill={sub}>Rings at 25, 50, 75 and 100</text>
      </g>
    </svg>
  );
};
