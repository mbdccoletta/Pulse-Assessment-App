/** Internationalisation strings for the First Day Results PDF report. */

export type ReportLang = "en" | "pt" | "es";

export interface ReportStrings {
  // Cover
  platformLabel: string;
  coverTitle: string;
  coverSubtitle: (tenant: string, date: string) => string;
  coverageScore: string;
  entitiesDiscovered: string;
  autoMapped: string;
  criteriaPassing: string;
  passRate: (pct: number) => string;
  coverFooter: string;
  coverStats: (caps: number, passed: number, total: number, records: string) => string;

  // Entity categories
  catInfra: string;
  catK8s: string;
  catApps: string;
  catData: string;
  catSecurity: string;
  // Entity box labels
  hosts: string;
  processes: string;
  networkInterfaces: string;
  disks: string;
  clusters: string;
  namespaces: string;
  nodes: string;
  services: string;
  serviceMethods: string;
  webApps: string;
  mobileApps: string;
  logRecords: string;
  tracesSpans: string;
  events: string;
  bizEvents: string;
  cloudLogs: string;
  aiSpans: string;
  vulnerabilities: string;
  dtIntelligence: string;
  syntheticTests: string;
  httpMonitors: string;

  // Radar page
  coverageOverview: string;
  radarSubtitle: (active: number, total: number, passed: number, totalCrit: number, records: string) => string;

  // Before vs After
  beforeAfterTitle: string;
  beforeAfterIntro: (entities: string, activeCaps: number) => string;
  colArea: string;
  colBefore: string;
  colAfter: string;
  colImpact: string;
  // ROI items
  roiMttr: string; roiMttrBefore: string; roiMttrAfter: string; roiMttrImpact: string;
  roiRca: string; roiRcaBefore: string; roiRcaAfter: (svc: string) => string; roiRcaImpact: string;
  roiInfra: string; roiInfraBefore: string; roiInfraAfter: (hosts: string) => string; roiInfraImpact: (cov: number) => string;
  roiUx: string; roiUxBefore: string; roiUxAfter: (apps: string) => string; roiUxImpact: string;
  roiTracing: string; roiTracingBefore: string; roiTracingAfter: (spans: string) => string; roiTracingImpact: string;
  roiLogs: string; roiLogsBefore: string; roiLogsAfter: (logs: string) => string; roiLogsImpact: string;
  roiSecurity: string; roiSecurityBefore: string; roiSecurityAfter: (evts: string) => string; roiSecurityImpact: string;
  roiK8s: string; roiK8sBefore: string; roiK8sAfter: (clusters: string, nodes: string) => string; roiK8sImpact: string;
  roiAi: string; roiAiBefore: string; roiAiAfter: (spans: string) => string; roiAiImpact: string;

  // Key insight
  keyInsight: string;
  insightStrong: (strong: number, names: string, gaps: number, zeros: number) => string;
  insightNoStrong: (active: number, top3: string) => string;

  // Why Dynatrace
  whyDynatraceTitle: string;
  diffDavisTitle: string; diffDavisBrief: (entities: string) => string;
  diffSmartscapeTitle: string; diffSmartscapeBrief: (hosts: string, svc: string) => string;
  diffGrailTitle: string; diffGrailBrief: (records: string) => string;
  diffOneAgentTitle: string; diffOneAgentBrief: string;
  diffOpenPipelineTitle: string; diffOpenPipelineBrief: string;
  diffSecurityTitle: string; diffSecurityBrief: (evts: string) => string;
  diffSecurityBriefDefault: string;

  // Discovery page
  discoveryTitle: string;
  discoveryIntro: string;
  criteria: string;
  activeSummary: (active: number, total: number, passed: number, totalCrit: number) => string;

  // Discovery items per capability
  discInfraHosts: (h: string, p: string) => string;
  discInfraNet: (n: string) => string;
  discInfraDisks: (d: string) => string;
  discInfraK8s: (c: string, n: string, ns: string) => string;
  discInfraProblems: (p: string) => string;
  discAppServices: (s: string) => string;
  discAppMethods: (m: string) => string;
  discAppSpans: (s: string) => string;
  discDxWeb: (a: string) => string;
  discDxMobile: (m: string) => string;
  discDxSynthetic: (s: string) => string;
  discDxHttp: (h: string) => string;
  discLogs: (l: string) => string;
  discCloudLogs: (c: string) => string;
  discSecEvents: (s: string) => string;
  discThreatEvents: (s: string) => string;
  discAiSpans: (a: string) => string;
  discBizEvents: (b: string) => string;
  discEvents: (e: string) => string;

  // Teams
  impactByTeam: string;
  teamSre: string; teamSreBaseline: string;
  teamDevOps: string; teamDevOpsBaseline: string;
  teamSecurity: string; teamSecurityBaseline: string;
  teamBusiness: string; teamBusinessBaseline: string;
  teamAi: string; teamAiBaseline: string;

  // Opportunities
  opportunities: string;

  // Unified Platform Value (consolidation)
  unifiedPlatformTitle: string;
  unifiedPlatformIntro: (consolCaps: number) => string;
  unifiedBenefit1Title: string; unifiedBenefit1: string;
  unifiedBenefit2Title: string; unifiedBenefit2: string;
  unifiedBenefit3Title: string; unifiedBenefit3: string;
  unifiedBenefit4Title: string; unifiedBenefit4: string;
  unifiedBenefit5Title: string; unifiedBenefit5: string;
  unifiedCallToAction: string;
  // Cost & ROI arguments
  consolPageTitle: string;
  consolTableSubtitle: string;
  costReductionTitle: string;
  costReductionItems: string[];
  roiConsolTitle: string;
  roiConsolItems: string[];
  riskTitle: string;
  riskItems: string[];
  migrationPathTitle: string;
  migrationPathItems: string[];

  // Footer
  footer: (tenant: string, date: string) => string;
  page: (i: number, total: number) => string;

  // Button labels
  btnLabel: string;
  btnEn: string;
  btnPt: string;
}

export const REPORT_EN: ReportStrings = {
  platformLabel: "DYNATRACE PLATFORM",
  coverTitle: "Day 1 — What We Found",
  coverSubtitle: (tenant, date) => `${tenant}  |  ${date}  |  Platform Assessment Report`,
  coverageScore: "COVERAGE SCORE",
  entitiesDiscovered: "ENTITIES DISCOVERED",
  autoMapped: "Auto-mapped in real time",
  criteriaPassing: "CRITERIA PASSING",
  passRate: (pct) => `${pct}% pass rate`,
  coverFooter: "Discovered automatically via Smartscape topology and OneAgent  --  zero manual configuration.",
  coverStats: (caps, passed, total, records) => `${caps} Capabilities  |  ${passed}/${total} Criteria  |  ${records} Records Analyzed`,

  catInfra: "INFRASTRUCTURE", catK8s: "KUBERNETES", catApps: "APPLICATIONS",
  catData: "DATA & TELEMETRY", catSecurity: "SECURITY & MONITORING",
  hosts: "Hosts / Servers", processes: "Processes", networkInterfaces: "Network Interfaces",
  disks: "Disks", clusters: "Clusters", namespaces: "Namespaces", nodes: "Nodes",
  services: "Services", serviceMethods: "Service Methods", webApps: "Web Apps",
  mobileApps: "Mobile Apps", logRecords: "Log Records", tracesSpans: "Traces / Spans",
  events: "Events", bizEvents: "Biz Events", cloudLogs: "Cloud Logs",
  aiSpans: "AI/GenAI Spans", vulnerabilities: "Vulnerabilities",
  dtIntelligence: "DT Intelligence", syntheticTests: "Synthetic Tests", httpMonitors: "HTTP Monitors",

  coverageOverview: "Coverage Overview",
  radarSubtitle: (active, total, passed, totalCrit, records) =>
    `${active} of ${total} capabilities active  |  ${passed}/${totalCrit} criteria passing  |  ${records} records analyzed`,

  beforeAfterTitle: "Before vs. After Dynatrace",
  beforeAfterIntro: (entities, activeCaps) =>
    `This section compares your operational reality before Dynatrace with the capabilities now available after Day 1 deployment. Every metric below is derived from real data discovered in your environment  --  ${entities} entities across ${activeCaps} active solutions, unified in Grail and analyzed by Dynatrace Intelligence.`,
  colArea: "OPERATIONAL AREA", colBefore: "BEFORE", colAfter: "WITH DYNATRACE", colImpact: "IMPACT",
  roiMttr: "Incident Resolution (MTTR)", roiMttrBefore: "4-8 hours average", roiMttrAfter: "< 15 minutes with root cause", roiMttrImpact: "95% faster",
  roiRca: "Root Cause Analysis", roiRcaBefore: "Manual war rooms, guesswork", roiRcaAfter: (svc) => `Automatic across ${svc} services`, roiRcaImpact: "Zero manual effort",
  roiInfra: "Infrastructure Visibility", roiInfraBefore: "Partial coverage, blind spots", roiInfraAfter: (hosts) => `${hosts} hosts fully monitored`, roiInfraImpact: (cov) => `${cov}% coverage`,
  roiUx: "End-User Experience", roiUxBefore: "No real user data", roiUxAfter: (apps) => `${apps} apps with RUM`, roiUxImpact: "Full UX visibility",
  roiTracing: "Distributed Tracing", roiTracingBefore: "No trace correlation", roiTracingAfter: (spans) => `${spans} traces captured E2E`, roiTracingImpact: "Full request flow",
  roiLogs: "Log Management", roiLogsBefore: "Grep / manual search", roiLogsAfter: (logs) => `${logs} logs indexed + correlated`, roiLogsImpact: "Instant search",
  roiSecurity: "Security Posture", roiSecurityBefore: "CI-only vulnerability scans", roiSecurityAfter: (evts) => `${evts} runtime security events`, roiSecurityImpact: "Production-aware",
  roiK8s: "Kubernetes Operations", roiK8sBefore: "kubectl + manual dashboards", roiK8sAfter: (clusters, nodes) => `${clusters} clusters, ${nodes} nodes monitored`, roiK8sImpact: "Unified K8s view",
  roiAi: "AI/LLM Governance", roiAiBefore: "No AI call visibility", roiAiAfter: (spans) => `${spans} AI spans tracked`, roiAiImpact: "Cost + quality",

  keyInsight: "KEY INSIGHT",
  insightStrong: (strong, names, gaps, zeros) => {
    let t = `${strong} capabilities already above 60% coverage (${names}).`;
    t += gaps > 0 ? ` ${gaps} capabilities need attention to reach full potential.` : " All active capabilities show strong adoption.";
    if (zeros > 0) t += ` ${zeros} capabilities not yet activated — each represents untapped value.`;
    return t;
  },
  insightNoStrong: (active, top3) =>
    `${active} capabilities are active from Day 1. Focus on increasing coverage in ${top3} for the biggest operational improvement.`,

  whyDynatraceTitle: "Why Dynatrace -- Different by Design",
  diffDavisTitle: "Dynatrace Intelligence", diffDavisBrief: (entities) => `Agentic AI  --  causal root cause across ${entities} entities, zero rule-writing`,
  diffSmartscapeTitle: "Smartscape", diffSmartscapeBrief: (hosts, svc) => `Real-time topology  --  ${hosts} hosts, ${svc} services auto-mapped`,
  diffGrailTitle: "Grail", diffGrailBrief: (records) => `Causal data lakehouse with MPP  --  ${records} records unified`,
  diffOneAgentTitle: "OneAgent", diffOneAgentBrief: "Single deployment  --  infra, APM, RUM, logs, security in one agent",
  diffOpenPipelineTitle: "OpenPipeline", diffOpenPipelineBrief: "Stream processing  --  ingest, enrich, contextualize any data source",
  diffSecurityTitle: "Application Security", diffSecurityBrief: (evts) => `Runtime protection  --  ${evts} events`,
  diffSecurityBriefDefault: "CVEs prioritized by production exposure",

  discoveryTitle: "What Dynatrace Discovered — Day 1",
  discoveryIntro: "Dynatrace automatically discovered and mapped your environment using Smartscape topology and OneAgent -- zero manual configuration. All data unified in Grail and analyzed by Dynatrace Intelligence.",
  criteria: "criteria",
  activeSummary: (active, total, passed, totalCrit) => `${active} of ${total} capabilities active  |  ${passed}/${totalCrit} criteria passing`,

  discInfraHosts: (h, p) => `${h} hosts monitored with ${p} running processes`,
  discInfraNet: (n) => `${n} network interfaces with traffic analysis`,
  discInfraDisks: (d) => `${d} disk volumes tracked for capacity and I/O`,
  discInfraK8s: (c, n, ns) => `${c} K8s clusters, ${n} nodes, ${ns} namespaces`,
  discInfraProblems: (p) => `${p} Dynatrace Intelligence problems auto-detected`,
  discAppServices: (s) => `${s} services traced end-to-end`,
  discAppMethods: (m) => `${m} service methods instrumented at code level`,
  discAppSpans: (s) => `${s} distributed traces captured`,
  discDxWeb: (a) => `${a} web apps monitored with Real User Monitoring`,
  discDxMobile: (m) => `${m} mobile apps instrumented`,
  discDxSynthetic: (s) => `${s} synthetic monitors validating availability 24/7`,
  discDxHttp: (h) => `${h} HTTP monitors checking endpoint health`,
  discLogs: (l) => `${l} log records ingested and searchable`,
  discCloudLogs: (c) => `${c} cloud-enriched logs with provider metadata`,
  discSecEvents: (s) => `${s} security events for vulnerability analysis`,
  discThreatEvents: (s) => `${s} security events for threat detection`,
  discAiSpans: (a) => `${a} AI/GenAI spans tracked (LLM calls, token usage)`,
  discBizEvents: (b) => `${b} business events captured for KPI tracking`,
  discEvents: (e) => `${e} events correlated for business impact`,

  impactByTeam: "Impact by Team",
  teamSre: "SRE & Platform Engineering",
  teamSreBaseline: "Agentic AI reduces MTTR from hours to minutes -- trusted answers, not guesses.",
  teamDevOps: "DevOps & Engineering",
  teamDevOpsBaseline: "PurePath tracing, CI/CD quality gates, OpenTelemetry-native.",
  teamSecurity: "Security & Compliance",
  teamSecurityBaseline: "Runtime vulnerability detection with full observability context.",
  teamBusiness: "Business & Product",
  teamBusinessBaseline: "Real user sessions + business KPIs via BizEvents.",
  teamAi: "AI / ML Engineering",
  teamAiBaseline: "LLM monitoring, token usage, response quality tracking.",

  opportunities: "Opportunities for Growth",

  unifiedPlatformTitle: "Why Consolidating Into a Single Platform Matters",
  unifiedPlatformIntro: (consolCaps) =>
    `This assessment identified ${consolCaps} capabilities where observability data is split across multiple tools. Consolidating all telemetry into Dynatrace Grail -- the causal data lakehouse -- unlocks capabilities that are impossible when data lives in silos.`,
  unifiedBenefit1Title: "End-to-End Context",
  unifiedBenefit1: "When logs, metrics, traces, and events live in the same lakehouse, Dynatrace Intelligence can correlate them automatically. A slow API response is traced from the user click, through the service call, to the database query, to the infrastructure bottleneck -- in seconds, not hours of manual cross-tool investigation.",
  unifiedBenefit2Title: "Causal AI (Dynatrace Intelligence)",
  unifiedBenefit2: "Dynatrace Intelligence requires full-stack data to determine root cause. With partial data, it can only detect problems -- not explain them. Every data source added to Grail exponentially increases the accuracy and speed of root cause analysis.",
  unifiedBenefit3Title: "Topology-Aware Analytics",
  unifiedBenefit3: "Smartscape maps every dependency in real time. Logs from a competitor tool cannot be linked to the service topology, the deployment version, or the affected users. Inside Dynatrace, every log line is automatically enriched with entity context, making queries like 'show me errors for users on this release in this region' trivial.",
  unifiedBenefit4Title: "Operational Efficiency",
  unifiedBenefit4: "Multiple tools mean multiple UIs, query languages, alert configurations, and vendor contracts. A unified platform eliminates context switching, reduces training costs, and provides a single source of truth for all teams -- SRE, DevOps, Security, and Business.",
  unifiedBenefit5Title: "OpenPipeline Flexibility",
  unifiedBenefit5: "Dynatrace OpenPipeline can ingest data from any source -- including existing tools -- and enrich it with full Dynatrace context. Migration can be incremental: start routing data through OpenPipeline to Grail while maintaining existing workflows, then sunset redundant tools as confidence grows.",
  unifiedCallToAction: "Recommendation: Prioritize routing all observability data into Grail. Each additional data source strengthens Dynatrace Intelligence accuracy, Smartscape topology, and the overall value of the platform. The gap between current adjusted scores and full DT scores represents the untapped potential of a unified observability strategy.",
  consolPageTitle: "Consolidation Opportunity",
  consolTableSubtitle: "Scores adjusted by the estimated percentage of observability data already in Dynatrace.",
  costReductionTitle: "Cost Reduction with Tool Consolidation",
  costReductionItems: [
    "Eliminate redundant licensing fees: Each additional monitoring tool carries its own license, ingestion, and storage costs. Consolidating into Dynatrace removes duplicate spend on data ingestion, retention, and per-host/per-GB pricing from competing vendors.",
    "Reduce operational overhead: Multiple tools require separate teams for administration, upgrades, integration maintenance, and incident response coordination. A single platform cuts operational FTEs dedicated to tooling by 40-60% (industry benchmark).",
    "Lower training and onboarding costs: Teams need to learn only one query language (DQL), one UI, and one alerting framework instead of maintaining expertise across 3-5 different tools.",
    "Consolidate vendor contracts: Simplify procurement, reduce legal and compliance review cycles, and gain negotiation leverage with a single strategic vendor relationship.",
  ],
  roiConsolTitle: "Return on Investment",
  roiConsolItems: [
    "Faster Mean Time to Resolution (MTTR): Dynatrace Intelligence provides automatic root cause analysis across the full stack. With data from other tools, teams spend 60-80% of incident time correlating data manually across UIs. Unified data cuts MTTR by up to 90%.",
    "Preventive vs. reactive operations: With all data in Grail, Dynatrace Intelligence can detect anomalies and predict problems before they impact users -- impossible when data is fragmented across tools.",
    "Developer productivity: Engineers spend 25-35% of their time context-switching between monitoring tools. A single platform returns this time to feature development and innovation.",
    "Business impact visibility: Correlating technical metrics with business KPIs (revenue, conversions, SLAs) is only possible when all signals live in the same lakehouse. Fragmented data creates blind spots in business observability.",
  ],
  riskTitle: "Risk of Maintaining Multiple Tools",
  riskItems: [
    "Blind spots between tools: Problems that span multiple domains (e.g., a database slowdown affecting a microservice affecting the frontend) are invisible when each domain is monitored by a different tool.",
    "Alert fatigue and false positives: Without unified context, each tool generates independent alerts. Teams receive redundant or contradictory notifications, leading to alert fatigue and missed critical incidents.",
    "Audit and compliance gaps: Demonstrating end-to-end observability for compliance frameworks (SOC2, ISO 27001, PCI-DSS) is significantly harder with fragmented tooling. A single platform provides unified audit trails.",
  ],
  migrationPathTitle: "Recommended Migration Path",
  migrationPathItems: [
    "Phase 1 -- Parallel ingestion: Use Dynatrace OpenPipeline to ingest data from existing tools (Splunk, Datadog, ELK, etc.) into Grail while maintaining current workflows. Zero disruption.",
    "Phase 2 -- Validate and compare: Run both systems in parallel. Compare alert quality, root cause accuracy, and dashboard coverage. Dynatrace Intelligence typically identifies 3-5x more root causes automatically.",
    "Phase 3 -- Sunset redundant tools: Once teams trust the unified view, decommission overlapping tools. Realize immediate cost savings on licensing and operational overhead.",
  ],
  footer: (tenant, date) => `Dynatrace Platform — First Day Results  |  ${tenant}  |  ${date}`,
  page: (i, total) => `Page ${i} / ${total}`,

  btnLabel: "First Day Results",
  btnEn: "English",
  btnPt: "Portugues",
};

export const REPORT_PT: ReportStrings = {
  platformLabel: "PLATAFORMA DYNATRACE",
  coverTitle: "Dia 1 — O Que Descobrimos",
  coverSubtitle: (tenant, date) => `${tenant}  |  ${date}  |  Relatorio de Avaliacao da Plataforma`,
  coverageScore: "SCORE DE COBERTURA",
  entitiesDiscovered: "ENTIDADES DESCOBERTAS",
  autoMapped: "Mapeadas automaticamente em tempo real",
  criteriaPassing: "CRITERIOS APROVADOS",
  passRate: (pct) => `${pct}% taxa de aprovacao`,
  coverFooter: "Descoberto automaticamente via topologia Smartscape e OneAgent  --  zero configuracao manual.",
  coverStats: (caps, passed, total, records) => `${caps} Capacidades  |  ${passed}/${total} Criterios  |  ${records} Registros Analisados`,

  catInfra: "INFRAESTRUTURA", catK8s: "KUBERNETES", catApps: "APLICACOES",
  catData: "DADOS E TELEMETRIA", catSecurity: "SEGURANCA E MONITORAMENTO",
  hosts: "Hosts / Servidores", processes: "Processos", networkInterfaces: "Interfaces de Rede",
  disks: "Discos", clusters: "Clusters", namespaces: "Namespaces", nodes: "Nos",
  services: "Servicos", serviceMethods: "Metodos de Servico", webApps: "Apps Web",
  mobileApps: "Apps Mobile", logRecords: "Registros de Log", tracesSpans: "Traces / Spans",
  events: "Eventos", bizEvents: "Eventos de Negocio", cloudLogs: "Logs Cloud",
  aiSpans: "Spans AI/GenAI", vulnerabilities: "Vulnerabilidades",
  dtIntelligence: "DT Intelligence", syntheticTests: "Testes Sinteticos", httpMonitors: "Monitores HTTP",

  coverageOverview: "Visao Geral de Cobertura",
  radarSubtitle: (active, total, passed, totalCrit, records) =>
    `${active} de ${total} capacidades ativas  |  ${passed}/${totalCrit} criterios aprovados  |  ${records} registros analisados`,

  beforeAfterTitle: "Antes vs. Depois do Dynatrace",
  beforeAfterIntro: (entities, activeCaps) =>
    `Esta secao compara sua realidade operacional antes do Dynatrace com as capacidades agora disponiveis apos a implantacao do Dia 1. Cada metrica abaixo foi derivada de dados reais descobertos em seu ambiente  --  ${entities} entidades em ${activeCaps} solucoes ativas, unificadas no Grail e analisadas pelo Dynatrace Intelligence.`,
  colArea: "AREA OPERACIONAL", colBefore: "ANTES", colAfter: "COM DYNATRACE", colImpact: "IMPACTO",
  roiMttr: "Resolucao de Incidentes (MTTR)", roiMttrBefore: "4-8 horas em media", roiMttrAfter: "< 15 minutos com causa raiz", roiMttrImpact: "95% mais rapido",
  roiRca: "Analise de Causa Raiz", roiRcaBefore: "War rooms manuais, suposicoes", roiRcaAfter: (svc) => `Automatica em ${svc} servicos`, roiRcaImpact: "Zero esforco manual",
  roiInfra: "Visibilidade de Infra", roiInfraBefore: "Cobertura parcial, pontos cegos", roiInfraAfter: (hosts) => `${hosts} hosts totalmente monitorados`, roiInfraImpact: (cov) => `${cov}% cobertura`,
  roiUx: "Experiencia do Usuario", roiUxBefore: "Sem dados de usuario real", roiUxAfter: (apps) => `${apps} apps com RUM`, roiUxImpact: "Visibilidade total UX",
  roiTracing: "Rastreamento Distribuido", roiTracingBefore: "Sem correlacao de traces", roiTracingAfter: (spans) => `${spans} traces capturados E2E`, roiTracingImpact: "Fluxo completo",
  roiLogs: "Gestao de Logs", roiLogsBefore: "Grep / busca manual", roiLogsAfter: (logs) => `${logs} logs indexados + correlacionados`, roiLogsImpact: "Busca instantanea",
  roiSecurity: "Postura de Seguranca", roiSecurityBefore: "Scans de vulnerabilidade apenas CI", roiSecurityAfter: (evts) => `${evts} eventos de seguranca em runtime`, roiSecurityImpact: "Ciente da producao",
  roiK8s: "Operacoes Kubernetes", roiK8sBefore: "kubectl + dashboards manuais", roiK8sAfter: (clusters, nodes) => `${clusters} clusters, ${nodes} nos monitorados`, roiK8sImpact: "Visao unificada K8s",
  roiAi: "Governanca AI/LLM", roiAiBefore: "Sem visibilidade de chamadas AI", roiAiAfter: (spans) => `${spans} spans AI rastreados`, roiAiImpact: "Custo + qualidade",

  keyInsight: "INSIGHT PRINCIPAL",
  insightStrong: (strong, names, gaps, zeros) => {
    let t = `${strong} capacidades ja acima de 60% de cobertura (${names}).`;
    t += gaps > 0 ? ` ${gaps} capacidades precisam de atencao para atingir o potencial maximo.` : " Todas as capacidades ativas mostram forte adocao.";
    if (zeros > 0) t += ` ${zeros} capacidades ainda nao ativadas — cada uma representa valor inexplorado.`;
    return t;
  },
  insightNoStrong: (active, top3) =>
    `${active} capacidades estao ativas desde o Dia 1. Foque em aumentar a cobertura em ${top3} para a maior melhoria operacional.`,

  whyDynatraceTitle: "Por Que Dynatrace -- Diferente por Design",
  diffDavisTitle: "Dynatrace Intelligence", diffDavisBrief: (entities) => `IA Agentica  --  causa raiz causal em ${entities} entidades, zero regras manuais`,
  diffSmartscapeTitle: "Smartscape", diffSmartscapeBrief: (hosts, svc) => `Topologia em tempo real  --  ${hosts} hosts, ${svc} servicos mapeados automaticamente`,
  diffGrailTitle: "Grail", diffGrailBrief: (records) => `Data lakehouse causal com MPP  --  ${records} registros unificados`,
  diffOneAgentTitle: "OneAgent", diffOneAgentBrief: "Deploy unico  --  infra, APM, RUM, logs, seguranca em um agente",
  diffOpenPipelineTitle: "OpenPipeline", diffOpenPipelineBrief: "Processamento de stream  --  ingestao, enriquecimento, contextualizacao de qualquer fonte",
  diffSecurityTitle: "Application Security", diffSecurityBrief: (evts) => `Protecao em runtime  --  ${evts} eventos`,
  diffSecurityBriefDefault: "CVEs priorizados por exposicao em producao",

  discoveryTitle: "O Que o Dynatrace Descobriu — Dia 1",
  discoveryIntro: "O Dynatrace descobriu e mapeou automaticamente seu ambiente usando topologia Smartscape e OneAgent -- zero configuracao manual. Todos os dados unificados no Grail e analisados pelo Dynatrace Intelligence.",
  criteria: "criterios",
  activeSummary: (active, total, passed, totalCrit) => `${active} de ${total} capacidades ativas  |  ${passed}/${totalCrit} criterios aprovados`,

  discInfraHosts: (h, p) => `${h} hosts monitorados com ${p} processos em execucao`,
  discInfraNet: (n) => `${n} interfaces de rede com analise de trafego`,
  discInfraDisks: (d) => `${d} volumes de disco rastreados para capacidade e I/O`,
  discInfraK8s: (c, n, ns) => `${c} clusters K8s, ${n} nos, ${ns} namespaces`,
  discInfraProblems: (p) => `${p} problemas do Dynatrace Intelligence detectados automaticamente`,
  discAppServices: (s) => `${s} servicos rastreados de ponta a ponta`,
  discAppMethods: (m) => `${m} metodos de servico instrumentados a nivel de codigo`,
  discAppSpans: (s) => `${s} traces distribuidos capturados`,
  discDxWeb: (a) => `${a} apps web monitorados com Real User Monitoring`,
  discDxMobile: (m) => `${m} apps mobile instrumentados`,
  discDxSynthetic: (s) => `${s} monitores sinteticos validando disponibilidade 24/7`,
  discDxHttp: (h) => `${h} monitores HTTP verificando saude dos endpoints`,
  discLogs: (l) => `${l} registros de log ingeridos e pesquisaveis`,
  discCloudLogs: (c) => `${c} logs cloud enriquecidos com metadados do provedor`,
  discSecEvents: (s) => `${s} eventos de seguranca para analise de vulnerabilidades`,
  discThreatEvents: (s) => `${s} eventos de seguranca para deteccao de ameacas`,
  discAiSpans: (a) => `${a} spans AI/GenAI rastreados (chamadas LLM, uso de tokens)`,
  discBizEvents: (b) => `${b} eventos de negocio capturados para rastreamento de KPIs`,
  discEvents: (e) => `${e} eventos correlacionados para impacto no negocio`,

  impactByTeam: "Impacto por Equipe",
  teamSre: "SRE e Engenharia de Plataforma",
  teamSreBaseline: "IA Agentica reduz MTTR de horas para minutos -- respostas confiaveis, nao suposicoes.",
  teamDevOps: "DevOps e Engenharia",
  teamDevOpsBaseline: "Rastreamento PurePath, quality gates CI/CD, nativo OpenTelemetry.",
  teamSecurity: "Seguranca e Conformidade",
  teamSecurityBaseline: "Deteccao de vulnerabilidades em runtime com contexto completo de observabilidade.",
  teamBusiness: "Negocios e Produto",
  teamBusinessBaseline: "Sessoes reais de usuario + KPIs de negocio via BizEvents.",
  teamAi: "Engenharia AI / ML",
  teamAiBaseline: "Monitoramento LLM, uso de tokens, rastreamento de qualidade de resposta.",

  opportunities: "Oportunidades de Crescimento",

  unifiedPlatformTitle: "Por Que Consolidar em Uma Plataforma Unica Importa",
  unifiedPlatformIntro: (consolCaps) =>
    `Esta avaliacao identificou ${consolCaps} capacidades onde os dados de observabilidade estao divididos entre multiplas ferramentas. Consolidar toda a telemetria no Dynatrace Grail -- o lakehouse causal de dados -- desbloqueia capacidades que sao impossiveis quando os dados vivem em silos.`,
  unifiedBenefit1Title: "Contexto de Ponta a Ponta",
  unifiedBenefit1: "Quando logs, metricas, traces e eventos vivem no mesmo lakehouse, o Dynatrace Intelligence consegue correlaciona-los automaticamente. Uma resposta lenta de API eh rastreada desde o clique do usuario, passando pela chamada de servico, ate a query no banco e o gargalo de infraestrutura -- em segundos, nao horas de investigacao manual cruzando ferramentas.",
  unifiedBenefit2Title: "IA Causal (Dynatrace Intelligence)",
  unifiedBenefit2: "O Dynatrace Intelligence requer dados full-stack para determinar a causa raiz. Com dados parciais, ele so consegue detectar problemas -- nao explica-los. Cada fonte de dados adicionada ao Grail aumenta exponencialmente a precisao e velocidade da analise de causa raiz.",
  unifiedBenefit3Title: "Analytics Ciente da Topologia",
  unifiedBenefit3: "O Smartscape mapeia cada dependencia em tempo real. Logs de uma ferramenta concorrente nao podem ser vinculados a topologia de servicos, a versao do deploy ou aos usuarios afetados. Dentro do Dynatrace, cada linha de log eh automaticamente enriquecida com contexto de entidade, tornando queries como 'mostre erros para usuarios nesta release nesta regiao' triviais.",
  unifiedBenefit4Title: "Eficiencia Operacional",
  unifiedBenefit4: "Multiplas ferramentas significam multiplas UIs, linguagens de query, configuracoes de alerta e contratos com fornecedores. Uma plataforma unificada elimina troca de contexto, reduz custos de treinamento e fornece uma unica fonte de verdade para todas as equipes -- SRE, DevOps, Seguranca e Negocios.",
  unifiedBenefit5Title: "Flexibilidade do OpenPipeline",
  unifiedBenefit5: "O OpenPipeline do Dynatrace pode ingerir dados de qualquer fonte -- incluindo ferramentas existentes -- e enriquece-los com o contexto completo do Dynatrace. A migracao pode ser incremental: comece roteando dados pelo OpenPipeline para o Grail mantendo os workflows existentes, e depois descontinue ferramentas redundantes conforme a confianca cresce.",
  unifiedCallToAction: "Recomendacao: Priorize o roteamento de todos os dados de observabilidade para o Grail. Cada fonte de dados adicional fortalece a precisao do Dynatrace Intelligence, a topologia Smartscape e o valor geral da plataforma. A diferenca entre os scores ajustados atuais e os scores completos do DT representa o potencial inexplorado de uma estrategia unificada de observabilidade.",
  consolPageTitle: "Oportunidade de Consolidacao",
  consolTableSubtitle: "Scores ajustados pela porcentagem estimada de dados de observabilidade ja no Dynatrace.",
  costReductionTitle: "Reducao de Custos com Consolidacao de Ferramentas",
  costReductionItems: [
    "Eliminar taxas de licenciamento redundantes: Cada ferramenta de monitoramento adicional possui seus proprios custos de licenca, ingestao e armazenamento. Consolidar no Dynatrace remove gastos duplicados em ingestao de dados, retencao e cobranca por host/por GB de fornecedores concorrentes.",
    "Reduzir overhead operacional: Multiplas ferramentas exigem equipes separadas para administracao, atualizacoes, manutencao de integracoes e coordenacao de resposta a incidentes. Uma plataforma unica reduz FTEs operacionais dedicados a ferramentas em 40-60% (benchmark do setor).",
    "Reduzir custos de treinamento e onboarding: Equipes precisam aprender apenas uma linguagem de query (DQL), uma interface e um framework de alertas ao inves de manter expertise em 3-5 ferramentas diferentes.",
    "Consolidar contratos de fornecedores: Simplificar procurement, reduzir ciclos de revisao juridica e compliance, e ganhar poder de negociacao com um unico relacionamento estrategico de fornecedor.",
  ],
  roiConsolTitle: "Retorno sobre Investimento",
  roiConsolItems: [
    "MTTR mais rapido: O Dynatrace Intelligence fornece analise automatica de causa raiz em todo o stack. Com dados em outras ferramentas, equipes gastam 60-80% do tempo de incidentes correlacionando dados manualmente entre UIs. Dados unificados reduzem o MTTR em ate 90%.",
    "Operacoes preventivas vs. reativas: Com todos os dados no Grail, o Dynatrace Intelligence consegue detectar anomalias e prever problemas antes de impactarem usuarios -- impossivel quando dados estao fragmentados entre ferramentas.",
    "Produtividade do desenvolvedor: Engenheiros gastam 25-35% do tempo alternando entre ferramentas de monitoramento. Uma plataforma unica devolve esse tempo para desenvolvimento de features e inovacao.",
    "Visibilidade de impacto no negocio: Correlacionar metricas tecnicas com KPIs de negocio (receita, conversoes, SLAs) so eh possivel quando todos os sinais vivem no mesmo lakehouse. Dados fragmentados criam pontos cegos na observabilidade de negocio.",
  ],
  riskTitle: "Riscos de Manter Multiplas Ferramentas",
  riskItems: [
    "Pontos cegos entre ferramentas: Problemas que atravessam multiplos dominios (ex: lentidao no banco afetando um microsservico afetando o frontend) sao invisiveis quando cada dominio eh monitorado por uma ferramenta diferente.",
    "Fadiga de alertas e falsos positivos: Sem contexto unificado, cada ferramenta gera alertas independentes. Equipes recebem notificacoes redundantes ou contraditorias, levando a fadiga de alertas e incidentes criticos perdidos.",
    "Lacunas de auditoria e compliance: Demonstrar observabilidade de ponta a ponta para frameworks de compliance (SOC2, ISO 27001, PCI-DSS) eh significativamente mais dificil com ferramentas fragmentadas. Uma plataforma unica fornece trilhas de auditoria unificadas.",
  ],
  migrationPathTitle: "Caminho de Migracao Recomendado",
  migrationPathItems: [
    "Fase 1 -- Ingestao paralela: Use o OpenPipeline do Dynatrace para ingerir dados de ferramentas existentes (Splunk, Datadog, ELK, etc.) no Grail mantendo workflows atuais. Zero disruptura.",
    "Fase 2 -- Validar e comparar: Execute ambos os sistemas em paralelo. Compare qualidade de alertas, precisao de causa raiz e cobertura de dashboards. O Dynatrace Intelligence tipicamente identifica 3-5x mais causas raiz automaticamente.",
    "Fase 3 -- Descomissionar ferramentas redundantes: Uma vez que as equipes confiam na visao unificada, desative ferramentas sobrepostas. Realize economias imediatas em licenciamento e overhead operacional.",
  ],
  footer: (tenant, date) => `Plataforma Dynatrace — Resultados do Primeiro Dia  |  ${tenant}  |  ${date}`,
  page: (i, total) => `Pagina ${i} / ${total}`,

  btnLabel: "Resultados Dia 1",
  btnEn: "English",
  btnPt: "Portugues",
};

export const REPORT_ES: ReportStrings = {
  platformLabel: "PLATAFORMA DYNATRACE",
  coverTitle: "Dia 1 — Lo Que Descubrimos",
  coverSubtitle: (tenant, date) => `${tenant}  |  ${date}  |  Informe de Evaluacion de la Plataforma`,
  coverageScore: "PUNTUACION DE COBERTURA",
  entitiesDiscovered: "ENTIDADES DESCUBIERTAS",
  autoMapped: "Mapeadas automaticamente en tiempo real",
  criteriaPassing: "CRITERIOS APROBADOS",
  passRate: (pct) => `${pct}% tasa de aprobacion`,
  coverFooter: "Descubierto automaticamente via topologia Smartscape y OneAgent  --  cero configuracion manual.",
  coverStats: (caps, passed, total, records) => `${caps} Capacidades  |  ${passed}/${total} Criterios  |  ${records} Registros Analizados`,

  catInfra: "INFRAESTRUCTURA", catK8s: "KUBERNETES", catApps: "APLICACIONES",
  catData: "DATOS Y TELEMETRIA", catSecurity: "SEGURIDAD Y MONITOREO",
  hosts: "Hosts / Servidores", processes: "Procesos", networkInterfaces: "Interfaces de Red",
  disks: "Discos", clusters: "Clusters", namespaces: "Namespaces", nodes: "Nodos",
  services: "Servicios", serviceMethods: "Metodos de Servicio", webApps: "Apps Web",
  mobileApps: "Apps Moviles", logRecords: "Registros de Log", tracesSpans: "Traces / Spans",
  events: "Eventos", bizEvents: "Eventos de Negocio", cloudLogs: "Logs Cloud",
  aiSpans: "Spans AI/GenAI", vulnerabilities: "Vulnerabilidades",
  dtIntelligence: "DT Intelligence", syntheticTests: "Tests Sinteticos", httpMonitors: "Monitores HTTP",

  coverageOverview: "Vision General de Cobertura",
  radarSubtitle: (active, total, passed, totalCrit, records) =>
    `${active} de ${total} capacidades activas  |  ${passed}/${totalCrit} criterios aprobados  |  ${records} registros analizados`,

  beforeAfterTitle: "Antes vs. Despues de Dynatrace",
  beforeAfterIntro: (entities, activeCaps) =>
    `Esta seccion compara su realidad operativa antes de Dynatrace con las capacidades ahora disponibles tras la implementacion del Dia 1. Cada metrica se deriva de datos reales descubiertos en su entorno  --  ${entities} entidades en ${activeCaps} soluciones activas, unificadas en Grail y analizadas por Dynatrace Intelligence.`,
  colArea: "AREA OPERATIVA", colBefore: "ANTES", colAfter: "CON DYNATRACE", colImpact: "IMPACTO",
  roiMttr: "Resolucion de Incidentes (MTTR)", roiMttrBefore: "4-8 horas en promedio", roiMttrAfter: "< 15 minutos con causa raiz", roiMttrImpact: "95% mas rapido",
  roiRca: "Analisis de Causa Raiz", roiRcaBefore: "War rooms manuales, suposiciones", roiRcaAfter: (svc) => `Automatico en ${svc} servicios`, roiRcaImpact: "Cero esfuerzo manual",
  roiInfra: "Visibilidad de Infra", roiInfraBefore: "Cobertura parcial, puntos ciegos", roiInfraAfter: (hosts) => `${hosts} hosts completamente monitoreados`, roiInfraImpact: (cov) => `${cov}% cobertura`,
  roiUx: "Experiencia del Usuario", roiUxBefore: "Sin datos de usuario real", roiUxAfter: (apps) => `${apps} apps con RUM`, roiUxImpact: "Visibilidad total UX",
  roiTracing: "Rastreo Distribuido", roiTracingBefore: "Sin correlacion de traces", roiTracingAfter: (spans) => `${spans} traces capturados E2E`, roiTracingImpact: "Flujo completo",
  roiLogs: "Gestion de Logs", roiLogsBefore: "Grep / busqueda manual", roiLogsAfter: (logs) => `${logs} logs indexados + correlacionados`, roiLogsImpact: "Busqueda instantanea",
  roiSecurity: "Postura de Seguridad", roiSecurityBefore: "Escaneos de vulnerabilidad solo CI", roiSecurityAfter: (evts) => `${evts} eventos de seguridad en runtime`, roiSecurityImpact: "Consciente de produccion",
  roiK8s: "Operaciones Kubernetes", roiK8sBefore: "kubectl + dashboards manuales", roiK8sAfter: (clusters, nodes) => `${clusters} clusters, ${nodes} nodos monitoreados`, roiK8sImpact: "Vista unificada K8s",
  roiAi: "Gobernanza AI/LLM", roiAiBefore: "Sin visibilidad de llamadas AI", roiAiAfter: (spans) => `${spans} spans AI rastreados`, roiAiImpact: "Costo + calidad",

  keyInsight: "HALLAZGO CLAVE",
  insightStrong: (strong, names, gaps, zeros) => {
    let t = `${strong} capacidades ya por encima del 60% de cobertura (${names}).`;
    t += gaps > 0 ? ` ${gaps} capacidades necesitan atencion para alcanzar su maximo potencial.` : " Todas las capacidades activas muestran fuerte adopcion.";
    if (zeros > 0) t += ` ${zeros} capacidades aun no activadas — cada una representa valor sin explotar.`;
    return t;
  },
  insightNoStrong: (active, top3) =>
    `${active} capacidades estan activas desde el Dia 1. Enfoque en aumentar la cobertura en ${top3} para la mayor mejora operativa.`,

  whyDynatraceTitle: "Por Que Dynatrace -- Diferente por Diseno",
  diffDavisTitle: "Dynatrace Intelligence", diffDavisBrief: (entities) => `IA Agentica  --  causa raiz causal en ${entities} entidades, cero reglas manuales`,
  diffSmartscapeTitle: "Smartscape", diffSmartscapeBrief: (hosts, svc) => `Topologia en tiempo real  --  ${hosts} hosts, ${svc} servicios mapeados automaticamente`,
  diffGrailTitle: "Grail", diffGrailBrief: (records) => `Data lakehouse causal con MPP  --  ${records} registros unificados`,
  diffOneAgentTitle: "OneAgent", diffOneAgentBrief: "Despliegue unico  --  infra, APM, RUM, logs, seguridad en un agente",
  diffOpenPipelineTitle: "OpenPipeline", diffOpenPipelineBrief: "Procesamiento de stream  --  ingesta, enriquecimiento, contextualizacion de cualquier fuente",
  diffSecurityTitle: "Application Security", diffSecurityBrief: (evts) => `Proteccion en runtime  --  ${evts} eventos`,
  diffSecurityBriefDefault: "CVEs priorizados por exposicion en produccion",

  discoveryTitle: "Lo Que Dynatrace Descubrio — Dia 1",
  discoveryIntro: "Dynatrace descubrio y mapeo automaticamente su entorno usando topologia Smartscape y OneAgent -- cero configuracion manual. Todos los datos unificados en Grail y analizados por Dynatrace Intelligence.",
  criteria: "criterios",
  activeSummary: (active, total, passed, totalCrit) => `${active} de ${total} capacidades activas  |  ${passed}/${totalCrit} criterios aprobados`,

  discInfraHosts: (h, p) => `${h} hosts monitoreados con ${p} procesos en ejecucion`,
  discInfraNet: (n) => `${n} interfaces de red con analisis de trafico`,
  discInfraDisks: (d) => `${d} volumenes de disco rastreados para capacidad e I/O`,
  discInfraK8s: (c, n, ns) => `${c} clusters K8s, ${n} nodos, ${ns} namespaces`,
  discInfraProblems: (p) => `${p} problemas de Dynatrace Intelligence detectados automaticamente`,
  discAppServices: (s) => `${s} servicios rastreados de extremo a extremo`,
  discAppMethods: (m) => `${m} metodos de servicio instrumentados a nivel de codigo`,
  discAppSpans: (s) => `${s} traces distribuidos capturados`,
  discDxWeb: (a) => `${a} apps web monitoreadas con Real User Monitoring`,
  discDxMobile: (m) => `${m} apps moviles instrumentadas`,
  discDxSynthetic: (s) => `${s} monitores sinteticos validando disponibilidad 24/7`,
  discDxHttp: (h) => `${h} monitores HTTP verificando salud de endpoints`,
  discLogs: (l) => `${l} registros de log ingestados y buscables`,
  discCloudLogs: (c) => `${c} logs cloud enriquecidos con metadatos del proveedor`,
  discSecEvents: (s) => `${s} eventos de seguridad para analisis de vulnerabilidades`,
  discThreatEvents: (s) => `${s} eventos de seguridad para deteccion de amenazas`,
  discAiSpans: (a) => `${a} spans AI/GenAI rastreados (llamadas LLM, uso de tokens)`,
  discBizEvents: (b) => `${b} eventos de negocio capturados para seguimiento de KPIs`,
  discEvents: (e) => `${e} eventos correlacionados para impacto en el negocio`,

  impactByTeam: "Impacto por Equipo",
  teamSre: "SRE e Ingenieria de Plataforma",
  teamSreBaseline: "IA Agentica reduce MTTR de horas a minutos -- respuestas confiables, no suposiciones.",
  teamDevOps: "DevOps e Ingenieria",
  teamDevOpsBaseline: "Rastreo PurePath, quality gates CI/CD, nativo OpenTelemetry.",
  teamSecurity: "Seguridad y Cumplimiento",
  teamSecurityBaseline: "Deteccion de vulnerabilidades en runtime con contexto completo de observabilidad.",
  teamBusiness: "Negocios y Producto",
  teamBusinessBaseline: "Sesiones reales de usuario + KPIs de negocio via BizEvents.",
  teamAi: "Ingenieria AI / ML",
  teamAiBaseline: "Monitoreo LLM, uso de tokens, seguimiento de calidad de respuesta.",

  opportunities: "Oportunidades de Crecimiento",

  unifiedPlatformTitle: "Por Que Consolidar en Una Plataforma Unica Importa",
  unifiedPlatformIntro: (consolCaps) =>
    `Esta evaluacion identifico ${consolCaps} capacidades donde los datos de observabilidad estan divididos entre multiples herramientas. Consolidar toda la telemetria en Dynatrace Grail -- el lakehouse causal de datos -- desbloquea capacidades que son imposibles cuando los datos viven en silos.`,
  unifiedBenefit1Title: "Contexto de Extremo a Extremo",
  unifiedBenefit1: "Cuando logs, metricas, traces y eventos viven en el mismo lakehouse, Dynatrace Intelligence puede correlacionarlos automaticamente. Una respuesta lenta de API se rastrea desde el clic del usuario, pasando por la llamada de servicio, hasta la consulta en la base de datos y el cuello de botella de infraestructura -- en segundos, no horas de investigacion manual cruzando herramientas.",
  unifiedBenefit2Title: "IA Causal (Dynatrace Intelligence)",
  unifiedBenefit2: "Dynatrace Intelligence requiere datos full-stack para determinar la causa raiz. Con datos parciales, solo puede detectar problemas -- no explicarlos. Cada fuente de datos anadida a Grail aumenta exponencialmente la precision y velocidad del analisis de causa raiz.",
  unifiedBenefit3Title: "Analytics Consciente de la Topologia",
  unifiedBenefit3: "Smartscape mapea cada dependencia en tiempo real. Los logs de una herramienta competidora no pueden vincularse a la topologia de servicios, la version del despliegue o los usuarios afectados. Dentro de Dynatrace, cada linea de log se enriquece automaticamente con contexto de entidad, haciendo triviales consultas como 'mostrar errores para usuarios en esta version en esta region'.",
  unifiedBenefit4Title: "Eficiencia Operativa",
  unifiedBenefit4: "Multiples herramientas significan multiples UIs, lenguajes de consulta, configuraciones de alerta y contratos con proveedores. Una plataforma unificada elimina el cambio de contexto, reduce costos de capacitacion y proporciona una unica fuente de verdad para todos los equipos -- SRE, DevOps, Seguridad y Negocios.",
  unifiedBenefit5Title: "Flexibilidad de OpenPipeline",
  unifiedBenefit5: "OpenPipeline de Dynatrace puede ingerir datos de cualquier fuente -- incluidas herramientas existentes -- y enriquecerlos con el contexto completo de Dynatrace. La migracion puede ser incremental: comience enrutando datos a traves de OpenPipeline hacia Grail mientras mantiene los flujos existentes, y luego retire herramientas redundantes a medida que crece la confianza.",
  unifiedCallToAction: "Recomendacion: Priorice el enrutamiento de todos los datos de observabilidad hacia Grail. Cada fuente de datos adicional fortalece la precision de Dynatrace Intelligence, la topologia Smartscape y el valor general de la plataforma. La brecha entre los puntajes ajustados actuales y los puntajes completos de DT representa el potencial sin explotar de una estrategia unificada de observabilidad.",
  consolPageTitle: "Oportunidad de Consolidacion",
  consolTableSubtitle: "Puntajes ajustados por el porcentaje estimado de datos de observabilidad ya en Dynatrace.",
  costReductionTitle: "Reduccion de Costos con Consolidacion de Herramientas",
  costReductionItems: [
    "Eliminar tarifas de licenciamiento redundantes: Cada herramienta de monitoreo adicional tiene sus propios costos de licencia, ingestion y almacenamiento. Consolidar en Dynatrace elimina gastos duplicados en ingestion de datos, retencion y precios por host/por GB de proveedores competidores.",
    "Reducir overhead operativo: Multiples herramientas requieren equipos separados para administracion, actualizaciones, mantenimiento de integraciones y coordinacion de respuesta a incidentes. Una plataforma unica reduce FTEs operativos dedicados a herramientas en un 40-60% (benchmark de la industria).",
    "Reducir costos de capacitacion y onboarding: Los equipos necesitan aprender solo un lenguaje de consulta (DQL), una interfaz y un marco de alertas en vez de mantener expertise en 3-5 herramientas diferentes.",
    "Consolidar contratos de proveedores: Simplificar adquisiciones, reducir ciclos de revision legal y cumplimiento, y ganar poder de negociacion con una unica relacion estrategica de proveedor.",
  ],
  roiConsolTitle: "Retorno sobre la Inversion",
  roiConsolItems: [
    "MTTR mas rapido: Dynatrace Intelligence proporciona analisis automatico de causa raiz en todo el stack. Con datos en otras herramientas, los equipos gastan 60-80% del tiempo de incidentes correlacionando datos manualmente entre UIs. Datos unificados reducen el MTTR hasta un 90%.",
    "Operaciones preventivas vs. reactivas: Con todos los datos en Grail, Dynatrace Intelligence puede detectar anomalias y predecir problemas antes de que impacten a los usuarios -- imposible cuando los datos estan fragmentados entre herramientas.",
    "Productividad del desarrollador: Los ingenieros gastan 25-35% de su tiempo cambiando entre herramientas de monitoreo. Una plataforma unica devuelve ese tiempo al desarrollo de funcionalidades e innovacion.",
    "Visibilidad de impacto en el negocio: Correlacionar metricas tecnicas con KPIs de negocio (ingresos, conversiones, SLAs) solo es posible cuando todas las senales viven en el mismo lakehouse. Datos fragmentados crean puntos ciegos en la observabilidad de negocio.",
  ],
  riskTitle: "Riesgos de Mantener Multiples Herramientas",
  riskItems: [
    "Puntos ciegos entre herramientas: Problemas que cruzan multiples dominios (ej: lentitud en BD afectando un microservicio afectando el frontend) son invisibles cuando cada dominio es monitoreado por una herramienta diferente.",
    "Fatiga de alertas y falsos positivos: Sin contexto unificado, cada herramienta genera alertas independientes. Los equipos reciben notificaciones redundantes o contradictorias, llevando a fatiga de alertas e incidentes criticos perdidos.",
    "Brechas de auditoria y cumplimiento: Demostrar observabilidad de extremo a extremo para marcos de cumplimiento (SOC2, ISO 27001, PCI-DSS) es significativamente mas dificil con herramientas fragmentadas. Una plataforma unica proporciona pistas de auditoria unificadas.",
  ],
  migrationPathTitle: "Ruta de Migracion Recomendada",
  migrationPathItems: [
    "Fase 1 -- Ingestion paralela: Use OpenPipeline de Dynatrace para ingerir datos de herramientas existentes (Splunk, Datadog, ELK, etc.) en Grail manteniendo flujos de trabajo actuales. Cero disrupcion.",
    "Fase 2 -- Validar y comparar: Ejecute ambos sistemas en paralelo. Compare calidad de alertas, precision de causa raiz y cobertura de dashboards. Dynatrace Intelligence tipicamente identifica 3-5x mas causas raiz automaticamente.",
    "Fase 3 -- Descomisionar herramientas redundantes: Una vez que los equipos confian en la vista unificada, desactive herramientas superpuestas. Realice ahorros inmediatos en licenciamiento y overhead operativo.",
  ],
  footer: (tenant, date) => `Plataforma Dynatrace — Resultados del Primer Dia  |  ${tenant}  |  ${date}`,
  page: (i, total) => `Pagina ${i} / ${total}`,

  btnLabel: "Resultados Dia 1",
  btnEn: "English",
  btnPt: "Portugues",
};

export const REPORT_STRINGS: Record<ReportLang, ReportStrings> = { en: REPORT_EN, pt: REPORT_PT, es: REPORT_ES };
