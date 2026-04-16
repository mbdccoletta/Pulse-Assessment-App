import { useState, useCallback } from "react";
import { queryExecutionClient } from "@dynatrace-sdk/client-query";

export interface PreflightCheck {
  id: string;
  label: string;
  scope: string;
  status: "pending" | "running" | "ok" | "fail";
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
      const result = await probeQuery(probe.query);
      setChecks(prev => prev.map(c => c.id === probe.id ? { ...c, status: result.ok ? "ok" : "fail", detail: result.detail } : c));
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

  // Persist validated state so preflight is skipped on subsequent runs
  const markValidated = useCallback(() => setValidated(true), []);

  return { checks, running, done, allPassed, hasFails, validated, runPreflight, reset, markValidated };
}
