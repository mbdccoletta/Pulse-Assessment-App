// ui/app/reports/pulseReports.ts
//
// The reports, rebuilt on the same model the screens use: one score per
// capability made of coverage, utilization and adoption, a verdict, and the
// actions ordered by what they add to the score.
//
//   overall  — the Overall score page on paper: score, parts, capabilities,
//              where to act first, history, most used apps.
//   plan     — the action plan: per capability, every unmet criterion with
//              its value, its target, what to do and the points it adds.
//   criteria — the full detail: every criterion of every capability.
//   raw data — the same assessment as JSON or CSV, self-describing, so it can
//              be handed to another tool or AI for further analysis.
//
// Light, print-friendly pages. Every number is read from the capability
// results the screens render, and the rules quoted in "How to read" come
// from the same constants the scoring uses.

import { jsPDF } from "jspdf";
import { peopleReading } from "../hooks/useAppAdoption";
import type { CapabilityResult } from "../hooks/useCoverageData";
import { FOUNDATION_WEIGHT, BEST_PRACTICE_WEIGHT, EXCELLENCE_WEIGHT } from "../hooks/useCoverageData";
import type { AssessmentSnapshot } from "../hooks/useAssessmentHistory";
import { ADOPTION_FULL_RATE, gainIfMet } from "../pulseScore";
import { DEFAULT_CUTS, DIAGNOSIS_META, diagnose } from "../diagnosis";
import type { DiagnosisId } from "../diagnosis";
import { passLine } from "../passLine";
import { SCORE_BANDS, scoreBand } from "../utils/colors";
import { CRITERION_ACTIONS, defaultAction } from "../remediationActions";
import { CRITERION_IMPORTANCE } from "../data/criterionImportance";
import { teamsFor, type OwnershipTeam, type Responsibility } from "../teams";
import { telemetryShares, type TelemetryProfile, type TelemetrySource } from "../telemetry";
import { PT } from "./i18n/pt";
import { OTEL_PT } from "./i18n/otel-pt";
import { OTEL_ES } from "./i18n/otel-es";
import { OTEL_SWAPS, MIXED_SWAPS } from "../otel-mode";
import { CAPABILITIES } from "../queries";
import { ES } from "./i18n/es";
import { APP_VERSION } from "../appVersion";
import { IDLE_CPU } from "../finopsData";
import type { FinOpsData } from "../finopsData";

export type ReportKind = "overall" | "plan" | "criteria";
export type ReportLang = "en" | "pt" | "es";

export interface ReportInput {
  capabilities: CapabilityResult[];
  totalScore: number;
  tenant: string;
  date: string;
  adoption?: {
    windowDays: number;
    totalUsers: number;
    byCapability: Record<string, { users: number; rate: number }>;
    apps: { appId: string; users: number; dailyUsers: number; queries: number; capability: string }[];
  };
  history: AssessmentSnapshot[];
  /** App id → display name. */
  appName: (id: string) => string;
  /** The environment's Ownership teams; null or absent when they could not be read. */
  teams?: OwnershipTeam[] | null;
  /** How this run was measured, when it differs from a plain exact run. A
   *  report must say so: the screen does, and a number that is an
   *  approximation there cannot read as exact on paper. */
  run?: {
    /** Trace criteria read from metrics and topology. */
    traceProxy: boolean;
    /** Entity counts read from Smartscape. */
    smartscape: boolean;
    /** Hosts and Kubernetes read from OpenTelemetry signals: no OneAgent reports. */
    otel?: boolean;
    /** OneAgent and OpenTelemetry both report; hosts and Kubernetes counted on both sides. */
    mixed?: boolean;
    /** The telemetry strategy detected on open, with the hosts on each side. */
    telemetry?: TelemetryProfile;
    /** Read at full fidelity (a Dynatrace user): whole windows, unsampled, no scan ceiling. */
    /** Scale tier shortened the windows: values are estimates. */
    estimated: boolean;
    tier?: string;
  };
}

type Row = CapabilityResult["criteriaResults"][number];
type RGB = [number, number, number];
type TierKey = "foundation" | "bestPractice" | "excellence";

// ── Words ───────────────────────────────────────────────────────────────────

interface Words {
  lang: ReportLang;
  product: string;
  titles: Record<ReportKind, string>;
  score: string; overall: string; coverage: string; utilization: string; adoption: string;
  capabilities: string; capability: string; verdict: string; nextStep: string;
  teams: string; noTeams: string; andMore: string; responsibilities: Record<Responsibility, string>;
  actFirst: string; whatToDo: string; criterion: string; value: string; target: string; gain: string;
  tier: string; state: string; met: string; notMet: string; notAssessed: string;
  overTime: string; apps: string; people: string; perMonth: string; perDay: string; ofUsers: string;
  howToRead: string; method: string[];
  nothingAssessed: string; notAssessedNote: string;
  runNotes: { traceProxy: string; smartscape: string; otel: string; mixed: string; estimated: string; partial: string };
  otelSide: string; bothSides: string;
  telemetry: string; strategies: Record<TelemetrySource, string>; telemetryShares: string;
  noActions: string; atLeastOne: string; orMore: string; none: string; page: string; days: string;
  tiers: Record<TierKey, string>;
  bands: Record<string, string>;
  verdicts: Record<DiagnosisId, { label: string; action: string }>;
}

const EN_VERDICTS = Object.fromEntries(
  (Object.keys(DIAGNOSIS_META) as DiagnosisId[]).map(k => [k, { label: DIAGNOSIS_META[k].label, action: DIAGNOSIS_META[k].action }]),
) as Words["verdicts"];

const method = (l: ReportLang): string[] => {
  const f = FOUNDATION_WEIGHT, b = BEST_PRACTICE_WEIGHT, e = EXCELLENCE_WEIGHT, a = ADOPTION_FULL_RATE, c = DEFAULT_CUTS;
  if (l === "pt") return [
    "A pontuação de cada capacidade é a média de três leituras, de 0 a 100. A pontuação geral é a média das capacidades.",
    "Cobertura: os dados existem? É a proporção dos critérios da capacidade que foram atendidos. Um critério é atendido quando o valor medido alcança a meta.",
    `Utilização: quão profunda é a configuração? Os mesmos critérios, agrupados em três níveis com pesos ${f} / ${b} / ${e} (Foundation, Best practice, Excellence). Best practice só conta com Foundation em 80% ou mais; Excellence só conta com Best practice em 60% ou mais.`,
    `Adoção: as pessoas usam? É a proporção de usuários ativos que abriram os apps da capacidade no período. Vale 100 quando chega a ${a}% dos usuários ativos.`,
    `Veredito: lê as três partes juntas e não altera a pontuação. Uma parte é considerada alta a partir de ${c.coverage}% (adoção: ${c.adoptionRate}% dos usuários ativos).`,
    "Ganho: a seta marca os critérios que elevam a pontuação quando passam a ser atendidos. Eles aparecem do maior efeito para o menor.",
  ];
  if (l === "es") return [
    "La puntuación de cada capacidad es el promedio de tres lecturas, de 0 a 100. La puntuación general es el promedio de las capacidades.",
    "Cobertura: ¿existen los datos? Es la proporción de criterios de la capacidad que se cumplen. Un criterio se cumple cuando el valor medido alcanza la meta.",
    `Utilización: ¿qué tan profunda es la configuración? Los mismos criterios, agrupados en tres niveles con pesos ${f} / ${b} / ${e} (Foundation, Best practice, Excellence). Best practice solo cuenta con Foundation en 80% o más; Excellence solo cuenta con Best practice en 60% o más.`,
    `Adopción: ¿la gente lo usa? Es la proporción de usuarios activos que abrieron las apps de la capacidad en el período. Vale 100 cuando llega al ${a}% de los usuarios activos.`,
    `Veredicto: lee las tres partes juntas y no cambia la puntuación. Una parte se considera alta desde ${c.coverage}% (adopción: ${c.adoptionRate}% de los usuarios activos).`,
    "Ganancia: la flecha marca los criterios que elevan la puntuación cuando pasan a cumplirse. Aparecen del mayor efecto al menor.",
  ];
  return [
    "Each capability score is the average of three readings, from 0 to 100. The overall score is the average of the capabilities.",
    "Coverage: is the data there? The share of the capability's criteria that are met. A criterion is met when its measured value reaches its target.",
    `Utilization: how deep is the setup? The same criteria, grouped in three tiers weighted ${f} / ${b} / ${e} (Foundation, Best practice, Excellence). Best practice only counts once Foundation reaches 80%; Excellence only once Best practice reaches 60%.`,
    `Adoption: do people use it? The share of active users who opened the capability's apps in the period. It counts as 100 at ${a}% of active users.`,
    `Verdict: reads the three parts together and does not change the score. A part is high from ${c.coverage}% (adoption: ${c.adoptionRate}% of active users).`,
    "Gain: an arrow marks the criteria that raise the score when they become met. They are listed from the largest effect to the smallest.",
  ];
};

const WORDS: Record<ReportLang, Words> = {
  en: {
    lang: "en",
    product: "Pulse Assessment",
    titles: { overall: "Overall score", plan: "Action plan", criteria: "Criteria detail" },
    score: "Score", overall: "Overall score", coverage: "Coverage", utilization: "Utilization", adoption: "Adoption",
    capabilities: "Capabilities", capability: "Capability", verdict: "Verdict", nextStep: "Next step",
    teams: "Teams to involve", noTeams: "no team registered in Ownership", andMore: "and {n} more",
    responsibilities: { development: "Development", security: "Security", operations: "Operations", infrastructure: "Infrastructure", lineOfBusiness: "Line of business" },
    actFirst: "Where to act first", whatToDo: "What to do", criterion: "Criterion", value: "Value", target: "Target", gain: "Gain",
    tier: "Tier", state: "State", met: "Met", notMet: "Not met", notAssessed: "Not assessed",
    overTime: "Score over time", apps: "Most used apps", people: "people", perMonth: "a month", perDay: "a day", ofUsers: "of active users",
    howToRead: "How to read this report", method: method("en"),
    nothingAssessed: "None of this capability's criteria could be assessed in this environment.",
    notAssessedNote: "Not assessed: the criterion could not be measured in this environment (for example, there is nothing of that kind to measure). It is left out of the score and never counts as not met.",
    runNotes: {
      traceProxy: "Trace criteria were read from metrics and topology because this environment has no trace queries: those readings are approximations.",
      partial: "Values marked ~ are partial: the query stopped at the scan ceiling and covers part of its window.",
      mixed: "Part of this environment is monitored by OneAgent and part only through OpenTelemetry; hosts, Kubernetes and logs were counted on both sides, and a host seen by both counts once.",
      otel: "No OneAgent reports in this environment, so hosts, Kubernetes and their logs were read from the OpenTelemetry metrics and attributes; criteria that only exist with OneAgent were left out of the score.",
      smartscape: "Entity counts were read from Smartscape because this environment has no classic entity tables; criteria with no Smartscape equivalent were left out of the score.",
      estimated: "Log, span and event criteria were read from a shortened window, so their values are estimates.",
    },
    telemetry: "Telemetry strategy", strategies: { oneagent: "Full OneAgent", mixed: "Mixed", otel: "Pure OpenTelemetry" }, telemetryShares: "OneAgent {oa}% of hosts, OpenTelemetry only {ot}%",
    otelSide: "For hosts reported through OpenTelemetry", bothSides: "Counts hosts and Kubernetes monitored by OneAgent and those reported through OpenTelemetry.",
    noActions: "Every assessed criterion is met.", atLeastOne: "at least 1", orMore: "or more", none: "None", page: "Page", days: "days",
    tiers: { foundation: "Foundation", bestPractice: "Best practice", excellence: "Excellence" },
    bands: { Critical: "Critical", Low: "Low", Moderate: "Moderate", Good: "Good", Excellent: "Excellent" },
    verdicts: EN_VERDICTS,
  },
  pt: {
    lang: "pt",
    product: "Pulse Assessment",
    titles: { overall: "Pontuação geral", plan: "Plano de ação", criteria: "Detalhe dos critérios" },
    score: "Pontuação", overall: "Pontuação geral", coverage: "Cobertura", utilization: "Utilização", adoption: "Adoção",
    capabilities: "Capacidades", capability: "Capacidade", verdict: "Veredito", nextStep: "Próximo passo",
    teams: "Times a envolver", noTeams: "nenhum time cadastrado no Ownership", andMore: "e mais {n}",
    responsibilities: { development: "Desenvolvimento", security: "Segurança", operations: "Operações", infrastructure: "Infraestrutura", lineOfBusiness: "Linha de negócio" },
    actFirst: "Onde agir primeiro", whatToDo: "O que fazer", criterion: "Critério", value: "Valor", target: "Meta", gain: "Ganho",
    tier: "Nível", state: "Estado", met: "Atendido", notMet: "Não atendido", notAssessed: "Não avaliado",
    overTime: "Pontuação ao longo do tempo", apps: "Apps mais usados", people: "pessoas", perMonth: "no mês", perDay: "por dia", ofUsers: "dos usuários ativos",
    howToRead: "Como ler este relatório", method: method("pt"),
    nothingAssessed: "Nenhum critério desta capacidade pôde ser avaliado neste ambiente.",
    notAssessedNote: "Não avaliado: o critério não pôde ser medido neste ambiente (por exemplo, não há nada desse tipo para medir). Fica fora da pontuação e nunca conta como não atendido.",
    runNotes: {
      traceProxy: "Os critérios de trace foram lidos de métricas e topologia porque este ambiente não tem consulta de traces: essas leituras são aproximações.",
      partial: "Valores marcados com ~ são parciais: a consulta parou no teto de varredura e cobre parte da janela.",
      mixed: "Parte deste ambiente é monitorada pelo OneAgent e parte só via OpenTelemetry; hosts, Kubernetes e logs foram contados dos dois lados, e um host visto pelos dois conta uma vez.",
      otel: "Nenhum OneAgent reporta neste ambiente, então hosts, Kubernetes e seus logs foram lidos das métricas e atributos do OpenTelemetry; critérios que só existem com OneAgent ficaram fora da pontuação.",
      smartscape: "As contagens de entidades foram lidas do Smartscape porque este ambiente não tem as tabelas clássicas de entidades; critérios sem equivalente no Smartscape ficaram fora da pontuação.",
      estimated: "Os critérios de logs, spans e eventos foram lidos de uma janela reduzida, portanto seus valores são estimativas.",
    },
    telemetry: "Estratégia de telemetria", strategies: { oneagent: "OneAgent completo", mixed: "Misto", otel: "OpenTelemetry puro" }, telemetryShares: "OneAgent {oa}% dos hosts, só OpenTelemetry {ot}%",
    otelSide: "Para os hosts reportados via OpenTelemetry", bothSides: "Conta hosts e Kubernetes monitorados pelo OneAgent e os reportados via OpenTelemetry.",
    noActions: "Todos os critérios avaliados estão atendidos.", atLeastOne: "ao menos 1", orMore: "ou mais", none: "Nenhum", page: "Página", days: "dias",
    tiers: { foundation: "Foundation", bestPractice: "Best practice", excellence: "Excellence" },
    bands: { Critical: "Crítico", Low: "Baixo", Moderate: "Moderado", Good: "Bom", Excellent: "Excelente" },
    verdicts: {
      unwatched: { label: "Sem audiência", action: "Dê um dono e um destino: um dashboard, um SLO ou um alerta que alguém realmente abre." },
      starved: { label: "Subalimentada", action: "Amplie a cobertura primeiro: a demanda já existe, então este é o melhor retorno do plano." },
      skinDeep: { label: "Superficial", action: "Ative os critérios de Best practice e Excellence que faltam; a audiência já está lá." },
      dark: { label: "Apagada", action: "Tome uma decisão explícita: investir ou tirar do escopo." },
      healthy: { label: "Saudável", action: "Use como prova. Este é o padrão a replicar nas outras capacidades." },
      notAssessed: { label: "Não avaliada", action: "Descubra por que os critérios não puderam ser medidos antes de ler qualquer número." },
    },
  },
  es: {
    lang: "es",
    product: "Pulse Assessment",
    titles: { overall: "Puntuación general", plan: "Plan de acción", criteria: "Detalle de criterios" },
    score: "Puntuación", overall: "Puntuación general", coverage: "Cobertura", utilization: "Utilización", adoption: "Adopción",
    capabilities: "Capacidades", capability: "Capacidad", verdict: "Veredicto", nextStep: "Próximo paso",
    teams: "Equipos a involucrar", noTeams: "ningún equipo registrado en Ownership", andMore: "y {n} más",
    responsibilities: { development: "Desarrollo", security: "Seguridad", operations: "Operaciones", infrastructure: "Infraestructura", lineOfBusiness: "Línea de negocio" },
    actFirst: "Dónde actuar primero", whatToDo: "Qué hacer", criterion: "Criterio", value: "Valor", target: "Meta", gain: "Ganancia",
    tier: "Nivel", state: "Estado", met: "Cumplido", notMet: "No cumplido", notAssessed: "No evaluado",
    overTime: "Puntuación en el tiempo", apps: "Apps más usadas", people: "personas", perMonth: "al mes", perDay: "al día", ofUsers: "de los usuarios activos",
    howToRead: "Cómo leer este informe", method: method("es"),
    nothingAssessed: "Ningún criterio de esta capacidad pudo evaluarse en este entorno.",
    notAssessedNote: "No evaluado: el criterio no pudo medirse en este entorno (por ejemplo, no hay nada de ese tipo que medir). Queda fuera de la puntuación y nunca cuenta como no cumplido.",
    runNotes: {
      traceProxy: "Los criterios de trazas se leyeron de métricas y topología porque este entorno no tiene consulta de trazas: esas lecturas son aproximaciones.",
      partial: "Los valores marcados con ~ son parciales: la consulta se detuvo en el techo de escaneo y cubre parte de la ventana.",
      mixed: "Parte de este entorno se monitorea con OneAgent y parte solo mediante OpenTelemetry; hosts, Kubernetes y logs se contaron en ambos lados, y un host visto por los dos cuenta una vez.",
      otel: "Ningún OneAgent reporta en este entorno, por lo que hosts, Kubernetes y sus logs se leyeron de las métricas y atributos de OpenTelemetry; los criterios que solo existen con OneAgent quedaron fuera de la puntuación.",
      smartscape: "Los conteos de entidades se leyeron de Smartscape porque este entorno no tiene las tablas clásicas de entidades; los criterios sin equivalente en Smartscape quedaron fuera de la puntuación.",
      estimated: "Los criterios de logs, spans y eventos se leyeron de una ventana reducida, por lo que sus valores son estimaciones.",
    },
    telemetry: "Estrategia de telemetría", strategies: { oneagent: "OneAgent completo", mixed: "Mixto", otel: "OpenTelemetry puro" }, telemetryShares: "OneAgent {oa}% de los hosts, solo OpenTelemetry {ot}%",
    otelSide: "Para los hosts reportados mediante OpenTelemetry", bothSides: "Cuenta hosts y Kubernetes monitoreados por OneAgent y los reportados mediante OpenTelemetry.",
    noActions: "Todos los criterios evaluados se cumplen.", atLeastOne: "al menos 1", orMore: "o más", none: "Ninguno", page: "Página", days: "días",
    tiers: { foundation: "Foundation", bestPractice: "Best practice", excellence: "Excellence" },
    bands: { Critical: "Crítico", Low: "Bajo", Moderate: "Moderado", Good: "Bueno", Excellent: "Excelente" },
    verdicts: {
      unwatched: { label: "Sin audiencia", action: "Asigne un dueño y un destino: un dashboard, un SLO o una alerta que alguien realmente abre." },
      starved: { label: "Desabastecida", action: "Amplíe primero la cobertura: la demanda ya existe, así que es el mejor retorno del plan." },
      skinDeep: { label: "Superficial", action: "Active los criterios de Best practice y Excellence que faltan; la audiencia ya está." },
      dark: { label: "Apagada", action: "Tome una decisión explícita: invertir o sacarla del alcance." },
      healthy: { label: "Saludable", action: "Úsela como prueba. Este es el patrón a replicar en las demás capacidades." },
      notAssessed: { label: "No evaluada", action: "Averigüe por qué no se pudieron medir los criterios antes de leer cualquier número." },
    },
  },
};

// ── Shared readings (also used by the raw export) ───────────────────────────

const stateOf = (r: Row): "met" | "notMet" | "notAssessed" => (r.notAssessed || r.error ? "notAssessed" : r.points > 0 ? "met" : "notMet");
const cleanLabel = (r: Row) => r.label.replace(/\s*\(%\)\s*$/, "");

/** A criterion's name, description and action in the report's language.
 *  English is the catalog itself; a criterion missing from a translation falls
 *  back to English rather than print nothing. Capability names stay as
 *  Dynatrace writes them: they are product names. */
const CRITERION_TEXT: Partial<Record<ReportLang, Record<string, { label: string; description: string; action: string }>>> = { pt: PT, es: ES };
/** Set per report: the run read hosts and Kubernetes from OpenTelemetry, so the
 *  swapped criteria take their OpenTelemetry texts in every language. */
let otelRun = false;
/** Set per report: OneAgent and OpenTelemetry both report. */
let mixedRun = false;
let mixedWords = { otelSide: "", bothSides: "" };
/** The catalog's own descriptions and actions, before any environment override. */
const DEFAULT_DESCRIPTION: Record<string, string> = Object.fromEntries(CAPABILITIES.flatMap(c => c.criteria.map(k => [k.id, k.description])));
const OTEL_TEXT: Partial<Record<ReportLang, Record<string, { label?: string; description: string; action: string }>>> = { pt: OTEL_PT, es: OTEL_ES };
function textOf(r: Row, lang: ReportLang): { label: string; description: string; action: string | undefined } {
  if (mixedRun && MIXED_SWAPS[r.id]) {
    // Both sides: the criterion's own text, plus what it counts and the OpenTelemetry action.
    const t = CRITERION_TEXT[lang]?.[r.id];
    const base = t?.action || defaultAction(r.id)?.action;
    const otelAct = OTEL_TEXT[lang]?.[r.id]?.action ?? OTEL_SWAPS[r.id]?.action;
    return {
      label: t?.label || cleanLabel(r),
      description: `${t?.description || DEFAULT_DESCRIPTION[r.id] || r.description} ${mixedWords.bothSides}`,
      action: base && otelAct ? `${base} ${mixedWords.otelSide}: ${otelAct.charAt(0).toLowerCase()}${otelAct.slice(1)}` : base,
    };
  }
  const o = otelRun && OTEL_SWAPS[r.id] ? OTEL_TEXT[lang]?.[r.id] : undefined;
  if (o) return { label: o.label || CRITERION_TEXT[lang]?.[r.id]?.label || cleanLabel(r), description: o.description, action: o.action };
  // English (and any language without an OpenTelemetry text) reads the swapped criterion itself.
  if (otelRun && OTEL_SWAPS[r.id]) return { label: OTEL_SWAPS[r.id].label ? cleanLabel(r) : (CRITERION_TEXT[lang]?.[r.id]?.label || cleanLabel(r)), description: r.description, action: CRITERION_ACTIONS[r.id]?.action };
  const t = CRITERION_TEXT[lang]?.[r.id];
  return {
    label: t?.label || cleanLabel(r),
    description: t?.description || r.description,
    action: t?.action || CRITERION_ACTIONS[r.id]?.action,
  };
}
const isPresence = (r: Row) => r.count != null;

function targetOf(r: Row): number | null {
  if (isPresence(r)) return 1;
  const nums = (r.thresholds.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  return nums.length ? passLine(nums) : null;
}
function valueOf(r: Row): number | null {
  if (stateOf(r) === "notAssessed") return null;
  return isPresence(r) ? (r.count ?? 0) : Math.floor(r.value * 10) / 10;
}
const unitOf = (r: Row) => (isPresence(r) ? "count" : r.isRatio ? "percent" : "number");

function verdictOf(c: CapabilityResult, input: ReportInput) {
  const ad = input.adoption?.byCapability[c.name];
  return diagnose({
    coverage: c.coverageScore ?? c.score,
    utilization: c.effectiveUtilizationScore,
    users: input.adoption ? (ad?.users ?? 0) : undefined,
    rate: input.adoption ? (ad?.rate ?? 0) : undefined,
    totalUsers: input.adoption?.totalUsers,
    windowDays: input.adoption?.windowDays,
    notAssessedCount: c.notAssessedCount,
    totalCount: c.criteriaResults.length,
  });
}

const avg = (xs: number[]) => (xs.length ? Math.floor(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const round1 = (n: number) => Math.floor(n * 10 + 1e-9) / 10;

function overallParts(caps: CapabilityResult[]) {
  const ad = caps.map(c => c.adoptionScore).filter((x): x is number => x != null);
  return {
    coverage: avg(caps.map(c => c.coverageScore ?? c.score)),
    utilization: avg(caps.map(c => c.effectiveUtilizationScore)),
    adoption: ad.length ? avg(ad) : null,
  };
}

/** Runs scored with the three parts, oldest first. */
const comparableRuns = (h: AssessmentSnapshot[]) => [...h]
  .filter(s => s.capabilities.some(c => c.coverage != null))
  .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

// ── PDF kit ─────────────────────────────────────────────────────────────────

const INK: RGB = [22, 22, 29];
const DIM: RGB = [105, 108, 125];
const RULE: RGB = [222, 224, 232];
const TRACK: RGB = [234, 236, 242];
const ACCENT: RGB = [28, 82, 194];
const PART_RGB: Record<"coverage" | "utilization" | "adoption", RGB> = { coverage: [20, 112, 232], utilization: [134, 96, 222], adoption: [20, 158, 168] };
const PASS: RGB = [34, 150, 100];
const FAIL: RGB = [200, 50, 60];
const VERDICT_RGB: Record<DiagnosisId, RGB> = {
  unwatched: [200, 80, 60], starved: [40, 100, 200], skinDeep: [176, 132, 0], dark: [90, 92, 105], healthy: [34, 150, 100], notAssessed: [130, 132, 145],
};

const hex = (h: string): RGB => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : DIM;
};
const bandRgb = (score: number): RGB => hex(scoreBand(score).color);

/** jsPDF's built-in fonts are Latin-1: swap what they cannot draw. */
const safe = (s: string) => s
  .replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/→/g, "->").replace(/≈/g, "~")
  .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[—–−]/g, "-").replace(/…/g, "...")
  .replace(/€/g, "EUR").replace(/•/g, "-").replace(/[\u2009\u202F\u00A0]/g, " ")
  .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

function kit(title: string, W_: Words, input: ReportInput) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 16, CW = W - 2 * M;
  let y = 0;

  const color = (c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
  const fill = (c: RGB) => pdf.setFillColor(c[0], c[1], c[2]);
  const font = (size: number, bold = false) => { pdf.setFontSize(size); pdf.setFont("helvetica", bold ? "bold" : "normal"); };
  const text = (s: string, x: number, yy: number, o?: { align?: "left" | "right" | "center" }) => pdf.text(safe(s), x, yy, o);
  const rule = (yy: number) => { pdf.setDrawColor(RULE[0], RULE[1], RULE[2]); pdf.setLineWidth(0.2); pdf.line(M, yy, W - M, yy); };

  const pageHead = () => {
    font(8, true); color(ACCENT); text(`${W_.product}  ·  ${title}`.replace("·", "|"), M, 11);
    font(8); color(DIM); text(`${input.tenant}  |  ${input.date}`, W - M, 11, { align: "right" });
    rule(14);
    y = 24;
  };
  const ensure = (need: number) => { if (y + need > H - 16) { pdf.addPage(); pageHead(); } };

  const h1 = (s: string) => { font(22, true); color(INK); text(s, M, y); y += 10; };
  const h2 = (s: string, keep = 16) => { ensure(keep); y += 3; font(13, true); color(INK); text(s, M, y); y += 2.5; rule(y); y += 6; };

  /** Wrapped paragraph; returns nothing, advances y. */
  const para = (s: string, o: { size?: number; c?: RGB; x?: number; w?: number; bold?: boolean; gap?: number } = {}) => {
    const size = o.size ?? 9, x = o.x ?? M, w = o.w ?? CW - (x - M);
    font(size, o.bold); color(o.c ?? INK);
    const lh = size * 0.46;
    for (const ln of pdf.splitTextToSize(safe(s), w) as string[]) { ensure(lh + 1); pdf.text(ln, x, y); y += lh; }
    y += o.gap ?? 1.5;
  };

  /** Horizontal meter: track plus fill, 0–100. */
  const meter = (x: number, yy: number, w: number, v: number | null, c: RGB, h = 2.2) => {
    fill(TRACK); pdf.roundedRect(x, yy, w, h, h / 2, h / 2, "F");
    if (v != null && v > 0) { fill(c); pdf.roundedRect(x, yy, Math.max(h, (w * Math.min(100, v)) / 100), h, h / 2, h / 2, "F"); }
  };
  const dot = (x: number, yy: number, c: RGB, r = 1.2) => { fill(c); pdf.circle(x, yy, r, "F"); };
  /** Status mark: circle = met, diamond = not met, ring = not assessed. */
  const mark = (x: number, yy: number, st: "met" | "notMet" | "notAssessed") => {
    if (st === "met") { fill(PASS); pdf.circle(x, yy, 1.1, "F"); }
    else if (st === "notMet") { fill(FAIL); pdf.triangle(x - 1.3, yy, x, yy - 1.3, x + 1.3, yy, "F"); pdf.triangle(x - 1.3, yy, x, yy + 1.3, x + 1.3, yy, "F"); }
    else { pdf.setDrawColor(DIM[0], DIM[1], DIM[2]); pdf.setLineWidth(0.3); pdf.circle(x, yy, 1, "S"); }
  };

  const finish = () => {
    const n = pdf.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      pdf.setPage(i);
      font(7); color(DIM);
      text(`${W_.product} ${APP_VERSION}`, M, H - 8);
      text(`${W_.page} ${i} / ${n}`, W - M, H - 8, { align: "right" });
    }
    return pdf;
  };

  pageHead();
  return {
    pdf, W, H, M, CW,
    get y() { return y; }, set y(v: number) { y = v; },
    color, fill, font, text, rule, ensure, h1, h2, para, meter, dot, mark, finish,
  };
}

type Kit = ReturnType<typeof kit>;

// ── Blocks ──────────────────────────────────────────────────────────────────

const fmtPct = (v: number | null) => (v == null ? "-" : `${Math.floor(v)}%`);

function fmtValue(r: Row, T: Words): string {
  const v = valueOf(r);
  if (v == null) return T.notAssessed;
  // "~" marks a partial read (stopped at the scan ceiling); the run notes explain it.
  const p = r.partial ? "~" : "";
  if (isPresence(r)) return v === 0 ? T.none : `${p}${v.toLocaleString()}`;
  return r.isRatio ? `${p}${v}%` : `${p}${v.toLocaleString()}`;
}
function fmtTarget(r: Row, T: Words): string {
  const t = targetOf(r);
  if (t == null) return "-";
  if (isPresence(r)) return T.atLeastOne;
  if (r.isRatio) return t >= 100 ? "100%" : `${t}% ${T.orMore}`;
  return `${t} ${T.orMore}`;
}

/** Title, big score and the three parts. */
function scoreBlock(k: Kit, T: Words, label: string, score: number, parts: { coverage: number; utilization: number; adoption: number | null }) {
  const { M, CW } = k;
  const top = k.y;
  const c = bandRgb(score);
  k.font(9, true); k.color(DIM); k.text(label.toUpperCase(), M, top);
  k.font(40, true); k.color(c); k.text(`${score}%`, M, top + 15);
  k.font(11, true); k.text(T.bands[scoreBand(score).label] ?? scoreBand(score).label, M, top + 21);
  k.meter(M, top + 24, 52, score, c, 2.6);

  const x = M + 68, w = CW - 68;
  (["coverage", "utilization", "adoption"] as const).forEach((p, i) => {
    const yy = top + 3 + i * 9;
    const v = parts[p];
    k.dot(x + 1.2, yy - 1, PART_RGB[p]);
    k.font(10); k.color(INK); k.text(T[p], x + 5, yy);
    k.font(10, true); k.text(fmtPct(v), x + w, yy, { align: "right" });
    k.meter(x, yy + 1.8, w, v, PART_RGB[p]);
  });
  k.y = top + 34;
}

/** How the run was measured, when it was not a plain exact run. */
/** The Overview radar, drawn in the page: one sector per capability with its
 *  three parts as radial bars, the capability colour on the outer arc, and the
 *  name and score outside. Vector, so it prints sharp at any size. */
function radarBlock(k: Kit, T: Words, caps: CapabilityResult[], total: number) {
  const { pdf, W, M } = k;
  const R = 36, hole = 12.5, H = 2 * R + 34;
  k.ensure(H + 4);
  const cx = W / 2, cy = k.y + R + 15;
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const at = (r: number, deg: number): [number, number] => [cx + Math.cos(rad(deg)) * r, cy + Math.sin(rad(deg)) * r];
  /** Annular sector as a filled polygon, arcs sampled every 2 degrees. */
  const sector = (r0: number, r1: number, a0: number, a1: number, c: RGB) => {
    const n = Math.max(2, Math.ceil((a1 - a0) / 2));
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) pts.push(at(r1, a0 + ((a1 - a0) * i) / n));
    for (let i = n; i >= 0; i--) pts.push(at(r0, a0 + ((a1 - a0) * i) / n));
    k.fill(c);
    pdf.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], "F", true);
  };
  const TRACK: RGB = [236, 238, 243];
  const keys = ["coverage", "utilization", "adoption"] as const;

  // legend
  keys.forEach((p, i) => {
    k.dot(M + 1.2, k.y + 3 + i * 5, PART_RGB[p]);
    k.font(8); k.color(INK); k.text(T[p], M + 4.5, k.y + 4 + i * 5);
  });

  // scale rings: 25 / 50 / 75 / 100
  pdf.setDrawColor(RULE[0], RULE[1], RULE[2]); pdf.setLineWidth(0.15);
  for (const q of [0.25, 0.5, 0.75, 1]) pdf.circle(cx, cy, hole + (R - hole) * q, "S");

  const step = 360 / caps.length, gap = Math.min(5, step * 0.12);
  caps.forEach((c, i) => {
    const a0 = i * step + gap / 2, a1 = (i + 1) * step - gap / 2, mid = (a0 + a1) / 2;
    const values = [c.coverageScore ?? c.score, c.effectiveUtilizationScore, c.adoptionScore ?? null];
    const w = (a1 - a0) / 3;
    keys.forEach((p, j) => {
      const b0 = a0 + j * w + 0.5, b1 = a0 + (j + 1) * w - 0.5;
      sector(hole, R, b0, b1, TRACK);
      const v = values[j];
      if (v != null) sector(hole, hole + (R - hole) * Math.max(0.02, Math.min(100, v) / 100), b0, b1, PART_RGB[p]);
    });
    sector(R + 1.2, R + 2.4, a0, a1, hex(c.color));
    // name and score outside, on the sector's side of the chart
    const [ex, ey] = at(R + 5.5, mid);
    const side = Math.abs(ex - cx) < R * 0.25 ? 0 : ex > cx ? 1 : -1;
    const align = side === 0 ? "center" : side > 0 ? "left" : "right";
    const lx = ex + side * 1.5;
    const ly = side !== 0 ? ey : ey < cy ? ey - 4 : ey + 3.5;
    k.font(7.5, true); k.color(INK); k.text(c.name, lx, ly, { align });
    const band = scoreBand(c.score);
    k.font(7.5, true); k.color(bandRgb(c.score)); k.text(`${c.score}%  ${T.bands[band.label] ?? band.label}`, lx, ly + 3.4, { align });
  });

  // centre: the overall score
  k.fill([255, 255, 255]); pdf.circle(cx, cy, hole - 0.6, "F");
  k.font(15, true); k.color(bandRgb(total)); k.text(`${total}%`, cx, cy + 1.2, { align: "center" });
  k.font(6); k.color(DIM); k.text(T.overall.toUpperCase(), cx, cy + 5, { align: "center" });
  k.y += H;
}

function runNotes(k: Kit, T: Words, input: ReportInput) {
  const r = input.run;
  if (!r) return;
  if (r.telemetry) {
    const sh = telemetryShares(r.telemetry);
    const detail = r.telemetry.source === "mixed" ? ` (${T.telemetryShares.replace("{oa}", String(sh.oneAgent)).replace("{ot}", String(sh.otelOnly))})` : "";
    k.font(9, true); k.color(INK); k.text(`${T.telemetry}: ${T.strategies[r.telemetry.source]}${detail}`, k.M, k.y); k.y += 5.5;
  }
  const anyPartial = input.capabilities.some(c => c.criteriaResults.some(x => x.partial));
  const lines = [anyPartial ? T.runNotes.partial : "", r.traceProxy ? T.runNotes.traceProxy : "", r.smartscape ? T.runNotes.smartscape : "", r.otel ? T.runNotes.otel : "", r.mixed ? T.runNotes.mixed : "", r.estimated ? T.runNotes.estimated : ""].filter(Boolean);
  for (const line of lines) k.para(line, { size: 8.5, c: DIM, gap: 1.5 });
  if (lines.length) k.y += 2;
}

/** What to print under a capability with nothing left to do. */
const doneLine = (c: CapabilityResult, T: Words) => (c.assessedCount === 0 ? T.nothingAssessed : T.noActions);

/** One line per capability: score bar, the three parts, the verdict. */
function capabilityTable(k: Kit, T: Words, caps: CapabilityResult[], input: ReportInput) {
  const { M, CW } = k;
  const col = { name: M + 4, bar: M + 58, score: M + 94, cov: M + 110, util: M + 126, adop: M + 142, verdict: M + CW };
  k.font(7.5, true); k.color(DIM);
  k.text(T.capability, col.name, k.y);
  k.text(T.score, col.score, k.y, { align: "right" });
  k.text(T.coverage, col.cov, k.y, { align: "right" });
  k.text(T.utilization, col.util, k.y, { align: "right" });
  k.text(T.adoption, col.adop, k.y, { align: "right" });
  k.text(T.verdict, col.verdict, k.y, { align: "right" });
  k.y += 2; k.rule(k.y); k.y += 5;
  for (const c of caps) {
    k.ensure(8);
    const dx = verdictOf(c, input);
    k.dot(M + 1.2, k.y - 1, hex(c.color));
    k.font(9.5, true); k.color(INK); k.text(c.name, col.name, k.y);
    k.meter(col.bar, k.y - 2.2, 24, c.score, bandRgb(c.score));
    k.font(9.5, true); k.color(bandRgb(c.score)); k.text(`${c.score}%`, col.score, k.y, { align: "right" });
    k.font(9); k.color(INK);
    k.text(fmtPct(c.coverageScore ?? c.score), col.cov, k.y, { align: "right" });
    k.text(fmtPct(c.effectiveUtilizationScore), col.util, k.y, { align: "right" });
    k.text(fmtPct(c.adoptionScore ?? null), col.adop, k.y, { align: "right" });
    k.font(8, true); k.color(VERDICT_RGB[dx.id]); k.text(T.verdicts[dx.id].label.toUpperCase(), col.verdict, k.y, { align: "right" });
    k.y += 7;
  }
  k.y += 2;
}

interface Action { c: CapabilityResult; r: Row; gain: number }

/** Unmet criteria as actions. `showCap` adds the capability under the name. */
function actionRows(k: Kit, T: Words, actions: Action[], o: { showCap: boolean; detail: boolean }) {
  const { M, CW } = k;
  const col = { name: M + 5, value: M + 118, target: M + 152, gain: M + CW };
  k.font(7.5, true); k.color(DIM);
  k.text(T.criterion, col.name, k.y);
  k.text(T.value, col.value, k.y, { align: "right" });
  k.text(T.target, col.target, k.y, { align: "right" });
  k.text(T.gain, col.gain, k.y, { align: "right" });
  k.y += 2; k.rule(k.y); k.y += 5;
  for (const a of actions) {
    k.ensure(o.detail ? 20 : 10);
    k.mark(M + 1.4, k.y - 1, "notMet");
    k.font(9.5, true); k.color(INK); k.text(textOf(a.r, T.lang).label, col.name, k.y);
    k.font(9); k.text(fmtValue(a.r, T), col.value, k.y, { align: "right" });
    k.color(DIM); k.text(fmtTarget(a.r, T), col.target, k.y, { align: "right" });
    // Gain as a mark, not a number: an up arrow when meeting it raises the score, a dash when it does not.
    {
      const ax = col.gain - 2.2, ay = k.y - 1.2;
      if (a.gain > 0) {
        k.fill(PASS);
        k.pdf.triangle(ax - 1.7, ay, ax + 1.7, ay, ax, ay - 2.2, "F");
        k.pdf.rect(ax - 0.45, ay, 0.9, 1.9, "F");
      } else {
        k.pdf.setDrawColor(DIM[0], DIM[1], DIM[2]); k.pdf.setLineWidth(0.5); k.pdf.line(ax - 1.6, ay, ax + 1.6, ay);
      }
    }
    k.y += 4.2;
    if (o.showCap) { k.font(8); k.color(DIM); k.text(`${a.c.name}  |  ${T.tiers[a.r.tier]}`, col.name, k.y); k.y += 4; }
    if (o.detail) {
      if (!o.showCap) { k.font(8); k.color(DIM); k.text(T.tiers[a.r.tier], col.name, k.y); k.y += 4; }
      k.para(textOf(a.r, T.lang).description, { size: 8, c: DIM, x: col.name, w: CW - 5, gap: 0.8 });
      const act = textOf(a.r, T.lang).action;
      if (act) k.para(`${T.whatToDo}: ${act}`, { size: 8.5, x: col.name, w: CW - 8, gap: 0.8 });
    }
    k.y += 2.5;
  }
}

function methodBlock(k: Kit, T: Words) {
  k.h2(T.howToRead, 40);
  for (const line of [...T.method, T.notAssessedNote]) k.para(line, { size: 8.5, c: DIM, gap: 2 });
  // Bands
  k.ensure(8);
  let x = k.M;
  for (const b of [...SCORE_BANDS].reverse()) {
    const label = `${T.bands[b.label] ?? b.label} ${b.min}-${b.max === 100 ? 100 : b.max - 1}`;
    k.dot(x + 1.2, k.y - 1, hex(b.color));
    k.font(8); k.color(INK); k.text(label, x + 4, k.y);
    x += k.pdf.getTextWidth(label) + 10;
  }
  k.y += 6;
}

function trendBlock(k: Kit, T: Words, input: ReportInput) {
  const runs = comparableRuns(input.history).slice(-30);
  if (runs.length < 2) return;
  k.h2(T.overTime, 58);
  const { M, CW, pdf } = k;
  const x0 = M + 10, w = CW - 12, h = 30, top = k.y;
  pdf.setDrawColor(RULE[0], RULE[1], RULE[2]); pdf.setLineWidth(0.15);
  for (const g of [0, 50, 100]) {
    const yy = top + h - (h * g) / 100;
    pdf.line(x0, yy, x0 + w, yy);
    k.font(7); k.color(DIM); k.text(`${g}`, x0 - 2, yy + 1, { align: "right" });
  }
  const t0 = new Date(runs[0].timestamp).getTime(), t1 = new Date(runs[runs.length - 1].timestamp).getTime();
  const px = (s: AssessmentSnapshot) => x0 + (t1 === t0 ? 0 : ((new Date(s.timestamp).getTime() - t0) / (t1 - t0)) * w);
  const py = (v: number) => top + h - (h * Math.min(100, Math.max(0, v))) / 100;
  pdf.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]); pdf.setLineWidth(0.6);
  for (let i = 1; i < runs.length; i++) pdf.line(px(runs[i - 1]), py(runs[i - 1].totalScore), px(runs[i]), py(runs[i].totalScore));
  for (const s of runs) k.dot(px(s), py(s.totalScore), ACCENT, 0.8);
  const d = (s: AssessmentSnapshot) => new Date(s.timestamp).toISOString().slice(0, 10);
  k.font(7); k.color(DIM);
  k.text(`${d(runs[0])}  |  ${runs[0].totalScore}%`, x0, top + h + 4);
  k.text(`${d(runs[runs.length - 1])}  |  ${runs[runs.length - 1].totalScore}%`, x0 + w, top + h + 4, { align: "right" });
  k.y = top + h + 10;
}

function appsBlock(k: Kit, T: Words, input: ReportInput) {
  const ad = input.adoption;
  if (!ad || ad.apps.length === 0 || ad.totalUsers === 0) return;
  k.h2(`${T.apps}  (${ad.windowDays} ${T.days})`, 34);
  const { M, CW } = k;
  for (const a of ad.apps.slice(0, 10)) {
    k.ensure(8);
    const share = Math.floor((a.users / ad.totalUsers) * 1000) / 10;
    k.font(9.5, true); k.color(INK); k.text(input.appName(a.appId), M, k.y);
    k.meter(M + 62, k.y - 2.2, 40, share, ACCENT);
    k.font(9, true); k.text(`${share}%`, M + 116, k.y, { align: "right" });
    k.font(8.5); k.color(DIM);
    k.text(peopleReading(a, T.perMonth, T.perDay, T.people), M + CW, k.y, { align: "right" });
    k.y += 6.5;
  }
  k.y += 2;
}

/** Capability heading used by the plan and the criteria detail. */
/** Teams to involve in a capability, one line per responsibility it calls
 *  for: "Security: A, B". From the environment's Ownership teams. */
const TEAMS_SHOWN = 8;
function teamsLines(T: Words, capability: string, input: ReportInput): { label: string; names: string }[] {
  return teamsFor(capability, input.teams).map(g => {
    const shown = g.teams.slice(0, TEAMS_SHOWN).join(", ");
    return {
      label: T.responsibilities[g.responsibility],
      names: g.teams.length === 0 ? T.noTeams : g.teams.length > TEAMS_SHOWN ? `${shown} ${T.andMore.replace("{n}", String(g.teams.length - TEAMS_SHOWN))}` : shown,
    };
  });
}
/** The lines, drawn: the responsibility in ink, its teams beside it. */
function teamsRows(k: Kit, T: Words, capability: string, input: ReportInput, x: number, w: number) {
  for (const g of teamsLines(T, capability, input)) {
    k.ensure(6);
    k.font(8.5, true); k.color(INK); k.text(g.label, x, k.y);
    k.para(g.names, { size: 8.5, c: DIM, x: x + 30, w: w - 30, gap: 0.6 });
  }
}

/** One entry per capability: who to bring to the conversation. */
function teamsBlock(k: Kit, T: Words, caps: CapabilityResult[], input: ReportInput) {
  const { M, CW } = k;
  k.h2(T.teams);
  for (const c of caps) {
    k.ensure(16);
    k.dot(M + 1.2, k.y - 1, hex(c.color));
    k.font(9.5, true); k.color(INK); k.text(c.name, M + 5, k.y);
    k.y += 4.6;
    teamsRows(k, T, c.name, input, M + 5, CW - 5);
    k.y += 2.5;
  }
}

function capabilityHead(k: Kit, T: Words, c: CapabilityResult, input: ReportInput) {
  const { M, CW } = k;
  k.ensure(34);
  k.y += 3;
  const dx = verdictOf(c, input);
  k.dot(M + 1.6, k.y - 1.6, hex(c.color), 1.6);
  k.font(14, true); k.color(INK); k.text(c.name, M + 6, k.y);
  k.font(14, true); k.color(bandRgb(c.score)); k.text(`${c.score}%`, M + CW, k.y, { align: "right" });
  k.y += 3; k.rule(k.y); k.y += 6;
  const w = (CW - 12) / 3;
  (["coverage", "utilization", "adoption"] as const).forEach((p, i) => {
    const x = M + i * (w + 6);
    const v = p === "coverage" ? (c.coverageScore ?? c.score) : p === "utilization" ? c.effectiveUtilizationScore : (c.adoptionScore ?? null);
    k.font(8.5); k.color(DIM); k.text(T[p], x, k.y);
    k.font(9, true); k.color(INK); k.text(fmtPct(v), x + w, k.y, { align: "right" });
    k.meter(x, k.y + 1.6, w, v, PART_RGB[p]);
  });
  k.y += 9;
  k.font(8.5, true); k.color(VERDICT_RGB[dx.id]); k.text(T.verdicts[dx.id].label.toUpperCase(), M, k.y);
  const lw = k.pdf.getTextWidth(safe(T.verdicts[dx.id].label.toUpperCase())) + 4;
  k.para(`${T.nextStep}: ${T.verdicts[dx.id].action}`, { size: 8.5, c: DIM, x: M + lw, w: CW - lw, gap: 1.5 });
  k.y += 1.5;
  k.font(8.5, true); k.color(DIM); k.text(T.teams.toUpperCase(), M, k.y); k.y += 4.4;
  teamsRows(k, T, c.name, input, M, CW);
  k.y += 3;
}

// ── Reports ─────────────────────────────────────────────────────────────────

const unmet = (c: CapabilityResult, perCap: number) => c.criteriaResults
  .filter(r => stateOf(r) === "notMet")
  .map(r => ({ c, r, gain: round1(gainIfMet(c, r.tier) / perCap) }));

export function buildReport(kind: ReportKind, input: ReportInput, lang: ReportLang = "en"): jsPDF | null {
  otelRun = !!input.run?.otel;
  mixedRun = !!input.run?.mixed;
  mixedWords = { otelSide: WORDS[lang].otelSide, bothSides: WORDS[lang].bothSides };
  const caps = input.capabilities;
  if (caps.length === 0) return null;
  const T = WORDS[lang];
  const k = kit(T.titles[kind], T, input);
  const ranked = [...caps].sort((a, b) => a.score - b.score);

  k.h1(T.titles[kind]);
  k.y += 2;
  scoreBlock(k, T, T.overall, input.totalScore, overallParts(caps));
  runNotes(k, T, input);

  if (kind === "overall") {
    k.h2(T.capabilities);
    radarBlock(k, T, caps, input.totalScore);
    capabilityTable(k, T, ranked, input);
    k.h2(T.actFirst);
    const top = caps.flatMap(c => unmet(c, caps.length)).sort((a, b) => b.gain - a.gain).slice(0, 8);
    if (top.length === 0) k.para(T.noActions, { c: DIM }); else actionRows(k, T, top, { showCap: true, detail: false });
    teamsBlock(k, T, ranked, input);
    trendBlock(k, T, input);
    appsBlock(k, T, input);
    methodBlock(k, T);
  }

  if (kind === "plan") {
    k.h2(T.capabilities);
    capabilityTable(k, T, ranked, input);
    for (const c of ranked) {
      capabilityHead(k, T, c, input);
      const acts = unmet(c, 1).sort((a, b) => b.gain - a.gain);
      if (acts.length === 0) k.para(doneLine(c, T), { c: DIM, gap: 4 }); else actionRows(k, T, acts, { showCap: false, detail: true });
    }
    methodBlock(k, T);
  }

  if (kind === "criteria") {
    const { M, CW } = k;
    // The three states, each with its shape and its word.
    k.ensure(8);
    let lx = M + 1.4;
    for (const [st, word] of [["met", T.met], ["notMet", T.notMet], ["notAssessed", T.notAssessed]] as const) {
      k.mark(lx, k.y - 1, st);
      k.font(8.5); k.color(DIM); k.text(word, lx + 3, k.y);
      lx += 9 + k.pdf.getTextWidth(word);
    }
    k.y += 6;
    for (const c of caps) {
      capabilityHead(k, T, c, input);
      for (const tier of ["foundation", "bestPractice", "excellence"] as TierKey[]) {
        const rows = c.criteriaResults.filter(r => r.tier === tier);
        if (rows.length === 0) continue;
        k.ensure(16);
        k.font(8, true); k.color(DIM);
        k.text(T.tiers[tier].toUpperCase(), M, k.y);
        k.text(T.value, M + 132, k.y, { align: "right" });
        k.text(T.target, M + CW, k.y, { align: "right" });
        k.y += 2; k.rule(k.y); k.y += 5;
        for (const r of rows) {
          k.ensure(12);
          const st = stateOf(r);
          k.mark(M + 1.4, k.y - 1, st);
          k.font(9.5, true); k.color(INK); k.text(textOf(r, lang).label, M + 5, k.y);
          k.font(9, true); k.color(st === "met" ? PASS : st === "notMet" ? FAIL : DIM); k.text(fmtValue(r, T), M + 132, k.y, { align: "right" });
          k.font(9); k.color(DIM); k.text(fmtTarget(r, T), M + CW, k.y, { align: "right" });
          k.y += 4;
          k.para(textOf(r, lang).description, { size: 8, c: DIM, x: M + 5, w: CW - 5, gap: 2.5 });
        }
        k.y += 2;
      }
    }
    methodBlock(k, T);
  }

  return k.finish();
}

// ── FinOps report ───────────────────────────────────────────────────────────

const FINOPS_CAPABILITY = "FinOps & Sustainability";

interface FinWords {
  title: string; spend: string; periodToDate: string; effective: string; list: string; belowList: string;
  commitment: string; owned: string; byService: string; byRegion: string; byAccount: string;
  noSpend: string; energy: string; last: string; hours: string; hostsMeasured: string; used: string; wasted: string; emissions: string;
  idle: string; idleNone: string; host: string; cpu: string; topWaste: string; clusters: string; maturity: string;
  limits: string; limitsText: string[];
  notAvailable: string; noEnergy: string; hostsCapped: string; idleCount: string;
}
const FIN: Record<ReportLang, FinWords> = {
  en: {
    title: "FinOps", spend: "Cloud spend", periodToDate: "billing period to date", effective: "Effective cost", list: "List cost", belowList: "below list price",
    commitment: "Under commitment discount", owned: "With an owner or cost center", byService: "Cost by service", byRegion: "Cost by region", byAccount: "Cost by account",
    noSpend: "No cloud bill has been imported into Cost & Carbon Optimization, so this report has no cost figures.",
    energy: "Energy and carbon", last: "last", hours: "hours", hostsMeasured: "Hosts measured", used: "Energy used", wasted: "Energy wasted", emissions: "Emissions",
    notAvailable: "Not available", noEnergy: "No energy or carbon measurement was found in the last 24 hours.", hostsCapped: "Shows the 1,000 hosts with the most wasted energy; the totals cover these hosts only.", idleCount: "hosts",
    idle: "Idle hosts", idleNone: "No measured host is under the idle threshold.", host: "Host", cpu: "Avg CPU", topWaste: "Hosts with the most wasted energy", clusters: "Kubernetes clusters",
    maturity: "FinOps practice",
    limits: "What this report can and cannot tell you",
    limitsText: [
      "Every figure here was stored by Cost & Carbon Optimization: the cloud provider's bill as imported, and energy and carbon measured per host. Nothing is estimated.",
      "The report shows where the cost and the waste are. It does not calculate what a change would save: that depends on prices and decisions that are not in the data.",
      "A host counts as idle when its average CPU usage is under 3%, the threshold Cost & Carbon Optimization applies.",
    ],
  },
  pt: {
    title: "FinOps", spend: "Gasto de cloud", periodToDate: "período de faturamento até a data", effective: "Custo efetivo", list: "Custo de lista", belowList: "abaixo do preço de lista",
    commitment: "Sob desconto de compromisso", owned: "Com dono ou centro de custo", byService: "Custo por serviço", byRegion: "Custo por região", byAccount: "Custo por conta",
    noSpend: "Nenhuma fatura de cloud foi importada no Cost & Carbon Optimization, portanto este relatório não tem valores de custo.",
    energy: "Energia e carbono", last: "últimas", hours: "horas", hostsMeasured: "Hosts medidos", used: "Energia usada", wasted: "Energia desperdiçada", emissions: "Emissões",
    notAvailable: "Não disponível", noEnergy: "Nenhuma medição de energia ou carbono foi encontrada nas últimas 24 horas.", hostsCapped: "Mostra os 1.000 hosts com mais energia desperdiçada; os totais cobrem apenas esses hosts.", idleCount: "hosts",
    idle: "Hosts ociosos", idleNone: "Nenhum host medido está abaixo do limite de ociosidade.", host: "Host", cpu: "CPU média", topWaste: "Hosts com mais energia desperdiçada", clusters: "Clusters Kubernetes",
    maturity: "Prática de FinOps",
    limits: "O que este relatório pode e não pode dizer",
    limitsText: [
      "Todos os valores aqui foram gravados pelo Cost & Carbon Optimization: a fatura do provedor de cloud como importada, e energia e carbono medidos por host. Nada é estimado.",
      "O relatório mostra onde estão o custo e o desperdício. Ele não calcula quanto uma mudança economizaria: isso depende de preços e decisões que não estão nos dados.",
      "Um host conta como ocioso quando o uso médio de CPU fica abaixo de 3%, o limite que o Cost & Carbon Optimization aplica.",
    ],
  },
  es: {
    title: "FinOps", spend: "Gasto de cloud", periodToDate: "período de facturación hasta la fecha", effective: "Costo efectivo", list: "Costo de lista", belowList: "por debajo del precio de lista",
    commitment: "Bajo descuento por compromiso", owned: "Con dueño o centro de costo", byService: "Costo por servicio", byRegion: "Costo por región", byAccount: "Costo por cuenta",
    noSpend: "No se importó ninguna factura de cloud en Cost & Carbon Optimization, por lo que este informe no tiene valores de costo.",
    energy: "Energía y carbono", last: "últimas", hours: "horas", hostsMeasured: "Hosts medidos", used: "Energía usada", wasted: "Energía desperdiciada", emissions: "Emisiones",
    notAvailable: "No disponible", noEnergy: "No se encontró ninguna medición de energía o carbono en las últimas 24 horas.", hostsCapped: "Muestra los 1.000 hosts con más energía desperdiciada; los totales cubren solo esos hosts.", idleCount: "hosts",
    idle: "Hosts ociosos", idleNone: "Ningún host medido está por debajo del umbral de inactividad.", host: "Host", cpu: "CPU media", topWaste: "Hosts con más energía desperdiciada", clusters: "Clusters Kubernetes",
    maturity: "Práctica de FinOps",
    limits: "Qué puede y qué no puede decir este informe",
    limitsText: [
      "Todos los valores fueron guardados por Cost & Carbon Optimization: la factura del proveedor de cloud tal como se importó, y la energía y el carbono medidos por host. Nada es estimado.",
      "El informe muestra dónde están el costo y el desperdicio. No calcula cuánto ahorraría un cambio: eso depende de precios y decisiones que no están en los datos.",
      "Un host cuenta como ocioso cuando su uso medio de CPU es inferior al 3%, el umbral que aplica Cost & Carbon Optimization.",
    ],
  },
};

const fmtMoney = (n: number, c: string) => `${c} ${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 })}`.trim();
const share = (a: number, b: number) => (b > 0 ? Math.floor((a / b) * 1000) / 10 : 0);

/** Label, bar, value: one row of a ranked list. */
function rankRows(k: Kit, rows: { name: string; value: number; text: string }[], c: RGB) {
  const { M, CW } = k;
  const max = Math.max(...rows.map(r => r.value), 0);
  for (const r of rows) {
    k.font(9.5);
    // Long names wrap onto more lines: nothing is cut.
    const lines = k.pdf.splitTextToSize(safe(r.name), 80) as string[];
    k.ensure(3 + lines.length * 4.2);
    k.color(INK); lines.forEach((ln, i) => k.text(ln, M, k.y + i * 4.2));
    k.meter(M + 84, k.y - 2.2, 50, max > 0 ? (r.value / max) * 100 : 0, c);
    k.font(9.5, true); k.text(r.text, M + CW, k.y, { align: "right" });
    k.y += 2 + lines.length * 4.2;
  }
  k.y += 2;
}

/** Figure with its label, laid out in columns. */
function statRow(k: Kit, stats: { label: string; value: string; c?: RGB }[]) {
  const { M, CW } = k;
  k.ensure(16);
  const w = CW / stats.length;
  stats.forEach((s, i) => {
    k.font(8.5); k.color(DIM); k.text(s.label, M + i * w, k.y);
    k.font(15, true); k.color(s.c ?? INK); k.text(s.value, M + i * w, k.y + 7);
  });
  k.y += 14;
}

export function buildFinOpsReport(input: ReportInput, d: FinOpsData, lang: ReportLang = "en"): jsPDF {
  const T = WORDS[lang], F = FIN[lang];
  const k = kit(F.title, T, input);
  k.h1(F.title);
  k.y += 2;

  // Spend
  const s = d.spend;
  k.h2(s ? `${F.spend}  (${F.periodToDate})` : F.spend);
  if (!s) k.para(F.noSpend, { c: DIM, gap: 4 });
  else {
    statRow(k, [
      { label: F.effective, value: fmtMoney(s.cost, s.currency) },
      // A bill with no list price has no discount to state: say so instead of printing zero.
      { label: F.list, value: s.listCost > 0 ? fmtMoney(s.listCost, s.currency) : F.notAvailable, c: DIM },
      { label: F.belowList, value: s.listCost > 0 && s.listCost >= s.cost ? `${share(s.listCost - s.cost, s.listCost)}%` : F.notAvailable },
    ]);
    statRow(k, [
      { label: F.commitment, value: `${share(s.commitmentCost, s.cost)}%` },
      { label: F.owned, value: `${share(s.ownedCost, s.cost)}%` },
    ]);
    const rows = (xs: { name: string; cost: number }[]) => xs.map(x => ({ name: x.name, value: x.cost, text: `${fmtMoney(x.cost, s.currency)}  |  ${share(x.cost, s.cost)}%` }));
    k.h2(F.byService, 40); if (s.services.length) rankRows(k, rows(s.services), ACCENT); else k.para(F.notAvailable, { c: DIM, gap: 4 });
    k.h2(F.byRegion, 30); if (s.regions.length) rankRows(k, rows(s.regions), ACCENT); else k.para(F.notAvailable, { c: DIM, gap: 4 });
    if (s.accounts.length > 1) { k.h2(F.byAccount, 30); rankRows(k, rows(s.accounts), ACCENT); }
  }

  // Energy and carbon
  if (d.hosts.length > 0) {
    k.h2(`${F.energy}  (${F.last} ${d.windowHours} ${F.hours})`, 40);
    statRow(k, [
      { label: F.hostsMeasured, value: d.hosts.length.toLocaleString() },
      { label: F.used, value: `${d.energyKwh.toFixed(1)} kWh` },
      { label: `${F.wasted} (${share(d.wastedKwh, d.energyKwh)}%)`, value: `${d.wastedKwh.toFixed(1)} kWh`, c: FAIL },
      { label: F.emissions, value: `${d.emissionsKg.toFixed(1)} kg CO2e` },
    ]);
    if (d.hostsCapped) k.para(F.hostsCapped, { size: 8.5, c: DIM, gap: 3 });
    const cpuText = (h: { cpu: number | null }) => (h.cpu == null ? `CPU ${F.notAvailable}` : `${(Math.floor(h.cpu * 10) / 10).toFixed(1)}% CPU`);
    k.h2(`${F.idle}  (${F.cpu} < ${IDLE_CPU}%)${d.idleHosts.length ? `  |  ${d.idleHosts.length.toLocaleString("en-US")} ${F.idleCount}` : ""}`, 30);
    if (d.idleHosts.length === 0) k.para(F.idleNone, { c: DIM, gap: 4 });
    else rankRows(k, d.idleHosts.slice(0, 20).map(h => ({ name: h.name, value: h.wastedKwh, text: `${cpuText(h)}  |  ${h.wastedKwh.toFixed(2)} kWh` })), FAIL);
    k.h2(F.topWaste, 30);
    rankRows(k, d.hosts.slice(0, 10).map(h => ({ name: h.name, value: h.wastedKwh, text: `${cpuText(h)}  |  ${h.wastedKwh.toFixed(2)} kWh` })), PART_RGB.utilization);
  } else {
    k.h2(F.energy, 20);
    k.para(F.noEnergy, { c: DIM, gap: 4 });
  }
  if (d.clusters.length > 0) {
    k.h2(F.clusters, 30);
    rankRows(k, d.clusters.slice(0, 10).map(c => ({ name: c.name, value: c.emissionsKg, text: `${c.emissionsKg.toFixed(1)} kg CO2e  |  ${c.energyKwh.toFixed(1)} kWh` })), PART_RGB.adoption);
  }

  // The capability: score, parts, verdict and what is not met
  const cap = input.capabilities.find(c => c.name === FINOPS_CAPABILITY);
  if (cap) {
    k.h2(F.maturity, 50);
    capabilityHead(k, T, cap, input);
    const acts = unmet(cap, 1).sort((a, b) => b.gain - a.gain);
    if (acts.length === 0) k.para(doneLine(cap, T), { c: DIM, gap: 4 }); else actionRows(k, T, acts, { showCap: false, detail: true });
  }

  k.h2(F.limits, 36);
  for (const line of F.limitsText) k.para(line, { size: 8.5, c: DIM, gap: 2 });
  return k.finish();
}

export function generateFinOpsReport(input: ReportInput, d: FinOpsData, lang: ReportLang = "en"): void {
  buildFinOpsReport(input, d, lang).save(`${fileStem(input)}-finops-${lang}.pdf`);
}

const fileStem = (input: ReportInput) => `pulse-${input.tenant}-${input.date || "latest"}`;

/** Browser entry point: build the PDF and download it. */
export function generateReport(kind: ReportKind, input: ReportInput, lang: ReportLang = "en"): void {
  buildReport(kind, input, lang)?.save(`${fileStem(input)}-${kind}-${lang}.pdf`);
}

// ── Raw data ────────────────────────────────────────────────────────────────

/** The assessment as one self-describing object: what was measured, how it is
 *  scored, and every number behind the screens. Written to be read by another
 *  tool or AI without access to the app. */
export function buildRawData(input: ReportInput) {
  const caps = input.capabilities;
  // Position of each unmet criterion inside its capability, largest effect on the score first.
  const actionOrder = new Map(caps.map(c => [c.name,
    new Map(unmet(c, 1).sort((x, y) => y.gain - x.gain).map((x, i) => [x.r.id, i + 1]))] as const));
  return {
    schema: "pulse-assessment/raw-data/2",
    generatedBy: `Pulse Assessment ${APP_VERSION}`,
    environment: input.tenant,
    assessmentDate: input.date,
    run: {
      traceCriteriaReadFromMetricsAndTopology: input.run?.traceProxy ?? false,
      entityCountsReadFromSmartscape: input.run?.smartscape ?? false,
      hostsAndKubernetesReadFromOpenTelemetry: input.run?.otel ?? false,
      oneAgentAndOpenTelemetryCountedTogether: input.run?.mixed ?? false,
      telemetryStrategy: input.run?.telemetry ?? null,
      valuesAreEstimates: input.run?.estimated ?? false,
      scaleTier: input.run?.tier ?? null,
    },
    howToRead: {
      scale: "All scores are 0-100. Higher is better.",
      capabilityScore: "floor(average(coverage, utilization, adoption)). Adoption is left out when it could not be measured.",
      overallScore: "floor(average of the capability scores).",
      coverage: "Share of the capability's assessed criteria that are met. A criterion is met when value >= target.",
      utilization: `Criteria grouped in tiers weighted foundation ${FOUNDATION_WEIGHT} / bestPractice ${BEST_PRACTICE_WEIGHT} / excellence ${EXCELLENCE_WEIGHT}. bestPractice counts only when foundation >= 80% met; excellence only when bestPractice >= 60% met.`,
      adoption: `Share of active users who opened the capability's apps in the adoption window, scaled so that ${ADOPTION_FULL_RATE}% of active users = 100.`,
      verdict: `Reads the three parts together; it does not change the score. A part is high at ${DEFAULT_CUTS.coverage}% or more (adoption: ${DEFAULT_CUTS.adoptionRate}% of active users or more).`,
      actionOrder: "For a criterion that is not met: its position among the capability's unmet criteria, ordered by how much the capability score rises when it becomes met. 1 raises it the most. null for criteria that are met or not assessed.",
      criterionUnits: "percent: value and target are percentages. count: value is a count and the target is at least 1. number: plain number.",
      bands: SCORE_BANDS.map(b => ({ label: b.label, from: b.min, to: b.max === 100 ? 100 : b.max - 1 })),
    },
    overall: { score: input.totalScore, band: scoreBand(input.totalScore).label, ...overallParts(caps) },
    capabilities: caps.map(c => {
      const dx = verdictOf(c, input);
      const ad = input.adoption?.byCapability[c.name];
      return {
        name: c.name,
        score: c.score,
        band: scoreBand(c.score).label,
        coverage: c.coverageScore ?? c.score,
        utilization: c.effectiveUtilizationScore,
        adoption: c.adoptionScore ?? null,
        adoptionShareOfActiveUsersPercent: c.adoptionRate ?? ad?.rate ?? null,
        assessedCriteria: c.assessedCount,
        notAssessedCriteria: c.notAssessedCount,
        adoptionPeople: ad?.users ?? null,
        verdict: dx.label,
        verdictMeaning: dx.meaning,
        verdictNextStep: dx.action,
        teamsToInvolve: teamsFor(c.name, input.teams),
        tiers: (["foundation", "bestPractice", "excellence"] as TierKey[]).map(t => ({ tier: t, met: c.utilization[t].passed, total: c.utilization[t].total })),
        criteria: c.criteriaResults.map(r => {
          const st = stateOf(r);
          return {
            id: r.id,
            name: cleanLabel(r),
            description: r.description,
            tier: r.tier,
            state: st,
            unit: unitOf(r),
            value: valueOf(r),
            target: targetOf(r),
            numerator: r.num ?? null,
            denominator: r.den ?? null,
            actionOrder: actionOrder.get(c.name)?.get(r.id) ?? null,
            whyItMatters: CRITERION_IMPORTANCE[r.id] ?? null,
            whatToDo: CRITERION_ACTIONS[r.id]?.action ?? null,
            documentation: CRITERION_ACTIONS[r.id]?.docUrl ?? null,
            // Read from metrics or topology in place of the original signal.
            approximated: r.proxied,
            partialRead: !!r.partial,
            // "dql" for a DQL query; "configuration" when the value is a count of
            // settings objects or SLOs, which is not something to run in a notebook.
            source: /^(settings:count|slos:count)/.test(r.query) ? "configuration" : "dql",
            dql: r.query,
          };
        }),
      };
    }),
    appUsage: input.adoption ? {
      windowDays: input.adoption.windowDays,
      activeUsers: input.adoption.totalUsers,
      apps: input.adoption.apps.map(a => ({ appId: a.appId, name: input.appName(a.appId), capability: a.capability, peopleMonth: a.users, peoplePerDay: Math.round(a.dailyUsers * 10) / 10 })),
    } : null,
    history: comparableRuns(input.history).map(s => ({
      timestamp: s.timestamp,
      overallScore: s.totalScore,
      capabilities: s.capabilities.map(c => ({ name: c.name, score: c.score, coverage: c.coverage ?? null, utilization: c.utilization ?? null, adoption: c.adoption ?? null })),
    })),
  };
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per criterion, with its capability's scores repeated on each row. */
export function buildRawCsv(input: ReportInput): string {
  const data = buildRawData(input);
  const head = ["capability", "capability_score", "capability_coverage", "capability_utilization", "capability_adoption", "capability_verdict",
    "criterion_id", "criterion", "tier", "state", "unit", "value", "target", "numerator", "denominator",
    "action_order", "what_to_do", "description", "dql"];
  const rows = data.capabilities.flatMap(c => c.criteria.map(r => [
    c.name, c.score, c.coverage, c.utilization, c.adoption, c.verdict,
    r.id, r.name, r.tier, r.state, r.unit, r.value, r.target, r.numerator, r.denominator,
    r.actionOrder, r.whatToDo, r.description, r.dql,
  ]));
  return [head, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
}

function download(name: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportRawData(format: "json" | "csv", input: ReportInput): void {
  if (input.capabilities.length === 0) return;
  if (format === "json") download(`${fileStem(input)}-raw-data.json`, "application/json", JSON.stringify(buildRawData(input), null, 2));
  // BOM so spreadsheet apps read the file as UTF-8.
  else download(`${fileStem(input)}-raw-data.csv`, "text/csv;charset=utf-8", `﻿${buildRawCsv(input)}`);
}
