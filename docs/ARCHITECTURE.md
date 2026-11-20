# Architecture

This document describes Pulse Assessment 3.0.9 as the code under `ui/app/` implements it. Diagrams are in [ARCHITECTURE-DIAGRAM.md](ARCHITECTURE-DIAGRAM.md).

## Overview

Pulse Assessment is a Dynatrace AppEngine app (`my.pulse.assessment`) written in React 18 and TypeScript with Strato components. It has no backend functions: everything runs in the browser and talks to platform services through the Dynatrace SDKs and platform REST endpoints.

The app assesses 11 capabilities with 143 criteria (`queries.ts`). Each capability gets one score, the floored average of three parts (coverage, utilization, adoption), and a named verdict. The assessment starts by itself when the app opens; there is no start page and no capability selection.

| Platform service | Used for | Client |
|---|---|---|
| Grail (DQL) | Criteria, adoption, probes, gap lists, FinOps data | `@dynatrace-sdk/client-query` |
| Settings API | `settings:count <schemaId>` criteria, classic SLO count | `fetch` on `/platform/classic/environment-api/v2/settings/objects` |
| SLO service | `slos:count` criterion | `fetch` on `/platform/slo/v1/slos` |
| Document Store | 24h query cache, run history | `@dynatrace-sdk/client-document` |
| Davis CoPilot | Dynatrace Intelligence answers, Smart Report | `@dynatrace-sdk/client-davis-copilot` |
| Dynatrace Assist app | "Go deeper in Assist", per-criterion questions | `sendIntent` from `@dynatrace-sdk/navigation` |
| AppEngine registry | Display names of installed apps | `fetch` on `/platform/app-engine/registry/v1/apps` |

## Project structure

```
ui/
├── main.tsx                   AppRoot + MemoryRouter + App
└── app/
    ├── App.tsx                Routes, header, the single score, run history save
    ├── appVersion.ts          APP_VERSION, stored in every snapshot
    ├── queries.ts             CAPABILITIES: the 143 criteria
    ├── pulseScore.ts          Three-part score, gain per unmet criterion
    ├── diagnosis.ts           Verdict per capability
    ├── passLine.ts            The one target a criterion must reach
    ├── scale-tier.ts          Scale tier and cost rules applied to each query
    ├── trace-proxy.ts         Catalog for environments without Traces on Grail
    ├── entity-model.ts        Catalog for environments without dt.entity.* tables
    ├── log-metric.ts          Log criteria read from the per-entity log metric
    ├── finopsData.ts          Cost & Carbon Optimization data, loaded on demand
    ├── remediationActions.ts  Action and documentation link per criterion
    ├── ai/                    reportPrompt, pageIntelligence, smartReport, assistIntent, davisError
    ├── reports/               pulseReports (PDF, JSON, CSV), aiNarrativePdf (Smart Report PDF)
    ├── perf/                  queryCache (24h cache), buildReport and types (per-run query log)
    ├── hooks/                 useCoverageData, useAppAdoption, useAssessmentHistory,
    │                          useScaleTier, useAppNames, usePreflight, useDevMode
    ├── data/                  criterionTiers, criterionImportance, criterionGaps, appCapabilityMap
    ├── components/            IntelligenceBar, PulseRadar, SmartReportModal, ScaleTierBanner,
    │                          TraceProxyBanner, DpsCostBadge, ExpandableChartModal,
    │                          Tooltip, ErrorBoundary
    ├── pages/                 CoverageAssessment, ExecutiveSummary, EvolutionPage,
    │                          GuidePage, CapabilityDetailPage
    └── utils/colors.ts        Score bands and their colors
```

## Pages and routing

`main.tsx` mounts the app in a `MemoryRouter`, so routes are in-memory and the app always opens on `/`. `App.tsx` renders the `AppHeader` navigation and lazy-loads each page.

| Route | Navigation label | Component | Content |
|---|---|---|---|
| `/` | Overview | `CoverageAssessment` (view `coverage`) | Radar with the three parts per capability (`PulseRadar`), "Needs attention" chips for the three lowest capabilities under 60% |
| `/summary` | Overall score | `CoverageAssessment` (view `recommendations`) → `ExecutiveSummary` | Overall score and its parts, utilization tiers, capabilities, unmet criteria ranked by gain, score over time, most used apps |
| `/compare` | Evolution | `EvolutionPage` | Latest run against a baseline (Last change, 30 days, 90 days, First run), causes of change, criteria that changed. With one saved run it shows the baseline view: what holds each score and the criteria closest to passing |
| `/guide` | Guide | `GuidePage` | Scoring rules, tiers, bands, verdicts and the catalog, rendered from the scoring constants |
| `/capability/:name` | (opened from the radar or a table) | `CapabilityDetailPage` | Score, parts, verdict, tiers, criteria, "What to do", analytics table, score over time, related apps |

`CoverageAssessment` also owns the Refresh button and the Reports menu. It renders them through a portal into the `pulse-header-actions` slot of the header, so they are present on Overview and Overall score. Capability names containing `/` are encoded with `~` in the route parameter.

## State ownership

`App.tsx` holds the state every page reads:

- `useAssessmentHistory()`: saved runs.
- `useScaleTier()`: host count and the resulting scale tier.
- `useCoverageData(tier)`: runs the catalog and returns coverage and utilization per capability.
- `useAppAdoption(enabled)`: adoption per capability, enabled once capabilities exist.
- `withPulseScore()` combines the two into the final `score`. It is applied once here, so pages, snapshots and reports read the same number. `totalScore` is the floored average of the capability scores.

## Run flow

1. **Probes.** On first mount `CoverageAssessment` runs three probes in parallel: `tracesNotEntitled()`, `classicEntitiesMissing()` (both in `hooks/usePreflight.ts`) and `logMetricAvailable()` (`log-metric.ts`). A probe that throws counts as `false`.
2. **Catalog.** `prepareCaps()` adapts `CAPABILITIES` to the environment (see Environment adaptation) and calls `start(caps)`.
3. **Cache load.** `runAssessment()` in `useCoverageData` loads the `QueryCache` document.
4. **Phase 1.** Denominators of the exact form `fetch dt.entity.X | summarize count()` run first. A criterion whose denominator is 0 or failed is skipped: its numerator is not executed.
5. **Phase 2.** All remaining queries run, deduplicated by query string, with 10 concurrent workers. Each query is first looked up in the cache; a miss goes through `scaleQuery()` and then to Grail.
6. **Scoring.** Criterion values, coverage and utilization are computed per capability (see Scoring).
7. **Cache write.** New results are flushed to the Document Store without waiting.
8. **Adoption.** `useAppAdoption` runs its two queries once capabilities exist.
9. **Save.** When the run has finished and adoption has answered, `App.tsx` saves a snapshot, unless nothing could be measured or the capability scores equal the last save of this session.

Refresh calls `forceRefresh()` (empties the cache), refreshes adoption and re-runs the same adapted catalog.

### Query execution (`executeDql`)

- `slos:count` and `settings:count <schemaId>` are intercepted before DQL. `settings:count` reads `totalCount` from the settings API with `pageSize=1`; with a predicate (`settings:count <schemaId> <predicate>`) it reads the objects page by page and counts the ones the named rule in `SETTINGS_PREDICATES` accepts (switched on, per application, masked). `slos:count` adds the classic `builtin:monitoring.slo` settings count and the SLO service count; it fails only when neither can be read. The catalog uses `settings:count` for `builtin:openpipeline.logs.pipelines` and `builtin:davis.anomaly-detectors`. These reads scan nothing and are never cached.
- DQL runs with a 30 s request timeout and a default timeframe of 2 hours. A query still `RUNNING` is polled up to 10 times, 3 s apart.
- A failed or cancelled query returns the sentinel `-1`, which scoring reads as "not assessed".
- The first numeric field of the first record is the result; for `timeseries` arrays, the last numeric element.

## Environment adaptation

The catalog is rewritten before the run, from what the probes found. No setting or user choice is involved.

| Probe result | Transform | Effect |
|---|---|---|
| Log metric `dt.log.status_per_entity_count` exists with host and service dimensions, and the classic entity model exists | `applyLogMetricMode` | Criteria l1, l2, l7, l8, l9 and l6 read the metric with `timeseries` instead of scanning logs. l9 counts 3 status classes; l6 is marked as a proxy |
| Span query fails with an entitlement error | `applyTraceProxyMode` | Span criteria with an entry in `PROXIES` (in the current catalog: a1, a3, a4, a8, a9, a10, a13) run metric or topology queries and are marked `proxied`. The other span criteria are removed from the catalog (i18 and 13 of the 16 AI/LLM Observability criteria). A capability left with no criteria would be removed; none is in the current catalog |
| `fetch dt.entity.host` fails with `UNKNOWN_DATA_OBJECT` | `applySmartscapeModel` | Whole statements listed in `STATEMENTS` become `smartscapeNodes` queries; `dt.entity.*` dimensions on signals become `dt.smartscape.*`. Criteria with no equivalent (a2, a12, sd10, l16, and any other `fetch dt.entity.*` without a mapping) are removed. Davis problem queries and Cost & Carbon queries are left unchanged |

Order matters: log metric first, then trace proxy, then Smartscape, because the trace proxies introduce classic entity queries that the Smartscape rewrite must see.

A removed criterion leaves every denominator. Each mode is disclosed on screen: `TraceProxyBanner`, a "Smartscape entity model" message, and a `run` block in the reports.

## Scale tier and cost rules

`scaleQuery(query, tier)` in `scale-tier.ts` returns the query Grail executes. It only changes queries on hot sources: `fetch logs`, `fetch spans`, `fetch events`, `fetch bizevents`.

**Tier.** `useScaleTier` counts hosts with `fetch dt.entity.host | summarize count = count()`. Under 5,000 hosts the tier is `exact`; from 5,000 `large` (30-minute window); from 50,000 `xlarge` (5-minute window). A failed count means `exact`. `ScaleTierBanner` is shown for `large` and `xlarge` and lets the user override the tier; the override is stored in `localStorage`.

**Cost rules, applied at every tier** (`costOptimizeQuery`):

- A criterion whose two sides are both plain counts on hot sources over the same window is sampled with `samplingRatio: 1000`; the ratio cancels the sampling. Queries with `countDistinct`, `by:` or `dedup` are never sampled, and neither are ratios where both sides read `gen_ai.*`.
- Other hot queries get a shorter window: 15 minutes when the authored window is 4 hours or less, otherwise at most 4 hours. When the two sides of a criterion read different windows, both are divided by the same factor.
- Every rewritten hot query carries `scanLimitGBytes: 50`, unless it was authored with `scanLimitGBytes: -1`.
- Cost & Carbon queries (`dynatrace.biz.carbon`) keep their authored window and only get the scan limit.

## Query cache

`perf/queryCache.ts` stores query results in one Document Store document.

| Property | Value |
|---|---|
| Document id / type | `pulse-querycache-2` / `pulse-querycache` |
| Key | `<tier>.<FNV-1a hash of the executed query>` |
| Entry | value, timestamp, scanned bytes, scanned records |
| TTL | 24 hours, enforced when the document is loaded |
| Write | `updateDocument` with optimistic locking; `createDocument` on 404 or 409 |

Failed results are not cached. A document from another environment or schema version is treated as empty. `clearAndFlush()` overwrites the document with no entries; the document is never deleted, because a deleted document keeps its id reserved and could not be created again. Any storage error leaves the run working without a cache.

## Scoring

**Criterion.** With a denominator (`queryB` or `denominatorConstant`) the value is `floor(A / B × 1000) / 10`, capped at 100. Without one it is the raw result. The criterion is met when the value reaches its pass line: `passLine()` picks the middle of the listed thresholds (the higher of two). A criterion is *not assessed* when its query failed or its denominator is 0 or less; it then leaves the coverage and tier denominators.

**Coverage.** `floor(met / assessed × 100)`.

**Utilization.** Each criterion belongs to a tier in `data/criterionTiers.ts` (25 Foundation, 70 Best practice, 48 Excellence). With `f`, `b`, `e` the share met in each tier:

```
effB = f >= 0.8 ? b : 0
effE = effB >= 0.6 ? e : 0
utilization = floor(f × 60 + effB × 25 + effE × 15)
```

**Adoption.** `useAppAdoption` reads `QUERY_EXECUTION_EVENT` records in `dt.system.events` over 30 days: distinct `user.email` per `client.application_context`, and distinct users overall. Platform service accounts and the app shell are excluded. `data/appCapabilityMap.ts` maps each app id to one primary capability (explicit list, then keywords, else "Other apps"); Workflows and Assist have no primary capability. A capability's users are the highest user count among its apps, and its rate is `floor(users / total × 100)`. The adoption part is `min(100, floor(rate / 20 × 100))`: 20% of active users is a full score.

**Capability score.** `floor(average(coverage, utilization, adoption))`. When adoption could not be read (query failed, or no active-user total), the score is the average of the other two.

**Overall score.** `floor(average of capability scores)`.

**Bands** (`utils/colors.ts`): N/A 0–19, Low 20–39, Moderate 40–59, Good 60–79, Excellent 80–100.

**Gain.** `gainIfMet()` recomputes coverage and utilization with one more criterion met in a tier and returns how much the capability score would rise. The figure is used only to order actions and to choose the gain icon: no screen, AI answer or report shows it. Pages, AI facts and reports rank unmet criteria by it.

### Verdict

`diagnose()` in `diagnosis.ts` reads the three parts and never changes a score. A part is high at 60%; for adoption that is 12% of active users. The first matching rule wins:

| Verdict | Rule |
|---|---|
| Not assessed | No criterion of the capability could be measured |
| Starved | Adoption high, coverage low |
| Unwatched | Coverage high, adoption low |
| Skin-deep | Coverage and adoption high, utilization low |
| Healthy | All three high |
| Dark | Coverage and adoption low |

When adoption is unknown the verdict uses coverage and utilization only: Healthy, Skin-deep or Dark.

## Run history

`useAssessmentHistory` keeps snapshots in `localStorage` (key `ppa-assessment-history`) and in the Document Store (type `ppa-snapshot`, id `cca-<snapshot id>`).

- **Load.** On mount it lists up to 200 snapshot documents, downloads them 8 at a time, and merges them with the local copy by id.
- **Save.** `saveSnapshot()` is called from `App.tsx`. It skips a run that equals the latest snapshot of the same day (same environment, app version, scores, parts and criterion values).
- **Snapshot.** Total score, environment, app version, and per capability: score, coverage, utilization, adoption, adoption rate, and each criterion's id, label, value, points, error and not-assessed flags.
- **Retention.** Snapshots older than 90 days are dropped. In the Document Store only the latest snapshot of each calendar day is kept; older same-day documents are deleted.

Evolution and the trend charts only use snapshots that carry the `coverage` part, so runs saved by 2.x are not compared with 3.x runs.

## Dynatrace Intelligence

Every page renders an `IntelligenceBar` with predefined questions (`QUESTIONS` and `capabilityQuestions()` in `ai/pageIntelligence.ts`). On Evolution the bar appears once two runs exist. Nothing is sent until a question is clicked.

`ai/reportPrompt.ts` is the only prompt builder:

- **Context.** `buildAssessmentContext()` writes one line per capability: score, the three parts, tier shares, unmet count, not-assessed count, and the weakest unmet criteria by name.
- **Page facts.** Each page adds facts computed by the app (`overviewFacts`, `overallFacts`, `capabilityFacts`, `evolutionFacts`, `guideFacts`): verdicts, gains, closed tier gates, causes of change. Clamped to 6,000 characters.
- **Instruction.** `buildInstruction()` puts the page lens (`LENS`) before fixed rules (quote only numbers in the context, name checks as written, no invented figures). The result is cut to `INSTRUCTION_MAX` = 2,500 characters.
- **Text budget.** The request text is the question (at most 800 characters) plus the context. If it exceeds `TEXT_BUDGET` = 9,000 characters, the weakest-criteria detail is reduced from 4 to 2 to 0 per capability, then the context is truncated.

A click calls `generateSmartReportText()`, which sends the text to `recommenderConversation` with two context entries: the instruction and `document-retrieval: dynatrace`. The bar appends a suffix asking for at most four bullets. Answers are kept per question while the page is mounted. Errors are mapped to a message and a hint by `ai/davisError.ts`.

"Go deeper in Assist" calls `openDynatraceAssist()`: an intent to the `dynatrace.davis.copilot` app (`ask-question`) carrying the question, the assessment context as hidden supplementary context (up to 100,000 characters) and the same instruction. The capability page uses the same intent for a per-criterion question.

## Reports

The Reports menu loads `reports/pulseReports.ts` (and jsPDF) on first use. Reports are built from the capability results on screen.

| Report | Builder | Notes |
|---|---|---|
| Overall score, Action plan, Criteria detail | `generateReport(kind, input, lang)` | PDF in English, Portuguese or Spanish, with criterion texts in the report's language. The Overall score report draws the Overview radar as vectors (`radarBlock`) |
| FinOps | `generateFinOpsReport()` | Also offered on the FinOps & Sustainability capability page. PDF from `loadFinOpsData()`: business events written by Cost & Carbon Optimization (cloud bill, energy and emissions per host and cluster). A toast is shown when no such data exists |
| Raw data | `exportRawData("json" \| "csv")` | Capabilities, criteria with value, target, gain and DQL, app usage, comparable history |
| Smart Report | `SmartReportModal` | Free-text request; "Generate PDF" renders the Davis CoPilot answer with `reports/aiNarrativePdf.ts`; "Open in Assist" sends the intent instead |

The report input carries a `run` block (trace proxy, Smartscape, estimated values, tier) so a report states how the run was measured. FinOps data is fetched for the Smart Report only when the request mentions cost, energy or carbon terms.

## Scopes

`app.config.json` declares 17 scopes.

| Scope | Used by |
|---|---|
| `storage:logs:read`, `storage:spans:read`, `storage:events:read`, `storage:bizevents:read`, `storage:metrics:read`, `storage:entities:read`, `storage:security.events:read`, `storage:buckets:read` | Criteria queries |
| `storage:system:read` | Adoption and criteria on `dt.system.events` |
| `storage:smartscape:read` | Smartscape catalog |
| `settings:objects:read` | `settings:count` criteria, classic SLO count |
| `slo:slos:read` | `slos:count` criterion |
| `app-engine:apps:run` | App names from the registry |
| `davis-copilot:conversations:execute` | Dynatrace Intelligence, Smart Report |
| `document:documents:read`, `document:documents:write` | Query cache, run history |
| `document:documents:delete` | Run history retention |

## Runtime switches

These are read from the URL query string or `localStorage` and are meant for diagnosis.

| Switch | Effect |
|---|---|
| `?passline=lowest` or `cca.passline` | Pass line is the lowest threshold instead of the middle one |
| `?accuracy=legacy` or `cca.accuracy` | Not-assessed criteria count as not met |
| `cca.scaleTier.override` | Forces a scale tier |
| `CCA_DEBUG = 1` | Console logging of every query |
| `?noTraces=1`, `?noEntities=1` (only with `?dev=1` or `cca.dev`) | Simulate an environment without Traces on Grail or without classic entities |

## Dependencies

| Package | Purpose |
|---|---|
| `react`, `react-dom`, `react-router-dom` | UI and routing |
| `@dynatrace/strato-components`, `strato-design-tokens`, `strato-icons` | Components, charts, tokens, icons |
| `@dynatrace-sdk/client-query` | DQL execution and polling |
| `@dynatrace-sdk/client-document` | Document Store |
| `@dynatrace-sdk/client-davis-copilot` | Davis CoPilot conversation |
| `@dynatrace-sdk/navigation`, `@dynatrace-sdk/app-environment` | Intents, environment URL |
| `jspdf` | PDF reports |
| `dt-app` | Build, dev server, deploy |
