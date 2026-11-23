import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Link, Text } from "@dynatrace/strato-components/typography";
import { MeterBarChart } from "@dynatrace/strato-components/charts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Menu } from "@dynatrace/strato-components/navigation";
import { Chip, EmptyState, MessageContainer } from "@dynatrace/strato-components/content";
import { PulseLoader } from "../components/PulseLoader";
import { showToast } from "@dynatrace/strato-components/notifications";
import { DownloadIcon, RefreshIcon } from "@dynatrace/strato-icons";
import type { CoverageData, ViewMode } from "../hooks/useCoverageData";
import { ExpandableChartModal, ExpandChartButton } from "../components/ExpandableChartModal";
import { ScaleTierBanner, COST_MODE_TEXT } from "../components/ScaleTierBanner";
import { DpsCostBadge } from "../components/DpsCostBadge";
import type { UseScaleTierResult } from "../hooks/useScaleTier";
import { NO_ADOPTION } from "../hooks/useAppAdoption";
import { CAPABILITIES } from "../queries";
import { IntelligenceBar } from "../components/IntelligenceBar";
import { LENS, QUESTIONS, overviewFacts, overallFacts } from "../ai/pageIntelligence";
import { PulseRadar } from "../components/PulseRadar";
import { ExecutiveSummary } from "./ExecutiveSummary";
import type { ReportKind, ReportLang } from "../reports/pulseReports";
import { useAppNames } from "../hooks/useAppNames";
// Report code (and jsPDF) is only needed after a click: load it on demand.
const loadReports = () => import("../reports/pulseReports");
import { SmartReportModal } from "../components/SmartReportModal";
import { tracesNotEntitled, classicEntitiesMissing, detectTelemetry, simulatedOtelSkipsLogScans } from "../hooks/usePreflight";
import { TELEMETRY_LABEL, telemetryShares, telemetrySummary, setCurrentTelemetry, getCurrentTelemetry, type TelemetryProfile } from "../telemetry";
import { Tooltip } from "../components/Tooltip";
import { applyOtelMode, applyMixedMode, mixedActions, OTEL_ACTIONS, type OtelModeInfo, type TelemetrySource } from "../otel-mode";
import { setActionOverrides, CRITERION_ACTIONS } from "../remediationActions";
import { applySmartscapeModel, type SmartscapeModelInfo } from "../entity-model";
import { loadFinOpsData, finopsNote, type FinOpsData } from "../finopsData";
import { applyTraceProxyMode } from "../trace-proxy";
import { TIER_CONFIG } from "../scale-tier";
import { applyLogMetricMode, logMetricAvailable } from "../log-metric";
import { loadOwnershipTeams, type OwnershipTeam } from "../teams";
import { TraceProxyBanner } from "../components/TraceProxyBanner";
import type { useAssessmentHistory } from "../hooks/useAssessmentHistory";

const SCALE = SCORE_BANDS.map(b => ({
  l: b.label,
  c: b.token,
  hex: b.color,
  r: `${b.min}-${b.max === 100 ? 100 : b.max - 1}%`,
  tip: b.label === "Critical" ? "Critical gaps — the capability is barely adopted or has no data flowing."
     : b.label === "Low" ? "Early adoption — some data exists but significant gaps remain."
     : b.label === "Moderate" ? "Partial coverage — key areas configured but important criteria still missing."
     : b.label === "Good" ? "Strong adoption — most criteria met with room for further optimization."
     : "Full or near-full coverage — the capability is well-adopted and comprehensive.",
}));


import { SCORE_BANDS, scoreBand } from "../utils/colors";

interface Props {
  /** Which result view this route shows; navigation lives in the AppHeader. */
  view?: ViewMode;
  history: ReturnType<typeof useAssessmentHistory>;
  coverageData: CoverageData;
  /** Scale Tier context (auto-detect + manual override). Optional so older
   *  callers / tests that don't thread the tier through still compile —
   *  in that case the banner is simply not rendered. */
  scale?: UseScaleTierResult;
  /** Render only the header actions (Refresh, Reports) and the dialogs they
   *  open: used on the pages that do not show the assessment itself. */
  headerOnly?: boolean;
  /** Production gate: when false (customer tenant, no `?dev=1`), the
   *  diagnostic controls (Force-refresh, Download perf JSON) are hidden.
   *  SEs flip the flag via URL or console to unlock the diagnostic surface. */
}

export const CoverageAssessment: React.FC<Props> = ({ view, history, coverageData, scale, headerOnly }) => {
  const { capabilities, totalScore, overallUtilizationLevel, loading, error, tenant, date, stats, start, refresh } = coverageData;
  const navigate = useNavigate();
  const [chartSize, setChartSize] = useState(500);
  const [isMobile, setIsMobile] = useState(false);
  const viewMode = (view === "recommendations" ? "recommendations" : "coverage") as ViewMode;
  const rootRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [expandedPolar, setExpandedPolar] = useState(false);
  /** Smart report via Dynatrace Assist. */
  const [showSmartReport, setShowSmartReport] = useState(false);

  /** Platform adoption: the app's single reading (App.tsx), one of the three
   *  parts of every capability score. */
  const adoption = coverageData.adoption ?? NO_ADOPTION;

  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderSlot(document.getElementById("pulse-header-actions")); }, []);

  const openCapability = useCallback((idx: number) => {
    const cap = capabilities[idx];
    if (cap) navigate(`/capability/${encodeURIComponent(cap.name.replace(/\//g, "~"))}`);
  }, [capabilities, navigate]);

  /** Trace Proxy Mode — set when preflight found every source fine except
   *  the tenant-level Traces on Grail entitlement and the user chose to
   *  continue. Span checks run against metric/topology proxies; unproxiable
   *  ones (incl. all of AI/LLM Observability) leave the scoring denominator.
   *  See ../trace-proxy.ts and docs/STUDY-CLASSIC-SAAS-NO-GRAIL-TRACES.md. */
  const [traceProxyMode, setTraceProxyMode] = useState(() => session.traceProxy);

  /** What the probes found in this environment; decides how the catalog is adapted. */
  const envRef = useRef<RunEnv>(session.env);
  /** The catalog for this environment. Order matters: the trace proxy brings
   *  classic entity queries, so the Smartscape rewrite must come after it. */
  const prepareCaps = useCallback((proxy: boolean) => {
    const env = envRef.current;
    let caps = CAPABILITIES;
    // Log coverage from the per-entity log metric: no log scan. Only with the
    // classic entity model, whose ids the metric and the denominators share.
    // Stays on in an OpenTelemetry-only environment: the criteria the OpenTelemetry mode
    // does not swap (logs per service, error logs, severity) must keep their free reading.
    if (env.logMetric && !env.noEntities) caps = applyLogMetricMode(caps);
    if (proxy) caps = applyTraceProxyMode(caps).caps;
    // No OneAgent: hosts and Kubernetes are read from the OpenTelemetry signals.
    // Applied before the Smartscape rewrite, which only touches entity queries
    // and so leaves these metric readings alone.
    setActionOverrides(null);
    const skipLogScans = simulatedOtelSkipsLogScans();
    const otel = env.source === "otel" ? applyOtelMode(caps, { skipLogScans })
      : env.source === "mixed" ? applyMixedMode(caps, { skipLogScans }) : null;
    if (otel) caps = otel.caps;
    setActionOverrides(env.source === "otel" ? OTEL_ACTIONS : env.source === "mixed" ? mixedActions(CRITERION_ACTIONS) : null);
    const model = env.noEntities ? applySmartscapeModel(caps) : null;
    return { caps: model ? model.caps : caps, modelInfo: model ? model.info : null, otelInfo: otel ? otel.info : null };
  }, []);

  /** Refresh means new readings: drop the 24h result cache, then run. Opening
   *  the app keeps serving the cache; only this explicit click pays for a scan. */
  const freshRun = useCallback(async () => {
    try { await coverageData.forceRefresh(); } catch { /* a cache that cannot be cleared still allows the run */ }
    adoption.refresh();
    refresh();
  }, [coverageData, refresh, adoption]);

  const startFiltered = useCallback((useProxy?: boolean) => {
    // useProxy overrides the state for the click that ENABLES the mode —
    // setTraceProxyMode hasn't re-rendered this closure yet at that point.
    const proxy = useProxy ?? traceProxyMode;
    // A refresh runs the same catalog the probes chose for this environment
    // (Smartscape model, log metric), not the default one.
    start(prepareCaps(proxy).caps);
  }, [start, traceProxyMode, prepareCaps]);

  // The app opens on the assessment: run once on first open. A run from the
  // last 24h is served from the cache; otherwise this is a full run.
  // Before it, one probe decides by itself whether the tenant has Traces on
  // Grail; without it the run uses Trace Proxy Mode, so the app works on
  // either licensing model with no setup step.
  const autoRanRef = useRef(false);

  const [preparing, setPreparing] = useState(capabilities.length === 0);
  /** Set when the run reads Smartscape because the classic entity tables are absent. */
  const [entityModelInfo, setEntityModelInfo] = useState<SmartscapeModelInfo | null>(() => session.modelInfo);
  /** Set when the run reads hosts and Kubernetes from OpenTelemetry because no OneAgent reports. */
  const [otelInfo, setOtelInfo] = useState<OtelModeInfo | null>(() => session.otelInfo);
  /** Where the telemetry comes from: OneAgent, OpenTelemetry or both. */
  const [telemetry, setTelemetry] = useState<TelemetryProfile | null>(() => getCurrentTelemetry());
  const telemetrySource: TelemetrySource = telemetry?.source ?? "oneagent";
  useEffect(() => {
    if (autoRanRef.current || loading || capabilities.length > 0) { if (capabilities.length > 0) setPreparing(false); return; }
    // Wait for the host count: it picks the scale tier, and a run started
    // before it would read with the wrong windows.
    if (scale?.detecting) return;
    autoRanRef.current = true;
    (async () => {
      const [noTraces, noEntities, logMetric] = await Promise.all([
        tracesNotEntitled().catch(() => false),
        classicEntitiesMissing().catch(() => false),
        logMetricAvailable().catch(() => false),
      ]);
      const profile = await detectTelemetry(noEntities).catch((): TelemetryProfile => ({ source: "oneagent", oneAgentHosts: 0, otelOnlyHosts: 0, sharedHosts: 0 }));
      envRef.current = { noEntities, logMetric, source: profile.source };
      session.env = envRef.current;
      session.traceProxy = noTraces;
      setTelemetry(profile);
      setCurrentTelemetry(profile);
      if (noTraces) setTraceProxyMode(true);
      const prepared = prepareCaps(noTraces);
      session.modelInfo = prepared.modelInfo;
      session.otelInfo = prepared.otelInfo;
      if (prepared.modelInfo) setEntityModelInfo(prepared.modelInfo);
      if (prepared.otelInfo) setOtelInfo(prepared.otelInfo);
      start(prepared.caps);
      setPreparing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, capabilities.length, scale?.detecting]);

  /** Banner metadata for the current run's selection; null when off. */
  const traceProxyInfo = useMemo(() => {
    if (!traceProxyMode) return null;
    return applyTraceProxyMode(CAPABILITIES).info;
  }, [traceProxyMode]);

  const dk = useCurrentTheme() === "dark";


  /* ── Reports: three PDFs and the raw data, all from the on-screen results ── */
  const appName = useAppNames();
  /** Ownership teams for the "teams to involve" lines: read once, when the first report is asked for. */
  const teamsRef = useRef<OwnershipTeam[] | null | undefined>(undefined);
  const reportInput = useCallback(() => ({
    teams: teamsRef.current ?? null,
    capabilities, totalScore, tenant, date,
    adoption: adoption.unavailable || adoption.loading ? undefined
      : { windowDays: adoption.windowDays, totalUsers: adoption.totalUsers, byCapability: adoption.byCapability, apps: adoption.apps },
    history: history.snapshots,
    appName,
    run: {
      traceProxy: traceProxyMode,
      smartscape: !!entityModelInfo,
      otel: telemetrySource === "otel",
      mixed: telemetrySource === "mixed",
      telemetry: telemetry ?? undefined,
      estimated: !!scale && TIER_CONFIG[scale.tier].sampled,
      tier: scale?.tier,
    },
  }), [capabilities, totalScore, tenant, date, adoption, history.snapshots, appName, traceProxyMode, entityModelInfo, otelInfo, telemetry, telemetrySource, scale]);
  const runExport = useCallback((job: (m: Awaited<ReturnType<typeof loadReports>>) => void) => {
    if (exporting || capabilities.length === 0) return;
    setExporting(true);
    setTimeout(async () => {
      try {
        if (teamsRef.current === undefined) teamsRef.current = await loadOwnershipTeams();
        job(await loadReports());
      } finally { setExporting(false); }
    }, 0);
  }, [exporting, capabilities.length]);
  const generateReport = useCallback((kind: ReportKind, lang: ReportLang) =>
    runExport(m => m.generateReport(kind, reportInput(), lang)), [runExport, reportInput]);
  const exportRaw = useCallback((format: "json" | "csv") =>
    runExport(m => m.exportRawData(format, reportInput())), [runExport, reportInput]);

  /* ── FinOps: what Cost & Carbon Optimization stored, loaded on demand ── */
  const [finops, setFinops] = useState<FinOpsData | null | undefined>(undefined); // undefined = not loaded yet
  const ensureFinops = useCallback(async (): Promise<FinOpsData | null> => {
    if (finops !== undefined) return finops;
    const d = await loadFinOpsData();
    setFinops(d);
    return d;
  }, [finops]);
  const generateFinOps = useCallback(async (lang: ReportLang) => {
    if (exporting || capabilities.length === 0) return;
    setExporting(true);
    try {
      const d = await ensureFinops();
      if (!d) { showToast({ type: "warning", title: "No FinOps data", message: "Cost & Carbon Optimization has written no cost or carbon data in this environment." }); return; }
      (await loadReports()).generateFinOpsReport(reportInput(), d, lang);
    } finally { setExporting(false); }
  }, [exporting, capabilities.length, ensureFinops, reportInput]);
  /** FinOps facts for the Smart report, fetched only when a request asks about cost, energy or carbon. */
  const loadFinopsNote = useCallback(async () => { const d = await ensureFinops(); return d ? finopsNote(d) : undefined; }, [ensureFinops]);


  /** True when no criterion of any capability could be measured. */
  const nothingMeasured = capabilities.length > 0 && capabilities.every(c => c.assessedCount === 0);

  // The run is saved to the history in App.tsx, so it is saved on any page.

  // Auto-size chart — use ResizeObserver for notebook/embedded containers
  useEffect(() => {
    const el = rootRef.current;
    let tid: ReturnType<typeof setTimeout>;
    const calc = () => {
      const vh = el ? el.offsetHeight || window.innerHeight : window.innerHeight;
      const vw = el ? el.offsetWidth : window.innerWidth;
      const mobile = vw < 640;
      setIsMobile(mobile);
      // Reserve space for toolbar (~50px) + collapsed guide bar (~32px) + padding
      // header + intelligence bar + "Needs attention" row + the labels drawn outside the plot
      const reserve = mobile ? 220 : 330;
      // The chart is the whole page now (the side cards moved to the detail page).
      const maxSide = Math.min(vh - reserve, (vw - (mobile ? 32 : 48)) * 0.5, 620);
      setChartSize(Math.max(maxSide, mobile ? 200 : 220));
    };
    const debounced = () => { clearTimeout(tid); tid = setTimeout(calc, 100); };
    calc();
    if (el && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(debounced);
      ro.observe(el);
      return () => { ro.disconnect(); clearTimeout(tid); };
    }
    window.addEventListener("resize", debounced);
    return () => { window.removeEventListener("resize", debounced); clearTimeout(tid); };
  }, []);



  // Theme colors: Strato design tokens, so dark and light follow the platform.
  const bg = Colors.Background.Base.Default;
  const text = Colors.Text.Neutral.Default;
  const textSec = Colors.Text.Neutral.Subdued;

  /** The readings are in but adoption, one of the three parts of every score,
   *  is still on its way: keep the loader up instead of painting a score that
   *  changes a few seconds later. */
  const waitingScore = !loading && capabilities.length > 0 && coverageData.scoreSettled === false;
  /** Refresh and Reports, portalled into the app header. Built here so every
   *  page shows them (other routes mount this component with `headerOnly`). */
  const headerActions = !loading && capabilities.length > 0 && !nothingMeasured
    ? (headerSlot && createPortal(
          <Flex alignItems="center" gap={8}>
            <Button onClick={freshRun} size="condensed"><Button.Prefix><RefreshIcon /></Button.Prefix>Refresh</Button>
            {/* Reports: the PDFs and the raw export are built in the browser
                (jsPDF). The Smart report is the only entry that calls Davis
                CoPilot, and only when the user submits it. */}
            {(
              <Menu>
                <Menu.Trigger>
                  <Button loading={exporting} size="condensed">
                    <Button.Prefix><DownloadIcon /></Button.Prefix>
                    Reports
                  </Button>
                </Menu.Trigger>
                <Menu.Content>
                  {([
                    ["overall", "Overall score"],
                    ["plan", "Action plan"],
                    ["criteria", "Criteria detail"],
                  ] as [ReportKind, string][]).map(([p, label]) => (
                    <Menu.Sub key={p}>
                      <Menu.SubTrigger>{label}</Menu.SubTrigger>
                      <Menu.SubContent>
                        <Menu.Item onSelect={() => generateReport(p, "en")}>English</Menu.Item>
                        <Menu.Item onSelect={() => generateReport(p, "pt")}>Português</Menu.Item>
                        <Menu.Item onSelect={() => generateReport(p, "es")}>Español</Menu.Item>
                      </Menu.SubContent>
                    </Menu.Sub>
                  ))}
                  <Menu.Sub>
                    <Menu.SubTrigger>FinOps</Menu.SubTrigger>
                    <Menu.SubContent>
                      <Menu.Item onSelect={() => generateFinOps("en")}>English</Menu.Item>
                      <Menu.Item onSelect={() => generateFinOps("pt")}>Português</Menu.Item>
                      <Menu.Item onSelect={() => generateFinOps("es")}>Español</Menu.Item>
                    </Menu.SubContent>
                  </Menu.Sub>
                  <Menu.Sub>
                    <Menu.SubTrigger>Raw data</Menu.SubTrigger>
                    <Menu.SubContent>
                      <Menu.Item onSelect={() => exportRaw("json")}>JSON</Menu.Item>
                      <Menu.Item onSelect={() => exportRaw("csv")}>CSV</Menu.Item>
                    </Menu.SubContent>
                  </Menu.Sub>
                  <Menu.Item onSelect={() => setShowSmartReport(true)}>Smart (Assist)…</Menu.Item>
                </Menu.Content>
              </Menu>
            )}
          </Flex>, headerSlot))
    : null;
  /** The Smart report dialog the Reports menu opens. */
  const smartReport = (<SmartReportModal
          open={showSmartReport}
          onClose={() => setShowSmartReport(false)}
          ctx={{
            tenant: tenant ?? "(unknown)",
            date: date ?? "",
            overallCoverage: totalScore,
            overallUtilization: overallUtilizationLevel,
            capabilities,
            finopsNote: finops ? finopsNote(finops) : undefined,
            // The same lens and computed facts as the Overall score page, so the
            // report ranks by the gains the app computed instead of its own.
            lens: LENS.overall,
            pageNote: overallFacts(capabilities, totalScore, adoption, appName),
          }}
          loadFinopsNote={loadFinopsNote}
          dk={dk}
        />);
  if (headerOnly) return <>{headerActions}{smartReport}</>;

  return (
    <Flex flexDirection="column" ref={rootRef} style={{ height: "100%",
      overflow: "auto", boxSizing: "border-box", padding: "0",
      fontFamily: "inherit",
      background: bg, color: text, transition: "background 0.4s, color 0.4s" }}>
      {/* A run in flight: say so. Without this the page stayed blank until the
          last query returned, on first open and on every Refresh. */}
      {(loading || preparing || waitingScore) && (
        <Flex alignItems="center" justifyContent="center" style={{ flex: 1, padding: 48 }}>
          <Flex flexDirection="column" gap={8} style={{ width: "min(420px, 100%)" }}>
            <PulseLoader value={loading ? coverageData.progress : undefined} />
          </Flex>
        </Flex>
      )}

      {/* No start page: the app opens on the assessment. This only shows if a run produced nothing. */}
      {!loading && !preparing && capabilities.length === 0 && (
        <Flex alignItems="center" justifyContent="center" style={{ flex: 1, padding: 48 }}>
          <EmptyState>
            <EmptyState.VisualPreset context="chart" type="something-missing" />
            <EmptyState.Title>No assessment results</EmptyState.Title>
            <EmptyState.Actions><Button variant="accent" color="primary" onClick={() => startFiltered()}>Run assessment</Button></EmptyState.Actions>
          </EmptyState>
        </Flex>
      )}

      {/* Nothing could be measured: say so instead of drawing a 0% assessment. */}
      {!loading && nothingMeasured && (
        <Flex alignItems="center" justifyContent="center" style={{ flex: 1, padding: 48 }}>
          <EmptyState>
            <EmptyState.VisualPreset context="generic" type="something-wrong" />
            <EmptyState.Title>The assessment could not read this environment</EmptyState.Title>
            <EmptyState.Details>None of the queries returned. This usually means the connection to the environment was lost or the session expired.</EmptyState.Details>
            <EmptyState.Actions><Button variant="accent" color="primary" onClick={refresh}>Try again</Button></EmptyState.Actions>
          </EmptyState>
        </Flex>
      )}

      {!loading && !waitingScore && capabilities.length > 0 && !nothingMeasured && (
        <>
          {/* Page actions live in the AppHeader (portal) — one bar for the whole app. */}
          {/* Intelligence layer: predefined questions, short answers, hand-off to Assist */}
          {/* Refresh and Reports live in the app header, next to the pages. Only these two:
              with the environment text there too, the header ran out of room and
              folded the navigation into the overflow button. */}
          {headerActions}
          <IntelligenceBar
            key={viewMode === "recommendations" ? "overall" : "overview"}
            questions={viewMode === "recommendations" ? QUESTIONS.overall : QUESTIONS.overview}
            ctx={{
              tenant, date, overallCoverage: totalScore, overallUtilization: overallUtilizationLevel, capabilities,
              lens: viewMode === "recommendations" ? LENS.overall : LENS.overview,
              pageNote: `${telemetry ? `Telemetry strategy: ${telemetrySummary(telemetry)}. ${TELEMETRY_FACT[telemetry.source]}\n` : ""}${viewMode === "recommendations" ? overallFacts(capabilities, totalScore, adoption, appName) : overviewFacts(capabilities, adoption)}`,
            }}
            actions={
          <Flex alignItems="center" gap={8}>
            {telemetry && <TelemetryChip profile={telemetry} />}
            <Text style={{ fontSize: 12, color: textSec }}>
              <Text style={{ fontWeight: 600, color: text }}>{tenant}</Text> · {date}
              {stats && stats.failed > 0 && (
                <Text style={{ marginLeft: 8, fontSize: 12, color: Colors.Text.Warning.Default }}>
                  · {stats.failed} {stats.failed === 1 ? "check" : "checks"} could not run
                </Text>
              )}
              <DpsCostBadge
                note={COST_MODE_TEXT}
                stats={stats}
                partialCount={capabilities.reduce((n, c) => n + c.criteriaResults.filter(r => r.partial).length, 0)}
                liveScannedBytes={coverageData.liveScannedBytes}
                lastRunMeta={coverageData.lastRunMeta}
                loading={loading}
                textColor={text}
                textSecColor={textSec}
              />
            </Text>
          </Flex>
            }
          />
          {/* Scale Tier banner — only renders when tier !== 'exact'. Tells the
              viewer that coverage values are sampled estimates and exposes a
              manual override toggle. Component is a no-op on small/medium
              tenants, so this insertion is zero-impact for the existing UX. */}
          {scale && (
            <Flex style={{ padding: "0 16px", marginTop: 8, flexShrink: 0 }}>
              <ScaleTierBanner scale={scale} />
            </Flex>
          )}
          {/* Trace Proxy Mode banner — renders only after the user continued
              without the Traces on Grail entitlement. Same disclosure
              contract as the Scale Tier banner: proxied scores are never
              shown without saying so. */}
          {traceProxyInfo && (
            <Flex style={{ padding: "0 16px", marginTop: 8, flexShrink: 0 }}>
              <TraceProxyBanner info={traceProxyInfo} />
            </Flex>
          )}
          {/* Same disclosure contract for the Smartscape entity model. */}
          {entityModelInfo && (
            <Flex style={{ padding: "0 16px", marginTop: 8, flexShrink: 0 }}>
              <MessageContainer variant="primary" style={{ width: "100%" }}>
                <MessageContainer.Prefix />
                <MessageContainer.Title>Smartscape entity model</MessageContainer.Title>
                <MessageContainer.Description>
                  {`This environment has no classic entity tables, so entity counts are read from Smartscape (${entityModelInfo.rewrittenIds.length} criteria). ${entityModelInfo.excludedIds.length} criteria with no Smartscape equivalent are left out of the score instead of counting as not met.`}
                </MessageContainer.Description>
              </MessageContainer>
            </Flex>
          )}
          {/* Main content: chart left, cards right — stacks vertically on mobile */}
          <Flex style={{ flex: 1, flexDirection: isMobile ? "column" : "row", minHeight: 0, overflow: "auto" }}>
          {viewMode === "coverage" ? (<>
            {/* Left: chart + scale */}
            <Flex flexDirection="column" alignItems="center" justifyContent="flex-start" style={{ flex: 1, minWidth: 0, position: "relative" }}>
              {!isMobile && <ExpandChartButton onClick={() => setExpandedPolar(true)} style={{ position: "absolute", top: 4, right: 8, zIndex: 10 }} />}
              {/* Lead: where to look first. The three lowest capabilities below "Good", each one click from its detail. */}
              {(() => {
                const low = capabilities.map((c, i) => ({ c, i })).filter(x => x.c.score < 60).sort((a, b) => a.c.score - b.c.score).slice(0, 3);
                return (
                  <Flex alignItems="center" gap={8} flexWrap="wrap" style={{ alignSelf: "stretch", flexShrink: 0, padding: isMobile ? "12px 16px 0" : "8px 48px 0 16px" }}>
                    <Text style={{ fontSize: 13, fontWeight: 700, color: text }}>{low.length > 0 ? "Needs attention" : "All capabilities at 60% or above"}</Text>
                    {low.map(({ c, i }) => (
                      <Chip key={c.name} color={c.score < 40 ? "critical" : "warning"} onClick={(e: React.MouseEvent) => { e.stopPropagation(); openCapability(i); }}>
                        {c.name} <strong style={{ fontVariantNumeric: "tabular-nums" }}>{c.score}%</strong>
                      </Chip>
                    ))}
                  </Flex>
                );
              })()}
              {/* Three-part radar: coverage, utilization and adoption per capability; click opens the detail */}
              {isMobile ? (
                /* A phone is too narrow for the radar's labels: the same scores as a list, lowest first. */
                <Flex flexDirection="column" gap={16} style={{ alignSelf: "stretch", padding: "16px 16px 32px" }}>
                  <Flex alignItems="baseline" gap={8}>
                    <Text style={{ fontSize: 13, fontWeight: 700, color: text }}>Overall score</Text>
                    <Link onClick={() => navigate("/summary")}><strong style={{ fontVariantNumeric: "tabular-nums" }}>{totalScore}%</strong></Link>
                    <Text textStyle="small" style={{ color: scoreBand(totalScore).text }}>{scoreBand(totalScore).label}</Text>
                  </Flex>
                  {capabilities.map((c, i) => ({ c, i })).sort((a, b) => a.c.score - b.c.score).map(({ c, i }) => (
                    <MeterBarChart key={c.name} value={Math.floor(c.score)} min={0} max={100} color={scoreBand(c.score).token} size="size8" formatter={(v: number) => `${Math.floor(v)}%`}>
                      <MeterBarChart.Label><Link onClick={() => openCapability(i)}>{c.name}</Link></MeterBarChart.Label>
                      <MeterBarChart.Value>{`${Math.floor(c.score)}%`}</MeterBarChart.Value>
                    </MeterBarChart>
                  ))}
                </Flex>
              ) : (
                <Flex alignItems="center" justifyContent="center" style={{ width: "100%", flex: "1 0 auto", paddingTop: 8 }}>
                  <PulseRadar capabilities={capabilities} totalScore={totalScore} size={chartSize} onOpen={openCapability} onOpenOverall={() => navigate("/summary")} />
                </Flex>
              )}
            </Flex>

            {/* ── Expanded TechRadar Modal ── */}
            <ExpandableChartModal open={expandedPolar} onClose={() => setExpandedPolar(false)} maxWidth={1100} maxHeight={1000}>
              <Flex flexDirection="column" alignItems="center" style={{ width: "100%", height: "100%" }}>
                <Flex alignItems="center" justifyContent="center" style={{ flex: 1, minHeight: 0, width: "100%" }}>
                  {(() => {
                    const modalSize = Math.min(window.innerWidth * 0.75, window.innerHeight * 0.7, 900);
                    return (
                      <PulseRadar capabilities={capabilities} totalScore={totalScore} size={modalSize * 0.62}
                        onOpen={(i) => { setExpandedPolar(false); openCapability(i); }}
                        onOpenOverall={() => { setExpandedPolar(false); navigate("/summary"); }} />
                    );
                  })()}
                </Flex>
                <Flex alignItems="center" justifyContent="center" gap={4} flexWrap="wrap" style={{ padding: "8px 0 4px", flexShrink: 0 }}>
                  {SCALE.map((x) => (
                    <Flex key={x.l} alignItems="center" gap={2} style={{ padding: "2px 8px", borderRadius: 6,
                      background: x.hex + (dk ? "20" : "12") }}>
                      <Flex style={{ width: 5, height: 5, borderRadius: "50%", background: x.c }} />
                      <Text style={{ fontSize: 12, color: text, fontWeight: 600 }}>{x.l}</Text>
                      <Text style={{ fontSize: 12, color: text, fontWeight: 500 }}>{x.r}</Text>
                    </Flex>
                  ))}
                </Flex>
              </Flex>
            </ExpandableChartModal>

          </>) : (
            <ExecutiveSummary capabilities={capabilities} totalScore={totalScore} history={history} adoption={adoption} />
          )}
          </Flex>

        </>
      )}

      {/* Error State */}
      {error && (
        <Flex flexDirection="column" style={{ textAlign: "center", padding: 24, color: Colors.Text.Critical.Default }}>
          <Flex flexDirection="column" style={{ fontSize: 14, marginBottom: 8 }}>Assessment failed</Flex>
          <Flex flexDirection="column" style={{ fontSize: 12, color: textSec }}>{error}</Flex>
        </Flex>
      )}

      {smartReport}

    </Flex>
  );
};

/** What each strategy means for the reading, for the AI facts. */
const TELEMETRY_FACT: Record<TelemetrySource, string> = {
  oneagent: "Every criterion reads OneAgent data.",
  mixed: "Hosts, Kubernetes, processes and logs are counted on both sides, a host seen by both once; criteria that only exist with OneAgent measure the OneAgent part.",
  otel: "Hosts, Kubernetes and logs are read from OpenTelemetry metrics and attributes; criteria that only exist with OneAgent are left out of the score.",
};

/** What the probes found in this environment; decides how the catalog is adapted. */
interface RunEnv { noEntities: boolean; logMetric: boolean; source: TelemetrySource }

/** What the first open of the session detected. The Overview unmounts when the
 *  user opens another page, and the probes run only once per session, so the
 *  page reads its run modes back from here instead of starting from defaults:
 *  otherwise the chip disappears and a Refresh runs the default catalog. */
const session: {
  env: RunEnv;
  traceProxy: boolean;
  modelInfo: SmartscapeModelInfo | null;
  otelInfo: OtelModeInfo | null;
} = { env: { noEntities: false, logMetric: false, source: "oneagent" }, traceProxy: false, modelInfo: null, otelInfo: null };

/** The telemetry strategy, as a neutral chip: a fact about the estate, not a judgement.
 *  Shares on screen; counts and what the strategy changes in the tooltip. */
const TelemetryChip: React.FC<{ profile: TelemetryProfile }> = ({ profile }) => {
  const s = telemetryShares(profile);
  const label = profile.source === "mixed"
    ? `${TELEMETRY_LABEL.mixed} · OneAgent ${s.oneAgent}% · OpenTelemetry ${s.otelOnly}%`
    : TELEMETRY_LABEL[profile.source];
  const tip = [
    `Telemetry strategy: ${TELEMETRY_LABEL[profile.source]}.`,
    profile.oneAgentHosts + profile.otelOnlyHosts > 0
      ? `${profile.oneAgentHosts.toLocaleString()} hosts monitored by OneAgent (${profile.sharedHosts.toLocaleString()} of them also report OpenTelemetry); ${profile.otelOnlyHosts.toLocaleString()} hosts and Kubernetes nodes reported only through OpenTelemetry.`
      : "",
    TELEMETRY_FACT[profile.source],
  ].filter(Boolean).join("\n");
  return (
    <Tooltip text={tip}>
      {/* The Chip caps its width at 250px and cuts the text; the label must show in full. */}
      <Chip size="condensed" color="neutral" style={{ maxWidth: "none" }}>{label}</Chip>
    </Tooltip>
  );
};
