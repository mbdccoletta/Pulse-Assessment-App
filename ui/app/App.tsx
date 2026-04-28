import React, { Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Flex } from "@dynatrace/strato-components/layouts";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAssessmentHistory } from "./hooks/useAssessmentHistory";
import { useCoverageData } from "./hooks/useCoverageData";

const CoverageAssessment = React.lazy(() =>
  import("./pages/CoverageAssessment").then(m => ({ default: m.CoverageAssessment }))
);
const ComparisonPage = React.lazy(() =>
  import("./pages/ComparisonPage").then(m => ({ default: m.ComparisonPage }))
);

export const App = () => {
  const history = useAssessmentHistory();
  const coverageData = useCoverageData();

  return (
    <ErrorBoundary>
      <Suspense fallback={<Flex style={{ padding: 32, textAlign: "center" }}>Loading…</Flex>}>
        <Routes>
          <Route path="/" element={<CoverageAssessment history={history} coverageData={coverageData} />} />
          <Route path="/compare" element={<ComparisonPage snapshots={history.snapshots} coverageData={coverageData} saveSnapshot={history.saveSnapshot} />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};
