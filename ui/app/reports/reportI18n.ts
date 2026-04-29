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

  footer: (tenant, date) => `Plataforma Dynatrace — Resultados del Primer Dia  |  ${tenant}  |  ${date}`,
  page: (i, total) => `Pagina ${i} / ${total}`,

  btnLabel: "Resultados Dia 1",
  btnEn: "English",
  btnPt: "Portugues",
};

export const REPORT_STRINGS: Record<ReportLang, ReportStrings> = { en: REPORT_EN, pt: REPORT_PT, es: REPORT_ES };
