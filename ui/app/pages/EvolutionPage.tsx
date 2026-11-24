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
import { usePulseNavigate } from "../kit/PulseHost";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Typography from "@dynatrace/strato-design-tokens/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { Heading, Link, Text } from "@dynatrace/strato-components/typography";
import { Accordion, Chip, EmptyState } from "@dynatrace/strato-components/content";
import { PulseLoader } from "../components/PulseLoader";
import { DataTable } from "@dynatrace/strato-components/tables";
import { Flex, Grid } from "@dynatrace/strato-components/layouts";
import { ToggleButtonGroup } from "@dynatrace/strato-components/forms";
import { MeterBarChart } from "@dynatrace/strato-components/charts";
import type { AssessmentSnapshot } from "../hooks/useAssessmentHistory";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "@dynatrace/strato-icons";
import { Tooltip } from "../components/Tooltip";
import { scoreBand } from "../utils/colors";
import { CAPABILITIES } from "../queries";
import { CRITERION_ACTIONS } from "../remediationActions";
import { Panel, StateMark, TrendChart, pctFormat } from "./CapabilityDetailPage";
import { IntelligenceBar } from "../components/IntelligenceBar";
import { LENS, LENS_BASELINE, QUESTIONS, QUESTIONS_BASELINE, baselineFacts, evolutionFacts } from "../ai/pageIntelligence";
import { passLine } from "../passLine";
import { telemetryLabel } from "../telemetry";
import { criterionText, localeTag, tr as trL, useLang, useTr, type PulseLang } from "../i18n/lang";

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
const reading = (r: SnapRow | undefined, lang: PulseLang) => {
  const st = stateOf(r);
  const word = st === "pass" ? trL(lang, "Met", "Atendido", "Cumplido") : st === "fail" ? trL(lang, "Not met", "Não atendido", "No cumplido") : trL(lang, "Not assessed", "Não avaliado", "No evaluado");
  return r && st !== "na" && IS_RATIO[r.id] ? `${word} · ${fmtValue(r, lang)}` : word;
};

const avg = (xs: number[]) => (xs.length ? Math.floor(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const stateOf = (r?: SnapRow): State => (!r || r.notAssessed || r.error ? "na" : r.points > 0 ? "pass" : "fail");
/** A capability's colour from the current catalog: saved runs keep the colour
 *  of the version that wrote them, which may have since changed. */
const CAP_COLORS = new Map(CAPABILITIES.map(c => [c.name, c.color]));
const catalogColor = (name: string, saved?: string) => CAP_COLORS.get(name) ?? saved ?? "";
const cleanName = (label: string) => label.replace(/\s*\(%\)\s*$/, "");
/** A criterion's name in the language, without the "(%)" suffix. */
const critName = (r: SnapRow, lang: PulseLang) => cleanName(criterionText(r.id, lang, { label: r.label }).label);
/** A criterion's action in the language, when the catalog has one. */
const critAction = (id: string, lang: PulseLang) => {
  const a = CRITERION_ACTIONS[id]?.action;
  return a ? criterionText(id, lang, { label: "", action: a }).action : undefined;
};
const fmtRun = (iso: string, lang: PulseLang) => new Date(iso).toLocaleString(localeTag(lang), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtValue = (r: SnapRow | undefined, lang: PulseLang) => (stateOf(r) === "na" ? "—" : IS_RATIO[r!.id] ? `${Math.floor(r!.value * 10) / 10}%` : r!.value.toLocaleString(localeTag(lang)));

function part(s: AssessmentSnapshot, k: "coverage" | "utilization" | "adoption"): number | null {
  const xs = s.capabilities.map(c => c[k]).filter((x): x is number => x != null);
  return xs.length ? avg(xs) : null;
}

/** The direction of a change, as a Strato icon: up is a gain, down a loss,
 *  a dash no change. No number: the readings beside it carry the values. */
const Delta: React.FC<{ d: number | null; size?: number }> = ({ d }) => {
  const tr = useTr();
  if (d == null) return null;
  const r = Math.round(d);
  const color = r > 0 ? PASS : r < 0 ? FAIL : NEUTRAL;
  const label = r > 0 ? tr("Gain", "Ganho", "Ganancia") : r < 0 ? tr("Loss", "Perda", "Pérdida") : tr("No change", "Sem mudança", "Sin cambio");
  return (
    <Flex alignItems="center" role="img" aria-label={label} title={label} style={{ color, flexShrink: 0 }}>
      {r > 0 ? <ArrowUpIcon size="small" /> : r < 0 ? <ArrowDownIcon size="small" /> : <MinusIcon size="small" />}
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
const sinceLabel = (v: Since, lang: PulseLang) =>
  v === "Last change" ? trL(lang, "Last change", "Última mudança", "Último cambio")
  : v === "30 days" ? trL(lang, "30 days", "30 dias", "30 días")
  : v === "90 days" ? trL(lang, "90 days", "90 dias", "90 días")
  : trL(lang, "First run", "Primeira execução", "Primera ejecución");

type CauseKind = "lost" | "gained" | "new" | "removed" | "unassessed" | "assessed";
const CAUSE_ORDER: CauseKind[] = ["lost", "gained", "new", "removed", "unassessed", "assessed"];
const CAUSE_CHIP: Record<CauseKind, { label: [string, string, string]; color: "neutral" | "primary" | "success" | "warning" | "critical" }> = {
  lost: { label: ["Lost", "Perdido", "Perdido"], color: "critical" },
  gained: { label: ["Gained", "Conquistado", "Logrado"], color: "success" },
  new: { label: ["New criterion", "Critério novo", "Criterio nuevo"], color: "primary" },
  removed: { label: ["Removed criterion", "Critério removido", "Criterio eliminado"], color: "neutral" },
  unassessed: { label: ["No longer assessed", "Não é mais avaliado", "Ya no se evalúa"], color: "warning" },
  assessed: { label: ["Now assessed", "Agora avaliado", "Ahora se evalúa"], color: "primary" },
};
const PART_LABEL = {
  coverage: ["Coverage", "Cobertura", "Cobertura"],
  utilization: ["Utilization", "Utilização", "Utilización"],
  adoption: ["Adoption", "Adoção", "Adopción"],
} as const;
const partLabel = (k: keyof typeof PART_LABEL, lang: PulseLang) => trL(lang, PART_LABEL[k][0], PART_LABEL[k][1], PART_LABEL[k][2]);

interface Props {
  snapshots: AssessmentSnapshot[];
  loading?: boolean;
  /** A run is in flight: its result is about to join the history. */
  assessing?: boolean;
}

export const EvolutionPage: React.FC<Props> = ({ snapshots, loading = false, assessing = false }) => {
  const navigate = usePulseNavigate();
  const lang = useLang();
  const tr = useTr();
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
      return { name: c.name, color: catalogColor(c.name, c.color), to: c, from: prev, delta: prev ? c.score - prev.score : null };
    }).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0) || a.to.score - b.to.score);
  }, [to, from]);

  // Why each score moved: the parts, the criteria behind them, and anything
  // that changed in what was measured (criteria or capabilities added or removed).
  const causes = useMemo(() => {
    if (!to || !from) return { caps: [], added: [] as string[], removed: [] as string[], versions: null as null | [string, string], telemetry: null as null | [string, string] };
    const list = to.capabilities.map(c => {
      const p = from.capabilities.find(x => x.name === c.name);
      const prevById = new Map((p?.criteriaResults ?? []).map(r => [r.id, r]));
      const nowIds = new Set(c.criteriaResults.map(r => r.id));
      const items: { kind: CauseKind; label: string; before?: string; after?: string }[] = [];
      for (const r of c.criteriaResults) {
        const b = prevById.get(r.id);
        const now = stateOf(r), was = stateOf(b);
        if (!p) continue;
        if (!b) { items.push({ kind: "new", label: critName(r, lang), after: reading(r, lang) }); continue; }
        if (was === now) continue;
        const kind: CauseKind = now === "pass" && was === "fail" ? "gained" : now === "fail" && was === "pass" ? "lost" : now === "na" ? "unassessed" : "assessed";
        items.push({ kind, label: critName(r, lang), before: reading(b, lang), after: reading(r, lang) });
      }
      for (const b of p?.criteriaResults ?? []) if (!nowIds.has(b.id)) items.push({ kind: "removed", label: critName(b, lang), before: reading(b, lang) });
      const parts = (["coverage", "utilization", "adoption"] as const).map(k => ({ key: k, from: p?.[k] ?? null, to: c[k] ?? null }));
      const counted = parts.filter(x => x.to != null).length || 1;
      return {
        name: c.name, color: catalogColor(c.name, c.color), isNew: !p,
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
      telemetry: from.telemetry && to.telemetry && from.telemetry.source !== to.telemetry.source
        ? [telemetryLabel(from.telemetry.source, lang), telemetryLabel(to.telemetry.source, lang)] as [string, string] : null,
    };
  }, [to, from, lang]);

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
    { id: "criterion", header: tr("Criterion", "Critério", "Criterio"), minWidth: 160, autoWidth: true, accessor: (c: Near) => critName(c.r, lang), cell: ({ rowData }: { rowData: Near }) => {
      const act = critAction(rowData.r.id, lang);
      return <DataTable.DefaultCell>{act ? <Tooltip text={act}><Text>{critName(rowData.r, lang)}</Text></Tooltip> : critName(rowData.r, lang)}</DataTable.DefaultCell>;
    } },
    { id: "capability", header: tr("Capability", "Capacidade", "Capacidad"), minWidth: 150, autoWidth: true, accessor: (c: Near) => c.cap.name, cell: ({ rowData }: { rowData: Near }) => (
      <DataTable.DefaultCell><Link onClick={() => openCap(rowData.cap.name)}>{rowData.cap.name}</Link></DataTable.DefaultCell>
    ) },
    { id: "value", header: tr("Value", "Valor", "Valor"), width: 100, alignment: "right" as const, accessor: (c: Near) => `${c.value}%` },
    { id: "target", header: tr("Target", "Meta", "Objetivo"), width: 100, alignment: "right" as const, accessor: (c: Near) => `${c.target}%` },
  ];
  /** Per capability: its parts, the lowest one, and the criteria that are not met. */
  const baseline = useMemo(() => {
    if (!to) return [];
    return [...to.capabilities].sort((a, b) => a.score - b.score).map(c => {
      const parts = (["coverage", "utilization", "adoption"] as const).map(k => ({ key: k, value: c[k] ?? null }));
      const known = parts.filter(p => p.value != null);
      const lowest = known.length ? known.reduce((m, p) => ((p.value as number) < (m.value as number) ? p : m)).key : null;
      return {
        name: c.name, color: catalogColor(c.name, c.color), score: c.score, parts, lowest, adoptionRate: c.adoptionRate ?? null,
        unmet: c.criteriaResults.filter(r => stateOf(r) === "fail"),
        notAssessed: c.criteriaResults.filter(r => stateOf(r) === "na"),
      };
    });
  }, [to]);

  const gained = changes.filter(c => c.now === "pass").length;
  const lost = changes.filter(c => c.now === "fail").length;
  type Change = (typeof changes)[number];
  const openCap = (name: string) => navigate(`/capability/${encodeURIComponent(name.replace(/\//g, "~"))}`);
  const wGained = tr("Gained", "Conquistado", "Logrado");
  const wLost = tr("Lost", "Perdido", "Perdido");
  const changeColumns = [
    { id: "change", header: tr("Change", "Mudança", "Cambio"), width: 110, accessor: (c: Change) => (c.now === "pass" ? wGained : wLost), cell: ({ rowData }: { rowData: Change }) => (
      <DataTable.DefaultCell><Chip size="condensed" color={rowData.now === "pass" ? "success" : "critical"}>{rowData.now === "pass" ? wGained : wLost}</Chip></DataTable.DefaultCell>
    ) },
    { id: "state", header: tr("State now", "Estado atual", "Estado actual"), width: 130, accessor: (c: Change) => (c.now === "pass" ? tr("Met", "Atendido", "Cumplido") : tr("Not met", "Não atendido", "No cumplido")), cell: ({ rowData }: { rowData: Change }) => (
      <DataTable.DefaultCell><StateMark state={rowData.now === "pass" ? "pass" : "fail"} label /></DataTable.DefaultCell>
    ) },
    { id: "criterion", header: tr("Criterion", "Critério", "Criterio"), minWidth: 160, autoWidth: true, accessor: (c: Change) => critName(c.r, lang), cell: ({ rowData }: { rowData: Change }) => {
      const act = rowData.now === "fail" ? critAction(rowData.r.id, lang) : undefined;
      return <DataTable.DefaultCell>{act ? <Tooltip text={act}><Text>{critName(rowData.r, lang)}</Text></Tooltip> : critName(rowData.r, lang)}</DataTable.DefaultCell>;
    } },
    { id: "capability", header: tr("Capability", "Capacidade", "Capacidad"), minWidth: 150, autoWidth: true, accessor: (c: Change) => c.cap.name, cell: ({ rowData }: { rowData: Change }) => (
      <DataTable.DefaultCell><Link onClick={() => openCap(rowData.cap.name)}>{rowData.cap.name}</Link></DataTable.DefaultCell>
    ) },
    { id: "before", header: tr("Before", "Antes", "Antes"), width: 100, alignment: "right" as const, accessor: (c: Change) => fmtValue(c.before, lang) },
    { id: "after", header: tr("Now", "Agora", "Ahora"), width: 100, alignment: "right" as const, accessor: (c: Change) => fmtValue(c.r, lang) },
  ];

  const trend = useMemo(() => [...runs].reverse().slice(-30).map(s2 => {
    const c = cap ? s2.capabilities.find(x => x.name === cap) : undefined;
    const parts = (cap ? [c?.coverage, c?.utilization, c?.adoption] : [part(s2, "coverage"), part(s2, "utilization"), part(s2, "adoption")])
      .filter((x): x is number => x != null);
    const v = cap ? (c?.score ?? 0) : s2.totalScore;
    return { t: new Date(s2.timestamp).getTime(), v, lo: parts.length ? Math.min(...parts) : v, hi: parts.length ? Math.max(...parts) : v };
  }), [runs, cap]);

  if ((loading || assessing) && runs.length === 0) {
    return <Flex alignItems="center" justifyContent="center" style={{ flex: 1, padding: 48 }}><PulseLoader label={assessing ? tr("Assessing the environment", "Avaliando o ambiente", "Evaluando el entorno") : tr("Loading saved runs", "Carregando execuções salvas", "Cargando ejecuciones guardadas")} /></Flex>;
  }
  if (!to || !from) {
    return (
      <Flex alignItems="center" justifyContent="center" style={{ flex: 1, padding: 48 }}>
        <EmptyState>
          <EmptyState.VisualPreset context="chart" type="something-missing" />
          <EmptyState.Title>{tr("No saved run yet", "Nenhuma execução salva ainda", "Aún no hay ejecuciones guardadas")}</EmptyState.Title>
          <EmptyState.Details>{tr("Each completed assessment is saved automatically and shows up here.", "Cada avaliação concluída é salva automaticamente e aparece aqui.", "Cada evaluación completada se guarda automáticamente y aparece aquí.")}</EmptyState.Details>
          <EmptyState.Actions><Button variant="emphasized" onClick={() => navigate("/")}>{tr("Go to assessment", "Ir para a avaliação", "Ir a la evaluación")}</Button></EmptyState.Actions>
        </EmptyState>
      </Flex>
    );
  }

  // One saved run: the page shows it as the baseline. The comparison panels
  // appear with the second run.
  const solo = runs.length === 1;
  const band = scoreBand(to.totalScore);
  const capColor = cap ? (catalogColor(cap) || Colors.Charts.Categorical.Color01.Default) : Colors.Charts.Categorical.Color01.Default;
  const clearCap = cap ? <Chip color="primary" size="condensed">{cap}<Chip.DeleteButton aria-label={tr(`Clear the ${cap} filter`, `Limpar o filtro ${cap}`, `Quitar el filtro ${cap}`)} onClick={() => setCap(null)} /></Chip> : null;
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
          <Heading level={2}>{tr("Evolution", "Evolução", "Evolución")}</Heading>
          <Text style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: band.text }}>{to.totalScore}%</Text>
          {solo ? <Chip size="condensed" color="primary">{tr("First run", "Primeira execução", "Primera ejecución")}</Chip> : <Delta d={to.totalScore - from.totalScore} size={14} />}
          <Flex alignItems="center" gap={16} flexWrap="wrap" style={{ marginLeft: "auto" }}>
            <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>{solo ? fmtRun(to.timestamp, lang) : `${fmtRun(from.timestamp, lang)} → ${fmtRun(to.timestamp, lang)}`}</Text>
            {!solo && (
              <Flex style={{ maxWidth: "100%", overflowX: "auto" }}><ToggleButtonGroup value={since} onChange={(v: string) => setSince(v as Since)}>
                {SINCE.map(v => <ToggleButtonGroup.Item key={v} value={v}>{sinceLabel(v, lang)}</ToggleButtonGroup.Item>)}
              </ToggleButtonGroup></Flex>
            )}
          </Flex>
        </Flex>

        {/* Two panels that share the row and stack when it gets narrow: a spanning
            item in an auto-fit grid wrapped alone and left the row half empty. */}
        <Flex style={{ flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
          <Panel title={solo ? tr("Score", "Pontuação", "Puntuación") : tr("What changed in the score", "O que mudou na pontuação", "Qué cambió en la puntuación")} style={{ flex: "1 1 300px" }}>
            <Flex flexDirection="column" gap={12}>
              <ChangeMeter label={tr("Overall score", "Pontuação geral", "Puntuación general")} from={from.totalScore} to={to.totalScore} solo={solo} />
              <ChangeMeter label={partLabel("coverage", lang)} from={part(from, "coverage")} to={part(to, "coverage")} solo={solo} />
              <ChangeMeter label={partLabel("utilization", lang)} from={part(from, "utilization")} to={part(to, "utilization")} solo={solo} />
              <ChangeMeter label={partLabel("adoption", lang)} from={part(from, "adoption")} to={part(to, "adoption")} solo={solo} />
            </Flex>
          </Panel>

          <Panel title={tr("Score over time", "Pontuação ao longo do tempo", "Puntuación a lo largo del tiempo")} right={clearCap ?? <Text textStyle="small" style={{ color: NEUTRAL }}>{tr("Overall", "Geral", "General")}</Text>} style={{ flex: "2 1 420px" }}>
            <TrendChart points={trend} name={cap ?? tr("Overall", "Geral", "General")} color={capColor} />
          </Panel>
        </Flex>

        {/* Why the score moved: every change traced to its part and its criteria */}
        {solo && (
          <Panel title={tr("What holds each score", "O que sustenta cada pontuação", "Qué sostiene cada puntuación")} right={<Text textStyle="small" style={{ color: NEUTRAL }}>{tr("Lowest score first", "Menor pontuação primeiro", "Menor puntuación primero")}</Text>}>
            <Accordion multiple defaultExpanded={baseline.slice(0, 2).map(c => c.name)}>
              {baseline.map(c => (
                <Accordion.Section key={c.name} id={c.name}>
                  <Accordion.SectionLabel>
                    <Grid gridTemplateColumns="minmax(0, 1fr) 90px" gap={12} alignItems="center" width="100%">
                      <Flex alignItems="center" gap={8}>
                        <Flex style={{ display: "inline-flex", width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                        <Text textStyle="base-emphasized">{c.name}</Text>
                      </Flex>
                      <Text textStyle="base-emphasized" style={{ fontFamily: MONO, color: scoreBand(c.score).text, textAlign: "right" }}>{c.score}%</Text>
                    </Grid>
                  </Accordion.SectionLabel>
                  <Accordion.SectionContent>
                    <Flex flexDirection="column" gap={12}>
                      <Grid gridTemplateColumns="repeat(auto-fit, minmax(min(100%, 200px), 1fr))" gap={12}>
                        {c.parts.map(p => (
                          <Flex key={p.key} flexDirection="column" gap={2}>
                            <Text textStyle="small" style={{ color: NEUTRAL }}>{partLabel(p.key, lang)}</Text>
                            <Text textStyle="base-emphasized" style={{ fontFamily: MONO }}>{p.value == null ? "—" : `${Math.floor(p.value)}%`}</Text>
                            {p.key === c.lowest && <Flex><Chip size="condensed" color="warning">{tr("Lowest part", "Parte mais baixa", "Parte más baja")}</Chip></Flex>}
                            {p.key === "adoption" && c.adoptionRate != null && <Text textStyle="small" style={{ color: NEUTRAL }}>{tr(`${c.adoptionRate}% of active users`, `${c.adoptionRate}% dos usuários ativos`, `${c.adoptionRate}% de los usuarios activos`)}</Text>}
                          </Flex>
                        ))}
                      </Grid>
                      {c.unmet.length === 0 && c.notAssessed.length === 0 ? (
                        <Text textStyle="small" style={{ color: NEUTRAL }}>{tr("Every criterion is met", "Todos os critérios atendidos", "Todos los criterios se cumplen")}</Text>
                      ) : (
                        <Flex flexDirection="column" gap={6}>
                          {[...c.unmet, ...c.notAssessed].map(r => (
                            <Grid key={r.id} gridTemplateColumns="130px minmax(0, 1fr) minmax(0, 1fr)" gap={12} alignItems="center">
                              <Flex><StateMark state={stateOf(r) === "fail" ? "fail" : "na"} label /></Flex>
                              <Text textStyle="small-emphasized">{critName(r, lang)}</Text>
                              <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>
                                {stateOf(r) === "fail" && IS_RATIO[r.id] && TARGET[r.id] != null ? `${fmtValue(r, lang)}  →  ${TARGET[r.id]}%` : ""}
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

        {!solo && <Panel title={tr("What caused the change", "O que causou a mudança", "Qué causó el cambio")}>
          {causes.caps.length === 0 && causes.added.length === 0 && causes.removed.length === 0 ? (
            <Text textStyle="small" style={{ color: NEUTRAL }}>{tr("Nothing changed between these two runs", "Nada mudou entre essas duas execuções", "Nada cambió entre estas dos ejecuciones")}</Text>
          ) : (
            <Flex flexDirection="column" gap={12}>
              {(causes.versions || causes.telemetry || causes.added.length > 0 || causes.removed.length > 0) && (
                <Flex gap={8} flexWrap="wrap">
                  {([
                    causes.versions ? [
                      tr(`Version ${causes.versions[0]} → ${causes.versions[1]}`, `Versão ${causes.versions[0]} → ${causes.versions[1]}`, `Versión ${causes.versions[0]} → ${causes.versions[1]}`),
                      tr(`The app version changed between these runs (${causes.versions[0]} to ${causes.versions[1]}). Part of the difference comes from what is measured, not from the environment.`,
                        `A versão do app mudou entre essas execuções (${causes.versions[0]} para ${causes.versions[1]}). Parte da diferença vem do que é medido, não do ambiente.`,
                        `La versión de la app cambió entre estas ejecuciones (${causes.versions[0]} a ${causes.versions[1]}). Parte de la diferencia viene de lo que se mide, no del entorno.`),
                    ] : null,
                    causes.telemetry ? [
                      tr(`Telemetry ${causes.telemetry[0]} → ${causes.telemetry[1]}`, `Telemetria ${causes.telemetry[0]} → ${causes.telemetry[1]}`, `Telemetría ${causes.telemetry[0]} → ${causes.telemetry[1]}`),
                      tr(`The telemetry strategy changed between these runs (${causes.telemetry[0]} to ${causes.telemetry[1]}), so hosts, Kubernetes and logs are counted on a different population.`,
                        `A estratégia de telemetria mudou entre essas execuções (${causes.telemetry[0]} para ${causes.telemetry[1]}), então hosts, Kubernetes e logs são contados sobre outra população.`,
                        `La estrategia de telemetría cambió entre estas ejecuciones (${causes.telemetry[0]} a ${causes.telemetry[1]}), por lo que hosts, Kubernetes y logs se cuentan sobre otra población.`),
                    ] : null,
                    causes.added.length ? [
                      tr(`Capabilities added · ${causes.added.length}`, `Capacidades adicionadas · ${causes.added.length}`, `Capacidades añadidas · ${causes.added.length}`),
                      tr(`Added: ${causes.added.join(", ")}. They have no earlier reading to compare with.`,
                        `Adicionadas: ${causes.added.join(", ")}. Não têm leitura anterior para comparar.`,
                        `Añadidas: ${causes.added.join(", ")}. No tienen una lectura anterior con la que comparar.`),
                    ] : null,
                    causes.removed.length ? [
                      tr(`Capabilities removed · ${causes.removed.length}`, `Capacidades removidas · ${causes.removed.length}`, `Capacidades eliminadas · ${causes.removed.length}`),
                      tr(`Removed: ${causes.removed.join(", ")}. They no longer count in the overall score.`,
                        `Removidas: ${causes.removed.join(", ")}. Não contam mais na pontuação geral.`,
                        `Eliminadas: ${causes.removed.join(", ")}. Ya no cuentan en la puntuación general.`),
                    ] : null,
                  ].filter(Boolean) as [string, string][]).map(([label, tip]) => (
                    <Tooltip key={label} text={tip}>
                      <Chip size="condensed" style={{ maxWidth: "none" }}>{label}</Chip>
                    </Tooltip>
                  ))}
                </Flex>
              )}
              <Accordion multiple defaultExpanded={causes.caps.slice(0, 2).map(c => c.name)}>
                {causes.caps.map(c => (
                  <Accordion.Section key={c.name} id={c.name}>
                    <Accordion.SectionLabel>
                      <Grid gridTemplateColumns="minmax(0, 1fr) 130px 90px" gap={12} alignItems="center" width="100%">
                        <Flex alignItems="center" gap={8}>
                          <Flex style={{ display: "inline-flex", width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                          <Text textStyle="base-emphasized">{c.name}</Text>
                          {c.isNew && <Chip size="condensed" color="primary">{tr("New capability", "Capacidade nova", "Capacidad nueva")}</Chip>}
                        </Flex>
                        <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL, textAlign: "right" }}>{c.from == null ? "—" : `${c.from}%`} → {c.to}%</Text>
                        <Flex justifyContent="flex-end"><Delta d={c.delta} /></Flex>
                      </Grid>
                    </Accordion.SectionLabel>
                    <Accordion.SectionContent>
                      <Flex flexDirection="column" gap={12}>
                        {/* 1. Which part moved, and whether it raised or lowered the score */}
                        {!c.isNew && (
                          <Grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap={12}>
                            {c.parts.map(p => (
                              <Flex key={p.key} flexDirection="column" gap={2}>
                                <Text textStyle="small" style={{ color: NEUTRAL }}>{partLabel(p.key, lang)}</Text>
                                <Text textStyle="base-emphasized" style={{ fontFamily: MONO }}>{p.from == null ? "—" : `${Math.floor(p.from)}%`} → {p.to == null ? "—" : `${Math.floor(p.to)}%`}</Text>
                                <Flex alignItems="center" gap={4} style={{ color: p.points == null || Math.abs(p.points) < 0.05 ? NEUTRAL : p.points > 0 ? PASS : FAIL }}>
                                  {p.points == null ? null : Math.abs(p.points) < 0.05 ? <MinusIcon size="small" /> : p.points > 0 ? <ArrowUpIcon size="small" /> : <ArrowDownIcon size="small" />}
                                  <Text textStyle="small" style={{ color: "inherit" }}>
                                    {p.points == null ? tr("Not comparable", "Não comparável", "No comparable") : Math.abs(p.points) < 0.05 ? tr("No effect on the score", "Sem efeito na pontuação", "Sin efecto en la puntuación") : p.points > 0 ? tr("Raised the score", "Aumentou a pontuação", "Aumentó la puntuación") : tr("Lowered the score", "Reduziu a pontuação", "Redujo la puntuación")}
                                  </Text>
                                </Flex>
                                {p.key === "adoption" && c.adoptionRate[0] != null && c.adoptionRate[1] != null && c.adoptionRate[0] !== c.adoptionRate[1] && (
                                  <Text textStyle="small" style={{ color: NEUTRAL }}>{tr(`${c.adoptionRate[0]}% → ${c.adoptionRate[1]}% of active users`, `${c.adoptionRate[0]}% → ${c.adoptionRate[1]}% dos usuários ativos`, `${c.adoptionRate[0]}% → ${c.adoptionRate[1]}% de los usuarios activos`)}</Text>
                                )}
                              </Flex>
                            ))}
                          </Grid>
                        )}
                        {/* 2. The criteria behind coverage and utilization */}
                        {c.items.length === 0 ? (
                          !c.isNew && <Text textStyle="small" style={{ color: NEUTRAL }}>{tr("No criterion changed state: the difference comes from adoption or from values moving inside the same state.", "Nenhum critério mudou de estado: a diferença vem da adoção ou de valores que variaram dentro do mesmo estado.", "Ningún criterio cambió de estado: la diferencia viene de la adopción o de valores que variaron dentro del mismo estado.")}</Text>
                        ) : (
                          <Flex flexDirection="column" gap={6}>
                            {c.items.map((it, k) => (
                              <Grid key={k} gridTemplateColumns="150px minmax(0, 1fr) minmax(0, 1.2fr)" gap={12} alignItems="center">
                                <Flex><Chip size="condensed" color={CAUSE_CHIP[it.kind].color}>{trL(lang, CAUSE_CHIP[it.kind].label[0], CAUSE_CHIP[it.kind].label[1], CAUSE_CHIP[it.kind].label[2])}</Chip></Flex>
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

        <Panel title={tr("Capabilities", "Capacidades", "Capacidades")} right={<Flex alignItems="center" gap={12}>{clearCap}<Text textStyle="small" style={{ color: NEUTRAL }}>{solo ? tr("Lowest score first", "Menor pontuação primeiro", "Menor puntuación primero") : tr("Largest drop first", "Maior queda primeiro", "Mayor caída primero")}</Text></Flex>}>
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
          <Panel title={tr("Closest to passing", "Mais perto de atender", "Más cerca de cumplir")} right={<Flex alignItems="center" gap={12}>{clearCap}<Text textStyle="small" style={{ color: NEUTRAL }}>{tr("Smallest gap first", "Menor distância primeiro", "Menor distancia primero")}</Text></Flex>}>
            {closest.length === 0 ? <Text textStyle="small" style={{ color: NEUTRAL }}>{tr("No unmet share criteria", "Nenhum critério percentual não atendido", "Ningún criterio porcentual sin cumplir")}</Text> : (
              <DataTable data={closest} columns={nearColumns} fullWidth sortable defaultLineWrap variant={{ rowDensity: "condensed" }}>
                <DataTable.Pagination defaultPageSize={10} />
              </DataTable>
            )}
          </Panel>
        )}

        {!solo && <Panel title={tr("Criteria that changed", "Critérios que mudaram", "Criterios que cambiaron")} right={
          <Flex alignItems="center" gap={12}>
            {clearCap}
            <Chip color="success" size="condensed">{tr(`Gained ${gained}`, `Conquistados ${gained}`, `Logrados ${gained}`)}</Chip><Chip color="critical" size="condensed">{tr(`Lost ${lost}`, `Perdidos ${lost}`, `Perdidos ${lost}`)}</Chip>
          </Flex>}>
          {changes.length === 0 ? <Text textStyle="small" style={{ color: NEUTRAL }}>{tr("No criteria changed state", "Nenhum critério mudou de estado", "Ningún criterio cambió de estado")}</Text> : (
            <DataTable data={changes} columns={changeColumns} fullWidth sortable defaultLineWrap variant={{ rowDensity: "condensed" }}>
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
          )}
        </Panel>}
      </Flex>
    </Flex>
  );
};
