// ui/app/kit/usePulseLatest.ts
//
// The latest assessments Pulse saved, read-only, for a host page that shows a summary of them (e.g. the PoC's
// Overview) without running the assessment again: one Document Store listing (the newest snapshots) and their
// downloads. No Grail query, no retention, no write — the history itself stays owned by Pulse's Evolution.

import { useEffect, useState } from "react";
import { documentsClient } from "@dynatrace-sdk/client-document";
import { CRITERION_TIERS, type CriterionTier } from "../data/criterionTiers";

/** Overall coverage, utilization and adoption of a reading: the mean of its capabilities, floored, as Evolution shows. */
export interface PulseParts {
  coverage: number | null;
  utilization: number | null;
  adoption: number | null;
}

export interface PulseReading extends PulseParts {
  /** ISO time of the reading. */
  timestamp: string;
  /** Overall score, 0–100 (floored, as Pulse shows it). */
  totalScore: number;
}

/** A criterion the latest reading did not meet: what the capability is missing, in the order to work on it. */
export interface PulseFinding {
  /** Criterion id (translate with criterionText). */
  id: string;
  /** English label as the catalog writes it, without the "(%)" suffix. */
  label: string;
  /** Measured value: a percentage when `ratio`, otherwise a count. */
  value: number;
  ratio: boolean;
  tier: CriterionTier;
}

export interface PulseCapabilitySummary {
  name: string;
  score: number;
  /** Not-met criteria, foundation first, then best practice, then excellence (Pulse's order of the work). */
  findings: PulseFinding[];
}

export interface PulseLatest extends PulseReading {
  /** Capabilities, lowest score first. */
  capabilities: PulseCapabilitySummary[];
  /** The reading before this one, for the change since then; null on a first reading. */
  previous: PulseReading | null;
  /** Readings, oldest first (the latest included), for the evolution over time. */
  series: PulseReading[];
}

export type PulseLatestState =
  | { state: "loading" }
  | { state: "none" }
  | { state: "error" }
  | { state: "ok"; latest: PulseLatest };

const DOC_TYPE = "ppa-snapshot";
/** How many readings the summary looks back on. */
const READINGS = 12;

type RawCriterion = { id?: string; label?: string; value?: number; points?: number; error?: boolean; notAssessed?: boolean };
type RawCapability = { name?: string; score?: number; coverage?: number; utilization?: number; adoption?: number; criteriaResults?: RawCriterion[] };

const TIER_ORDER: Record<CriterionTier, number> = { foundation: 0, bestPractice: 1, excellence: 2 };

/** The criteria a capability did not meet: assessed, no error, no points. */
function findingsOf(cap: RawCapability): PulseFinding[] {
  return (cap.criteriaResults ?? [])
    .filter((c) => typeof c.id === "string" && typeof c.value === "number" && !c.error && !c.notAssessed && (c.points ?? 0) <= 0)
    .map((c) => {
      const raw = c.label ?? c.id!;
      return {
        id: c.id!,
        label: raw.replace(/\s*\(%\)\s*$/, ""),
        value: c.value!,
        ratio: /\(%\)\s*$/.test(raw),
        tier: CRITERION_TIERS[c.id!] ?? "bestPractice",
      };
    })
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
}
type RawSnapshot = { timestamp?: string; totalScore?: number; capabilities?: RawCapability[] };

const mean = (values: (number | undefined)[]): number | null => {
  const known = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return known.length === 0 ? null : Math.floor(known.reduce((a, b) => a + b, 0) / known.length);
};

function reading(raw: RawSnapshot): PulseReading | null {
  if (typeof raw.totalScore !== "number" || typeof raw.timestamp !== "string") return null;
  const caps = raw.capabilities ?? [];
  return {
    timestamp: raw.timestamp,
    totalScore: Math.floor(raw.totalScore),
    coverage: mean(caps.map((c) => c.coverage)),
    utilization: mean(caps.map((c) => c.utilization)),
    adoption: mean(caps.map((c) => c.adoption)),
  };
}

export function usePulseLatest(): PulseLatestState {
  const [result, setResult] = useState<PulseLatestState>({ state: "loading" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Snapshot names are "cca-<ISO time>", so the newest sort first.
        const list = await documentsClient.listDocuments({ filter: `type == '${DOC_TYPE}'`, sort: "-name", pageSize: READINGS });
        if (list.documents.length === 0) { if (!cancelled) setResult({ state: "none" }); return; }
        const raws = await Promise.all(list.documents.map(async (doc) => {
          try {
            const content = await documentsClient.downloadDocumentContent({ id: doc.id });
            return JSON.parse(await content.get("text")) as RawSnapshot;
          } catch {
            return null;
          }
        }));
        const pairs = raws
          .filter((raw): raw is RawSnapshot => raw !== null)
          .map((raw) => ({ raw, reading: reading(raw) }))
          .filter((p): p is { raw: RawSnapshot; reading: PulseReading } => p.reading !== null)
          .sort((a, b) => Date.parse(b.reading.timestamp) - Date.parse(a.reading.timestamp));
        const newest = pairs[0];
        const capabilities = (newest?.raw.capabilities ?? [])
          .filter((c): c is RawCapability & { name: string; score: number } => typeof c.name === "string" && typeof c.score === "number")
          .map((c) => ({ name: c.name, score: Math.floor(c.score), findings: findingsOf(c) }))
          .sort((a, b) => a.score - b.score);
        if (!newest || capabilities.length === 0) { if (!cancelled) setResult({ state: "none" }); return; }
        if (!cancelled) setResult({
          state: "ok",
          latest: {
            ...newest.reading,
            capabilities,
            previous: pairs[1]?.reading ?? null,
            series: pairs.map((p) => p.reading).reverse(),
          },
        });
      } catch {
        if (!cancelled) setResult({ state: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return result;
}
