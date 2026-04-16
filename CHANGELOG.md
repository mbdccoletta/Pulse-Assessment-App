# Changelog

All notable changes to the Pulse Assessment app are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.3.40] — 2025-07-17

### Changed
- **Progressive Maturity Scoring**: Updated tier weights from 50/30/20 to **60/25/15** (Foundation/Best Practice/Excellence).
- Best Practice tier now only contributes to the maturity score when **Foundation ≥ 80%**.
- Excellence tier now only contributes when **Best Practice ≥ 60%**.
- Updated all UI descriptions and footer guidance to reflect the new weights and gating rules.
- Deployed to fov31014 and bwm98081 tenants.

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
