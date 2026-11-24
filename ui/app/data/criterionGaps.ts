// ui/app/data/criterionGaps.ts
//
// "Which ones?" — for a criterion that is not met, the DQL that lists what is
// missing (the hosts without the metric, the services without an owner, the
// problems without a root cause). Run on demand from the action card.
//
// Only sources with no query charge or included queries are used here
// (entities, metrics, Davis problems, system events). Span- and log-based
// criteria have no gap list: listing them unsampled would scan far more than
// the criterion itself.

import { windowHoursFor } from "../hooks/useCoverageData";
import { queryExecutionClient } from "@dynatrace-sdk/client-query";

export interface Gap { noun: string; query: string }

const LIST = ' | fields name | sort name | limit 50';

/** Entities of a type with no datapoint for a metric. */
const noMetric = (entity: string, metric: string) =>
  `fetch ${entity} | fields id, name = entity.name | lookup [timeseries v = ${metric}, by:{${entity}} | fields e = ${entity} | dedup e], sourceField:id, lookupField:e, prefix:"m." | filter isNull(m.e)${LIST}`;

/** Hosts with no child entity of a type (disk, network interface, process). */
const hostWithout = (child: string) =>
  `fetch dt.entity.host | fields id, name = entity.name | lookup [fetch ${child} | fieldsAdd h = belongs_to[dt.entity.host] | expand h | summarize n = count(), by:{h}], sourceField:id, lookupField:h, prefix:"m." | filter isNull(m.h)${LIST}`;

const STATIC: Record<string, Gap> = {
  i1: { noun: "hosts without CPU metrics", query: noMetric("dt.entity.host", "avg(dt.host.cpu.usage)") },
  i2: { noun: "hosts without memory metrics", query: noMetric("dt.entity.host", "avg(dt.host.memory.usage)") },
  i3: { noun: "hosts without disk metrics", query: noMetric("dt.entity.host", "avg(dt.host.disk.used.percent)") },
  i4: { noun: "hosts without availability data", query: noMetric("dt.entity.host", "sum(dt.host.availability)") },
  i5: { noun: "hosts without network interfaces", query: hostWithout("dt.entity.network_interface") },
  i27: { noun: "network devices without metrics", query: `smartscapeNodes "EXT_NETWORK_DEVICE" | fields sid = toString(id), name | lookup [timeseries v = avg(com.dynatrace.extension.network_device.cpu_usage), by:{dt.smartscape.ext_network_device} | fields e = toString(dt.smartscape.ext_network_device) | dedup e], sourceField:sid, lookupField:e, prefix:"m." | filter isNull(m.e)${LIST}` },
  i28: { noun: "network interfaces without status", query: `smartscapeNodes "EXT_NETWORK_INTERFACE" | fields sid = toString(id), name | lookup [timeseries v = avg(com.dynatrace.extension.network_device.if.status), by:{dt.smartscape.ext_network_interface} | fields e = toString(dt.smartscape.ext_network_interface) | dedup e], sourceField:sid, lookupField:e, prefix:"m." | filter isNull(m.e)${LIST}` },
  // Next release: the deployment criteria, listed as Fleet Management and Infrastructure & Operations list them.
  i29: { noun: "application hosts not in full-stack", query: `fetch dt.entity.process_group_instance | fieldsAdd tech = toString(softwareTechnologies) | filter (contains(tech, "type:JAVA,") or contains(tech, "type:DOTNET,") or contains(tech, "type:CLR,") or contains(tech, "type:NODE_JS,") or contains(tech, "type:PHP,")) and not(contains(tech, "type:MYSQL,") or contains(tech, "type:MARIADB,") or contains(tech, "type:POSTGRE_SQL,") or contains(tech, "type:DB2,") or contains(tech, "type:MICROSOFT_SQL_SERVER,") or contains(tech, "type:ORACLE_DATABASE,") or contains(tech, "type:MONGODB,") or contains(tech, "type:REDIS,") or contains(tech, "type:MEMCACHED,") or contains(tech, "type:ELASTIC_SEARCH,") or contains(tech, "type:CASSANDRA,") or contains(tech, "type:COUCHBASE,") or contains(tech, "type:SAP_HANA_DATABASE,") or contains(tech, "type:DYNATRACE,") or contains(tech, "type:OPENSEARCH,") or contains(tech, "type:SOLR,") or contains(tech, "type:ZOOKEEPER,") or contains(tech, "type:RABBIT_MQ,") or contains(tech, "type:ACTIVE_MQ,") or contains(tech, "type:IBM_MQ,") or contains(tech, "type:TIBCO_EMS,") or contains(tech, "type:HAPROXY,") or contains(tech, "type:NGINX,") or contains(tech, "type:ENVOY,") or contains(tech, "type:VARNISH,") or contains(tech, "type:SQUID,")) | fields h = belongs_to[dt.entity.host] | dedup h | lookup [fetch dt.entity.process_group_instance | fieldsAdd tech = toString(softwareTechnologies) | filter contains(tech, "type:MYSQL,") or contains(tech, "type:MARIADB,") or contains(tech, "type:POSTGRE_SQL,") or contains(tech, "type:DB2,") or contains(tech, "type:MICROSOFT_SQL_SERVER,") or contains(tech, "type:ORACLE_DATABASE,") or contains(tech, "type:MONGODB,") or contains(tech, "type:REDIS,") or contains(tech, "type:MEMCACHED,") or contains(tech, "type:ELASTIC_SEARCH,") or contains(tech, "type:CASSANDRA,") or contains(tech, "type:COUCHBASE,") or contains(tech, "type:SAP_HANA_DATABASE,") | fields h = belongs_to[dt.entity.host] | append [fetch dt.entity.host | filter standaloneSpecialAgentsOnly == true or in(osType, {"ZOS", "SOLARIS", "HPUX"}) | fields h = id] | dedup h], sourceField:h, lookupField:h, prefix:"x." | filter isNull(x.h) | lookup [fetch dt.entity.host | fields id, mode = monitoringMode], sourceField:h, lookupField:id, prefix:"host." | filter host.mode != "FULL_STACK" or isNull(host.mode) | lookup [fetch dt.entity.host | fields id, hn = entity.name], sourceField:h, lookupField:id, prefix:"n." | fields name = concat(n.hn, " · ", coalesce(host.mode, "no mode"))${LIST}` },
  i30: { noun: "processes waiting for a restart (outdated module)", query: `fetch events | filter dt.system.bucket == "default_fleet_events" and in(dt.agent.module.type, {"java", "dotnet", "nodejs", "php", "iis", "apache", "go"}) | dedup dt.agent.module.id, sort:{timestamp desc} | filter contains(toString(dt.agent.module.issues), "AGENT_OUTDATED") | fields name = concat(host.name, " · ", dt.agent.module.name)${LIST}` },
  i31: { noun: "hosts that stopped reporting", query: `smartscapeNodes "HOST", from:now()-7d | filter isNull(k8s.cluster.name) | filter lifetime[end] < now() - 30m${LIST}` },
  a18: { noun: "hosts with application processes not instrumented", query: `fetch dt.entity.process_group_instance | filter lifetime[end] >= now() - 1h | fieldsAdd tech = toString(softwareTechnologies) | filter (contains(tech, "type:JAVA,") or contains(tech, "type:DOTNET,") or contains(tech, "type:CLR,") or contains(tech, "type:NODE_JS,") or contains(tech, "type:PHP,")) and not(contains(tech, "type:MYSQL,") or contains(tech, "type:MARIADB,") or contains(tech, "type:POSTGRE_SQL,") or contains(tech, "type:DB2,") or contains(tech, "type:MICROSOFT_SQL_SERVER,") or contains(tech, "type:ORACLE_DATABASE,") or contains(tech, "type:MONGODB,") or contains(tech, "type:REDIS,") or contains(tech, "type:MEMCACHED,") or contains(tech, "type:ELASTIC_SEARCH,") or contains(tech, "type:CASSANDRA,") or contains(tech, "type:COUCHBASE,") or contains(tech, "type:SAP_HANA_DATABASE,") or contains(tech, "type:DYNATRACE,") or contains(tech, "type:OPENSEARCH,") or contains(tech, "type:SOLR,") or contains(tech, "type:ZOOKEEPER,") or contains(tech, "type:RABBIT_MQ,") or contains(tech, "type:ACTIVE_MQ,") or contains(tech, "type:IBM_MQ,") or contains(tech, "type:TIBCO_EMS,") or contains(tech, "type:HAPROXY,") or contains(tech, "type:NGINX,") or contains(tech, "type:ENVOY,") or contains(tech, "type:VARNISH,") or contains(tech, "type:SQUID,")) | fieldsAdd h = belongs_to[dt.entity.host], pid = replaceString(toString(id), "PROCESS_GROUP_INSTANCE-", "PROCESS-") | lookup [fetch dt.entity.process_group_instance | fieldsAdd tech = toString(softwareTechnologies) | filter contains(tech, "type:MYSQL,") or contains(tech, "type:MARIADB,") or contains(tech, "type:POSTGRE_SQL,") or contains(tech, "type:DB2,") or contains(tech, "type:MICROSOFT_SQL_SERVER,") or contains(tech, "type:ORACLE_DATABASE,") or contains(tech, "type:MONGODB,") or contains(tech, "type:REDIS,") or contains(tech, "type:MEMCACHED,") or contains(tech, "type:ELASTIC_SEARCH,") or contains(tech, "type:CASSANDRA,") or contains(tech, "type:COUCHBASE,") or contains(tech, "type:SAP_HANA_DATABASE,") | fields h = belongs_to[dt.entity.host] | append [fetch dt.entity.host | filter standaloneSpecialAgentsOnly == true or in(osType, {"ZOS", "SOLARIS", "HPUX"}) | fields h = id] | dedup h], sourceField:h, lookupField:h, prefix:"x." | filter isNull(x.h) | lookup [fetch events | filter dt.system.bucket == "default_fleet_events" and in(dt.agent.module.type, {"java", "dotnet", "nodejs", "php", "iis", "apache", "go"}) | summarize m = count(), by:{p = toString(dt.smartscape.process)}], sourceField:pid, lookupField:p, prefix:"mod." | filter isNull(mod.m) | summarize procs = count(), by:{h} | lookup [fetch dt.entity.host | fields id, hn = entity.name], sourceField:h, lookupField:id, prefix:"n." | sort procs desc | limit 50 | fields name = concat(n.hn, " · ", toString(procs))` },
  i6: { noun: "processes without CPU metrics", query: noMetric("dt.entity.process_group_instance", "avg(dt.process.cpu.usage)") },
  i8: { noun: "hosts without disks", query: hostWithout("dt.entity.disk") },
  i11: { noun: "hosts without processes", query: hostWithout("dt.entity.process_group_instance") },
  a5: { noun: "services without response time", query: noMetric("dt.entity.service", "avg(dt.service.request.response_time)") },
  a6: { noun: "services without failure data", query: noMetric("dt.entity.service", "sum(dt.service.request.failure_count)") },
  a7: { noun: "services without request data", query: noMetric("dt.entity.service", "sum(dt.service.request.count)") },
  a11: { noun: "services not linked to a process", query: `fetch dt.entity.service | fieldsAdd pgi = runs_on[dt.entity.process_group_instance] | filter isNull(pgi) or arraySize(pgi) == 0 | fields name = entity.name${LIST}` },
  a12: { noun: "services without tags", query: `fetch dt.entity.service | filter isNull(tags) or arraySize(tags) == 0 | fields name = entity.name${LIST}` },
  sd10: { noun: "services without an owner", query: `fetch dt.entity.service | filter not(contains(toString(tags), "owner")) and not(contains(toString(tags), "team")) | fields name = entity.name${LIST}` },
};

// Grouped by problem title, most frequent first: fifty lines of the same alert say less than "API gateway errors increase · 38".
const PROBLEM_LIST = ' | dedup event.id | summarize n = count(), by:{title = event.name} | sort n desc | limit 20 | fields name = concat(title, " · ", toString(n))';
const COUNT_TAIL = ' | summarize count = countDistinctExact(event.id)';
const NO_RCA = ' | filter isNull(root_cause_entity_id) and isNull(root_cause.smartscape_entity)';
const WF_LOOKUP = ' | lookup [fetch dt.system.events, from:now()-72h | filter event.kind == "WORKFLOW_EVENT" and event.type == "WORKFLOW_EXECUTION" | filter isNotNull(dt.automation_engine.workflow_execution.trigger.event.id) | summarize runs = count(), by:{tid = dt.automation_engine.workflow_execution.trigger.event.id}], sourceField:event.id, lookupField:tid, prefix:"wf." | filter isNull(wf.runs)';
const HEAD = 'fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate)';

const ROOT_CAUSE = new Set(["i23", "a14", "d12", "sd11", "ai15", "b9"]);
const AUTOMATION = new Set(["i24", "a15", "d13", "sd12", "ai16", "b10"]);

/** The gap list for a criterion, or null when it has none. `denominator` is the
 *  criterion's own denominator query — the problem lists reuse its scope. */
export function gapFor(id: string, denominator: string | undefined): Gap | null {
  if (STATIC[id]) return STATIC[id];
  if (!denominator || !denominator.startsWith(HEAD) || !denominator.endsWith(COUNT_TAIL)) return null;
  const scope = denominator.slice(HEAD.length, -COUNT_TAIL.length);
  if (ROOT_CAUSE.has(id)) return { noun: "problem types without a root cause", query: HEAD + NO_RCA + scope + PROBLEM_LIST };
  if (AUTOMATION.has(id)) return { noun: "problem types without an automated response", query: HEAD + WF_LOOKUP + scope + PROBLEM_LIST };
  return null;
}

/** Runs a gap query and returns the names (at most 50). */
export async function runGap(query: string): Promise<string[]> {
  // The list reads the same window as the criterion it explains (the host's window for inventory and metrics).
  const hours = windowHoursFor(query);
  const first = await queryExecutionClient.queryExecute({ body: { query, requestTimeoutMilliseconds: 30000, maxResultRecords: 50, defaultTimeframeStart: new Date(Date.now() - hours * 3600000).toISOString(), defaultTimeframeEnd: new Date().toISOString() } });
  let state = first?.state, result = first?.result;
  const token = (first as { requestToken?: string })?.requestToken;
  for (let i = 0; state === "RUNNING" && token && i < 10; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const poll = await queryExecutionClient.queryPoll({ requestToken: token });
    state = poll?.state; result = poll?.result;
  }
  if (state !== "SUCCEEDED" || !result) throw new Error("The list could not be loaded.");
  return (result.records ?? []).map(r => String((r as Record<string, unknown>)?.name ?? "")).filter(Boolean);
}
