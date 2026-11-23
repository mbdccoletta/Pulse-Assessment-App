import { ToastContainer } from "@dynatrace/strato-components/notifications";
import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppHeader, Flex, HelpMenu, PageLayout } from "@dynatrace/strato-components/layouts";
import { Skeleton, SkeletonText } from "@dynatrace/strato-components/content";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAssessmentHistory } from "./hooks/useAssessmentHistory";
import { useCoverageData } from "./hooks/useCoverageData";
import { useScaleTier } from "./hooks/useScaleTier";
import { useAppAdoption } from "./hooks/useAppAdoption";
import { withPulseScore } from "./pulseScore";

const CoverageAssessment = React.lazy(() =>
  import("./pages/CoverageAssessment").then(m => ({ default: m.CoverageAssessment }))
);
const GuidePage = React.lazy(() =>
  import("./pages/GuidePage").then(m => ({ default: m.GuidePage }))
);
const EvolutionPage = React.lazy(() =>
  import("./pages/EvolutionPage").then(m => ({ default: m.EvolutionPage }))
);
const CapabilityDetailPage = React.lazy(() =>
  import("./pages/CapabilityDetailPage").then(m => ({ default: m.CapabilityDetailPage }))
);

export const App = () => {
  const history = useAssessmentHistory();
  // Live host-count detection drives the Scale Tier choice. See
  // ./scale-tier.ts for the contract.
  const scale = useScaleTier();
  // Dev mode gates SE-facing diagnostic controls (perf JSON download,
  // force-refresh). Active when ?dev=1 or localStorage.cca.dev is set.
  // In a customer tenant with neither, the diagnostic surface is hidden.
  // Thread the scale metadata into useCoverageData so the downloadable
  // perf report records exactly which tier was auto-detected vs forced.
  const rawCoverage = useCoverageData(scale.tier, {
    autoTier: scale.autoTier,
    manualOverride: scale.override,
    hostCount: scale.hostCount,
  });
  // The capability score combines coverage, utilization and adoption
  // (./pulseScore.ts). Applied once here so every screen, the snapshot and
  // the reports read the same number.
  const adoption = useAppAdoption(rawCoverage.capabilities.length > 0);
  // Memoized on the capability array itself: the hook returns a new object each
  // render, and a new `capabilities` identity would restart every effect that
  // depends on it.
  const scored = useMemo(() => {
    const known = !adoption.loading && !adoption.unavailable;
    const capabilities = withPulseScore(rawCoverage.capabilities, { known, byCapability: adoption.byCapability });
    const totalScore = capabilities.length > 0
      ? Math.floor(capabilities.reduce((s, c) => s + c.score, 0) / capabilities.length)
      : 0;
    return { capabilities, totalScore };
  }, [rawCoverage.capabilities, adoption.loading, adoption.unavailable, adoption.byCapability]);
  const coverageData = { ...rawCoverage, ...scored, scoreSettled: !adoption.loading, adoption };

  // Every completed run is saved to the history here, not on a page: a run that
  // finishes while another page is open is still a run, and Evolution needs it.
  const wasLoadingRef = useRef(false);
  const lastSavedRef = useRef("");
  const measured = scored.capabilities.length > 0 && scored.capabilities.some(c => c.assessedCount > 0);
  useEffect(() => {
    if (rawCoverage.loading) { wasLoadingRef.current = true; return; }
    // Wait for adoption: it is one of the three parts of the score being saved.
    if (!wasLoadingRef.current || scored.capabilities.length === 0 || adoption.loading) return;
    wasLoadingRef.current = false;
    const sig = scored.capabilities.map(c => `${c.name}:${c.score}`).join(",");
    // A run in which nothing could be measured (no connection, expired session)
    // is not a result: saving it would put a 0% run in the history.
    if (measured && sig !== lastSavedRef.current) {
      lastSavedRef.current = sig;
      history.saveSnapshot(scored.capabilities, scored.totalScore, rawCoverage.tenant);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawCoverage.loading, adoption.loading, scored]);
  /** A run is in flight or its result is on its way into the history. */
  const assessing = rawCoverage.loading || (scored.capabilities.length > 0 && adoption.loading) || (measured && history.snapshots.length === 0);

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const go = (to: string) => (e: React.MouseEvent) => { e.preventDefault(); navigate(to); };
  const NAV = [
    { to: "/", label: "Overview", on: pathname === "/" || pathname.startsWith("/capability") },
    { to: "/summary", label: "Overall score", on: pathname === "/summary" },
    { to: "/compare", label: "Evolution", on: pathname === "/compare" },
    { to: "/guide", label: "Guide", on: pathname === "/guide" },
  ];

  return (
    <ErrorBoundary>
      <AppHeader>
        <AppHeader.Navigation>
          <AppHeader.Logo appName="Pulse Assessment" href="/" onClick={go("/")} />
          {NAV.map(n => (
            <AppHeader.NavigationItem key={n.to} isSelected={n.on} href={n.to} onClick={go(n.to)}>
              {n.label}
            </AppHeader.NavigationItem>
          ))}
        </AppHeader.Navigation>
        <AppHeader.ActionItems>
          {/* Refresh and Reports are portalled here on every page. */}
          <div id="pulse-header-actions" style={{ display: "flex", alignItems: "center", gap: 8 }} />
        </AppHeader.ActionItems>
        <AppHeader.Menus>
          <HelpMenu entries={{
            documentation: { href: "https://docs.dynatrace.com/docs", target: "_blank" },
            about: "default",
          }} />
        </AppHeader.Menus>
      </AppHeader>
      <ToastContainer />
      <PageLayout>
        <PageLayout.Content>
          <Suspense fallback={
            <Flex flexDirection="column" gap={16} style={{ padding: 32 }}>
              <Skeleton height={48} width="30%" />
              <Flex gap={16}>
                <Skeleton height={300} width="50%" />
                <Flex flexDirection="column" gap={8} style={{ flex: 1 }}>
                  <SkeletonText lines={3} />
                  <Skeleton height={120} />
                </Flex>
              </Flex>
            </Flex>
          }>
            <Routes>
              <Route path="/" element={<CoverageAssessment view="coverage" history={history} coverageData={coverageData} scale={scale} />} />
              <Route path="/guide" element={<GuidePage coverageData={coverageData} />} />
              <Route path="/summary" element={<CoverageAssessment view="recommendations" history={history} coverageData={coverageData} scale={scale} />} />
              <Route path="/compare" element={<EvolutionPage snapshots={history.snapshots} loading={history.loading} assessing={assessing} />} />
              <Route path="/capability/:name" element={<CapabilityDetailPage coverageData={coverageData} history={history} />} />
            </Routes>
            {/* Refresh and Reports on every page: the assessment page renders
                them itself; the others mount its header actions only. */}
            {pathname !== "/" && pathname !== "/summary" && (
              <CoverageAssessment headerOnly view="coverage" history={history} coverageData={coverageData} scale={scale} />
            )}
          </Suspense>
        </PageLayout.Content>
      </PageLayout>
    </ErrorBoundary>
  );
};
