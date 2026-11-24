// ui/app/diagnosis.ts
//
// Coverage × Utilization × Adoption → one named verdict per capability.
//
// The app already computes all three numbers and shows them side by side,
// leaving the reading to whoever is in the room. Three percentages are not a
// verdict: 82% coverage means something completely different when almost
// nobody opens the apps than when the whole team does.
//
// This crosses them into a name and an action. It NEVER touches the score —
// the verdict is a reading of numbers the app already has.
//
// On the adoption cut ────────────────────────────────────────────────────
// Adoption counts as high at a share of active users (DEFAULT_CUTS.adoptionRate).
// The rule can also take an absolute floor of people, but the default sets it
// to infinity, so only the share decides. tools/diagnosis.test.mjs pins that.

import { tr, type PulseLang } from "./i18n/lang";

export type DiagnosisId =
  | "healthy"
  | "skinDeep"
  | "unwatched"
  | "starved"
  | "dark"
  | "notAssessed";

export interface DiagnosisCuts {
  /** Coverage at or above this counts as high. */
  coverage: number;
  /** Adoption share (0–100) at or above this counts as high. */
  adoptionRate: number;
  /** …or this many distinct people, whichever comes first. */
  adoptionFloor: number;
  /** Utilization at or above this counts as deep. */
  utilization: number;
}

// One ruler for the whole app: a part is "high" when it reaches the Good band
// (60) on the score scale. Adoption counts 100 at 20% of active users
// (pulseScore.ts), so 60 points = 12% of active users. The earlier "or 5
// people" floor is gone: on a tenant with thousands of users it made adoption
// high everywhere, and a capability scored Good could read as Starved.
export const DEFAULT_CUTS: DiagnosisCuts = {
  coverage: 60,
  adoptionRate: 12,
  adoptionFloor: Number.POSITIVE_INFINITY,
  utilization: 60,
};

interface Meta {
  label: string;
  action: string;
  /** Sort weight — lower is more urgent, so the worst reads first. */
  rank: number;
}

export const DIAGNOSIS_META: Record<DiagnosisId, Meta> = {
  unwatched: {
    label: "Unwatched",
    action: "Give it an owner and a destination: a dashboard, an SLO or an alert someone actually opens.",
    rank: 1,
  },
  starved: {
    label: "Starved",
    action: "Expand coverage first — the demand already exists, so this is the best return in the plan.",
    rank: 2,
  },
  skinDeep: {
    label: "Skin-deep",
    action: "Turn on the best-practice and excellence checks that are missing; the audience is already there.",
    rank: 3,
  },
  dark: {
    label: "Dark",
    action: "Make an explicit call: invest, or take it out of scope.",
    rank: 4,
  },
  healthy: {
    label: "Healthy",
    action: "Use it as proof. This is the pattern to replicate on the other capabilities.",
    rank: 5,
  },
  notAssessed: {
    label: "Not assessed",
    action: "Find out why the checks could not run before reading any number here.",
    rank: 6,
  },
};

/** Verdict words in Portuguese and Spanish (the same as the PDF reports). */
const META_TR: Record<DiagnosisId, { pt: { label: string; action: string }; es: { label: string; action: string } }> = {
  unwatched: {
    pt: { label: "Sem audiência", action: "Dê um dono e um destino: um dashboard, um SLO ou um alerta que alguém realmente abre." },
    es: { label: "Sin audiencia", action: "Asigne un dueño y un destino: un dashboard, un SLO o una alerta que alguien realmente abre." },
  },
  starved: {
    pt: { label: "Subalimentada", action: "Amplie a cobertura primeiro: a demanda já existe, então este é o melhor retorno do plano." },
    es: { label: "Desabastecida", action: "Amplíe primero la cobertura: la demanda ya existe, así que es el mejor retorno del plan." },
  },
  skinDeep: {
    pt: { label: "Superficial", action: "Ative os critérios de Best practice e Excellence que faltam; a audiência já está lá." },
    es: { label: "Superficial", action: "Active los criterios de Best practice y Excellence que faltan; la audiencia ya está." },
  },
  dark: {
    pt: { label: "Apagada", action: "Tome uma decisão explícita: investir ou tirar do escopo." },
    es: { label: "Apagada", action: "Tome una decisión explícita: invertir o sacarla del alcance." },
  },
  healthy: {
    pt: { label: "Saudável", action: "Use como prova. Este é o padrão a replicar nas outras capacidades." },
    es: { label: "Saludable", action: "Úsela como prueba. Este es el patrón a replicar en las demás capacidades." },
  },
  notAssessed: {
    pt: { label: "Não avaliada", action: "Descubra por que os critérios não puderam ser medidos antes de ler qualquer número." },
    es: { label: "No evaluada", action: "Averigüe por qué no se pudieron medir los criterios antes de leer cualquier número." },
  },
};

/** A verdict's label and action in the language (rank unchanged). */
export function diagnosisMeta(id: DiagnosisId, lang: PulseLang = "en"): Meta {
  const m = DIAGNOSIS_META[id];
  return lang === "en" ? m : { ...m, ...META_TR[id][lang] };
}

export interface DiagnosisInput {
  coverage: number;
  utilization: number;
  /** Distinct people who opened an app for this capability; undefined when
   *  adoption could not be measured at all. */
  users?: number;
  /** Share of the platform population, 0–100. */
  rate?: number;
  totalUsers?: number;
  windowDays?: number;
  /** Criteria with no verdict. When all of them are, there is nothing to say. */
  notAssessedCount?: number;
  totalCount?: number;
}

export interface Diagnosis extends Meta {
  id: DiagnosisId;
  /** One line of what this means, with the numbers filled in. */
  meaning: string;
  /** False when adoption was unavailable — the verdict then rests on coverage
   *  and utilization alone, and the UI says so rather than implying the
   *  capability has no users. */
  adoptionKnown: boolean;
}

function people(n: number | undefined, total: number | undefined, days: number | undefined, lang: PulseLang = "en"): string {
  if (n == null) return tr(lang, "adoption not measured", "adoção não medida", "adopción no medida");
  const who = n === 0 ? tr(lang, "nobody", "ninguém", "nadie") : n === 1 ? tr(lang, "one person", "uma pessoa", "una persona") : tr(lang, `${n} people`, `${n} pessoas`, `${n} personas`);
  const of = total && n > 0 ? tr(lang, ` of ${total}`, ` de ${total}`, ` de ${total}`) : "";
  const win = days ? tr(lang, ` in ${days} days`, ` em ${days} dias`, ` en ${days} días`) : "";
  return n === 1
    ? tr(lang, `${who}${of} opened its apps${win}`, `${who}${of} abriu seus apps${win}`, `${who}${of} abrió sus apps${win}`)
    : tr(lang, `${who}${of} opened its apps${win}`, `${who}${of} abriram seus apps${win}`, `${who}${of} abrieron sus apps${win}`);
}

/** The rules, in order. The first match wins. */
export function diagnose(input: DiagnosisInput, cuts: DiagnosisCuts = DEFAULT_CUTS, lang: PulseLang = "en"): Diagnosis {
  const { coverage, utilization, users, rate, totalUsers, windowDays, notAssessedCount, totalCount } = input;
  const t = (en: string, pt: string, es: string) => tr(lang, en, pt, es);

  const build = (id: DiagnosisId, meaning: string, adoptionKnown: boolean): Diagnosis => ({
    id, meaning, adoptionKnown, ...diagnosisMeta(id, lang),
  });

  if (totalCount != null && notAssessedCount != null && notAssessedCount >= totalCount) {
    return build("notAssessed", t(
      "No criterion in this capability could be measured on this tenant.",
      "Nenhum critério desta capacidade pôde ser medido neste ambiente.",
      "Ningún criterio de esta capacidad pudo medirse en este entorno."), false);
  }

  const adoptionKnown = users != null;
  const highCoverage = coverage >= cuts.coverage;
  const deep = utilization >= cuts.utilization;

  if (!adoptionKnown) {
    if (highCoverage && deep) return build("healthy", t(
      `${coverage}% of checks pass at ${utilization}% depth. Adoption was not measured.`,
      `${coverage}% dos critérios atendidos com ${utilization}% de profundidade. A adoção não foi medida.`,
      `${coverage}% de los criterios cumplidos con ${utilization}% de profundidad. La adopción no se midió.`), false);
    if (highCoverage)         return build("skinDeep", t(
      `${coverage}% of checks pass, but only ${utilization}% depth. Adoption was not measured.`,
      `${coverage}% dos critérios atendidos, mas só ${utilization}% de profundidade. A adoção não foi medida.`,
      `${coverage}% de los criterios cumplidos, pero solo ${utilization}% de profundidad. La adopción no se midió.`), false);
    return build("dark", t(
      `Only ${coverage}% of checks pass. Adoption was not measured.`,
      `Só ${coverage}% dos critérios atendidos. A adoção não foi medida.`,
      `Solo ${coverage}% de los criterios cumplidos. La adopción no se midió.`), false);
  }

  const highAdoption = (rate ?? 0) >= cuts.adoptionRate || (users ?? 0) >= cuts.adoptionFloor;
  const who = people(users, totalUsers, windowDays, lang);
  // The basis of the judgement, stated with the reading: the share and the cut it is compared with.
  const share = t(`${rate ?? 0}% of active users`, `${rate ?? 0}% dos usuários ativos`, `${rate ?? 0}% de los usuarios activos`);
  const low = t(`${share}; below ${cuts.adoptionRate}% counts as low adoption`, `${share}; abaixo de ${cuts.adoptionRate}% conta como adoção baixa`, `${share}; por debajo de ${cuts.adoptionRate}% cuenta como adopción baja`);
  const high = t(`${share}; ${cuts.adoptionRate}% or more counts as high adoption`, `${share}; ${cuts.adoptionRate}% ou mais conta como adoção alta`, `${share}; ${cuts.adoptionRate}% o más cuenta como adopción alta`);

  if (highAdoption && !highCoverage)
    return build("starved", t(
      `Demand is proven and supply is short: ${who} (${high}), but coverage is ${coverage}%, below ${cuts.coverage}%.`,
      `A demanda está comprovada e a oferta é curta: ${who} (${high}), mas a cobertura é ${coverage}%, abaixo de ${cuts.coverage}%.`,
      `La demanda está probada y la oferta es escasa: ${who} (${high}), pero la cobertura es ${coverage}%, por debajo de ${cuts.coverage}%.`), true);

  if (highCoverage && !highAdoption)
    return build("unwatched", t(
      `The data is being collected (coverage ${coverage}%), but few people use it: ${who} (${low}).`,
      `Os dados estão sendo coletados (cobertura ${coverage}%), mas poucas pessoas os usam: ${who} (${low}).`,
      `Los datos se están recolectando (cobertura ${coverage}%), pero pocas personas los usan: ${who} (${low}).`), true);

  if (highCoverage && highAdoption && !deep)
    return build("skinDeep", t(
      `People are in (${high}) and coverage is ${coverage}%, but utilization is ${utilization}%, below ${cuts.utilization}%.`,
      `As pessoas estão usando (${high}) e a cobertura é ${coverage}%, mas a utilização é ${utilization}%, abaixo de ${cuts.utilization}%.`,
      `Las personas lo usan (${high}) y la cobertura es ${coverage}%, pero la utilización es ${utilization}%, por debajo de ${cuts.utilization}%.`), true);

  if (highCoverage && highAdoption)
    return build("healthy", t(
      `On, used and deep: coverage ${coverage}%, utilization ${utilization}%, and ${who} (${high}).`,
      `Ativa, usada e profunda: cobertura ${coverage}%, utilização ${utilization}%, e ${who} (${high}).`,
      `Activa, usada y profunda: cobertura ${coverage}%, utilización ${utilization}%, y ${who} (${high}).`), true);

  return build("dark", t(
    `Barely on and barely opened: coverage ${coverage}%, below ${cuts.coverage}%, and ${who} (${low}).`,
    `Quase desligada e quase não aberta: cobertura ${coverage}%, abaixo de ${cuts.coverage}%, e ${who} (${low}).`,
    `Casi apagada y casi sin abrir: cobertura ${coverage}%, por debajo de ${cuts.coverage}%, y ${who} (${low}).`), true);
}
