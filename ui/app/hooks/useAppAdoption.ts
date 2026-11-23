// ui/app/hooks/useAppAdoption.ts
//
// Who actually USES the platform, per capability.
//
// The criteria answer "is the data there?". This hook answers the other
// half: "does anyone open the app that consumes it?" — a capability at 95%
// coverage with one active user is a very different story from the same
// 95% with a whole team in it.
//
// Source ─────────────────────────────────────────────────────────────────
// Every DQL execution lands in dt.system.events as a QUERY_EXECUTION_EVENT
// carrying `user.email` and `client.source` (the app URL, which contains
// DT_APP_ID=<app id>). Counting distinct emails per app id gives active
// users per app; ../data/appCapabilityMap.ts maps apps to capabilities.
//
// Cost ───────────────────────────────────────────────────────────────────
// dt.system.events is a system bucket: measured at 0 GB scanned on a real
// tenant, so this adds no Grail cost to the assessment. Needs the
// storage:system:read scope, which the app already requests.
//
// Honest limits (surfaced in the UI, not hidden) ─────────────────────────
//   - Only apps that run DQL appear. Pure-configuration apps never query.
//   - API/automation traffic has no client.source and is excluded.
//   - This is platform usage, not data usage: a dashboard that queries logs
//     counts for whoever opened it, not for "Log Analytics" as such.
//
// Adoption is one of the three parts of a capability score (../pulseScore.ts).
// The reading itself is the largest single-app audience of the capability,
// never a sum across apps: the same person usually opens several.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { queryExecutionClient } from "@dynatrace-sdk/client-query";
import { capabilityForApp, OTHER_BUCKET } from "../data/appCapabilityMap";

export interface AppUsage {
  appId: string;
  /** Distinct people who opened the app in the window (30 days). */
  users: number;
  /** Distinct people per day, averaged over every day of the window. */
  dailyUsers: number;
  queries: number;
  capability: string;
}

export interface CapabilityAdoption {
  /** Distinct users across all apps serving this capability. Union is not
   *  computable per capability in one pass, so this is the max across its
   *  apps — a deliberately conservative "at least N people" reading. */
  users: number;
  /** Penetration: share (0–100) of ALL active platform users who opened an
   *  app serving this capability. "12 users" means little on its own; "12
   *  of 23 people on the platform (52%)" is the readable form. */
  rate: number;
  /** Apps serving the capability, busiest first. */
  apps: AppUsage[];
}

export interface UseAppAdoptionResult {
  loading: boolean;
  /** True when the query failed or returned nothing usable. */
  unavailable: boolean;
  /** All apps observed, most users first. */
  apps: AppUsage[];
  /** capability name → adoption. Includes OTHER_BUCKET when relevant. */
  byCapability: Record<string, CapabilityAdoption>;
  /** Distinct users across the whole platform in the window. */
  totalUsers: number;
  /** Days the window covers (for labelling). */
  windowDays: number;
  refresh: () => void;
}

const WINDOW_DAYS = 30;

/** What a page reads before the app's single adoption fetch has anything. */
export const NO_ADOPTION: UseAppAdoptionResult = {
  loading: true, unavailable: false, apps: [], byCapability: {}, totalUsers: 0, windowDays: WINDOW_DAYS, refresh: () => {},
};

/** Distinct users + query count per app id, over the window. Service
 *  accounts (heimdall) are excluded so the count reflects real people. */
// Keyed on client.application_context — the documented field for "which app
// ran this query". The earlier version parsed DT_APP_ID out of client.source,
// which is missing on many apps' queries: on a real tenant it showed Dashboards
// and Dynatrace Assist with no users and Problems at half its real audience.
// The platform shell itself (dynatrace.appshell) is not an app people choose.
const ADOPTION_QUERY = `
fetch dt.system.events, from:now()-${WINDOW_DAYS}d
| filter event.kind == "QUERY_EXECUTION_EVENT"
| filter isNotNull(client.application_context) and client.application_context != "dynatrace.appshell"
| filter isNotNull(user.email) and not(contains(user.email, "heimdall.dynatrace.com"))
| summarize users = countDistinct(user.email), queries = count(), by:{appId = client.application_context}
| sort users desc, queries desc
| limit 200`;

/** Distinct people per app per day, averaged over all days of the window
 *  (days without use count as zero). Same filters as above; system events,
 *  no Grail scan. */
const DAILY_USERS_QUERY = `
fetch dt.system.events, from:now()-${WINDOW_DAYS}d
| filter event.kind == "QUERY_EXECUTION_EVENT"
| filter isNotNull(client.application_context) and client.application_context != "dynatrace.appshell"
| filter isNotNull(user.email) and not(contains(user.email, "heimdall.dynatrace.com"))
| summarize u = countDistinct(user.email), by:{appId = client.application_context, day = bin(timestamp, 1d)}
| summarize dailyUsers = sum(u) / ${WINDOW_DAYS}.0, by:{appId}
| limit 200`;

const TOTAL_USERS_QUERY = `
fetch dt.system.events, from:now()-${WINDOW_DAYS}d
| filter event.kind == "QUERY_EXECUTION_EVENT"
| filter isNotNull(user.email) and not(contains(user.email, "heimdall.dynatrace.com"))
| summarize users = countDistinct(user.email)`;

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return 0;
};

async function runQuery(query: string): Promise<Record<string, unknown>[] | null> {
  try {
    let res: { state?: string; result?: unknown; requestToken?: string } | undefined = await queryExecutionClient.queryExecute({
      body: { query, requestTimeoutMilliseconds: 30_000, maxResultRecords: 200 },
    });
    // 30 days of system events can outlive the request timeout on a large
    // tenant: poll for the result instead of reading "no adoption".
    const token = res?.requestToken;
    for (let i = 0; res?.state === "RUNNING" && token && i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      res = await queryExecutionClient.queryPoll({ requestToken: token });
    }
    if (res?.state !== "SUCCEEDED" && res?.state !== undefined) return null;
    const records = (res?.result as { records?: Record<string, unknown>[] } | undefined)?.records;
    return Array.isArray(records) ? records : null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[useAppAdoption] query failed:", err);
    return null;
  }
}

export function useAppAdoption(enabled: boolean): UseAppAdoptionResult {
  const [loading, setLoading] = useState(false);
  /** True once a first answer (data or failure) arrived. Until then the hook
   *  reports loading, so nothing scores or saves adoption as zero in the gap
   *  between being enabled and the query starting. */
  const [done, setDone] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [apps, setApps] = useState<AppUsage[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [runId, setRunId] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (startedRef.current && runId === 0) return;
    startedRef.current = true;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setUnavailable(false);
      const [rows, totalRows, dailyRows] = await Promise.all([
        runQuery(ADOPTION_QUERY),
        runQuery(TOTAL_USERS_QUERY),
        runQuery(DAILY_USERS_QUERY),
      ]);
      const daily = new Map((dailyRows ?? []).map(r => [String(r.appId ?? ""), num(r.dailyUsers)]));
      if (cancelled) return;

      if (!rows || rows.length === 0) {
        setApps([]);
        setUnavailable(true);
        setLoading(false);
        setDone(true);
        return;
      }
      const parsed: AppUsage[] = rows
        .map(r => {
          const appId = String(r.appId ?? "");
          return {
            appId,
            users: num(r.users),
            dailyUsers: daily.get(appId) ?? 0,
            queries: num(r.queries),
            capability: capabilityForApp(appId),
          };
        })
        .filter(a => a.appId !== "");

      // Without the population there is no share to compute: adoption is then
      // "not measured", never 0% for every capability.
      const total = totalRows && totalRows[0] ? num(totalRows[0].users) : 0;
      if (total <= 0) {
        setApps(parsed);
        setUnavailable(true);
        setLoading(false);
        setDone(true);
        return;
      }
      setApps(parsed);
      setTotalUsers(total);
      setLoading(false);
      setDone(true);
    })();

    return () => { cancelled = true; };
  }, [enabled, runId]);

  // Memoized: App.tsx keys the score on this object's identity.
  const byCapability = useMemo(() => {
  const byCapability: Record<string, CapabilityAdoption> = {};
  for (const a of apps) {
    const entry = byCapability[a.capability] ?? { users: 0, rate: 0, apps: [] };
    entry.apps.push(a);
    // Conservative: report the best-attested single app rather than summing
    // users across apps (the same person usually opens several).
    entry.users = Math.max(entry.users, a.users);
    byCapability[a.capability] = entry;
  }
  for (const entry of Object.values(byCapability)) {
    entry.apps.sort((x, y) => y.users - x.users || y.queries - x.queries);
    // Penetration against the whole active population, capped at 100 (the
    // per-app count can never exceed the platform total, but a stale total
    // from a failed second query should not produce >100%).
    entry.rate = totalUsers > 0 ? Math.min(100, Math.floor((entry.users / totalUsers) * 100)) : 0;
  }
  return byCapability;
  }, [apps, totalUsers]);

  const refresh = useCallback(() => setRunId(n => n + 1), []);

  return { loading: loading || (enabled && !done), unavailable, apps, byCapability, totalUsers, windowDays: WINDOW_DAYS, refresh };
}

/** "N people a month · M a day" — people, never queries: a dashboard on a wall
 *  screen runs thousands of queries for nobody. */
export function peopleReading(a: Pick<AppUsage, "users" | "dailyUsers">, month = "a month", day = "a day", people = "people"): string {
  const d = a.dailyUsers > 0 && a.dailyUsers < 1 ? "<1" : Math.floor(a.dailyUsers).toLocaleString();
  return `${a.users.toLocaleString()} ${people} ${month} · ${d} ${day}`;
}

export { OTHER_BUCKET };
