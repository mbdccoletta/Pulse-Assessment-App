// ═══════════════════════════════════════════════════════════
// The criteria catalog
//
// A criterion is read in one of three ways:
//   query / queryB             a share: numerator over a denominator query
//   query / denominatorConstant a share of a known constant, or with the
//                              constant 1 a presence check (is there any?)
//   settings:count, slos:count a configuration count, read from the settings
//                              API or the SLO service (no Grail scan)
//
// OTel-inclusive: queries detect data from OneAgent, OpenTelemetry,
// and any other ingest source. No OneAgent-specific filters.
// ═══════════════════════════════════════════════════════════

export interface Threshold {
  min: number;
}

export interface Criterion {
  id: string;
  label: string;
  description: string;
  query: string;
  /** Denominator query — result = query / queryB × 100 (coverage %). Omit for queries that compute ratio internally. */
  queryB?: string;
  /** Hard-coded denominator when the expected value is a known constant
   *  (e.g., "5 expected log levels"). Use this INSTEAD of queryB whenever
   *  the denominator would be a query that just discards its result and
   *  returns a literal — those queries waste ~15 GB of Grail scan each
   *  (confirmed in the v2.5.0 perf report) for zero information gain.
   *  Mutually exclusive with queryB; useCoverageData honors queryB first. */
  denominatorConstant?: number;
  /** Set by applyTraceProxyMode (../trace-proxy.ts) when this criterion's
   *  span query was replaced with a metric/topology proxy. Surfaces as the
   *  "≈ proxy" chip on criteria rows and in the perf/PDF disclosures. */
  proxied?: boolean;
  thresholds: Threshold[];
}

export interface CapabilityDef {
  name: string;
  color: string;
  criteria: Criterion[];
}

export const CAPABILITIES: CapabilityDef[] = [
  // ─── 1. INFRASTRUCTURE OBSERVABILITY ───
  {
    name: "Infrastructure Observability",
    color: "#3B82F6",
    criteria: [
      {
        id: "i1", label: "Host CPU coverage (%)",
        description: "Percentage of monitored hosts with active CPU usage metrics from any source (OneAgent, OTel, cloud integration).",
        query: "timeseries val=avg(dt.host.cpu.usage), by:{dt.entity.host} | fields dt.entity.host | dedup dt.entity.host | summarize c=count()",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 90 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "i2", label: "Host memory coverage (%)",
        description: "Percentage of monitored hosts with active memory usage metrics.",
        query: "timeseries val=avg(dt.host.memory.usage), by:{dt.entity.host} | fields dt.entity.host | dedup dt.entity.host | summarize c=count()",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 90 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "i3", label: "Host disk coverage (%)",
        description: "Percentage of monitored hosts with active disk utilization metrics.",
        query: "timeseries val=avg(dt.host.disk.used.percent), by:{dt.entity.host} | fields dt.entity.host | dedup dt.entity.host | summarize c=count()",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "i4", label: "Host availability coverage (%)",
        description: "Percentage of monitored hosts with availability metrics — basis for SLA reporting.",
        query: "timeseries val=sum(dt.host.availability), by:{dt.entity.host} | fields dt.entity.host | dedup dt.entity.host | summarize c=count()",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 90 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "i5", label: "Host network coverage (%)",
        description: "Percentage of monitored hosts with network interface entities.",
        query: "fetch dt.entity.network_interface | fieldsAdd belongs_to = belongs_to[dt.entity.host] | expand belongs_to | summarize count = countDistinct(belongs_to)",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "i6", label: "Process CPU coverage (%)",
        description: "Percentage of process groups with active CPU usage metrics.",
        query: "timeseries val=avg(dt.process.cpu.usage), by:{dt.entity.process_group_instance} | fields dt.entity.process_group_instance | dedup dt.entity.process_group_instance | summarize c=count()",
        queryB: "fetch dt.entity.process_group_instance | summarize count()",
        thresholds: [{ min: 70 }, { min: 30 }, { min: 1 }],
      },
      {
        id: "i7", label: "K8s cluster coverage (%)",
        description: "Percentage of Kubernetes clusters with active workload monitoring.",
        query: "timeseries val=avg(dt.kubernetes.container.cpu_usage), by:{k8s.cluster.name} | fields k8s.cluster.name | dedup k8s.cluster.name | summarize c=count()",
        queryB: "fetch dt.entity.kubernetes_cluster | summarize count()",
        thresholds: [{ min: 90 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "i8", label: "Host disk entity coverage (%)",
        description: "Percentage of hosts with disk entities detected.",
        query: "fetch dt.entity.disk | fieldsAdd belongs_to = belongs_to[dt.entity.host] | expand belongs_to | summarize count = countDistinct(belongs_to)",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "i9", label: "Davis problem coverage (%)",
        description: "Percentage of hosts covered by Davis AI problem detection.",
        query: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | fieldsAdd affected = affected_entity_ids | expand affected | filter startsWith(affected, \"HOST-\") | summarize count = countDistinct(affected)",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 10 }, { min: 1 }],
      },
      {
        id: "i10", label: "Cloud workload coverage (%)",
        description: "Percentage of K8s namespaces with running cloud-native workloads.",
        query: "fetch dt.entity.cloud_application | fieldsAdd ns = belongs_to[dt.entity.cloud_application_namespace] | expand ns | summarize count = countDistinct(ns)",
        queryB: "fetch dt.entity.cloud_application_namespace | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "i11", label: "Host-process topology (%)",
        description: "Percentage of hosts with detected, monitored processes — validates host-to-process topology discovery.",
        // Read from the process metric's host dimension: free and fast. Expanding every
        // process group instance timed out on a 180,000-instance estate and left the check unassessed.
        query: "timeseries v = avg(dt.process.cpu.usage), by:{dt.entity.host} | summarize count = countDistinct(dt.entity.host)",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 90 }, { min: 60 }, { min: 1 }],
      },
      {
        id: "i12", label: "K8s workload mapping (%)",
        description: "Percentage of Kubernetes clusters with at least one detected cloud application namespace — validates workload topology.",
        query: "fetch dt.entity.cloud_application_namespace | fieldsAdd c = clustered_by[dt.entity.kubernetes_cluster] | expand c | filter isNotNull(c) | summarize count = countDistinct(c)",
        queryB: "fetch dt.entity.kubernetes_cluster | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      // ── Cloud Platform Monitoring ──
      {
        id: "i13", label: "Cloud host log enrichment (%)",
        description: "Percentage of hosts with cloud provider context in log data — validates cloud integration feeding host-level metadata.",
        query: "fetch logs | filter timestamp > now() - 2h | filter isNotNull(cloud.provider) | summarize count = countDistinct(dt.entity.host) | fields count",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "i14", label: "Cloud log enrichment (%)",
        description: "Percentage of log records enriched with cloud provider metadata.",
        query: "fieldsSnapshot logs | filter field == \"cloud.provider\" | fields relative_count",
        denominatorConstant: 100,
        thresholds: [{ min: 50 }, { min: 20 }, { min: 1 }],
      },
      {
        id: "i15", label: "Cloud region enrichment (%)",
        description: "Percentage of cloud-enriched logs that also contain region metadata — validates multi-region observability depth.",
        query: "fieldsSnapshot logs | filter field == \"cloud.region\" | fields relative_count",
        queryB: "fieldsSnapshot logs | filter field == \"cloud.provider\" | fields relative_count",
        thresholds: [{ min: 80 }, { min: 40 }, { min: 1 }],
      },
      {
        id: "i16", label: "Cloud AZ enrichment (%)",
        description: "Percentage of cloud-enriched logs with availability zone metadata — validates resilience observability across failure domains.",
        query: "fieldsSnapshot logs | filter field == \"cloud.availability_zone\" | fields relative_count",
        queryB: "fieldsSnapshot logs | filter field == \"cloud.provider\" | fields relative_count",
        thresholds: [{ min: 80 }, { min: 40 }, { min: 1 }],
      },
      {
        id: "i17", label: "Cloud account enrichment (%)",
        description: "Percentage of cloud-enriched logs with account ID metadata — validates multi-account cloud governance.",
        query: "fieldsSnapshot logs | filter field == \"cloud.account.id\" | fields relative_count",
        queryB: "fieldsSnapshot logs | filter field == \"cloud.provider\" | fields relative_count",
        thresholds: [{ min: 80 }, { min: 40 }, { min: 1 }],
      },
      {
        id: "i18", label: "Cloud span enrichment (%)",
        description: "Percentage of services with cloud provider context in span data.",
        query: "fetch spans, from:now()-2h | filter isNotNull(cloud.provider) | summarize count = countDistinct(coalesce(dt.entity.service, service.name)) | fields count",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 50 }, { min: 20 }, { min: 1 }],
      },
      {
        id: "i19", label: "K8s node monitoring depth (%)",
        description: "Share of Kubernetes nodes that report container resource metrics — validates node-level compute monitoring.",
        query: "timeseries val=avg(dt.kubernetes.container.cpu_usage), by:{k8s.node.name} | fields k8s.node.name | dedup k8s.node.name | summarize c=count()",
        // Nodes over nodes. It divided nodes by clusters, which passed every cluster with two nodes or more.
        queryB: "fetch dt.entity.kubernetes_node | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "i20", label: "Cloud namespace metric coverage (%)",
        description: "Percentage of K8s namespaces with active container metrics — validates cloud workload observability.",
        query: "timeseries val=avg(dt.kubernetes.container.cpu_usage), by:{k8s.namespace.name} | fields k8s.namespace.name | dedup k8s.namespace.name | summarize c=count()",
        queryB: "fetch dt.entity.cloud_application_namespace | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      // ── Container Health ──
      {
        id: "i21", label: "Container restart monitoring (%)",
        description: "Percentage of K8s namespaces with container restart tracking — critical for detecting CrashLoopBackOff and OOM issues.",
        query: "timeseries val=max(dt.kubernetes.container.restarts), by:{k8s.namespace.name} | fields k8s.namespace.name | dedup k8s.namespace.name | summarize c=count()",
        queryB: "fetch dt.entity.cloud_application_namespace | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "i22", label: "Container resource limits (%)",
        description: "Percentage of K8s namespaces with defined resource limits — essential for cluster stability and resource governance.",
        query: "timeseries val=avg(dt.kubernetes.container.limits_cpu), by:{k8s.namespace.name} | fields k8s.namespace.name | dedup k8s.namespace.name | summarize c=count()",
        queryB: "fetch dt.entity.cloud_application_namespace | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "i23", label: "Problems with root cause (%)",
        description: "Share of Davis problems on infrastructure entities (hosts, processes, Kubernetes, cloud, custom devices) in the last 72h where Davis identified a root-cause entity.",
        query: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | filter isNotNull(root_cause_entity_id) or isNotNull(root_cause.smartscape_entity) | expand t = affected_entity_types | filter in(t, array(\"dt.entity.host\", \"dt.entity.process_group_instance\", \"dt.entity.process_group\", \"dt.entity.custom_device\", \"dt.entity.custom_device_group\", \"dt.entity.cloud_application\", \"dt.entity.cloud_application_namespace\", \"dt.entity.cloud_application_instance\", \"dt.entity.kubernetes_cluster\", \"dt.entity.kubernetes_node\", \"dt.entity.kubernetes_service\", \"dt.entity.hypervisor\", \"dt.entity.virtualmachine\", \"dt.entity.disk\", \"dt.entity.network_interface\")) | summarize count = countDistinctExact(event.id)",
        queryB: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | expand t = affected_entity_types | filter in(t, array(\"dt.entity.host\", \"dt.entity.process_group_instance\", \"dt.entity.process_group\", \"dt.entity.custom_device\", \"dt.entity.custom_device_group\", \"dt.entity.cloud_application\", \"dt.entity.cloud_application_namespace\", \"dt.entity.cloud_application_instance\", \"dt.entity.kubernetes_cluster\", \"dt.entity.kubernetes_node\", \"dt.entity.kubernetes_service\", \"dt.entity.hypervisor\", \"dt.entity.virtualmachine\", \"dt.entity.disk\", \"dt.entity.network_interface\")) | summarize count = countDistinctExact(event.id)",
        thresholds: [{ min: 50 }],
      },
      {
        id: "i24", label: "Problems with automated response (%)",
        description: "Share of Davis problems on infrastructure entities (hosts, processes, Kubernetes, cloud, custom devices) in the last 72h that triggered at least one workflow execution.",
        query: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | lookup [fetch dt.system.events, from:now()-72h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"WORKFLOW_EXECUTION\" | filter isNotNull(dt.automation_engine.workflow_execution.trigger.event.id) | summarize runs = count(), by:{tid = dt.automation_engine.workflow_execution.trigger.event.id}], sourceField:event.id, lookupField:tid, prefix:\"wf.\" | filter isNotNull(wf.runs) | expand t = affected_entity_types | filter in(t, array(\"dt.entity.host\", \"dt.entity.process_group_instance\", \"dt.entity.process_group\", \"dt.entity.custom_device\", \"dt.entity.custom_device_group\", \"dt.entity.cloud_application\", \"dt.entity.cloud_application_namespace\", \"dt.entity.cloud_application_instance\", \"dt.entity.kubernetes_cluster\", \"dt.entity.kubernetes_node\", \"dt.entity.kubernetes_service\", \"dt.entity.hypervisor\", \"dt.entity.virtualmachine\", \"dt.entity.disk\", \"dt.entity.network_interface\")) | summarize count = countDistinctExact(event.id)",
        queryB: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | expand t = affected_entity_types | filter in(t, array(\"dt.entity.host\", \"dt.entity.process_group_instance\", \"dt.entity.process_group\", \"dt.entity.custom_device\", \"dt.entity.custom_device_group\", \"dt.entity.cloud_application\", \"dt.entity.cloud_application_namespace\", \"dt.entity.cloud_application_instance\", \"dt.entity.kubernetes_cluster\", \"dt.entity.kubernetes_node\", \"dt.entity.kubernetes_service\", \"dt.entity.hypervisor\", \"dt.entity.virtualmachine\", \"dt.entity.disk\", \"dt.entity.network_interface\")) | summarize count = countDistinctExact(event.id)",
        thresholds: [{ min: 30 }],
      },
      {
        id: "i25", label: "Infrastructure automation workflows",
        description: "Workflows that ran a cloud, Kubernetes or configuration-management action (AWS, Azure, GCP, Kubernetes, Ansible connectors) in the last 24h.",
        query: "fetch dt.system.events, from:now()-24h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"ACTION_EXECUTION\" | fieldsAdd app = lower(dt.automation_engine.action.app) | filter contains(app, \"aws\") or contains(app, \"azure\") or contains(app, \"gcp\") or contains(app, \"kubernetes\") or contains(app, \"ansible\") | summarize count = countDistinct(dt.automation_engine.workflow.id)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "i26", label: "Assist, MCP and dtctl usage",
        description: "People who read metrics and topology through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days.",
        query: "fetch dt.system.events, from:now()-30d | filter event.kind == \"QUERY_EXECUTION_EVENT\" | filter isNotNull(user.email) and not(contains(user.email, \"heimdall.dynatrace.com\")) | filter client.application_context == \"dynatrace.davis.copilot\" or contains(lower(toString(client.client_context)), \"dtctl\") or contains(lower(toString(client.client_context)), \"mcp\") or contains(lower(toString(client.source)), \"mcp\") | filter in(table, \"metrics\", \"smartscape.nodes\", \"smartscape.edges\") | summarize count = countDistinct(user.email)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
    ],
  },

  // ─── 2. APPLICATION OBSERVABILITY ───
  {
    name: "Application Observability",
    color: "#8B5CF6",
    criteria: [
      {
        id: "a1", label: "Service tracing coverage (%)",
        description: "Percentage of detected services with active span data in the last 2h (OneAgent or OTel).",
        query: "fetch spans, from:now()-2h | summarize count = countDistinct(coalesce(dt.entity.service, service.name)) | fields count",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "a2", label: "Service method coverage (%)",
        description: "Percentage of services with method-level tracing.",
        query: "fetch dt.entity.service_method | summarize count()",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 60 }, { min: 30 }, { min: 1 }],
      },
      {
        id: "a3", label: "Root span coverage (%)",
        description: "Percentage of services with root spans (incoming requests) in the last 2h.",
        query: "fetch spans, from:now()-2h | filter request.is_root_span == true | summarize count = countDistinct(coalesce(dt.entity.service, service.name)) | fields count",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 70 }, { min: 40 }, { min: 1 }],
      },
      {
        id: "a4", label: "OTel instrumentation coverage (%)",
        description: "Percentage of services with OpenTelemetry spans — vendor-neutral instrumentation adoption.",
        query: "fetch spans, from:now()-2h | filter isNotNull(otel.scope.name) or isNotNull(telemetry.sdk.name) or isNotNull(telemetry.sdk.language) | summarize count = countDistinct(coalesce(dt.entity.service, service.name)) | fields count",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 50 }, { min: 20 }, { min: 1 }],
      },
      {
        id: "a5", label: "Response time coverage (%)",
        description: "Percentage of services with response time metrics (p95).",
        query: "timeseries val=percentile(dt.service.request.response_time, 95), by:{dt.entity.service} | fields dt.entity.service | dedup dt.entity.service | summarize c=count()",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "a6", label: "Failure tracking coverage (%)",
        description: "Percentage of services with failure rate metrics.",
        query: "timeseries val=sum(dt.service.request.failure_count), by:{dt.entity.service} | fields dt.entity.service | dedup dt.entity.service | summarize c=count()",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 70 }, { min: 40 }, { min: 1 }],
      },
      {
        id: "a7", label: "Throughput coverage (%)",
        description: "Percentage of services with request count/throughput metrics.",
        query: "timeseries val=sum(dt.service.request.count), by:{dt.entity.service} | fields dt.entity.service | dedup dt.entity.service | summarize c=count()",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "a8", label: "Database span coverage (%)",
        description: "Percentage of services with database operation spans.",
        query: "fetch spans, from:now()-2h | filter isNotNull(db.system) | summarize count = countDistinct(coalesce(dt.entity.service, service.name)) | fields count",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "a9", label: "Messaging span coverage (%)",
        description: "Percentage of services with messaging spans (Kafka, RabbitMQ, SQS).",
        query: "fetch spans, from:now()-2h | filter isNotNull(messaging.system) | summarize count = countDistinct(coalesce(dt.entity.service, service.name)) | fields count",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 20 }, { min: 5 }, { min: 1 }],
      },
      {
        id: "a10", label: "Multi-service trace depth (%)",
        description: "Percentage of traces spanning 2+ services — validates distributed tracing depth.",
        query: "fetch spans, from:now()-2h | summarize services = countDistinct(dt.service.name), by: {trace.id} | filter services > 1 | summarize count()",
        queryB: "fetch spans, from:now()-2h | summarize countDistinct(trace.id)",
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "a11", label: "Service-process mapping (%)",
        description: "Percentage of services with associated process groups — validates service-to-infrastructure topology.",
        query: "fetch dt.entity.service | fieldsAdd pgi = runs_on[dt.entity.process_group_instance] | expand pgi | filter isNotNull(pgi) | summarize count = countDistinct(id)",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "a13", label: "Database call depth (%)",
        description: "Percentage of DB-using services that interact with 2+ database systems — validates deep database monitoring across the stack.",
        query: "fetch spans, from:now()-2h | filter isNotNull(db.system) | fieldsAdd _svc = coalesce(dt.entity.service, service.name) | summarize systems = countDistinct(db.system), by:{_svc} | filter systems >= 2 | summarize count()",
        queryB: "fetch spans, from:now()-2h | filter isNotNull(db.system) | summarize count = countDistinct(coalesce(dt.entity.service, service.name))",
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "a14", label: "Problems with root cause (%)",
        description: "Share of Davis problems on services and queues in the last 72h where Davis identified a root-cause entity.",
        query: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | filter isNotNull(root_cause_entity_id) or isNotNull(root_cause.smartscape_entity) | expand t = affected_entity_types | filter in(t, array(\"dt.entity.service\", \"dt.entity.service_method\", \"dt.entity.queue\")) | summarize count = countDistinctExact(event.id)",
        queryB: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | expand t = affected_entity_types | filter in(t, array(\"dt.entity.service\", \"dt.entity.service_method\", \"dt.entity.queue\")) | summarize count = countDistinctExact(event.id)",
        thresholds: [{ min: 50 }],
      },
      {
        id: "a15", label: "Problems with automated response (%)",
        description: "Share of Davis problems on services and queues in the last 72h that triggered at least one workflow execution.",
        query: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | lookup [fetch dt.system.events, from:now()-72h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"WORKFLOW_EXECUTION\" | filter isNotNull(dt.automation_engine.workflow_execution.trigger.event.id) | summarize runs = count(), by:{tid = dt.automation_engine.workflow_execution.trigger.event.id}], sourceField:event.id, lookupField:tid, prefix:\"wf.\" | filter isNotNull(wf.runs) | expand t = affected_entity_types | filter in(t, array(\"dt.entity.service\", \"dt.entity.service_method\", \"dt.entity.queue\")) | summarize count = countDistinctExact(event.id)",
        queryB: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | expand t = affected_entity_types | filter in(t, array(\"dt.entity.service\", \"dt.entity.service_method\", \"dt.entity.queue\")) | summarize count = countDistinctExact(event.id)",
        thresholds: [{ min: 30 }],
      },
      {
        id: "a16", label: "Assist, MCP and dtctl usage",
        description: "People who read traces through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days.",
        query: "fetch dt.system.events, from:now()-30d | filter event.kind == \"QUERY_EXECUTION_EVENT\" | filter isNotNull(user.email) and not(contains(user.email, \"heimdall.dynatrace.com\")) | filter client.application_context == \"dynatrace.davis.copilot\" or contains(lower(toString(client.client_context)), \"dtctl\") or contains(lower(toString(client.client_context)), \"mcp\") or contains(lower(toString(client.source)), \"mcp\") | filter in(table, \"spans\") | summarize count = countDistinct(user.email)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
    ],
  },

  // ─── 3. DIGITAL EXPERIENCE ───
  {
    name: "Digital Experience",
    color: "#EC4899",
    criteria: [
      {
        id: "d1", label: "RUM action coverage (%)",
        description: "Percentage of web applications with active user action metrics.",
        query: "timeseries val=sum(dt.frontend.user_action.count), by:{dt.entity.application} | fields dt.entity.application | dedup dt.entity.application | summarize c=count()",
        queryB: "fetch dt.entity.application | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "d2", label: "Session tracking coverage (%)",
        description: "Percentage of web applications with active session tracking.",
        query: "timeseries val=avg(dt.frontend.session.active.estimated_count), by:{dt.entity.application} | fields dt.entity.application | dedup dt.entity.application | summarize c=count()",
        queryB: "fetch dt.entity.application | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "d3", label: "LCP coverage (%)",
        description: "Percentage of web applications with Largest Contentful Paint metrics — Core Web Vital.",
        query: "timeseries val=avg(dt.frontend.web.page.largest_contentful_paint), by:{dt.entity.application} | fields dt.entity.application | dedup dt.entity.application | summarize c=count()",
        queryB: "fetch dt.entity.application | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "d4", label: "INP coverage (%)",
        description: "Percentage of web applications with Interaction to Next Paint metrics — Core Web Vital.",
        query: "timeseries val=avg(dt.frontend.web.page.interaction_to_next_paint), by:{dt.entity.application} | fields dt.entity.application | dedup dt.entity.application | summarize c=count()",
        queryB: "fetch dt.entity.application | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "d5", label: "CLS coverage (%)",
        description: "Percentage of web applications with Cumulative Layout Shift metrics — Core Web Vital.",
        query: "timeseries val=avg(dt.frontend.web.page.cumulative_layout_shift), by:{dt.entity.application} | fields dt.entity.application | dedup dt.entity.application | summarize c=count()",
        queryB: "fetch dt.entity.application | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "d6", label: "Frontend error coverage (%)",
        description: "Percentage of web applications with error tracking enabled.",
        query: "timeseries val=sum(dt.frontend.error.count), by:{dt.entity.application} | fields dt.entity.application | dedup dt.entity.application | summarize c=count()",
        queryB: "fetch dt.entity.application | summarize count()",
        thresholds: [{ min: 70 }, { min: 40 }, { min: 1 }],
      },
      {
        id: "d7", label: "Synthetic HTTP coverage (%)",
        description: "Percentage of web applications covered by HTTP synthetic monitors.",
        query: "fetch dt.entity.http_check | summarize count()",
        queryB: "fetch dt.entity.application | summarize count()",
        thresholds: [{ min: 100 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "d8", label: "Synthetic browser coverage (%)",
        description: "Percentage of web applications covered by browser-based synthetic tests.",
        query: "fetch dt.entity.synthetic_test | summarize count()",
        queryB: "fetch dt.entity.application | summarize count()",
        thresholds: [{ min: 100 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "d9", label: "Mobile app coverage (%)",
        description: "Percentage of total applications that have mobile monitoring.",
        query: "fetch dt.entity.mobile_application | summarize count()",
        queryB: "fetch dt.entity.application | fieldsAdd type = \"web\" | append [fetch dt.entity.mobile_application | fieldsAdd type = \"mob\"] | summarize count()",
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "d10", label: "Synthetic location diversity (%)",
        description: "Ratio of synthetic locations to total synthetic monitors.",
        query: "fetch dt.entity.synthetic_location | summarize count()",
        queryB: "fetch dt.entity.http_check | fieldsAdd type = \"http\" | append [fetch dt.entity.synthetic_test | fieldsAdd type = \"browser\"] | summarize count()",
        thresholds: [{ min: 100 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "d11", label: "Synthetic availability coverage (%)",
        description: "Ratio of synthetic monitors to web applications — validates proactive availability monitoring.",
        query: "fetch dt.entity.http_check | fieldsAdd type = \"http\" | append [fetch dt.entity.synthetic_test | fieldsAdd type = \"browser\"] | summarize count()",
        queryB: "fetch dt.entity.application | summarize count()",
        thresholds: [{ min: 100 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "d12", label: "Problems with root cause (%)",
        description: "Share of Davis problems on web and mobile applications and synthetic monitors in the last 72h where Davis identified a root-cause entity.",
        query: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | filter isNotNull(root_cause_entity_id) or isNotNull(root_cause.smartscape_entity) | expand t = affected_entity_types | filter in(t, array(\"dt.entity.application\", \"dt.entity.mobile_application\", \"dt.entity.custom_application\", \"dt.entity.synthetic_test\", \"dt.entity.http_check\", \"dt.entity.multiprotocol_monitor\")) | summarize count = countDistinctExact(event.id)",
        queryB: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | expand t = affected_entity_types | filter in(t, array(\"dt.entity.application\", \"dt.entity.mobile_application\", \"dt.entity.custom_application\", \"dt.entity.synthetic_test\", \"dt.entity.http_check\", \"dt.entity.multiprotocol_monitor\")) | summarize count = countDistinctExact(event.id)",
        thresholds: [{ min: 50 }],
      },
      {
        id: "d13", label: "Problems with automated response (%)",
        description: "Share of Davis problems on web and mobile applications and synthetic monitors in the last 72h that triggered at least one workflow execution.",
        query: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | lookup [fetch dt.system.events, from:now()-72h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"WORKFLOW_EXECUTION\" | filter isNotNull(dt.automation_engine.workflow_execution.trigger.event.id) | summarize runs = count(), by:{tid = dt.automation_engine.workflow_execution.trigger.event.id}], sourceField:event.id, lookupField:tid, prefix:\"wf.\" | filter isNotNull(wf.runs) | expand t = affected_entity_types | filter in(t, array(\"dt.entity.application\", \"dt.entity.mobile_application\", \"dt.entity.custom_application\", \"dt.entity.synthetic_test\", \"dt.entity.http_check\", \"dt.entity.multiprotocol_monitor\")) | summarize count = countDistinctExact(event.id)",
        queryB: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | expand t = affected_entity_types | filter in(t, array(\"dt.entity.application\", \"dt.entity.mobile_application\", \"dt.entity.custom_application\", \"dt.entity.synthetic_test\", \"dt.entity.http_check\", \"dt.entity.multiprotocol_monitor\")) | summarize count = countDistinctExact(event.id)",
        thresholds: [{ min: 30 }],
      },
      {
        id: "d14", label: "Synthetic checks run by workflows",
        description: "Workflows that ran an on-demand synthetic execution in the last 24h.",
        query: "fetch dt.system.events, from:now()-24h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"ACTION_EXECUTION\" | fieldsAdd app = lower(dt.automation_engine.action.app) | filter contains(app, \"synthetic\") | summarize count = countDistinct(dt.automation_engine.workflow.id)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "d15", label: "Assist, MCP and dtctl usage",
        description: "People who read user sessions and events through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days.",
        query: "fetch dt.system.events, from:now()-30d | filter event.kind == \"QUERY_EXECUTION_EVENT\" | filter isNotNull(user.email) and not(contains(user.email, \"heimdall.dynatrace.com\")) | filter client.application_context == \"dynatrace.davis.copilot\" or contains(lower(toString(client.client_context)), \"dtctl\") or contains(lower(toString(client.client_context)), \"mcp\") or contains(lower(toString(client.source)), \"mcp\") | filter in(table, \"user.events\", \"user.sessions\", \"user.replays\") | summarize count = countDistinct(user.email)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
    ],
  },

  // ─── 4. LOG ANALYTICS ───
  {
    name: "Log Analytics",
    color: "#F59E0B",
    criteria: [
      {
        id: "l1", label: "Host log coverage (%)",
        description: "Percentage of hosts sending log data in the last 2h.",
        query: "fetch logs | filter timestamp > now() - 2h | filter isNotNull(dt.entity.host) | summarize count = countDistinct(dt.entity.host) | fields count",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "l2", label: "Service log coverage (%)",
        description: "Percentage of services with associated log data.",
        query: "fetch logs | filter timestamp > now() - 2h | filter isNotNull(dt.entity.service) | summarize count = countDistinct(dt.entity.service) | fields count",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 60 }, { min: 30 }, { min: 1 }],
      },
      {
        id: "l3", label: "Trace-correlated logs (%)",
        description: "Percentage of log records enriched with trace_id.",
        query: "fieldsSnapshot logs | filter field == \"trace_id\" | fields relative_count",
        denominatorConstant: 100,
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "l4", label: "Entity-enriched logs (%)",
        description: "Percentage of log records enriched with host entity context.",
        query: "fieldsSnapshot logs | filter field == \"dt.entity.host\" | fields relative_count",
        denominatorConstant: 100,
        thresholds: [{ min: 70 }, { min: 30 }, { min: 1 }],
      },
      {
        id: "l5", label: "Process group log correlation (%)",
        description: "Percentage of log records enriched with process group context.",
        query: "fieldsSnapshot logs | filter field == \"dt.process_group.id\" | fields relative_count",
        denominatorConstant: 100,
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "l6", label: "Log source diversity (%)",
        description: "Ratio of distinct log sources to total hosts — validates breadth of log ingestion across infrastructure.",
        query: "fetch logs | filter timestamp > now() - 2h | summarize countDistinct(log.source)",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 100 }, { min: 50 }, { min: 10 }],
      },
      {
        id: "l7", label: "Error log coverage (%)",
        description: "Percentage of services whose logs include ERROR-level entries.",
        query: 'fetch logs | filter timestamp > now() - 2h | filter loglevel == "ERROR" | filter isNotNull(dt.entity.service) | summarize count = countDistinct(dt.entity.service) | fields count',
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "l8", label: "K8s log coverage (%)",
        description: "Percentage of K8s namespaces with log data.",
        query: "fetch logs | filter timestamp > now() - 2h | filter isNotNull(k8s.namespace.name) | summarize countDistinct(k8s.namespace.name)",
        queryB: "fetch dt.entity.cloud_application_namespace | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "l9", label: "Log severity diversity (%)",
        description: "Percentage of severity levels being ingested (out of 5: ERROR, WARN, INFO, DEBUG, TRACE).",
        query: "fetch logs | filter timestamp > now() - 2h | summarize countDistinct(loglevel)",
        // denominator was previously a query that scanned ~15 GB of logs just
        // to discard the count and return the literal 5. See Task #51 / v2.5.1
        // perf-waste audit. Now expressed as a code constant.
        denominatorConstant: 5,
        thresholds: [{ min: 60 }, { min: 40 }],
      },
      {
        id: "l12", label: "Structured logging (%)",
        description: "Percentage of logs containing structured JSON content for better parsing and analysis.",
        query: 'fetch logs | filter timestamp > now() - 2h | filter matchesPhrase(content, "{\\\"") | summarize count()',
        queryB: "fetch logs | filter timestamp > now() - 2h | summarize count()",
        thresholds: [{ min: 50 }, { min: 20 }, { min: 1 }],
      },
      {
        id: "l13", label: "Span-correlated logs (%)",
        description: "Percentage of logs enriched with span_id for granular trace-to-log linking (deeper than trace_id alone).",
        query: "fieldsSnapshot logs | filter field == \"span_id\" | fields relative_count",
        denominatorConstant: 100,
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "l14", label: "Multi-source host logging (%)",
        description: "Percentage of hosts receiving logs from 2+ distinct sources — indicates balanced log distribution.",
        query: "fetch logs | filter timestamp > now() - 2h | filter isNotNull(dt.entity.host) | summarize sources = countDistinct(log.source), by:{dt.entity.host} | filter sources >= 2 | summarize count()",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 50 }, { min: 20 }, { min: 1 }],
      },
      {
        id: "l15", label: "Log-based events",
        description: "Presence of events generated from log data — indicates established log-based alerting.",
        query: 'fetch events | filter timestamp > now() - 24h | filter event.kind == "LOG" | summarize count()',
        denominatorConstant: 1,
        thresholds: [{ min: 100 }, { min: 50 }],
      },
      {
        id: "l16", label: "Custom device log enrichment (%)",
        description: "Percentage of logs enriched with custom device entities for extended context.",
        query: "fieldsSnapshot logs | filter field == \"dt.entity.custom_device\" | fields relative_count",
        denominatorConstant: 100,
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "l17", label: "Assist, MCP and dtctl usage",
        description: "People who read logs through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days.",
        query: "fetch dt.system.events, from:now()-30d | filter event.kind == \"QUERY_EXECUTION_EVENT\" | filter isNotNull(user.email) and not(contains(user.email, \"heimdall.dynatrace.com\")) | filter client.application_context == \"dynatrace.davis.copilot\" or contains(lower(toString(client.client_context)), \"dtctl\") or contains(lower(toString(client.client_context)), \"mcp\") or contains(lower(toString(client.source)), \"mcp\") | filter in(table, \"logs\") | summarize count = countDistinct(user.email)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "l18", label: "Custom log pipelines configured",
        description: "Log pipelines the team configured in OpenPipeline to filter, mask, enrich or route logs before they are stored. Read from settings, which scans no data.",
        query: "settings:count builtin:openpipeline.logs.pipelines",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
    ],
  },

  // ─── 5. APPLICATION SECURITY ───
  {
    name: "Application Security",
    color: "#EF4444",
    criteria: [
      {
        id: "s13", label: "Runtime Vulnerability Analytics active",
        description: "Vulnerability state reports from Runtime Vulnerability Analytics in the last 2 hours.",
        query: 'fetch security.events, from:now()-2h | filter event.type == "VULNERABILITY_STATE_REPORT_EVENT" and event.provider == "Dynatrace" | summarize count()',
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "s1", label: "Runtime vulnerability coverage (%)",
        description: "Share of process groups assessed by Runtime Vulnerability Analytics in the last 2 hours.",
        query: 'fetch security.events, from:now()-2h | filter event.type == "VULNERABILITY_STATE_REPORT_EVENT" and event.provider == "Dynatrace" | summarize count = countDistinct(dt.entity.process_group)',
        queryB: "fetch dt.entity.process_group | summarize count()",
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "s2", label: "Third-party security findings",
        description: "External security tools (scanners, registries, cloud security) sending vulnerability findings to Dynatrace in the last 24 hours.",
        query: 'fetch security.events, from:now()-24h | filter event.type == "VULNERABILITY_FINDING" | filter event.provider != "Dynatrace" and event.provider != "OneAgent" | summarize count = countDistinct(event.provider)',
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "s11", label: "Runtime Application Protection",
        description: "Attack detections from Runtime Application Protection in the last 24 hours.",
        query: 'fetch security.events, from:now()-24h | filter event.type == "DETECTION_FINDING" and product.name == "Runtime Application Protection" | summarize count()',
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "s12", label: "Security Posture Management",
        description: "Compliance findings from Security Posture Management in the last 2 hours.",
        query: 'fetch security.events, from:now()-2h | filter event.type == "COMPLIANCE_FINDING" and product.name == "Security Posture Management" | summarize count()',
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "s14", label: "Assist, MCP and dtctl usage",
        description: "People who read security findings through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days.",
        query: "fetch dt.system.events, from:now()-30d | filter event.kind == \"QUERY_EXECUTION_EVENT\" | filter isNotNull(user.email) and not(contains(user.email, \"heimdall.dynatrace.com\")) | filter client.application_context == \"dynatrace.davis.copilot\" or contains(lower(toString(client.client_context)), \"dtctl\") or contains(lower(toString(client.client_context)), \"mcp\") or contains(lower(toString(client.source)), \"mcp\") | filter in(table, \"security.events\") | summarize count = countDistinct(user.email)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "s16", label: "Vulnerabilities with Davis assessment (%)",
        description: "Share of open critical and high vulnerabilities for which Davis assessed whether data assets are reachable, in the last 2 hours. With that context a vulnerability is prioritized by real risk, not by severity alone.",
        query: "fetch security.events, from:now()-2h | filter event.type == \"VULNERABILITY_STATE_REPORT_EVENT\" and event.level == \"VULNERABILITY\" | filter vulnerability.resolution.status == \"OPEN\" and in(vulnerability.risk.level, {\"CRITICAL\", \"HIGH\"}) | filter isNotNull(vulnerability.davis_assessment.data_assets_status) and vulnerability.davis_assessment.data_assets_status != \"NOT_AVAILABLE\" | summarize count = countDistinct(vulnerability.display_id)",
        queryB: "fetch security.events, from:now()-2h | filter event.type == \"VULNERABILITY_STATE_REPORT_EVENT\" and event.level == \"VULNERABILITY\" | filter vulnerability.resolution.status == \"OPEN\" and in(vulnerability.risk.level, {\"CRITICAL\", \"HIGH\"}) | summarize count = countDistinct(vulnerability.display_id)",
        thresholds: [{ min: 50 }],
      },
    ],
  },

  // ─── 6. THREAT OBSERVABILITY ───
  {
    name: "Threat Observability",
    color: "#F97316",
    criteria: [
      {
        id: "t4", label: "Detection findings",
        description: "Threat detections reaching Dynatrace in the last 24 hours, from any source.",
        query: 'fetch security.events, from:now()-24h | filter event.type == "DETECTION_FINDING" | summarize count()',
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "t12", label: "External detection sources",
        description: "Security products other than Dynatrace sending detections (for example cloud threat detection or endpoint protection) in the last 24 hours.",
        query: 'fetch security.events, from:now()-24h | filter event.type == "DETECTION_FINDING" | filter product.name != "Runtime Application Protection" | summarize count = countDistinct(product.name)',
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "t13", label: "Security automation workflows",
        description: "Workflows that ran a security action (for example enriching an observable during an investigation) in the last 24h.",
        query: "fetch dt.system.events, from:now()-24h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"ACTION_EXECUTION\" | fieldsAdd app = lower(dt.automation_engine.action.app) | filter contains(app, \"security\") | summarize count = countDistinct(dt.automation_engine.workflow.id)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "t14", label: "Assist, MCP and dtctl usage",
        description: "People who read security findings through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days.",
        query: "fetch dt.system.events, from:now()-30d | filter event.kind == \"QUERY_EXECUTION_EVENT\" | filter isNotNull(user.email) and not(contains(user.email, \"heimdall.dynatrace.com\")) | filter client.application_context == \"dynatrace.davis.copilot\" or contains(lower(toString(client.client_context)), \"dtctl\") or contains(lower(toString(client.client_context)), \"mcp\") or contains(lower(toString(client.source)), \"mcp\") | filter in(table, \"security.events\") | summarize count = countDistinct(user.email)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
    ],
  },

  // ─── 7. AI OBSERVABILITY ───
  {
    name: "AI/LLM Observability",
    color: "#06B6D4",
    criteria: [
      {
        id: "ai1", label: "AI span service coverage (%)",
        description: "Percentage of services with AI/LLM spans.",
        query: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | summarize count = countDistinct(coalesce(dt.entity.service, service.name)) | fields count",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 10 }, { min: 5 }, { min: 1 }],
      },
      {
        id: "ai2", label: "Token tracking coverage (%)",
        description: "Percentage of AI spans with token usage tracking.",
        query: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | filter isNotNull(gen_ai.usage.input_tokens) or isNotNull(gen_ai.usage.output_tokens) | summarize count()",
        queryB: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "ai19", label: "Response model recorded (%)",
        description: "Percentage of AI spans that record the model that actually answered, so a change of model version can be traced.",
        query: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | filter isNotNull(gen_ai.response.model) | summarize count()",
        queryB: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "ai3", label: "AI provider diversity (%)",
        description: "Percentage of known AI providers detected vs expected (out of 5).",
        query: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | fieldsAdd provider = coalesce(gen_ai.system, gen_ai.provider.name) | summarize countDistinct(provider)",
        denominatorConstant: 5,
        thresholds: [{ min: 40 }, { min: 20 }],
      },
      {
        id: "ai4", label: "Agent invocation coverage (%)",
        description: "Percentage of AI spans with agent invocation tracing.",
        query: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | filter isNotNull(gen_ai.agent.name) | summarize count()",
        queryB: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | summarize count()",
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "ai5", label: "Prompt/response tracing coverage (%)",
        description: "Percentage of AI spans with prompt or response tracing.",
        query: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | filter isNotNull(gen_ai.prompt) or isNotNull(gen_ai.completion) or isNotNull(gen_ai.input.messages) or isNotNull(gen_ai.output.messages) | summarize count()",
        queryB: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | summarize count()",
        thresholds: [{ min: 80 }, { min: 50 }, { min: 1 }],
      },
      {
        id: "ai6", label: "AI error tracking coverage (%)",
        description: "Percentage of AI spans with error status tracking.",
        query: 'fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | filter status_code == "ERROR" | summarize count()',
        queryB: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | summarize count()",
        thresholds: [{ min: 1 }],
      },
      {
        id: "ai7", label: "Guardrail coverage (%)",
        description: "Percentage of AI spans with guardrail monitoring.",
        query: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | filter isNotNull(gen_ai.guardrail) | summarize count()",
        queryB: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | summarize count()",
        thresholds: [{ min: 50 }, { min: 20 }, { min: 1 }],
      },
      {
        id: "ai8", label: "Cost tracking coverage (%)",
        description: "Percentage of AI spans carrying token counts and the model, which the AI Observability app needs to calculate cost.",
        query: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | filter isNotNull(gen_ai.usage.input_tokens) or isNotNull(gen_ai.usage.output_tokens) | filter isNotNull(gen_ai.request.model) or isNotNull(gen_ai.response.model) | summarize count()",
        queryB: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | summarize count()",
        thresholds: [{ min: 50 }, { min: 20 }, { min: 1 }],
      },
      {
        id: "ai9", label: "AI tracing service breadth (%)",
        description: "Percentage of total spans that are AI-related.",
        // Same count as the AI-span denominator of ai2–ai8, but its own string:
        // this ratio is against ALL spans, so both sides stay sampled, while
        // the AI-only ratios read unsampled (see isSparseSignal in scale-tier).
        query: "fetch spans, from:now()-72h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | summarize ai_spans = count()",
        queryB: "fetch spans, from:now()-72h | summarize count()",
        thresholds: [{ min: 5 }, { min: 1 }],
      },
      {
        id: "ai10", label: "Agent tool-call tracing",
        description: "Presence of agent tool executions in AI spans (gen_ai.operation.name = execute_tool) in the last 72h.",
        query: 'fetch spans, from:now()-72h | filter gen_ai.operation.name == "execute_tool" | summarize count()',
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "ai12", label: "Agentic AI in use",
        description: "Agentic Dynatrace Assist sessions in the last 30 days (GENAI_EVENT with skill = operator).",
        query: 'fetch dt.system.events, from:now()-30d | filter event.kind == "GENAI_EVENT" and skill == "operator" | filter user.id != "system" | summarize count = countDistinct(user.id)',
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "ai18", label: "dtctl driven by AI agents",
        description: "People whose AI coding agent (for example Claude Code) ran dtctl in the last 30 days.",
        query: 'fetch dt.system.events, from:now()-30d | filter event.kind == "QUERY_EXECUTION_EVENT" | filter contains(client.client_context, "\\"app\\":\\"dtctl\\"") | filter contains(client.client_context, "\\"agent\\"") | summarize count = countDistinct(user.email)',
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "ai14", label: "Agentic workflows",
        description: "Workflows that consumed AI Units in the last 30 days, such as the SRE Agent running on a problem trigger.",
        query: 'fetch dt.system.events, from:now()-30d | filter event.kind == "BILLING_USAGE_EVENT" and event.type == "AI Units" | filter isNotNull(workflow.id) | summarize count = countDistinct(workflow.id)',
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "ai15", label: "Problems with root cause (%)",
        description: "Share of Davis problems on services that call an LLM in the last 72h where Davis identified a root-cause entity.",
        query: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | filter isNotNull(root_cause_entity_id) or isNotNull(root_cause.smartscape_entity) | expand t = affected_entity_ids | lookup [fetch spans, from:now()-4h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | filter isNotNull(dt.entity.service) | summarize n = count(), by:{s = dt.entity.service}], sourceField:t, lookupField:s, prefix:\"sc.\" | filter isNotNull(sc.n) | summarize count = countDistinctExact(event.id)",
        queryB: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | expand t = affected_entity_ids | lookup [fetch spans, from:now()-4h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | filter isNotNull(dt.entity.service) | summarize n = count(), by:{s = dt.entity.service}], sourceField:t, lookupField:s, prefix:\"sc.\" | filter isNotNull(sc.n) | summarize count = countDistinctExact(event.id)",
        thresholds: [{ min: 50 }],
      },
      {
        id: "ai16", label: "Problems with automated response (%)",
        description: "Share of Davis problems on services that call an LLM in the last 72h that triggered at least one workflow execution.",
        query: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | lookup [fetch dt.system.events, from:now()-72h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"WORKFLOW_EXECUTION\" | filter isNotNull(dt.automation_engine.workflow_execution.trigger.event.id) | summarize runs = count(), by:{tid = dt.automation_engine.workflow_execution.trigger.event.id}], sourceField:event.id, lookupField:tid, prefix:\"wf.\" | filter isNotNull(wf.runs) | expand t = affected_entity_ids | lookup [fetch spans, from:now()-4h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | filter isNotNull(dt.entity.service) | summarize n = count(), by:{s = dt.entity.service}], sourceField:t, lookupField:s, prefix:\"sc.\" | filter isNotNull(sc.n) | summarize count = countDistinctExact(event.id)",
        queryB: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | expand t = affected_entity_ids | lookup [fetch spans, from:now()-4h | filter isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name) | filter isNotNull(dt.entity.service) | summarize n = count(), by:{s = dt.entity.service}], sourceField:t, lookupField:s, prefix:\"sc.\" | filter isNotNull(sc.n) | summarize count = countDistinctExact(event.id)",
        thresholds: [{ min: 30 }],
      },
    ],
  },

  // ─── 8. BUSINESS OBSERVABILITY ───
  {
    name: "Business Observability",
    color: "#10B981",
    criteria: [
      {
        id: "b1", label: "Service bizevent coverage (%)",
        description: "Percentage of services with associated business events.",
        query: "fetch bizevents | filter timestamp > now() - 2h | filter isNotNull(dt.entity.service) | summarize count = countDistinct(dt.entity.service) | fields count",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "b2", label: "Bizevent type diversity (%)",
        description: "Percentage of expected business event types detected (out of 10 baseline types).",
        query: "fetch bizevents | filter timestamp > now() - 2h | summarize countDistinct(event.type)",
        denominatorConstant: 10,
        thresholds: [{ min: 60 }, { min: 30 }],
      },
      {
        id: "b3", label: "Events with service context (%)",
        description: "Percentage of business events linked to services.",
        query: "fetch bizevents | filter timestamp > now() - 2h | filter isNotNull(dt.entity.service) | summarize count()",
        queryB: "fetch bizevents | filter timestamp > now() - 2h | summarize count()",
        thresholds: [{ min: 50 }, { min: 20 }, { min: 1 }],
      },
      {
        id: "b4", label: "Bizevent provider diversity (%)",
        description: "Percentage of expected business event providers detected (out of 5 baseline providers).",
        query: "fetch bizevents | filter timestamp > now() - 2h | summarize countDistinct(event.provider)",
        denominatorConstant: 5,
        thresholds: [{ min: 60 }, { min: 20 }],
      },
      {
        id: "b5", label: "Revenue data coverage (%)",
        description: "Percentage of business events with revenue/monetary value.",
        query: "fetch bizevents | filter timestamp > now() - 2h | filter isNotNull(revenue) or isNotNull(amount) or isNotNull(value) | summarize count()",
        queryB: "fetch bizevents | filter timestamp > now() - 2h | summarize count()",
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "b6", label: "Session-linked events (%)",
        description: "Percentage of business events linked to RUM sessions.",
        query: "fetch bizevents | filter timestamp > now() - 2h | filter isNotNull(dt.rum.session_id) | summarize count()",
        queryB: "fetch bizevents | filter timestamp > now() - 2h | summarize count()",
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "b7", label: "Trace-linked events (%)",
        description: "Percentage of business events correlated with distributed traces.",
        query: "fetch bizevents | filter timestamp > now() - 2h | filter isNotNull(trace_id) | summarize count()",
        queryB: "fetch bizevents | filter timestamp > now() - 2h | summarize count()",
        thresholds: [{ min: 30 }, { min: 10 }, { min: 1 }],
      },
      {
        id: "b9", label: "Problems with root cause (%)",
        description: "Share of Davis problems on services that emit business events in the last 72h where Davis identified a root-cause entity.",
        query: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | filter isNotNull(root_cause_entity_id) or isNotNull(root_cause.smartscape_entity) | expand t = affected_entity_ids | lookup [fetch bizevents, from:now()-4h | filter isNotNull(dt.entity.service) | summarize n = count(), by:{s = dt.entity.service}], sourceField:t, lookupField:s, prefix:\"sc.\" | filter isNotNull(sc.n) | summarize count = countDistinctExact(event.id)",
        queryB: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | expand t = affected_entity_ids | lookup [fetch bizevents, from:now()-4h | filter isNotNull(dt.entity.service) | summarize n = count(), by:{s = dt.entity.service}], sourceField:t, lookupField:s, prefix:\"sc.\" | filter isNotNull(sc.n) | summarize count = countDistinctExact(event.id)",
        thresholds: [{ min: 50 }],
      },
      {
        id: "b10", label: "Problems with automated response (%)",
        description: "Share of Davis problems on services that emit business events in the last 72h that triggered at least one workflow execution.",
        query: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | lookup [fetch dt.system.events, from:now()-72h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"WORKFLOW_EXECUTION\" | filter isNotNull(dt.automation_engine.workflow_execution.trigger.event.id) | summarize runs = count(), by:{tid = dt.automation_engine.workflow_execution.trigger.event.id}], sourceField:event.id, lookupField:tid, prefix:\"wf.\" | filter isNotNull(wf.runs) | expand t = affected_entity_ids | lookup [fetch bizevents, from:now()-4h | filter isNotNull(dt.entity.service) | summarize n = count(), by:{s = dt.entity.service}], sourceField:t, lookupField:s, prefix:\"sc.\" | filter isNotNull(sc.n) | summarize count = countDistinctExact(event.id)",
        queryB: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | expand t = affected_entity_ids | lookup [fetch bizevents, from:now()-4h | filter isNotNull(dt.entity.service) | summarize n = count(), by:{s = dt.entity.service}], sourceField:t, lookupField:s, prefix:\"sc.\" | filter isNotNull(sc.n) | summarize count = countDistinctExact(event.id)",
        thresholds: [{ min: 30 }],
      },
      {
        id: "b11", label: "Assist, MCP and dtctl usage",
        description: "People who read business events through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days.",
        query: "fetch dt.system.events, from:now()-30d | filter event.kind == \"QUERY_EXECUTION_EVENT\" | filter isNotNull(user.email) and not(contains(user.email, \"heimdall.dynatrace.com\")) | filter client.application_context == \"dynatrace.davis.copilot\" or contains(lower(toString(client.client_context)), \"dtctl\") or contains(lower(toString(client.client_context)), \"mcp\") or contains(lower(toString(client.source)), \"mcp\") | filter in(table, \"bizevents\") | summarize count = countDistinct(user.email)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
    ],
  },

  // ─── 9. SOFTWARE DELIVERY ───
  {
    name: "Software Delivery",
    color: "#6366F1",
    criteria: [
      {
        id: "sd1", label: "Service deployment coverage (%)",
        description: "Percentage of services with a deployment marker (CUSTOM_DEPLOYMENT) in the last 24h.",
        query: 'fetch dt.davis.events, from:now()-24h | filter event.type == "CUSTOM_DEPLOYMENT" | expand affected = affected_entity_ids | filter startsWith(affected, "SERVICE-") | summarize count = countDistinctExact(affected)',
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 30 }],
      },
      {
        id: "sd2", label: "CI/CD deployment events",
        description: "Deployment events from CI/CD pipelines in the last 24h (SDLC_EVENT whose type names a deployment).",
        query: 'fetch events, from:now()-24h | filter event.kind == "SDLC_EVENT" | filter contains(lower(event.type), "deploy") | summarize count()',
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "sd11", label: "Problems with root cause (%)",
        description: "Share of Davis problems on entities that received a deployment in the last 72h where Davis identified a root-cause entity.",
        query: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | filter isNotNull(root_cause_entity_id) or isNotNull(root_cause.smartscape_entity) | expand t = affected_entity_ids | lookup [fetch dt.davis.events, from:now()-72h | filter event.type == \"CUSTOM_DEPLOYMENT\" | expand s = affected_entity_ids | filter not(startsWith(s, \"ENVIRONMENT\")) | summarize n = count(), by:{s}], sourceField:t, lookupField:s, prefix:\"sc.\" | filter isNotNull(sc.n) | summarize count = countDistinctExact(event.id)",
        queryB: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | expand t = affected_entity_ids | lookup [fetch dt.davis.events, from:now()-72h | filter event.type == \"CUSTOM_DEPLOYMENT\" | expand s = affected_entity_ids | filter not(startsWith(s, \"ENVIRONMENT\")) | summarize n = count(), by:{s}], sourceField:t, lookupField:s, prefix:\"sc.\" | filter isNotNull(sc.n) | summarize count = countDistinctExact(event.id)",
        thresholds: [{ min: 50 }],
      },
      {
        id: "sd12", label: "Problems with automated response (%)",
        description: "Share of Davis problems on entities that received a deployment in the last 72h that triggered at least one workflow execution.",
        query: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | lookup [fetch dt.system.events, from:now()-72h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"WORKFLOW_EXECUTION\" | filter isNotNull(dt.automation_engine.workflow_execution.trigger.event.id) | summarize runs = count(), by:{tid = dt.automation_engine.workflow_execution.trigger.event.id}], sourceField:event.id, lookupField:tid, prefix:\"wf.\" | filter isNotNull(wf.runs) | expand t = affected_entity_ids | lookup [fetch dt.davis.events, from:now()-72h | filter event.type == \"CUSTOM_DEPLOYMENT\" | expand s = affected_entity_ids | filter not(startsWith(s, \"ENVIRONMENT\")) | summarize n = count(), by:{s}], sourceField:t, lookupField:s, prefix:\"sc.\" | filter isNotNull(sc.n) | summarize count = countDistinctExact(event.id)",
        queryB: "fetch dt.davis.problems, from:now()-72h | filter not(dt.davis.is_duplicate) | expand t = affected_entity_ids | lookup [fetch dt.davis.events, from:now()-72h | filter event.type == \"CUSTOM_DEPLOYMENT\" | expand s = affected_entity_ids | filter not(startsWith(s, \"ENVIRONMENT\")) | summarize n = count(), by:{s}], sourceField:t, lookupField:s, prefix:\"sc.\" | filter isNotNull(sc.n) | summarize count = countDistinctExact(event.id)",
        thresholds: [{ min: 30 }],
      },
      {
        id: "sd13", label: "Release validation (Site Reliability Guardian)",
        description: "Site Reliability Guardian validations finished in the last 24h (business event guardian.validation.finished).",
        query: 'fetch bizevents, from:now()-24h | filter event.provider == "dynatrace.site.reliability.guardian" and event.type == "guardian.validation.finished" | summarize count()',
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "sd14", label: "Pipeline integration workflows",
        description: "Workflows that ran a source-control or CI/CD action (GitHub, GitLab, Jenkins, Azure DevOps connectors) in the last 24h.",
        query: "fetch dt.system.events, from:now()-24h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"ACTION_EXECUTION\" | fieldsAdd app = lower(dt.automation_engine.action.app) | filter contains(app, \"github\") or contains(app, \"gitlab\") or contains(app, \"jenkins\") or contains(app, \"devops\") | summarize count = countDistinct(dt.automation_engine.workflow.id)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
    ],
  },
  {
    name: "Platform Governance",
    color: "#64748B",
    criteria: [
      {
        id: "g2", label: "OneAgent version currency (%)",
        description: "Percentage of hosts whose OneAgent was built in the last 12 months (build date read from the installed version).",
        query: "fetch dt.entity.host | parse installerVersion, \"LD '.' LD '.' LD '.' TIMESTAMP('yyyyMMdd'):built\" | filter built > now() - 365d | summarize count()",
        queryB: "fetch dt.entity.host | filter isNotNull(installerVersion) | summarize count()",
        thresholds: [{ min: 80 }],
      },
      {
        id: "g4", label: "Logs with security context (%)",
        description: "Percentage of log records that carry dt.security_context, the field record-level access policies filter on. Read from fieldsSnapshot, which scans no raw data.",
        query: "fieldsSnapshot logs | filter field == \"dt.security_context\" | fields relative_count",
        denominatorConstant: 100,
        thresholds: [{ min: 50 }],
      },
      {
        id: "g5", label: "Workflow execution success (%)",
        description: "Percentage of finished workflow executions in the last 24h that ended in success.",
        query: "fetch dt.system.events, from:now()-24h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"WORKFLOW_EXECUTION\" | filter dt.automation_engine.is_draft == false | filter dt.automation_engine.state.is_final == true and dt.automation_engine.state == \"SUCCESS\" | summarize count()",
        queryB: "fetch dt.system.events, from:now()-24h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"WORKFLOW_EXECUTION\" | filter dt.automation_engine.is_draft == false | filter dt.automation_engine.state.is_final == true | summarize count()",
        thresholds: [{ min: 90 }],
      },
      {
        id: "g6", label: "ITSM or chat integration in workflows",
        description: "Workflows that ran a ServiceNow, Jira, Slack, Microsoft Teams, PagerDuty or email action in the last 24h.",
        query: "fetch dt.system.events, from:now()-24h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"ACTION_EXECUTION\" | filter in(dt.automation_engine.action.app, \"dynatrace.servicenow\", \"dynatrace.jira\", \"dynatrace.slack\", \"dynatrace.msteams\", \"dynatrace.pagerduty\", \"dynatrace.email\") | summarize count = countDistinct(dt.automation_engine.workflow.id)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "g8", label: "Human approval in workflows",
        description: "Workflows that ran an approval task in the last 7 days, so a person confirms before a consequential action.",
        query: "fetch dt.system.events, from:now()-7d | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"ACTION_EXECUTION\" | filter contains(lower(dt.automation_engine.action.function), \"approv\") | summarize count = countDistinct(dt.automation_engine.workflow.id)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "l11", label: "Dedicated log buckets",
        description: "Number of distinct Grail buckets holding log data (expected >= 2 for proper segregation). Read from fieldsSnapshot, which scans no raw data.",
        query: "fieldsSnapshot logs, by:{dt.system.bucket} | summarize count = countDistinct(dt.system.bucket)",
        denominatorConstant: 2,
        thresholds: [{ min: 100 }, { min: 50 }],
      },
      {
        id: "sd10", label: "Ownership assignment (%)",
        description: "Percentage of services with assigned ownership tags — validates team responsibility mapping for incident response.",
        query: "fetch dt.entity.service | fieldsAdd t = tags | expand t | filter contains(toString(t), \"owner\") or contains(toString(t), \"team\") | summarize count = countDistinct(id)",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 50 }],
      },
      {
        id: "a12", label: "Service tagging utilization (%)",
        description: "Percentage of services with at least one tag assigned — tags enable release tracking, ownership, and filtering.",
        query: "fetch dt.entity.service | fieldsAdd t = tags | expand t | filter isNotNull(t) | summarize count = countDistinct(id)",
        queryB: "fetch dt.entity.service | summarize count()",
        thresholds: [{ min: 50 }, { min: 20 }, { min: 1 }],
      },
      {
        id: "g9", label: "Assist, MCP and dtctl usage",
        description: "People who read platform usage, audit and billing events through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days.",
        query: "fetch dt.system.events, from:now()-30d | filter event.kind == \"QUERY_EXECUTION_EVENT\" | filter isNotNull(user.email) and not(contains(user.email, \"heimdall.dynatrace.com\")) | filter client.application_context == \"dynatrace.davis.copilot\" or contains(lower(toString(client.client_context)), \"dtctl\") or contains(lower(toString(client.client_context)), \"mcp\") or contains(lower(toString(client.source)), \"mcp\") | filter in(table, \"dt.system.events\") | summarize count = countDistinct(user.email)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "g10", label: "SLOs defined",
        description: "Service-level objectives configured in the environment, classic and from the Service-Level Objectives app. Read from configuration, which scans no data.",
        query: "slos:count",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "g11", label: "Custom anomaly detectors configured",
        description: "Anomaly detectors the team created on its own metrics and queries. Read from settings, which scans no data.",
        query: "settings:count builtin:davis.anomaly-detectors",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "g12", label: "Adaptive or seasonal baselines in alerts",
        description: "Alerts evaluated in the last 7 days with an auto-adaptive or seasonal baseline instead of a fixed threshold.",
        query: "fetch dt.system.events, from:now()-7d | filter event.kind == \"ANALYZER_EXECUTION_EVENT\" | filter contains(dt.analyzer.name, \"AutoAdaptive\") or contains(dt.analyzer.name, \"SeasonalBaseline\") | summarize count = countDistinct(dt.task.id)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "g14", label: "Sensitive data masking in logs",
        description: "Log masking rules that are switched on. The rules that ship with the platform come switched off, so only active ones count. Read from settings, which scans no data.",
        query: "settings:count builtin:logmonitoring.sensitive-data-masking-settings enabled",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "g15", label: "Span attribute masking",
        description: "Attribute masking rules that are switched on for traces. Read from settings, which scans no data.",
        query: "settings:count builtin:attribute-masking enabled",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "g16", label: "RUM privacy masking (%)",
        description: "Share of web applications where RUM masks personal data in URLs or the names of user actions. Read from settings, which scans no data.",
        query: "settings:count builtin:preferences.privacy rumMasking",
        queryB: "settings:count builtin:preferences.privacy application",
        thresholds: [{ min: 50 }],
      },
      {
        id: "g17", label: "Session Replay recorded with masking (%)",
        description: "Share of web applications whose Session Replay recording uses a masking preset instead of recording everything visible. Read from settings, which scans no data.",
        query: "settings:count builtin:sessionreplay.web.privacy-preferences replayMasked",
        queryB: "settings:count builtin:sessionreplay.web.privacy-preferences application",
        thresholds: [{ min: 50 }],
      },
      {
        id: "g18", label: "Custom buckets with their own retention",
        description: "Grail buckets the team created, each with the retention it chose, instead of keeping everything in the default buckets. Read from the bucket list, which scans no data.",
        query: "fetch dt.system.buckets | filter not(startsWith(lower(name), \"default\")) and not(startsWith(name, \"dt_\")) | summarize count = count()",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "g19", label: "Audit trail consulted",
        description: "People who queried the platform's audit events in the last 30 days. Audit events are always recorded; this counts whether anyone looks at them.",
        query: "fetch dt.system.events, from:now()-30d | filter event.kind == \"QUERY_EXECUTION_EVENT\" | filter isNotNull(user.email) and not(contains(user.email, \"heimdall.dynatrace.com\")) | filter contains(query_string, \"AUDIT_EVENT\") | summarize count = countDistinct(user.email)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
    ],
  },
  {
    name: "FinOps & Sustainability",
    color: "#84CC16",
    criteria: [
      {
        id: "f1", label: "Cost and carbon calculation running",
        description: "Workflows that ran the Cost & Carbon Optimization calculation in the last 24h.",
        query: "fetch dt.system.events, from:now()-24h | filter event.kind == \"WORKFLOW_EVENT\" and event.type == \"ACTION_EXECUTION\" and dt.automation_engine.action.app == \"dynatrace.biz.carbon\" | summarize count = countDistinct(dt.automation_engine.workflow.id)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "f2", label: "Hosts with carbon measurement (%)",
        description: "Percentage of hosts with an energy and carbon measurement from Cost & Carbon Optimization in the last 6h.",
        query: "fetch bizevents, from:now()-6h | filter event.provider == \"dynatrace.biz.carbon\" and event.type == \"carbon.measurement\" | summarize count = countDistinct(dt.entity.host)",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 80 }],
      },
      {
        id: "f3", label: "Cloud spend ingested",
        description: "Cloud providers whose billing data (FOCUS format) was imported into Cost & Carbon Optimization in the last 30 hours (the import runs once a day).",
        query: "fetch bizevents, from:now()-30h | filter event.provider == \"dynatrace.biz.carbon\" and event.type == \"cost.real.spend\" | summarize count = countDistinct(focus.ProviderName)",
        denominatorConstant: 1,
        thresholds: [{ min: 100 }],
      },
      {
        id: "f4", label: "Cloud spend with an owner (%)",
        description: "Share of the imported cloud cost whose billing tags name an owner or a cost center.",
        query: "fetch bizevents, from:now()-30h | filter event.provider == \"dynatrace.biz.carbon\" and event.type == \"cost.real.spend\" | filter contains(lower(focus.Tags), \"owner\") or contains(lower(focus.Tags), \"cost\") | summarize count = sum(focus.EffectiveCost)",
        queryB: "fetch bizevents, from:now()-30h | filter event.provider == \"dynatrace.biz.carbon\" and event.type == \"cost.real.spend\" | summarize count = sum(focus.EffectiveCost)",
        thresholds: [{ min: 80 }],
      },
      {
        id: "f5", label: "Kubernetes namespaces with carbon measurement (%)",
        description: "Percentage of Kubernetes namespaces with an energy and carbon measurement in the last 6h.",
        query: "fetch bizevents, from:now()-6h | filter event.provider == \"dynatrace.biz.carbon\" and event.type == \"carbon.measurement.k8s.namespace\" | summarize count = countDistinct(k8s.namespace.name)",
        queryB: "fetch dt.entity.cloud_application_namespace | summarize count()",
        thresholds: [{ min: 50 }],
      },
      {
        id: "f6", label: "Hosts in active use (%)",
        description: "Percentage of measured hosts whose average CPU usage in the last 6h is at or above 3%, the idle threshold Cost & Carbon Optimization applies.",
        query: "fetch bizevents, from:now()-6h | filter event.provider == \"dynatrace.biz.carbon\" and event.type == \"carbon.measurement\" | summarize cpu = avg(utilization.cpu.average), by:{dt.entity.host} | filter cpu >= 3 | summarize count()",
        queryB: "fetch bizevents, from:now()-6h | filter event.provider == \"dynatrace.biz.carbon\" and event.type == \"carbon.measurement\" | summarize count = countDistinct(dt.entity.host)",
        thresholds: [{ min: 80 }],
      },
      {
        id: "f7", label: "Spend under commitment discount (%)",
        description: "Share of the imported cloud cost covered by a commitment discount (savings plan or reserved capacity).",
        query: "fetch bizevents, from:now()-30h | filter event.provider == \"dynatrace.biz.carbon\" and event.type == \"cost.real.spend\" | filter isNotNull(focus.CommitmentDiscountId) | summarize count = sum(focus.EffectiveCost)",
        queryB: "fetch bizevents, from:now()-30h | filter event.provider == \"dynatrace.biz.carbon\" and event.type == \"cost.real.spend\" | summarize count = sum(focus.EffectiveCost)",
        thresholds: [{ min: 30 }],
      },
      {
        id: "f8", label: "Energy in productive use (%)",
        description: "Share of the energy measured on hosts in the last 6h that was not classified as wasted (idle CPU and its overhead).",
        query: "fetch bizevents, from:now()-6h | filter event.provider == \"dynatrace.biz.carbon\" and event.type == \"carbon.measurement\" | summarize count = sum(energy.measurement.total) - sum(energy.measurement.total_wasted)",
        queryB: "fetch bizevents, from:now()-6h | filter event.provider == \"dynatrace.biz.carbon\" and event.type == \"carbon.measurement\" | summarize count = sum(energy.measurement.total)",
        thresholds: [{ min: 50 }],
      },
      {
        id: "g3", label: "Host monitoring cost allocated (%)",
        description: "Percentage of host monitoring billing records in the last 24h that carry a cost center (dt.cost.costcenter).",
        query: "fetch dt.system.events, from:now()-24h | filter event.kind == \"BILLING_USAGE_EVENT\" | filter in(event.type, \"Full-Stack Monitoring\", \"Infrastructure Monitoring\", \"Foundation & Discovery\") | filter isNotNull(dt.cost.costcenter) | summarize count()",
        queryB: "fetch dt.system.events, from:now()-24h | filter event.kind == \"BILLING_USAGE_EVENT\" | filter in(event.type, \"Full-Stack Monitoring\", \"Infrastructure Monitoring\", \"Foundation & Discovery\") | summarize count()",
        thresholds: [{ min: 50 }],
      },
      {
        id: "b8", label: "Business events with a cost center (%)",
        description: "Percentage of business events with cost center or product data.",
        query: "fetch bizevents | filter timestamp > now() - 2h | filter isNotNull(dt.cost.costcenter) or isNotNull(dt.cost.product) | summarize count()",
        queryB: "fetch bizevents | filter timestamp > now() - 2h | summarize count()",
        thresholds: [{ min: 20 }, { min: 5 }, { min: 1 }],
      },
    ],
  },

];
