// ui/app/data/estateTarget.ts
//
// The estate the project will monitor, as the team states it (request: "o projeto é gigante e o que tem lá não
// chega nem perto do que temos pela frente"). A tenant only knows what already reports to it, so every coverage
// criterion reads "of what is here". With a target, Pulse also reads "of what is planned": hosts, applications and
// Kubernetes clusters monitored against the planned numbers.
//
// Stored in the app state (one value per environment, shared by everyone who opens the app), so the score saved in
// the history is the same whoever ran it. No target: no criterion is added and nothing changes.

import { stateClient } from "@dynatrace-sdk/client-state";
import type { CapabilityDef, Criterion } from "../queries";

export interface EstateTarget {
  hosts?: number;
  applications?: number;
  clusters?: number;
}

const KEY = "pulse.estate-target";

const clean = (n: unknown): number | undefined =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;

/** The stored target, or an empty one when none is set or the state cannot be read. */
export async function loadEstateTarget(): Promise<EstateTarget> {
  try {
    const state = await stateClient.getAppState({ key: KEY });
    const raw = JSON.parse(state.value) as Record<string, unknown>;
    return { hosts: clean(raw.hosts), applications: clean(raw.applications), clusters: clean(raw.clusters) };
  } catch {
    return {};
  }
}

/** Saves the target; an empty one removes it. */
export async function saveEstateTarget(target: EstateTarget): Promise<void> {
  const value = { hosts: clean(target.hosts), applications: clean(target.applications), clusters: clean(target.clusters) };
  if (!hasEstateTarget(value)) {
    try { await stateClient.deleteAppState({ key: KEY }); } catch { /* nothing stored */ }
    return;
  }
  await stateClient.setAppState({ key: KEY, body: { value: JSON.stringify(value) } });
}

export const hasEstateTarget = (t: EstateTarget) => !!(t.hosts || t.applications || t.clusters);

/** The criterion ids the target adds, for tiers, translations and actions. */
export const ESTATE_CRITERIA = ["i32", "i33", "d16"] as const;

const THRESHOLDS = [{ min: 90 }, { min: 50 }, { min: 1 }];

/** The numerators are the universe the other criteria of the same capability measure against, taken from the catalog
 *  AFTER it was adapted to the environment: in a mixed OneAgent + OpenTelemetry estate the host universe is the union
 *  of both (51 hosts on a reference tenant where the entity model alone has 30), on a Smartscape-only estate it is the
 *  Smartscape count. Reading anything else would put two host counts on one screen. */
const universe = (caps: CapabilityDef[], id: string, fallback: string): string =>
  caps.flatMap(c => c.criteria).find(c => c.id === id)?.queryB ?? fallback;

const criteriaFor = (t: EstateTarget, caps: CapabilityDef[]): Record<string, Criterion[]> => ({
  "Infrastructure Observability": [
    ...(t.hosts ? [{
      id: "i32", label: "Planned hosts monitored (%)",
      description: `Hosts reporting to Dynatrace against the ${t.hosts.toLocaleString("en-US")} hosts the project plans to monitor.`,
      query: universe(caps, "i1", "fetch dt.entity.host | summarize count()"),
      denominatorConstant: t.hosts,
      thresholds: THRESHOLDS,
    }] : []),
    ...(t.clusters ? [{
      id: "i33", label: "Planned Kubernetes clusters monitored (%)",
      description: `Kubernetes clusters reporting to Dynatrace against the ${t.clusters.toLocaleString("en-US")} clusters the project plans to monitor.`,
      query: universe(caps, "i7", "fetch dt.entity.kubernetes_cluster | summarize count()"),
      denominatorConstant: t.clusters,
      thresholds: THRESHOLDS,
    }] : []),
  ],
  "Digital Experience": t.applications ? [{
    id: "d16", label: "Planned applications monitored (%)",
    description: `Web and mobile applications monitored against the ${t.applications.toLocaleString("en-US")} applications the project plans to monitor.`,
    query: "fetch dt.entity.application | summarize c = count() | append [fetch dt.entity.mobile_application | summarize c = count()] | summarize c = sum(c)",
    denominatorConstant: t.applications,
    thresholds: THRESHOLDS,
  }] : [],
});

/** The catalog with the target's criteria added to their capabilities, first in the list. Apply it LAST, to the catalog
 *  already adapted to the environment (OpenTelemetry, mixed, Smartscape), so the numerators are that catalog's universe. */
export function applyEstateTarget(caps: CapabilityDef[], target: EstateTarget): CapabilityDef[] {
  if (!hasEstateTarget(target)) return caps;
  const extra = criteriaFor(target, caps);
  return caps.map(cap => (extra[cap.name]?.length ? { ...cap, criteria: [...extra[cap.name], ...cap.criteria] } : cap));
}
