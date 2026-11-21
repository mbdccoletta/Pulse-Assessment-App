/**
 * Remediation actions and Dynatrace documentation links for each criterion.
 * Used in the Comparison page to show actionable next steps for improved/regressed capabilities.
 */
export interface RemediationAction {
  action: string;
  docUrl: string;
  docLabel: string;
}

/** Actions that replace the defaults for the current environment (for example
 *  the OpenTelemetry wording when no OneAgent reports). The environment does not
 *  change during a session, so they are set once, before the first run. */
export function setActionOverrides(overrides: Record<string, RemediationAction> | null): void {
  for (const id of Object.keys(DEFAULTS)) CRITERION_ACTIONS[id] = DEFAULTS[id];
  if (overrides) for (const [id, a] of Object.entries(overrides)) CRITERION_ACTIONS[id] = a;
}

export const CRITERION_ACTIONS: Record<string, RemediationAction> = {
  // ── Infrastructure Observability ──
  i1:  { action: "Deploy OneAgent on all hosts to collect CPU usage metrics, or ingest via OTel/cloud integration.", docUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-observability/infrastructure-and-operations/hosts", docLabel: "Host CPU monitoring" },
  i2:  { action: "Verify OneAgent memory metric collection. Enable memory monitoring in host settings.", docUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-observability/infrastructure-and-operations/hosts", docLabel: "Host memory monitoring" },
  i3:  { action: "Ensure disk monitoring is enabled in OneAgent settings for storage utilization visibility.", docUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-observability/infrastructure-and-operations/hosts", docLabel: "Host disk monitoring" },
  i4:  { action: "Confirm host availability metrics are being collected. Review host monitoring and SLA settings.", docUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-observability/infrastructure-and-operations/hosts", docLabel: "Host availability monitoring" },
  i5:  { action: "Enable network monitoring in OneAgent settings for interface-level traffic metrics on hosts.", docUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-observability/infrastructure-and-operations/hosts", docLabel: "Host network monitoring" },
  i6:  { action: "Enable process-level monitoring in OneAgent to capture per-process CPU usage metrics.", docUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-observability/process-groups", docLabel: "Process CPU monitoring" },
  i7:  { action: "Connect Kubernetes clusters using the Dynatrace Operator for full-stack K8s monitoring.", docUrl: "https://docs.dynatrace.com/docs/ingest-from/setup-on-k8s", docLabel: "K8s cluster monitoring" },
  i8:  { action: "Verify disk entities are detected on hosts. Enable disk monitoring in OneAgent settings.", docUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-observability/infrastructure-and-operations/hosts", docLabel: "Host disk entities" },
  i9:  { action: "Verify Davis AI is enabled and anomaly detection settings are configured for infrastructure.", docUrl: "https://docs.dynatrace.com/docs/platform/davis-ai", docLabel: "Davis AI problems" },
  i10: { action: "Enable cloud platform integration (AWS, Azure, GCP) to discover cloud-native K8s workloads.", docUrl: "https://docs.dynatrace.com/docs/ingest-from", docLabel: "Cloud workload monitoring" },
  i11: { action: "Ensure OneAgent is running on hosts so process groups are auto-detected for topology mapping.", docUrl: "https://docs.dynatrace.com/docs/observe/infrastructure-observability/process-groups", docLabel: "Host-process topology" },
  i12: { action: "Verify K8s namespace-level workloads are detected via Dynatrace Operator for workload topology.", docUrl: "https://docs.dynatrace.com/docs/ingest-from/setup-on-k8s", docLabel: "K8s workload mapping" },
  i13: { action: "Enable cloud platform integration and verify host-level logs include cloud.provider metadata.", docUrl: "https://docs.dynatrace.com/docs/ingest-from", docLabel: "Cloud host log enrichment" },
  i14: { action: "Configure cloud integration to enrich log records with cloud.provider context via OpenPipeline.", docUrl: "https://docs.dynatrace.com/docs/platform/openpipeline", docLabel: "Cloud log enrichment" },
  i15: { action: "Ensure cloud integration includes cloud.region attribute. Verify multi-region coverage in log data.", docUrl: "https://docs.dynatrace.com/docs/ingest-from", docLabel: "Cloud region enrichment" },
  i16: { action: "Enable availability zone metadata in cloud integration for failure domain visibility.", docUrl: "https://docs.dynatrace.com/docs/ingest-from", docLabel: "Cloud AZ enrichment" },
  i17: { action: "Configure cloud integration to include cloud.account.id for multi-account governance.", docUrl: "https://docs.dynatrace.com/docs/ingest-from", docLabel: "Cloud account enrichment" },
  i18: { action: "Verify cloud.provider context is present in span data via cloud platform integrations.", docUrl: "https://docs.dynatrace.com/docs/ingest-from", docLabel: "Cloud span enrichment" },
  i19: { action: "Ensure Dynatrace Operator is collecting node-level metrics from K8s clusters.", docUrl: "https://docs.dynatrace.com/docs/ingest-from/setup-on-k8s", docLabel: "K8s node monitoring" },
  i20: { action: "Verify K8s namespace-level container metrics are flowing via Dynatrace Operator.", docUrl: "https://docs.dynatrace.com/docs/ingest-from/setup-on-k8s", docLabel: "K8s namespace metrics" },
  i21: { action: "Enable container restart tracking via Dynatrace Operator to detect CrashLoopBackOff and OOMKill.", docUrl: "https://docs.dynatrace.com/docs/ingest-from/setup-on-k8s", docLabel: "Container restart monitoring" },
  i22: { action: "Define CPU/memory resource limits on K8s workloads for cluster stability and governance.", docUrl: "https://docs.dynatrace.com/docs/ingest-from/setup-on-k8s", docLabel: "Container resource limits" },
  i23: { action: "Close monitoring gaps on the affected entities so Davis can attribute a root cause; review problems that end without one.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence/problems-app", docLabel: "Problems app" },
  i24: { action: "Create a problem-triggered workflow that routes the problem to its owner (ITSM, chat) or runs a pre-approved remediation.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/workflows", docLabel: "Workflows" },

  // ── Application Observability ──
  a1:  { action: "Deploy OneAgent on application servers or ingest OpenTelemetry traces for service detection.", docUrl: "https://docs.dynatrace.com/docs/observe/application-observability/services", docLabel: "Service tracing" },
  a2:  { action: "Enable method-level tracing in service settings. Use sensor rules for deeper visibility.", docUrl: "https://docs.dynatrace.com/docs/observe/application-observability/services", docLabel: "Service method tracing" },
  a3:  { action: "Ensure root spans (incoming requests) are captured. Check OneAgent or OTel instrumentation for ingress points.", docUrl: "https://docs.dynatrace.com/docs/observe/application-observability/distributed-tracing", docLabel: "Root span tracing" },
  a4:  { action: "Instrument applications with OpenTelemetry SDK or configure OTel Collector to export to Dynatrace.", docUrl: "https://docs.dynatrace.com/docs/ingest-from/opentelemetry", docLabel: "OpenTelemetry integration" },
  a5:  { action: "Confirm service response time metrics (p95) are flowing. Enable response time percentiles in settings.", docUrl: "https://docs.dynatrace.com/docs/observe/application-observability/services", docLabel: "Response time metrics" },
  a6:  { action: "Enable failure detection rules and verify failure rate metrics are being captured on services.", docUrl: "https://docs.dynatrace.com/docs/observe/application-observability/services", docLabel: "Failure rate tracking" },
  a7:  { action: "Verify request count and throughput metrics are active. Review service monitoring settings.", docUrl: "https://docs.dynatrace.com/docs/observe/application-observability/services", docLabel: "Throughput monitoring" },
  a8:  { action: "Ensure database calls are traced. Enable database request capturing in service settings.", docUrl: "https://docs.dynatrace.com/docs/observe/application-observability/services", docLabel: "Database span monitoring" },
  a9:  { action: "Enable message queue tracing for Kafka, RabbitMQ, SQS and other messaging systems.", docUrl: "https://docs.dynatrace.com/docs/observe/application-observability/services", docLabel: "Messaging span monitoring" },
  a10: { action: "Ensure distributed traces span 2+ services. Check cross-service correlation and context propagation.", docUrl: "https://docs.dynatrace.com/docs/observe/application-observability/distributed-tracing", docLabel: "Multi-service tracing" },
  a11: { action: "Verify services have associated process groups for service-to-infrastructure topology mapping.", docUrl: "https://docs.dynatrace.com/docs/observe/application-observability/services", docLabel: "Service-process mapping" },
  a12: { action: "Assign tags to services for release tracking, ownership mapping, and filtering.", docUrl: "https://docs.dynatrace.com/docs/manage/tags-and-metadata", docLabel: "Service tagging" },
  a13: { action: "Enable deep database call tracing in services. Ensure services connected to multiple DB systems have all db.system attributes tracked.", docUrl: "https://docs.dynatrace.com/docs/observe/application-observability/services", docLabel: "Database call depth" },
  a14: { action: "Close monitoring gaps on the affected entities so Davis can attribute a root cause; review problems that end without one.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence/problems-app", docLabel: "Problems app" },
  a15: { action: "Create a problem-triggered workflow that routes the problem to its owner (ITSM, chat) or runs a pre-approved remediation.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/workflows", docLabel: "Workflows" },

  // ── Digital Experience ──
  d1:  { action: "Create a web application in Dynatrace and inject the RUM JavaScript snippet for user action tracking.", docUrl: "https://docs.dynatrace.com/docs/observe/digital-experience/web-applications", docLabel: "RUM user action setup" },
  d2:  { action: "Enable session tracking in your RUM application configuration to capture user sessions.", docUrl: "https://docs.dynatrace.com/docs/observe/digital-experience/web-applications", docLabel: "Session tracking" },
  d3:  { action: "Enable Largest Contentful Paint (LCP) capture in RUM settings. Optimize to target <2.5s.", docUrl: "https://docs.dynatrace.com/docs/observe/digital-experience/web-applications/analyze-and-use/work-with-key-performance-metrics", docLabel: "Key performance metrics" },
  d4:  { action: "Enable Interaction to Next Paint (INP) tracking in RUM settings. Target <200ms.", docUrl: "https://docs.dynatrace.com/docs/observe/digital-experience/web-applications/analyze-and-use/work-with-key-performance-metrics", docLabel: "Key performance metrics" },
  d5:  { action: "Enable Cumulative Layout Shift (CLS) tracking in RUM settings. Target CLS <0.1.", docUrl: "https://docs.dynatrace.com/docs/observe/digital-experience/web-applications/analyze-and-use/work-with-key-performance-metrics", docLabel: "Key performance metrics" },
  d6:  { action: "Enable JavaScript error tracking in RUM application settings for frontend error visibility.", docUrl: "https://docs.dynatrace.com/docs/observe/digital-experience/web-applications", docLabel: "Frontend error tracking" },
  d7:  { action: "Create HTTP monitors in Synthetic Monitoring to check endpoint availability and response times.", docUrl: "https://docs.dynatrace.com/docs/observe/digital-experience/synthetic-monitoring/http-monitors-classic", docLabel: "Synthetic HTTP monitors" },
  d8:  { action: "Create browser clickpath monitors to simulate user journeys and catch regressions.", docUrl: "https://docs.dynatrace.com/docs/observe/digital-experience/synthetic-monitoring/browser-monitors", docLabel: "Synthetic browser monitors" },
  d9:  { action: "Integrate the Dynatrace Mobile SDK (iOS/Android) into your native apps for mobile RUM.", docUrl: "https://docs.dynatrace.com/docs/observe/digital-experience/mobile-applications", docLabel: "Mobile app monitoring" },
  d10: { action: "Add multiple synthetic locations (public and/or private) for broader geographic coverage.", docUrl: "https://docs.dynatrace.com/docs/observe/digital-experience/synthetic-monitoring", docLabel: "Synthetic location diversity" },
  d11: { action: "Create synthetic monitors and verify execution availability metrics are captured.", docUrl: "https://docs.dynatrace.com/docs/observe/digital-experience/synthetic-monitoring", docLabel: "Synthetic availability" },
  d12: { action: "Close monitoring gaps on the affected entities so Davis can attribute a root cause; review problems that end without one.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence/problems-app", docLabel: "Problems app" },
  d13: { action: "Create a problem-triggered workflow that routes the problem to its owner (ITSM, chat) or runs a pre-approved remediation.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/workflows", docLabel: "Workflows" },

  // ── Log Analytics ──
  l1:  { action: "Activate log ingestion via OneAgent on hosts. Verify host-level logs are flowing to Grail.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/logs", docLabel: "Host log ingestion" },
  l2:  { action: "Verify log data is associated with services. Enable log collection on application hosts.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/logs", docLabel: "Service log coverage" },
  l3:  { action: "Ensure trace_id is included in log output. Use OneAgent auto-enrichment or structured logging.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/logs", docLabel: "Log-trace correlation" },
  l4:  { action: "Enable host entity enrichment (dt.entity.host) via OneAgent log collection or OpenPipeline.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/logs", docLabel: "Log entity enrichment" },
  l5:  { action: "Enable process group enrichment in log ingestion settings for service-level log analysis.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/logs", docLabel: "Process group log correlation" },
  l6:  { action: "Add log sources from multiple layers (app, infra, K8s, cloud). Configure additional log integrations.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/logs", docLabel: "Log source diversity" },
  l7:  { action: "Ensure services emit ERROR-level logs. Configure log processing rules to capture error severity.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/logs", docLabel: "Error log coverage" },
  l8:  { action: "Deploy Dynatrace Operator or Fluent Bit on K8s to capture pod/container logs with K8s metadata.", docUrl: "https://docs.dynatrace.com/docs/ingest-from/setup-on-k8s", docLabel: "K8s log integration" },
  l9:  { action: "Ensure applications emit logs at multiple severity levels (ERROR, WARN, INFO, DEBUG, TRACE).", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/logs", docLabel: "Log severity diversity" },
  l11: { action: "Create dedicated Grail buckets for different log tiers (security, application, infrastructure). Configure OpenPipeline routing rules.", docUrl: "https://docs.dynatrace.com/docs/platform/grail/organize-data", docLabel: "Dedicated log buckets" },
  l12: { action: "Configure applications to emit structured JSON logs. Use OpenPipeline processing rules to parse unstructured logs.", docUrl: "https://docs.dynatrace.com/docs/platform/openpipeline", docLabel: "Structured logging" },
  l13: { action: "Configure OpenTelemetry auto-instrumentation to inject span_id into logs. For Java use MDC; for .NET use ILogger with Activity context.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/logs", docLabel: "Span-log correlation" },
  l14: { action: "Enable multiple log sources per host: application logs via OneAgent, system/syslog, security audit logs, and cloud-native logs.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/logs", docLabel: "Multi-source host logging" },
  l15: { action: "Create log-based event rules in Settings → Log Events. Define patterns for critical errors, security, and business-critical entries.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-log-processing/lma-log-events", docLabel: "Log-based events" },
  l16: { action: "Register custom devices via API and enrich logs with dt.entity.custom_device attribute for domain-specific correlation.", docUrl: "https://docs.dynatrace.com/docs/extend-dynatrace/extensions20", docLabel: "Custom attribute enrichment" },

  // ── Application Security ──
  s13: { action: "Enable Runtime Vulnerability Analytics in the Application Security settings.", docUrl: "https://docs.dynatrace.com/docs/secure/application-security", docLabel: "Runtime Vulnerability Analytics" },
  s1: { action: "Enable Runtime Vulnerability Analytics and make sure the monitored processes are covered by the monitoring rules.", docUrl: "https://docs.dynatrace.com/docs/secure/application-security", docLabel: "Runtime Vulnerability Analytics" },
  s11: { action: "Enable Runtime Application Protection so attacks on vulnerable code are detected and can be blocked.", docUrl: "https://docs.dynatrace.com/docs/secure/application-security", docLabel: "Runtime Application Protection" },
  s12: { action: "Enable Security Posture Management to assess Kubernetes and cloud configuration against compliance standards.", docUrl: "https://docs.dynatrace.com/docs/secure/application-security/spm", docLabel: "Security Posture Management" },
  s2: { action: "Ingest findings from your scanners, registries and cloud security tools so all security signals sit beside runtime context.", docUrl: "https://docs.dynatrace.com/docs/secure/threat-observability", docLabel: "Security integrations" },
  t4: { action: "Send threat detections to Dynatrace, from Runtime Application Protection or from external security products.", docUrl: "https://docs.dynatrace.com/docs/secure/threat-observability", docLabel: "Threat Observability" },
  t12: { action: "Connect cloud threat detection and endpoint protection products so their detections are investigated with observability context.", docUrl: "https://docs.dynatrace.com/docs/secure/threat-observability", docLabel: "Security integrations" },

  // ── Threat Observability ──

  // ── AI/LLM Observability ──
  ai1: { action: "Instrument AI/LLM calls with OpenTelemetry gen_ai semantic conventions and export to Dynatrace.", docUrl: "https://docs.dynatrace.com/docs/observe/dynatrace-for-ai-observability", docLabel: "AI/LLM Observability setup" },
  ai2: { action: "Add token usage attributes (gen_ai.usage.input_tokens, gen_ai.usage.output_tokens) to AI spans.", docUrl: "https://docs.dynatrace.com/docs/observe/dynatrace-for-ai-observability", docLabel: "Token tracking" },
  ai3: { action: "Monitor multiple AI providers. Add gen_ai.system attribute to distinguish vendors.", docUrl: "https://docs.dynatrace.com/docs/observe/dynatrace-for-ai-observability", docLabel: "AI provider diversity" },
  ai4: { action: "Add gen_ai.agent.name attribute to spans for AI agent invocation tracking.", docUrl: "https://docs.dynatrace.com/docs/observe/dynatrace-for-ai-observability", docLabel: "Agent monitoring" },
  ai5: { action: "Enable prompt/response capture in AI span attributes for audit and compliance.", docUrl: "https://docs.dynatrace.com/docs/observe/dynatrace-for-ai-observability", docLabel: "Prompt tracing" },
  ai6: { action: "Track AI errors by setting span status to ERROR on model failures and timeouts.", docUrl: "https://docs.dynatrace.com/docs/observe/dynatrace-for-ai-observability", docLabel: "AI error tracking" },
  ai7: { action: "Implement guardrail monitoring with gen_ai.guardrail attributes for safety compliance.", docUrl: "https://docs.dynatrace.com/docs/observe/dynatrace-for-ai-observability", docLabel: "Guardrail monitoring" },
  ai8: { action: "Send token usage (gen_ai.usage.input_tokens, gen_ai.usage.output_tokens) and the model (gen_ai.request.model) on AI spans so the AI Observability app can calculate cost.", docUrl: "https://docs.dynatrace.com/docs/observe/dynatrace-for-ai-observability", docLabel: "AI cost tracking" },
  ai9: { action: "Expand AI span instrumentation to cover more services for broader AI tracing breadth.", docUrl: "https://docs.dynatrace.com/docs/observe/dynatrace-for-ai-observability", docLabel: "AI tracing breadth" },
  ai10: { action: "Instrument agent frameworks with OpenTelemetry GenAI conventions so tool executions appear as execute_tool spans.", docUrl: "https://docs.dynatrace.com/docs/observe/dynatrace-for-ai-observability", docLabel: "Agent tracing" },
  ai12: { action: "Turn on agentic AI for Dynatrace Assist and grant ai:operator:execute and the MCP gateway permissions.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence/agentic-and-generative-ai", docLabel: "Agentic AI" },
  ai18: { action: "Give AI coding agents access to Dynatrace through dtctl or the MCP server, under the same IAM as the user.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence/agentic-and-generative-ai", docLabel: "AI agents" },
  ai14: { action: "Add a Run agent task (SRE Agent) to a problem-triggered workflow, with a Request Approval task before consequential actions.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence/dynatrace-intelligence-integrations/dynatrace-intelligence-run-agent-workflows", docLabel: "SRE Agent workflows" },
  ai15: { action: "Close monitoring gaps on the affected entities so Davis can attribute a root cause; review problems that end without one.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence/problems-app", docLabel: "Problems app" },
  ai16: { action: "Create a problem-triggered workflow that routes the problem to its owner (ITSM, chat) or runs a pre-approved remediation.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/workflows", docLabel: "Workflows" },

  // ── Business Observability ──
  b1:  { action: "Send business events to Dynatrace via the Business Events API or OpenPipeline log extraction.", docUrl: "https://docs.dynatrace.com/docs/observe/business-observability", docLabel: "Business events setup" },
  b2:  { action: "Define multiple event types for different business processes (orders, signups, payments).", docUrl: "https://docs.dynatrace.com/docs/observe/business-observability", docLabel: "Event type diversity" },
  b3:  { action: "Enrich business events with dt.entity.service for service-level business impact correlation.", docUrl: "https://docs.dynatrace.com/docs/observe/business-observability", docLabel: "Service-event correlation" },
  b4:  { action: "Add event.provider attribute to classify business events by originating system.", docUrl: "https://docs.dynatrace.com/docs/observe/business-observability", docLabel: "Event provider diversity" },
  b5:  { action: "Include revenue/amount/value fields in business events for monetary impact analysis.", docUrl: "https://docs.dynatrace.com/docs/observe/business-observability", docLabel: "Revenue tracking" },
  b6:  { action: "Link business events to RUM sessions by including dt.rum.session_id attribute.", docUrl: "https://docs.dynatrace.com/docs/observe/business-observability", docLabel: "Session-event linking" },
  b7:  { action: "Include trace_id in business events for end-to-end transaction traceability.", docUrl: "https://docs.dynatrace.com/docs/observe/business-observability", docLabel: "Trace-event linking" },
  b8:  { action: "Add dt.cost.costcenter and dt.cost.product attributes for FinOps-business correlation.", docUrl: "https://docs.dynatrace.com/docs/observe/business-observability", docLabel: "Cost center tracking" },
  b9: { action: "Close monitoring gaps on the affected entities so Davis can attribute a root cause; review problems that end without one.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence/problems-app", docLabel: "Problems app" },
  b10: { action: "Create a problem-triggered workflow that routes the problem to its owner (ITSM, chat) or runs a pre-approved remediation.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/workflows", docLabel: "Workflows" },

  // ── Software Delivery ──
  sd1:  { action: "Enable deployment event tracking on services. Send CUSTOM_DEPLOYMENT events from CI/CD.", docUrl: "https://docs.dynatrace.com/docs/deliver/release-monitoring", docLabel: "Deployment tracking" },
  sd2: { action: "Send deployment events from CI/CD (Azure DevOps, GitHub, Argo CD) through the SDLC events model.", docUrl: "https://docs.dynatrace.com/docs/semantic-dictionary/model/sdlc-events", docLabel: "SDLC events" },
  sd10: { action: "Assign ownership tags to services for team responsibility mapping and incident response.", docUrl: "https://docs.dynatrace.com/docs/manage/tags-and-metadata", docLabel: "Ownership assignment" },
  sd11: { action: "Close monitoring gaps on the affected entities so Davis can attribute a root cause; review problems that end without one.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence/problems-app", docLabel: "Problems app" },
  sd12: { action: "Create a problem-triggered workflow that routes the problem to its owner (ITSM, chat) or runs a pre-approved remediation.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/workflows", docLabel: "Workflows" },
  sd13: { action: "Run a Site Reliability Guardian validation from the pipeline after each deployment to approve or block the release.", docUrl: "https://docs.dynatrace.com/docs/deliver/site-reliability-guardian", docLabel: "Site Reliability Guardian" },
  g2: { action: "Turn on automatic OneAgent updates, or schedule updates in maintenance windows, so no host stays on a build older than 12 months.", docUrl: "https://docs.dynatrace.com/docs/ingest-from/dynatrace-oneagent/oneagent-update", docLabel: "OneAgent update" },
  g3: { action: "Set dt.cost.costcenter on hosts (host properties or Kubernetes labels) so host monitoring usage is allocated to a cost center.", docUrl: "https://docs.dynatrace.com/docs/license/cost-allocation", docLabel: "Cost allocation" },
  g4: { action: "Set dt.security_context on log sources or in OpenPipeline, then scope access with policy boundaries on that field.", docUrl: "https://docs.dynatrace.com/docs/manage/identity-access-management", docLabel: "Identity and access management" },
  g5: { action: "Review the workflows that end in error, fix or disable them, and alert on failed executions.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/workflows", docLabel: "Workflows" },
  g6: { action: "Add a ServiceNow, Jira, Slack or Microsoft Teams action to the problem workflows so incidents reach the team's own tools.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/workflows", docLabel: "Workflows" },
  g8: { action: "Add an approval task before actions that change production, so medium and high-risk automation waits for a person.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/workflows", docLabel: "Workflows" },
  i25: { action: "Add a cloud or Kubernetes connector action to a workflow, for example to restart, scale or tag a resource when a problem opens.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/workflows", docLabel: "Workflows" },
  d14: { action: "Add an on-demand synthetic execution to a workflow, for example to confirm recovery after a deployment or a remediation.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/workflows", docLabel: "Workflows" },
  t13: { action: "Add security actions to a workflow, for example to enrich an indicator or open a case when a detection arrives.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/workflows", docLabel: "Workflows" },
  sd14: { action: "Connect the source-control or CI/CD tool to Workflows so a pipeline event can start a validation or a rollback.", docUrl: "https://docs.dynatrace.com/docs/analyze-explore-automate/workflows", docLabel: "Workflows" },
  i26: { action: "Introduce Dynatrace Assist to the team that owns this data, and connect their IDE or coding agent through the Dynatrace MCP server or dtctl.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence", docLabel: "Dynatrace Intelligence" },
  a16: { action: "Introduce Dynatrace Assist to the team that owns this data, and connect their IDE or coding agent through the Dynatrace MCP server or dtctl.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence", docLabel: "Dynatrace Intelligence" },
  d15: { action: "Introduce Dynatrace Assist to the team that owns this data, and connect their IDE or coding agent through the Dynatrace MCP server or dtctl.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence", docLabel: "Dynatrace Intelligence" },
  l17: { action: "Introduce Dynatrace Assist to the team that owns this data, and connect their IDE or coding agent through the Dynatrace MCP server or dtctl.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence", docLabel: "Dynatrace Intelligence" },
  s14: { action: "Introduce Dynatrace Assist to the team that owns this data, and connect their IDE or coding agent through the Dynatrace MCP server or dtctl.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence", docLabel: "Dynatrace Intelligence" },
  t14: { action: "Introduce Dynatrace Assist to the team that owns this data, and connect their IDE or coding agent through the Dynatrace MCP server or dtctl.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence", docLabel: "Dynatrace Intelligence" },
  b11: { action: "Introduce Dynatrace Assist to the team that owns this data, and connect their IDE or coding agent through the Dynatrace MCP server or dtctl.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence", docLabel: "Dynatrace Intelligence" },
  g9: { action: "Introduce Dynatrace Assist to the team that owns this data, and connect their IDE or coding agent through the Dynatrace MCP server or dtctl.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence", docLabel: "Dynatrace Intelligence" },
  g10: { action: "Define an SLO for each business-critical service, starting with availability and response time.", docUrl: "https://docs.dynatrace.com/docs/deliver/service-level-objectives", docLabel: "Service-Level Objectives" },
  g11: { action: "Create an anomaly detector on a metric or DQL query that matters to the business and is not covered by the built-in detection.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence/anomaly-detection", docLabel: "Anomaly detection" },
  g12: { action: "Switch alerts on signals with daily or weekly patterns from a fixed threshold to an auto-adaptive or seasonal baseline.", docUrl: "https://docs.dynatrace.com/docs/dynatrace-intelligence/anomaly-detection", docLabel: "Anomaly detection" },
  g14: { action: "Switch on the log masking rules that match the data the applications write (card numbers, e-mail addresses, credentials) and add rules for identifiers of your own.", docUrl: "https://docs.dynatrace.com/docs/manage/data-privacy-and-security", docLabel: "Data privacy and security" },
  g15: { action: "Mask the span attributes that can carry personal data, such as full URLs, query strings, user identifiers and request headers.", docUrl: "https://docs.dynatrace.com/docs/manage/data-privacy-and-security", docLabel: "Data privacy and security" },
  g16: { action: "In each application's data privacy settings, switch on masking of personal data in URLs and of user action names.", docUrl: "https://docs.dynatrace.com/docs/manage/data-privacy-and-security", docLabel: "Data privacy and security" },
  g17: { action: "Keep a masking preset on the recording of every application with Session Replay, and allow individual elements only where the content is known to be harmless.", docUrl: "https://docs.dynatrace.com/docs/manage/data-privacy-and-security", docLabel: "Data privacy and security" },
  g18: { action: "Create buckets for the data with its own retention need, such as audit, security or short-lived debug data, and route records to them in OpenPipeline.", docUrl: "https://docs.dynatrace.com/docs/platform/grail/organize-data", docLabel: "Organize data in Grail" },
  g19: { action: "Give the audit events a destination: a dashboard or a scheduled review of who changed settings, tokens and access.", docUrl: "https://docs.dynatrace.com/docs/manage/data-privacy-and-security", docLabel: "Data privacy and security" },
  l18: { action: "Create a log pipeline in OpenPipeline for the main log sources: mask sensitive fields, drop noise and route records to the right bucket.", docUrl: "https://docs.dynatrace.com/docs/platform/openpipeline", docLabel: "OpenPipeline" },
  s16: { action: "Give Davis the context to assess each vulnerability: monitor the affected process groups full-stack, together with the databases they call, so reachable data assets and exposure are known.", docUrl: "https://docs.dynatrace.com/docs/secure/application-security", docLabel: "Application Security" },
  ai19: { action: "Record gen_ai.response.model on every AI span, following the OpenTelemetry GenAI semantic conventions.", docUrl: "https://docs.dynatrace.com/docs/observe/dynatrace-for-ai-observability", docLabel: "AI Observability" },
  f1: { action: "Install Cost & Carbon Optimization from the Hub and schedule its calculation workflow.", docUrl: "https://docs.dynatrace.com/docs", docLabel: "Dynatrace documentation" },
  f2: { action: "Check that the calculation covers every monitored host; hosts without a measurement are usually outside the workflow's scope.", docUrl: "https://docs.dynatrace.com/docs", docLabel: "Dynatrace documentation" },
  f3: { action: "Configure the cloud cost import in Cost & Carbon Optimization so the provider's FOCUS billing export is loaded daily.", docUrl: "https://docs.dynatrace.com/docs", docLabel: "Dynatrace documentation" },
  f4: { action: "Tag cloud resources with an owner or cost center at the provider, so the imported cost can be attributed.", docUrl: "https://docs.dynatrace.com/docs", docLabel: "Dynatrace documentation" },
  f5: { action: "Include the Kubernetes clusters in the carbon calculation so each namespace gets its own measurement.", docUrl: "https://docs.dynatrace.com/docs", docLabel: "Dynatrace documentation" },
  f6: { action: "Review the hosts below the idle threshold: stop, consolidate or downsize the ones that are not needed.", docUrl: "https://docs.dynatrace.com/docs", docLabel: "Dynatrace documentation" },
  f7: { action: "Review steady workloads paid on demand and evaluate a commitment discount with the cloud provider.", docUrl: "https://docs.dynatrace.com/docs", docLabel: "Dynatrace documentation" },
  f8: { action: "Right-size hosts with low CPU usage; wasted energy comes from capacity that stays idle.", docUrl: "https://docs.dynatrace.com/docs", docLabel: "Dynatrace documentation" },
};

/** The catalog's own actions, kept so an override can be undone. */
const DEFAULTS: Record<string, RemediationAction> = { ...CRITERION_ACTIONS };

/** The catalog's own action for a criterion, whatever override is active. */
export const defaultAction = (id: string): RemediationAction | undefined => DEFAULTS[id];
