// ui/app/pages/ExecutiveSummary.tsx
//
// The whole assessment on one page, built like a capability's detail page so
// the two read the same way: the score and what makes it, the utilization
// tiers (click one to filter), every capability with its three parts, the
// actions that move the overall score most, the score over time and the apps
// people actually open. Labels and numbers only; explanations sit in tooltips.

import { ToggleButtonGroup } from "@dynatrace/strato-components/forms";
import React, { useMemo, useState } from "react";
import { usePulseNavigate } from "../kit/PulseHost";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { ArrowUpIcon, MinusIcon } from "@dynatrace/strato-icons";
import Typography from "@dynatrace/strato-design-tokens/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { Heading, Link, Text } from "@dynatrace/strato-components/typography";
import { Chip, InformationOverlay, SkeletonText } from "@dynatrace/strato-components/content";
import { DataTable } from "@dynatrace/strato-components/tables";
import { Flex, Grid } from "@dynatrace/strato-components/layouts";
import { GaugeChart, MeterBarChart } from "@dynatrace/strato-components/charts";
import type { CapabilityResult } from "../hooks/useCoverageData";
import type { useAssessmentHistory } from "../hooks/useAssessmentHistory";
import { isOfficialApp, peopleReading, type UseAppAdoptionResult } from "../hooks/useAppAdoption";
import { Tooltip } from "../components/Tooltip";
import { diagnose } from "../diagnosis";
import { passLine } from "../passLine";
import { useAppNames } from "../hooks/useAppNames";
import { ADOPTION_FULL_RATE, gainIfMet } from "../pulseScore";
import { scoreBand } from "../utils/colors";
import { CRITERION_ACTIONS } from "../remediationActions";
import { AppLink, ScoreGauge, BAND_THRESHOLDS, Panel, StateMark, TIERS, TierMeter, TrendChart, VerdictChip, pctFormat } from "./CapabilityDetailPage";
import type { TierKey } from "./CapabilityDetailPage";
import { bandWord, criterionText, localeTag, useLang, useTr, type PulseLang } from "../i18n/lang";

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

function reading(r: Row, lang: PulseLang): string {
  if (r.count != null) return `${r.count.toLocaleString(localeTag(lang))} → ≥1`;
  const nums = (r.thresholds.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const floor = nums.length ? passLine(nums) : null;
  const v = r.isRatio ? `${Math.floor(r.value * 10) / 10}%` : r.value.toLocaleString(localeTag(lang));
  return floor == null ? v : `${v} → ${floor}${r.isRatio ? "%" : ""}`;
}

interface Props {
  capabilities: CapabilityResult[];
  totalScore: number;
  history: ReturnType<typeof useAssessmentHistory>;
  adoption: UseAppAdoptionResult;
}

export const ExecutiveSummary: React.FC<Props> = ({ capabilities, totalScore, history, adoption }) => {
  const navigate = usePulseNavigate();
  const appName = useAppNames();
  const lang = useLang();
  const tr = useTr();
  /** A criterion's name and tooltip in the active language. */
  const critName = (r: Row) => cleanName({ ...r, label: criterionText(r.id, lang, { label: r.label }).label });
  const critTip = (r: Row) => {
    const t = criterionText(r.id, lang, { label: r.label, description: r.description, action: CRITERION_ACTIONS[r.id]?.action });
    return CRITERION_ACTIONS[r.id]?.action ? t.action : t.description;
  };
  /** Tier picked in "Utilization tiers": narrows Capabilities and What to do. */
  const [tier, setTier] = useState<TierKey | null>(null);
  const open = (c: CapabilityResult, section?: string) => navigate(`/capability/${encodeURIComponent(c.name.replace(/\//g, "~"))}`, section ? { state: { section } } : undefined);

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
  const clearTier = tierLabel ? <Chip color="primary" size="condensed">{tierLabel}<Chip.DeleteButton aria-label={tr(`Clear the ${tierLabel} filter`, `Limpar o filtro ${tierLabel}`, `Quitar el filtro ${tierLabel}`)} onClick={() => setTier(null)} /></Chip> : null;

  // Lowest first: the page leads with what needs a decision.
  const ranked = useMemo(() => [...capabilities].sort((a, b) =>
    tier ? tierPct(a, tier) - tierPct(b, tier) : a.score - b.score), [capabilities, tier]);

  // Every unmet criterion, by what it adds to the OVERALL score.
  const todo = useMemo(() => capabilities.flatMap(c => c.criteriaResults
    .filter(r => isFail(r) && (!tier || r.tier === tier))
    .map(r => ({ c, r, gain: Math.floor((gainIfMet(c, r.tier, r.id) / capabilities.length) * 10 + 1e-9) / 10 })))
    .sort((a, b) => b.gain - a.gain), [capabilities, tier]);
  type Todo = (typeof todo)[number];
  const raises = tr("Raises the score", "Aumenta a pontuação", "Aumenta la puntuación");
  const noEffect = tr("No effect on the score", "Sem efeito na pontuação", "Sin efecto en la puntuación");
  const todoColumns = [
    { id: "state", header: tr("State", "Estado", "Estado"), width: 110, accessor: () => tr("Not met", "Não atendido", "No cumplido"), cell: () => <DataTable.DefaultCell><StateMark state="fail" label /></DataTable.DefaultCell> },
    { id: "criterion", header: tr("Criterion", "Critério", "Criterio"), minWidth: 160, autoWidth: true, accessor: (t: Todo) => critName(t.r), cell: ({ rowData }: { rowData: Todo }) => (
      <DataTable.DefaultCell><Tooltip text={critTip(rowData.r)}><Text>{critName(rowData.r)}</Text></Tooltip></DataTable.DefaultCell>
    ) },
    { id: "capability", header: tr("Capability", "Capacidade", "Capacidad"), minWidth: 150, autoWidth: true, accessor: (t: Todo) => t.c.name, cell: ({ rowData }: { rowData: Todo }) => (
      <DataTable.DefaultCell><Link onClick={() => open(rowData.c)}>{rowData.c.name}</Link></DataTable.DefaultCell>
    ) },
    { id: "reading", header: tr("Value and target", "Valor e meta", "Valor y objetivo"), width: 170, accessor: (t: Todo) => reading(t.r, lang) },
    { id: "gain", header: tr("Gain", "Ganho", "Ganancia"), width: 80, alignment: "right" as const, disableSorting: true, accessor: (t: Todo) => (t.gain > 0 ? raises : noEffect), cell: ({ rowData }: { rowData: Todo }) => (
      <DataTable.DefaultCell>
        <Flex justifyContent="flex-end" role="img" aria-label={rowData.gain > 0 ? raises : noEffect} title={rowData.gain > 0 ? raises : noEffect}
          style={{ color: rowData.gain > 0 ? Colors.Charts.Status.Ideal.Default : Colors.Text.Neutral.Subdued }}>
          {rowData.gain > 0 ? <ArrowUpIcon size="small" /> : <MinusIcon size="small" />}
        </Flex>
      </DataTable.DefaultCell>
    ) },
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

  const topApps = adoption.apps.filter(a => isOfficialApp(a.appId)).slice(0, 9);

  return (
    <Flex flexDirection="column" gap={16} style={{ flex: 1, minWidth: 0, width: "100%", boxSizing: "border-box", alignSelf: "flex-start", padding: "16px 20px 32px" }}>
      <Flex alignItems="center" gap={12} flexWrap="wrap">
        <Heading level={2}>{tr("Overall score", "Pontuação geral", "Puntuación general")}</Heading>
        <Text style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: band.text }}>{totalScore}%</Text>
        <Text textStyle="base-emphasized" style={{ color: band.text }}>{bandWord(band.label, lang)}</Text>
      </Flex>

      <Grid style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <Panel title={tr("Score", "Pontuação", "Puntuación")}>
          <ScoreGauge value={totalScore} />
        </Panel>

        <Panel title={tr("What makes the score", "O que compõe a pontuação", "Qué compone la puntuación")} right={<InformationOverlay aria-label={tr("How the score is built", "Como a pontuação é calculada", "Cómo se calcula la puntuación")}><InformationOverlay.Content>{tr(
          `Average of the capabilities. Each capability is equal parts coverage, utilization and adoption; adoption counts as 100 when ${ADOPTION_FULL_RATE}% of active users open its apps.`,
          `Média das capacidades. Cada capacidade soma partes iguais de cobertura, utilização e adoção; a adoção conta como 100 quando ${ADOPTION_FULL_RATE}% dos usuários ativos abrem seus apps.`,
          `Promedio de las capacidades. Cada capacidad suma partes iguales de cobertura, utilización y adopción; la adopción cuenta como 100 cuando el ${ADOPTION_FULL_RATE}% de los usuarios activos abre sus apps.`,
        )}</InformationOverlay.Content></InformationOverlay>}>
          <Flex flexDirection="column" gap={12}>
            <TierMeter label={tr("Coverage", "Cobertura", "Cobertura")} pct={coverage} />
            <TierMeter label={tr("Utilization", "Utilização", "Utilización")} pct={utilization} />
            {adopted.length > 0
              ? <TierMeter label={tr("Adoption", "Adoção", "Adopción")} pct={avg(adopted)} />
              : <Text textStyle="small" style={{ color: NEUTRAL }}>{tr("Adoption not available", "Adoção indisponível", "Adopción no disponible")}</Text>}
          </Flex>
        </Panel>

        <Panel title={tr("Utilization tiers", "Níveis de utilização", "Niveles de utilización")} right={<InformationOverlay aria-label={tr("About utilization tiers", "Sobre os níveis de utilização", "Acerca de los niveles de utilización")}><InformationOverlay.Content>{tr(
          "Criteria met in each tier, across all capabilities. Select a tier to filter the page.",
          "Critérios atendidos em cada nível, em todas as capacidades. Selecione um nível para filtrar a página.",
          "Criterios cumplidos en cada nivel, en todas las capacidades. Seleccione un nivel para filtrar la página.",
        )}</InformationOverlay.Content></InformationOverlay>}>
          <Flex flexDirection="column" gap={12}>
            <Flex>
            <Flex style={{ maxWidth: "100%", overflowX: "auto" }}><ToggleButtonGroup value={tier ?? "all"} onChange={(v: string) => setTier(v === "all" ? null : (v as TierKey))}>
              <ToggleButtonGroup.Item value="all">{tr("All", "Todos", "Todos")}</ToggleButtonGroup.Item>
              {TIERS.map(t => <ToggleButtonGroup.Item key={t.key} value={t.key}>{t.label}</ToggleButtonGroup.Item>)}
            </ToggleButtonGroup></Flex>
            </Flex>
            {TIERS.map(t => <TierMeter key={t.key} label={t.label} pct={tierAll(t.key)} />)}
          </Flex>
        </Panel>
      </Grid>

      <Panel title={tr("Capabilities", "Capacidades", "Capacidades")} right={<Flex alignItems="center" gap={12}>{clearTier}<Text textStyle="small" style={{ color: NEUTRAL }}>{tr("Lowest first", "Menores primeiro", "Menores primero")}</Text></Flex>}>
        <Grid style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px 28px" }}>
          {ranked.map(c => {
            const ad = adoption.byCapability[c.name];
            const dx = diagnose({
              coverage: c.coverageScore ?? c.score, utilization: c.effectiveUtilizationScore,
              users: adoptionRan ? (ad?.users ?? 0) : undefined, rate: adoptionRan ? (ad?.rate ?? 0) : undefined,
              totalUsers: adoption.totalUsers, windowDays: adoption.windowDays,
              notAssessedCount: c.notAssessedCount, totalCount: c.criteriaResults.length,
            }, undefined, lang);
            const v = tier ? tierPct(c, tier) : c.score;
            return (
              <Flex key={c.name} flexDirection="column" gap={4} style={{ minWidth: 0 }}>
                <MeterBarChart value={Math.floor(v)} min={0} max={100} color={scoreBand(v).token} size="size8" formatter={pctFormat}>
                  <MeterBarChart.Label><Link onClick={() => open(c)}>{c.name}</Link></MeterBarChart.Label>
                  <MeterBarChart.Value>{pctFormat(Math.floor(v))}</MeterBarChart.Value>
                </MeterBarChart>
                <Flex alignItems="center" justifyContent="space-between" gap={8}>
                  <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>
                    {tier ? tr(`Score ${c.score}%`, `Pontuação ${c.score}%`, `Puntuación ${c.score}%`) : (() => {
                      const cv = Math.floor(c.coverageScore ?? c.score), ut = Math.floor(c.effectiveUtilizationScore);
                      const ad = c.adoptionScore == null ? "—" : `${Math.floor(c.adoptionScore)}%`;
                      return tr(`Coverage ${cv}% · Utilization ${ut}% · Adoption ${ad}`, `Cobertura ${cv}% · Utilização ${ut}% · Adoção ${ad}`, `Cobertura ${cv}% · Utilización ${ut}% · Adopción ${ad}`);
                    })()}
                  </Text>
                  <VerdictChip id={dx.id} label={dx.label} meaning={dx.meaning} size="condensed" onClick={() => open(c, "related-apps")} />
                </Flex>
              </Flex>
            );
          })}
        </Grid>
      </Panel>

      {todo.length > 0 && (
        <Panel title={tr("What to do", "O que fazer", "Qué hacer")} right={<Flex alignItems="center" gap={12}>{clearTier}<Text textStyle="small" style={{ color: NEUTRAL }}>{tr("Highest gain on the overall score first", "Maior ganho na pontuação geral primeiro", "Mayor ganancia en la puntuación general primero")}</Text></Flex>}>
          <DataTable data={todo} columns={todoColumns} fullWidth sortable defaultLineWrap variant={{ rowDensity: "condensed" }}>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        </Panel>
      )}

      <Grid style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>
        <Panel title={tr("Score over time", "Pontuação ao longo do tempo", "Puntuación a lo largo del tiempo")}>
          <TrendChart points={trend} name={tr("Overall", "Geral", "General")} color={Colors.Charts.Categorical.Color01.Default} />
        </Panel>

        <Panel title={tr("Most used apps", "Apps mais usados", "Apps más usadas")} right={adoptionRan ? (
            <Tooltip text={tr(
              `Customer users only. Dynatrace users (SE, partner, support) are counted apart: ${adoption.dynatraceUsers.toLocaleString()}.`,
              `Só usuários do cliente. Usuários Dynatrace (SE, parceiro, suporte) contados à parte: ${adoption.dynatraceUsers.toLocaleString()}.`,
              `Solo usuarios del cliente. Usuarios de Dynatrace (SE, socio, soporte) contados aparte: ${adoption.dynatraceUsers.toLocaleString()}.`,
            )}>
              <Text textStyle="small" style={{ color: NEUTRAL }}>{tr(`Share of ${adoption.totalUsers.toLocaleString()} users · ${adoption.windowDays} days`, `Parcela de ${adoption.totalUsers.toLocaleString()} usuários · ${adoption.windowDays} dias`, `Proporción de ${adoption.totalUsers.toLocaleString()} usuarios · ${adoption.windowDays} días`)}</Text>
            </Tooltip>
          ) : undefined}>
          {adoption.loading ? <SkeletonText lines={3} />
            : topApps.length === 0 ? <Text textStyle="small" style={{ color: NEUTRAL }}>{tr("No usage data", "Sem dados de uso", "Sin datos de uso")}</Text>
            : (
              <Grid style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px 24px" }}>
                {topApps.map(a => {
                  const share = adoption.totalUsers > 0 ? Math.floor((a.users / adoption.totalUsers) * 1000) / 10 : 0;
                  return (
                    <Flex key={a.appId} flexDirection="column" gap={4} style={{ minWidth: 0 }}>
                      <MeterBarChart value={share} min={0} max={100} color={Colors.Charts.Categorical.Color01.Default} size="size8" formatter={pctFormat}>
                        <MeterBarChart.Label><AppLink appId={a.appId}>{appName(a.appId)}</AppLink></MeterBarChart.Label>
                        <MeterBarChart.Value>{pctFormat(share)}</MeterBarChart.Value>
                      </MeterBarChart>
                      <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>{peopleReading(a)}</Text>
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
