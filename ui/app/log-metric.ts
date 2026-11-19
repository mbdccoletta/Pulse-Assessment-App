// ui/app/log-metric.ts
//
// Log coverage from a metric instead of a log scan.
//
// Five Log Analytics criteria ask "which hosts / services / namespaces send
// logs, and at which severities". Answered from `fetch logs` they need a full scan, because a distinct
// count cannot be sampled (measured: at 1-in-100 the distinct hosts fell from
// 26 to 21 and the services from 35 to 27). On a high-volume tenant those scans
// were 80 of the 98 GiB of a full run.
//
// Dynatrace already counts log records per entity in the metric
// `dt.log.status_per_entity_count` (source: OpenPipeline). A timeseries query
// on it scans no log data and reads the full two hours the criteria were
// written for, instead of the 15 minutes the cost rules had to cut the scan to.
//
// The swap happens only when a probe finds the metric with both a host and a
// service dimension; otherwise the log queries run as before. Status "ERROR"
// on the metric groups the error-class levels (ERROR, SEVERE, EMERGENCY…),
// where the log query matched the literal level ERROR.

import { queryExecutionClient } from "@dynatrace-sdk/client-query";
import type { CapabilityDef } from "./queries";

const METRIC = "dt.log.status_per_entity_count";
const by = (dim: string, filter = "") =>
  `timeseries s=sum(${METRIC}), from:now()-2h, by:{${dim}}${filter} | filter isNotNull(${dim}) | summarize c=count()`;

/** criterion id → the metric query that replaces its log scan. */
export const LOG_METRIC_QUERIES: Record<string, string> = {
  l1: by("dt.entity.host"),
  l2: by("dt.entity.service"),
  l7: by("dt.entity.service", ', filter:{status == "ERROR"}'),
  l8: by("k8s.namespace.name"),
};

/** Severity diversity: the metric groups levels into three status classes
 *  (ERROR, WARN, INFO; NONE is "no level"), so the criterion counts classes
 *  out of three instead of raw levels out of five. Same question, no scan. */
const SEVERITY = {
  id: "l9",
  query: `timeseries s=sum(${METRIC}), from:now()-2h, by:{status} | filter isNotNull(status) and status != "NONE" | summarize c=count()`,
  denominatorConstant: 3,
  description: "Share of the severity classes being ingested (out of 3: ERROR, WARN, INFO), read from the log metric.",
};

/** Source diversity: the metric has no log.source dimension, and a distinct
 *  count over raw logs cannot be sampled (it cost about 46 GiB a run on a
 *  high-volume tenant). It counts the entities that emit logs instead
 *  (hosts, processes, containers, devices): the same question, "do logs come
 *  from many places", answered from the metric and marked as an approximation. */
const SOURCES = {
  id: "l6",
  query: `timeseries s=sum(${METRIC}), from:now()-2h, by:{dt.source_entity} | filter isNotNull(dt.source_entity) | summarize c=count()`,
  description: "Ratio of distinct log-emitting entities (hosts, processes, containers, devices) to total hosts, read from the log metric.",
};

export function applyLogMetricMode(caps: CapabilityDef[]): CapabilityDef[] {
  return caps.map(cap => ({
    ...cap,
    criteria: cap.criteria.map(cr => {
      if (!/\bfetch\s+logs\b/i.test(cr.query)) return cr;
      if (cr.id === SEVERITY.id) return { ...cr, query: SEVERITY.query, denominatorConstant: SEVERITY.denominatorConstant, description: SEVERITY.description };
      if (cr.id === SOURCES.id) return { ...cr, query: SOURCES.query, description: SOURCES.description, proxied: true };
      return LOG_METRIC_QUERIES[cr.id] ? { ...cr, query: LOG_METRIC_QUERIES[cr.id] } : cr;
    }),
  }));
}

/** True when the metric exists here with host and service dimensions. A metric
 *  query costs nothing; any failure answers false and the log queries run. */
export async function logMetricAvailable(): Promise<boolean> {
  try {
    const r = await queryExecutionClient.queryExecute({
      body: {
        query: `timeseries s=sum(${METRIC}), from:now()-30m, by:{dt.entity.host, dt.entity.service} | summarize h=countIf(isNotNull(dt.entity.host)), s=countIf(isNotNull(dt.entity.service))`,
        requestTimeoutMilliseconds: 15000,
        maxResultRecords: 1,
      },
    });
    const rec = r?.result?.records?.[0] as Record<string, unknown> | undefined;
    return Number(rec?.h ?? 0) > 0 && Number(rec?.s ?? 0) > 0;
  } catch {
    return false;
  }
}
