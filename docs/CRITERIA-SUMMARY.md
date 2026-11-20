# Criteria summary

Every criterion the assessment reads: 143 criteria across 11 capabilities. This file is generated from the catalog (`ui/app/queries.ts`, `ui/app/data/criterionTiers.ts`, `ui/app/passLine.ts`); regenerate it when the catalog changes rather than editing it by hand.

## How to read the tables

| Column | Meaning |
|---|---|
| Tier | Foundation, Best practice or Excellence. Utilization weighs them 60 / 25 / 15 and gates them (see `SCORING-CALCULATIONS.md`) |
| Reading | **Share**: a numerator over a denominator, as a percentage. **Share of N**: a count over a fixed number. **Presence**: is there at least one. **Configuration count**: read from the settings API or the SLO service, with no Grail scan |
| Met at | The value the criterion must reach. For a share with three targets it is the middle one |

A criterion that cannot be measured in the environment is not assessed: it leaves the score and is never counted as not met.

Readings by kind: 106 shares, 32 presence checks, 5 configuration counts.

## Capabilities

| Capability | Criteria | Foundation | Best practice | Excellence |
|---|---|---|---|---|
| Infrastructure Observability | 26 | 3 | 13 | 10 |
| Application Observability | 15 | 3 | 6 | 6 |
| Digital Experience | 15 | 3 | 7 | 5 |
| Log Analytics | 16 | 3 | 9 | 4 |
| Application Security | 7 | 1 | 5 | 1 |
| Threat Observability | 4 | 1 | 2 | 1 |
| AI/LLM Observability | 16 | 3 | 5 | 8 |
| Business Observability | 10 | 3 | 4 | 3 |
| Software Delivery | 6 | 1 | 2 | 3 |
| Platform Governance | 18 | 1 | 13 | 4 |
| FinOps & Sustainability | 10 | 3 | 4 | 3 |
| **Total** | **143** | **25** | **70** | **48** |

## Infrastructure Observability

| Criterion | Tier | Reading | Met at | What it measures |
|---|---|---|---|---|
| Host CPU coverage | Foundation | Share | 50% | Percentage of monitored hosts with active CPU usage metrics from any source (OneAgent, OTel, cloud integration). |
| Host memory coverage | Foundation | Share | 50% | Percentage of monitored hosts with active memory usage metrics. |
| Host availability coverage | Foundation | Share | 50% | Percentage of monitored hosts with availability metrics — basis for SLA reporting. |
| Host disk coverage | Best practice | Share | 50% | Percentage of monitored hosts with active disk utilization metrics. |
| Host network coverage | Best practice | Share | 50% | Percentage of monitored hosts with network interface entities. |
| Process CPU coverage | Best practice | Share | 30% | Percentage of process groups with active CPU usage metrics. |
| Davis problem coverage | Best practice | Share | 10% | Percentage of hosts covered by Davis AI problem detection. |
| Host-process topology | Best practice | Share | 60% | Percentage of hosts with detected process groups — validates entity relationship discovery. |
| Cloud host log enrichment | Best practice | Share | 50% | Percentage of hosts with cloud provider context in log data — validates cloud integration feeding host-level metadata. |
| Cloud log enrichment | Best practice | Share of 100 | 20% | Percentage of log records enriched with cloud provider metadata. |
| Cloud account enrichment | Best practice | Share | 40% | Percentage of cloud-enriched logs with account ID metadata — validates multi-account cloud governance. |
| K8s node monitoring depth | Best practice | Share | 50% | Ratio of K8s nodes to clusters — validates node-level cloud compute monitoring. |
| Cloud namespace metric coverage | Best practice | Share | 50% | Percentage of K8s namespaces with active container metrics — validates cloud workload observability. |
| Container restart monitoring | Best practice | Share | 50% | Percentage of K8s namespaces with container restart tracking — critical for detecting CrashLoopBackOff and OOM issues. |
| Problems with root cause | Best practice | Share | 50% | Share of Davis problems on infrastructure entities (hosts, processes, Kubernetes, cloud, custom devices) in the last 72h where Davis identified a root-cause entity. |
| Assist, MCP and dtctl usage | Best practice | Presence | At least 1 | People who read metrics and topology through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days. |
| K8s cluster coverage | Excellence | Share | 50% | Percentage of Kubernetes clusters with active workload monitoring. |
| Host disk entity coverage | Excellence | Share | 50% | Percentage of hosts with disk entities detected. |
| Cloud workload coverage | Excellence | Share | 50% | Percentage of K8s namespaces with running cloud-native workloads. |
| K8s workload mapping | Excellence | Share | 50% | Percentage of Kubernetes clusters with at least one detected cloud application namespace — validates workload topology. |
| Cloud region enrichment | Excellence | Share | 40% | Percentage of cloud-enriched logs that also contain region metadata — validates multi-region observability depth. |
| Cloud AZ enrichment | Excellence | Share | 40% | Percentage of cloud-enriched logs with availability zone metadata — validates resilience observability across failure domains. |
| Cloud span enrichment | Excellence | Share | 20% | Percentage of services with cloud provider context in span data. |
| Container resource limits | Excellence | Share | 50% | Percentage of K8s namespaces with defined resource limits — essential for cluster stability and resource governance. |
| Problems with automated response | Excellence | Share | 30% | Share of Davis problems on infrastructure entities (hosts, processes, Kubernetes, cloud, custom devices) in the last 72h that triggered at least one workflow execution. |
| Infrastructure automation workflows | Excellence | Presence | At least 1 | Workflows that ran a cloud, Kubernetes or configuration-management action (AWS, Azure, GCP, Kubernetes, Ansible connectors) in the last 24h. |

## Application Observability

| Criterion | Tier | Reading | Met at | What it measures |
|---|---|---|---|---|
| Service tracing coverage | Foundation | Share | 50% | Percentage of detected services with active span data in the last 2h (OneAgent or OTel). |
| Root span coverage | Foundation | Share | 40% | Percentage of services with root spans (incoming requests) in the last 2h. |
| Response time coverage | Foundation | Share | 50% | Percentage of services with response time metrics (p95). |
| Service method coverage | Best practice | Share | 30% | Percentage of services with method-level tracing. |
| Failure tracking coverage | Best practice | Share | 40% | Percentage of services with failure rate metrics. |
| Throughput coverage | Best practice | Share | 50% | Percentage of services with request count/throughput metrics. |
| Service-process mapping | Best practice | Share | 50% | Percentage of services with associated process groups — validates service-to-infrastructure topology. |
| Problems with root cause | Best practice | Share | 50% | Share of Davis problems on services and queues in the last 72h where Davis identified a root-cause entity. |
| Assist, MCP and dtctl usage | Best practice | Presence | At least 1 | People who read traces through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days. |
| OTel instrumentation coverage | Excellence | Share | 20% | Percentage of services with OpenTelemetry spans — vendor-neutral instrumentation adoption. |
| Database span coverage | Excellence | Share | 10% | Percentage of services with database operation spans. |
| Messaging span coverage | Excellence | Share | 5% | Percentage of services with messaging spans (Kafka, RabbitMQ, SQS). |
| Multi-service trace depth | Excellence | Share | 10% | Percentage of traces spanning 2+ services — validates distributed tracing depth. |
| Database call depth | Excellence | Share | 10% | Percentage of DB-using services that interact with 2+ database systems — validates deep database monitoring across the stack. |
| Problems with automated response | Excellence | Share | 30% | Share of Davis problems on services and queues in the last 72h that triggered at least one workflow execution. |

## Digital Experience

| Criterion | Tier | Reading | Met at | What it measures |
|---|---|---|---|---|
| RUM action coverage | Foundation | Share | 50% | Percentage of web applications with active user action metrics. |
| Session tracking coverage | Foundation | Share | 50% | Percentage of web applications with active session tracking. |
| LCP coverage | Foundation | Share | 50% | Percentage of web applications with Largest Contentful Paint metrics — Core Web Vital. |
| INP coverage | Best practice | Share | 50% | Percentage of web applications with Interaction to Next Paint metrics — Core Web Vital. |
| CLS coverage | Best practice | Share | 50% | Percentage of web applications with Cumulative Layout Shift metrics — Core Web Vital. |
| Frontend error coverage | Best practice | Share | 40% | Percentage of web applications with error tracking enabled. |
| Synthetic HTTP coverage | Best practice | Share | 50% | Percentage of web applications covered by HTTP synthetic monitors. |
| Synthetic availability coverage | Best practice | Share | 50% | Ratio of synthetic monitors to web applications — validates proactive availability monitoring. |
| Problems with root cause | Best practice | Share | 50% | Share of Davis problems on web and mobile applications and synthetic monitors in the last 72h where Davis identified a root-cause entity. |
| Assist, MCP and dtctl usage | Best practice | Presence | At least 1 | People who read user sessions and events through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days. |
| Synthetic browser coverage | Excellence | Share | 50% | Percentage of web applications covered by browser-based synthetic tests. |
| Mobile app coverage | Excellence | Share | 10% | Percentage of total applications that have mobile monitoring. |
| Synthetic location diversity | Excellence | Share | 50% | Ratio of synthetic locations to total synthetic monitors. |
| Problems with automated response | Excellence | Share | 30% | Share of Davis problems on web and mobile applications and synthetic monitors in the last 72h that triggered at least one workflow execution. |
| Synthetic checks run by workflows | Excellence | Presence | At least 1 | Workflows that ran an on-demand synthetic execution in the last 24h. |

## Log Analytics

| Criterion | Tier | Reading | Met at | What it measures |
|---|---|---|---|---|
| Host log coverage | Foundation | Share | 50% | Percentage of hosts sending log data in the last 2h. |
| Service log coverage | Foundation | Share | 30% | Percentage of services with associated log data. |
| Log source diversity | Foundation | Share | 50% | Ratio of distinct log sources to total hosts — validates breadth of log ingestion across infrastructure. |
| Trace-correlated logs | Best practice | Share of 100 | 10% | Percentage of log records enriched with trace_id. |
| Entity-enriched logs | Best practice | Share of 100 | 30% | Percentage of log records enriched with host entity context. |
| Error log coverage | Best practice | Share | 10% | Percentage of services whose logs include ERROR-level entries. |
| Log severity diversity | Best practice | Share of 5 | 60% | Percentage of severity levels being ingested (out of 5: ERROR, WARN, INFO, DEBUG, TRACE). |
| Structured logging | Best practice | Share | 20% | Percentage of logs containing structured JSON content for better parsing and analysis. |
| Multi-source host logging | Best practice | Share | 20% | Percentage of hosts receiving logs from 2+ distinct sources — indicates balanced log distribution. |
| Custom device log enrichment | Best practice | Share of 100 | 10% | Percentage of logs enriched with custom device entities for extended context. |
| Assist, MCP and dtctl usage | Best practice | Presence | At least 1 | People who read logs through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days. |
| Custom log pipelines configured | Best practice | Configuration count | At least 1 | Log pipelines the team configured in OpenPipeline to filter, mask, enrich or route logs before they are stored. Read from settings, which scans no data. |
| Process group log correlation | Excellence | Share of 100 | 10% | Percentage of log records enriched with process group context. |
| K8s log coverage | Excellence | Share | 50% | Percentage of K8s namespaces with log data. |
| Span-correlated logs | Excellence | Share of 100 | 10% | Percentage of logs enriched with span_id for granular trace-to-log linking (deeper than trace_id alone). |
| Log-based events | Excellence | Presence | At least 1 | Presence of events generated from log data — indicates established log-based alerting. |

## Application Security

| Criterion | Tier | Reading | Met at | What it measures |
|---|---|---|---|---|
| Runtime Vulnerability Analytics active | Foundation | Presence | At least 1 | Vulnerability state reports from Runtime Vulnerability Analytics in the last 2 hours. |
| Runtime vulnerability coverage | Best practice | Share | 10% | Share of process groups assessed by Runtime Vulnerability Analytics in the last 2 hours. |
| Runtime Application Protection | Best practice | Presence | At least 1 | Attack detections from Runtime Application Protection in the last 24 hours. |
| Security Posture Management | Best practice | Presence | At least 1 | Compliance findings from Security Posture Management in the last 2 hours. |
| Assist, MCP and dtctl usage | Best practice | Presence | At least 1 | People who read security findings through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days. |
| Vulnerabilities with Davis assessment | Best practice | Share | 50% | Share of open critical and high vulnerabilities for which Davis assessed whether data assets are reachable, in the last 2 hours. With that context a vulnerability is prioritized by real risk, not by severity alone. |
| Third-party security findings | Excellence | Presence | At least 1 | External security tools (scanners, registries, cloud security) sending vulnerability findings to Dynatrace in the last 24 hours. |

## Threat Observability

| Criterion | Tier | Reading | Met at | What it measures |
|---|---|---|---|---|
| Detection findings | Foundation | Presence | At least 1 | Threat detections reaching Dynatrace in the last 24 hours, from any source. |
| External detection sources | Best practice | Presence | At least 1 | Security products other than Dynatrace sending detections (for example cloud threat detection or endpoint protection) in the last 24 hours. |
| Assist, MCP and dtctl usage | Best practice | Presence | At least 1 | People who read security findings through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days. |
| Security automation workflows | Excellence | Presence | At least 1 | Workflows that ran a security action (for example enriching an observable during an investigation) in the last 24h. |

## AI/LLM Observability

| Criterion | Tier | Reading | Met at | What it measures |
|---|---|---|---|---|
| AI span service coverage | Foundation | Share | 5% | Percentage of services with AI/LLM spans. |
| Token tracking coverage | Foundation | Share | 50% | Percentage of AI spans with token usage tracking. |
| AI error tracking coverage | Foundation | Share | 1% | Percentage of AI spans with error status tracking. |
| Response model recorded | Best practice | Share | 50% | Percentage of AI spans that record the model that actually answered, so a change of model version can be traced. |
| AI provider diversity | Best practice | Share of 5 | 40% | Percentage of known AI providers detected vs expected (out of 5). |
| Agent invocation coverage | Best practice | Share | 10% | Percentage of AI spans with agent invocation tracing. |
| Agent tool-call tracing | Best practice | Presence | At least 1 | Presence of agent tool executions in AI spans (gen_ai.operation.name = execute_tool) in the last 72h. |
| Problems with root cause | Best practice | Share | 50% | Share of Davis problems on services that call an LLM in the last 72h where Davis identified a root-cause entity. |
| Prompt/response tracing coverage | Excellence | Share | 50% | Percentage of AI spans with prompt or response tracing. |
| Guardrail coverage | Excellence | Share | 20% | Percentage of AI spans with guardrail monitoring. |
| Cost tracking coverage | Excellence | Share | 20% | Percentage of AI spans carrying token counts and the model, which the AI Observability app needs to calculate cost. |
| AI tracing service breadth | Excellence | Share | 5% | Percentage of total spans that are AI-related. |
| Agentic AI in use | Excellence | Presence | At least 1 | Agentic Dynatrace Assist sessions in the last 30 days (GENAI_EVENT with skill = operator). |
| dtctl driven by AI agents | Excellence | Presence | At least 1 | People whose AI coding agent (for example Claude Code) ran dtctl in the last 30 days. |
| Agentic workflows | Excellence | Presence | At least 1 | Workflows that consumed AI Units in the last 30 days, such as the SRE Agent running on a problem trigger. |
| Problems with automated response | Excellence | Share | 30% | Share of Davis problems on services that call an LLM in the last 72h that triggered at least one workflow execution. |

## Business Observability

| Criterion | Tier | Reading | Met at | What it measures |
|---|---|---|---|---|
| Service bizevent coverage | Foundation | Share | 10% | Percentage of services with associated business events. |
| Bizevent type diversity | Foundation | Share of 10 | 60% | Percentage of expected business event types detected (out of 10 baseline types). |
| Events with service context | Foundation | Share | 20% | Percentage of business events linked to services. |
| Bizevent provider diversity | Best practice | Share of 5 | 60% | Percentage of expected business event providers detected (out of 5 baseline providers). |
| Revenue data coverage | Best practice | Share | 10% | Percentage of business events with revenue/monetary value. |
| Problems with root cause | Best practice | Share | 50% | Share of Davis problems on services that emit business events in the last 72h where Davis identified a root-cause entity. |
| Assist, MCP and dtctl usage | Best practice | Presence | At least 1 | People who read business events through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days. |
| Session-linked events | Excellence | Share | 10% | Percentage of business events linked to RUM sessions. |
| Trace-linked events | Excellence | Share | 10% | Percentage of business events correlated with distributed traces. |
| Problems with automated response | Excellence | Share | 30% | Share of Davis problems on services that emit business events in the last 72h that triggered at least one workflow execution. |

## Software Delivery

| Criterion | Tier | Reading | Met at | What it measures |
|---|---|---|---|---|
| CI/CD deployment events | Foundation | Presence | At least 1 | Deployment events from CI/CD pipelines in the last 24h (SDLC_EVENT whose type names a deployment). |
| Service deployment coverage | Best practice | Share | 30% | Percentage of services with a deployment marker (CUSTOM_DEPLOYMENT) in the last 24h. |
| Problems with root cause | Best practice | Share | 50% | Share of Davis problems on entities that received a deployment in the last 72h where Davis identified a root-cause entity. |
| Problems with automated response | Excellence | Share | 30% | Share of Davis problems on entities that received a deployment in the last 72h that triggered at least one workflow execution. |
| Release validation (Site Reliability Guardian) | Excellence | Presence | At least 1 | Site Reliability Guardian validations finished in the last 24h (business event guardian.validation.finished). |
| Pipeline integration workflows | Excellence | Presence | At least 1 | Workflows that ran a source-control or CI/CD action (GitHub, GitLab, Jenkins, Azure DevOps connectors) in the last 24h. |

## Platform Governance

| Criterion | Tier | Reading | Met at | What it measures |
|---|---|---|---|---|
| OneAgent version currency | Foundation | Share | 80% | Percentage of hosts whose OneAgent was built in the last 12 months (build date read from the installed version). |
| Logs with security context | Best practice | Share of 100 | 50% | Percentage of log records that carry dt.security_context, the field record-level access policies filter on. Read from fieldsSnapshot, which scans no raw data. |
| Workflow execution success | Best practice | Share | 90% | Percentage of finished workflow executions in the last 24h that ended in success. |
| ITSM or chat integration in workflows | Best practice | Presence | At least 1 | Workflows that ran a ServiceNow, Jira, Slack, Microsoft Teams, PagerDuty or email action in the last 24h. |
| Dedicated log buckets | Best practice | Share of 2 | 100% | Number of distinct Grail buckets holding log data (expected &gt;= 2 for proper segregation). Read from fieldsSnapshot, which scans no raw data. |
| Ownership assignment | Best practice | Share | 50% | Percentage of services with assigned ownership tags — validates team responsibility mapping for incident response. |
| Service tagging utilization | Best practice | Share | 20% | Percentage of services with at least one tag assigned — tags enable release tracking, ownership, and filtering. |
| Assist, MCP and dtctl usage | Best practice | Presence | At least 1 | People who read platform usage, audit and billing events through Dynatrace Assist, an MCP client or the dtctl CLI in the last 30 days. |
| SLOs defined | Best practice | Configuration count | At least 1 | Service-level objectives configured in the environment, classic and from the Service-Level Objectives app. Read from configuration, which scans no data. |
| Adaptive or seasonal baselines in alerts | Best practice | Presence | At least 1 | Alerts evaluated in the last 7 days with an auto-adaptive or seasonal baseline instead of a fixed threshold. |
| Sensitive data masking in logs | Best practice | Configuration count | At least 1 | Log masking rules that are switched on. The rules that ship with the platform come switched off, so only active ones count. Read from settings, which scans no data. |
| Span attribute masking | Best practice | Configuration count | At least 1 | Attribute masking rules that are switched on for traces. Read from settings, which scans no data. |
| RUM privacy masking | Best practice | Share | 50% | Share of web applications where RUM masks personal data in URLs or the names of user actions. Read from settings, which scans no data. |
| Custom buckets with their own retention | Best practice | Presence | At least 1 | Grail buckets the team created, each with the retention it chose, instead of keeping everything in the default buckets. Read from the bucket list, which scans no data. |
| Human approval in workflows | Excellence | Presence | At least 1 | Workflows that ran an approval task in the last 7 days, so a person confirms before a consequential action. |
| Custom anomaly detectors configured | Excellence | Configuration count | At least 1 | Anomaly detectors the team created on its own metrics and queries. Read from settings, which scans no data. |
| Session Replay recorded with masking | Excellence | Share | 50% | Share of web applications whose Session Replay recording uses a masking preset instead of recording everything visible. Read from settings, which scans no data. |
| Audit trail consulted | Excellence | Presence | At least 1 | People who queried the platform's audit events in the last 30 days. Audit events are always recorded; this counts whether anyone looks at them. |

## FinOps & Sustainability

| Criterion | Tier | Reading | Met at | What it measures |
|---|---|---|---|---|
| Cost and carbon calculation running | Foundation | Presence | At least 1 | Workflows that ran the Cost & Carbon Optimization calculation in the last 24h. |
| Hosts with carbon measurement | Foundation | Share | 80% | Percentage of hosts with an energy and carbon measurement from Cost & Carbon Optimization in the last 6h. |
| Cloud spend ingested | Foundation | Presence | At least 1 | Cloud providers whose billing data (FOCUS format) was imported into Cost & Carbon Optimization in the last 30 hours (the import runs once a day). |
| Cloud spend with an owner | Best practice | Share | 80% | Share of the imported cloud cost whose billing tags name an owner or a cost center. |
| Kubernetes namespaces with carbon measurement | Best practice | Share | 50% | Percentage of Kubernetes namespaces with an energy and carbon measurement in the last 6h. |
| Hosts in active use | Best practice | Share | 80% | Percentage of measured hosts whose average CPU usage in the last 6h is at or above 3%, the idle threshold Cost & Carbon Optimization applies. |
| Host monitoring cost allocated | Best practice | Share | 50% | Percentage of host monitoring billing records in the last 24h that carry a cost center (dt.cost.costcenter). |
| Spend under commitment discount | Excellence | Share | 30% | Share of the imported cloud cost covered by a commitment discount (savings plan or reserved capacity). |
| Energy in productive use | Excellence | Share | 50% | Share of the energy measured on hosts in the last 6h that was not classified as wasted (idle CPU and its overhead). |
| Business events with a cost center | Excellence | Share | 5% | Percentage of business events with cost center or product data. |
