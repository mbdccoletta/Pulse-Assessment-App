// ui/app/ai/pageIntelligence.ts
//
// One intelligence layer per page. Each page has:
//   - a LENS: how the model must read this page (goes in the instruction);
//   - QUESTIONS: analytical questions only this page can answer;
//   - FACTS: what the page shows, computed here by the same functions the page
//     uses (gains, tier gates, verdicts, causes of change), so the model quotes
//     numbers instead of deriving them.
//
// Every arithmetic the questions need is done here. The model is never asked to
// add, rank or subtract: "previews paint, finals decide".
//
// Questions are in question form on purpose: imperative phrasing trips the
// guardrail. Lenses stay under LENS_MAX so the instruction fits the platform's
// 2500-character limit.

import type { CapabilityResult } from "../hooks/useCoverageData";
import type { UseAppAdoptionResult } from "../hooks/useAppAdoption";
import type { AssessmentSnapshot } from "../hooks/useAssessmentHistory";
import { diagnose, DEFAULT_CUTS } from "../diagnosis";
import { passLine } from "../passLine";
import { ADOPTION_FULL_RATE, gainIfMet } from "../pulseScore";
import { SCORE_BANDS, scoreBand } from "../utils/colors";
import { CRITERION_ACTIONS } from "../remediationActions";

export type PageId = "overview" | "overall" | "capability" | "evolution" | "guide";
export interface PageQuestion { label: string; ask: string }

export const LENS_MAX = 620;
/** Page facts are clamped to this before they reach the prompt. */
export const FACTS_MAX = 6000;

type Row = CapabilityResult["criteriaResults"][number];
type Tier = "foundation" | "bestPractice" | "excellence";
const TIER_LABEL: Record<Tier, string> = { foundation: "Foundation", bestPractice: "Best practice", excellence: "Excellence" };
const GATE = { foundation: 80, bestPractice: 60 };

const clean = (label: string) => label.replace(/\s*\(%\)\s*$/, "");
const isFail = (r: Row) => !r.notAssessed && !r.error && r.points <= 0;
const avg = (xs: number[]) => (xs.length ? Math.floor(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;
const share = (t: { passed: number; total: number }) => (t.total > 0 ? Math.floor((t.passed / t.total) * 100) : 0);

/** Current value and the value it passes from, as the pages show them. */
function reading(r: Row): string {
  if (r.count != null) return `criterion value ${r.count.toLocaleString("en-US")} found, criterion passes from 1`;
  const nums = (r.thresholds.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const floor = nums.length ? passLine(nums) : null;
  const unit = r.isRatio ? "%" : "";
  const v = r.isRatio ? Math.floor(r.value * 10) / 10 : r.value;
  return floor == null ? `criterion value ${v}${unit}` : `criterion value ${v}${unit}, criterion passes from ${floor}${unit}`;
}

/** How far an unmet share criterion is from passing, so "closest" is a fact. */
function shortfall(r: Row): string {
  if (r.count != null || !r.isRatio) return "";
  const nums = (r.thresholds.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const floor = nums.length ? passLine(nums) : null;
  if (floor == null) return "";
  const gap = Math.round((floor - Math.floor(r.value * 10) / 10) * 10) / 10;
  return gap > 0 ? `, ${gap} percentage points short` : "";
}

function verdictOf(c: CapabilityResult, adoption?: UseAppAdoptionResult) {
  const ran = !!adoption && !adoption.unavailable && !adoption.loading;
  const ad = adoption?.byCapability[c.name];
  return diagnose({
    coverage: c.coverageScore ?? c.score, utilization: c.effectiveUtilizationScore,
    users: ran ? (ad?.users ?? 0) : undefined, rate: ran ? (ad?.rate ?? 0) : undefined,
    totalUsers: adoption?.totalUsers, windowDays: adoption?.windowDays,
    notAssessedCount: c.notAssessedCount, totalCount: c.criteriaResults.length,
  });
}

/** Unmet criteria ranked by the points each adds to the OVERALL score. */
function gains(caps: CapabilityResult[]) {
  return caps.flatMap(c => c.criteriaResults.filter(isFail).map(r => ({
    c, r, capGain: gainIfMet(c, r.tier as Tier), gain: r1(gainIfMet(c, r.tier as Tier) / Math.max(1, caps.length)),
  }))).sort((a, b) => b.gain - a.gain);
}

/** Tier gates that are closed: the next tier does not count until they open.
 *  Same rule as the engine: a tier with nothing assessed counts as 0% met, so
 *  it keeps the gate closed. */
function closedGates(c: CapabilityResult): string[] {
  const u = c.utilization;
  if (c.assessedCount === 0) return [];
  const f = share(u.foundation), b = share(u.bestPractice);
  const missing = (t: Tier) => c.criteriaResults.filter(r => r.tier === t && isFail(r)).map(r => `"${clean(r.label)}"`).slice(0, 3).join(", ");
  if (f < GATE.foundation) {
    return [u.foundation.total === 0
      ? `no Foundation criterion could be assessed, so Best practice and Excellence do not count`
      : `${f}% of its Foundation criteria are met and the gate opens at ${GATE.foundation}% of them met, so Best practice and Excellence do not count yet; unmet Foundation criteria: ${missing("foundation")}`];
  }
  if (b < GATE.bestPractice && u.excellence.total > 0) {
    return [u.bestPractice.total === 0
      ? `no Best practice criterion could be assessed, so Excellence does not count`
      : `${b}% of its Best practice criteria are met and the gate opens at ${GATE.bestPractice}% of them met, so Excellence does not count yet; unmet Best practice criteria: ${missing("bestPractice")}`];
  }
  return [];
}

function nextBand(score: number): { label: string; at: number; away: number } | null {
  const nb = SCORE_BANDS.find(b => b.min > score);
  return nb ? { label: nb.label, at: nb.min, away: nb.min - score } : null;
}

const RULES =
  `Scoring rules: a capability score is the average of coverage (share of criteria met), utilization (Foundation, Best practice, Excellence ` +
  `weighted 60/25/15; Best practice counts once Foundation reaches ${GATE.foundation}%, Excellence once Best practice reaches ${GATE.bestPractice}%) ` +
  `and adoption (share of active users opening its apps in 30 days; ${ADOPTION_FULL_RATE}% of active users counts as 100). ` +
  `The overall score is the average of the capabilities. A part is high from ${DEFAULT_CUTS.coverage} points, which for adoption means ${DEFAULT_CUTS.adoptionRate}% of active users. ` +
  `Verdicts: Healthy (all three high), Skin-deep (coverage and adoption high, utilization low), Unwatched (coverage high, adoption low), ` +
  `Starved (adoption high, coverage low), Dark (coverage and adoption low). ` +
  `Bands: ${SCORE_BANDS.map(b => `${b.label} ${b.min}-${b.max === 100 ? 100 : b.max - 1}`).join(", ")}.`;

// ── Lenses ───────────────────────────────────────────────────────────────────

export const LENS: Record<PageId, string> = {
  overview:
    `Page lens: Overview, all capabilities side by side. Reason ACROSS capabilities: compare, rank, find the common cause. ` +
    `Use "Verdicts" and "Highest gain" from the page facts; gains are points on the overall score, already computed: quote them, never recompute or add your own. ` +
    `Lead with the conclusion, then the evidence. A tier gate is the share of a tier's criteria that are met; a criterion value is something else: never state one as the other.`,
  overall:
    `Page lens: Overall score, one number and what builds it. Explain the score through its three parts, the tier gates and the gains listed in the page facts. ` +
    `Distances to the next band and cumulative gains are already computed in the facts: quote them as written and do no arithmetic of your own. ` +
    `Separate what is a data gap (coverage), a depth gap (utilization) and a people gap (adoption). A tier gate is the share of a tier's criteria that are met; a criterion value is something else: never state one as the other.`,
  capability:
    `Page lens: one capability in depth. Stay inside this capability. Explain its verdict from the three parts, then go criterion by criterion using ` +
    `"Unmet criteria" from the page facts: each has its value, the value it passes from, its tier and its gain in capability points, already computed. ` +
    `A closed tier gate comes before anything behind it. Name the app or data involved. A tier gate is the share of a tier's criteria that are met; a criterion value is something else: never state one as the other.`,
  evolution:
    `Page lens: Evolution, two runs compared. Explain CAUSES, not just differences: which part moved, by how many points, and which criteria changed state. ` +
    `Keep apart a real change in the environment from a change in what is measured (criteria or capabilities added or removed, app version). ` +
    `Adoption comes from who opens the apps, never from criteria: do not explain an adoption change by a criterion. ` +
    `All deltas, point contributions and the like-for-like score are in the page facts: quote them, never compute.`,
  guide:
    `Page lens: Guide, how the assessment works. Teach the method with the scoring rules in the page facts, exactly as stated: never invent a rule, weight or cut. ` +
    `When an assessment exists, use one real capability from the context as the worked example and quote its numbers. ` +
    `Be plain: the reader may be new to Dynatrace.`,
};

// ── Questions ────────────────────────────────────────────────────────────────

export const QUESTIONS: Record<Exclude<PageId, "capability">, PageQuestion[]> = {
  overview: [
    { label: "Where to act first", ask: "Which three unmet criteria in the \"Highest gain\" list add the most points to the overall score, which of them open a closed tier gate in their capability, and in what order should they be done? What is the gain and the current value of each?" },
    { label: "Pattern behind the gaps", ask: "Across all capabilities, is the score held back mainly by coverage, by utilization or by adoption? Which capabilities share the same verdict, and what single cause would explain them together?" },
    { label: "Data nobody opens", ask: "Which capabilities have data arriving but few people opening their apps (Unwatched), and which have an audience but little coverage (Starved)? What does each case call for, and which one pays back first?" },
    { label: "Blind spots", ask: "Which capabilities sit in the lowest bands or have criteria that could not be assessed, and what would the customer fail to see during an incident in each of those areas today?" },
    { label: "Proof of value", ask: "Which capabilities are strongest and on which of the three parts, and what can this customer already do with Dynatrace that these numbers prove? Which met criteria are the evidence? Only strengths belong in this answer: weak capabilities are left out." },
    { label: "AI and automation", ask: "How far is this environment in using Dynatrace Assist, MCP, dtctl and workflows across the capabilities, judging by the criteria that measure them, and what is the next step toward automated response?" },
  ],
  overall: [
    { label: "Why this score", ask: "Why is the overall score what it is? Which of the three parts pulls it down most, and which capabilities account for most of that part?" },
    { label: "Path to the next band", ask: "How far is the overall score from the next band, and which unmet criteria from the \"Highest gain\" list cover that distance according to the cumulative gain stated in the page facts?" },
    { label: "Closed tier gates", ask: "Which capabilities have a closed tier gate according to the page facts, what stops counting because of each one, and which criterion opens it?" },
    { label: "Who uses the platform", ask: "Which apps carry the adoption, which capabilities have data but an audience below the high-adoption line, and what would give that data a destination people open?" },
    { label: "Leadership brief", ask: "What would a short leadership briefing say about this score: where the platform is strong, where the exposure is, and the one decision to take? Which numbers support each point?" },
  ],
  evolution: [
    { label: "What caused the change", ask: "Why did the overall score move between these two runs? Which capabilities account for it, which part of each (coverage, utilization, adoption) moved, and which criteria changed state?" },
    { label: "Real or measurement", ask: "How much of the difference comes from the environment itself and how much from a change in what is measured, such as criteria or capabilities added or removed or a different app version? Which changes belong to each group?" },
    { label: "Regressions to act on", ask: "Which criteria appear in the list of criteria that went from met to not met in the page facts, in which capabilities, and what should be checked first for each? If that list says none, what does that mean for the drops in score?" },
    { label: "What improved", ask: "Which criteria appear in the list of criteria that went from not met to met, and which capabilities are in the list of scores that rose, in the page facts? What does each one make visible or possible now? Are there improvements at all between these runs?" },
    { label: "What to watch next", ask: "Given what moved between these runs, which capabilities or criteria are most likely to change again, and what should be compared in the next run?" },
  ],
  guide: [
    { label: "How my score is built", ask: "How is a capability score built from coverage, utilization and adoption? Can you walk through it with the lowest-scoring capability in this assessment as the example, quoting its three parts?" },
    { label: "Reading the verdicts", ask: "What does each verdict mean (Healthy, Skin-deep, Unwatched, Starved, Dark), when does it apply, and which verdicts do the capabilities in this assessment have?" },
    { label: "Tiers and gates", ask: "How do Foundation, Best practice and Excellence work, why does a tier stop counting when the one before it is below its gate, and what does that mean for the order of the work?" },
    { label: "How adoption is counted", ask: "How is adoption measured, who counts as an active user, why does 20% of active users count as full adoption, and what does a low adoption number say and not say?" },
    { label: "What the score cannot tell", ask: "What are the limits of this assessment's method, according to the list of what it does not measure in the page facts? For which decisions should its numbers not be used alone, and what should be checked by other means? This is about the method, not about which capabilities are weak." },
  ],
};

/** Questions about one capability. */
export function capabilityQuestions(name: string): PageQuestion[] {
  return [
    { label: "Why this score", ask: `Why does ${name} have this score and this verdict? Which of its three parts holds it back, and which unmet criteria are behind that part?` },
    { label: "Order of the work", ask: `For ${name}, in what order should the unmet criteria be done, considering closed tier gates first and then the gain of each one in the page facts? What does each one need in Dynatrace?` },
    { label: "Closest to passing", ask: `Which unmet criteria in ${name} have the fewest percentage points short of passing, according to the page facts, and what would close that distance for each? Which ones are far from passing and should not be called close?` },
    { label: "Who uses it", ask: `Which apps of ${name} are opened and by how many people, according to the page facts? Which installed apps are not opened, and what would bring this data to more people?` },
    { label: "Risk if nothing changes", ask: `What can the customer not see or detect in ${name} today because of each unmet criterion, and how would an incident in this area be noticed?` },
  ];
}

// ── Facts ────────────────────────────────────────────────────────────────────

function verdictLines(caps: CapabilityResult[], adoption?: UseAppAdoptionResult): string {
  return caps.map(c => {
    const dx = verdictOf(c, adoption);
    const na = c.notAssessedCount > 0 ? `, ${c.notAssessedCount} criteria not assessed` : "";
    return `- ${c.name}: ${dx.label} (${scoreBand(c.score).label} band${na})`;
  }).join("\n");
}

function gainLines(caps: CapabilityResult[], n: number): string {
  return gains(caps).slice(0, n).map(g =>
    `- "${clean(g.r.label)}" (${g.c.name}, ${TIER_LABEL[g.r.tier as Tier]}): +${g.gain} pts overall; ${reading(g.r)}`).join("\n");
}

function gateLines(caps: CapabilityResult[]): string {
  const lines = caps.flatMap(c => closedGates(c).map(g => `- ${c.name}: ${g}`));
  return lines.length ? lines.join("\n") : "- none: every capability has its tiers counting";
}

/** Which capabilities have a high or a low audience, stated so nobody has to compare numbers. */
function adoptionSplit(caps: CapabilityResult[]): string {
  const known = caps.filter(c => c.adoptionRate != null);
  if (known.length === 0) return "Adoption was not measured.";
  const fmt = (xs: CapabilityResult[]) => (xs.length ? xs.map(c => `${c.name} (${c.adoptionRate}% of active users)`).join("; ") : "none");
  return `High adoption (${DEFAULT_CUTS.adoptionRate}% of active users or more): ${fmt(known.filter(c => (c.adoptionRate ?? 0) >= DEFAULT_CUTS.adoptionRate))}.\n` +
    `Low adoption (under ${DEFAULT_CUTS.adoptionRate}%): ${fmt(known.filter(c => (c.adoptionRate ?? 0) < DEFAULT_CUTS.adoptionRate))}.`;
}

/** The criteria that measure AI assistance and automation, with their readings.
 *  Without this the model only sees each capability's weakest checks and
 *  concludes these are not measured at all. */
function automationFacts(caps: CapabilityResult[]): string {
  const groups: [string, RegExp][] = [
    ["Assist, MCP and dtctl usage (people in 30 days)", /^Assist, MCP and dtctl usage/],
    ["Problems with automated response", /^Problems with automated response/],
    ["Automation workflows", /workflows|Workflow execution success|Agentic|dtctl driven by AI agents/i],
  ];
  const val = (r: Row) => (r.notAssessed || r.error ? "not assessed" : r.count != null ? `${r.count.toLocaleString("en-US")}` : `${Math.floor(r.value * 10) / 10}%`) + (r.notAssessed || r.error ? "" : r.points > 0 ? " met" : " not met");
  const used = new Set<string>();
  return groups.map(([title, re]) => {
    const items = caps.flatMap(c => c.criteriaResults.filter(r => re.test(clean(r.label)) && !used.has(r.id)).map(r => { used.add(r.id); return title.startsWith("Automation") ? `"${clean(r.label)}" in ${c.name}: ${val(r)}` : `${c.name}: ${val(r)}`; }));
    return `- ${title}: ${items.length ? items.join("; ") : "no such criterion"}.`;
  }).join("\n");
}

export function overviewFacts(caps: CapabilityResult[], adoption?: UseAppAdoptionResult): string {
  if (caps.length === 0) return "";
  return `Page facts (Overview).\nVerdicts:\n${verdictLines(caps, adoption)}\n` +
    `Highest gain (unmet criteria by points added to the overall score):\n${gainLines(caps, 6)}\n` +
    `Closed tier gates (a gate is a share of criteria met in a tier, never a criterion value):\n${gateLines(caps)}\n` +
    `${adoptionSplit(caps)}\n` +
    `Criteria that measure AI assistance and automation (these ARE measured):\n${automationFacts(caps)}`;
}

export function overallFacts(caps: CapabilityResult[], totalScore: number, adoption?: UseAppAdoptionResult, appName: (id: string) => string = id => id): string {
  if (caps.length === 0) return "";
  const adopted = caps.map(c => c.adoptionScore).filter((x): x is number => x != null);
  const parts = `coverage ${avg(caps.map(c => c.coverageScore ?? c.score))}%, utilization ${avg(caps.map(c => c.effectiveUtilizationScore))}%` +
    (adopted.length ? `, adoption ${avg(adopted)}%` : ", adoption not measured");
  const nb = nextBand(totalScore);
  const ranked = gains(caps);
  // Only the rows listed below are counted, and each gain was computed with the
  // other criteria unchanged, so a sum is an approximation: the text says so.
  const LISTED = 8;
  let path = "";
  if (nb) {
    const listed = ranked.slice(0, LISTED);
    let sum = 0, k = 0;
    while (k < listed.length && sum < nb.away) { sum += listed[k].gain; k++; }
    const all = r1(ranked.reduce((t, g) => t + g.gain, 0));
    path = `Next band: ${nb.label} from ${nb.at}%, ${nb.away} pts away. ` + (sum >= nb.away
      ? `The first ${k} criteria of the "Highest gain" list add about ${r1(sum)} pts together (each gain is computed alone, so the sum is approximate), enough to reach it.`
      : `The ${listed.length} criteria of the "Highest gain" list add about ${r1(sum)} pts together and every unmet criterion about ${all} pts (each gain is computed alone, so sums are approximate)${all < nb.away ? ": not enough alone, adoption has to rise too" : ""}.`);
  } else path = "The score is already in the highest band.";
  const ran = !!adoption && !adoption.unavailable && !adoption.loading;
  const apps = ran && adoption
    ? adoption.apps.slice(0, 6).map(a => `${appName(a.appId)} ${a.users} people`).join("; ") + ` (of ${adoption.totalUsers} active users in ${adoption.windowDays} days)`
    : "not measured";
  const tier = (k: Tier) => {
    const p = caps.reduce((t, c) => t + c.utilization[k].passed, 0), n = caps.reduce((t, c) => t + c.utilization[k].total, 0);
    return n > 0 ? Math.floor((p / n) * 100) : 0;
  };
  return `Page facts (Overall score).\nOverall ${totalScore}% (${scoreBand(totalScore).label}). Parts, averaged over capabilities: ${parts}.\n${path}\n` +
    `Criteria met by tier: Foundation ${tier("foundation")}%, Best practice ${tier("bestPractice")}%, Excellence ${tier("excellence")}%.\n` +
    `Highest gain (points added to the overall score):\n${gainLines(caps, LISTED)}\n` +
    `Closed tier gates (a gate is a share of criteria met in a tier, never a criterion value):\n${gateLines(caps)}\n` +
    `Verdicts:\n${verdictLines(caps, adoption)}\n${adoptionSplit(caps)}\nMost used apps: ${apps}.`;
}

export function capabilityFacts(cap: CapabilityResult, adoption?: UseAppAdoptionResult, apps: { name: string; users: number }[] = []): string {
  const dx = verdictOf(cap, adoption);
  const unmet = cap.criteriaResults.filter(isFail)
    .map(r => ({ r, gain: gainIfMet(cap, r.tier as Tier) }))
    .sort((a, b) => b.gain - a.gain)
    .map(({ r, gain }) => {
      const act = CRITERION_ACTIONS[r.id]?.action;
      return `- "${clean(r.label)}" (${TIER_LABEL[r.tier as Tier]}): ${reading(r)}${shortfall(r)}; +${gain} pts on this capability${act ? `; suggested: ${act.length > 110 ? act.slice(0, 109) + "…" : act}` : ""}`;
    });
  const na = cap.criteriaResults.filter(r => r.notAssessed || r.error).map(r => `"${clean(r.label)}"`);
  const gates = closedGates(cap);
  const nb = nextBand(cap.score);
  const used = apps.filter(a => a.users > 0).slice(0, 6).map(a => `${a.name} ${a.users} people`).join("; ");
  const unused = apps.filter(a => a.users === 0).slice(0, 6).map(a => a.name).join(", ");
  return `Page facts (${cap.name}).\nVerdict: ${dx.label}. ${dx.meaning}\n` +
    `Tiers met: Foundation ${share(cap.utilization.foundation)}%, Best practice ${share(cap.utilization.bestPractice)}%, Excellence ${share(cap.utilization.excellence)}%.\n` +
    `Closed tier gates: ${gates.length ? gates.join("; ") : "none"}.\n` +
    (nb ? `Next band: ${nb.label} from ${nb.at}%, ${nb.away} pts away.\n` : "") +
    `Unmet criteria (highest gain first):\n${unmet.length ? unmet.join("\n") : "- none"}\n` +
    (na.length ? `Not assessed in this environment: ${na.join(", ")}.\n` : "") +
    `Apps opened: ${used || "none measured"}.` + (unused ? ` Installed and not opened: ${unused}.` : "");
}

type SnapCap = AssessmentSnapshot["capabilities"][number];
type SnapRow = SnapCap["criteriaResults"][number];
const stateOf = (r?: SnapRow) => (!r || r.notAssessed || r.error ? "na" : r.points > 0 ? "pass" : "fail");
const signed = (n: number) => `${n > 0 ? "+" : ""}${r1(n)}`;

export function evolutionFacts(from: AssessmentSnapshot, to: AssessmentSnapshot): string {
  const day = (iso: string) => new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const fromNames = new Set(from.capabilities.map(c => c.name));
  const toNames = new Set(to.capabilities.map(c => c.name));
  const added = to.capabilities.filter(c => !fromNames.has(c.name)).map(c => c.name);
  const removed = from.capabilities.filter(c => !toNames.has(c.name)).map(c => c.name);
  const totals = { lost: [] as string[], gained: [] as string[], rose: [] as string[], fell: [] as string[] };
  const caps = to.capabilities.map(c => {
    const p = from.capabilities.find(x => x.name === c.name);
    if (!p) return { abs: 100, line: `- ${c.name}: new capability, ${c.score}%` };
    const keys = ["coverage", "utilization", "adoption"] as const;
    const counted = keys.filter(k => c[k] != null).length || 1;
    const parts = keys.filter(k => p[k] != null && c[k] != null && p[k] !== c[k])
      .map(k => `${k} ${p[k]}→${c[k]} (${signed((c[k]! - p[k]!) / counted)} pts)`);
    const prev = new Map(p.criteriaResults.map(r => [r.id, r]));
    const now = new Set(c.criteriaResults.map(r => r.id));
    const pick = (f: (r: SnapRow, b?: SnapRow) => boolean) => c.criteriaResults.filter(r => f(r, prev.get(r.id))).map(r => `"${clean(r.label)}"`);
    const lost = pick((r, b) => !!b && stateOf(b) === "pass" && stateOf(r) === "fail");
    const gained = pick((r, b) => !!b && stateOf(b) === "fail" && stateOf(r) === "pass");
    const fresh = pick((_r, b) => !b);
    const unassessed = pick((r, b) => !!b && stateOf(b) !== "na" && stateOf(r) === "na");
    const assessed = pick((r, b) => !!b && stateOf(b) === "na" && stateOf(r) !== "na");
    const gone = p.criteriaResults.filter(r => !now.has(r.id)).map(r => `"${clean(r.label)}"`);
    const bits = [
      parts.length ? parts.join(", ") : "",
      lost.length ? `lost: ${lost.join(", ")}` : "",
      gained.length ? `gained: ${gained.join(", ")}` : "",
      fresh.length ? `new criteria: ${fresh.join(", ")}` : "",
      unassessed.length ? `no longer assessed: ${unassessed.join(", ")}` : "",
      assessed.length ? `now assessed: ${assessed.join(", ")}` : "",
      gone.length ? `removed criteria: ${gone.join(", ")}` : "",
    ].filter(Boolean);
    const d = c.score - p.score;
    totals.lost.push(...lost); totals.gained.push(...gained);
    if (d > 0) totals.rose.push(`${c.name} ${signed(d)} pts`);
    if (d < 0) totals.fell.push(`${c.name} ${signed(d)} pts`);
    if (d === 0 && bits.length === 0) return null;
    return { abs: Math.abs(d), line: `- ${c.name}: ${p.score}%→${c.score}% (${signed(d)} pts)${bits.length ? "; " + bits.join("; ") : ""}` };
  }).filter((x): x is { abs: number; line: string } => !!x).sort((a, b) => b.abs - a.abs);
  const measured = [
    from.appVersion && to.appVersion && from.appVersion !== to.appVersion ? `app version ${from.appVersion} to ${to.appVersion}` : "",
    added.length ? `capabilities added: ${added.join(", ")}` : "",
    removed.length ? `capabilities removed: ${removed.join(", ")}` : "",
  ].filter(Boolean).join("; ");
  // The same capabilities in both runs: what the score did without the ones added or removed.
  const common = to.capabilities.filter(c => fromNames.has(c.name)).map(c => c.name);
  const mean = (snap: AssessmentSnapshot) => avg(snap.capabilities.filter(c => common.includes(c.name)).map(c => c.score));
  const likeForLike = (added.length || removed.length) && common.length
    ? `Like for like (only the ${common.length} capabilities present in both runs): ${mean(from)}%→${mean(to)}% (${signed(mean(to) - mean(from))} pts).\n`
    : "";
  return `Page facts (Evolution). Comparing the run of ${day(from.timestamp)} with the run of ${day(to.timestamp)}.\n` +
    `Overall score ${from.totalScore}%→${to.totalScore}% (${signed(to.totalScore - from.totalScore)} pts).\n` +
    likeForLike +
    `Adoption is measured from app usage in 30 days, not from criteria; an adoption change means fewer or more people opened the capability's apps, or the apps counted for it changed.\n` +
    `Changes in what is measured: ${measured || "none recorded"}. New or removed criteria and capabilities are measurement changes, not environment changes.\n` +
    `Criteria that went from met to not met (regressions): ${totals.lost.length ? totals.lost.join(", ") : "none"}.\n` +
    `Criteria that went from not met to met (improvements): ${totals.gained.length ? totals.gained.join(", ") : "none"}.\n` +
    `Capabilities whose score rose: ${totals.rose.length ? totals.rose.join("; ") : "none"}. Capabilities whose score fell: ${totals.fell.length ? totals.fell.join("; ") : "none"}.\n` +
    `When a list above says "none", say so plainly: do not present a drop as an improvement or a measurement change as a regression.\n` +
    `Capabilities that changed (largest first; points in brackets are the effect of that part on the capability score):\n` +
    (caps.length ? caps.map(c => c.line).join("\n") : "- nothing changed");
}

const METHOD_LIMITS =
  `Who counts as an active user: a person who ran at least one query through any Dynatrace app in the last 30 days; service accounts are left out. ` +
  `A capability's adoption is the largest audience among its apps.\n` +
  `What the assessment does NOT measure (the limits of the method):\n` +
  `- It measures whether data and configuration exist and how widely, not whether they are correct or useful: a met criterion does not prove good alerts or good dashboards.\n` +
  `- It has no business results, no downtime, no time to resolve and no cost of incidents.\n` +
  `- Most criteria read a short recent window (from 15 minutes to 72 hours), so a quiet period or a deployment in progress can read lower than usual, and two runs can differ a little with no change in the environment.\n` +
  `- Adoption counts people who opened the apps, not what they did there or whether it helped them.\n` +
  `- A criterion that could not be measured is "Not assessed" and left out of the score: it says nothing about that area.\n` +
  `- Some targets are references chosen for this app, not official Dynatrace rules.\n` +
  `- The score compares an environment with itself over time; it is not a benchmark against other companies.`;

export function guideFacts(caps: CapabilityResult[], adoption?: UseAppAdoptionResult): string {
  return `Page facts (Guide).\n${RULES}\n${METHOD_LIMITS}` + (caps.length ? `\nVerdicts in this assessment:\n${verdictLines(caps, adoption)}` : "");
}
