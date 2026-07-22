// ui/app/hooks/useOwnershipDiscovery.ts
//
// Ownership discovery: which components each team owns, classified by
// Pulse capability.
//
// Grounded in the OFFICIAL ownership mechanism: entities carry
// `dt.owner:<team-identifier>` tags (Settings > Ownership). We sweep the
// entity model per type, aggregate owned-component counts per team via
// DQL, and classify each entity type into the Pulse capability it
// primarily belongs to:
//
//   hosts / K8s clusters / process groups → Infrastructure Observability
//   services                              → Application Observability
//   web apps / mobile apps / synthetics   → Digital Experience
//
// The result is an ownership matrix (team × capability × component count)
// used by the Projects page to show WHICH TEAMS must be involved in each
// capability of a project — from real data, not inference — and fed to
// Davis so plans name the actual owning teams.

import { useEffect, useState } from "react";
import { queryExecutionClient } from "@dynatrace-sdk/client-query";

/** Entity sweep list: Grail entity table → capability + human label. */
const ENTITY_SOURCES: { table: string; capability: string; label: string }[] = [
  { table: "dt.entity.host", capability: "Infrastructure Observability", label: "hosts" },
  { table: "dt.entity.kubernetes_cluster", capability: "Infrastructure Observability", label: "K8s clusters" },
  { table: "dt.entity.process_group", capability: "Infrastructure Observability", label: "process groups" },
  { table: "dt.entity.service", capability: "Application Observability", label: "services" },
  { table: "dt.entity.application", capability: "Digital Experience", label: "web apps" },
  { table: "dt.entity.mobile_application", capability: "Digital Experience", label: "mobile apps" },
  { table: "dt.entity.http_check", capability: "Digital Experience", label: "HTTP monitors" },
  { table: "dt.entity.synthetic_test", capability: "Digital Experience", label: "browser monitors" },
];

const OWNER_PREFIX = "dt.owner:";

export interface TeamOwnership {
  /** Ownership team identifier (the dt.owner tag value). */
  identifier: string;
  /** capability name → number of owned components classified there. */
  byCapability: Record<string, number>;
  /** capability name → human breakdown, e.g. "120 hosts, 3 K8s clusters". */
  detail: Record<string, string[]>;
  total: number;
}

export interface OwnershipDiscoveryResult {
  /** Teams that own at least one component, sorted by total desc. */
  teams: TeamOwnership[];
  loading: boolean;
  error: string | null;
}

async function runDiscoveryQuery(table: string): Promise<Record<string, number>> {
  const query =
    `fetch ${table} | expand tag = tags | filter startsWith(tag, "${OWNER_PREFIX}") ` +
    `| summarize n = countDistinct(id), by:{tag}`;
  const response = await queryExecutionClient.queryExecute({
    body: { query, requestTimeoutMilliseconds: 30_000, maxResultRecords: 1000 },
  });
  let state = response?.state;
  let res = response?.result;
  const requestToken = (response as { requestToken?: string })?.requestToken;
  if (state === "RUNNING" && requestToken) {
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await queryExecutionClient.queryPoll({ requestToken });
      state = poll?.state;
      res = poll?.result;
      if (state === "SUCCEEDED" || state === "FAILED" || state === "CANCELLED") break;
    }
  }
  const out: Record<string, number> = {};
  for (const rec of (res?.records ?? []) as Array<{ tag?: unknown; n?: unknown }>) {
    const tag = String(rec?.tag ?? "");
    if (!tag.startsWith(OWNER_PREFIX)) continue;
    const identifier = tag.slice(OWNER_PREFIX.length);
    const n = Number(rec?.n ?? 0);
    if (identifier && n > 0) out[identifier] = (out[identifier] ?? 0) + n;
  }
  return out;
}

export function useOwnershipDiscovery(active: boolean): OwnershipDiscoveryResult {
  const [teams, setTeams] = useState<TeamOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!active || started) return;
    setStarted(true);
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          ENTITY_SOURCES.map(async src => ({
            src,
            counts: await runDiscoveryQuery(src.table).catch(() => ({} as Record<string, number>)),
          })),
        );
        if (cancelled) return;

        const byTeam = new Map<string, TeamOwnership>();
        for (const { src, counts } of results) {
          for (const [identifier, n] of Object.entries(counts)) {
            let t = byTeam.get(identifier);
            if (!t) {
              t = { identifier, byCapability: {}, detail: {}, total: 0 };
              byTeam.set(identifier, t);
            }
            t.byCapability[src.capability] = (t.byCapability[src.capability] ?? 0) + n;
            (t.detail[src.capability] ??= []).push(`${n} ${src.label}`);
            t.total += n;
          }
        }
        setTeams([...byTeam.values()].sort((a, b) => b.total - a.total));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[useOwnershipDiscovery] sweep failed:", err);
        if (!cancelled) setError("Ownership discovery failed — check storage:entities:read.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [active, started]);

  return { teams, loading, error };
}

/** Compact plain-English summary of the matrix for the Davis prompt.
 *  `resolveName` maps a team identifier to its display name when known. */
export function summarizeOwnership(
  teams: TeamOwnership[],
  resolveName: (identifier: string) => string,
): string {
  if (teams.length === 0) return "";
  return teams.slice(0, 12).map(t => {
    const parts = Object.entries(t.byCapability)
      .map(([cap, n]) => `${n} components in ${cap} (${(t.detail[cap] ?? []).join(", ")})`);
    return `- Team "${resolveName(t.identifier)}" (dt.owner:${t.identifier}) owns ${parts.join("; ")}.`;
  }).join("\n");
}
