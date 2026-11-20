# Pulse Assessment design system

Describes the UI as the code under `ui/app/` builds it in version 3.0.6 (`ui/app/appVersion.ts`). Every statement here was read from the code; when the code and this file disagree, the code is right.

Stack: React 18, `react-router-dom` 6, `@dynatrace/strato-components` ^3.18, `@dynatrace/strato-design-tokens`, `@dynatrace/strato-icons`. There is no CSS, SCSS or style file under `ui/`: all styling is Strato component props plus inline `style` objects that read Strato tokens. The only CSS rules are in a `<style>` element inside the radar SVG (entry animation and focus outline).

## 1. Shell and routing

`ui/main.tsx` renders `<AppRoot>` (Strato core) around a `<MemoryRouter>`. The router is a memory router: the route is not written to the browser address bar.

`ui/app/App.tsx` builds the shell, wrapped in the local `ErrorBoundary`:

| Part | Component | Content |
|---|---|---|
| Header | `AppHeader` | `AppHeader.Navigation`, `AppHeader.ActionItems`, `AppHeader.Menus` |
| Logo | `AppHeader.Logo` | `appName="Pulse Assessment"`, navigates to `/` |
| Navigation | `AppHeader.NavigationItem` | Overview, Overall score, Evolution, Guide |
| Header actions slot | `<div id="pulse-header-actions">` inside `AppHeader.ActionItems` | Empty in `App.tsx`; the assessment page portals its buttons into it |
| Menus | `HelpMenu` | Documentation link and the default About entry |
| Toasts | `ToastContainer` | Target for `showToast` |
| Body | `PageLayout` > `PageLayout.Content` | `Suspense` around `Routes` |

Routes:

| Path | Element | Navigation item selected |
|---|---|---|
| `/` | `CoverageAssessment view="coverage"` | Overview |
| `/summary` | `CoverageAssessment view="recommendations"` (renders `ExecutiveSummary`) | Overall score |
| `/capability/:name` | `CapabilityDetailPage` | Overview |
| `/compare` | `EvolutionPage` | Evolution |
| `/guide` | `GuidePage` | Guide |

All four page modules are loaded with `React.lazy`. In the capability route a `/` in the capability name is encoded as `~`.

Header actions: `CoverageAssessment` looks up `#pulse-header-actions` and uses `createPortal` to place two condensed `Button`s there, only when results are on screen: **Refresh** (`RefreshIcon`) and **Reports** (`DownloadIcon`). Reports is a Strato `Menu` with sub-menus: Overall score, Action plan, Criteria detail and FinOps (each in English, Português, Español), Raw data (JSON, CSV), and "Smart (Assist)…", which opens `SmartReportModal`.

## 2. Pages

### Shared building blocks

Exported from `ui/app/pages/CapabilityDetailPage.tsx` and reused by the other pages:

| Export | What it is | Used by |
|---|---|---|
| `Panel` | `Surface elevation="flat"`, 16px padding, `Heading level={5}` title, optional `right` slot | Capability detail, Overall score, Evolution |
| `StateMark` | Strato `HealthIndicator` for Met / Not met / Not assessed, with or without the label | Capability detail, Overall score, Evolution |
| `VerdictChip` | `Chip variant="accent"` coloured by verdict, the meaning in a tooltip | Capability detail, Overall score, Guide |
| `TierMeter` | `MeterBarChart` (`size="size8"`) coloured by score band | Capability detail, Overall score |
| `TrendChart` | `TimeseriesChart` with one line (score) and one band (lowest to highest part) | Capability detail, Overall score, Evolution |
| `TIERS`, `TierKey` | Foundation, Best practice, Excellence | Capability detail, Overall score |
| `BAND_THRESHOLDS` | Score band minimums and tokens for the gauge | Capability detail, Overall score |
| `pctFormat` | Formats a percentage floored to one decimal | All pages with meters |

Components in `ui/app/components/`:

| File | Role |
|---|---|
| `PulseRadar.tsx` | The Overview radar (hand-built SVG, see section 3) |
| `IntelligenceBar.tsx` | "Dynatrace Intelligence" bar at the top of every page: predefined questions as buttons, answer area, optional `actions` slot on the right |
| `Tooltip.tsx` | Thin wrapper over the Strato `Tooltip` (`text`, `position`, `containerStyle`) |
| `ExpandableChartModal.tsx` | Strato `Modal size="large"` plus `ExpandChartButton` (`MaximizeIcon`) |
| `SmartReportModal.tsx` | Strato `Modal size="small"`: suggestion chips, a text area, "Open in Assist" and "Generate PDF" |
| `DpsCostBadge.tsx` | The "Run details" text with a dotted underline; all run numbers are in its tooltip |
| `ScaleTierBanner.tsx` | Warning banner for sampled runs with three tier buttons; renders nothing on the Exact tier |
| `TraceProxyBanner.tsx` | Warning banner shown when trace criteria are read from metrics and topology |
| `ErrorBoundary.tsx` | Full-page fallback for an uncaught render error |

### Overview (`/`, `CoverageAssessment.tsx`)

Top to bottom:

1. `IntelligenceBar`. Its `actions` slot holds the environment name and date, a warning-coloured text when checks failed, and `DpsCostBadge`.
2. Disclosure banners, only when they apply: `ScaleTierBanner`, `TraceProxyBanner`, and a `MessageContainer variant="primary"` titled "Smartscape entity model".
3. A lead row: the text "Needs attention" followed by up to three `Chip`s, one per capability below 60%, lowest first (`color="critical"` below 40, otherwise `"warning"`); each chip opens the capability. When none is below 60 the text reads "All capabilities at 60% or above".
4. `PulseRadar`, sized by a `ResizeObserver` on the page root (at most 620px, at least 220px, or 200px below a 640px-wide container).
5. `ExpandChartButton` in the top-right corner opens the radar in `ExpandableChartModal`, with a row of score-band pills under it.

### Overall score (`/summary`, `ExecutiveSummary.tsx`)

Same frame as the Overview (IntelligenceBar, banners), then:

- Title row: `Heading level={2}`, the score in the code font, the band label.
- Three `Panel`s in an auto-fit grid: "Score" (`GaugeChart` with `GaugeChart.ThresholdIndicator` at each band), "What makes the score" (three `TierMeter`s) and "Utilization tiers" (`ToggleButtonGroup` All / Foundation / Best practice / Excellence, plus one `TierMeter` per tier).
- "Capabilities": one `MeterBarChart` per capability, lowest first, the name as a `Link` to the detail page, the three parts in a mono line and a `VerdictChip`.
- "What to do": `DataTable` (sortable, condensed, 10 rows per page) with State, Criterion, Capability, Value and target, Gain (pts).
- "Score over time" (`TrendChart`) and "Most used apps" (`MeterBarChart` per app).

Selecting a tier filters Capabilities and What to do; a `Chip` with `Chip.DeleteButton` shows and clears the filter.

### Capability detail (`/capability/:name`, `CapabilityDetailPage.tsx`)

- Toolbar: `Breadcrumbs` (Overview > capability), previous and next buttons (`ChevronLeftIcon`, `ChevronRightIcon`), environment name and date.
- `IntelligenceBar` with questions for that capability.
- Title row: a 12px dot in the capability colour, `Heading level={2}`, score, band label, `VerdictChip`.
- The same three summary `Panel`s as Overall score.
- "What to do": Strato `Accordion`, one section per unmet criterion, highest score gain first, five shown until "Show all". The label row has `StateMark`, the name, value and target in mono and the gain. The content has a Measured / Why it matters / What to do grid, an optional "Show the …" button that loads names as neutral `Chip`s, "Ask Assist how to fix", "Open the query in a notebook" and an `ExternalLink` to documentation.
- "Criteria": grouped by tier. Ratio criteria are a `MeterBarChart` each with the full name above the bar; presence criteria are rows of mark, name and reading. The panel header carries the three `StateMark`s as a legend.
- "Score over time": `TrendChart` in the capability colour.
- "FinOps report" (FinOps & Sustainability only): one button per language that builds the FinOps PDF, with chips naming its sections.
- "Related apps": a `MultiMeterBarChart` "Queries by app" with a legend, then one `MeterBarChart` per app with people and queries in a mono line.

### Evolution (`/compare`, `EvolutionPage.tsx`)

Compares the latest saved run with a baseline chosen by a `ToggleButtonGroup`: Last change, 30 days, 90 days, First run.

- Title row: heading, score, the change (`ArrowUpIcon` / `ArrowDownIcon` plus points), the two run dates in mono, the toggle group.
- "What changed in the score": four meters (Overall score, Coverage, Utilization, Adoption), each with "from → to" and the change.
- "Score over time": `TrendChart`, overall or for the selected capability.
- "What caused the change": `Accordion multiple`, one section per capability that moved, with the three parts and the criteria that changed as `Chip`s. A `MessageContainer variant="primary"` appears when the app version or the set of capabilities differs between the two runs.
- "Capabilities": one meter per capability; clicking a name filters the page.
- "Criteria that changed": `DataTable` with Change, State now, Criterion, Capability, Before, Now.

With a single saved run the page shows it as a baseline: a "First run" chip, no toggle group, no comparison panels and no IntelligenceBar.

### Guide (`/guide`, `GuidePage.tsx`)

A reading page: one centred column, 960px wide at most, paragraphs capped at 760px. It is the one page where explanations are written on screen. Sections are `Surface elevation="flat"` with a `Heading level={4}`: How the score is built, Utilization tiers, Score bands, Verdicts, The pages, Running the assessment, What is measured (an `Accordion` with one section per capability). The numbers it quotes are imported from the scoring constants.

## 3. Strato components in use

| Need | Component (package path) | Where |
|---|---|---|
| Score dial | `GaugeChart` (`charts`) | Score panels |
| Single value bar | `MeterBarChart` (`charts`) | Parts, tiers, capabilities, criteria, apps |
| Split of a total | `MultiMeterBarChart` (`charts`) | Queries by app |
| Score history | `TimeseriesChart` with `.Line`, `.Band`, `.YAxis` (`charts`) | `TrendChart` |
| Tables | `DataTable` with `.Pagination`, `.Toolbar`, `.DownloadData`, `.DefaultCell` (`tables`) | What to do, Criteria that changed, Closest to passing |
| Labels and filters | `Chip` with `.DeleteButton`, `.Prefix` (`content`) | Verdicts, filters, change kinds, band legend |
| State | `HealthIndicator` (`content`) | `StateMark` |
| Disclosure | `Accordion` (`content`) | What to do, What caused the change, What is measured |
| Empty and failed states | `EmptyState` with `.VisualPreset` (`content`) | See section 8 |
| Inline notices | `MessageContainer` (`content`) | Smartscape notice, AI errors, measurement change |
| Help on a panel | `InformationOverlay` (`content`) | Panel headers |
| Loading | `Skeleton`, `SkeletonText`, `ProgressCircle`, `AiLoadingIndicator` (`content`) | See section 8 |
| AI answer | `Markdown` (`content`) | IntelligenceBar |
| Segmented choice | `ToggleButtonGroup` (`forms`) | Tier filter, comparison period |
| Hover text | `Tooltip` (`overlays`), through `components/Tooltip.tsx` | Criteria, verdicts, run details |
| Dialogs | `Modal` (`overlays`) | Expanded radar, Smart report |
| Menus | `Menu` (`navigation`) | Reports |
| Path | `Breadcrumbs` (`navigation`) | Capability detail |
| Layout | `Flex`, `Grid`, `Surface`, `PageLayout`, `AppHeader`, `HelpMenu` (`layouts`) | Everywhere |
| Text | `Heading`, `Text`, `Paragraph`, `Strong`, `Link`, `ExternalLink` (`typography`) | Everywhere |

No chart library other than `@dynatrace/strato-components/charts` is imported in `ui/`. There is no `<canvas>` element.

### Hand-built visuals

**The Overview radar** (`components/PulseRadar.tsx`) is the only chart not drawn by Strato. It is a single inline `<svg>` built in React:

- One annular sector per capability. Sector paths are computed in the file (`sector()` returns an SVG path with two arcs).
- Inside each sector, three radial bars (Coverage, Utilization, Adoption) whose length is the value, over a neutral track (`Colors.Background.Container.Neutral.Default`).
- Four scale rings at 25, 50, 75 and 100; the inner three are dashed.
- An outer arc in the capability colour, a leader line and a text label with the capability name, its score and its band label.
- The centre shows "OVERALL SCORE", the score and the band. While a sector is hovered or focused it shows that capability's score and its three parts instead. There is no floating tooltip.
- A legend at the top left; clicking a part hides or shows its bars (at least one part stays on).
- Sectors, legend entries and the centre have `role="button"`, `tabIndex` and Enter/Space handlers. A sector opens the capability; the centre opens Overall score.
- Motion: the bars scale in once (0.9s); the hovered sector moves 8px outward and the others dim to 30% opacity. The entry animation is disabled under `prefers-reduced-motion: reduce`.

Other hand-built elements are small: colour dots (a `Flex` with a background and border radius) for capability identity, parts and bands; the band pills in the expanded radar modal; and the native `<textarea>` in `SmartReportModal`.

## 4. Color

### Surfaces and text

| Use | Token |
|---|---|
| Page background | `Colors.Background.Base.Default` |
| Panels, radar centre, IntelligenceBar | `Colors.Background.Surface.Default` (or `Surface` itself) |
| Radar bar tracks | `Colors.Background.Container.Neutral.Default` |
| Warning banners | `Colors.Background.Container.Warning.Default`, left border `Colors.Border.Warning.Accent` |
| Text | `Colors.Text.Neutral.Default` |
| Secondary text | `Colors.Text.Neutral.Subdued` |
| Accent text ("Dynatrace Intelligence") | `Colors.Text.Primary.Default` |
| Inline warnings | `Colors.Text.Warning.Default` |
| Error text | `Colors.Text.Critical.Default` |
| Rules and borders | `Colors.Border.Neutral.Default` |

### Score bands (`utils/colors.ts`)

The colour of a score is its band. The same bands apply to the overall score, a capability score, each part and each tier.

| Label | Range | Token (`SCORE_BAND_TOKENS`) | Hex (PDF and tints) |
|---|---|---|---|
| N/A | 0–19 | `Colors.Charts.Status.Critical.Default` | `#CD3C44` |
| Low | 20–39 | `Colors.Charts.Categorical.Color14.Default` | `#DC671E` |
| Moderate | 40–59 | `Colors.Charts.Status.Warning.Default` | `#EEA746` |
| Good | 60–79 | `Colors.Charts.Categorical.Color07.Default` | `#5EB1A9` |
| Excellent | 80–100 | `Colors.Charts.Status.Ideal.Default` | `#36B37E` |

`scoreBand(score)` returns `{ label, color, token }`. Screens use `token`; the hex `color` is used by the PDF reports and for the tinted background of the band pills in the expanded radar modal.

### Part colors

One colour per part, the same in every radar sector and in the Guide:

| Part | Token |
|---|---|
| Coverage | `Colors.Charts.Categorical.Color01.Default` |
| Utilization | `Colors.Charts.Categorical.Color08.Default` |
| Adoption | `Colors.Charts.Categorical.Color07.Default` |

Outside the radar and the Guide, part meters are coloured by score band, not by part. `Color01` is also the line colour of the overall "Score over time" chart and of the "Most used apps" meters.

### Capability identity colors (`queries.ts`)

Each capability has a fixed hex colour that identifies it and never expresses a judgement.

| Capability | Color |
|---|---|
| Infrastructure Observability | `#3B82F6` |
| Application Observability | `#8B5CF6` |
| Digital Experience | `#EC4899` |
| Log Analytics | `#F59E0B` |
| Application Security | `#EF4444` |
| Threat Observability | `#F97316` |
| AI/LLM Observability | `#06B6D4` |
| Business Observability | `#10B981` |
| Software Delivery | `#6366F1` |
| Platform Governance | `#64748B` |
| FinOps & Sustainability | `#84CC16` |

Where the code uses them: the radar outer arc, leader line, anchor dot and hover highlight; the dot before the capability name (detail title, Evolution accordion, Guide accordion); the capability's "Score over time" line and band; the "Related apps" meters. Scores, meters of parts and state marks never use a capability colour.

### Verdict colors (`diagnosis.ts`, `VERDICT_CHIP`)

| Verdict label | Chip color |
|---|---|
| Healthy | `success` |
| Starved | `primary` |
| Unwatched | `critical` |
| Skin-deep | `warning` |
| Dark | `neutral` |
| Not assessed | `neutral` |

### State colors (`STATE_META`)

| State | `HealthIndicator` status | Color token (meters, readings) |
|---|---|---|
| Met | `ideal` | `Colors.Charts.Status.Ideal.Default` |
| Not met | `critical` | `Colors.Charts.Status.Critical.Default` |
| Not assessed | `neutral` | `Colors.Text.Neutral.Subdued` |

The same two status tokens colour a change on the Evolution page: up is Ideal, down is Critical, no change is Subdued.

## 5. Typography

Text uses the Strato text font through `Heading`, `Text`, `Paragraph` and the `textStyle` prop (`base`, `base-emphasized`, `small`, `small-emphasized`). Heading levels: 2 for the page title, 5 for a `Panel`, 4 for a Guide section, 6 for a tier inside the Guide accordion.

The code font is `Typography.Code.Small.Default.Family`, declared as `MONO` in each page. It is used for numbers and readings:

- the score next to a page title (22px, weight 700);
- the line of parts under a capability meter and the people and queries line under an app meter;
- value and target ("value → target") and the gain in "What to do";
- presence readings in the Criteria panel;
- changes, run dates and "from → to" readings on the Evolution page;
- numbers quoted inside Guide paragraphs and the target column of "What is measured".

Labels, names, headings, chips, buttons and table cells stay in the text font. SVG text in the radar inherits the page font and sets `font-variant-numeric: tabular-nums` on scores.

## 6. Status and state vocabulary

| Concept | Words shown |
|---|---|
| Score bands | N/A, Low, Moderate, Good, Excellent |
| Score parts | Coverage, Utilization, Adoption |
| Utilization tiers | Foundation, Best practice, Excellence |
| Criterion state | Met, Not met, Not assessed |
| Verdicts | Healthy, Starved, Unwatched, Skin-deep, Dark, Not assessed |
| Criterion change (table) | Gained, Lost |
| Criterion change (causes) | Lost, Gained, New criterion, Removed criterion, No longer assessed, Now assessed |
| Score change | "N pts" with an arrow, or "No change" |
| Comparison period | Last change, 30 days, 90 days, First run |
| Overview lead | "Needs attention", "All capabilities at 60% or above" |
| Missing value | "—" |
| Missing data | "Adoption not available", "No usage data", "No saved run yet", "None" |
| Scale tier | Exact, Large, xLarge |

## 7. UI rules

1. **Percentages are floored, never rounded up.** Scores are computed with `Math.floor`; `pctFormat` floors to one decimal; meters receive `Math.floor(value)`; shares of users are `Math.floor(x * 1000) / 10`.
2. **No internal criterion ids on screen.** Ids are used as React keys and lookup keys only. A trailing "(%)" is stripped from criterion labels.
3. **Counts go in tooltips.** Queries run, records scanned, bytes and cache hits are in the "Run details" tooltip; people behind an adoption share are in the meter tooltip.
4. **Labels and numbers on screen, explanations in tooltips.** Criterion descriptions, why they matter and the next step are in `Tooltip`s; panel explanations are in `InformationOverlay`; the verdict meaning is in the chip tooltip. The Guide page is the stated exception.
5. **No truncated text.** Criterion names sit above their bar at full length instead of on a chart axis; radar labels are single-line with side padding sized for the longest name; table text columns use `autoWidth`; no `text-overflow: ellipsis` appears in the code.

## 8. Loading, empty and error states

| Situation | What is rendered |
|---|---|
| Page module loading | `Suspense` fallback in `App.tsx`: `Skeleton` blocks and `SkeletonText` |
| Assessment running (Overview, Overall score) | Centred `ProgressBar` labelled "Assessing the environment": indeterminate while the environment is probed, then the share of queries returned |
| Overview narrower than 640 px | The radar is replaced by the overall score and one `MeterBarChart` per capability, lowest first; each name opens the capability |
| Run produced no capabilities | `EmptyState` (`context="chart"`, `type="something-missing"`), "No assessment results", button "Run assessment" |
| No criterion could be measured | `EmptyState` (`context="generic"`, `type="something-wrong"`), "The assessment could not read this environment", button "Try again" |
| Assessment hook reports an error | "Assessment failed" and the message in `Colors.Text.Critical.Default` |
| Capability not found in the session | `EmptyState`, "No assessment in this session", button "Go to assessment" |
| Evolution, history loading or run in flight | Centred `ProgressCircle` |
| Evolution, one saved run | The baseline view: `IntelligenceBar` with first-run questions, "Score", "Score over time", "What holds each score" (accordion per capability, lowest part marked), "Capabilities" and the "Closest to passing" table |
| Evolution, no saved run | `EmptyState`, "No saved run yet", button "Go to assessment" |
| Adoption still loading | `SkeletonText lines={3}` in the apps panels |
| Adoption unavailable | Text "Adoption not available" in place of the meter |
| Trend with no points | Text "No saved run yet" |
| Gap list loading / failed | `SkeletonText lines={2}` / "The list could not be loaded." |
| AI answer loading | `AiLoadingIndicator` "Analyzing the assessment" |
| AI answer or Assist hand-off failed | `MessageContainer variant="warning"` |
| Report being generated | `Button loading` on Reports |
| No FinOps data for the FinOps report | `showToast` of type `warning` |
| Uncaught render error | `ErrorBoundary`: "Something went wrong", the message, button "Reload App" |

## 9. Light and dark theme

Theme comes from the platform through `AppRoot`. The app has no theme switch and stores no theme preference. Colours are Strato tokens, which resolve to CSS custom properties, so surfaces, text, charts and the radar follow the theme without code. `useCurrentTheme()` is read in `CoverageAssessment` and `CapabilityDetailPage` only to pick an alpha for a few tinted backgrounds that are not tokens: the band pills in the expanded radar modal, and the text area and error box of `SmartReportModal`.

Capability identity colours are fixed hex values and are the same in both themes.

## 10. PDF report palette

Reports are drawn with jsPDF (`ui/app/reports/pulseReports.ts`, loaded on demand) and do not use Strato tokens. Pages are light in both themes, in the built-in Helvetica font, normal and bold.

| Name | RGB | Use |
|---|---|---|
| `INK` | 22, 22, 29 | Text |
| `DIM` | 105, 108, 125 | Secondary text |
| `RULE` | 222, 224, 232 | Rules |
| `TRACK` | 234, 236, 242 | Meter tracks |
| `ACCENT` | 28, 82, 194 | Accent |
| `PASS` | 34, 150, 100 | Met |
| `FAIL` | 200, 50, 60 | Not met |

Score colours in the PDF come from the same bands as the screens: `bandRgb(score)` converts the hex `color` of `scoreBand(score)`. The Smart report PDF (`reports/aiNarrativePdf.ts`) also uses a white page and Helvetica.
