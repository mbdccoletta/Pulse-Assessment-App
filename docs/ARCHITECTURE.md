# Architecture

## Overview

Pulse Assessment is a **Dynatrace App** built on the Dynatrace AppEngine platform. It evaluates observability coverage and maturity across 9 Dynatrace capabilities by executing DQL queries against real tenant data.

```
┌──────────────────────────────────────────────────────────────────┐
│                    Dynatrace AppEngine                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Pulse Assessment (React SPA)                              │  │
│  │                                                            │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐ │  │
│  │  │  App.tsx  │→ │ Coverage     │  │  ComparisonPage.tsx  │ │  │
│  │  │ (Router)  │  │ Assessment   │  │  (Evolution Over     │ │  │
│  │  │          │  │ .tsx         │  │   Time)              │ │  │
│  │  └──────────┘  └──────┬───────┘  └──────────┬───────────┘ │  │
│  │                       │                      │             │  │
│  │            ┌──────────┴──────────────────────┘             │  │
│  │            ▼                                               │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │ useCoverageData │  │ useAssessment   │                │  │
│  │  │ (Query Engine)  │  │ History         │                │  │
│  │  └────────┬────────┘  └────────┬────────┘                │  │
│  │           │                    │                           │  │
│  └───────────┼────────────────────┼───────────────────────────┘  │
│              ▼                    ▼                               │
│  ┌───────────────────┐  ┌──────────────────┐                    │
│  │  Grail (DQL)      │  │  Document Store  │                    │
│  │  - Entities       │  │  - Snapshots     │                    │
│  │  - Logs           │  │  (ppa-snapshot)  │                    │
│  │  - Metrics        │  │                  │                    │
│  │  - Spans          │  └──────────────────┘                    │
│  │  - Events         │                                          │
│  │  - Bizevents      │                                          │
│  └───────────────────┘                                          │
└──────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
cca-app/
├── app.config.json              # App manifest (ID, scopes, version)
├── package.json                 # Dependencies and scripts
├── tsconfig.eslint.json         # ESLint TypeScript config
├── eslint.config.mjs            # ESLint config
├── AGENTS.md                    # AI agent instructions
├── ui/
│   ├── main.tsx                 # Entry point (AppRoot + Router)
│   ├── tsconfig.json            # UI TypeScript config
│   ├── assets/
│   │   └── icon.svg             # App icon (Dynatrace Hub)
│   └── app/
│       ├── App.tsx              # Routes: / and /compare
│       ├── queries.ts           # 9 capabilities, 111 DQL criteria
│       ├── remediationActions.ts # Remediation actions for all 111 criteria
│       ├── components/
│       │   ├── PolarChart.tsx   # Interactive canvas radar chart
│       │   ├── ConnectorLines.tsx # Chart connector lines
│       │   ├── ChartLabels.tsx  # Chart axis labels
│       │   ├── CapabilityCards.tsx # Capability score cards
│       │   ├── CopyableQuery.tsx # DQL query display with copy
│       │   ├── ErrorBoundary.tsx # React error boundary
│       │   └── Tooltip.tsx      # Reusable tooltip component
│       ├── data/
│       │   ├── criterionTiers.ts     # Tier classification (F/BP/E)
│       │   ├── criterionImportance.ts # Importance descriptions
│       │   ├── criterionRemediation.ts # Remediation descriptions
│       │   ├── capSummaries.ts       # Capability one-liners
│       │   └── appIcon.ts           # Embedded app icon data
│       ├── hooks/
│       │   ├── useCoverageData.ts   # Query engine + scoring
│       │   ├── useAssessmentHistory.ts # Snapshot persistence
│       │   └── usePreflight.ts      # Scope validation probes
│       ├── pages/
│       │   ├── CoverageAssessment.tsx # Main assessment page (~2400 lines)
│       │   └── ComparisonPage.tsx     # Evolution Over Time (~1150 lines)
│       └── utils/
│           └── colors.ts            # Shared color utilities
└── docs/
    └── ARCHITECTURE.md          # This file
```

## Data Flow

### Assessment Execution

1. **Preflight** (`usePreflight.ts`): Runs 7 probe queries to validate API scopes before the real assessment.
2. **Query Collection**: All 111 criteria from `queries.ts` are collected; their DQL queries are deduplicated (~94 unique queries).
3. **Parallel Execution** (`useCoverageData.ts`): Up to 10 concurrent DQL queries via `queryExecutionClient.queryExecute()` with polling.
4. **Scoring**: Each criterion produces a value (0–100%); values are compared against thresholds to produce pass/fail.
5. **Aggregation**: Coverage score (simple average) and Maturity score (weighted + progressive) are computed per capability and overall.
6. **Snapshot**: Results are saved to localStorage (immediate) and Dynatrace Document Store (async).

### Query Types

| Type | Description | Example |
|---|---|---|
| **Direct count** | Single query counting entities matching a filter | `fetch dt.entity.host \| summarize count()` |
| **Cross-entity ratio** | Two queries (A/B) calculating coverage percentage | Services with DB spans / Total services × 100 |
| **Timeseries** | Metric-based evaluation | `timeseries avg(dt.host.cpu.usage)` |

## Scoring Model

### Coverage Score
Simple pass/fail ratio per capability:
```
capScore = (passed criteria / total criteria) × 100
overallScore = average(all capability scores)
```

### Maturity Score (Progressive Weighted)

**Weights:** Foundation = 60%, Best Practice = 25%, Excellence = 15%

**Progressive gating:**
- Best Practice only counts if Foundation ≥ 80%
- Excellence only counts if Best Practice ≥ 60%

```
effB = (foundationPct >= 0.8) ? bestPracticePct : 0
effE = (effB >= 0.6) ? excellencePct : 0
maturityScore = foundationPct × 60 + effB × 25 + effE × 15
```

### Maturity Levels

| Level | Label | Condition |
|---|---|---|
| L0 | Not Adopted | Foundation < 50% |
| L1 | Foundation | Foundation ≥ 50% |
| L2 | Operational | Foundation = 100% AND Best Practice ≥ 50% |
| L3 | Optimized | Foundation = 100% AND Best Practice = 100% AND Excellence ≥ 50% |

### Maturity Bands

| Band | Score Range |
|---|---|
| N/A | 0–19% |
| Low | 20–39% |
| Moderate | 40–59% |
| Good | 60–79% |
| Excellent | 80–100% |

## Tier Distribution (111 criteria)

| Tier | Count | Weight | Gate |
|---|---|---|---|
| Foundation | 31 | 60% | Always counted |
| Best Practice | 46 | 25% | Requires Foundation ≥ 80% |
| Excellence | 40 | 15% | Requires Best Practice ≥ 60% |

## Snapshot Persistence

**Dual-layer storage:**

1. **localStorage** (`ppa-assessment-history`): Immediate read/write for fast access
2. **Dynatrace Document Store**: Persistent Grail storage via `@dynatrace-sdk/client-document`
   - Document type: `ppa-snapshot`
   - Document IDs: `cca-{id}` (id = `Date.now().toString(36)`)
   - Retention: 12 most recent snapshots; older ones are auto-deleted

**Sync flow:** On load, documents are fetched from Grail and merged with localStorage (dedup by ID, prefer remote). On save, localStorage is updated immediately; Grail write is fire-and-forget.

## UI Architecture

### Routing
```
/        → CoverageAssessment (lazy-loaded)
/compare → ComparisonPage (lazy-loaded)
```

Both routes wrapped in `<ErrorBoundary>` with `<Suspense>`.

### View Modes (CoverageAssessment)

| Mode | Description |
|---|---|
| **Coverage** | Interactive polar radar chart + capability cards with pass/fail criteria |
| **Maturity** | Tier-grouped cards (Foundation/Best Practice/Excellence) with weighted scores |
| **Executive Summary** | Prioritized recommendations with remediation actions |

### PDF Report Generation
Three report types via jsPDF:
- **Summary Report**: Coverage vs Maturity side-by-side
- **Coverage Report**: Detailed criterion pass/fail per capability
- **Maturity Report**: Tier-grouped breakdown with F/BP/E sections

### Theming
Full dark/light mode via Strato design tokens (`useCurrentTheme()`). All components adapt dynamically.

## Dependencies

| Package | Purpose |
|---|---|
| `@dynatrace-sdk/client-query` | DQL query execution against Grail |
| `@dynatrace-sdk/client-document` | Snapshot persistence in Document Store |
| `@dynatrace/strato-components` | Dynatrace Strato UI framework |
| `@dynatrace/strato-design-tokens` | Design tokens (colors, theming) |
| `chart.js` + `react-chartjs-2` | Evolution mini-chart in CoverageAssessment |
| `jspdf` | PDF report generation |
| `react-router-dom` | Client-side routing |
