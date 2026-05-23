import React, { Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Page } from "@dynatrace/strato-components-preview/layouts";
import { Skeleton, SkeletonText } from "@dynatrace/strato-components/content";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAssessmentHistory } from "./hooks/useAssessmentHistory";
import { useCoverageData } from "./hooks/useCoverageData";
import { useScaleTier } from "./hooks/useScaleTier";
import { useDemoMode } from "./demo/useDemoMode";

const CoverageAssessment = React.lazy(() =>
  import("./pages/CoverageAssessment").then(m => ({ default: m.CoverageAssessment }))
);
const ComparisonPage = React.lazy(() =>
  import("./pages/ComparisonPage").then(m => ({ default: m.ComparisonPage }))
);

export const App = () => {
  const history = useAssessmentHistory();
  // Demo mode is resolved first — when active, both useScaleTier and
  // useCoverageData short-circuit to scripted scenario data and never touch
  // Grail (zero DPS). When demo is inactive, the hooks behave exactly as in
  // v2.5.0: live host-count detection + live query execution.
  const demo = useDemoMode();
  const scale = useScaleTier(demo.scenario);
  // Thread the scale metadata into useCoverageData so the downloadable perf
  // report records exactly which tier was auto-detected vs forced.
  const coverageData = useCoverageData(scale.tier, demo.scenario, {
    autoTier: scale.autoTier,
    manualOverride: scale.override,
    hostCount: scale.hostCount,
  });

  return (
    <ErrorBoundary>
      <Page>
        <Page.Main>
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
              <Route path="/" element={<CoverageAssessment history={history} coverageData={coverageData} scale={scale} demo={demo} />} />
              <Route path="/compare" element={<ComparisonPage snapshots={history.snapshots} coverageData={coverageData} saveSnapshot={history.saveSnapshot} />} />
            </Routes>
          </Suspense>
        </Page.Main>
      </Page>
    </ErrorBoundary>
  );
};
