// ui/app/kit/PulseCoverage.tsx
//
// Pulse in one component: the engine (coverage, scale tier, adoption, score,
// history) and every screen (Overview, Overall score, Evolution, Guide,
// capability detail). Pulse's own App.tsx renders it standalone; another app
// mounts it as a section, e.g.
//
//   <Route path="/coverage/*" element={<PulseCoverage basePath="/coverage" embedded />} />
//
// Same code, same numbers, same screens in both places.

import { ToastContainer } from "@dynatrace/strato-components/notifications";
import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Button } from "@dynatrace/strato-components/buttons";
import { Skeleton, SkeletonText } from "@dynatrace/strato-components/content";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useAssessmentHistory } from "../hooks/useAssessmentHistory";
import { setInventoryWindowHours, useCoverageData } from "../hooks/useCoverageData";
import { useScaleTier } from "../hooks/useScaleTier";
import { useAppAdoption } from "../hooks/useAppAdoption";
import { withPulseScore } from "../pulseScore";
import { PulseLangProvider, tr, useLang, type PulseLang } from "../i18n/lang";
import { DEFAULT_HOST, PulseHostProvider, normalizeBase, pulseRoute, usePulseHost, usePulseNavigate } from "./PulseHost";

const CoverageAssessment = React.lazy(() =>
  import("../pages/CoverageAssessment").then(m => ({ default: m.CoverageAssessment }))
);
const GuidePage = React.lazy(() =>
  import("../pages/GuidePage").then(m => ({ default: m.GuidePage }))
);
const EvolutionPage = React.lazy(() =>
  import("../pages/EvolutionPage").then(m => ({ default: m.EvolutionPage }))
);
const CapabilityDetailPage = React.lazy(() =>
  import("../pages/CapabilityDetailPage").then(m => ({ default: m.CapabilityDetailPage }))
);

/** Pulse's navigation, shared by the standalone header and the embedded bar. */
export const PULSE_NAV = [
  { to: "/", label: "Overview", match: (r: string) => r === "/" || r.startsWith("/capability") },
  { to: "/summary", label: "Overall score", match: (r: string) => r === "/summary" },
  { to: "/compare", label: "Evolution", match: (r: string) => r === "/compare" },
  { to: "/guide", label: "Guide", match: (r: string) => r === "/guide" },
] as const;

/** A PULSE_NAV label in the given language (the constant keeps the English one). */
export const pulseNavLabel = (to: string, lang: PulseLang): string => {
  switch (to) {
    case "/": return tr(lang, "Overview", "Visão geral", "Resumen");
    case "/summary": return tr(lang, "Overall score", "Pontuação geral", "Puntuación general");
    case "/compare": return tr(lang, "Evolution", "Evolução", "Evolución");
    case "/guide": return tr(lang, "Guide", "Guia", "Guía");
    default: return PULSE_NAV.find(n => n.to === to)?.label ?? to;
  }
};

/** The current Pulse route, relative to where Pulse is mounted. */
export const usePulseRoute = () => {
  const { pathname } = useLocation();
  const { basePath } = usePulseHost();
  return pulseRoute(pathname, basePath);
};

/** Navigation bar for embedded mode: the host owns the AppHeader, so Pulse's
 *  four sections and its Refresh / Reports actions sit at the top of the page. */
const EmbeddedBar: React.FC<{ sectionNav: boolean }> = ({ sectionNav }) => {
  const route = usePulseRoute();
  const go = usePulseNavigate();
  const { headerSlotId } = usePulseHost();
  const lang = useLang();
  return (
    <Flex alignItems="center" justifyContent={sectionNav ? "space-between" : "flex-end"} gap={8} flexWrap="wrap"
      style={{ padding: "8px 16px", borderBottom: "1px solid var(--dt-colors-border-neutral-default, #2c2c35)", flexShrink: 0 }}>
      {sectionNav && <nav aria-label="Pulse" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {PULSE_NAV.map(n => {
          const on = n.match(route);
          return (
            <Button key={n.to} size="condensed"
              variant={on ? "emphasized" : "default"} aria-current={on ? "page" : undefined}
              onClick={() => go(n.to)}>
              {pulseNavLabel(n.to, lang)}
            </Button>
          );
        })}
      </nav>}
      <div id={headerSlotId} style={{ display: "flex", alignItems: "center", gap: 8 }} />
    </Flex>
  );
};

const Body: React.FC<{ embedded: boolean; sectionNav: boolean }> = ({ embedded, sectionNav }) => {
  const history = useAssessmentHistory();
  // Live host-count detection drives the Scale Tier choice. See
  // ../scale-tier.ts for the contract.
  const scale = useScaleTier();
  // Thread the scale metadata into useCoverageData so the downloadable
  // perf report records exactly which tier was auto-detected vs forced.
  const rawCoverage = useCoverageData(scale.tier, {
    autoTier: scale.autoTier,
    manualOverride: scale.override,
    hostCount: scale.hostCount,
  });
  // The capability score combines coverage, utilization and adoption
  // (../pulseScore.ts). Applied once here so every screen, the snapshot and
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

  const route = usePulseRoute();

  // The host changed its window after a run: read again over the new window (inventory and metrics, ~0 GB).
  const { windowHours } = usePulseHost();
  const lastWindow = useRef(windowHours);
  useEffect(() => {
    if (lastWindow.current === windowHours) return;
    lastWindow.current = windowHours;
    if (!rawCoverage.loading && rawCoverage.capabilities.length > 0) rawCoverage.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowHours]);

  return (
    <>
      {embedded && <EmbeddedBar sectionNav={sectionNav} />}
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
          <Route index element={<CoverageAssessment view="coverage" history={history} coverageData={coverageData} scale={scale} />} />
          <Route path="guide" element={<GuidePage coverageData={coverageData} />} />
          <Route path="summary" element={<CoverageAssessment view="recommendations" history={history} coverageData={coverageData} scale={scale} />} />
          <Route path="compare" element={<EvolutionPage snapshots={history.snapshots} loading={history.loading} assessing={assessing} />} />
          <Route path="capability/:name" element={<CapabilityDetailPage coverageData={coverageData} history={history} />} />
        </Routes>
        {/* Refresh and Reports on every page: the assessment page renders
            them itself; the others mount its header actions only. */}
        {route !== "/" && route !== "/summary" && (
          <CoverageAssessment headerOnly view="coverage" history={history} coverageData={coverageData} scale={scale} />
        )}
      </Suspense>
    </>
  );
};

export interface PulseCoverageProps {
  /** Route prefix Pulse is mounted under. "" (default) when Pulse is the app. */
  basePath?: string;
  /** True inside another app: Pulse draws its own section bar instead of
   *  relying on the host's AppHeader. */
  embedded?: boolean;
  /** Embedded only: false when the host's own menu lists Pulse's pages, so the
   *  section bar keeps only Refresh / Reports. Default true. */
  sectionNav?: boolean;
  /** Window of the host's screens, in hours. Inventory and metrics criteria read it, so their counts match the
   *  host; logs, spans and events keep each criterion's own short window. Default: Pulse's 2 h. */
  windowHours?: number;
  /** Language of Pulse's screens: the host's language switch. Default "en". */
  lang?: PulseLang;
  /** Element id for the Refresh / Reports actions. Change it only if the host
   *  already uses "pulse-header-actions". */
  headerSlotId?: string;
}

export const PulseCoverage: React.FC<PulseCoverageProps> = ({ basePath, embedded = false, sectionNav = true, lang = "en", windowHours, headerSlotId }) => {
  // Set before the first run reads it (module state shared with the engine).
  setInventoryWindowHours(windowHours);
  const host = useMemo(() => ({
    basePath: normalizeBase(basePath),
    headerSlotId: headerSlotId ?? DEFAULT_HOST.headerSlotId,
    embedded,
    windowHours,
  }), [basePath, headerSlotId, embedded, windowHours]);
  return (
    <PulseHostProvider value={host}>
      <PulseLangProvider lang={lang}>
      <ErrorBoundary>
        {embedded && <ToastContainer />}
        <Body embedded={embedded} sectionNav={sectionNav} />
      </ErrorBoundary>
      </PulseLangProvider>
    </PulseHostProvider>
  );
};
