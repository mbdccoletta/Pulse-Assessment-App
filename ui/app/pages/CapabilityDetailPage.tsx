// ui/app/pages/CapabilityDetailPage.tsx
//
// One capability, in full. Opened from the Coverage chart (click a point or a
// label). Everything the side cards used to carry lives here — verdict,
// adoption, every criterion, the AI insight — plus the charts the cards had no
// room for: criteria against their threshold, the three utilization tiers, the
// score over time, and the apps people use. Labels and numbers only; the
// explanations sit in tooltips.

import { ToggleButtonGroup } from "@dynatrace/strato-components/forms";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useParams } from "react-router-dom";
import { usePulseNavigate, usePulsePath } from "../kit/PulseHost";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Typography from "@dynatrace/strato-design-tokens/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { showToast } from "@dynatrace/strato-components/notifications";
import { loadFinOpsData } from "../finopsData";
import { ExternalLink, Heading, Text } from "@dynatrace/strato-components/typography";
import { Flex, Surface, Grid } from "@dynatrace/strato-components/layouts";
import { Chip, EmptyState, HealthIndicator, InformationOverlay, SkeletonText, Accordion } from "@dynatrace/strato-components/content";
import { Breadcrumbs } from "@dynatrace/strato-components/navigation";
import { GaugeChart, MeterBarChart, TimeseriesChart } from "@dynatrace/strato-components/charts";
import type { CoverageData, CapabilityResult } from "../hooks/useCoverageData";
import type { useAssessmentHistory } from "../hooks/useAssessmentHistory";
import { NO_ADOPTION, isOfficialApp, peopleReading } from "../hooks/useAppAdoption";
import { IntelligenceBar } from "../components/IntelligenceBar";
import { LENS, capabilityQuestions, capabilityFacts } from "../ai/pageIntelligence";
import { Tooltip } from "../components/Tooltip";
import { DEFAULT_CUTS, diagnose } from "../diagnosis";
import { passLine } from "../passLine";
import { useAppNames, useInstalledApps } from "../hooks/useAppNames";
import { capabilityForApp, sharedCapabilitiesForApp } from "../data/appCapabilityMap";
import { ADOPTION_FULL_RATE, gainIfMet } from "../pulseScore";
import { openDynatraceAssist } from "../ai/assistIntent";
import type { ReportContext } from "../ai/reportPrompt";
import { getAppLink, sendIntent } from "@dynatrace-sdk/navigation";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import { ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, DynatraceIntelligenceSignetIcon, MinusIcon } from "@dynatrace/strato-icons";
import { gapFor, runGap } from "../data/criterionGaps";
import { scoreBand, SCORE_BANDS } from "../utils/colors";
import { CRITERION_IMPORTANCE } from "../data/criterionImportance";
import { CRITERION_ACTIONS } from "../remediationActions";
import { useTr, useLang, tr, criterionText, bandWord, localeTag, windowWords, type PulseLang } from "../i18n/lang";
import { getInventoryWindowHours } from "../hooks/useCoverageData";

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

/** The state word in the language (STATE_META.word is the English one). */
function stateWord(state: "pass" | "fail" | "na", lang: PulseLang): string {
  return state === "pass" ? tr(lang, "Met", "Atendido", "Cumplido")
    : state === "fail" ? tr(lang, "Not met", "Não atendido", "No cumplido")
    : tr(lang, "Not assessed", "Não avaliado", "No evaluado");
}

/** A criterion's name and description in the language; the action only when the catalog has one. */
function rowText(r: Row, lang: PulseLang): { label: string; description: string; action: string } {
  const t = criterionText(r.id, lang, { label: r.label, description: r.description, action: CRITERION_ACTIONS[r.id]?.action });
  return { ...t, action: CRITERION_ACTIONS[r.id]?.action ? t.action : "" };
}

const STATE_META = {
  pass: { color: PASS, shape: "●", word: "Met", status: "ideal" },
  fail: { color: FAIL, shape: "◆", word: "Not met", status: "critical" },
  na:   { color: NEUTRAL, shape: "○", word: "Not assessed", status: "neutral" },
} as const;

/** Met / Not met / Not assessed, drawn by Strato: colour plus shape, with the word for assistive tech. */
export const StateMark: React.FC<{ state: keyof typeof STATE_META; label?: boolean }> = ({ state, label }) => {
  const lang = useLang();
  const m = STATE_META[state];
  const word = stateWord(state, lang);
  return label
    ? <HealthIndicator status={m.status}><HealthIndicator.Label>{word}</HealthIndicator.Label></HealthIndicator>
    : <HealthIndicator status={m.status} aria-label={word} />;
};

/** An app's name as a link to the official app, opened in a new tab so the
 *  assessment stays where it was. Plain text when the shell gives no link. */
export const AppLink: React.FC<{ appId: string; children: React.ReactNode }> = ({ appId, children }) => {
  let href: string | undefined;
  try { href = getAppLink(appId); } catch { href = undefined; }
  // Outside the platform shell (local development) the SDK returns a generic
  // address: build the app's own address from the environment instead.
  if (!href || !href.includes(appId)) {
    try { href = `${getEnvironmentUrl().replace(/\/$/, "")}/ui/apps/${appId}`; } catch { href = undefined; }
  }
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
        style={{ color: "inherit", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{children}</a>
    : <>{children}</>;
};

/** The score gauge. Strato's GaugeChart colours the arc from the thresholds
 *  but always draws the number in the default text colour; the number takes
 *  the band's status text colour here, like every other score in the app. */
const GAUGE_CSS = ".pulse-gauge foreignObject span { color: var(--pulse-gauge-text) !important; }";
export const ScoreGauge: React.FC<{ value: number }> = ({ value }) => {
  const lang = useLang();
  const band = scoreBand(value);
  return (
    <div className="pulse-gauge" style={{ ["--pulse-gauge-text" as string]: band.text } as React.CSSProperties}>
      <style>{GAUGE_CSS}</style>
      <GaugeChart value={value} min={0} max={100} formatter={pctFormat} height={150} showThresholdIndicators>
        {BAND_THRESHOLDS.map(t => <GaugeChart.ThresholdIndicator key={t.value} value={t.value} color={t.color} />)}
        {/* The default tooltip reads "Segment · Value": it names what the number is instead — the score and its band. */}
        <GaugeChart.Tooltip name={tr(lang, "Score", "Pontuação", "Puntuación")}>
          {(item) => `${tr(lang, "Score", "Pontuação", "Puntuación")}: ${item.formattedValue} · ${bandWord(band.label, lang)}`}
        </GaugeChart.Tooltip>
      </GaugeChart>
    </div>
  );
};

/** Verdict as a Strato chip; the colour is the judgement. */
const VERDICT_CHIP: Record<string, "neutral" | "primary" | "success" | "warning" | "critical"> = {
  healthy: "success", starved: "primary", unwatched: "critical", skinDeep: "warning", dark: "neutral", notAssessed: "neutral",
};
export const VerdictChip: React.FC<{ id: string; label: string; meaning?: string; size?: "default" | "condensed"; onClick?: () => void }> = ({ id, label, meaning, size, onClick }) => {
  const tr = useTr();
  const chip = (
    <Chip color={VERDICT_CHIP[id] ?? "neutral"} variant="accent" size={size}
      style={{ flexShrink: 0, cursor: onClick ? "pointer" : undefined }}
      {...(onClick ? { role: "button", tabIndex: 0, "aria-label": tr(`${label}: show app usage`, `${label}: ver o uso dos apps`, `${label}: ver el uso de las apps`),
        onClick: (e: React.MouseEvent) => { e.stopPropagation(); onClick(); },
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } } : {})}>
      {label}
    </Chip>
  );
  return meaning ? <Tooltip text={meaning} containerStyle={{ flexShrink: 0 }}>{chip}</Tooltip> : chip;
};

/** Presence checks divide by 1: the reading is the count itself. */
function isPresence(r: Row): boolean {
  return r.count != null;
}

function fmtValue(r: Row, lang: PulseLang): string {
  if (rowState(r) === "na") return "—";
  // "≈" marks a partial read: it stopped at the scan ceiling (the tooltip says so).
  const p = r.partial ? "≈ " : "";
  if (isPresence(r)) return `${p}${(r.count ?? 0).toLocaleString(localeTag(lang))}`;
  return r.isRatio ? `${p}${Math.floor(r.value * 10) / 10}%` : `${p}${r.value.toLocaleString(localeTag(lang))}`;
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

function tipFor(r: Row, lang: PulseLang): string {
  const why = CRITERION_IMPORTANCE[r.id];
  const t = rowText(r, lang);
  const fix = t.action;
  const partial = r.partial ? tr(lang,
    "Partial reading: the query stopped at the 50 GB scan ceiling, so the value covers part of the window. A Dynatrace user reads it in full.",
    "Leitura parcial: a consulta parou no limite de 50 GB de varredura, então o valor cobre parte da janela. Um usuário Dynatrace lê o valor completo.",
    "Lectura parcial: la consulta se detuvo en el límite de 50 GB de escaneo, por lo que el valor cubre parte de la ventana. Un usuario de Dynatrace lo lee completo.") : "";
  return [partial, t.description, why, fix ? tr(lang, `Next step: ${fix}`, `Próximo passo: ${fix}`, `Siguiente paso: ${fix}`) : ""].filter(Boolean).join("\n\n");
}

// ── Building blocks ─────────────────────────────────────────────────────────

export const Panel: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties; id?: string }> = ({ title, right, children, style, id }) => (
  <Surface id={id} elevation="flat" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, minWidth: 0, ...style }}>
    <Flex alignItems="center" justifyContent="space-between" gap={8}>
      <Heading level={5}>{title}</Heading>
      {right}
    </Flex>
    {children}
  </Surface>
);

const FINOPS_CAPABILITY = "FinOps & Sustainability";

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
const TierBars: React.FC<{ rows: Row[] }> = ({ rows }) => {
  const lang = useLang();
  return (
  <Grid style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px 24px" }}>
    {rows.map(r => {
      const st = rowState(r), meta = STATE_META[st];
      const name = rowText(r, lang).label.replace(/\s*\(%\)\s*$/, "");
      return (
        <Tooltip key={r.id} text={tipFor(r, lang)} containerStyle={{ display: "block", minWidth: 0 }}>
          <Grid style={{ gridTemplateColumns: "16px minmax(0, 1fr)", gap: 6, alignItems: "start" }}>
            <Flex flexDirection="column" style={{ paddingTop: 2 }}><StateMark state={st} /></Flex>
            <MeterBarChart value={st === "na" ? 0 : Math.min(100, r.value)} min={0} max={100} color={meta.color} size="size8" formatter={pctFormat}>
              <MeterBarChart.Label>{name}</MeterBarChart.Label>
              <MeterBarChart.Value>{fmtValue(r, lang)}</MeterBarChart.Value>
            </MeterBarChart>
          </Grid>
        </Tooltip>
      );
    })}
  </Grid>
  );
};

/** Presence checks (a count, not a share) as status rows. */
/** What a presence count counts. People are also shown as a share of active users. */
const PRESENCE_UNIT: Record<string, string> = {
  ai12: "people", ai18: "people", i26: "people", a16: "people", d15: "people", l17: "people", s14: "people", t14: "people", b11: "people", g9: "people",
  ai10: "tool calls", ai14: "workflows", g6: "workflows", g8: "workflows", i25: "workflows", d14: "workflows", t13: "workflows", sd14: "workflows", f1: "workflows", f3: "providers", sd2: "events", sd13: "validations", l15: "events",
  s13: "reports", s2: "sources", s11: "detections", s12: "findings", t4: "detections", t12: "sources",
};

/** Unit words in Portuguese and Spanish: [singular, plural]. English derives from the key. */
const UNIT_WORDS: Record<string, { pt: [string, string]; es: [string, string] }> = {
  "people": { pt: ["pessoa", "pessoas"], es: ["persona", "personas"] },
  "tool calls": { pt: ["chamada de ferramenta", "chamadas de ferramenta"], es: ["llamada a herramienta", "llamadas a herramientas"] },
  "workflows": { pt: ["workflow", "workflows"], es: ["flujo de trabajo", "flujos de trabajo"] },
  "providers": { pt: ["provedor", "provedores"], es: ["proveedor", "proveedores"] },
  "events": { pt: ["evento", "eventos"], es: ["evento", "eventos"] },
  "validations": { pt: ["validação", "validações"], es: ["validación", "validaciones"] },
  "reports": { pt: ["relatório", "relatórios"], es: ["informe", "informes"] },
  "sources": { pt: ["fonte", "fontes"], es: ["fuente", "fuentes"] },
  "detections": { pt: ["detecção", "detecções"], es: ["detección", "detecciones"] },
  "findings": { pt: ["achado", "achados"], es: ["hallazgo", "hallazgos"] },
};

function unitWord(unit: string, n: number, lang: PulseLang): string {
  const w = lang === "en" ? undefined : UNIT_WORDS[unit]?.[lang];
  if (!w) return n === 1 ? unit.replace(/s$/, "") : unit;
  return n === 1 ? w[0] : w[1];
}

const PresenceList: React.FC<{ rows: Row[]; totalUsers?: number }> = ({ rows, totalUsers }) => {
  const lang = useLang();
  return (
  <Flex flexDirection="column" gap={6}>
    {rows.map(r => {
      const st = STATE_META[rowState(r)];
      return (
        <Tooltip key={r.id} text={tipFor(r, lang)} containerStyle={{ display: "block" }}>
          <Grid style={{ gridTemplateColumns: "16px minmax(0, 1fr) auto", gap: 8, alignItems: "center" }}>
            <StateMark state={rowState(r)} />
            <Text textStyle="small" style={{ color: INK }}>{rowText(r, lang).label}</Text>
            <Text textStyle="small" style={{ fontFamily: MONO, color: st.color }}>{presenceReading(r, lang, totalUsers)}</Text>
          </Grid>
        </Tooltip>
      );
    })}
  </Flex>
  );
};

function presenceReading(r: Row, lang: PulseLang, totalUsers?: number): string {
  const st = rowState(r);
  if (st === "na") return "—";
  const n = r.count ?? 0;
  if (n === 0) return tr(lang, "None", "Nenhum", "Ninguno");
  const unit = PRESENCE_UNIT[r.id];
  const num = n.toLocaleString(localeTag(lang));
  if (unit === "people" && totalUsers && totalUsers > 0) {
    const pct = Math.floor((n / totalUsers) * 1000) / 10;
    return tr(lang, `${num} people · ${pct}%`, `${num} pessoas · ${pct}%`, `${num} personas · ${pct}%`);
  }
  return unit ? `${num} ${unitWord(unit, n, lang)}` : num;
}

/** Criteria grouped by tier: ratios as bars, presence checks as rows. */
const CriteriaChart: React.FC<{ rows: Row[]; totalUsers?: number }> = ({ rows, totalUsers }) => (
  <Flex flexDirection="column" gap={16}>
    {TIERS.map(t => {
      const tierRows = rows.filter(r => r.tier === t.key);
      if (tierRows.length === 0) return null;
      const ratios = tierRows.filter(r => !isPresence(r));
      const presence = tierRows.filter(r => isPresence(r));
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
  const tr = useTr();
  if (points.length === 0) return <Text textStyle="small" style={{ color: NEUTRAL }}>{tr("No saved run yet", "Nenhuma execução salva ainda", "Aún no hay ejecuciones guardadas")}</Text>;
  const line = { name: tr("Score", "Pontuação", "Puntuación"), unit: "%", datapoints: points.map(p => ({ start: new Date(p.t), value: p.v })) };
  const band = { name: tr("Parts range", "Faixa das partes", "Rango de las partes"), unit: "%", datapoints: points.map(p => ({ start: new Date(p.t), y0: p.lo, y1: p.hi })) };
  return (
    <TimeseriesChart height={200} aria-label={tr(`${name}: score over time`, `${name}: pontuação ao longo do tempo`, `${name}: puntuación a lo largo del tiempo`)}>
      <TimeseriesChart.Band data={band} color={color} />
      <TimeseriesChart.Line data={line} color={color} gapPolicy="connect" />
      <TimeseriesChart.YAxis min={0} max={100} />
    </TimeseriesChart>
  );
};

/** One unmet criterion as something to act on: the gap in numbers, what it
 *  costs to leave it, what to do, what the score gains, and where to go. */
const ActionList: React.FC<{ cap: CapabilityResult; ctx: ReportContext; tier?: string | null }> = ({ cap, ctx, tier }) => {
  const lang = useLang();
  const tr = useTr();
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
    .map(r => ({ r, gain: gainIfMet(cap, r.tier, r.id) }))
    .sort((a, b) => b.gain - a.gain), [cap, tier]);
  if (todo.length === 0) return null;
  const shown = all ? todo : todo.slice(0, 5);

  const askAssist = (r: Row) => {
    const name = r.label.replace(/\s*\(%\)\s*$/, "");
    const err = openDynatraceAssist({
      prompt: `In ${cap.name}, the check "${name}" is at ${fmtValue(r, "en")} and needs ${fmtFloor(r)}. What exactly should I configure in Dynatrace to fix it, step by step, and how do I verify it worked?`,
      ctx, execute: true,
    });
    setNote(err ? `${err.message} ${err.hint}` : null);
  };
  const openQuery = (r: Row) => {
    try { sendIntent({ "dt.query": dqlForCopy(r.query) }); setNote(null); }
    catch { setNote(tr("Opening a notebook needs the app running inside Dynatrace.", "Abrir um notebook exige o app rodando dentro do Dynatrace.", "Abrir un notebook requiere que la app se ejecute dentro de Dynatrace.")); }
  };

  return (
    <Panel title={tr("What to do", "O que fazer", "Qué hacer")} right={<Text textStyle="small" style={{ color: NEUTRAL }}>{tr("Highest score gain first", "Maior ganho de pontuação primeiro", "Mayor ganancia de puntuación primero")}</Text>}>
      <Accordion>
        {shown.map(({ r, gain }) => {
          const text = rowText(r, lang);
          const name = text.label.replace(/\s*\(%\)\s*$/, "");
          const act = CRITERION_ACTIONS[r.id];
          const gapDef = gapFor(r.id, r.query.split("\n÷ ")[1]);
          const list = lists[r.id];
          const gap = r.num != null && r.den != null && !isPresence(r) && Number.isInteger(r.num) && Number.isInteger(r.den) && r.den !== 100
            ? tr(`${r.num.toLocaleString(localeTag(lang))} of ${r.den.toLocaleString(localeTag(lang))} · ${fmtValue(r, lang)}`,
                `${r.num.toLocaleString(localeTag(lang))} de ${r.den.toLocaleString(localeTag(lang))} · ${fmtValue(r, lang)}`,
                `${r.num.toLocaleString(localeTag(lang))} de ${r.den.toLocaleString(localeTag(lang))} · ${fmtValue(r, lang)}`)
            : fmtValue(r, lang);
          return (
            <Accordion.Section key={r.id} id={r.id}>
              <Accordion.SectionLabel>
                <Grid gridTemplateColumns="16px minmax(0, 1.4fr) minmax(0, 1fr) 24px" gap={12} alignItems="center" width="100%">
                  <StateMark state="fail" />
                  <Text textStyle="base-emphasized">{name}</Text>
                  <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>{gap} → {fmtFloor(r)}</Text>
                  <Flex justifyContent="flex-end" role="img" aria-label={gain > 0 ? tr("Raises the score", "Aumenta a pontuação", "Aumenta la puntuación") : tr("No effect on the score", "Sem efeito na pontuação", "Sin efecto en la puntuación")} title={gain > 0 ? tr("Raises the score", "Aumenta a pontuação", "Aumenta la puntuación") : tr("No effect on the score", "Sem efeito na pontuação", "Sin efecto en la puntuación")} style={{ color: gain > 0 ? PASS : NEUTRAL }}>
                    {gain > 0 ? <ArrowUpIcon size="small" /> : <MinusIcon size="small" />}
                  </Flex>
                </Grid>
              </Accordion.SectionLabel>
              <Accordion.SectionContent>
                <Flex flexDirection="column" gap={12} style={{ maxWidth: 860 }}>
                  <Grid style={{ gridTemplateColumns: "96px minmax(0, 1fr)", gap: "8px 16px", fontSize: 13, lineHeight: 1.5 }}>
                    <Text style={{ color: NEUTRAL }}>{tr("Measured", "Medido", "Medido")}</Text><Text style={{ color: INK }}>{text.description}</Text>
                    {CRITERION_IMPORTANCE[r.id] && (<><Text style={{ color: NEUTRAL }}>{tr("Why it matters", "Por que importa", "Por qué importa")}</Text><Text style={{ color: INK }}>{CRITERION_IMPORTANCE[r.id]}</Text></>)}
                    {act?.action && (<><Text style={{ color: NEUTRAL }}>{tr("What to do", "O que fazer", "Qué hacer")}</Text><Text style={{ color: INK, fontWeight: 600 }}>{text.action}</Text></>)}
                  </Grid>
                  {gapDef && (
                    <Flex flexDirection="column" gap={8}>
                      {!list && <Flex flexDirection="column"><Button size="condensed" onClick={() => loadGap(r.id, gapDef.query)}>{tr(`Show the ${gapDef.noun}`, "Mostrar a lista", "Mostrar la lista")}</Button></Flex>}
                      {list?.state === "loading" && <SkeletonText lines={2} />}
                      {list?.state === "error" && <Text textStyle="small" style={{ color: Colors.Text.Warning.Default }}>{tr("The list could not be loaded.", "Não foi possível carregar a lista.", "No se pudo cargar la lista.")}</Text>}
                      {list?.state === "ok" && (
                        <Flex flexDirection="column" gap={6}>
                          <Text textStyle="small" style={{ color: NEUTRAL }}>{list.names!.length === 0
                            ? tr(`No ${gapDef.noun} found`, "Nenhum item encontrado", "No se encontraron elementos")
                            : tr(`${gapDef.noun.charAt(0).toUpperCase()}${gapDef.noun.slice(1)}${list.names!.length === 50 ? " (first 50)" : ""}`,
                                `Lista${list.names!.length === 50 ? " (primeiros 50)" : ""}`,
                                `Lista${list.names!.length === 50 ? " (primeros 50)" : ""}`)}</Text>
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
                    <Button size="condensed" variant="emphasized" color="primary" onClick={() => askAssist(r)}><Button.Prefix><DynatraceIntelligenceSignetIcon /></Button.Prefix>{tr("Ask Assist how to fix", "Perguntar ao Assist como corrigir", "Preguntar a Assist cómo corregir")}</Button>
                    <Button size="condensed" onClick={() => openQuery(r)}>{tr("Open the query in a notebook", "Abrir a consulta em um notebook", "Abrir la consulta en un notebook")}</Button>
                    {act?.docUrl && <ExternalLink href={act.docUrl}>{act.docLabel || tr("Documentation", "Documentação", "Documentación")}</ExternalLink>}
                  </Flex>
                </Flex>
              </Accordion.SectionContent>
            </Accordion.Section>
          );
        })}
      </Accordion>
      {todo.length > 5 && <Flex flexDirection="column"><Button size="condensed" onClick={() => setAll(v => !v)}>{all ? tr("Show fewer", "Mostrar menos", "Mostrar menos") : tr("Show all", "Mostrar todos", "Mostrar todos")}</Button></Flex>}
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
  /** FinOps report from this page: the same PDF the Reports menu builds. */
  const [finopsBusy, setFinopsBusy] = useState(false);
  const lang = useLang();
  const tr = useTr();
  const { name = "" } = useParams();
  const navigate = usePulseNavigate();
  const pulsePath = usePulsePath();
  const location = useLocation();
  /** The verdict judges adoption among other things: it leads to who uses the apps. */
  const showApps = useCallback(() => {
    document.getElementById("related-apps")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  // Arriving from a verdict on the Overall score page: go straight to the apps.
  useEffect(() => {
    if ((location.state as { section?: string } | null)?.section !== "related-apps") return;
    const t = setTimeout(showApps, 400);
    return () => clearTimeout(t);
  }, [location.state, name, showApps]);
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
          <EmptyState.Title>{tr("No assessment in this session", "Nenhuma avaliação nesta sessão", "No hay evaluación en esta sesión")}</EmptyState.Title>
          <EmptyState.Actions><Button variant="emphasized" onClick={() => navigate("/")}>{tr("Go to assessment", "Ir para a avaliação", "Ir a la evaluación")}</Button></EmptyState.Actions>
        </EmptyState>
      </Flex>
    );
  }

  const band = scoreBand(cap.score);
  const rows = tier ? cap.criteriaResults.filter(r => r.tier === tier) : cap.criteriaResults;
  const tierLabel = TIERS.find(t => t.key === tier)?.label;
  const clearTier = tierLabel ? <Chip color="primary" size="condensed">{tierLabel}<Chip.DeleteButton aria-label={tr(`Clear the ${tierLabel} filter`, `Limpar o filtro ${tierLabel}`, `Quitar el filtro ${tierLabel}`)} onClick={() => setTier(null)} /></Chip> : null;
  const u = cap.utilization;
  const adoptionRan = !adoption.unavailable && !adoption.loading;
  const finopsReport = async (reportLang: "en" | "pt" | "es") => {
    if (finopsBusy) return;
    setFinopsBusy(true);
    try {
      const d = await loadFinOpsData();
      if (!d) { showToast({ type: "warning", title: tr("No FinOps data", "Sem dados de FinOps", "Sin datos de FinOps"), message: tr("Cost & Carbon Optimization has written no cost or carbon data in this environment.", "O Cost & Carbon Optimization não gravou dados de custo ou carbono neste ambiente.", "Cost & Carbon Optimization no ha escrito datos de costo ni de carbono en este entorno.") }); return; }
      (await import("../reports/pulseReports")).generateFinOpsReport({
        capabilities: coverageData.capabilities, totalScore: coverageData.totalScore, tenant: coverageData.tenant, date: coverageData.date,
        adoption: adoptionRan ? { windowDays: adoption.windowDays, totalUsers: adoption.totalUsers, byCapability: adoption.byCapability, apps: adoption.apps } : undefined,
        history: history.snapshots, appName,
      }, d, reportLang);
    } catch {
      showToast({ type: "critical", title: tr("The FinOps report could not be built", "Não foi possível gerar o relatório FinOps", "No se pudo generar el informe FinOps"), message: tr("Try again from the Reports menu on the Overview.", "Tente novamente pelo menu Relatórios na Visão geral.", "Inténtelo de nuevo desde el menú Informes en el Resumen.") });
    } finally { setFinopsBusy(false); }
  };
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
  }, undefined, lang);
  const prev = caps[(idx - 1 + caps.length) % caps.length];
  const next = caps[(idx + 1) % caps.length];
  const go = (c: CapabilityResult) => navigate(`/capability/${encodeURIComponent(c.name.replace(/\//g, "~"))}`);
  // Related apps: the capability's own, the cross-cutting ones that also serve
  // it, and the installed ones nobody opened.
  const serves = (id: string) => capabilityForApp(id) === cap.name || sharedCapabilitiesForApp(id).includes(cap.name);
  const usedApps = adoption.apps.filter(a => isOfficialApp(a.appId) && serves(a.appId)).sort((x, y) => y.users - x.users);
  const usedIds = new Set(usedApps.map(a => a.appId));
  const unusedApps = installed
    .filter(id => !usedIds.has(id) && id.startsWith("dynatrace.") && serves(id))
    .map(id => ({ appId: id, users: 0, dailyUsers: 0, queries: 0, capability: cap.name }));
  const apps = [...usedApps, ...unusedApps].slice(0, 14);
  const topShare = adoption.totalUsers > 0 && apps.length > 0 ? Math.floor((apps[0].users / adoption.totalUsers) * 1000) / 10 : 0;

  return (
    <Flex flexDirection="column" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      {/* Toolbar */}
      <Flex alignItems="center" gap={8} flexWrap="wrap" style={{ padding: "6px 16px", borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
        <Breadcrumbs>
          <Breadcrumbs.Item href={pulsePath("/")} onClick={(e: React.MouseEvent) => { e.preventDefault(); navigate("/"); }}>{tr("Overview", "Visão geral", "Resumen")}</Breadcrumbs.Item>
          <Breadcrumbs.Item>{cap.name}</Breadcrumbs.Item>
        </Breadcrumbs>
        <Button size="condensed" onClick={() => go(prev)} aria-label={tr(`Previous: ${prev.name}`, `Anterior: ${prev.name}`, `Anterior: ${prev.name}`)}><Button.Prefix><ChevronLeftIcon /></Button.Prefix></Button>
        <Button size="condensed" onClick={() => go(next)} aria-label={tr(`Next: ${next.name}`, `Próximo: ${next.name}`, `Siguiente: ${next.name}`)}><Button.Prefix><ChevronRightIcon /></Button.Prefix></Button>
        <Text textStyle="small" style={{ marginLeft: "auto", color: NEUTRAL }}>
          {coverageData.tenant} · {coverageData.date} · {windowWords(getInventoryWindowHours(), lang)}
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
          <Text style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: band.text }}>{cap.score}%</Text>
          <Text textStyle="base-emphasized" style={{ color: band.text }}>{bandWord(band.label, lang)}</Text>
          <VerdictChip id={dx.id} label={dx.label} meaning={dx.meaning} onClick={showApps} />
        </Flex>

        {/* Summary: the three readings, each as a Strato chart */}
        <Grid style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <Panel title={tr("Score", "Pontuação", "Puntuación")}>
            <ScoreGauge value={cap.score} />
          </Panel>

          <Panel title={tr("What makes the score", "O que compõe a pontuação", "Qué compone la puntuación")} right={<InformationOverlay aria-label={tr("How the score is built", "Como a pontuação é calculada", "Cómo se calcula la puntuación")}><InformationOverlay.Content>{tr(
            `The score is the average of three equal parts. Adoption counts as 100 when ${ADOPTION_FULL_RATE}% of active users open the capability's apps.`,
            `A pontuação é a média de três partes iguais. A adoção vale 100 quando ${ADOPTION_FULL_RATE}% dos usuários ativos abrem os apps da capacidade.`,
            `La puntuación es el promedio de tres partes iguales. La adopción cuenta como 100 cuando el ${ADOPTION_FULL_RATE}% de los usuarios activos abre las apps de la capacidad.`)}</InformationOverlay.Content></InformationOverlay>}>
            <Flex flexDirection="column" gap={12}>
              {cap.coverageFactors?.length
                ? <Tooltip text={[
                    tr(`${cap.coverageOfMonitored ?? 0}% of the criteria met`, `${cap.coverageOfMonitored ?? 0}% dos critérios atendidos`, `${cap.coverageOfMonitored ?? 0}% de los criterios cumplidos`),
                    ...cap.coverageFactors.map(f => {
                      const v = `${Math.floor(f.share * 10) / 10}%`;
                      return f.id === "a18"
                        ? tr(`${v} of application processes instrumented`, `${v} dos processos de aplicação instrumentados`, `${v} de los procesos de aplicación instrumentados`)
                        : tr(`${v} of the planned estate monitored`, `${v} do ambiente previsto monitorado`, `${v} del entorno previsto monitoreado`);
                    }),
                  ].join(" × ")} containerStyle={{ display: "block" }}><Flex flexDirection="column"><TierMeter label={tr("Coverage", "Cobertura", "Cobertura")} pct={cap.coverageScore ?? cap.score} /></Flex></Tooltip>
                : <TierMeter label={tr("Coverage", "Cobertura", "Cobertura")} pct={cap.coverageScore ?? cap.score} />}
              <TierMeter label={tr("Utilization", "Utilização", "Utilización")} pct={cap.effectiveUtilizationScore} />
              {cap.adoptionScore != null
                ? <Tooltip text={tr(
                    `${ad?.rate ?? 0}% of active users · ${(ad?.users ?? 0).toLocaleString(localeTag(lang))} people in ${adoption.windowDays} days`,
                    `${ad?.rate ?? 0}% dos usuários ativos · ${(ad?.users ?? 0).toLocaleString(localeTag(lang))} pessoas em ${adoption.windowDays} dias`,
                    `${ad?.rate ?? 0}% de los usuarios activos · ${(ad?.users ?? 0).toLocaleString(localeTag(lang))} personas en ${adoption.windowDays} días`)} containerStyle={{ display: "block" }}><Flex flexDirection="column"><TierMeter label={tr("Adoption", "Adoção", "Adopción")} pct={cap.adoptionScore} /></Flex></Tooltip>
                : <Text textStyle="small" style={{ color: NEUTRAL }}>{tr("Adoption not available", "Adoção indisponível", "Adopción no disponible")}</Text>}
            </Flex>
          </Panel>

          <Panel title={tr("Utilization tiers", "Níveis de utilização", "Niveles de utilización")} right={<InformationOverlay aria-label={tr("About utilization tiers", "Sobre os níveis de utilização", "Acerca de los niveles de utilización")}><InformationOverlay.Content>{tr(
            "Criteria met in each tier, weighted 60 / 25 / 15. Select a tier to filter the page.",
            "Critérios atendidos em cada nível, com pesos 60 / 25 / 15. Selecione um nível para filtrar a página.",
            "Criterios cumplidos en cada nivel, con pesos 60 / 25 / 15. Seleccione un nivel para filtrar la página.")}</InformationOverlay.Content></InformationOverlay>}>
            <Flex flexDirection="column" gap={12}>
              <Flex>
              <Flex style={{ maxWidth: "100%", overflowX: "auto" }}><ToggleButtonGroup value={tier ?? "all"} onChange={(v: string) => setTier(v === "all" ? null : v)}>
                <ToggleButtonGroup.Item value="all">{tr("All", "Todos", "Todos")}</ToggleButtonGroup.Item>
                {TIERS.map(t => <ToggleButtonGroup.Item key={t.key} value={t.key}>{t.label}</ToggleButtonGroup.Item>)}
              </ToggleButtonGroup></Flex>
              </Flex>
              {TIERS.map(t => {
                const tierU = u[t.key];
                return <TierMeter key={t.key} label={t.label} pct={tierU.total > 0 ? (tierU.passed / tierU.total) * 100 : 0} />;
              })}
            </Flex>
          </Panel>
        </Grid>

        {/* What to do: every unmet criterion as an action, highest score gain first */}
        <ActionList cap={cap} ctx={{ tenant: coverageData.tenant, date: coverageData.date, overallCoverage: coverageData.totalScore, overallUtilization: coverageData.overallUtilizationLevel, capabilities: [cap] }} tier={tier} />

        {/* FinOps: the detail (cost per host, idle hosts, energy, emissions) lives in the report */}
        {cap.name === FINOPS_CAPABILITY && (
          <Panel title={tr("FinOps report", "Relatório FinOps", "Informe FinOps")} right={
            <Flex alignItems="center" gap={8} flexWrap="wrap">
              {(["en", "pt", "es"] as const).map(l => (
                <Button key={l} size="condensed" disabled={finopsBusy} onClick={() => finopsReport(l)}>
                  {l === "en" ? "English" : l === "pt" ? "Português" : "Español"}
                </Button>
              ))}
            </Flex>}>
            <Flex gap={6} flexWrap="wrap">
              {[
                tr("Cost by host and cluster", "Custo por host e cluster", "Costo por host y clúster"),
                tr("Idle hosts", "Hosts ociosos", "Hosts inactivos"),
                tr("Energy", "Energia", "Energía"),
                tr("Carbon emissions", "Emissões de carbono", "Emisiones de carbono"),
              ].map(x => <Chip key={x} size="condensed" color="neutral">{x}</Chip>)}
            </Flex>
          </Panel>
        )}

        {/* Criteria and history */}
        {/* Two panels that share the row and stack when it gets narrow. */}
        <Flex style={{ flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <Panel title={tr("Criteria", "Critérios", "Criterios")} style={{ flex: "1.7 1 420px" }} right={<Flex alignItems="center" gap={12}>{clearTier}<StateMark state="pass" label /><StateMark state="fail" label /><StateMark state="na" label /></Flex>}>
            <CriteriaChart rows={rows} totalUsers={adoptionRan ? adoption.totalUsers : undefined} />
          </Panel>

          <Flex flexDirection="column" gap={16} style={{ flex: "1 1 300px", minWidth: 0 }}>
            <Panel title={tr("Score over time", "Pontuação ao longo do tempo", "Puntuación a lo largo del tiempo")}>
              <TrendChart points={trend} name={cap.name} color={cap.color} />
            </Panel>
          </Flex>
        </Flex>

        {/* Full width: a spanning item inside the auto-fit grid above kept empty tracks open */}
        <Panel id="related-apps" title={tr("Related apps", "Apps relacionados", "Apps relacionadas")} right={adoptionRan ? <Text textStyle="small" style={{ color: NEUTRAL }}>{tr(
          `Share of active users · ${adoption.windowDays} days`,
          `Parcela dos usuários ativos · ${adoption.windowDays} dias`,
          `Proporción de usuarios activos · ${adoption.windowDays} días`)}</Text> : undefined}>
          {adoption.loading ? <SkeletonText lines={3} />
            : apps.length === 0 ? <Text textStyle="small" style={{ color: NEUTRAL }}>{tr("No related apps installed", "Nenhum app relacionado instalado", "No hay apps relacionadas instaladas")}</Text>
            : (
              <Flex flexDirection="column" gap={20}>
                {/* Two groups against the app's own adoption line (DEFAULT_CUTS.adoptionRate,
                    the same line the verdict uses): the apps to use more come first, each with
                    the number of people it needs to reach the line. */}
                {(() => {
                  const cut = DEFAULT_CUTS.adoptionRate;
                  const total = adoption.totalUsers;
                  const target = total > 0 ? Math.ceil((cut / 100) * total) : 0;
                  const shareOf = (a: { users: number }) => (total > 0 ? Math.floor((a.users / total) * 1000) / 10 : 0);
                  const primary = (id: string) => capabilityForApp(id) === cap.name;
                  const below = apps.filter(a => shareOf(a) < cut)
                    .sort((x, y) => Number(primary(y.appId)) - Number(primary(x.appId)) || x.users - y.users);
                  const above = apps.filter(a => shareOf(a) >= cut);
                  const row = (a: typeof apps[number], low: boolean) => {
                    const share = shareOf(a);
                    const color = !low ? Colors.Charts.Status.Ideal.Default : a.users > 0 ? Colors.Charts.Status.Warning.Default : Colors.Charts.Status.Critical.Default;
                    const gap = Math.max(0, target - a.users);
                    return (
                      <Flex key={a.appId} flexDirection="column" gap={4} style={{ minWidth: 0 }}>
                        <MeterBarChart value={share} min={0} max={100} color={color} size="size8" formatter={pctFormat}>
                          <MeterBarChart.Label>
                            <AppLink appId={a.appId}>{appName(a.appId)}</AppLink>{primary(a.appId) ? "" : tr(" · shared", " · compartilhado", " · compartida")}
                          </MeterBarChart.Label>
                          <MeterBarChart.Value>{a.users > 0 ? pctFormat(share) : "0%"}</MeterBarChart.Value>
                        </MeterBarChart>
                        <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>
                          {a.users > 0 ? peopleReading(a) : tr(`no users in ${adoption.windowDays} days`, `nenhum usuário em ${adoption.windowDays} dias`, `sin usuarios en ${adoption.windowDays} días`)}
                        </Text>
                        {low && gap > 0 && total > 0 && (
                          <Text textStyle="small" style={{ fontFamily: MONO, color: Colors.Text.Warning.Default }}>
                            {tr(`+${gap.toLocaleString(localeTag(lang))} ${gap === 1 ? "person" : "people"} to reach ${cut}%`,
                              `+${gap.toLocaleString(localeTag(lang))} ${gap === 1 ? "pessoa" : "pessoas"} para chegar a ${cut}%`,
                              `+${gap.toLocaleString(localeTag(lang))} ${gap === 1 ? "persona" : "personas"} para llegar al ${cut}%`)}
                          </Text>
                        )}
                      </Flex>
                    );
                  };
                  const group = (title: string, tip: string, list: typeof apps, low: boolean) => list.length > 0 && (
                    <Flex flexDirection="column" gap={12}>
                      <Tooltip text={tip} containerStyle={{ alignSelf: "flex-start" }}>
                        <Text textStyle="base-emphasized">{title} <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL }}>{list.length}</Text></Text>
                      </Tooltip>
                      <Grid style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px 28px" }}>
                        {list.map(a => row(a, low))}
                      </Grid>
                    </Flex>
                  );
                  return (
                    <>
                      {group(tr("Use more", "Usar mais", "Usar más"), tr(
                        `Apps that serve ${cap.name} and are opened by fewer than ${cut}% of active users, the line below which adoption counts as low. The capability's own apps come first; "+N" is the number of people each needs to reach ${cut}% (${target.toLocaleString(localeTag(lang))} of ${total.toLocaleString(localeTag(lang))}).`,
                        `Apps que atendem ${cap.name} e são abertos por menos de ${cut}% dos usuários ativos, a linha abaixo da qual a adoção é considerada baixa. Os apps da própria capacidade vêm primeiro; "+N" é o número de pessoas que cada um precisa para chegar a ${cut}% (${target.toLocaleString(localeTag(lang))} de ${total.toLocaleString(localeTag(lang))}).`,
                        `Apps que sirven a ${cap.name} y que abren menos del ${cut}% de los usuarios activos, la línea por debajo de la cual la adopción se considera baja. Las apps de la propia capacidad aparecen primero; "+N" es el número de personas que cada una necesita para llegar al ${cut}% (${target.toLocaleString(localeTag(lang))} de ${total.toLocaleString(localeTag(lang))}).`), below, true)}
                      {group(tr("In use", "Em uso", "En uso"), tr(
                        `Apps opened by ${cut}% of active users or more in ${adoption.windowDays} days.`,
                        `Apps abertos por ${cut}% ou mais dos usuários ativos em ${adoption.windowDays} dias.`,
                        `Apps abiertas por el ${cut}% o más de los usuarios activos en ${adoption.windowDays} días.`), above, false)}
                    </>
                  );
                })()}
              </Flex>
            )}
        </Panel>


      </Flex>
    </Flex>
  );
};
