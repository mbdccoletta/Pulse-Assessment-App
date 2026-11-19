import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Text } from "@dynatrace/strato-components/typography";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Menu } from "@dynatrace/strato-components/navigation";
import { Chip, EmptyState, MessageContainer } from "@dynatrace/strato-components/content";
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
import { tracesNotEntitled, classicEntitiesMissing } from "../hooks/usePreflight";
import { applySmartscapeModel, type SmartscapeModelInfo } from "../entity-model";
import { loadFinOpsData, finopsNote, type FinOpsData } from "../finopsData";
import { applyTraceProxyMode } from "../trace-proxy";
import { TIER_CONFIG } from "../scale-tier";
import { applyLogMetricMode, logMetricAvailable } from "../log-metric";
import { TraceProxyBanner } from "../components/TraceProxyBanner";
import type { useAssessmentHistory } from "../hooks/useAssessmentHistory";

const SCALE = SCORE_BANDS.map(b => ({
  l: b.label,
  c: b.token,
  hex: b.color,
  r: `${b.min}-${b.max === 100 ? 100 : b.max - 1}%`,
  tip: b.label === "N/A" ? "Critical gaps — the capability is barely adopted or has no data flowing."
     : b.label === "Low" ? "Early adoption — some data exists but significant gaps remain."
     : b.label === "Moderate" ? "Partial coverage — key areas configured but important criteria still missing."
     : b.label === "Good" ? "Strong adoption — most criteria met with room for further optimization."
     : "Full or near-full coverage — the capability is well-adopted and comprehensive.",
}));


import { SCORE_BANDS } from "../utils/colors";

interface Props {
  /** Which result view this route shows; navigation lives in the AppHeader. */
  view?: ViewMode;
  history: ReturnType<typeof useAssessmentHistory>;
  coverageData: CoverageData;
  /** Scale Tier context (auto-detect + manual override). Optional so older
   *  callers / tests that don't thread the tier through still compile —
   *  in that case the banner is simply not rendered. */
  scale?: UseScaleTierResult;
  /** Production gate: when false (customer tenant, no `?dev=1`), the
   *  diagnostic controls (Force-refresh, Download perf JSON) are hidden.
   *  SEs flip the flag via URL or console to unlock the diagnostic surface. */
}

export const CoverageAssessment: React.FC<Props> = ({ view, history, coverageData, scale }) => {
  const { capabilities, totalScore, overallUtilizationLevel, loading, error, tenant, date, stats, start, refresh } = coverageData;
  const navigate = useNavigate();
  const lastSavedRef = useRef<string>("");
  const [chartSize, setChartSize] = useState(500);
  const [isMobile, setIsMobile] = useState(false);
  const viewMode = (view === "recommendations" ? "recommendations" : "coverage") as ViewMode;
  const rootRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [expandedPolar, setExpandedPolar] = useState(false);
  const wasLoadingRef = useRef(false);
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
  const [traceProxyMode, setTraceProxyMode] = useState(false);

  /** What the probes found in this environment; decides how the catalog is adapted. */
  const envRef = useRef({ noEntities: false, logMetric: false });
  /** The catalog for this environment. Order matters: the trace proxy brings
   *  classic entity queries, so the Smartscape rewrite must come after it. */
  const prepareCaps = useCallback((proxy: boolean) => {
    const env = envRef.current;
    let caps = CAPABILITIES;
    // Log coverage from the per-entity log metric: no log scan. Only with the
    // classic entity model, whose ids the metric and the denominators share.
    if (env.logMetric && !env.noEntities) caps = applyLogMetricMode(caps);
    if (proxy) caps = applyTraceProxyMode(caps).caps;
    const model = env.noEntities ? applySmartscapeModel(caps) : null;
    return { caps: model ? model.caps : caps, modelInfo: model ? model.info : null };
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
  const [entityModelInfo, setEntityModelInfo] = useState<SmartscapeModelInfo | null>(null);
  useEffect(() => {
    if (autoRanRef.current || loading || capabilities.length > 0) { if (capabilities.length > 0) setPreparing(false); return; }
    autoRanRef.current = true;
    (async () => {
      const [noTraces, noEntities, logMetric] = await Promise.all([
        tracesNotEntitled().catch(() => false),
        classicEntitiesMissing().catch(() => false),
        logMetricAvailable().catch(() => false),
      ]);
      envRef.current = { noEntities, logMetric };
      if (noTraces) setTraceProxyMode(true);
      const prepared = prepareCaps(noTraces);
      if (prepared.modelInfo) setEntityModelInfo(prepared.modelInfo);
      start(prepared.caps);
      setPreparing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, capabilities.length]);

  /** Banner metadata for the current run's selection; null when off. */
  const traceProxyInfo = useMemo(() => {
    if (!traceProxyMode) return null;
    return applyTraceProxyMode(CAPABILITIES).info;
  }, [traceProxyMode]);

  const dk = useCurrentTheme() === "dark";


  /* ── Reports: three PDFs and the raw data, all from the on-screen results ── */
  const appName = useAppNames();
  const reportInput = useCallback(() => ({
    capabilities, totalScore, tenant, date,
    adoption: adoption.unavailable || adoption.loading ? undefined
      : { windowDays: adoption.windowDays, totalUsers: adoption.totalUsers, byCapability: adoption.byCapability, apps: adoption.apps },
    history: history.snapshots,
    appName,
    run: {
      traceProxy: traceProxyMode,
      smartscape: !!entityModelInfo,
      estimated: !!scale && TIER_CONFIG[scale.tier].sampled,
      tier: scale?.tier,
    },
  }), [capabilities, totalScore, tenant, date, adoption, history.snapshots, appName, traceProxyMode, entityModelInfo, scale]);
  const runExport = useCallback((job: (m: Awaited<ReturnType<typeof loadReports>>) => void) => {
    if (exporting || capabilities.length === 0) return;
    setExporting(true);
    setTimeout(async () => {
      try { job(await loadReports()); } finally { setExporting(false); }
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

  // Save snapshot only when an assessment run finishes (loading transitions true → false).
  // In demo mode we DELIBERATELY skip the save: canned scenario values would
  // mix with real snapshots in Evolution Over Time and corrupt trend lines.
  useEffect(() => {
    if (loading) {
      wasLoadingRef.current = true;
      return;
    }
    // Wait for adoption: it is one of the three parts of the score being saved.
    if (wasLoadingRef.current && capabilities.length > 0 && coverageData.scoreSettled !== false) {
      wasLoadingRef.current = false;
      const sig = capabilities.map(c => `${c.name}:${c.score}`).join(",");
      // A run in which nothing could be measured (no connection, expired
      // session) is not a result: saving it would put a 0% run in the history.
      if (!nothingMeasured && sig !== lastSavedRef.current) {
        lastSavedRef.current = sig;
        history.saveSnapshot(capabilities, totalScore, tenant);
      }
    }
  }, [loading, capabilities, totalScore, tenant, history]);

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

  return (
    <Flex flexDirection="column" ref={rootRef} style={{ height: "100%",
      overflow: "auto", boxSizing: "border-box", padding: "0",
      fontFamily: "inherit",
      background: bg, color: text, transition: "background 0.4s, color 0.4s" }}>
      {/* Chart */}
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

      {!loading && capabilities.length > 0 && !nothingMeasured && (
        <>
          {/* Page actions live in the AppHeader (portal) — one bar for the whole app. */}
          {/* Intelligence layer: predefined questions, short answers, hand-off to Assist */}
          {/* Refresh and Reports live in the app header, next to the pages. Only these two:
              with the environment text there too, the header ran out of room and
              folded the navigation into the overflow button. */}
          {headerSlot && createPortal(
          <Flex alignItems="center" gap={8}>
            <Button onClick={freshRun} size="condensed"><Button.Prefix><RefreshIcon /></Button.Prefix>Refresh</Button>
            {/* Reports — persona PDFs (Executive / Tactical / Technical)
                and the Custom builder are client-side jsPDF and ship to
                every tenant. The Smart (Assist) item is the ONLY
                Davis-powered entry and stays dev-only. */}
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
          </Flex>, headerSlot)}
          <IntelligenceBar
            key={viewMode === "recommendations" ? "overall" : "overview"}
            questions={viewMode === "recommendations" ? QUESTIONS.overall : QUESTIONS.overview}
            ctx={{
              tenant, date, overallCoverage: totalScore, overallUtilization: overallUtilizationLevel, capabilities,
              lens: viewMode === "recommendations" ? LENS.overall : LENS.overview,
              pageNote: viewMode === "recommendations" ? overallFacts(capabilities, totalScore, adoption, appName) : overviewFacts(capabilities, adoption),
            }}
            actions={
          <Flex alignItems="center" gap={8}>
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
            <Flex flexDirection="column" alignItems="center" justifyContent="center" style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "visible", position: "relative" }}>
              <ExpandChartButton onClick={() => setExpandedPolar(true)} style={{ position: "absolute", top: 4, right: 8, zIndex: 10 }} />
              {/* Lead: where to look first. The three lowest capabilities below "Good", each one click from its detail. */}
              {(() => {
                const low = capabilities.map((c, i) => ({ c, i })).filter(x => x.c.score < 60).sort((a, b) => a.c.score - b.c.score).slice(0, 3);
                return (
                  <Flex alignItems="center" gap={8} flexWrap="wrap" style={{ position: "absolute", top: 8, left: 16, right: 48, zIndex: 10 }}>
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
              <Flex alignItems="center" justifyContent="center" style={{ width: "100%", flex: 1, minHeight: 0, paddingTop: 44 }}>
                <PulseRadar capabilities={capabilities} totalScore={totalScore} size={chartSize} onOpen={openCapability} onOpenOverall={() => navigate("/summary")} />
              </Flex>
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

      {/* Smart report via Dynatrace Assist. Reached from the Reports menu.
          No Davis call happens until the user submits a request. */}
      {(
        <SmartReportModal
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
        />
      )}

    </Flex>
  );
};
