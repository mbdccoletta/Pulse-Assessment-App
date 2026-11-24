# Changelog

All notable changes to the Pulse Assessment app are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [3.0.18] — 2026-11-24

### Changed
- The estate target scales coverage instead of adding a pass/fail criterion. A capability with a target reads coverage as the share of its criteria met times the share of the planned estate monitored (hosts and clusters for Infrastructure, applications for Digital Experience): 51 of 5,000 planned hosts is 1% of the project covered, however well those 51 are configured, so 5,000, 20,000 or 50,000 planned hosts now read differently. The planned-estate rows stay on the capability page and in "What to do" (their gain is the coverage the full estate would bring); they no longer count in the tiers. The Coverage meter's tooltip shows both factors.

## [3.0.17] — 2026-11-24

### Added
- Deployment criteria, read the way Fleet Management and Infrastructure & Operations read the estate. All in Foundation; an estate with nothing for them to count (e.g. OpenTelemetry only) reads "not assessed", never a failure:
  - **Application hosts in full-stack** (Infrastructure, `i29`): hosts running Java, .NET, Node.js, PHP or IIS processes that OneAgent monitors in full-stack mode.
  - **OneAgent code modules up to date** (Infrastructure, `i30`): code modules without Fleet Management's `AGENT_OUTDATED` issue, i.e. not waiting for a process restart.
  - **Hosts reporting** (Infrastructure, `i31`): hosts seen in the last 7 days that reported in the last 30 minutes; Kubernetes nodes are left out, they come and go by design.
  - **Application processes instrumented** (Application, `a18`): application processes on full-stack hosts that run a OneAgent code module (Fleet Management) — the usual reason a full-stack host shows no services (injection off, or the process started before OneAgent).
  - Each comes with its "Which ones?" list: hosts not in full-stack, processes waiting for a restart, hosts that stopped reporting, hosts with uninstrumented processes.
- **Estate target** (header button "Target"): the hosts, web and mobile applications and Kubernetes clusters the project plans to monitor. Each number set adds a Foundation criterion, monitored ÷ planned (`i32`, `i33`, `d16`), so coverage also reads against the real size of the project and not only against what already reports. Stored in the app state (one value per environment, the same for every user); clearing it removes the criteria. Its numerators are the same host and cluster universe the other criteria use, after the OpenTelemetry, mixed and Smartscape adaptations.
- Network devices (`i27`) and network interfaces (`i28`), Best practice in Infrastructure, from the SNMP extension's Smartscape nodes and metrics.
- Coverage kit (`scripts/export-coverage-kit.mjs`): Pulse packaged for a host app, with every screen, the host's language (English, Portuguese, Spanish) and the host's inventory window; a light `summary` entry for host pages that only show the latest reading.

### Changed
- Adoption reads the API gateway's audit events (people's browser actions per app), not query executions: apps that never run DQL (settings, Hub, configuration screens) now count. Users of the Dynatrace organisation (SE, partner, support) and the assessment tools themselves are left out of the score; "Most used apps" names the population ("Share of 773 users") and its tooltip gives the Dynatrace users counted apart. The people criteria (Assist, MCP and dtctl usage per data source) leave Dynatrace users out the same way. Every adoption read carries a 2 GiB scan ceiling.
- Inventory and metric criteria follow the host's window when Pulse is embedded; logs, spans and events always keep 2 h, so a longer window never multiplies what Grail reads. The capability header and Run details name the window.
- The radar's centre texts shrink to fit the ring at any size; the score gauge's tooltip says the score and its band.

## [3.0.16] — 2026-11-23

### Changed
- App lists (Related apps on the capability page, the app list on the Overall score page and in the reports) show official Dynatrace apps only; custom apps built in the environment still count as usage but are not recommended. The raw export keeps every app.

### Fixed
- "1 people" reads "1 person" (and "1 pessoa", "1 persona" in the reports).

## [3.0.15] — 2026-11-23

### Fixed
- The score gauge (Overall score and capability pages) drew its number in the default text colour while the arc followed the band; the number now takes the band's status colour, like every other score in the app.

## [3.0.14] — 2026-11-23

### Changed
- App usage counts people, not queries. Related apps (capability page and Overall score) and the reports show, per app, the people who opened it in 30 days and the average per day ("1,498 people a month · 205 a day"). A query count measured traffic, not adoption: a dashboard on a wall screen runs thousands of queries for nobody. The raw export carries `peopleMonth` and `peoplePerDay` instead of query counts. The "Queries by app" bar is removed.
- Related apps tells which apps to use more. Apps are split into "Use more" and "In use" at the adoption line the verdict already uses (12% of active users); "Use more" comes first, the capability's own apps before shared ones, each with the people it needs to reach the line ("+13 people to reach 12%"). Bars use the status colours: amber below the line, red when nobody opened the app, green above.
- Every app name opens the official app in a new tab.
- The verdict of each capability (Healthy, Unwatched, Skin-deep, Starved, Dark) opens its app usage: on the Overall score page it opens the capability at Related apps; on the capability page it scrolls there.
- The Overview header no longer shows the environment id, the date or the telemetry-strategy chip: the app identifies the environment and the strategy by itself, and the strategy still drives the catalog, the reports and the Dynatrace Intelligence facts. Run details stays.

## [3.0.13] — 2026-11-22

### Changed
- Metrics first. Database, messaging and database-depth coverage (a8, a9, a13) read the service metrics Dynatrace derives from spans (`dt.service.database.query.count`, `dt.service.messaging.*`) instead of scanning spans. Checked service by service against the span reading on a ~20,000-host estate: 98–99.5% of the same services, no Grail scan.
- "Multi-service trace depth" (a10, share of traces crossing services) is replaced by "Services calling other services" (a17), read from the call relations Smartscape observes in traces over the last 2 hours. A new id, because the question changed; free to read.
- One query shape for every user. The per-user full-fidelity mode of 3.0.12 is removed: a Dynatrace user and a customer user run the same windows, sampling and 50 GB ceiling, so a number never depends on who opened the app. A reading the ceiling cuts is marked ≈, as before.
- Criteria that read the same records share one Grail scan: the log breadth criteria (hosts, services, sources, levels, namespaces, services with errors, cloud hosts, and their OpenTelemetry forms) and the AI span criteria (services, providers, tokens, models, agents, content, errors, guardrails). Each field is the same number its own query returns; each criterion keeps its DQL in reports and its entry in the 24h cache.
- Measured on a lab tenant ingesting about 18 million log records a minute: a fresh run scans 74 GiB, against about 356 GiB in 3.0.12.
- Status colours follow the Dynatrace platform: green for Good and Excellent, amber for Moderate, red for Low and Critical, from the platform's status tokens (two bands had used series colours). Numbers and labels use the status text tokens, which stay legible on the dark theme; bars and rings use the chart status tokens. The lowest band, 0–19%, is named Critical instead of "N/A", which read as "not applicable".
- Capability colours no longer use red, amber or green, which mean status: Log Analytics, Application Security, Threat Observability, AI/LLM Observability, Business Observability, Software Delivery and FinOps & Sustainability moved to blue, violet, pink and cyan tones.
- Refresh and Reports are in the header on every page, not only on the Overview and Overall score.
- The loading state is a pulse running along an electrocardiogram trace, with the share of queries done; it stays still when the system asks for reduced motion.
- Run details shows what the run read from Grail (volume, records, cache) instead of a list-price dollar estimate: the volume read is the load on Grail, and what is billed depends on the environment's licensing.
- A read shared by several criteria gets the scan ceiling of all of them (50 GB each), so sharing never cuts a reading that would have been complete on its own.
- The radar no longer prints "Rings at 25, 50, 75 and 100".
- Evolution names a change in what is measured as chips (app version, telemetry strategy, capabilities added or removed) with the explanation in their tooltip, instead of a paragraph on screen. Capability colours there follow the current catalog, not the colour a saved run recorded.

### Removed
- "Service tracing coverage" (a1) and "Root span coverage" (a3): read from metrics they are the same number as "Throughput coverage" (a7), measured 99.96% the same services; one fact, one number.
- "OTel instrumentation coverage" (a4): it scored the share of services using OpenTelemetry, which judges the customer's choice of source. The assessment is source-agnostic: it judges whether data arrives and is put to use.
- "AI tracing service breadth" (ai9): the share of all spans that are AI spans judges the mix of the data, not the use of the platform, and its denominator read every span of 72 hours. "AI span service coverage" (ai1) keeps measuring AI adoption.
- "Cloud span enrichment" (i18): no source answers it per service without scanning spans; cloud context stays measured on hosts and logs (i13–i17).
- 138 criteria.

### Fixed
- Ratio criteria were read unsampled over their whole window in cost mode. The rule that keeps the window of presence checks recognised them by the query ending in "summarize count()", which ratios such as Structured logging and Multi-source host logging share. Presence is now decided by the criterion (no denominator, or a constant 1), so ratios are sampled again.
- Pure OpenTelemetry no longer marks down "Energy in productive use": like the other carbon criteria it is computed from OneAgent host data, so it leaves the score instead of reading 0%.
- The Overview painted the score before app adoption, one of its three parts, had arrived, and the number changed a few seconds later (measured: 61% then 56%). The loader now stays until the score is final.
- The telemetry chip, and the run modes behind it (OpenTelemetry, Trace Proxy, Smartscape), are kept when the user leaves the Overview and comes back. Before, the chip disappeared and a Refresh from that point ran the default OneAgent catalog.

## [3.0.12] — 2026-11-21

### Added
- Full fidelity for Dynatrace users. When the signed-in user has a Dynatrace account, queries run on their authored windows with no scan ceiling and no sampling, and with longer timeouts; the scale-tier banner is hidden and the run details say the read was complete. Customer users keep the cost controls.
- Partial readings are marked. When Grail stops a read at the scan ceiling, the value shows with "≈" on screen (the tooltip says why), with "~" in reports, is flagged in the raw export (`partialRead`) and in the Dynatrace Intelligence facts, and the run details count how many readings were partial.
- Every assessment classifies the customer's telemetry strategy: Full OneAgent, Mixed or Pure OpenTelemetry. A neutral chip next to the environment name shows it, with the share of hosts on each side for a mixed estate (counts and what the strategy changes in its tooltip). The strategy heads every report, is part of the raw export and of the Dynatrace Intelligence facts, is saved with each run, and Evolution names a change of strategy between two runs. The Guide explains the three. The banners that explained the OpenTelemetry modes on screen are replaced by the chip.
- The app identifies where the telemetry comes from and picks the matching catalog on open: OneAgent only, OpenTelemetry only, or both. One free probe compares the hosts OneAgent reports with the hosts and Kubernetes nodes OpenTelemetry reports, matched by short host name so a host seen by both counts once. The source is shown on screen and stated in the reports.
- Mixed environments (OneAgent and OpenTelemetry side by side) are counted as one estate: 14 host, Kubernetes, process and log criteria count both sides in the numerator and in the population, instead of measuring the OneAgent part alone. Criteria that only exist with OneAgent keep measuring the OneAgent part. Actions name the OneAgent step and the OpenTelemetry step.
- OpenTelemetry-only environments are assessed in full. When no OneAgent reports, the app reads hosts, Kubernetes and their logs from the OpenTelemetry signals (hostmetrics, kubeletstats and k8s_cluster metrics, service.name and host attributes) instead of OneAgent entities and metrics. 20 criteria switch to these readings with the same tier and pass line; 10 that only exist with OneAgent (process topology, Runtime Vulnerability Analytics, Runtime Application Protection, per-host carbon) leave the score instead of counting as failed. The OneAgent version criterion becomes "Collector health telemetry". Remediation actions speak OpenTelemetry (Collector receivers and processors, SDK settings) in all three report languages. Detected on open by one free probe; disclosed on screen and in the reports. Every reading except the host log criteria is a metric query, with no Grail scan.

### Fixed
- Presence checks on sparse events read "none" when the event happened outside a shortened window. To save scan, every log, span and event reading was cut to 15 minutes or 4 hours; a check such as "CI/CD deployment events" then missed deployments made earlier in its 24 hours (measured: 9 deployments in 24h, 0 in 4h, so the check read "None"). Presence checks (CI/CD deployment events, Log-based events, Agent tool-call tracing, Release validation) now keep the window they were written with, under the same 50 GB scan ceiling.
- "Host-process topology" could not run on very large estates: expanding every process group instance timed out (180,000 instances) and left the check unassessed. It now reads the host dimension of the process CPU metric, which is free and returns the same count (4,709 hosts on the estate where it failed).
- "K8s node monitoring depth" divided the nodes that report container metrics by the number of clusters, so any cluster with two or more nodes passed at 100%. It now divides by the Kubernetes nodes (entity list, or Smartscape where there are no classic entities). Measured on a production estate: 89% instead of 100%.
- In mixed environments the populations of clusters and namespaces include the entity lists, so a namespace or cluster that sends no metric still counts as a gap instead of dropping out of the total.

## [3.0.11] — 2026-11-20

### Changed
- Teams to involve are cross-team. Each capability now calls for every responsibility its criteria depend on, the lead one first (for example Development, Security and Operations for AI/LLM Observability; Operations, Security and Infrastructure for Platform Governance), and the reports list the teams grouped by responsibility, so it is clear who does which part of the work.

## [3.0.10] — 2026-11-20

### Added
- Reports name the teams to involve. Each capability in the Action plan and Criteria detail reports, and a section of the Overall score report, lists the environment's own Ownership teams that hold a responsibility the capability calls for (for example Operations and Development for Log Analytics, Operations and Line of business for FinOps & Sustainability). Read from the Ownership settings, with no Grail scan. When no team holds the responsibility, the report says so and names the responsibility. The raw export carries the same list as `teamsToInvolve`.

## [3.0.9] — 2026-11-20

### Changed
- No points anywhere. Screens, Dynatrace Intelligence answers and reports no longer state a number of points or a point difference. A change is a Strato icon (arrow up for a gain, arrow down for a loss, a dash for no change) beside the before and after percentages. Actions keep their order, largest effect on the score first, and carry the gain icon.
- Raw data export: `scoreGainIfMet` and `overallGainIfMet` are replaced by `actionOrder`, the position of an unmet criterion inside its capability. Schema `pulse-assessment/raw-data/2`.

## [3.0.8] — 2026-11-20

### Added
- Dynatrace Intelligence questions that explain why the area matters, on the two capabilities whose value is least obvious from their criteria. Platform Governance: "Why governance matters" and "Data protection posture". FinOps & Sustainability: "Why FinOps matters".

## [3.0.7] — 2026-11-20

### Added
- Six criteria in Platform Governance on data protection and data governance, all read from configuration or system tables with no Grail scan: Sensitive data masking in logs, Span attribute masking, RUM privacy masking, Session Replay recorded with masking, Custom buckets with their own retention, and Audit trail consulted. The catalog has 143 criteria.
- The configuration reader can count only the settings objects a named rule accepts (`settings:count <schema> <predicate>`): rules that are switched on, or one object per application. Counting every object was wrong for schemas that ship with built-in entries switched off.

## [3.0.6] — 2026-11-20

### Added
- The Overall score report now carries the Overview radar: every capability with its coverage, utilization and adoption, drawn as vectors in the PDF.
- The FinOps & Sustainability page offers the FinOps report directly, in English, Portuguese and Spanish: cost by host and cluster, idle hosts, energy and carbon emissions.

## [3.0.5] — 2026-11-20

### Removed
- The Analytics panel of the capability page. It repeated the criteria above it as a table; the same data, with the DQL of each criterion, stays in the Criteria detail report and in the raw data export.

## [3.0.4] — 2026-11-20

### Changed
- Capability page: the Analytics panel now sits below Related apps.

## [3.0.3] — 2026-11-20

### Added
- PDF reports in Portuguese and Spanish now print criterion names, descriptions and actions in the report's language (`ui/app/reports/i18n/`). Capability names stay as Dynatrace writes them. A criterion missing from a translation falls back to English.
- A progress bar while the assessment runs. The Overview and Overall score pages were blank until the last query returned, on first open and on every Refresh.

### Fixed
- A host count that arrived after the run had started ran the whole assessment a second time on environments of 5,000 hosts or more. A run now starts only on an explicit trigger, and the first run waits for the host count.
- The Guide disagreed with the engine in five places: the verdict order, coverage counting assessed criteria only, scores being rounded down, the score without adoption, and an empty tier counting as 0%. It also described adoption as all of a capability's apps together; the reading is the capability's most used app.
- "Gain if met" points were rounded to one decimal and could round up. They are floored, like every other figure.
- The Large scale tier advertised a 200 GB scan cap; the cap applied was, and stays, 50 GB per query. The text now says so.
- The assessment measures whether the platform is used correctly, not how good the data looks. Two criteria judged the data and had pass lines with no Dynatrace rule behind them: "Problems lasting 5 minutes or more" is removed (problems are already assessed by "Problems with root cause"), and "Critical vulnerabilities without public exposure" is replaced by "Vulnerabilities with Davis assessment": the share of open critical and high vulnerabilities for which Davis could assess reachable data assets, met at 50% like the root-cause criteria. The catalog has 137 criteria.
- Criterion "Custom attribute enrichment" renamed "Custom device log enrichment": it measures logs carrying a custom device entity.

### Changed
- Evolution is a complete page from the first run. With one saved run it reads that run as the baseline: the parts of each capability with the lowest one marked, every criterion that is not met with its value and target, the criteria closest to passing, and its own Dynatrace Intelligence questions. The comparison view takes over from the second run.
- Narrow screens: the Overview shows the capabilities as a list instead of the radar, pages no longer run wider than the screen, and tables wrap text instead of cutting it.
- Measured cost of a full fresh run: 44 GiB on a tenant ingesting about 18 million log records a minute (137 GiB before 3.0.0).

### Removed
- Scope `storage:filter-segments:read`: no code read segments. The app now requests 17 scopes.
- Dependencies with no import: `chart.js`, `react-chartjs-2`, `@dynatrace-sdk/client-classic-environment-v2`. `@dynatrace-sdk/navigation` and `@dynatrace-sdk/app-environment` were imported without being declared and are now declared.
- Dead code: the consolidation factor (nothing set it), the preflight hook, three trace-proxy entries for criteria that no longer exist, and unused components and helpers.

### Documentation
- `ARCHITECTURE.md`, `ARCHITECTURE-DIAGRAM.md`, `SCORING-CALCULATIONS.md` and `DESIGN-SYSTEM.md` rewritten from the 3.x code. `CRITERIA-SUMMARY.md` is now generated from the catalog by `tools/gen-criteria-summary.mjs`. `PERFORMANCE-REPORT-80K-HOSTS.md` is marked as a historical 2.4 measurement.

## [3.0.2] — 2026-11-19

### Changed
- App description in the manifest and the README now describe 3.x: 11 capabilities, 138 criteria, the three-part score, the 18 scopes and the current cost controls. No change in behavior.

## [3.0.1] — 2026-11-19

### Fixed
- Evolution showed "Not enough runs to compare" until a second run existed. With one saved run it now shows that run: the score, its three parts, the chart and every capability. The comparison panels and the questions appear with the second run.
- A run that finished while another page was open was never saved: the save lived on the Overview page. It now lives at the app root.
- Opening Evolution while a run is in flight shows a loading indicator and fills in by itself.
- Reopening the app on the same day with the same result no longer saves a new history entry.

## [3.0.0] — 2026-11-19

A new major version: the score changed meaning (coverage, utilization and adoption), the catalog grew from 9 to 11 capabilities, the pages were rebuilt and every AI surface was rewritten. Runs saved by 2.x are not comparable with 3.0 runs. Everything listed under this heading was developed as 2.6.0 and never released under that number.

### Removed in the final pass
- Criterion "Log source continuity": its denominator needed three hours of logs, hit the scan ceiling on a high-volume tenant and cost about 46 GiB a run for a value that could not be trusted.
- Dead code: the old comparison page, AI insights page, persona and custom reports, the earlier radar, scatter and card components, the consolidation panel, and the second remediation catalog. `CoverageAssessment.tsx` went from 1,797 to 515 lines.

### Changed in the final pass
- "Log source diversity" reads the log metric when it exists (distinct log-emitting entities), marked as an approximation; without the metric it reads logs as before.
- Run history is kept for 90 days (was 15), so the 30 and 90 day options of Evolution have data to compare.


### Audit before release
- **Cost**: log coverage criteria (hosts, services, error services, namespaces, severity classes) read the `dt.log.status_per_entity_count` metric when it exists (`log-metric.ts`): no log scan. On the reference tenant a full run went from about 262 GiB to 137 GiB.
- **Cost**: FinOps data is no longer fetched when the Smart report opens, only when a request asks about cost, energy or carbon.
- **Fixed**: the result cache document is emptied in place and never deleted. Deleting it sent it to the trash with its id reserved, so nothing was cached afterwards and every open was a full run. Document id is now `pulse-querycache-2`.
- **Fixed**: Refresh now takes new readings (it used to re-serve the 24h cache) and re-runs the catalog adapted to the environment.
- **Fixed**: percentages are floored at the source (criterion value, coverage, utilization, adoption share), never rounded up into a pass.
- **Fixed**: adoption is read once for the whole app; a failed population query reads "not measured" instead of 0% everywhere; the query is polled.
- **Fixed**: Guide and Evolution treated 12 share criteria as presence checks; closed tier gates with an empty tier; capability trend mixing scoring methods; configuration reads offered as DQL.
- **AI**: one instruction for every surface (the old Assist instruction asked for expected outcomes in numbers); not-assessed criteria are no longer sent as failures; tier shares instead of tallies; adoption sent as the score shown on screen; page facts no longer cut mid-fact; Smart report carries the Overall lens and facts.
- **AI, after testing every question on the reference tenant**: page facts now state which capabilities have high and low adoption, list the AI and automation criteria with their readings, give each unmet criterion's distance to its pass line, and state explicitly when nothing regressed or improved between two runs; the request text has a size budget (the service answers HTTP 400 above about 10,000 characters); one question that tripped the guardrail was reworded.
- **Reports**: say how the run was measured (trace proxy, Smartscape, estimates); "Not assessed" as a word and explained; FinOps prints "Not available" instead of zeros, excludes hosts without a CPU reading from idle, says when the host list is capped, wraps long names; local date; raw data gains a `run` block and marks configuration reads.

### Added (after the first 2.6.0 notes)
- **Intelligence layer per page** (`ai/pageIntelligence.ts`): Overview, Overall score, Capability, Evolution and Guide each have their own lens, questions and computed page facts (gains in points, closed tier gates, verdicts, causes of change, like-for-like score). The model quotes numbers the app computed; it is never asked to do arithmetic. "Go deeper in Assist" carries the same lens and facts.
- Seven criteria from the State of Observability 2026 review: SLOs defined (g10), Custom anomaly detectors configured (g11), Adaptive or seasonal baselines in alerts (g12), Problems lasting 5 minutes or more (g13), Custom log pipelines configured (l18), Critical vulnerabilities without public exposure (s15), Response model recorded (ai19). Cuts of g13 (5 minutes, 80%) and s15 (90%) are provisional.
- Engine: `settings:count <schemaId>` criteria read configuration from the settings API with no Grail scan.
- Evolution: "What caused the change" panel; snapshots store app version and adoption share.
- **Platform Governance**, a tenth capability (8 criteria): workflows running, OneAgent version currency, host cost allocation, logs with security context, workflow execution success, ITSM/chat integration, event-triggered workflows, human approval. Targets are provisional.
- New pages: Overall score (replaces Executive summary), Evolution (rebuilt), Guide (replaces Setup and guide).
- Reports rebuilt (`reports/pulseReports.ts`): Overall score, Action plan, Criteria detail in EN/PT/ES, plus raw data export (JSON, CSV).
- Radar: hover highlight, capability score in the centre, centre opens Overall score. Capability detail: filter by utilization tier.

- **Criteria re-allocated by what they measure.** Buckets, ownership and tagging moved to Platform Governance; cost allocation to FinOps & Sustainability. Workflows, Assist, MCP and dtctl are no longer pinned to one capability: workflow criteria sit where the workflow acts, and Assist/MCP/dtctl usage is measured per capability from the data each query reads. The Workflows and Assist apps count as shared in every capability and primary in none.
- **Strato components throughout the live pages**: Surface, Heading, Paragraph, Chip, HealthIndicator, DataTable (sortable, paginated, CSV download), Accordion, Breadcrumbs, EmptyState, InformationOverlay, MessageContainer, AiLoadingIndicator, Markdown, SkeletonText, ProgressCircle, Toast.
- **FinOps & Sustainability**, an eleventh capability (8 criteria) read from Cost & Carbon Optimization data, plus a **FinOps report** (cloud bill by service/region/account, commitment and ownership share, idle hosts, wasted energy, emissions) and the same measured facts in the Assist context. Targets are provisional.
- Smart report: the instruction no longer asks for menu paths or expected numbers; invented figures are forbidden; the PDF keeps accents.
- **Works on either licensing/entity model, with no setup step.** Two probes before the first run switch on Trace Proxy Mode (no Traces on Grail) and the Smartscape entity model (no `dt.entity.*` tables, `entity-model.ts`). New scope `storage:smartscape:read`.
- Removed: capability selection, Consolidation Context, the pre-flight screen.

### Fixed
- Runs were saved to history before adoption was read, with adoption 0 (`useAppAdoption` now reports loading until its first answer).

Validated on one tenant through the dev server only. Not committed, not deployed.

### Changed — platform
- **Strato 1.18 → 3.18**, design tokens 1.3 → 1.8.1, icons 2.7. The deprecated
  `strato-components-preview` package is removed; its imports (Page, Modal,
  Tooltip, Menu, ToggleButtonGroup) now come from `strato-components`. The dark
  theme is the platform's neutral black (#16161d / #1b1b22) instead of navy; the
  last hand-written navy fills (radar centre disc, guide background) follow it.

### Changed — screens
- **Coverage is the radar only.** Hover highlights a capability; a click on a
  point or a label opens the new **capability detail page** (`/capability/:name`).
  The side cards, the economy-mode banner and the how-to footer are gone from it.
- **The app opens on Coverage.** With a run in the last 24h the result loads from
  the cache (no Grail cost); otherwise an empty state offers to run it. Capability
  selection, consolidation and the guide moved to **Setup and guide**.
- **AppHeader + PageLayout** replace the deprecated `Page`; Refresh, Reports and
  Run details sit in the header (one bar). Coverage leads with "Needs attention".
- **Executive summary** trimmed to the three scores, strongest / needs-attention
  and one chart. Detail page gains **Next steps**; Analytics is collapsed.
- **Capability detail page** with Strato charts: coverage gauge (GaugeChart),
  utilization tiers and adoption (MeterBarChart), criteria per tier
  (CategoricalBarChart, colour = verdict; presence checks as Present/Absent),
  score over time (TimeseriesChart), apps used (CategoricalBarChart), an
  analytics table (value, pass line, data source, query cost, copy DQL, docs)
  and the on-demand Assist insight the cards used to carry.
- **No internal counters on screen**: criterion ids, "116/116 queries OK",
  "97/116 criteria met", tier fractions, run counts and raw people counts are
  gone; run telemetry sits in one "Run details" tooltip. Failed checks stay
  visible. The technical PDF no longer prints criterion ids.
- **Utilization tab hidden** — its content is on the detail page; the view code
  is kept (restore the toggle item to bring it back).
- Davis CoPilot badge renamed **Dynatrace Assist**.
- DPS estimate uses the public list price (US$ 0.0035/GiB) instead of 0.0065–0.01.

### Changed — scoring: the capability score has three equal parts
- **Score = average of Coverage, Utilization and Adoption** (`ui/app/pulseScore.ts`).
  Adoption is the share of active users opening the capability's apps, scaled so
  20% = 100 (an app reference, not a Dynatrace rule). Without adoption data the
  score averages the other two. Applied once in `App.tsx`, so every screen, the
  snapshot and the reports read the same number. Rollback:
  `PULSE_SCORE_PARTS = "coverage"`.
- The app opens directly on the assessment (no start page); the radar centre
  reads SCORE.

### Changed — scoring: one target per criterion
- A criterion is met when its value reaches a single pass line; the score is the
  share of criteria met. The pass line is the MIDDLE of the catalog's targets
  (the higher one when there are two) instead of the lowest, which let almost
  every criterion pass from 1%. Presence checks are unaffected. Rollback:
  `PASS_LINE_DEFAULT = "lowest"` in `ui/app/passLine.ts`, or `?passline=lowest`.
- AI Observability also measures MCP in use by people on external clients
  (Assist's internal client excluded), dtctl in use and dtctl driven by AI agents.

### Catalog: 111 → 108 criteria (added 21, removed 24)
- **AI Observability** now also measures the customer's use of Dynatrace
  Intelligence: Assist in use (ai11), agentic AI in use (ai12), MCP clients
  connected (ai13), agentic workflows (ai14), plus agent tool-call tracing (ai10).
  Presence checks (≥1), no invented targets.
- **Problem practices per capability** — root cause identified and automated
  response (problem `event.id` = workflow `trigger.event.id`), scoped by the
  capability's entities: Infrastructure (i23/i24), Application (a14/a15),
  Digital Experience (d12/d13), Software Delivery on entities that received a
  deployment (sd11/sd12), AI on services that call an LLM (ai15/ai16), Business
  on services that emit business events (b9/b10). Pass line 1% until targets
  are set.
- **Release validation** (sd13): Site Reliability Guardian validations.

### Changed — security capabilities read security.events
- New scope `storage:security.events:read`. Application Security now measures
  Runtime Vulnerability Analytics coverage (process groups assessed), Runtime
  Application Protection, Security Posture Management and third-party findings.
  Threat Observability measures detection findings and external detection sources.
- Foundation now answers "is it on?" in Software Delivery (CI/CD deployment
  events) and Application Security (Runtime Vulnerability Analytics active, new);
  the depth targets moved to Best practice, so one unmet ratio no longer zeroes
  utilization.
- Software Delivery targets raised: services with a deployment marker ≥ 30%,
  services with an owner ≥ 50%.

### Removed
- s3–s10 and t5–t8: log, span, service and Davis-problem checks filed under a
  security name. None read security data.
- sd3–sd9 from Software Delivery: event kind/type diversity, service request and
  failure baselines, process group coverage and tagging, and Davis problem
  detection. None measures delivery, three repeat Application criteria, and any
  environment with OneAgent passed them. Software Delivery keeps deployment
  markers, CI/CD events, release validation, ownership and the two problem
  practices.
- t1, t2, t3, t9, t10, t11 from Threat Observability — they measured Davis
  problems, not security. Threat now holds security criteria only.

### Fixed — results that were wrong
- **ai8** read `gen_ai.usage.cost`, a field Dynatrace does not define (0% on every
  tenant); it now measures spans with token counts and the model.
- **AI-span ratios** (ai2, ai4–ai8) were computed from a 1-in-1000 sample — 6
  spans on the test tenant. Ratios whose both sides are gen_ai spans now read
  4 hours unsampled (~0.5 GB per query). A criterion can no longer divide a
  sampled count by an unsampled one.
- **a11, s3, sd7, a12, sd9** counted an entity even when the relation or the tag
  list was empty (`expand` keeps the row), so they always read 100%. They now
  count only entities that have it (test tenant: 140 → 96 services linked to a
  process, 140 → 121 tagged services, 564 → 469 tagged process groups).
- **i12** read a relation that does not exist on clusters; it now counts clusters
  that have namespaces.
- **Adoption** read the app id out of `client.source`, which many apps do not
  carry; it now uses `client.application_context` (the documented field). On the
  test tenant Dashboards went from no data to 1,591 people and Problems from 820
  to 1,529.
- **sd1** divided all Davis events by services (590 ÷ 140, capped at 100%); it
  now counts services with a deployment marker in `dt.davis.events`.
- **sd2** filtered `event.kind == "CUSTOM_DEPLOYMENT"`, which never matches
  (deployments are DAVIS_EVENT / CUSTOM_DEPLOYMENT) and always returned 0; it now
  checks CI/CD deployment events (SDLC_EVENT).
- **24h query cache** is keyed by the query Grail actually runs, so a change in
  the cost rules can no longer serve a value measured under the old rules.

### Changed — cost
- **l11** (log buckets) scanned 172 GB per run with no limit; it now reads
  `fieldsSnapshot`, which scans no raw data (same 8 buckets on the test tenant).
- **Log field-share criteria** (l3, l4, l5, l13, l16, t7, t8, i14–i17) read
  `fieldsSnapshot` instead of scanning logs: 0 GB, unsampled, within 0.3 points
  of the scanned values on the test tenant.

### Known gaps
- Log Analytics and Security have no problem scope yet.
- Problem criteria targets (root cause ≥ 50%, automated response ≥ 30%) are provisional app defaults, not a Dynatrace reference.

## [2.5.15] — 2026-09-29

### Added — every capability carries a verdict, not just a number

Coverage, utilization and adoption were shown side by side and the reading was
left to whoever was in the room. Three percentages are not a verdict: 82%
coverage means something very different when three people in 37 open the apps
than when the whole team does.

Each capability card now shows a named verdict — **Healthy, Skin-deep,
Unwatched, Starved, Dark, Not assessed** — on a band of its own under the
name, with the one-line reason beside it. Nothing is removed and **no score
changes**: the verdict is a reading of numbers the app already had.

A first cut put this as a small chip in the header row, between the score and
the existing Excellent/Good badge, where it read as just another badge and
went unnoticed on a real screen. The band is the fix.

On this tenant it separates cases no single number showed: Digital Experience
passes 82% of its checks and is *Unwatched*; Threat Observability is at 91%
but *Skin-deep* — the audience is in, the depth is not.

**The adoption cut needed an absolute floor.** A pure percentage threshold does
not survive a real tenant: the most-adopted capability here reaches 24% of the
platform population, so a 25% cut would leave nothing ever reading as well
adopted. Adoption now counts as high when it clears the share **or** a floor of
people. `tools/diagnosis.test.mjs` pins that — it asserts the floor-less
variant degenerates to a single verdict.

### A capability with nobody in it is not "adoption unknown"

Capabilities with zero users have no entry in the adoption map. Reading a
missing entry as unmeasured hid the exact case the verdict exists for — data
collected, nobody opening it. When adoption ran at all, a missing entry now
means zero. Caught by looking at the deployed screen, not by a test.

### Fixed — a criterion that could not be measured was scored as a failure

The score was `passed ÷ every criterion in the catalog`: the numerator excluded
criteria that errored, the denominator excluded nothing. Two cases reached the
customer as checks they had failed — a numerator query that errored, and an
entity denominator that came back empty. 33 of the 111 criteria denominate on
`dt.entity.service`, so a pure-infrastructure customer lost 30% of the score
**for not having services**.

Scoring now has three states — met, not met, **not assessed** — and the third
leaves both sides of the fraction. Utilization tiers follow the same rule. The
Executive Summary states how many criteria were assessed and how many were not.

Scores can go up; that is the number becoming correct, not the bar moving. On a
tenant where every entity type exists nothing changes at all.

### Fixed — the Evolution screen looked broken while it was working

History was fetched one document at a time — `await` inside a `for` loop, up to
200 sequential round-trips — with no loading state, so Evolution rendered "Not
enough data" the whole time: a slow fetch was indistinguishable from a lost
history. Downloads now run 8 in parallel, a skeleton shows while they land, and
the empty state distinguishes **no history yet** from **only one run so far**.

### Fixed — the radar re-rendered on every hover

`CovUtilRadar` is memoised, but both call sites passed `data={sorted.map(...)}`
— a new array each render, so the memo never hit and ~1000 lines of SVG redrew
on every hover, tooltip and collapse. It is built once with `useMemo` now.
`CapabilityScatter` was not memoised at all; it is now.

### Rollback
- `THREE_STATE_SCORING_DEFAULT` → `false` restores the previous arithmetic.
- Without a redeploy: `?accuracy=legacy`, or `localStorage['cca.accuracy']='legacy'`.
- Tree as it was: tag `pre-accuracy-fix`.

## [2.5.10] — 2026-08-12

### Fixed — misleading error on Smartscape-only tenants (issue #1)
- A tenant on the Smartscape entity model has no classic `dt.entity.*` tables:
  the probe fails to parse with `UNKNOWN_DATA_OBJECT` — "dt.entity.host isn't a
  valid data object". The preflight classified that as a generic failure and
  told the user to **grant OAuth scopes**, which cannot conjure a table the
  tenant does not have. The reporter had hosts running and was sent to fix
  permissions that were never the problem.
- New `no-classic-entities` status states the actual cause. The metrics probe is
  covered too — it groups `by:{dt.entity.host}` and fails the same way.
- This does not yet make the assessment run on those tenants. The catalog has 93
  `fetch dt.entity.*` queries across 15 classic tables, and measurement shows
  the denominator changes meaning under `smartscapeNodes` (classic counts
  entities active in the window; Smartscape counts entities in the topology),
  so it is a scoring decision rather than a translation. Tracked separately.

## [2.5.8] — 2026-08-06

### Fixed — Trace Proxy Mode was never offered
- The preflight probe classified SDK errors by reading `err.message` only. The
  query client throws `ClientRequestError`, which carries the parsed envelope in
  **`body`** while `message` stays generic ("Request failed with status code
  403"), so `TRACE_QUERY_ENTITLEMENT_MISSING` was never seen. A tenant without
  Traces on Grail was therefore told "Permission denied — scope not granted to
  this app" — advice that cannot fix an entitlement — and **Trace Proxy Mode,
  which exists precisely for that tenant, was never offered.**
- Classification now flattens `message`, `body`, `cause` and `details` into one
  searchable string, and tests for the entitlement **before** the generic 403
  branch, since an entitlement failure is also a 403.
- `probeQuery` now returns the entitlement decision instead of leaving the
  caller to re-derive it from the human-facing `detail` string — the same
  fragility that produced the bug.
- Verified against the exact payload from a live tenant: the shipped 2.5.7 code
  returns `fail` + "scope not granted"; the fix returns `not-entitled` + the
  readable "Querying spans requires ... Trace query entitlement." A plain 403
  still classifies as `fail` and keeps the scope hint.

Note: the `Request failed: {...403}` line still appears in the browser console.
The probe queries spans deliberately to detect the entitlement, so that 403 is
the detection working; the SDK logs every failed request.

## [2.5.5] — 2026-08-05

### Added — Economy Mode (Grail/DPS cost)
- **`scale-tier.ts`** gained a cost transform that runs at **every** tier, including `exact`. A full run was measured at 370 GB of scan (~$3.70, ~$60/month over 30 days on a reference tenant, read from `dt.system.events`); it now runs at **~41 GB (~$0.41)**.
  - `samplingRatio: 1000` is applied **only** where sampling provably cancels out: both sides of the criterion must be plain counts over the same table and the same window. Measured on 2h of logs — scan 4.99 GB → ~0.003 GB, ratio drift under 1.5 percentage points.
  - Everything else gets a **narrower window** instead, because `countDistinct` collapses under sampling (distinct log sources 63 → 28; AI providers 4 → 1). Short windows go to 15 minutes, long ones are capped at 4 hours.
  - Criteria whose two sides deliberately read different windows (l10, 24h vs 2h) are divided by the same factor so the ratio they encode survives.
  - A `scanLimitGBytes` ceiling is added to every hot query; the deliberate `-1` on l11 is preserved.
- **`CostModeNote`** — on-screen disclosure that values are close estimates, rendered next to the scores at every tier.
- **App adoption in the Executive headline** — average share of active platform users who open the apps behind each capability, beside Coverage and Utilization. Never feeds a score.

### Changed — terminology
- Every user-visible **"Maturity" is now "Utilization"**, including chart labels, hub captions, tooltips, the criteria list and the Assist prompts. Internal identifiers were left alone in this release and renamed in 2.5.6.
- Criterion a12 renamed from "Service tagging maturity" to "Service tagging utilization".

### Changed — Executive Summary
- The radar now plots **Coverage only** — the Utilization series, its hub number and its legend entry are gone — and grows from 28% to 34% of the canvas.
- The Capability Map is no longer a scatter: capabilities sit on the X axis with **coverage bars plus a utilization line**. Value labels resolve collisions deterministically and are never drawn below the axis; names word-wrap and fall back to short forms rather than breaking mid-word.
- The colour-to-capability legend strip was removed — both charts name their capabilities directly.

### Changed — cards and menus
- Criterion rows show **met / not met** only; the measured value stays in the expanded detail next to the threshold that gives it meaning.
- The AI Insight panel folds on click **without collapsing its capability card**; clicks on its controls and text selections are ignored.
- Active-user counts left the Coverage cards — adoption belongs next to Utilization.
- `Custom…` is now the last item in the Reports menu.
- Assist was removed from the Evolution page.

### Fixed
- The displayed version (`appVersion.ts`) and the deployed version (`app.config.json`) are now in sync; they had drifted, which is why 2.5.4 was superseded immediately.

### Security / hygiene
- Tenant identifiers, environment URLs and the author e-mail were replaced with placeholders across code, docs and scripts. **Local dev now needs `--environment-url`** (or a local edit of `app.config.json`).

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
- **Progressive Utilization Scoring**: Updated tier weights from 50/30/20 to **60/25/15** (Foundation/Best Practice/Excellence).
- Best Practice tier now only contributes to the utilization score when **Foundation ≥ 80%**.
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
- Coverage and Utilization dual-scoring model.
- Interactive polar radar chart with click-to-drill-down.
- 3 view modes: Coverage, Utilization, Executive Summary.
- PDF report generation (Summary, Coverage Detail, Utilization Detail).
- Assessment snapshot persistence (localStorage + Dynatrace Document Store).
- Evolution Over Time page with A/B snapshot comparison.
- Remediation actions and documentation links for all 111 criteria.
- Preflight scope validation.
- Dark/Light theme support.
