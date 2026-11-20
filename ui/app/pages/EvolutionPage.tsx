// ui/app/pages/EvolutionPage.tsx
//
// How the assessment moved between two saved runs, built like the Overall
// score page so the three read the same way: the score and its parts with
// their change, the score over time, every capability with its change (click
// one to follow it on the chart and in the list), and the criteria that
// changed state. Labels and numbers only; explanations sit in tooltips.
//
// Only runs saved with the three-part score (coverage, utilization, adoption)
// are offered: an older run scored coverage alone and is not comparable.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Typography from "@dynatrace/strato-design-tokens/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { Heading, Link, Text } from "@dynatrace/strato-components/typography";
import { Accordion, Chip, EmptyState, MessageContainer, ProgressCircle } from "@dynatrace/strato-components/content";
import { DataTable } from "@dynatrace/strato-components/tables";
import { Flex, Grid } from "@dynatrace/strato-components/layouts";
import { ToggleButtonGroup } from "@dynatrace/strato-components/forms";
import { MeterBarChart } from "@dynatrace/strato-components/charts";
import type { AssessmentSnapshot } from "../hooks/useAssessmentHistory";
import { ArrowDownIcon, ArrowUpIcon } from "@dynatrace/strato-icons";
import { Tooltip } from "../components/Tooltip";
import { scoreBand } from "../utils/colors";
import { CAPABILITIES } from "../queries";
import { CRITERION_ACTIONS } from "../remediationActions";
import { Panel, StateMark, TrendChart, pctFormat } from "./CapabilityDetailPage";
import { IntelligenceBar } from "../components/IntelligenceBar";
import { LENS, LENS_BASELINE, QUESTIONS, QUESTIONS_BASELINE, baselineFacts, evolutionFacts } from "../ai/pageIntelligence";
import { passLine } from "../passLine";

const MONO = Typography.Code.Small.Default.Family;
const PASS = Colors.Charts.Status.Ideal.Default;
const FAIL = Colors.Charts.Status.Critical.Default;
const NEUTRAL = Colors.Text.Neutral.Subdued;
const INK = Colors.Text.Neutral.Default;
const LINE = Colors.Border.Neutral.Default;

type SnapCap = AssessmentSnapshot["capabilities"][number];
type SnapRow = SnapCap["criteriaResults"][number];
type State = "pass" | "fail" | "na";

/** Criteria read as a share (they divide by a second query). */
const IS_RATIO: Record<string, boolean> = {};
/** The value each criterion must reach (../passLine.ts). */
const TARGET: Record<string, number | null> = {};
for (const cap of CAPABILITIES) for (const cr_ of cap.criteria) {
  if (cr_.queryB || (cr_.denominatorConstant != null && cr_.denominatorConstant !== 1)) IS_RATIO[cr_.id] = true;
  TARGET[cr_.id] = passLine(cr_.thresholds.map(t => t.min));
}
/** A reading with the state in front; the number is left out when the criterion
 *  is a presence check or no longer in the catalog (its unit is not known). */
const reading = (r: SnapRow | undefined) => {
  const st = stateOf(r);
  const word = st === "pass" ? "Met" : st === "fail" ? "Not met" : "Not assessed";
  return r && st !== "na" && IS_RATIO[r.id] ? `${word} · ${fmtValue(r)}` : word;
};

const avg = (xs: number[]) => (xs.length ? Math.floor(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const stateOf = (r?: SnapRow): State => (!r || r.notAssessed || r.error ? "na" : r.points > 0 ? "pass" : "fail");
const cleanName = (label: string) => label.replace(/\s*\(%\)\s*$/, "");
const fmtRun = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtValue = (r: SnapRow | undefined) => (stateOf(r) === "na" ? "—" : IS_RATIO[r!.id] ? `${Math.floor(r!.value * 10) / 10}%` : r!.value.toLocaleString());

function part(s: AssessmentSnapshot, k: "coverage" | "utilization" | "adoption"): number | null {
  const xs = s.capabilities.map(c => c[k]).filter((x): x is number => x != null);
  return xs.length ? avg(xs) : null;
}

/** A change in points: ▲ green, ▼ red, nothing drawn for zero. */
const Delta: React.FC<{ d: number | null; size?: number }> = ({ d, size = 12 }) => {
  if (d == null) return null;
  const r = Math.round(d);
  const color = r > 0 ? PASS : r < 0 ? FAIL : NEUTRAL;
  return (
    <Flex alignItems="center" gap={2} style={{ color, whiteSpace: "nowrap" }}>
      {r > 0 ? <ArrowUpIcon size="small" /> : r < 0 ? <ArrowDownIcon size="small" /> : null}
      <Text style={{ fontFamily: MONO, fontSize: size, fontWeight: 700, color }}>{r === 0 ? "No change" : `${Math.abs(r)} pts`}</Text>
    </Flex>
  );
};

/** A reading in the newer run with where it came from. */
const ChangeMeter: React.FC<{ label: React.ReactNode; from: number | null; to: number | null; solo?: boolean }> = ({ label, from, to, solo }) => (
  <Flex flexDirection="column" gap={4} style={{ minWidth: 0 }}>
    <MeterBarChart value={Math.floor(to ?? 0)} min={0} max={100} color={scoreBand(to ?? 0).token} size="size8" formatter={pctFormat}>
      <MeterBarChart.Label>{label}</MeterBarChart.Label>
      <MeterBarChart.Value>{to == null ? "—" : pctFormat(Math.floor(to))}</MeterBarChart.Value>
    </MeterBarChart>
    {!solo && (
      <Flex alignItems="center" justifyContent="space-between" gap={8}>
        <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>{from == null ? "—" : `${Math.floor(from)}%`} → {to == null ? "—" : `${Math.floor(to)}%`}</Text>
        <Delta d={from != null && to != null ? Math.floor(to) - Math.floor(from) : null} size={11} />
      </Flex>
    )}
  </Flex>
);

/** How far back the comparison reaches. */
const SINCE = ["Last change", "30 days", "90 days", "First run"] as const;
type Since = (typeof SINCE)[number];

type CauseKind = "lost" | "gained" | "new" | "removed" | "unassessed" | "assessed";
const CAUSE_ORDER: CauseKind[] = ["lost", "gained", "new", "removed", "unassessed", "assessed"];
const CAUSE_CHIP: Record<CauseKind, { label: string; color: "neutral" | "primary" | "success" | "warning" | "critical" }> = {
  lost: { label: "Lost", color: "critical" },
  gained: { label: "Gained", color: "success" },
  new: { label: "New criterion", color: "primary" },
  removed: { label: "Removed criterion", color: "neutral" },
  unassessed: { label: "No longer assessed", color: "warning" },
  assessed: { label: "Now assessed", color: "primary" },
};
const PART_LABEL = { coverage: "Coverage", utilization: "Utilization", adoption: "Adoption" } as const;
const signed = (n: number) => `${n > 0 ? "+" : ""}${Math.trunc(n * 10 + Math.sign(n) * 1e-9) / 10}`;

interface Props {
  snapshots: AssessmentSnapshot[];
  loading?: boolean;
  /** A run is in flight: its result is about to join the history. */
  assessing?: boolean;
}

export const EvolutionPage: React.FC<Props> = ({ snapshots, loading = false, assessing = false }) => {
  const navigate = useNavigate();
  // Newest first; only runs scored the way today's are.
  const runs = useMemo(() => [...snapshots]
    .filter(s => s.capabilities.some(c => c.coverage != null))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [snapshots]);

  const [cap, setCap] = useState<string | null>(null);
  // The comparison chooses itself: the latest run against a baseline picked by
  // period. Nobody has to select two runs by hand.
  const [since, setSince] = useState<Since>("First run");
  const to = runs[0];
  const from = useMemo(() => {
    if (runs.length === 0) return undefined;
    const latest = runs[0];
    const oldest = runs[runs.length - 1];
    const sig = (r: AssessmentSnapshot) => r.capabilities.map(c => `${c.name}:${c.score}`).join("|");
    if (since === "Last change") {
      // The most recent run that differs from the latest: repeated runs with the same scores are skipped.
      return runs.find(r => r.id !== latest.id && sig(r) !== sig(latest)) ?? oldest;
    }
    if (since === "First run") return oldest;
    const days = since === "30 days" ? 30 : 90;
    const cut = new Date(latest.timestamp).getTime() - days * 24 * 3600 * 1000;
    // The oldest run inside the window.
    const inside = runs.filter(r => new Date(r.timestamp).getTime() >= cut);
    return inside[inside.length - 1] ?? oldest;
  }, [runs, since]);

  const caps = useMemo(() => {
    if (!to || !from) return [];
    return to.capabilities.map(c => {
      const prev = from.capabilities.find(p => p.name === c.name);
      return { name: c.name, color: c.color, to: c, from: prev, delta: prev ? c.score - prev.score : null };
    }).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0) || a.to.score - b.to.score);
  }, [to, from]);

  // Why each score moved: the parts, the criteria behind them, and anything
  // that changed in what was measured (criteria or capabilities added or removed).
  const causes = useMemo(() => {
    if (!to || !from) return { caps: [], added: [] as string[], removed: [] as string[], versions: null as null | [string, string] };
    const list = to.capabilities.map(c => {
      const p = from.capabilities.find(x => x.name === c.name);
      const prevById = new Map((p?.criteriaResults ?? []).map(r => [r.id, r]));
      const nowIds = new Set(c.criteriaResults.map(r => r.id));
      const items: { kind: CauseKind; label: string; before?: string; after?: string }[] = [];
      for (const r of c.criteriaResults) {
        const b = prevById.get(r.id);
        const now = stateOf(r), was = stateOf(b);
        if (!p) continue;
        if (!b) { items.push({ kind: "new", label: cleanName(r.label), after: reading(r) }); continue; }
        if (was === now) continue;
        const kind: CauseKind = now === "pass" && was === "fail" ? "gained" : now === "fail" && was === "pass" ? "lost" : now === "na" ? "unassessed" : "assessed";
        items.push({ kind, label: cleanName(r.label), before: reading(b), after: reading(r) });
      }
      for (const b of p?.criteriaResults ?? []) if (!nowIds.has(b.id)) items.push({ kind: "removed", label: cleanName(b.label), before: reading(b) });
      const parts = (["coverage", "utilization", "adoption"] as const).map(k => ({ key: k, from: p?.[k] ?? null, to: c[k] ?? null }));
      const counted = parts.filter(x => x.to != null).length || 1;
      return {
        name: c.name, color: c.color, isNew: !p,
        from: p?.score ?? null, to: c.score, delta: p ? c.score - p.score : null,
        // Each part is one equal share of the score.
        parts: parts.map(x => ({ ...x, delta: x.from != null && x.to != null ? x.to - x.from : null, points: x.from != null && x.to != null ? (x.to - x.from) / counted : null })),
        adoptionRate: [p?.adoptionRate ?? null, c.adoptionRate ?? null] as [number | null, number | null],
        items: items.sort((a, b2) => CAUSE_ORDER.indexOf(a.kind) - CAUSE_ORDER.indexOf(b2.kind)),
      };
    });
    const toNames = new Set(to.capabilities.map(c => c.name));
    const fromNames = new Set(from.capabilities.map(c => c.name));
    return {
      caps: list.filter(x => x.isNew || x.delta !== 0 || x.items.length > 0).sort((a, b) => Math.abs(b.delta ?? 100) - Math.abs(a.delta ?? 100)),
      added: to.capabilities.filter(c => !fromNames.has(c.name)).map(c => c.name),
      removed: from.capabilities.filter(c => !toNames.has(c.name)).map(c => c.name),
      versions: from.appVersion && to.appVersion && from.appVersion !== to.appVersion ? [from.appVersion, to.appVersion] as [string, string] : null,
    };
  }, [to, from]);

  // Criteria whose state differs between the two runs.
  const changes = useMemo(() => {
    if (!to || !from) return [];
    return to.capabilities.flatMap(c => {
      const prev = from.capabilities.find(p => p.name === c.name);
      return c.criteriaResults.map(r => {
        const before = prev?.criteriaResults.find(p => p.id === r.id);
        return { cap: c, r, before, was: stateOf(before), now: stateOf(r) };
      }).filter(x => x.was !== "na" && x.now !== "na" && x.was !== x.now);
    }).filter(x => !cap || x.cap.name === cap)
      // Lost criteria first: they are the ones to act on.
      .sort((a, b) => (a.now === b.now ? 0 : a.now === "fail" ? -1 : 1));
  }, [to, from, cap]);
  // With one saved run there is nothing to compare, so the page reads the run
  // as a baseline: what holds each score and which unmet criteria are nearest
  // their target. Those are the ones a second run is most likely to show as gained.
  const closest = useMemo(() => {
    if (!to) return [];
    return to.capabilities.flatMap(c => c.criteriaResults
      .filter(r => stateOf(r) === "fail" && IS_RATIO[r.id] && TARGET[r.id] != null)
      .map(r => {
        const value = Math.floor(r.value * 10) / 10, target = TARGET[r.id] as number;
        return { cap: c, r, value, target, gap: Math.max(0, Math.ceil((target - value) * 10) / 10) };
      }))
      .filter(x => !cap || x.cap.name === cap)
      .sort((a, b) => a.gap - b.gap);
  }, [to, cap]);
  type Near = (typeof closest)[number];
  const nearColumns = [
    { id: "criterion", header: "Criterion", minWidth: 160, autoWidth: true, accessor: (c: Near) => cleanName(c.r.label), cell: ({ rowData }: { rowData: Near }) => {
      const act = CRITERION_ACTIONS[rowData.r.id]?.action;
      return <DataTable.DefaultCell>{act ? <Tooltip text={act}><Text>{cleanName(rowData.r.label)}</Text></Tooltip> : cleanName(rowData.r.label)}</DataTable.DefaultCell>;
    } },
    { id: "capability", header: "Capability", minWidth: 150, autoWidth: true, accessor: (c: Near) => c.cap.name, cell: ({ rowData }: { rowData: Near }) => (
      <DataTable.DefaultCell><Link onClick={() => openCap(rowData.cap.name)}>{rowData.cap.name}</Link></DataTable.DefaultCell>
    ) },
    { id: "value", header: "Value", width: 100, alignment: "right" as const, accessor: (c: Near) => `${c.value}%` },
    { id: "target", header: "Target", width: 100, alignment: "right" as const, accessor: (c: Near) => `${c.target}%` },
    { id: "gap", header: "Gap (pts)", width: 110, alignment: "right" as const, accessor: (c: Near) => c.gap },
  ];
  /** Per capability: its parts, the lowest one, and the criteria that are not met. */
  const baseline = useMemo(() => {
    if (!to) return [];
    return [...to.capabilities].sort((a, b) => a.score - b.score).map(c => {
      const parts = (["coverage", "utilization", "adoption"] as const).map(k => ({ key: k, value: c[k] ?? null }));
      const known = parts.filter(p => p.value != null);
      const lowest = known.length ? known.reduce((m, p) => ((p.value as number) < (m.value as number) ? p : m)).key : null;
      return {
        name: c.name, color: c.color, score: c.score, parts, lowest, adoptionRate: c.adoptionRate ?? null,
        unmet: c.criteriaResults.filter(r => stateOf(r) === "fail"),
        notAssessed: c.criteriaResults.filter(r => stateOf(r) === "na"),
      };
    });
  }, [to]);

  const gained = changes.filter(c => c.now === "pass").length;
  const lost = changes.filter(c => c.now === "fail").length;
  type Change = (typeof changes)[number];
  const openCap = (name: string) => navigate(`/capability/${encodeURIComponent(name.replace(/\//g, "~"))}`);
  const changeColumns = [
    { id: "change", header: "Change", width: 110, accessor: (c: Change) => (c.now === "pass" ? "Gained" : "Lost"), cell: ({ rowData }: { rowData: Change }) => (
      <DataTable.DefaultCell><Chip size="condensed" color={rowData.now === "pass" ? "success" : "critical"}>{rowData.now === "pass" ? "Gained" : "Lost"}</Chip></DataTable.DefaultCell>
    ) },
    { id: "state", header: "State now", width: 130, accessor: (c: Change) => (c.now === "pass" ? "Met" : "Not met"), cell: ({ rowData }: { rowData: Change }) => (
      <DataTable.DefaultCell><StateMark state={rowData.now === "pass" ? "pass" : "fail"} label /></DataTable.DefaultCell>
    ) },
    { id: "criterion", header: "Criterion", minWidth: 160, autoWidth: true, accessor: (c: Change) => cleanName(c.r.label), cell: ({ rowData }: { rowData: Change }) => {
      const act = rowData.now === "fail" ? CRITERION_ACTIONS[rowData.r.id]?.action : undefined;
      return <DataTable.DefaultCell>{act ? <Tooltip text={act}><Text>{cleanName(rowData.r.label)}</Text></Tooltip> : cleanName(rowData.r.label)}</DataTable.DefaultCell>;
    } },
    { id: "capability", header: "Capability", minWidth: 150, autoWidth: true, accessor: (c: Change) => c.cap.name, cell: ({ rowData }: { rowData: Change }) => (
      <DataTable.DefaultCell><Link onClick={() => openCap(rowData.cap.name)}>{rowData.cap.name}</Link></DataTable.DefaultCell>
    ) },
    { id: "before", header: "Before", width: 100, alignment: "right" as const, accessor: (c: Change) => fmtValue(c.before) },
    { id: "after", header: "Now", width: 100, alignment: "right" as const, accessor: (c: Change) => fmtValue(c.r) },
  ];

  const trend = useMemo(() => [...runs].reverse().slice(-30).map(s2 => {
    const c = cap ? s2.capabilities.find(x => x.name === cap) : undefined;
    const parts = (cap ? [c?.coverage, c?.utilization, c?.adoption] : [part(s2, "coverage"), part(s2, "utilization"), part(s2, "adoption")])
      .filter((x): x is number => x != null);
    const v = cap ? (c?.score ?? 0) : s2.totalScore;
    return { t: new Date(s2.timestamp).getTime(), v, lo: parts.length ? Math.min(...parts) : v, hi: parts.length ? Math.max(...parts) : v };
  }), [runs, cap]);

  if ((loading || assessing) && runs.length === 0) {
    return <Flex alignItems="center" justifyContent="center" style={{ flex: 1, padding: 48 }}><ProgressCircle aria-label="Loading saved runs" /></Flex>;
  }
  if (!to || !from) {
    return (
      <Flex alignItems="center" justifyContent="center" style={{ flex: 1, padding: 48 }}>
        <EmptyState>
          <EmptyState.VisualPreset context="chart" type="something-missing" />
          <EmptyState.Title>No saved run yet</EmptyState.Title>
          <EmptyState.Details>Each completed assessment is saved automatically and shows up here.</EmptyState.Details>
          <EmptyState.Actions><Button variant="emphasized" onClick={() => navigate("/")}>Go to assessment</Button></EmptyState.Actions>
        </EmptyState>
      </Flex>
    );
  }

  // One saved run: the page shows it as the baseline. The comparison panels
  // appear with the second run.
  const solo = runs.length === 1;
  const band = scoreBand(to.totalScore);
  const capColor = cap ? (to.capabilities.find(c => c.name === cap)?.color ?? Colors.Charts.Categorical.Color01.Default) : Colors.Charts.Categorical.Color01.Default;
  const clearCap = cap ? <Chip color="primary" size="condensed">{cap}<Chip.DeleteButton aria-label={`Clear the ${cap} filter`} onClick={() => setCap(null)} /></Chip> : null;
  return (
    <Flex flexDirection="column" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      <IntelligenceBar
        key={`${from.id}-${to.id}`}
        questions={solo ? QUESTIONS_BASELINE : QUESTIONS.evolution}
        ctx={{
          tenant: to.tenant, date: to.timestamp.slice(0, 10), overallCoverage: to.totalScore,
          overallUtilization: part(to, "utilization") ?? 0,
          capabilities: to.capabilities.map(c => ({ name: c.name, score: c.score, coverageScore: c.coverage, adoptionRate: c.adoptionRate ?? null, adoptionScore: c.adoption ?? null, criteriaResults: c.criteriaResults.filter(r => !r.notAssessed) })),
          lens: solo ? LENS_BASELINE : LENS.evolution,
          pageNote: solo
            ? baselineFacts(to, closest.slice(0, 12).map(x => ({ capability: x.cap.name, label: cleanName(x.r.label), value: x.value, target: x.target, gap: x.gap })))
            : evolutionFacts(from, to),
        }}
      />
      <Flex flexDirection="column" gap={16} style={{ padding: "16px 20px 32px" }}>
        <Flex alignItems="center" gap={12} flexWrap="wrap">
          <Heading level={2}>Evolution</Heading>
          <Text style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: band.token }}>{to.totalScore}%</Text>
          {solo ? <Chip size="condensed" color="primary">First run</Chip> : <Delta d={to.totalScore - from.totalScore} size={14} />}
          <Flex alignItems="center" gap={16} flexWrap="wrap" style={{ marginLeft: "auto" }}>
            <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>{solo ? fmtRun(to.timestamp) : `${fmtRun(from.timestamp)} → ${fmtRun(to.timestamp)}`}</Text>
            {!solo && (
              <Flex style={{ maxWidth: "100%", overflowX: "auto" }}><ToggleButtonGroup value={since} onChange={(v: string) => setSince(v as Since)}>
                {SINCE.map(v => <ToggleButtonGroup.Item key={v} value={v}>{v}</ToggleButtonGroup.Item>)}
              </ToggleButtonGroup></Flex>
            )}
          </Flex>
        </Flex>

        {/* Two panels that share the row and stack when it gets narrow: a spanning
            item in an auto-fit grid wrapped alone and left the row half empty. */}
        <Flex style={{ flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
          <Panel title={solo ? "Score" : "What changed in the score"} style={{ flex: "1 1 300px" }}>
            <Flex flexDirection="column" gap={12}>
              <ChangeMeter label="Overall score" from={from.totalScore} to={to.totalScore} solo={solo} />
              <ChangeMeter label="Coverage" from={part(from, "coverage")} to={part(to, "coverage")} solo={solo} />
              <ChangeMeter label="Utilization" from={part(from, "utilization")} to={part(to, "utilization")} solo={solo} />
              <ChangeMeter label="Adoption" from={part(from, "adoption")} to={part(to, "adoption")} solo={solo} />
            </Flex>
          </Panel>

          <Panel title="Score over time" right={clearCap ?? <Text textStyle="small" style={{ color: NEUTRAL }}>Overall</Text>} style={{ flex: "2 1 420px" }}>
            <TrendChart points={trend} name={cap ?? "Overall"} color={capColor} />
          </Panel>
        </Flex>

        {/* Why the score moved: every change traced to its part and its criteria */}
        {solo && (
          <Panel title="What holds each score" right={<Text textStyle="small" style={{ color: NEUTRAL }}>Lowest score first</Text>}>
            <Accordion multiple defaultExpanded={baseline.slice(0, 2).map(c => c.name)}>
              {baseline.map(c => (
                <Accordion.Section key={c.name} id={c.name}>
                  <Accordion.SectionLabel>
                    <Grid gridTemplateColumns="minmax(0, 1fr) 90px" gap={12} alignItems="center" width="100%">
                      <Flex alignItems="center" gap={8}>
                        <Flex style={{ display: "inline-flex", width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                        <Text textStyle="base-emphasized">{c.name}</Text>
                      </Flex>
                      <Text textStyle="base-emphasized" style={{ fontFamily: MONO, color: scoreBand(c.score).token, textAlign: "right" }}>{c.score}%</Text>
                    </Grid>
                  </Accordion.SectionLabel>
                  <Accordion.SectionContent>
                    <Flex flexDirection="column" gap={12}>
                      <Grid gridTemplateColumns="repeat(auto-fit, minmax(min(100%, 200px), 1fr))" gap={12}>
                        {c.parts.map(p => (
                          <Flex key={p.key} flexDirection="column" gap={2}>
                            <Text textStyle="small" style={{ color: NEUTRAL }}>{PART_LABEL[p.key]}</Text>
                            <Text textStyle="base-emphasized" style={{ fontFamily: MONO }}>{p.value == null ? "—" : `${Math.floor(p.value)}%`}</Text>
                            {p.key === c.lowest && <Flex><Chip size="condensed" color="warning">Lowest part</Chip></Flex>}
                            {p.key === "adoption" && c.adoptionRate != null && <Text textStyle="small" style={{ color: NEUTRAL }}>{c.adoptionRate}% of active users</Text>}
                          </Flex>
                        ))}
                      </Grid>
                      {c.unmet.length === 0 && c.notAssessed.length === 0 ? (
                        <Text textStyle="small" style={{ color: NEUTRAL }}>Every criterion is met</Text>
                      ) : (
                        <Flex flexDirection="column" gap={6}>
                          {[...c.unmet, ...c.notAssessed].map(r => (
                            <Grid key={r.id} gridTemplateColumns="130px minmax(0, 1fr) minmax(0, 1fr)" gap={12} alignItems="center">
                              <Flex><StateMark state={stateOf(r) === "fail" ? "fail" : "na"} label /></Flex>
                              <Text textStyle="small-emphasized">{cleanName(r.label)}</Text>
                              <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>
                                {stateOf(r) === "fail" && IS_RATIO[r.id] && TARGET[r.id] != null ? `${fmtValue(r)}  →  ${TARGET[r.id]}%` : ""}
                              </Text>
                            </Grid>
                          ))}
                        </Flex>
                      )}
                    </Flex>
                  </Accordion.SectionContent>
                </Accordion.Section>
              ))}
            </Accordion>
          </Panel>
        )}

        {!solo && <Panel title="What caused the change">
          {causes.caps.length === 0 && causes.added.length === 0 && causes.removed.length === 0 ? (
            <Text textStyle="small" style={{ color: NEUTRAL }}>Nothing changed between these two runs</Text>
          ) : (
            <Flex flexDirection="column" gap={12}>
              {(causes.versions || causes.added.length > 0 || causes.removed.length > 0) && (
                <MessageContainer variant="primary">
                  <MessageContainer.Prefix />
                  <MessageContainer.Title>What is measured changed between these runs</MessageContainer.Title>
                  <MessageContainer.Description>
                    {[
                      causes.versions ? `App version ${causes.versions[0]} to ${causes.versions[1]}.` : "",
                      causes.added.length ? `Capabilities added: ${causes.added.join(", ")}.` : "",
                      causes.removed.length ? `Capabilities removed: ${causes.removed.join(", ")}.` : "",
                      "Part of the difference comes from the measurement itself, not from the environment.",
                    ].filter(Boolean).join(" ")}
                  </MessageContainer.Description>
                </MessageContainer>
              )}
              <Accordion multiple defaultExpanded={causes.caps.slice(0, 2).map(c => c.name)}>
                {causes.caps.map(c => (
                  <Accordion.Section key={c.name} id={c.name}>
                    <Accordion.SectionLabel>
                      <Grid gridTemplateColumns="minmax(0, 1fr) 130px 90px" gap={12} alignItems="center" width="100%">
                        <Flex alignItems="center" gap={8}>
                          <Flex style={{ display: "inline-flex", width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                          <Text textStyle="base-emphasized">{c.name}</Text>
                          {c.isNew && <Chip size="condensed" color="primary">New capability</Chip>}
                        </Flex>
                        <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL, textAlign: "right" }}>{c.from == null ? "—" : `${c.from}%`} → {c.to}%</Text>
                        <Flex justifyContent="flex-end"><Delta d={c.delta} /></Flex>
                      </Grid>
                    </Accordion.SectionLabel>
                    <Accordion.SectionContent>
                      <Flex flexDirection="column" gap={12}>
                        {/* 1. Which part moved, and how many points of the score that is */}
                        {!c.isNew && (
                          <Grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap={12}>
                            {c.parts.map(p => (
                              <Flex key={p.key} flexDirection="column" gap={2}>
                                <Text textStyle="small" style={{ color: NEUTRAL }}>{PART_LABEL[p.key]}</Text>
                                <Text textStyle="base-emphasized" style={{ fontFamily: MONO }}>{p.from == null ? "—" : `${Math.floor(p.from)}%`} → {p.to == null ? "—" : `${Math.floor(p.to)}%`}</Text>
                                <Text textStyle="small" style={{ fontFamily: MONO, color: p.points == null || Math.abs(p.points) < 0.05 ? NEUTRAL : p.points > 0 ? PASS : FAIL }}>
                                  {p.points == null ? "Not comparable" : Math.abs(p.points) < 0.05 ? "No effect on the score" : `${signed(p.points)} pts on the score`}
                                </Text>
                                {p.key === "adoption" && c.adoptionRate[0] != null && c.adoptionRate[1] != null && c.adoptionRate[0] !== c.adoptionRate[1] && (
                                  <Text textStyle="small" style={{ color: NEUTRAL }}>{c.adoptionRate[0]}% → {c.adoptionRate[1]}% of active users</Text>
                                )}
                              </Flex>
                            ))}
                          </Grid>
                        )}
                        {/* 2. The criteria behind coverage and utilization */}
                        {c.items.length === 0 ? (
                          !c.isNew && <Text textStyle="small" style={{ color: NEUTRAL }}>No criterion changed state: the difference comes from adoption or from values moving inside the same state.</Text>
                        ) : (
                          <Flex flexDirection="column" gap={6}>
                            {c.items.map((it, k) => (
                              <Grid key={k} gridTemplateColumns="150px minmax(0, 1fr) minmax(0, 1.2fr)" gap={12} alignItems="center">
                                <Flex><Chip size="condensed" color={CAUSE_CHIP[it.kind].color}>{CAUSE_CHIP[it.kind].label}</Chip></Flex>
                                <Text textStyle="small-emphasized">{it.label}</Text>
                                <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>{[it.before, it.after].filter(Boolean).join("  →  ")}</Text>
                              </Grid>
                            ))}
                          </Flex>
                        )}
                      </Flex>
                    </Accordion.SectionContent>
                  </Accordion.Section>
                ))}
              </Accordion>
            </Flex>
          )}
        </Panel>}

        <Panel title="Capabilities" right={<Flex alignItems="center" gap={12}>{clearCap}<Text textStyle="small" style={{ color: NEUTRAL }}>{solo ? "Lowest score first" : "Largest drop first"}</Text></Flex>}>
          <Grid style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px 28px" }}>
            {caps.map(c => {
              return (
                <Flex key={c.name} flexDirection="column" style={{ minWidth: 0 }}>
                  <ChangeMeter
                    label={<Link onClick={() => setCap(cap === c.name ? null : c.name)}>{c.name}</Link>}
                    from={c.from?.score ?? null} to={c.to.score} solo={solo} />
                </Flex>
              );
            })}
          </Grid>
        </Panel>

        {solo && (
          <Panel title="Closest to passing" right={<Flex alignItems="center" gap={12}>{clearCap}<Text textStyle="small" style={{ color: NEUTRAL }}>Smallest gap first</Text></Flex>}>
            {closest.length === 0 ? <Text textStyle="small" style={{ color: NEUTRAL }}>No unmet share criteria</Text> : (
              <DataTable data={closest} columns={nearColumns} fullWidth sortable defaultLineWrap variant={{ rowDensity: "condensed" }}>
                <DataTable.Pagination defaultPageSize={10} />
              </DataTable>
            )}
          </Panel>
        )}

        {!solo && <Panel title="Criteria that changed" right={
          <Flex alignItems="center" gap={12}>
            {clearCap}
            <Chip color="success" size="condensed">Gained {gained}</Chip><Chip color="critical" size="condensed">Lost {lost}</Chip>
          </Flex>}>
          {changes.length === 0 ? <Text textStyle="small" style={{ color: NEUTRAL }}>No criteria changed state</Text> : (
            <DataTable data={changes} columns={changeColumns} fullWidth sortable defaultLineWrap variant={{ rowDensity: "condensed" }}>
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
          )}
        </Panel>}
      </Flex>
    </Flex>
  );
};
