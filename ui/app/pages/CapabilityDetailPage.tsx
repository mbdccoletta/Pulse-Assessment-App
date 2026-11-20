// ui/app/pages/CapabilityDetailPage.tsx
//
// One capability, in full. Opened from the Coverage chart (click a point or a
// label). Everything the side cards used to carry lives here — verdict,
// adoption, every criterion, the AI insight — plus the charts the cards had no
// room for: criteria against their threshold, the three utilization tiers, the
// score over time, and the apps people use. Labels and numbers only; the
// explanations sit in tooltips.

import { ToggleButtonGroup } from "@dynatrace/strato-components/forms";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Typography from "@dynatrace/strato-design-tokens/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { ExternalLink, Heading, Text } from "@dynatrace/strato-components/typography";
import { Flex, Surface, Grid } from "@dynatrace/strato-components/layouts";
import { Chip, EmptyState, HealthIndicator, InformationOverlay, SkeletonText, Accordion } from "@dynatrace/strato-components/content";
import { Breadcrumbs } from "@dynatrace/strato-components/navigation";
import { GaugeChart, MeterBarChart, MultiMeterBarChart, TimeseriesChart } from "@dynatrace/strato-components/charts";
import type { CoverageData, CapabilityResult } from "../hooks/useCoverageData";
import type { useAssessmentHistory } from "../hooks/useAssessmentHistory";
import { NO_ADOPTION } from "../hooks/useAppAdoption";
import { IntelligenceBar } from "../components/IntelligenceBar";
import { LENS, capabilityQuestions, capabilityFacts } from "../ai/pageIntelligence";
import { Tooltip } from "../components/Tooltip";
import { diagnose } from "../diagnosis";
import { passLine } from "../passLine";
import { useAppNames, useInstalledApps } from "../hooks/useAppNames";
import { capabilityForApp, sharedCapabilitiesForApp } from "../data/appCapabilityMap";
import { ADOPTION_FULL_RATE, gainIfMet } from "../pulseScore";
import { openDynatraceAssist } from "../ai/assistIntent";
import type { ReportContext } from "../ai/reportPrompt";
import { sendIntent } from "@dynatrace-sdk/navigation";
import { ChevronLeftIcon, ChevronRightIcon, DynatraceIntelligenceSignetIcon } from "@dynatrace/strato-icons";
import { gapFor, runGap } from "../data/criterionGaps";
import { scoreBand, SCORE_BANDS } from "../utils/colors";
import { CRITERION_IMPORTANCE } from "../data/criterionImportance";
import { CRITERION_ACTIONS } from "../remediationActions";

const MONO = Typography.Code.Small.Default.Family;
const PASS = Colors.Charts.Status.Ideal.Default;
const FAIL = Colors.Charts.Status.Critical.Default;
const NEUTRAL = Colors.Text.Neutral.Subdued;
const INK = Colors.Text.Neutral.Default;
const LINE = Colors.Border.Neutral.Default;
const SURFACE = Colors.Background.Surface.Default;

type Row = CapabilityResult["criteriaResults"][number];
export type TierKey = "foundation" | "bestPractice" | "excellence";

export const TIERS: { key: TierKey; label: string }[] = [
  { key: "foundation", label: "Foundation" },
  { key: "bestPractice", label: "Best practice" },
  { key: "excellence", label: "Excellence" },
];

/** The value that decides a pass (../passLine.ts): the middle of the targets. */
function passFloor(thresholds: string): number | null {
  const nums = (thresholds.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  return passLine(nums);
}

function rowState(r: Row): "pass" | "fail" | "na" {
  if (r.notAssessed || r.error) return "na";
  return r.points > 0 ? "pass" : "fail";
}

const STATE_META = {
  pass: { color: PASS, shape: "●", word: "Met", status: "ideal" },
  fail: { color: FAIL, shape: "◆", word: "Not met", status: "critical" },
  na:   { color: NEUTRAL, shape: "○", word: "Not assessed", status: "neutral" },
} as const;

/** Met / Not met / Not assessed, drawn by Strato: colour plus shape, with the word for assistive tech. */
export const StateMark: React.FC<{ state: keyof typeof STATE_META; label?: boolean }> = ({ state, label }) => {
  const m = STATE_META[state];
  return label
    ? <HealthIndicator status={m.status}><HealthIndicator.Label>{m.word}</HealthIndicator.Label></HealthIndicator>
    : <HealthIndicator status={m.status} aria-label={m.word} />;
};

/** Verdict as a Strato chip; the colour is the judgement. */
const VERDICT_CHIP: Record<string, "neutral" | "primary" | "success" | "warning" | "critical"> = {
  healthy: "success", starved: "primary", unwatched: "critical", skinDeep: "warning", dark: "neutral", notAssessed: "neutral",
};
export const VerdictChip: React.FC<{ id: string; label: string; meaning?: string; size?: "default" | "condensed" }> = ({ id, label, meaning, size }) => {
  const chip = <Chip color={VERDICT_CHIP[id] ?? "neutral"} variant="accent" size={size} style={{ flexShrink: 0 }}>{label}</Chip>;
  return meaning ? <Tooltip text={meaning} containerStyle={{ flexShrink: 0 }}>{chip}</Tooltip> : chip;
};

/** Presence checks divide by 1: the reading is the count itself. */
function isPresence(r: Row): boolean {
  return r.count != null;
}

function fmtValue(r: Row): string {
  if (rowState(r) === "na") return "—";
  if (isPresence(r)) return (r.count ?? 0).toLocaleString();
  return r.isRatio ? `${Math.floor(r.value * 10) / 10}%` : r.value.toLocaleString();
}

function fmtFloor(r: Row): string {
  if (isPresence(r)) return "≥1";
  const f = passFloor(r.thresholds);
  return f == null ? "—" : r.isRatio ? `${f}%` : String(f);
}

/** Ratio criteria carry "A\n÷ B"; copy both as runnable DQL. */
function dqlForCopy(query: string): string {
  // A configuration read is not a query: say what it is instead of handing out something that will not run.
  if (/^\s*(settings:count|slos:count)\b/.test(query)) return `// Read from configuration, not from a DQL query: ${query.split("\n")[0]}`;
  const [a, b] = query.split("\n÷ ");
  return b ? `// numerator\n${a}\n\n// denominator\n${b}` : a;
}

function tipFor(r: Row): string {
  const why = CRITERION_IMPORTANCE[r.id];
  const fix = CRITERION_ACTIONS[r.id]?.action;
  return [r.description, why, fix ? `Next step: ${fix}` : ""].filter(Boolean).join("\n\n");
}

// ── Building blocks ─────────────────────────────────────────────────────────

export const Panel: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, right, children, style }) => (
  <Surface elevation="flat" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, minWidth: 0, ...style }}>
    <Flex alignItems="center" justifyContent="space-between" gap={8}>
      <Heading level={5}>{title}</Heading>
      {right}
    </Flex>
    {children}
  </Surface>
);

export const pctFormat = (v: number) => `${Math.floor(v * 10) / 10}%`;

/** Band thresholds for the gauge: the colour of a score is its band. */
export const BAND_THRESHOLDS = SCORE_BANDS.map(b => ({ value: b.min, color: b.token }));

/** One meter per utilization tier, coloured by its band. */
export const TierMeter: React.FC<{ label: string; pct: number }> = ({ label, pct }) => (
  <MeterBarChart value={Math.floor(pct)} min={0} max={100} color={scoreBand(pct).token} size="size8" formatter={pctFormat}>
    <MeterBarChart.Label>{label}</MeterBarChart.Label>
    <MeterBarChart.Value>{pctFormat(Math.floor(pct))}</MeterBarChart.Value>
  </MeterBarChart>
);

/** Ratio criteria of one tier: one Strato meter per criterion. The name sits
 *  above its bar at full length (a bar-chart axis truncates long names); the
 *  colour and the shape carry the verdict, the tooltip the explanation. */
const TierBars: React.FC<{ rows: Row[] }> = ({ rows }) => (
  <Grid style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px 24px" }}>
    {rows.map(r => {
      const st = rowState(r), meta = STATE_META[st];
      const name = r.label.replace(/\s*\(%\)\s*$/, "");
      return (
        <Tooltip key={r.id} text={tipFor(r)} containerStyle={{ display: "block", minWidth: 0 }}>
          <Grid style={{ gridTemplateColumns: "16px minmax(0, 1fr)", gap: 6, alignItems: "start" }}>
            <Flex flexDirection="column" style={{ paddingTop: 2 }}><StateMark state={st} /></Flex>
            <MeterBarChart value={st === "na" ? 0 : Math.min(100, r.value)} min={0} max={100} color={meta.color} size="size8" formatter={pctFormat}>
              <MeterBarChart.Label>{name}</MeterBarChart.Label>
              <MeterBarChart.Value>{fmtValue(r)}</MeterBarChart.Value>
            </MeterBarChart>
          </Grid>
        </Tooltip>
      );
    })}
  </Grid>
);

/** Presence checks (a count, not a share) as status rows. */
/** What a presence count counts. People are also shown as a share of active users. */
const PRESENCE_UNIT: Record<string, string> = {
  ai12: "people", ai18: "people", i26: "people", a16: "people", d15: "people", l17: "people", s14: "people", t14: "people", b11: "people", g9: "people",
  ai10: "tool calls", ai14: "workflows", g6: "workflows", g8: "workflows", i25: "workflows", d14: "workflows", t13: "workflows", sd14: "workflows", f1: "workflows", f3: "providers", sd2: "events", sd13: "validations", l15: "events",
  s13: "reports", s2: "sources", s11: "detections", s12: "findings", t4: "detections", t12: "sources",
};

const PresenceList: React.FC<{ rows: Row[]; totalUsers?: number }> = ({ rows, totalUsers }) => (
  <Flex flexDirection="column" gap={6}>
    {rows.map(r => {
      const st = STATE_META[rowState(r)];
      return (
        <Tooltip key={r.id} text={tipFor(r)} containerStyle={{ display: "block" }}>
          <Grid style={{ gridTemplateColumns: "16px minmax(0, 1fr) auto", gap: 8, alignItems: "center" }}>
            <StateMark state={rowState(r)} />
            <Text textStyle="small" style={{ color: INK }}>{r.label}</Text>
            <Text textStyle="small" style={{ fontFamily: MONO, color: st.color }}>{presenceReading(r, totalUsers)}</Text>
          </Grid>
        </Tooltip>
      );
    })}
  </Flex>
);

function presenceReading(r: Row, totalUsers?: number): string {
  const st = rowState(r);
  if (st === "na") return "—";
  const n = r.count ?? 0;
  if (n === 0) return "None";
  const unit = PRESENCE_UNIT[r.id];
  if (unit === "people" && totalUsers && totalUsers > 0) {
    const pct = Math.floor((n / totalUsers) * 1000) / 10;
    return `${n.toLocaleString()} people · ${pct}%`;
  }
  return unit ? `${n.toLocaleString()} ${n === 1 ? unit.replace(/s$/, "") : unit}` : n.toLocaleString();
}

/** Criteria grouped by tier: ratios as bars, presence checks as rows. */
const CriteriaChart: React.FC<{ rows: Row[]; totalUsers?: number }> = ({ rows, totalUsers }) => (
  <Flex flexDirection="column" gap={16}>
    {TIERS.map(t => {
      const tr = rows.filter(r => r.tier === t.key);
      if (tr.length === 0) return null;
      const ratios = tr.filter(r => !isPresence(r));
      const presence = tr.filter(r => isPresence(r));
      return (
        <Flex key={t.key} flexDirection="column" gap={6}>
          <Text textStyle="small-emphasized" style={{ color: INK }}>{t.label}</Text>
          {ratios.length > 0 && <TierBars rows={ratios} />}
          {presence.length > 0 && <PresenceList rows={presence} totalUsers={totalUsers} />}
        </Flex>
      );
    })}
  </Flex>
);

/** Score over the saved runs, as a band chart: the line is the score, the band
 *  spans its lowest and highest part (coverage, utilization, adoption) on each
 *  run — a wide band means the parts disagree. Runs saved before the parts were
 *  stored have a band of zero width. */
export const TrendChart: React.FC<{ points: { t: number; v: number; lo: number; hi: number }[]; name: string; color: string }> = ({ points, name, color }) => {
  if (points.length === 0) return <Text textStyle="small" style={{ color: NEUTRAL }}>No saved run yet</Text>;
  const line = { name: "Score", unit: "%", datapoints: points.map(p => ({ start: new Date(p.t), value: p.v })) };
  const band = { name: "Parts range", unit: "%", datapoints: points.map(p => ({ start: new Date(p.t), y0: p.lo, y1: p.hi })) };
  return (
    <TimeseriesChart height={200} aria-label={`${name}: score over time`}>
      <TimeseriesChart.Band data={band} color={color} />
      <TimeseriesChart.Line data={line} color={color} gapPolicy="connect" />
      <TimeseriesChart.YAxis min={0} max={100} />
    </TimeseriesChart>
  );
};

/** One unmet criterion as something to act on: the gap in numbers, what it
 *  costs to leave it, what to do, what the score gains, and where to go. */
const ActionList: React.FC<{ cap: CapabilityResult; ctx: ReportContext; tier?: string | null }> = ({ cap, ctx, tier }) => {
  const [all, setAll] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  /** Gap lists loaded on demand, per criterion. */
  const [lists, setLists] = useState<Record<string, { state: "loading" | "ok" | "error"; names?: string[] }>>({});
  const loadGap = async (id: string, query: string) => {
    setLists(l => ({ ...l, [id]: { state: "loading" } }));
    try { const names = await runGap(query); setLists(l => ({ ...l, [id]: { state: "ok", names } })); }
    catch { setLists(l => ({ ...l, [id]: { state: "error" } })); }
  };
  const todo = useMemo(() => cap.criteriaResults
    .filter(r => rowState(r) === "fail" && (!tier || r.tier === tier))
    .map(r => ({ r, gain: gainIfMet(cap, r.tier) }))
    .sort((a, b) => b.gain - a.gain), [cap, tier]);
  if (todo.length === 0) return null;
  const shown = all ? todo : todo.slice(0, 5);

  const askAssist = (r: Row) => {
    const name = r.label.replace(/\s*\(%\)\s*$/, "");
    const err = openDynatraceAssist({
      prompt: `In ${cap.name}, the check "${name}" is at ${fmtValue(r)} and needs ${fmtFloor(r)}. What exactly should I configure in Dynatrace to fix it, step by step, and how do I verify it worked?`,
      ctx, execute: true,
    });
    setNote(err ? `${err.message} ${err.hint}` : null);
  };
  const openQuery = (r: Row) => {
    try { sendIntent({ "dt.query": dqlForCopy(r.query) }); setNote(null); }
    catch { setNote("Opening a notebook needs the app running inside Dynatrace."); }
  };

  return (
    <Panel title="What to do" right={<Text textStyle="small" style={{ color: NEUTRAL }}>Highest score gain first</Text>}>
      <Accordion>
        {shown.map(({ r, gain }) => {
          const name = r.label.replace(/\s*\(%\)\s*$/, "");
          const act = CRITERION_ACTIONS[r.id];
          const gapDef = gapFor(r.id, r.query.split("\n÷ ")[1]);
          const list = lists[r.id];
          const gap = r.num != null && r.den != null && !isPresence(r) && Number.isInteger(r.num) && Number.isInteger(r.den) && r.den !== 100
            ? `${r.num.toLocaleString()} of ${r.den.toLocaleString()} · ${fmtValue(r)}`
            : fmtValue(r);
          return (
            <Accordion.Section key={r.id} id={r.id}>
              <Accordion.SectionLabel>
                <Grid gridTemplateColumns="16px minmax(0, 1.4fr) minmax(0, 1fr) 84px" gap={12} alignItems="center" width="100%">
                  <StateMark state="fail" />
                  <Text textStyle="base-emphasized">{name}</Text>
                  <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>{gap} → {fmtFloor(r)}</Text>
                  <Text textStyle="small-emphasized" style={{ fontFamily: MONO, color: PASS, textAlign: "right" }}>{gain > 0 ? `+${gain} pts` : "—"}</Text>
                </Grid>
              </Accordion.SectionLabel>
              <Accordion.SectionContent>
                <Flex flexDirection="column" gap={12} style={{ maxWidth: 860 }}>
                  <Grid style={{ gridTemplateColumns: "96px minmax(0, 1fr)", gap: "8px 16px", fontSize: 13, lineHeight: 1.5 }}>
                    <Text style={{ color: NEUTRAL }}>Measured</Text><Text style={{ color: INK }}>{r.description}</Text>
                    {CRITERION_IMPORTANCE[r.id] && (<><Text style={{ color: NEUTRAL }}>Why it matters</Text><Text style={{ color: INK }}>{CRITERION_IMPORTANCE[r.id]}</Text></>)}
                    {act?.action && (<><Text style={{ color: NEUTRAL }}>What to do</Text><Text style={{ color: INK, fontWeight: 600 }}>{act.action}</Text></>)}
                  </Grid>
                  {gapDef && (
                    <Flex flexDirection="column" gap={8}>
                      {!list && <Flex flexDirection="column"><Button size="condensed" onClick={() => loadGap(r.id, gapDef.query)}>Show the {gapDef.noun}</Button></Flex>}
                      {list?.state === "loading" && <SkeletonText lines={2} />}
                      {list?.state === "error" && <Text textStyle="small" style={{ color: Colors.Text.Warning.Default }}>The list could not be loaded.</Text>}
                      {list?.state === "ok" && (
                        <Flex flexDirection="column" gap={6}>
                          <Text textStyle="small" style={{ color: NEUTRAL }}>{list.names!.length === 0 ? `No ${gapDef.noun} found` : `${gapDef.noun.charAt(0).toUpperCase()}${gapDef.noun.slice(1)}${list.names!.length === 50 ? " (first 50)" : ""}`}</Text>
                          <Flex gap={6} flexWrap="wrap">
                            {list.names!.map((n, k) => (
                              <Chip key={k} size="condensed" color="neutral">{n}</Chip>
                            ))}
                          </Flex>
                        </Flex>
                      )}
                    </Flex>
                  )}
                  <Flex gap={8} alignItems="center" flexWrap="wrap">
                    <Button size="condensed" variant="emphasized" color="primary" onClick={() => askAssist(r)}><Button.Prefix><DynatraceIntelligenceSignetIcon /></Button.Prefix>Ask Assist how to fix</Button>
                    <Button size="condensed" onClick={() => openQuery(r)}>Open the query in a notebook</Button>
                    {act?.docUrl && <ExternalLink href={act.docUrl}>{act.docLabel || "Documentation"}</ExternalLink>}
                  </Flex>
                </Flex>
              </Accordion.SectionContent>
            </Accordion.Section>
          );
        })}
      </Accordion>
      {todo.length > 5 && <Flex flexDirection="column"><Button size="condensed" onClick={() => setAll(v => !v)}>{all ? "Show fewer" : `Show all`}</Button></Flex>}
      {note && <Text textStyle="small" style={{ color: Colors.Text.Warning.Default }}>{note}</Text>}
    </Panel>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────

interface Props {
  coverageData: CoverageData;
  history: ReturnType<typeof useAssessmentHistory>;
}

export const CapabilityDetailPage: React.FC<Props> = ({ coverageData, history }) => {
  const { name = "" } = useParams();
  const navigate = useNavigate();
  /** Tier picked in "Utilization tiers": narrows What to do and Criteria. */
  const [tier, setTier] = useState<string | null>(null);
  useEffect(() => { setTier(null); }, [name]);
  const appName = useAppNames();
  const installed = useInstalledApps();
  const caps = coverageData.capabilities;
  const idx = caps.findIndex(c => c.name === decodeURIComponent(name).replace(/~/g, "/"));
  const cap = idx >= 0 ? caps[idx] : undefined;

  const adoption = coverageData.adoption ?? NO_ADOPTION;

  const trend = useMemo(() => {
    if (!cap) return [];
    return [...history.snapshots]
      .map(s => ({ t: new Date(s.timestamp).getTime(), c: s.capabilities.find(c => c.name === cap.name) }))
      // Only runs scored with the three parts: an older coverage-only run would read as a false jump.
      .filter((p): p is { t: number; c: NonNullable<typeof p.c> } => !!p.c && p.c.coverage != null)
      .sort((a, b) => a.t - b.t)
      .slice(-20)
      .map(p => {
        const parts = [p.c.coverage, p.c.utilization, p.c.adoption].filter((x): x is number => x != null);
        return { t: p.t, v: p.c.score, lo: parts.length ? Math.min(...parts) : p.c.score, hi: parts.length ? Math.max(...parts) : p.c.score };
      });
  }, [history.snapshots, cap]);

  if (!cap) {
    return (
      <Flex alignItems="center" justifyContent="center" style={{ flex: 1, padding: 48 }}>
        <EmptyState>
          <EmptyState.VisualPreset context="generic" type="something-missing" />
          <EmptyState.Title>No assessment in this session</EmptyState.Title>
          <EmptyState.Actions><Button variant="emphasized" onClick={() => navigate("/")}>Go to assessment</Button></EmptyState.Actions>
        </EmptyState>
      </Flex>
    );
  }

  const band = scoreBand(cap.score);
  const rows = tier ? cap.criteriaResults.filter(r => r.tier === tier) : cap.criteriaResults;
  const tierLabel = TIERS.find(t => t.key === tier)?.label;
  const clearTier = tierLabel ? <Chip color="primary" size="condensed">{tierLabel}<Chip.DeleteButton aria-label={`Clear the ${tierLabel} filter`} onClick={() => setTier(null)} /></Chip> : null;
  const u = cap.utilization;
  const adoptionRan = !adoption.unavailable && !adoption.loading;
  const ad = adoption.byCapability[cap.name];
  const dx = diagnose({
    coverage: cap.coverageScore ?? cap.score,
    utilization: cap.effectiveUtilizationScore,
    users: adoptionRan ? (ad?.users ?? 0) : undefined,
    rate: adoptionRan ? (ad?.rate ?? 0) : undefined,
    totalUsers: adoption.totalUsers,
    windowDays: adoption.windowDays,
    notAssessedCount: cap.notAssessedCount,
    totalCount: cap.criteriaResults.length,
  });
  const prev = caps[(idx - 1 + caps.length) % caps.length];
  const next = caps[(idx + 1) % caps.length];
  const go = (c: CapabilityResult) => navigate(`/capability/${encodeURIComponent(c.name.replace(/\//g, "~"))}`);
  // Related apps: the capability's own, the cross-cutting ones that also serve
  // it, and the installed ones nobody opened.
  const serves = (id: string) => capabilityForApp(id) === cap.name || sharedCapabilitiesForApp(id).includes(cap.name);
  const usedApps = adoption.apps.filter(a => serves(a.appId)).sort((x, y) => y.users - x.users);
  const usedIds = new Set(usedApps.map(a => a.appId));
  const unusedApps = installed
    .filter(id => !usedIds.has(id) && id.startsWith("dynatrace.") && serves(id))
    .map(id => ({ appId: id, users: 0, queries: 0, capability: cap.name }));
  const apps = [...usedApps, ...unusedApps].slice(0, 14);
  const topShare = adoption.totalUsers > 0 && apps.length > 0 ? Math.floor((apps[0].users / adoption.totalUsers) * 1000) / 10 : 0;

  return (
    <Flex flexDirection="column" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      {/* Toolbar */}
      <Flex alignItems="center" gap={8} flexWrap="wrap" style={{ padding: "6px 16px", borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
        <Breadcrumbs>
          <Breadcrumbs.Item href="/" onClick={(e: React.MouseEvent) => { e.preventDefault(); navigate("/"); }}>Overview</Breadcrumbs.Item>
          <Breadcrumbs.Item>{cap.name}</Breadcrumbs.Item>
        </Breadcrumbs>
        <Button size="condensed" onClick={() => go(prev)} aria-label={`Previous: ${prev.name}`}><Button.Prefix><ChevronLeftIcon /></Button.Prefix></Button>
        <Button size="condensed" onClick={() => go(next)} aria-label={`Next: ${next.name}`}><Button.Prefix><ChevronRightIcon /></Button.Prefix></Button>
        <Text textStyle="small" style={{ marginLeft: "auto", color: NEUTRAL }}>
          {coverageData.tenant} · {coverageData.date}
        </Text>
      </Flex>

      <IntelligenceBar
        key={cap.name}
        questions={capabilityQuestions(cap.name)}
        ctx={{
          tenant: coverageData.tenant, date: coverageData.date, overallCoverage: coverageData.totalScore, overallUtilization: coverageData.overallUtilizationLevel, capabilities: [cap],
          lens: LENS.capability,
          pageNote: capabilityFacts(cap, adoption, apps.map(a => ({ name: appName(a.appId), users: a.users }))),
        }}
      />

      <Flex flexDirection="column" gap={16} style={{ padding: "16px 20px 32px" }}>
        {/* Title */}
        <Flex alignItems="center" gap={12} flexWrap="wrap">
          <Flex style={{ display: "inline-flex", width: 12, height: 12, borderRadius: "50%", background: cap.color, flexShrink: 0 }} />
          <Heading level={2}>{cap.name}</Heading>
          <Text style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: band.token }}>{cap.score}%</Text>
          <Text textStyle="base-emphasized" style={{ color: band.token }}>{band.label}</Text>
          <VerdictChip id={dx.id} label={dx.label} meaning={dx.meaning} />
        </Flex>

        {/* Summary: the three readings, each as a Strato chart */}
        <Grid style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <Panel title="Score">
            <GaugeChart value={cap.score} min={0} max={100} formatter={pctFormat} height={150} showThresholdIndicators>
              {BAND_THRESHOLDS.map(t => <GaugeChart.ThresholdIndicator key={t.value} value={t.value} color={t.color} />)}
            </GaugeChart>
          </Panel>

          <Panel title="What makes the score" right={<InformationOverlay aria-label="How the score is built"><InformationOverlay.Content>{`The score is the average of three equal parts. Adoption counts as 100 when ${ADOPTION_FULL_RATE}% of active users open the capability's apps.`}</InformationOverlay.Content></InformationOverlay>}>
            <Flex flexDirection="column" gap={12}>
              <TierMeter label="Coverage" pct={cap.coverageScore ?? cap.score} />
              <TierMeter label="Utilization" pct={cap.effectiveUtilizationScore} />
              {cap.adoptionScore != null
                ? <Tooltip text={`${ad?.rate ?? 0}% of active users · ${(ad?.users ?? 0).toLocaleString()} people in ${adoption.windowDays} days`} containerStyle={{ display: "block" }}><Flex flexDirection="column"><TierMeter label="Adoption" pct={cap.adoptionScore} /></Flex></Tooltip>
                : <Text textStyle="small" style={{ color: NEUTRAL }}>Adoption not available</Text>}
            </Flex>
          </Panel>

          <Panel title="Utilization tiers" right={<InformationOverlay aria-label="About utilization tiers"><InformationOverlay.Content>Criteria met in each tier, weighted 60 / 25 / 15. Select a tier to filter the page.</InformationOverlay.Content></InformationOverlay>}>
            <Flex flexDirection="column" gap={12}>
              <Flex>
              <Flex style={{ maxWidth: "100%", overflowX: "auto" }}><ToggleButtonGroup value={tier ?? "all"} onChange={(v: string) => setTier(v === "all" ? null : v)}>
                <ToggleButtonGroup.Item value="all">All</ToggleButtonGroup.Item>
                {TIERS.map(t => <ToggleButtonGroup.Item key={t.key} value={t.key}>{t.label}</ToggleButtonGroup.Item>)}
              </ToggleButtonGroup></Flex>
              </Flex>
              {TIERS.map(t => {
                const tr = u[t.key];
                return <TierMeter key={t.key} label={t.label} pct={tr.total > 0 ? (tr.passed / tr.total) * 100 : 0} />;
              })}
            </Flex>
          </Panel>
        </Grid>

        {/* What to do: every unmet criterion as an action, highest score gain first */}
        <ActionList cap={cap} ctx={{ tenant: coverageData.tenant, date: coverageData.date, overallCoverage: coverageData.totalScore, overallUtilization: coverageData.overallUtilizationLevel, capabilities: [cap] }} tier={tier} />

        {/* Criteria and history */}
        {/* Two panels that share the row and stack when it gets narrow. */}
        <Flex style={{ flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <Panel title="Criteria" style={{ flex: "1.7 1 420px" }} right={<Flex alignItems="center" gap={12}>{clearTier}<StateMark state="pass" label /><StateMark state="fail" label /><StateMark state="na" label /></Flex>}>
            <CriteriaChart rows={rows} totalUsers={adoptionRan ? adoption.totalUsers : undefined} />
          </Panel>

          <Flex flexDirection="column" gap={16} style={{ flex: "1 1 300px", minWidth: 0 }}>
            <Panel title="Score over time">
              <TrendChart points={trend} name={cap.name} color={cap.color} />
            </Panel>
          </Flex>
        </Flex>

        {/* Full width: a spanning item inside the auto-fit grid above kept empty tracks open */}
        <Panel title="Related apps" right={adoptionRan ? <Text textStyle="small" style={{ color: NEUTRAL }}>Share of active users · {adoption.windowDays} days</Text> : undefined}>
          {adoption.loading ? <SkeletonText lines={3} />
            : apps.length === 0 ? <Text textStyle="small" style={{ color: NEUTRAL }}>No related apps installed</Text>
            : (
              <Flex flexDirection="column" gap={20}>
                {/* Mix: how the capability's query activity splits across its apps */}
                {usedApps.length > 0 && (() => {
                  const byQueries = [...usedApps].sort((x, y) => y.queries - x.queries);
                  const top = byQueries.slice(0, 7);
                  const rest = byQueries.slice(7).reduce((t, a) => t + a.queries, 0);
                  const total = byQueries.reduce((t, a) => t + a.queries, 0);
                  return (
                    <MultiMeterBarChart min={0} max={total} size="size16" formatter={(v: number) => v.toLocaleString()}>
                      <MultiMeterBarChart.Label>Queries by app</MultiMeterBarChart.Label>
                      <MultiMeterBarChart.Value>{`${total.toLocaleString()} queries`}</MultiMeterBarChart.Value>
                      {top.map(a => <MultiMeterBarChart.Segment key={a.appId} name={appName(a.appId)} value={a.queries} />)}
                      {rest > 0 && <MultiMeterBarChart.Segment name="Other apps" value={rest} />}
                      <MultiMeterBarChart.Legend />
                    </MultiMeterBarChart>
                  );
                })()}
                {/* Reach: share of active users per app, with people and queries always visible */}
                <Grid style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px 28px" }}>
                  {apps.map(a => {
                    const share = adoption.totalUsers > 0 ? Math.floor((a.users / adoption.totalUsers) * 1000) / 10 : 0;
                    return (
                      <Flex key={a.appId} flexDirection="column" gap={4} style={{ minWidth: 0 }}>
                        <MeterBarChart value={share} min={0} max={100} color={a.users > 0 ? cap.color : NEUTRAL} size="size8" formatter={pctFormat}>
                          <MeterBarChart.Label>{appName(a.appId)}{capabilityForApp(a.appId) !== cap.name ? " · shared" : ""}</MeterBarChart.Label>
                          <MeterBarChart.Value>{a.users > 0 ? pctFormat(share) : "No usage data"}</MeterBarChart.Value>
                        </MeterBarChart>
                        <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>
                          {a.users > 0 ? `${a.users.toLocaleString()} ${a.users === 1 ? "person" : "people"} · ${a.queries.toLocaleString()} ${a.queries === 1 ? "query" : "queries"}` : `no queries in ${adoption.windowDays} days`}
                        </Text>
                      </Flex>
                    );
                  })}
                </Grid>
              </Flex>
            )}
        </Panel>


      </Flex>
    </Flex>
  );
};
