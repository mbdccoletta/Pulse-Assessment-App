import { jsPDF } from "jspdf";
import { maturity, renderTechRadarToDataURL } from "../components/TechRadar";
import { type ReportLang, REPORT_STRINGS } from "./reportI18n";

export interface ReportInput {
  capabilities: {
    name: string;
    score: number;
    color: string;
    criteriaResults: { points: number }[];
  }[];
  totalScore: number;
  tenant: string;
  date: string;
  stats: { scannedRecords: number; succeeded: number; total: number; failed: number } | null;
  entityCounts: {
    hosts: number; services: number; serviceMethods: number;
    processGroups: number; processInstances: number;
    applications: number; mobileApps: number;
    k8sClusters: number; k8sNamespaces: number; k8sNodes: number;
    syntheticTests: number; syntheticLocations: number; httpChecks: number;
    networkInterfaces: number; disks: number;
    logs: number; spans: number; aiSpans: number;
    events: number; problems: number; bizEvents: number;
    cloudLogs: number; securityEvents: number;
  } | null;
}

function formatRecords(n: number): string {
  return n.toLocaleString();
}

export function generateFirstDayReport(input: ReportInput, lang: ReportLang = "en"): void {
  const { capabilities, totalScore, tenant, date, stats, entityCounts } = input;
  if (capabilities.length === 0) return;

  const T = REPORT_STRINGS[lang];
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 15, CW = W - 2 * M;
  let y = 0;

  const hexToRgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
  ];
  const paintBg = () => { pdf.setFillColor(11, 11, 26); pdf.rect(0, 0, W, H, "F"); };
  const ensureSpace = (need: number) => {
    if (y + need > H - M) { pdf.addPage(); paintBg(); addTopBar(); y = 22; }
  };
  const addTopBar = () => { pdf.setFillColor(55, 100, 220); pdf.rect(0, 0, W, 3, "F"); };
  const sectionHeader = (title: string, bgR: number, bgG: number, bgB: number) => {
    pdf.setFillColor(bgR, bgG, bgB);
    pdf.roundedRect(M, y - 4, CW, 12, 2, 2, "F");
    pdf.setFontSize(13); pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text(title, M + 6, y + 4);
    y += 16;
  };

  const ovCov = totalScore;
  const mCov = maturity(ovCov);
  const totalCriteria = capabilities.reduce((s, c) => s + c.criteriaResults.length, 0);
  const passedCriteria = capabilities.reduce((s, c) => s + c.criteriaResults.filter(cr => cr.points > 0).length, 0);
  const scanRec = stats ? formatRecords(stats.scannedRecords) : "N/A";

  const activeCaps = capabilities.filter(c => c.score > 0);
  const strongCaps = capabilities.filter(c => c.score >= 60);
  const gapCaps = capabilities.filter(c => c.score > 0 && c.score < 60);
  const zeroCaps = capabilities.filter(c => c.score === 0);

  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;
  const ec = entityCounts || { hosts: 0, services: 0, serviceMethods: 0, processGroups: 0, processInstances: 0, applications: 0, mobileApps: 0, k8sClusters: 0, k8sNamespaces: 0, k8sNodes: 0, syntheticTests: 0, syntheticLocations: 0, httpChecks: 0, networkInterfaces: 0, disks: 0, logs: 0, spans: 0, aiSpans: 0, events: 0, problems: 0, bizEvents: 0, cloudLogs: 0, securityEvents: 0 };

  // Dynamic capability-to-discovery mapping
  type DiscoveryItem = { text: string };
  const capDiscovery: Record<string, DiscoveryItem[]> = {};
  const addDisc = (cap: string, items: DiscoveryItem[]) => { if (items.length > 0) capDiscovery[cap] = items; };

  addDisc("Infrastructure Observability", [
    ...(ec.hosts > 0 ? [{ text: T.discInfraHosts(fmtNum(ec.hosts), fmtNum(ec.processInstances)) }] : []),
    ...(ec.networkInterfaces > 0 ? [{ text: T.discInfraNet(fmtNum(ec.networkInterfaces)) }] : []),
    ...(ec.disks > 0 ? [{ text: T.discInfraDisks(fmtNum(ec.disks)) }] : []),
    ...(ec.k8sClusters > 0 ? [{ text: T.discInfraK8s(fmtNum(ec.k8sClusters), fmtNum(ec.k8sNodes), fmtNum(ec.k8sNamespaces)) }] : []),
    ...(ec.problems > 0 ? [{ text: T.discInfraProblems(fmtNum(ec.problems)) }] : []),
  ]);
  addDisc("Application Observability", [
    ...(ec.services > 0 ? [{ text: T.discAppServices(fmtNum(ec.services)) }] : []),
    ...(ec.serviceMethods > 0 ? [{ text: T.discAppMethods(fmtNum(ec.serviceMethods)) }] : []),
    ...(ec.spans > 0 ? [{ text: T.discAppSpans(fmtNum(ec.spans)) }] : []),
  ]);
  addDisc("Digital Experience", [
    ...(ec.applications > 0 ? [{ text: T.discDxWeb(fmtNum(ec.applications)) }] : []),
    ...(ec.mobileApps > 0 ? [{ text: T.discDxMobile(fmtNum(ec.mobileApps)) }] : []),
    ...(ec.syntheticTests > 0 ? [{ text: T.discDxSynthetic(fmtNum(ec.syntheticTests)) }] : []),
    ...(ec.httpChecks > 0 ? [{ text: T.discDxHttp(fmtNum(ec.httpChecks)) }] : []),
  ]);
  addDisc("Log Analytics", [
    ...(ec.logs > 0 ? [{ text: T.discLogs(fmtNum(ec.logs)) }] : []),
    ...(ec.cloudLogs > 0 ? [{ text: T.discCloudLogs(fmtNum(ec.cloudLogs)) }] : []),
  ]);
  addDisc("Application Security", [
    ...(ec.securityEvents > 0 ? [{ text: T.discSecEvents(fmtNum(ec.securityEvents)) }] : []),
  ]);
  addDisc("Threat Observability", [
    ...(ec.securityEvents > 0 ? [{ text: T.discThreatEvents(fmtNum(ec.securityEvents)) }] : []),
  ]);
  addDisc("AI Observability", [
    ...(ec.aiSpans > 0 ? [{ text: T.discAiSpans(fmtNum(ec.aiSpans)) }] : []),
  ]);
  addDisc("Business Observability", [
    ...(ec.bizEvents > 0 ? [{ text: T.discBizEvents(fmtNum(ec.bizEvents)) }] : []),
    ...(ec.events > 0 ? [{ text: T.discEvents(fmtNum(ec.events)) }] : []),
  ]);

  /* ═══════════════════════════════════════
     COVER PAGE — Premium futuristic design
     ═══════════════════════════════════════ */
  paintBg();
  addTopBar();

  // Decorative accent lines
  pdf.setDrawColor(55, 100, 220); pdf.setLineWidth(0.3);
  pdf.line(M, 8, M + 40, 8);
  pdf.line(W - M - 40, 8, W - M, 8);

  pdf.setTextColor(55, 100, 220);
  pdf.setFontSize(7); pdf.setFont("helvetica", "bold");
  pdf.text(T.platformLabel, W / 2, 14, { align: "center" });

  pdf.setTextColor(232, 232, 240);
  pdf.setFontSize(24); pdf.setFont("helvetica", "bold");
  pdf.text(T.coverTitle, W / 2, 26, { align: "center" });

  pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
  pdf.setTextColor(140, 145, 180);
  pdf.text(T.coverSubtitle(tenant, date || new Date().toLocaleDateString()), W / 2, 35, { align: "center" });

  // ── Hero metrics row — 3 big KPIs ──
  const heroY = 44;
  const heroW = (CW - 8) / 3;
  const heroH = 26;
  const totalEntities = ec.hosts + ec.services + ec.applications + ec.mobileApps + ec.k8sClusters + ec.processInstances;
  const heroMetrics = [
    { value: `${ovCov}%`, label: T.coverageScore, color: hexToRgb(mCov.color), sub: mCov.label },
    { value: fmtNum(totalEntities), label: T.entitiesDiscovered, color: [80, 180, 255] as [number, number, number], sub: T.autoMapped },
    { value: `${passedCriteria}/${totalCriteria}`, label: T.criteriaPassing, color: [100, 220, 160] as [number, number, number], sub: T.passRate(Math.round(passedCriteria / totalCriteria * 100)) },
  ];
  heroMetrics.forEach((m, i) => {
    const hx = M + i * (heroW + 4);
    pdf.setFillColor(14, 17, 38);
    pdf.setDrawColor(m.color[0], m.color[1], m.color[2]);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(hx, heroY, heroW, heroH, 2, 2, "FD");
    pdf.setFillColor(m.color[0], m.color[1], m.color[2]);
    pdf.rect(hx + 2, heroY, heroW - 4, 0.8, "F");

    pdf.setFontSize(18); pdf.setFont("helvetica", "bold");
    pdf.setTextColor(m.color[0], m.color[1], m.color[2]);
    pdf.text(m.value, hx + heroW / 2, heroY + 12, { align: "center" });
    pdf.setFontSize(5.5); pdf.setFont("helvetica", "bold");
    pdf.setTextColor(110, 115, 150);
    pdf.text(m.label, hx + heroW / 2, heroY + 18, { align: "center" });
    pdf.setFontSize(6); pdf.setTextColor(m.color[0], m.color[1], m.color[2]);
    pdf.text(m.sub, hx + heroW / 2, heroY + 22.5, { align: "center" });
  });
  pdf.setLineWidth(0.2);

  // ── Smartscape Entity Numbers — full-page layout ──
  type EBox = { value: string; raw: number; label: string; color: [number, number, number]; border: [number, number, number] };
  type Category = { title: string; titleColor: [number, number, number]; boxes: EBox[] };

  const categories: Category[] = [
    { title: T.catInfra, titleColor: [80, 170, 255], boxes: [
      { value: fmtNum(ec.hosts), raw: ec.hosts, label: T.hosts, color: [80, 170, 255], border: [55, 100, 220] },
      { value: fmtNum(ec.processInstances), raw: ec.processInstances, label: T.processes, color: [140, 200, 255], border: [90, 150, 220] },
      { value: fmtNum(ec.networkInterfaces), raw: ec.networkInterfaces, label: T.networkInterfaces, color: [100, 190, 255], border: [60, 140, 220] },
      { value: fmtNum(ec.disks), raw: ec.disks, label: T.disks, color: [110, 195, 250], border: [70, 145, 210] },
    ].filter(b => b.raw > 0) as EBox[] },
    { title: T.catK8s, titleColor: [130, 140, 255], boxes: [
      { value: fmtNum(ec.k8sClusters), raw: ec.k8sClusters, label: T.clusters, color: [130, 140, 255], border: [90, 100, 220] },
      { value: fmtNum(ec.k8sNamespaces), raw: ec.k8sNamespaces, label: T.namespaces, color: [160, 160, 255], border: [120, 120, 220] },
      { value: fmtNum(ec.k8sNodes), raw: ec.k8sNodes, label: T.nodes, color: [180, 170, 255], border: [140, 130, 220] },
    ].filter(b => b.raw > 0) as EBox[] },
    { title: T.catApps, titleColor: [100, 220, 160], boxes: [
      { value: fmtNum(ec.services), raw: ec.services, label: T.services, color: [100, 220, 160], border: [60, 180, 120] },
      { value: fmtNum(ec.serviceMethods), raw: ec.serviceMethods, label: T.serviceMethods, color: [130, 230, 180], border: [80, 200, 140] },
      { value: fmtNum(ec.applications), raw: ec.applications, label: T.webApps, color: [255, 150, 100], border: [220, 110, 60] },
      { value: fmtNum(ec.mobileApps), raw: ec.mobileApps, label: T.mobileApps, color: [255, 170, 130], border: [220, 130, 80] },
    ].filter(b => b.raw > 0) as EBox[] },
    { title: T.catData, titleColor: [220, 200, 100], boxes: [
      { value: fmtNum(ec.logs), raw: ec.logs, label: T.logRecords, color: [220, 200, 100], border: [180, 160, 60] },
      { value: fmtNum(ec.spans), raw: ec.spans, label: T.tracesSpans, color: [255, 130, 180], border: [220, 90, 140] },
      { value: fmtNum(ec.events), raw: ec.events, label: T.events, color: [255, 200, 120], border: [220, 160, 80] },
      { value: fmtNum(ec.bizEvents), raw: ec.bizEvents, label: T.bizEvents, color: [255, 220, 100], border: [220, 180, 60] },
      { value: fmtNum(ec.cloudLogs), raw: ec.cloudLogs, label: T.cloudLogs, color: [200, 220, 120], border: [160, 180, 80] },
      { value: fmtNum(ec.aiSpans), raw: ec.aiSpans, label: T.aiSpans, color: [220, 160, 255], border: [180, 120, 220] },
    ].filter(b => b.raw > 0) as EBox[] },
    { title: T.catSecurity, titleColor: [255, 100, 100], boxes: [
      { value: fmtNum(ec.securityEvents), raw: ec.securityEvents, label: T.vulnerabilities, color: [255, 80, 80], border: [220, 50, 50] },
      { value: fmtNum(ec.problems), raw: ec.problems, label: T.dtIntelligence, color: [255, 100, 100], border: [220, 60, 60] },
      { value: fmtNum(ec.syntheticTests), raw: ec.syntheticTests, label: T.syntheticTests, color: [200, 130, 255], border: [160, 90, 220] },
      { value: fmtNum(ec.httpChecks), raw: ec.httpChecks, label: T.httpMonitors, color: [180, 150, 255], border: [140, 110, 220] },
    ].filter(b => b.raw > 0) as EBox[] },
  ].filter(cat => cat.boxes.length > 0) as Category[];

  const entityStartY = 76;
  const footerY = H - 18;
  const entityAvailH = footerY - entityStartY;
  const bxGap = 3;
  const catGap = 2;
  const catTitleH = 6;
  const totalGapH = categories.length * catGap + categories.reduce((s) => s + catTitleH, 0);
  const totalBoxRows = categories.reduce((s, cat) => s + Math.ceil(cat.boxes.length / Math.min(cat.boxes.length, 5)), 0);
  const bxH = Math.min(28, Math.max(20, (entityAvailH - totalGapH - totalBoxRows * bxGap) / totalBoxRows));

  let curY = entityStartY;

  categories.forEach(cat => {
    pdf.setFontSize(6.5); pdf.setFont("helvetica", "bold");
    pdf.setTextColor(cat.titleColor[0], cat.titleColor[1], cat.titleColor[2]);
    pdf.text(cat.title, M, curY + 3);
    curY += catTitleH;

    const cols = Math.min(cat.boxes.length, 5);
    const bxW = (CW - (cols - 1) * bxGap) / cols;
    const rows = Math.ceil(cat.boxes.length / cols);
    cat.boxes.forEach((box, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = M + col * (bxW + bxGap);
      const by = curY + row * (bxH + bxGap);
      pdf.setFillColor(15, 18, 42);
      pdf.setDrawColor(box.border[0], box.border[1], box.border[2]);
      pdf.roundedRect(bx, by, bxW, bxH, 2, 2, "FD");
      pdf.setFontSize(16); pdf.setFont("helvetica", "bold");
      pdf.setTextColor(box.color[0], box.color[1], box.color[2]);
      pdf.text(box.value, bx + bxW / 2, by + bxH * 0.42, { align: "center" });
      pdf.setFontSize(6); pdf.setFont("helvetica", "normal");
      pdf.setTextColor(140, 145, 185);
      pdf.text(box.label, bx + bxW / 2, by + bxH * 0.72, { align: "center" });
    });
    curY += rows * (bxH + bxGap) + catGap;
  });

  // Footer tagline on cover
  pdf.setFontSize(6); pdf.setFont("helvetica", "italic");
  pdf.setTextColor(85, 90, 125);
  pdf.text(T.coverFooter, W / 2, footerY, { align: "center" });
  pdf.setFontSize(6.5); pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 105, 145);
  pdf.text(T.coverStats(capabilities.length, passedCriteria, totalCriteria, scanRec), W / 2, footerY + 5, { align: "center" });

  /* ═══════════════════════════════════════
     PAGE — COVERAGE RADAR CHART (dedicated)
     ═══════════════════════════════════════ */
  pdf.addPage(); paintBg(); addTopBar();
  y = 18;
  pdf.setFontSize(12); pdf.setFont("helvetica", "bold");
  pdf.setTextColor(220, 220, 240);
  pdf.text(T.coverageOverview, W / 2, y, { align: "center" });
  y += 5;
  pdf.setFontSize(7); pdf.setFont("helvetica", "normal");
  pdf.setTextColor(140, 145, 180);
  pdf.text(T.radarSubtitle(activeCaps.length, capabilities.length, passedCriteria, totalCriteria, scanRec), W / 2, y, { align: "center" });
  y += 6;

  const chartData = capabilities.map(c => ({ name: c.name, score: c.score, color: c.color }));
  const chartImg = renderTechRadarToDataURL(chartData, 1600, { darkBg: true });
  const chartSz = Math.min(CW, H - y - 12);
  const chartX = (W - chartSz) / 2;
  pdf.addImage(chartImg, "PNG", chartX, y, chartSz, chartSz);

  /* ═══════════════════════════════════════
     PAGE — EXECUTIVE SUMMARY: Before vs. After
     ═══════════════════════════════════════ */
  pdf.addPage(); paintBg(); addTopBar();
  y = 22;
  sectionHeader(T.beforeAfterTitle, 20, 40, 90);

  pdf.setFontSize(8.5); pdf.setFont("helvetica", "normal");
  pdf.setTextColor(190, 190, 220);
  const execIntro = T.beforeAfterIntro(fmtNum(totalEntities), activeCaps.length);
  const execIntroLines = pdf.splitTextToSize(execIntro, CW);
  pdf.text(execIntroLines, M, y);
  y += execIntroLines.length * 4.5 + 6;

  // ── Before vs After comparison table ──
  const roiItems: { area: string; before: string; after: string; impact: string; color: [number, number, number] }[] = [];
  if (ec.hosts > 0 || ec.services > 0) {
    roiItems.push({ area: T.roiMttr, before: T.roiMttrBefore, after: T.roiMttrAfter, impact: T.roiMttrImpact, color: [80, 220, 160] });
  }
  if (ec.services > 0) {
    roiItems.push({ area: T.roiRca, before: T.roiRcaBefore, after: T.roiRcaAfter(fmtNum(ec.services)), impact: T.roiRcaImpact, color: [80, 180, 255] });
  }
  if (ec.hosts > 0) {
    roiItems.push({ area: T.roiInfra, before: T.roiInfraBefore, after: T.roiInfraAfter(fmtNum(ec.hosts)), impact: T.roiInfraImpact(ovCov), color: [180, 140, 255] });
  }
  if (ec.applications + ec.mobileApps > 0) {
    roiItems.push({ area: T.roiUx, before: T.roiUxBefore, after: T.roiUxAfter(fmtNum(ec.applications + ec.mobileApps)), impact: T.roiUxImpact, color: [255, 150, 100] });
  }
  if (ec.spans > 0) {
    roiItems.push({ area: T.roiTracing, before: T.roiTracingBefore, after: T.roiTracingAfter(fmtNum(ec.spans)), impact: T.roiTracingImpact, color: [100, 220, 160] });
  }
  if (ec.logs > 0) {
    roiItems.push({ area: T.roiLogs, before: T.roiLogsBefore, after: T.roiLogsAfter(fmtNum(ec.logs)), impact: T.roiLogsImpact, color: [220, 200, 100] });
  }
  if (ec.securityEvents > 0) {
    roiItems.push({ area: T.roiSecurity, before: T.roiSecurityBefore, after: T.roiSecurityAfter(fmtNum(ec.securityEvents)), impact: T.roiSecurityImpact, color: [255, 100, 100] });
  }
  if (ec.k8sClusters > 0) {
    roiItems.push({ area: T.roiK8s, before: T.roiK8sBefore, after: T.roiK8sAfter(fmtNum(ec.k8sClusters), fmtNum(ec.k8sNodes)), impact: T.roiK8sImpact, color: [130, 140, 255] });
  }
  if (ec.aiSpans > 0) {
    roiItems.push({ area: T.roiAi, before: T.roiAiBefore, after: T.roiAiAfter(fmtNum(ec.aiSpans)), impact: T.roiAiImpact, color: [220, 160, 255] });
  }

  if (roiItems.length > 0) {
    const colArea = M + 2, colBefore = M + 62, colAfter = M + 106, colImpact = M + 156;
    pdf.setFontSize(6.5); pdf.setFont("helvetica", "bold");
    pdf.setTextColor(90, 95, 130);
    pdf.text(T.colArea, colArea, y);
    pdf.text(T.colBefore, colBefore, y);
    pdf.text(T.colAfter, colAfter, y);
    pdf.text(T.colImpact, colImpact, y);
    y += 2.5;
    pdf.setDrawColor(40, 45, 70); pdf.line(M, y, W - M, y);
    y += 4;

    roiItems.forEach((r, idx) => {
      ensureSpace(10);
      if (idx % 2 === 0) {
        pdf.setFillColor(14, 17, 35);
        pdf.rect(M, y - 3.5, CW, 7, "F");
      }
      pdf.setFontSize(7); pdf.setFont("helvetica", "normal");
      pdf.setTextColor(210, 210, 230);
      pdf.text(r.area, colArea, y);
      pdf.setTextColor(200, 120, 120);
      pdf.text(r.before, colBefore, y);
      pdf.setTextColor(80, 210, 150);
      pdf.text(r.after, colAfter, y);
      pdf.setFontSize(7); pdf.setFont("helvetica", "bold");
      pdf.setTextColor(r.color[0], r.color[1], r.color[2]);
      pdf.text(r.impact, colImpact, y);
      y += 7.5;
    });

    pdf.setDrawColor(40, 45, 70); pdf.line(M, y - 3, W - M, y - 3);
    y += 4;
  }

  // ── Key Insight callout ──
  ensureSpace(20);
  pdf.setFillColor(20, 28, 55);
  pdf.setDrawColor(80, 180, 255);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(M, y, CW, 16, 2, 2, "FD");
  pdf.setLineWidth(0.2);
  pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
  pdf.setTextColor(80, 180, 255);
  pdf.text(T.keyInsight, M + 5, y + 5);
  pdf.setFontSize(7.5); pdf.setFont("helvetica", "normal");
  pdf.setTextColor(200, 200, 225);
  const insightText = strongCaps.length > 0
    ? T.insightStrong(strongCaps.length, strongCaps.map(c => c.name).join(", "), gapCaps.length, zeroCaps.length)
    : T.insightNoStrong(activeCaps.length, gapCaps.map(c => c.name).slice(0, 3).join(", "));
  const insightLines = pdf.splitTextToSize(insightText, CW - 10);
  pdf.text(insightLines, M + 5, y + 10);
  y += 22;

  // ── Why Dynatrace — compact differentiators ──
  ensureSpace(50);
  pdf.setFontSize(9); pdf.setFont("helvetica", "bold");
  pdf.setTextColor(55, 100, 220);
  pdf.text(T.whyDynatraceTitle, M, y);
  y += 6;

  type DiffItem = { title: string; brief: string; color: [number, number, number]; active: boolean };
  const diffs: DiffItem[] = [
    { title: T.diffDavisTitle, brief: T.diffDavisBrief(fmtNum(totalEntities)), color: [80, 220, 160], active: totalEntities > 0 },
    { title: T.diffSmartscapeTitle, brief: T.diffSmartscapeBrief(fmtNum(ec.hosts), fmtNum(ec.services)), color: [80, 180, 255], active: ec.hosts > 0 || ec.services > 0 },
    { title: T.diffGrailTitle, brief: T.diffGrailBrief(scanRec), color: [180, 140, 255], active: true },
    { title: T.diffOneAgentTitle, brief: T.diffOneAgentBrief, color: [255, 180, 80], active: true },
    { title: T.diffOpenPipelineTitle, brief: T.diffOpenPipelineBrief, color: [100, 220, 200], active: true },
    { title: T.diffSecurityTitle, brief: ec.securityEvents > 0 ? T.diffSecurityBrief(fmtNum(ec.securityEvents)) : T.diffSecurityBriefDefault, color: [255, 100, 100], active: true },
  ];

  diffs.filter(d => d.active).forEach(d => {
    ensureSpace(8);
    pdf.setFillColor(d.color[0], d.color[1], d.color[2]);
    pdf.roundedRect(M, y - 0.5, 2, 4, 0.5, 0.5, "F");
    pdf.setFontSize(7); pdf.setFont("helvetica", "bold");
    pdf.setTextColor(d.color[0], d.color[1], d.color[2]);
    pdf.text(d.title, M + 5, y + 2);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(170, 170, 200);
    pdf.text(d.brief, M + 5 + pdf.getTextWidth(d.title) + 3, y + 2);
    y += 5.5;
  });

  /* ═══════════════════════════════════════
     PAGE — WHAT DYNATRACE DISCOVERED
     ═══════════════════════════════════════ */
  pdf.addPage(); paintBg(); addTopBar();
  y = 22;
  sectionHeader(T.discoveryTitle, 30, 55, 120);

  pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
  pdf.setTextColor(200, 200, 225);
  const introText = T.discoveryIntro;
  const introLines = pdf.splitTextToSize(introText, CW);
  pdf.text(introLines, M, y);
  y += introLines.length * 4 + 4;

  // ── Capability scorecard with discovery data ──
  capabilities.forEach((cap) => {
    const sc = cap.score;
    const mc = maturity(sc);
    const [cr, cg, cb] = hexToRgb(cap.color);
    const [mcR, mcG, mcB] = hexToRgb(mc.color);
    const disc = capDiscovery[cap.name] || [];
    const passed = cap.criteriaResults.filter(c => c.points > 0).length;
    const total = cap.criteriaResults.length;

    ensureSpace(8 + disc.length * 3.5 + 4);

    pdf.setFillColor(cr, cg, cb);
    pdf.circle(M + 2, y + 1.5, 1.5, "F");
    pdf.setFontSize(7.5); pdf.setFont("helvetica", "bold");
    pdf.setTextColor(220, 220, 240);
    pdf.text(cap.name, M + 6, y + 2.5);
    pdf.setTextColor(mcR, mcG, mcB);
    pdf.text(`${sc}%`, M + 62, y + 2.5);

    const barX2 = M + 78, barW2 = 55;
    pdf.setFillColor(25, 25, 45);
    pdf.roundedRect(barX2, y + 0.5, barW2, 3.5, 1, 1, "F");
    if (sc > 0) {
      pdf.setFillColor(mcR, mcG, mcB);
      pdf.roundedRect(barX2, y + 0.5, Math.max(barW2 * sc / 100, 2), 3.5, 1, 1, "F");
    }

    pdf.setFontSize(6.5); pdf.setFont("helvetica", "normal");
    pdf.setTextColor(150, 150, 185);
    pdf.text(`${passed}/${total} ${T.criteria}`, M + barW2 + 82, y + 2.5);
    y += 6;

    if (disc.length > 0) {
      disc.forEach(d => {
        pdf.setFontSize(6); pdf.setFont("helvetica", "normal");
        pdf.setTextColor(160, 165, 200);
        pdf.text(`> ${d.text}`, M + 8, y);
        y += 3.3;
      });
    }
    y += 1.5;
  });

  // Summary line
  y += 2;
  pdf.setFontSize(7); pdf.setFont("helvetica", "bold");
  pdf.setTextColor(180, 180, 210);
  pdf.text(T.activeSummary(activeCaps.length, capabilities.length, passedCriteria, totalCriteria), W / 2, y, { align: "center" });
  y += 6;

  // ── Impact by Team ──
  ensureSpace(16);
  pdf.setDrawColor(55, 100, 220); pdf.setLineWidth(0.3);
  pdf.line(M, y, W - M, y);
  pdf.setLineWidth(0.2);
  y += 5;
  pdf.setFontSize(9); pdf.setFont("helvetica", "bold");
  pdf.setTextColor(55, 100, 220);
  pdf.text(T.impactByTeam, M, y);
  y += 6;

  type TeamDef = { team: string; color: [number, number, number]; caps: string[]; baseline: string };
  const teamDefs: TeamDef[] = [
    { team: T.teamSre, color: [80, 180, 255],
      caps: ["Infrastructure Observability", "Log Analytics", "Application Observability"],
      baseline: T.teamSreBaseline },
    { team: T.teamDevOps, color: [100, 220, 160],
      caps: ["Application Observability", "Software Delivery", "Infrastructure Observability"],
      baseline: T.teamDevOpsBaseline },
    { team: T.teamSecurity, color: [255, 130, 100],
      caps: ["Application Security", "Threat Observability"],
      baseline: T.teamSecurityBaseline },
    { team: T.teamBusiness, color: [220, 190, 80],
      caps: ["Digital Experience", "Business Observability"],
      baseline: T.teamBusinessBaseline },
    { team: T.teamAi, color: [180, 130, 255],
      caps: ["AI Observability"],
      baseline: T.teamAiBaseline },
  ];

  teamDefs.forEach(td => {
    const relevant = td.caps
      .map(cn => capabilities.find(c => c.name === cn))
      .filter((c): c is typeof capabilities[number] => !!c && c.score > 0);
    if (relevant.length === 0) return;

    ensureSpace(10);

    pdf.setFillColor(td.color[0], td.color[1], td.color[2]);
    pdf.roundedRect(M, y - 0.5, 2, 4, 0.5, 0.5, "F");
    pdf.setFontSize(7); pdf.setFont("helvetica", "bold");
    pdf.setTextColor(td.color[0], td.color[1], td.color[2]);
    pdf.text(td.team, M + 5, y + 2);
    y += 4.5;

    pdf.setFontSize(6); pdf.setFont("helvetica", "italic");
    pdf.setTextColor(170, 170, 200);
    pdf.text(td.baseline, M + 5, y);
    y += 3.5;

    pdf.setFontSize(6); pdf.setFont("helvetica", "normal");
    pdf.setTextColor(150, 155, 190);
    const capLine = relevant.map(c => `${c.name} ${c.score}%`).join("  |  ");
    pdf.text(capLine, M + 5, y);
    y += 5;
  });

  // Gap & opportunity callout
  if (zeroCaps.length > 0) {
    ensureSpace(8 + zeroCaps.length * 4);
    y += 2;
    pdf.setFontSize(7); pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 180, 80);
    pdf.text(T.opportunities, M, y);
    y += 4;
    zeroCaps.forEach(cap => {
      pdf.setFontSize(6); pdf.setFont("helvetica", "normal");
      pdf.setTextColor(170, 165, 185);
      pdf.text(`-  ${cap.name}`, M + 4, y);
      y += 3.5;
    });
  }

  /* ── Footer on every page ── */
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(6.5); pdf.setFont("helvetica", "normal");
    pdf.setTextColor(70, 70, 100);
    pdf.text(T.footer(tenant, date), M, H - 5);
    pdf.text(T.page(i, pageCount), W - M, H - 5, { align: "right" });
  }

  pdf.save(`first-day-results-${new Date().toISOString().slice(0, 10)}.pdf`);
}
