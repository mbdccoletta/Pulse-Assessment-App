import { useState, useCallback } from "react";
import { queryExecutionClient } from "@dynatrace-sdk/client-query";
import { isDevEnvironment } from "./useDevMode";

export interface PreflightCheck {
  id: string;
  label: string;
  scope: string;
  status: "pending" | "running" | "ok" | "fail" | "not-entitled";
  detail?: string;
}

const PROBE_QUERIES: { id: string; label: string; scope: string; query: string }[] = [
  { id: "entities", label: "Entities (hosts, services, apps)", scope: "storage:entities:read", query: "fetch dt.entity.host | limit 1 | summarize count()" },
  { id: "logs",     label: "Log data",                         scope: "storage:logs:read",     query: "fetch logs | limit 1 | summarize count()" },
  { id: "metrics",  label: "Metrics (timeseries)",              scope: "storage:metrics:read",  query: "timeseries avg(dt.host.cpu.usage), by:{dt.entity.host} | limit 1 | summarize c = count()" },
  { id: "events",   label: "Events & problems",                 scope: "storage:events:read",   query: "fetch events | limit 1 | summarize count()" },
  { id: "spans",    label: "Distributed traces (spans)",         scope: "storage:spans:read",    query: "fetch spans | limit 1 | summarize count()" },
  { id: "bizevents",label: "Business events",                    scope: "storage:bizevents:read",query: "fetch bizevents | limit 1 | summarize count()" },
  { id: "buckets",  label: "Grail buckets",                      scope: "storage:buckets:read",  query: "fetch dt.system.buckets | limit 1 | summarize count()" },
];

/** Tenant-level entitlement failures (e.g. TRACE_QUERY_ENTITLEMENT_MISSING /
 *  exceptionType ENTITLEMENT-MISSING) are NOT scope problems — granting
 *  OAuth scopes cannot fix them. They get their own status so the UI can
 *  offer Trace Proxy Mode instead of the misleading "grant scopes" advice. */
function isEntitlementError(detail: string): boolean {
  return detail.toUpperCase().includes("ENTITLEMENT");
}

/** Dev-only simulation of a tenant without Traces on Grail, so Trace Proxy
 *  Mode can be tested on bwm98081 (which HAS spans). Never active outside
 *  the dev environment — a customer tenant cannot trip this. */
function simulateNoTraces(): boolean {
  if (!isDevEnvironment()) return false;
  try {
    if (typeof window === "undefined") return false;
    const p = new URLSearchParams(window.location.search).get("noTraces");
    if (p === "1" || p === "true") return true;
    return window.localStorage.getItem("cca.noTraces") === "1";
  } catch {
    return false;
  }
}

async function probeQuery(query: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await queryExecutionClient.queryExecute({
      body: { query, requestTimeoutMilliseconds: 15000, maxResultRecords: 1 },
    });
    const state = response?.state;
    if (state === "FAILED" || state === "CANCELLED") {
      const notes = (response?.result as any)?.metadata?.grail?.notifications ?? [];
      const msg = notes.map((n: any) => n.message).join("; ") || `Query ${state}`;
      return { ok: false, detail: msg };
    }
    return { ok: true, detail: "Access confirmed" };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (isEntitlementError(msg))
      return { ok: false, detail: msg.length > 160 ? msg.substring(0, 160) + "…" : msg };
    if (msg.includes("403") || msg.includes("Forbidden") || msg.includes("permission"))
      return { ok: false, detail: "Permission denied — scope not granted to this app" };
    if (msg.includes("401") || msg.includes("Unauthorized"))
      return { ok: false, detail: "Authentication failed — app token may be invalid" };
    return { ok: false, detail: msg.length > 120 ? msg.substring(0, 120) + "…" : msg };
  }
}

export function usePreflight() {
  const [checks, setChecks] = useState<PreflightCheck[]>(
    PROBE_QUERIES.map(p => ({ id: p.id, label: p.label, scope: p.scope, status: "pending" as const }))
  );
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [validated, setValidated] = useState(false);

  const runPreflight = useCallback(async () => {
    if (validated) return;  // already passed — skip
    setRunning(true);
    setDone(false);
    setChecks(PROBE_QUERIES.map(p => ({ id: p.id, label: p.label, scope: p.scope, status: "running" })));

    for (const probe of PROBE_QUERIES) {
      if (probe.id === "spans" && simulateNoTraces()) {
        setChecks(prev => prev.map(c => c.id === probe.id
          ? { ...c, status: "not-entitled", detail: "Simulated (dev): Query failed: TRACE_QUERY_ENTITLEMENT_MISSING" }
          : c));
        continue;
      }
      const result = await probeQuery(probe.query);
      const status: PreflightCheck["status"] = result.ok
        ? "ok"
        : probe.id === "spans" && isEntitlementError(result.detail)
          ? "not-entitled"
          : "fail";
      setChecks(prev => prev.map(c => c.id === probe.id ? { ...c, status, detail: result.detail } : c));
    }
    setRunning(false);
    setDone(true);
  }, [validated]);

  const reset = useCallback(() => {
    setChecks(PROBE_QUERIES.map(p => ({ id: p.id, label: p.label, scope: p.scope, status: "pending" })));
    setDone(false);
    setRunning(false);
  }, []);

  const allPassed = done && checks.every(c => c.status === "ok");
  const hasFails = done && checks.some(c => c.status === "fail");
  /** Every source is fine EXCEPT spans, which failed on the tenant-level
   *  Traces on Grail entitlement → the app can offer Trace Proxy Mode. */
  const spansNotEntitled = done && !hasFails && checks.some(c => c.id === "spans" && c.status === "not-entitled");

  // Persist validated state so preflight is skipped on subsequent runs
  const markValidated = useCallback(() => setValidated(true), []);

  return { checks, running, done, allPassed, hasFails, spansNotEntitled, validated, runPreflight, reset, markValidated };
}
