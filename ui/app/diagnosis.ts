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

function people(n: number | undefined, total: number | undefined, days: number | undefined): string {
  if (n == null) return "adoption not measured";
  const who = n === 0 ? "nobody" : n === 1 ? "one person" : `${n} people`;
  const of = total && n > 0 ? ` of ${total}` : "";
  const win = days ? ` in ${days} days` : "";
  return `${who}${of} opened its apps${win}`;
}

/** The rules, in order. The first match wins. */
export function diagnose(input: DiagnosisInput, cuts: DiagnosisCuts = DEFAULT_CUTS): Diagnosis {
  const { coverage, utilization, users, rate, totalUsers, windowDays, notAssessedCount, totalCount } = input;

  const build = (id: DiagnosisId, meaning: string, adoptionKnown: boolean): Diagnosis => ({
    id, meaning, adoptionKnown, ...DIAGNOSIS_META[id],
  });

  if (totalCount != null && notAssessedCount != null && notAssessedCount >= totalCount) {
    return build("notAssessed", "No criterion in this capability could be measured on this tenant.", false);
  }

  const adoptionKnown = users != null;
  const highCoverage = coverage >= cuts.coverage;
  const deep = utilization >= cuts.utilization;

  if (!adoptionKnown) {
    if (highCoverage && deep) return build("healthy", `${coverage}% of checks pass at ${utilization}% depth. Adoption was not measured.`, false);
    if (highCoverage)         return build("skinDeep", `${coverage}% of checks pass, but only ${utilization}% depth. Adoption was not measured.`, false);
    return build("dark", `Only ${coverage}% of checks pass. Adoption was not measured.`, false);
  }

  const highAdoption = (rate ?? 0) >= cuts.adoptionRate || (users ?? 0) >= cuts.adoptionFloor;
  const who = people(users, totalUsers, windowDays);
  // The basis of the judgement, stated with the reading: the share and the cut it is compared with.
  const share = `${rate ?? 0}% of active users`;
  const low = `${share}; below ${cuts.adoptionRate}% counts as low adoption`;
  const high = `${share}; ${cuts.adoptionRate}% or more counts as high adoption`;

  if (highAdoption && !highCoverage)
    return build("starved", `Demand is proven and supply is short: ${who} (${high}), but coverage is ${coverage}%, below ${cuts.coverage}%.`, true);

  if (highCoverage && !highAdoption)
    return build("unwatched", `The data is being collected (coverage ${coverage}%), but few people use it: ${who} (${low}).`, true);

  if (highCoverage && highAdoption && !deep)
    return build("skinDeep", `People are in (${high}) and coverage is ${coverage}%, but utilization is ${utilization}%, below ${cuts.utilization}%.`, true);

  if (highCoverage && highAdoption)
    return build("healthy", `On, used and deep: coverage ${coverage}%, utilization ${utilization}%, and ${who} (${high}).`, true);

  return build("dark", `Barely on and barely opened: coverage ${coverage}%, below ${cuts.coverage}%, and ${who} (${low}).`, true);
}
