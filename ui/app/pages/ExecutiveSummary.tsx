// ui/app/pages/ExecutiveSummary.tsx
//
// The whole assessment on one page, built like a capability's detail page so
// the two read the same way: the score and what makes it, the utilization
// tiers (click one to filter), every capability with its three parts, the
// actions that move the overall score most, the score over time and the apps
// people actually open. Labels and numbers only; explanations sit in tooltips.

import { ToggleButtonGroup } from "@dynatrace/strato-components/forms";
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Typography from "@dynatrace/strato-design-tokens/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { Heading, Link, Text } from "@dynatrace/strato-components/typography";
import { Chip, InformationOverlay, SkeletonText } from "@dynatrace/strato-components/content";
import { DataTable } from "@dynatrace/strato-components/tables";
import { Flex, Grid } from "@dynatrace/strato-components/layouts";
import { GaugeChart, MeterBarChart } from "@dynatrace/strato-components/charts";
import type { CapabilityResult } from "../hooks/useCoverageData";
import type { useAssessmentHistory } from "../hooks/useAssessmentHistory";
import type { UseAppAdoptionResult } from "../hooks/useAppAdoption";
import { Tooltip } from "../components/Tooltip";
import { diagnose } from "../diagnosis";
import { passLine } from "../passLine";
import { useAppNames } from "../hooks/useAppNames";
import { ADOPTION_FULL_RATE, gainIfMet } from "../pulseScore";
import { scoreBand } from "../utils/colors";
import { CRITERION_ACTIONS } from "../remediationActions";
import { BAND_THRESHOLDS, Panel, StateMark, TIERS, TierMeter, TrendChart, VerdictChip, pctFormat } from "./CapabilityDetailPage";
import type { TierKey } from "./CapabilityDetailPage";

const MONO = Typography.Code.Small.Default.Family;
const FAIL = Colors.Charts.Status.Critical.Default;
const PASS = Colors.Charts.Status.Ideal.Default;
const NEUTRAL = Colors.Text.Neutral.Subdued;
const INK = Colors.Text.Neutral.Default;
const LINE = Colors.Border.Neutral.Default;

type Row = CapabilityResult["criteriaResults"][number];

const avg = (xs: number[]) => (xs.length ? Math.floor(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const isFail = (r: Row) => !r.notAssessed && !r.error && r.points <= 0;
const cleanName = (r: Row) => r.label.replace(/\s*\(%\)\s*$/, "");

function reading(r: Row): string {
  if (r.count != null) return `${r.count.toLocaleString()} → ≥1`;
  const nums = (r.thresholds.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const floor = nums.length ? passLine(nums) : null;
  const v = r.isRatio ? `${Math.floor(r.value * 10) / 10}%` : r.value.toLocaleString();
  return floor == null ? v : `${v} → ${floor}${r.isRatio ? "%" : ""}`;
}

interface Props {
  capabilities: CapabilityResult[];
  totalScore: number;
  history: ReturnType<typeof useAssessmentHistory>;
  adoption: UseAppAdoptionResult;
}

export const ExecutiveSummary: React.FC<Props> = ({ capabilities, totalScore, history, adoption }) => {
  const navigate = useNavigate();
  const appName = useAppNames();
  /** Tier picked in "Utilization tiers": narrows Capabilities and What to do. */
  const [tier, setTier] = useState<TierKey | null>(null);
  const open = (c: CapabilityResult) => navigate(`/capability/${encodeURIComponent(c.name.replace(/\//g, "~"))}`);

  const band = scoreBand(totalScore);
  const adoptionRan = !adoption.unavailable && !adoption.loading;
  const coverage = avg(capabilities.map(c => c.coverageScore ?? c.score));
  const utilization = avg(capabilities.map(c => c.effectiveUtilizationScore));
  const adopted = capabilities.map(c => c.adoptionScore).filter((x): x is number => x != null);
  const tierPct = (c: CapabilityResult, k: TierKey) => (c.utilization[k].total > 0 ? (c.utilization[k].passed / c.utilization[k].total) * 100 : 0);
  const tierAll = (k: TierKey) => {
    const p = capabilities.reduce((t, c) => t + c.utilization[k].passed, 0);
    const n = capabilities.reduce((t, c) => t + c.utilization[k].total, 0);
    return n > 0 ? (p / n) * 100 : 0;
  };
  const tierLabel = TIERS.find(t => t.key === tier)?.label;
  const clearTier = tierLabel ? <Chip color="primary" size="condensed">{tierLabel}<Chip.DeleteButton aria-label={`Clear the ${tierLabel} filter`} onClick={() => setTier(null)} /></Chip> : null;

  // Lowest first: the page leads with what needs a decision.
  const ranked = useMemo(() => [...capabilities].sort((a, b) =>
    tier ? tierPct(a, tier) - tierPct(b, tier) : a.score - b.score), [capabilities, tier]);

  // Every unmet criterion, by what it adds to the OVERALL score.
  const todo = useMemo(() => capabilities.flatMap(c => c.criteriaResults
    .filter(r => isFail(r) && (!tier || r.tier === tier))
    .map(r => ({ c, r, gain: Math.round((gainIfMet(c, r.tier) / capabilities.length) * 10) / 10 })))
    .sort((a, b) => b.gain - a.gain), [capabilities, tier]);
  type Todo = (typeof todo)[number];
  const todoColumns = [
    { id: "state", header: "State", width: 110, accessor: () => "Not met", cell: () => <DataTable.DefaultCell><StateMark state="fail" label /></DataTable.DefaultCell> },
    { id: "criterion", header: "Criterion", minWidth: 160, autoWidth: true, accessor: (t: Todo) => cleanName(t.r), cell: ({ rowData }: { rowData: Todo }) => (
      <DataTable.DefaultCell><Tooltip text={CRITERION_ACTIONS[rowData.r.id]?.action ?? rowData.r.description}><Text>{cleanName(rowData.r)}</Text></Tooltip></DataTable.DefaultCell>
    ) },
    { id: "capability", header: "Capability", minWidth: 150, autoWidth: true, accessor: (t: Todo) => t.c.name, cell: ({ rowData }: { rowData: Todo }) => (
      <DataTable.DefaultCell><Link onClick={() => open(rowData.c)}>{rowData.c.name}</Link></DataTable.DefaultCell>
    ) },
    { id: "reading", header: "Value and target", width: 170, accessor: (t: Todo) => reading(t.r) },
    { id: "gain", header: "Gain (pts)", width: 110, alignment: "right" as const, accessor: (t: Todo) => t.gain },
  ];

  // Only runs saved with the three-part score are comparable with today's.
  const trend = useMemo(() => [...history.snapshots]
    .filter(s => s.capabilities.some(c => c.coverage != null))
    .map(s => {
      const part = (k: "coverage" | "utilization" | "adoption") => {
        const xs = s.capabilities.map(c => c[k]).filter((x): x is number => x != null);
        return xs.length ? avg(xs) : null;
      };
      const parts = [part("coverage"), part("utilization"), part("adoption")].filter((x): x is number => x != null);
      return { t: new Date(s.timestamp).getTime(), v: s.totalScore, lo: parts.length ? Math.min(...parts) : s.totalScore, hi: parts.length ? Math.max(...parts) : s.totalScore };
    })
    .sort((a, b) => a.t - b.t).slice(-20), [history.snapshots]);

  const topApps = adoption.apps.slice(0, 9);

  return (
    <Flex flexDirection="column" gap={16} style={{ flex: 1, minWidth: 0, alignSelf: "flex-start", padding: "16px 20px 32px" }}>
      <Flex alignItems="center" gap={12} flexWrap="wrap">
        <Heading level={2}>Overall score</Heading>
        <Text style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: band.token }}>{totalScore}%</Text>
        <Text textStyle="base-emphasized" style={{ color: band.token }}>{band.label}</Text>
      </Flex>

      <Grid style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <Panel title="Score">
          <GaugeChart value={totalScore} min={0} max={100} formatter={pctFormat} height={150} showThresholdIndicators>
            {BAND_THRESHOLDS.map(t => <GaugeChart.ThresholdIndicator key={t.value} value={t.value} color={t.color} />)}
          </GaugeChart>
        </Panel>

        <Panel title="What makes the score" right={<InformationOverlay aria-label="How the score is built"><InformationOverlay.Content>{`Average of the capabilities. Each capability is equal parts coverage, utilization and adoption; adoption counts as 100 when ${ADOPTION_FULL_RATE}% of active users open its apps.`}</InformationOverlay.Content></InformationOverlay>}>
          <Flex flexDirection="column" gap={12}>
            <TierMeter label="Coverage" pct={coverage} />
            <TierMeter label="Utilization" pct={utilization} />
            {adopted.length > 0
              ? <TierMeter label="Adoption" pct={avg(adopted)} />
              : <Text textStyle="small" style={{ color: NEUTRAL }}>Adoption not available</Text>}
          </Flex>
        </Panel>

        <Panel title="Utilization tiers" right={<InformationOverlay aria-label="About utilization tiers"><InformationOverlay.Content>Criteria met in each tier, across all capabilities. Select a tier to filter the page.</InformationOverlay.Content></InformationOverlay>}>
          <Flex flexDirection="column" gap={12}>
            <Flex>
            <ToggleButtonGroup value={tier ?? "all"} onChange={(v: string) => setTier(v === "all" ? null : (v as TierKey))}>
              <ToggleButtonGroup.Item value="all">All</ToggleButtonGroup.Item>
              {TIERS.map(t => <ToggleButtonGroup.Item key={t.key} value={t.key}>{t.label}</ToggleButtonGroup.Item>)}
            </ToggleButtonGroup>
            </Flex>
            {TIERS.map(t => <TierMeter key={t.key} label={t.label} pct={tierAll(t.key)} />)}
          </Flex>
        </Panel>
      </Grid>

      <Panel title="Capabilities" right={<Flex alignItems="center" gap={12}>{clearTier}<Text textStyle="small" style={{ color: NEUTRAL }}>Lowest first</Text></Flex>}>
        <Grid style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px 28px" }}>
          {ranked.map(c => {
            const ad = adoption.byCapability[c.name];
            const dx = diagnose({
              coverage: c.coverageScore ?? c.score, utilization: c.effectiveUtilizationScore,
              users: adoptionRan ? (ad?.users ?? 0) : undefined, rate: adoptionRan ? (ad?.rate ?? 0) : undefined,
              totalUsers: adoption.totalUsers, windowDays: adoption.windowDays,
              notAssessedCount: c.notAssessedCount, totalCount: c.criteriaResults.length,
            });
            const v = tier ? tierPct(c, tier) : c.score;
            return (
              <Flex key={c.name} flexDirection="column" gap={4} style={{ minWidth: 0 }}>
                <MeterBarChart value={Math.floor(v)} min={0} max={100} color={scoreBand(v).token} size="size8" formatter={pctFormat}>
                  <MeterBarChart.Label><Link onClick={() => open(c)}>{c.name}</Link></MeterBarChart.Label>
                  <MeterBarChart.Value>{pctFormat(Math.floor(v))}</MeterBarChart.Value>
                </MeterBarChart>
                <Flex alignItems="center" justifyContent="space-between" gap={8}>
                  <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>
                    {tier ? `Score ${c.score}%` : `Coverage ${Math.floor(c.coverageScore ?? c.score)}% · Utilization ${Math.floor(c.effectiveUtilizationScore)}% · Adoption ${c.adoptionScore == null ? "—" : `${Math.floor(c.adoptionScore)}%`}`}
                  </Text>
                  <VerdictChip id={dx.id} label={dx.label} meaning={dx.meaning} size="condensed" />
                </Flex>
              </Flex>
            );
          })}
        </Grid>
      </Panel>

      {todo.length > 0 && (
        <Panel title="What to do" right={<Flex alignItems="center" gap={12}>{clearTier}<Text textStyle="small" style={{ color: NEUTRAL }}>Highest gain on the overall score first</Text></Flex>}>
          <DataTable data={todo} columns={todoColumns} fullWidth sortable variant={{ rowDensity: "condensed" }}>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        </Panel>
      )}

      <Grid style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>
        <Panel title="Score over time">
          <TrendChart points={trend} name="Overall" color={Colors.Charts.Categorical.Color01.Default} />
        </Panel>

        <Panel title="Most used apps" right={adoptionRan ? <Text textStyle="small" style={{ color: NEUTRAL }}>Share of active users · {adoption.windowDays} days</Text> : undefined}>
          {adoption.loading ? <SkeletonText lines={3} />
            : topApps.length === 0 ? <Text textStyle="small" style={{ color: NEUTRAL }}>No usage data</Text>
            : (
              <Grid style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px 24px" }}>
                {topApps.map(a => {
                  const share = adoption.totalUsers > 0 ? Math.floor((a.users / adoption.totalUsers) * 1000) / 10 : 0;
                  return (
                    <Flex key={a.appId} flexDirection="column" gap={4} style={{ minWidth: 0 }}>
                      <MeterBarChart value={share} min={0} max={100} color={Colors.Charts.Categorical.Color01.Default} size="size8" formatter={pctFormat}>
                        <MeterBarChart.Label>{appName(a.appId)}</MeterBarChart.Label>
                        <MeterBarChart.Value>{pctFormat(share)}</MeterBarChart.Value>
                      </MeterBarChart>
                      <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>{a.users.toLocaleString()} people · {a.queries.toLocaleString()} queries</Text>
                    </Flex>
                  );
                })}
              </Grid>
            )}
        </Panel>
      </Grid>
    </Flex>
  );
};
