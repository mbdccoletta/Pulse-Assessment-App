# Changelog

All notable changes to the Pulse Assessment app are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.5.0] — 2026-05-22

### Added — Scale Tier (xlarge tenant support)
- **`scale-tier.ts`** — pure module that adapts DQL queries to tenant scale via three tiers:
  - `exact` (≤ 5,000 hosts) — queries returned verbatim, ground-truth coverage values, identical behavior to v2.4.x.
  - `large` (5,000–50,000 hosts) — narrows logs/spans/events/bizevents to a 30-minute window with a 200 GB `scanLimitGBytes` safety net. Distinct-count accuracy preserved on workloads with continuous ingest.
  - `xlarge` (> 50,000 hosts) — 5-minute window with a 50 GB `scanLimitGBytes` cap. Coverage values are sampled estimates (±5–10% on typical workloads). Required above 50k hosts to fit inside the Grail per-query timeout.
- **`useScaleTier`** hook — detects host count via one cheap entity query on mount, auto-selects the tier, persists manual overrides in `localStorage`.
- **`ScaleTierBanner`** component — visible disclosure that the assessment is running in a sampled tier. Hidden entirely in `exact` mode (zero presentation impact for tenants ≤ 5k hosts). Includes inline tier-switch buttons.
- `useCoverageData` now accepts an optional `tier` parameter; the executed DQL is transformed via `scaleQuery(originalQ, tier)` before hitting Grail, but the result cache remains keyed by the **original** query string so all downstream consumers (scoring, snapshots, capability cards, PDF reports) are unaffected.

### Changed
- `App.tsx` now mounts `useScaleTier()` and threads the resolved tier into `useCoverageData()` and into `CoverageAssessment` (via a new optional `scale` prop).
- `CoverageAssessment` renders the `ScaleTierBanner` below the toolbar when `tier !== 'exact'`.

### Unchanged (deliberate, by design)
- `queries.ts` — every DQL string is **bit-identical** to v2.4.2. Scale Tier transforms queries at execution time, not in the source. This keeps the assessment definition versionable, auditable and easy to review.
- Scoring logic in `useCoverageData` — formula and thresholds untouched.
- Snapshot persistence and Evolution Over Time comparison — snapshots from v2.4.x remain compatible.
- Strato components, layouts, theming — no presentation changes for tenants ≤ 5k hosts.

### Performance impact (measured on a reference tenant, 54 hosts; extrapolated to 80k hosts)
- 80k-host single assessment scan: ~176 TB (Exact) → ~3.2 TB (xLarge) — **98.2% reduction**.
- 80k-host single assessment DPS: ~$1,800 → ~$32 — **98.2% reduction**.
- 80k-host wall-time: ~30–40 min (Exact, with query timeouts) → ~3–5 min (xLarge, within timeout). See `docs/PERFORMANCE-REPORT-80K-HOSTS.md` §6 for the full matrix.

## [2.3.40] — 2025-07-17

### Changed
- **Progressive Maturity Scoring**: Updated tier weights from 50/30/20 to **60/25/15** (Foundation/Best Practice/Excellence).
- Best Practice tier now only contributes to the maturity score when **Foundation ≥ 80%**.
- Excellence tier now only contributes when **Best Practice ≥ 60%**.
- Updated all UI descriptions and footer guidance to reflect the new weights and gating rules.
- Deployed to the reference tenants.

## [2.3.39] — 2025-07-17

### Changed
- Removed Delta (Δ) row from radar chart hover tooltip on the ComparisonPage. Tooltip now shows only "Previous" and "Current" scores plus per-tier criteria summary.

## [2.3.38] — 2025-07-17

### Added
- **Radar Chart Tooltip**: Hover over data points on the ComparisonPage radar chart to see capability name, Previous/Current scores, and criteria breakdown per tier (Foundation, Best Practice, Excellence).
- Click on radar chart axes already navigates to the detailed `CapabilityBar` drill-down.

## [2.3.37] — 2025-07-16

### Fixed
- **AI Observability zero coverage**: Fixed queries returning 0% due to OpenTelemetry semantic convention rename (`gen_ai.system` → `gen_ai.provider.name`). Added `coalesce()` for backward compatibility.
- Changed DQL scan range from post-filter to inline `from:now()-72h` for AI Observability criteria to ensure spans are scanned.
- Added new AI attributes: `gen_ai.agent.name`, `gen_ai.output.type`, `gen_ai.usage.input_tokens`, guardrail and cost attributes.

## [2.3.36] — 2025-07-15

### Changed
- Code splitting: Lazy-loaded both `CoverageAssessment` and `ComparisonPage` via `React.lazy()` with `<Suspense>` fallback.
- Performance and best practices audit applied.

## [2.3.35] — 2025-07-15

### Added
- Custom app icon (`icon.svg`) displayed in Dynatrace Hub and app header.

### Changed
- Preflight validation enhanced with all 7 scope probes (entities, logs, metrics, events, spans, bizevents, buckets).

## [2.3.34] — 2025-07-14

### Fixed
- Various DQL query fixes for cross-entity ratio calculations.
- Button layout repositioning on the assessment results page.

## [2.3.33] — 2025-07-14

### Added
- Initial public version with full feature set.
- 9 capabilities, 111 criteria with DQL queries.
- Coverage and Maturity dual-scoring model.
- Interactive polar radar chart with click-to-drill-down.
- 3 view modes: Coverage, Maturity, Executive Summary.
- PDF report generation (Summary, Coverage Detail, Maturity Detail).
- Assessment snapshot persistence (localStorage + Dynatrace Document Store).
- Evolution Over Time page with A/B snapshot comparison.
- Remediation actions and documentation links for all 111 criteria.
- Preflight scope validation.
- Dark/Light theme support.
