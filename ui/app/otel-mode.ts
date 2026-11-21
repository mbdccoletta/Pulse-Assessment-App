// ui/app/otel-mode.ts
//
// OpenTelemetry-only environments.
//
// A tenant fed only by OpenTelemetry (SDKs and Collectors, no OneAgent) has no
// host or process-group entities and none of the dt.host.* / dt.process.* /
// dt.kubernetes.* metrics. The default catalog reads exactly those for hosts
// and Kubernetes, so on such a tenant Infrastructure Observability, the
// host side of Log Analytics and parts of Governance read as empty, although
// the telemetry is there under the OpenTelemetry names:
//
//   hosts       system.* metrics (hostmetrics receiver) and k8s.node.* metrics,
//               identified by host.name or k8s.node.name
//   Kubernetes  k8s.* and container.* metrics (kubeletstats, k8s_cluster),
//               identified by k8s.cluster.name, k8s.namespace.name
//   processes   process.* metrics, identified by service.name
//   logs        resource attributes host.name / k8s.node.name on the records
//
// This module swaps those criteria for readings of the OpenTelemetry signals.
// Each swapped criterion keeps its id, tier and pass line, so the score means
// the same thing; it is marked `proxied` because the population is the hosts,
// nodes and namespaces OpenTelemetry reports, not a platform entity list.
//
// Criteria that only exist with OneAgent (process topology, runtime
// vulnerability analytics, agent versions, carbon measurement) have no
// OpenTelemetry form. They leave the run, and the denominators with them: an
// environment is not marked down for a product it chose not to deploy.
//
// Services need no swap: Dynatrace detects services from OTLP spans, so the
// service criteria read the same entities and metrics either way.
//
// The metric names and dimensions below were checked against a tenant that
// receives them (kubeletstats, k8s_cluster, hostmetrics and SDK runtime
// metrics). All of the metric readings are `timeseries` queries: no Grail scan.

import type { CapabilityDef, Criterion } from "./queries";

/** One identity per machine: a Kubernetes node by k8s.node.name, anything else
 *  by host.name. The node comes first because an SDK inside a container reports
 *  the pod name as host.name. */
const HOST_KEY = "coalesce(k8s.node.name, host.name)";
/** Null when the series has no namespace, so it never counts as one. */
const NS_KEY = 'if(isNotNull(k8s.namespace.name), concat(coalesce(k8s.cluster.name, ""), "/", k8s.namespace.name))';

/** Distinct values of `key` over the series of any of the metrics. A metric
 *  the tenant does not have yields no series, so listing alternatives is safe. */
function distinctOver(metrics: string[], by: string, key: string, as = "k"): string {
  const one = (m: string) => `timeseries v = avg(${m}), by:{${by}} | fields ${as} = ${key}`;
  const [first, ...rest] = metrics;
  return `${one(first)}${rest.map(m => ` | append [${one(m)}]`).join("")} | filter isNotNull(${as}) | summarize count = countDistinct(${as})`;
}
const hostsWith = (metrics: string[]) => distinctOver(metrics, "host.name, k8s.node.name", HOST_KEY);
const namespacesWith = (metrics: string[]) => distinctOver(metrics, "k8s.cluster.name, k8s.namespace.name", NS_KEY);
const clustersWith = (metrics: string[]) => distinctOver(metrics, "k8s.cluster.name", "k8s.cluster.name");
const nodesWith = (metrics: string[]) => distinctOver(metrics, "k8s.node.name", "k8s.node.name");

/** Every machine OpenTelemetry reports on, by any host or node signal: the
 *  denominator of the host criteria. Built from every family, so that no single
 *  criterion (CPU, memory, disk...) defines the population it is measured against. */
export const OTEL_HOSTS = hostsWith([
  "system.cpu.utilization", "system.cpu.time", "system.memory.usage", "system.memory.utilization",
  "system.disk.io", "system.filesystem.usage", "system.network.io", "system.uptime",
  "k8s.node.cpu.usage", "k8s.node.memory.usage", "k8s.node.condition_ready", "k8s.node.network.io", "k8s.pod.cpu.usage",
]);
const OTEL_NAMESPACES = namespacesWith(["k8s.namespace.phase", "k8s.pod.phase", "k8s.pod.cpu.usage"]);
const OTEL_CLUSTERS = clustersWith(["k8s.node.cpu.usage", "k8s.namespace.phase", "k8s.pod.phase", "k8s.deployment.available"]);
const OTEL_NODES = nodesWith(["k8s.node.condition_ready", "k8s.node.allocatable_cpu", "k8s.node.cpu.usage", "k8s.pod.cpu.usage"]);

interface Swap {
  query: string;
  /** Replaces the denominator query. Omit to keep the criterion's own. */
  queryB?: string;
  /** Constant denominator, for a swap that turns a share into a presence check. */
  denominatorConstant?: number;
  thresholds?: { min: number }[];
  label?: string;
  description: string;
  /** What to do when the criterion is not met, in OpenTelemetry terms. */
  action?: string;
}

const LOGS_2H = "fetch logs | filter timestamp > now() - 2h";

/** Criterion id → its OpenTelemetry reading. */
export const OTEL_SWAPS: Record<string, Swap> = {
  // ── Infrastructure Observability: hosts ──
  i1: { query: hostsWith(["system.cpu.utilization", "system.cpu.time", "k8s.node.cpu.usage"]), queryB: OTEL_HOSTS,
    description: "Share of the hosts and Kubernetes nodes reported through OpenTelemetry that send CPU metrics (system.cpu.* or k8s.node.cpu.*).",
    action: "Enable the cpu scraper of the Collector hostmetrics receiver on every host, and run the kubeletstats receiver on every Kubernetes node." },
  i2: { query: hostsWith(["system.memory.usage", "system.memory.utilization", "k8s.node.memory.usage"]), queryB: OTEL_HOSTS,
    description: "Share of the hosts and Kubernetes nodes reported through OpenTelemetry that send memory metrics (system.memory.* or k8s.node.memory.*).",
    action: "Enable the memory scraper of the Collector hostmetrics receiver on every host, and run the kubeletstats receiver on every Kubernetes node." },
  i3: { query: hostsWith(["system.filesystem.usage", "system.disk.io", "k8s.node.filesystem.usage"]), queryB: OTEL_HOSTS,
    description: "Share of the hosts and Kubernetes nodes reported through OpenTelemetry that send disk or filesystem metrics.",
    action: "Enable the disk and filesystem scrapers of the hostmetrics receiver; on Kubernetes the kubeletstats receiver reports node filesystem usage." },
  i4: { query: hostsWith(["k8s.node.condition_ready", "system.uptime"]), queryB: OTEL_HOSTS,
    description: "Share of the hosts and Kubernetes nodes reported through OpenTelemetry that send an availability signal (node readiness or system.uptime).",
    action: "Collect system.uptime with the hostmetrics receiver, and node conditions with the k8s_cluster receiver." },
  i5: { query: hostsWith(["system.network.io", "k8s.node.network.io"]), queryB: OTEL_HOSTS,
    description: "Share of the hosts and Kubernetes nodes reported through OpenTelemetry that send network metrics.",
    action: "Enable the network scraper of the hostmetrics receiver; on Kubernetes the kubeletstats receiver reports node network I/O." },
  i6: { query: distinctOver(["process.cpu.utilization", "process.cpu.time"], "service.name", "service.name"),
    queryB: distinctOver(["process.cpu.utilization", "process.cpu.time", "process.memory.usage", "http.server.request.duration", "http.server.duration", "jvm.memory.used", "process.runtime.jvm.memory.usage"], "service.name", "service.name"),
    description: "Share of the services that send OpenTelemetry metrics and include process CPU metrics (process.cpu.*).",
    action: "Turn on process metrics in the SDK runtime instrumentation, or the process scraper of the hostmetrics receiver, so every service reports process.cpu.*." },
  i13: { query: `${LOGS_2H} | filter isNotNull(cloud.provider) | fieldsAdd k = ${HOST_KEY} | filter isNotNull(k) | summarize count = countDistinct(k) | fields count`, queryB: OTEL_HOSTS,
    description: "Share of the hosts and nodes reported through OpenTelemetry whose logs carry cloud provider context.",
    action: "Add the resourcedetection processor with the cloud detectors to the Collector, so log records carry cloud.provider." },

  // ── Infrastructure Observability: Kubernetes ──
  i7: { query: clustersWith(["k8s.pod.cpu.usage", "container.cpu.usage"]), queryB: OTEL_CLUSTERS,
    description: "Share of the Kubernetes clusters reported through OpenTelemetry that send pod or container CPU metrics.",
    action: "Run the kubeletstats receiver in every cluster so pod and container CPU metrics arrive." },
  i10: { query: namespacesWith(["k8s.deployment.available", "k8s.daemonset.ready_nodes", "k8s.statefulset.ready_pods"]), queryB: OTEL_NAMESPACES,
    description: "Share of the Kubernetes namespaces reported through OpenTelemetry that have workload metrics (deployments, daemonsets or statefulsets).",
    action: "Run the k8s_cluster receiver so deployments, daemonsets and statefulsets are reported for every namespace." },
  i12: { query: clustersWith(["k8s.namespace.phase", "k8s.pod.phase"]), queryB: OTEL_CLUSTERS,
    description: "Share of the Kubernetes clusters reported through OpenTelemetry whose namespaces and pods are reported (k8s_cluster receiver).",
    action: "Run the k8s_cluster receiver in every cluster so its namespaces and pods are reported." },
  i19: { query: nodesWith(["k8s.node.cpu.usage", "k8s.node.memory.usage"]), queryB: OTEL_NODES,
    description: "Share of the Kubernetes nodes reported through OpenTelemetry that send node resource metrics (kubeletstats).",
    action: "Run the kubeletstats receiver as a daemonset so every node reports its resource metrics." },
  i20: { query: namespacesWith(["k8s.pod.cpu.usage", "container.cpu.usage"]), queryB: OTEL_NAMESPACES,
    description: "Share of the Kubernetes namespaces reported through OpenTelemetry that send pod or container CPU metrics.",
    action: "Run the kubeletstats receiver as a daemonset so the pods of every namespace report CPU metrics." },
  i21: { query: namespacesWith(["k8s.container.restarts"]), queryB: OTEL_NAMESPACES,
    description: "Share of the Kubernetes namespaces reported through OpenTelemetry that send container restart counts.",
    action: "Collect k8s.container.restarts with the k8s_cluster receiver for every namespace." },
  i22: { query: namespacesWith(["k8s.container.cpu_limit", "k8s.container.memory_limit"]), queryB: OTEL_NAMESPACES,
    description: "Share of the Kubernetes namespaces reported through OpenTelemetry whose containers report resource limits.",
    action: "Set CPU and memory limits on the workloads and collect them with the k8s_cluster receiver." },

  // ── Log Analytics: the host and namespace side ──
  l1: { query: `${LOGS_2H} | fieldsAdd k = ${HOST_KEY} | filter isNotNull(k) | summarize count = countDistinct(k) | fields count`, queryB: OTEL_HOSTS,
    description: "Share of the hosts and nodes reported through OpenTelemetry that sent log records in the last 2h.",
    action: "Ship logs from every host with the Collector filelog receiver, or as OTLP logs from the SDKs, keeping host.name or k8s.node.name on the records." },
  l4: { query: 'fieldsSnapshot logs | filter field == "service.name" | fields relative_count',
    description: "Share of log records that carry the service.name resource attribute, which ties a record to the service that wrote it.",
    action: "Put service.name on every log record: use the SDK log bridge, or the k8sattributes and resource processors in the Collector." },
  l6: { query: `${LOGS_2H} | summarize countDistinct(coalesce(log.source, log.file.path, service.name))`, queryB: OTEL_HOSTS,
    description: "Distinct log sources (log.source, file path or service) relative to the hosts and nodes reported through OpenTelemetry.",
    action: "Collect more than application output: add system, audit and ingress logs to the Collector filelog receiver." },
  // Free: the per-entity log metric carries the namespace, so no log scan is needed.
  l8: { query: namespacesWith(["dt.log.status_per_entity_count"]).replace("avg(", "sum("), queryB: OTEL_NAMESPACES,
    description: "Share of the Kubernetes namespaces reported through OpenTelemetry that sent log records in the last 2h.",
    action: "Deploy the Collector filelog receiver as a daemonset with the k8sattributes processor, so every namespace ships logs." },
  l14: { query: `${LOGS_2H} | fieldsAdd k = ${HOST_KEY} | filter isNotNull(k) | summarize sources = countDistinct(coalesce(log.source, log.file.path, service.name)), by:{k} | filter sources >= 2 | summarize count()`, queryB: OTEL_HOSTS,
    description: "Share of the hosts and nodes reported through OpenTelemetry that send logs from two or more sources.",
    action: "Collect at least two log sources per host, for example application logs and system logs." },

  // ── Platform Governance ──
  g2: { query: distinctOver(["otelcol_process_uptime", "otelcol_exporter_queue_size", "otelcol_process_memory_rss"], "service.instance.id, service.name, k8s.pod.name", "coalesce(service.instance.id, k8s.pod.name, service.name)"),
    denominatorConstant: 1, thresholds: [{ min: 100 }],
    label: "Collector health telemetry",
    description: "OpenTelemetry Collectors that report their own health metrics (otelcol_*). Without them a Collector that drops or queues data goes unnoticed.",
    action: "Enable the Collector's internal telemetry (service.telemetry.metrics) and export it to Dynatrace, then alert on queue size and failed exports." },
};

/** Criteria that only exist with OneAgent, and why they leave the run. */
export const OTEL_EXCLUSION_REASONS: Record<string, string> = {
  i8: "Disk entities are created by OneAgent; disk coverage is read from the disk metrics instead.",
  i9: "Problems are counted per host entity, which only OneAgent creates.",
  i11: "Host-to-process topology is built by OneAgent.",
  a11: "Service-to-process mapping is built by OneAgent.",
  s1: "Runtime Vulnerability Analytics needs OneAgent code modules.",
  s13: "Runtime Vulnerability Analytics needs OneAgent code modules.",
  s11: "Runtime Application Protection needs OneAgent code modules.",
  f2: "Carbon measurement per host is computed from OneAgent host data.",
  f5: "Carbon measurement per namespace is computed from OneAgent host data.",
  f6: "Host utilization for cost is computed from OneAgent host data.",
};

export interface OtelModeInfo {
  /** Criteria read from OpenTelemetry metrics and attributes. */
  swappedIds: string[];
  /** Criteria that only exist with OneAgent, removed from the run and from every denominator. */
  excludedIds: string[];
}

/** The swaps that scan the logs table: hosts outside Kubernetes have no free log signal. */
const LOG_SCAN_SWAPS = new Set(Object.entries(OTEL_SWAPS).filter(([, s]) => s.query.startsWith("fetch logs")).map(([id]) => id));

/** The catalog for an environment fed only by OpenTelemetry.
 *  `skipLogScans` is for simulating the mode on a tenant that has OneAgent and
 *  a very high log volume: the criteria that scan logs then leave the run, so
 *  the simulation costs nothing. Never set on a real OpenTelemetry-only run. */
export function applyOtelMode(caps: CapabilityDef[], opts: { skipLogScans?: boolean } = {}): { caps: CapabilityDef[]; info: OtelModeInfo } {
  const swappedIds: string[] = [];
  const excludedIds: string[] = [];
  const out: CapabilityDef[] = [];
  for (const cap of caps) {
    const criteria: Criterion[] = [];
    for (const cr of cap.criteria) {
      if (OTEL_EXCLUSION_REASONS[cr.id] || (opts.skipLogScans && LOG_SCAN_SWAPS.has(cr.id))) { excludedIds.push(cr.id); continue; }
      const s = OTEL_SWAPS[cr.id];
      if (!s) { criteria.push(cr); continue; }
      swappedIds.push(cr.id);
      const next: Criterion = { ...cr, query: s.query, description: s.description, proxied: true };
      if (s.label) next.label = s.label;
      if (s.thresholds) next.thresholds = s.thresholds;
      if (s.denominatorConstant != null) { next.denominatorConstant = s.denominatorConstant; delete next.queryB; }
      else if (s.queryB) { next.queryB = s.queryB; delete next.denominatorConstant; }
      criteria.push(next);
    }
    if (criteria.length > 0) out.push({ ...cap, criteria });
  }
  return { caps: out, info: { swappedIds, excludedIds } };
}

/** Remediation for the swapped criteria, in OpenTelemetry terms: the default
 *  actions tell the reader to deploy or configure OneAgent. */
export const OTEL_ACTIONS: Record<string, { action: string; docUrl: string; docLabel: string }> = Object.fromEntries(
  Object.entries(OTEL_SWAPS).filter(([, s]) => s.action).map(([id, s]) => [id, {
    action: s.action as string,
    docUrl: "https://docs.dynatrace.com/docs/ingest-from/opentelemetry",
    docLabel: "OpenTelemetry on Dynatrace",
  }]),
);

// ── Mixed environments: OneAgent and OpenTelemetry side by side ─────────────
//
// Part of the estate runs OneAgent, part only OpenTelemetry. The default
// catalog would measure the OneAgent part alone and leave the rest out; the
// OpenTelemetry catalog would do the opposite. Here each criterion counts both
// sides in one population: a host is the same host whichever side reports it,
// matched by its short lower-case name (OneAgent's entity name, or the
// OpenTelemetry node or host name), so a host seen by both counts once.
//
// Kubernetes is matched by cluster and namespace name, processes by process
// group instance (OneAgent) or service name (OpenTelemetry). Criteria that only
// exist with OneAgent keep their reading: they measure the OneAgent part.

/** Short lower-case name: "Web-01.corp.example" and "web-01" are the same host. */
const short = (x: string) => `splitString(lower(${x}), ".")[0]`;
const OTEL_HOST = short(HOST_KEY);
const OA_HOST = short("entityName(dt.entity.host)");
const part = (metric: string, by: string, key: string, agg = "avg", window = "") => `timeseries v = ${agg}(${metric}), by:{${by}}${window} | fields k = ${key}`;
/** Namespace and cluster keys are compared lower-case on both sides. */
const MIXED_NS_KEY = `lower(${NS_KEY})`;
const unionCount = (parts: string[]) =>
  `${parts[0]}${parts.slice(1).map(p => ` | append [${p}]`).join("")} | filter isNotNull(k) | summarize count = countDistinct(k)`;
const otelHostParts = (metrics: string[]) => metrics.map(m => part(m, "host.name, k8s.node.name", OTEL_HOST));
const oaHostPart = (metric: string, agg = "avg") => part(metric, "dt.entity.host", OA_HOST, agg);
const nsParts = (metrics: string[], agg = "avg") => metrics.map(m => part(m, "k8s.cluster.name, k8s.namespace.name", MIXED_NS_KEY, agg));
const clusterParts = (metrics: string[]) => metrics.map(m => part(m, "k8s.cluster.name", "lower(k8s.cluster.name)"));
/** The entity lists, so a namespace or cluster that sends no metric still counts in the population. */
const ENTITY_NAMESPACES = 'fetch dt.entity.cloud_application_namespace | fieldsAdd c = clustered_by[dt.entity.kubernetes_cluster] | lookup [fetch dt.entity.kubernetes_cluster | fields id, entity.name], sourceField: c, lookupField: id | fields k = lower(concat(coalesce(lookup.entity.name, ""), "/", entity.name))';
const ENTITY_CLUSTERS = "fetch dt.entity.kubernetes_cluster | fields k = lower(entity.name)";
const nodeParts = (metrics: string[]) => metrics.map(m => part(m, "k8s.node.name", short("k8s.node.name")));

const OTEL_HOST_METRICS = [
  "system.cpu.utilization", "system.cpu.time", "system.memory.usage", "system.memory.utilization",
  "system.disk.io", "system.filesystem.usage", "system.network.io", "system.uptime",
  "k8s.node.cpu.usage", "k8s.node.memory.usage", "k8s.node.condition_ready", "k8s.node.network.io", "k8s.pod.cpu.usage",
];
/** Every host on either side. */
export const MIXED_HOSTS = unionCount([`fetch dt.entity.host | fields k = ${short("entity.name")}`, ...otelHostParts(OTEL_HOST_METRICS)]);
const OA_K8S = ["dt.kubernetes.container.cpu_usage", "dt.kubernetes.container.restarts", "dt.kubernetes.container.limits_cpu"];
/** Namespaces seen by either side, including those that only ship logs. */
const MIXED_NAMESPACES = unionCount([ENTITY_NAMESPACES, ...nsParts(OA_K8S), ...nsParts(["k8s.namespace.phase", "k8s.pod.phase", "k8s.pod.cpu.usage"]), ...nsParts(["dt.log.status_per_entity_count"], "sum")]);
const MIXED_CLUSTERS = unionCount([ENTITY_CLUSTERS, ...clusterParts(["dt.kubernetes.container.cpu_usage"]), ...clusterParts(["k8s.node.cpu.usage", "k8s.namespace.phase", "k8s.pod.phase", "k8s.deployment.available"])]);
const MIXED_NODES = unionCount([`fetch dt.entity.kubernetes_node | fields k = ${short("entity.name")}`, ...nodeParts(["dt.kubernetes.container.cpu_usage"]), ...nodeParts(["k8s.node.condition_ready", "k8s.node.allocatable_cpu", "k8s.node.cpu.usage", "k8s.pod.cpu.usage"])]);

/** Free log signal per host: the per-entity log metric carries the OneAgent host and the Kubernetes node. */
const LOG_METRIC_HOSTS = [
  part("dt.log.status_per_entity_count", "dt.entity.host", OA_HOST, "sum"),
  part("dt.log.status_per_entity_count", "k8s.node.name", short("k8s.node.name"), "sum"),
];

interface MixedSwap { query: string; queryB?: string }
/** Criterion id → its reading over both sides. */
export const MIXED_SWAPS: Record<string, MixedSwap> = {
  i1: { query: unionCount([oaHostPart("dt.host.cpu.usage"), ...otelHostParts(["system.cpu.utilization", "system.cpu.time", "k8s.node.cpu.usage"])]), queryB: MIXED_HOSTS },
  i2: { query: unionCount([oaHostPart("dt.host.memory.usage"), ...otelHostParts(["system.memory.usage", "system.memory.utilization", "k8s.node.memory.usage"])]), queryB: MIXED_HOSTS },
  i3: { query: unionCount([oaHostPart("dt.host.disk.used.percent"), ...otelHostParts(["system.filesystem.usage", "system.disk.io", "k8s.node.filesystem.usage"])]), queryB: MIXED_HOSTS },
  i4: { query: unionCount([oaHostPart("dt.host.availability", "sum"), ...otelHostParts(["k8s.node.condition_ready", "system.uptime"])]), queryB: MIXED_HOSTS },
  i5: { query: unionCount([
    `fetch dt.entity.network_interface | fieldsAdd h = belongs_to[dt.entity.host] | lookup [fetch dt.entity.host | fields id, entity.name], sourceField: h, lookupField: id | fields k = ${short("lookup.entity.name")}`,
    ...otelHostParts(["system.network.io", "k8s.node.network.io"]),
  ]), queryB: MIXED_HOSTS },
  // Processes: OneAgent process group instances and OpenTelemetry services. A
  // 30-minute window keeps the reading under the data-point ceiling of very large estates.
  i6: {
    query: unionCount([part("dt.process.cpu.usage", "dt.entity.process_group_instance", "toString(dt.entity.process_group_instance)", "avg", ", from: now()-30m"),
      part("process.cpu.time", "service.name, dt.entity.process_group_instance", 'if(isNull(dt.entity.process_group_instance), concat("svc:", service.name))', "avg", ", from: now()-30m")]),
    queryB: unionCount(["fetch dt.entity.process_group_instance | fields k = toString(id)",
      ...["process.cpu.time", "process.memory.usage", "http.server.request.duration"]
        .map(m => part(m, "service.name, dt.entity.process_group_instance", 'if(isNull(dt.entity.process_group_instance), concat("svc:", service.name))', "avg", ", from: now()-30m"))]),
  },
  i7: { query: unionCount([...clusterParts(["dt.kubernetes.container.cpu_usage", "k8s.pod.cpu.usage", "container.cpu.usage"])]), queryB: MIXED_CLUSTERS },
  i19: { query: unionCount([...nodeParts(["dt.kubernetes.container.cpu_usage", "k8s.node.cpu.usage", "k8s.node.memory.usage"])]), queryB: MIXED_NODES },
  i20: { query: unionCount(nsParts(["dt.kubernetes.container.cpu_usage", "k8s.pod.cpu.usage", "container.cpu.usage"])), queryB: MIXED_NAMESPACES },
  i21: { query: unionCount([...nsParts(["dt.kubernetes.container.restarts"], "max"), ...nsParts(["k8s.container.restarts"], "max")]), queryB: MIXED_NAMESPACES },
  i22: { query: unionCount(nsParts(["dt.kubernetes.container.limits_cpu", "k8s.container.cpu_limit", "k8s.container.memory_limit"])), queryB: MIXED_NAMESPACES },
  // Logs: OneAgent hosts and Kubernetes nodes from the free log metric; hosts
  // outside Kubernetes reported only through OpenTelemetry need the records.
  l1: { query: unionCount([...LOG_METRIC_HOSTS,
    `${LOGS_2H} | filter isNull(dt.entity.host) and isNull(k8s.node.name) and isNotNull(host.name) | fields k = ${short("host.name")} | dedup k`]), queryB: MIXED_HOSTS },
  l6: { query: `${LOGS_2H} | summarize countDistinct(coalesce(log.source, log.file.path, service.name))`, queryB: MIXED_HOSTS },
  l8: { query: unionCount(nsParts(["dt.log.status_per_entity_count"], "sum")), queryB: MIXED_NAMESPACES },
};
const MIXED_LOG_SCANS = new Set(Object.entries(MIXED_SWAPS).filter(([, s]) => s.query.includes("fetch logs")).map(([id]) => id));

/** The catalog for an environment where OneAgent and OpenTelemetry both report. */
export function applyMixedMode(caps: CapabilityDef[], opts: { skipLogScans?: boolean } = {}): { caps: CapabilityDef[]; info: OtelModeInfo } {
  const swappedIds: string[] = [];
  const out = caps.map(cap => ({
    ...cap,
    criteria: cap.criteria.map(cr => {
      const s = MIXED_SWAPS[cr.id];
      if (!s || (opts.skipLogScans && MIXED_LOG_SCANS.has(cr.id))) return cr;
      swappedIds.push(cr.id);
      const next: Criterion = { ...cr, query: s.query, proxied: true,
        description: `${cr.description} Counts hosts and Kubernetes monitored by OneAgent and those reported through OpenTelemetry.` };
      if (s.queryB) { next.queryB = s.queryB; delete next.denominatorConstant; }
      return next;
    }),
  }));
  return { caps: out, info: { swappedIds, excludedIds: [] } };
}

/** In a mixed environment the action covers both sides: the OneAgent action, then the OpenTelemetry one. */
export function mixedActions(base: Record<string, { action: string; docUrl: string; docLabel: string }>): Record<string, { action: string; docUrl: string; docLabel: string }> {
  const out: Record<string, { action: string; docUrl: string; docLabel: string }> = {};
  for (const id of Object.keys(MIXED_SWAPS)) {
    const o = OTEL_SWAPS[id]?.action, b = base[id];
    if (o && b) out[id] = { ...b, action: `${b.action} For hosts reported through OpenTelemetry: ${o.charAt(0).toLowerCase()}${o.slice(1)}` };
  }
  return out;
}

export type { TelemetrySource } from "./telemetry";
