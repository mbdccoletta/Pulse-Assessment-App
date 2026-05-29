# Pulse Assessment — Project Memory

> Complete reference for any developer picking this up cold. Covers the
> intent, architecture, scoring math, every DQL pattern, the optimizations
> stack, and the design decisions that aren't obvious from the code.
>
> Read `HANDOFF.md` first for the executive summary and current state.
> Read THIS file when you need to understand *why* something is the way
> it is, or when you're modifying a non-trivial part of the system.
>
> **Sensitive data removed:** specific tenant IDs replaced with
> `<TENANT>` placeholders, OAuth tokens redacted, personal contact info
> kept only where it's already public in the codebase.

Document version: 1.0 — written 2026-05-29 against app version 2.5.2.

---

## Table of contents

1. [What this app does](#1-what-this-app-does)
2. [Domain model: capabilities, criteria, scoring](#2-domain-model)
3. [Architecture overview](#3-architecture-overview)
4. [The 110 criteria — full catalog with DQL](#4-the-110-criteria)
5. [Scale Tier — sampling for large tenants](#5-scale-tier)
6. [24h persistent cache](#6-24h-persistent-cache)
7. [C3 smart-skip](#7-c3-smart-skip)
8. [Demo Mode](#8-demo-mode)
9. [Perf instrumentation & JSON report](#9-perf-instrumentation)
10. [UI & presentation layer](#10-ui-presentation-layer)
11. [DPS cost model](#11-dps-cost-model)
12. [Snapshot persistence & Evolution Over Time](#12-snapshot-persistence)
13. [Build, deploy, run](#13-build-deploy-run)
14. [Design decisions journal](#14-design-decisions)
15. [Known limitations and false-positive guidance](#15-known-limitations)
16. [Glossary](#16-glossary)

---

## 1. What this app does

Pulse Assessment is a native Dynatrace App that scores **observability
coverage and maturity** across 9 capability areas using ~110 DQL
criteria. The output is a radar chart + capability cards + a maturity
report card, optionally exported as a PDF.

It's designed for sales engineers, customer success teams, and platform
owners who need to answer:

- "How well is this tenant *using* Dynatrace?" (Coverage view)
- "Where is the operating maturity for each capability?" (Maturity view)
- "What's the recommended next investment?" (Executive Summary view)
- "Have we improved over time?" (Evolution Over Time comparison)

The 9 capabilities map to Dynatrace's coverage taxonomy:

| Capability | # criteria | Color | Examples of criteria |
|---|---:|---|---|
| Infrastructure Observability | 22 | `#3B82F6` blue | Host CPU/memory/disk coverage, K8s cluster coverage, Davis problem coverage |
| Application Observability | 13 | `#8B5CF6` purple | Service span coverage, distributed tracing %, root-span %, anomaly detection |
| Digital Experience | 11 | `#EC4899` pink | RUM session coverage, mobile crash tracking, synthetic checks |
| Log Analytics | 16 | `#F59E0B` amber | Log volume, structured logging %, log-source diversity, bucket usage |
| Application Security | 11 | `#EF4444` red | Security event coverage, security-event-type coverage, attack detection |
| Threat Observability | 11 | `#F97316` orange | Problem entity correlation, error-log threat coverage |
| AI Observability | 9 | `#06B6D4` cyan | AI/LLM span coverage, token tracking, provider diversity, cost tracking |
| Business Observability | 8 | `#10B981` emerald | Bizevent volume, type diversity, provider diversity |
| Software Delivery | 10 | `#6366F1` indigo | Deployment event coverage, change failure rate, lead time |

Total: **111 criteria** (count may drift ±2 across releases — current
count is `113 unique DQL strings after `Set` dedup` in v2.5.2).

---

## 2. Domain model

### 2.1 Type hierarchy

```ts
interface Threshold {
  min: number;            // value >= min ⇒ this threshold tier passes
}

interface Criterion {
  id: string;             // e.g. "i1", "ai3", "sd10"  — see §4 for the namespace map
  label: string;          // shown on the capability card
  description: string;    // sentence explaining intent
  query: string;          // numerator DQL — returns one number
  queryB?: string;        // OPTIONAL denominator DQL. result = query / queryB * 100
  denominatorConstant?: number;  // OPTIONAL fixed denominator (alternative to queryB)
                                 // MUTUALLY EXCLUSIVE with queryB — see §14.6
  thresholds: Threshold[];       // sorted desc by `min` at render time
}

interface CapabilityDef {
  name: string;           // 9 hardcoded values, see §1
  color: string;          // hex, used in radar segments
  criteria: Criterion[];
}

const CAPABILITIES: CapabilityDef[];   // single source of truth, ui/app/queries.ts
```

### 2.2 Scoring algorithm

Computed in `ui/app/hooks/useCoverageData.ts` around lines 750–820.

For each criterion:

```
1.  Resolve valueA  =  cache.get(query) ?? -1
2.  If valueA == -1  →  value = 0,  error = true       (query failed)
    Else:
3a. If queryB exists:
        valueB = cache.get(queryB) ?? -1
        If valueB <= 0  →  value = 0                   (no denominator data)
        Else            →  value = min(round((valueA / valueB) * 1000) / 10, 100)
3b. Else if denominatorConstant != null:
        If constant <= 0  →  value = 0
        Else              →  value = min(round((valueA / constant) * 1000) / 10, 100)
3c. Else                  →  value = valueA            (single-source criterion)
4.  passed  =  thresholds.some(t => value >= t.min)
```

Notes:
- Value is **always a percentage 0–100**, even for single-source criteria
  that return raw counts. Those are typically thresholded against absolute
  counts (e.g. `min: 5` means "at least 5 spans").
- `Math.min(..., 100)` caps weird overshoot when valueA somehow exceeds
  valueB (rare, but happens with concurrent writes during the run).
- `valueA / valueB` is at three-decimal precision, then truncated to one
  decimal (1234 → 12.3). One decimal is what the UI renders.

### 2.3 Capability score

`capScore = round(passedCount / cap.criteria.length * 100)`

Simple pass rate over the criteria. Failed criteria (error: true) count
as not-passed. The cap score drives radar segment fill.

### 2.4 Capability maturity score

Each criterion is mapped to a **tier**: `foundation`, `bestPractice`,
or `excellence`. The map lives in `ui/app/data/criterionTiers.ts` —
do NOT change without explicit product approval, the tiers are part
of the assessment's published methodology.

Then:

```
fPct = foundation.passed / foundation.total
bPct = bestPractice.passed / bestPractice.total
ePct = excellence.passed / excellence.total

# Gating: bestPractice only counts if foundation >= 80% complete,
#         excellence only counts if bestPractice >= 60% complete
effB = (fPct >= 0.8) ? bPct : 0
effE = (effB >= 0.6) ? ePct : 0

maturityScore = round(fPct * 60 + effB * 25 + effE * 15)
```

Weights are constants in `useCoverageData.ts`:
- `FOUNDATION_WEIGHT = 60`
- `BEST_PRACTICE_WEIGHT = 25`
- `EXCELLENCE_WEIGHT = 15`

Maturity level (visual badge):

| Level | Label | Condition |
|---:|---|---|
| 0 | Not Adopted | default |
| 1 | Foundation | fPct >= 0.5 |
| 2 | Operational | fPct == 1 AND bPct >= 0.5 |
| 3 | Optimized | fPct == 1 AND bPct == 1 AND ePct >= 0.5 |

Maturity band (text descriptor):

| Band | Range |
|---|---:|
| Excellent | maturityScore >= 80 |
| Good | maturityScore >= 60 |
| Moderate | maturityScore >= 40 |
| Low | maturityScore >= 20 |
| N/A | maturityScore < 20 |

### 2.5 Overall scores

```
totalScore        = round(mean of capabilities.score across all 9)
overallMaturityLv = round(mean of capabilities.effectiveMaturityScore)
```

Both shown in the radar center and the PDF cover.

### 2.6 Consolidation (deprecation candidate)

There's a "consolidation factor" (0–100 per capability) that the user can
adjust to reflect "how much of the estate is in Dynatrace". E.g., 40%
means the company is monitoring 40% of its real estate. The adjustment:

```
adjustedScore   = round(rawScore * factor / 100)
adjustedMaturity = round(maturityScore * factor / 100)
```

Stored in `useCoverageData.consolidation: Record<string, number>`. UI
slider in `ConsolidationPanel.tsx`. It's a UX feature, not a metric fix
— if you remove it, also remove the slider and the PDF section.

---

## 3. Architecture overview

### 3.1 Module dependency graph

```
                          ┌─────────────────┐
                          │   queries.ts    │ ← single source of truth
                          │ 9 capabilities  │   for all DQL definitions
                          │ ~111 criteria   │
                          └────────┬────────┘
                                   │ CAPABILITIES
                                   ▼
   ┌──────────────────┐   ┌─────────────────────┐    ┌────────────────────┐
   │  scale-tier.ts   │   │  useCoverageData    │◀───│  useDemoMode       │
   │ (pure module)    │──▶│  (THE big hook)     │    │  (scenario picker) │
   │ scaleQuery()     │   └────────┬────────────┘    └────────────────────┘
   └──────────────────┘            │  CoverageData
            ▲                       ▼
            │              ┌────────────────────┐    ┌────────────────────┐
   ┌────────┴─────────┐    │  App.tsx           │───▶│  Routes            │
   │  useScaleTier    │───▶│  composes hooks    │    │  / and /compare    │
   │  (auto detect)   │    └────────┬───────────┘    └────────┬───────────┘
   └──────────────────┘             │                          │
                                    │                          ▼
                                    │              ┌───────────────────────┐
                                    └─────────────▶│ CoverageAssessment    │
                                                   │ (radar, cards, foot)  │
                                                   └─────────┬─────────────┘
                                                             │
                              ┌──────────────────────────────┼────────────┐
                              ▼                              ▼            ▼
                  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────┐
                  │   TechRadar (svg)  │  │  CapabilityCards   │  │   etc.       │
                  └────────────────────┘  └────────────────────┘  └──────────────┘
```

### 3.2 Hook responsibilities

| Hook | Returns | Owns |
|---|---|---|
| `useScaleTier(demoScenario)` | `{ tier, autoTier, override, hostCount, ... }` | Host-count detection, tier resolution, localStorage override |
| `useDemoMode()` | `{ scenario, isDemo, setScenario, catalog }` | URL `?demo=` + localStorage `cca.demo.scenario`, console helper |
| `useDevMode(demoActive)` | `{ isDev }` | URL `?dev=1` + localStorage `cca.dev`. `demoActive` forces true. |
| `useCoverageData(tier, demoScenario, scaleMeta)` | The big `CoverageData` object | Two-phase Grail execution, scoring, perf entries, cache I/O, demo path |
| `useAssessmentHistory()` | `{ snapshots, saveSnapshot, ... }` | Document Store snapshot persistence (separate from query cache) |
| `usePreflight()` | `{ checks, running, allPassed, ... }` | OAuth scope preflight before first run; 7 cheap probe queries |

### 3.3 Module-level files (new in v2.5.x)

| File | Lines | What it does |
|---|---:|---|
| `ui/app/scale-tier.ts` | 162 | `scaleQuery(q, tier)`, `TIER_CONFIG`, `tierFromHostCount`, `isHotSource` |
| `ui/app/hooks/useScaleTier.ts` | 180 | Detect host count + persist override |
| `ui/app/hooks/useDevMode.ts` | ~80 | URL/localStorage flag reader |
| `ui/app/components/ScaleTierBanner.tsx` | 138 | Yellow (live) / magenta (demo) banner |
| `ui/app/components/DemoControlBar.tsx` | 396 | Sticky footer with chips + Run + Download + Force-refresh |
| `ui/app/components/DpsCostBadge.tsx` | 165 | Toolbar inline cost indicator |
| `ui/app/demo/scenarios.ts` | 496 | 5 scenarios + `buildCoverageFromScenario` + PRNG |
| `ui/app/demo/useDemoMode.ts` | 130 | Scenario activation |
| `ui/app/perf/types.ts` | 267 | `PerfReport` shape, `classifySource` |
| `ui/app/perf/buildReport.ts` | 226 | Build + download JSON |
| `ui/app/perf/queryCache.ts` | 292 | Document Store cache |

---

## 4. The 111 criteria

Each criterion has an ID following the pattern `<prefix><number>`:

| Capability | Prefix | Range |
|---|---|---|
| Infrastructure Observability | `i` | i1–i22 |
| Application Observability | `a` | a1–a13 |
| Digital Experience | `d` | d1–d11 |
| Log Analytics | `l` | l1–l16 |
| Application Security | `s` | s1–s11 |
| Threat Observability | `t` | t1–t11 |
| AI Observability | `ai` | ai1–ai9 |
| Business Observability | `b` | b1–b8 |
| Software Delivery | `sd` | sd1–sd10 |

The IDs are stable contracts — they show up in PDF reports, snapshots,
URL params, perf JSONs. **Never reuse an ID** for a different criterion;
either retire it or add a new one with the next number.

### 4.1 DQL patterns by data source

The 111 criteria use 8 distinct data sources. Each has a typical pattern:

#### Entity counts (cheap, no Grail scan)

```dql
fetch dt.entity.host | summarize count()
fetch dt.entity.service | summarize count()
fetch dt.entity.kubernetes_cluster | summarize count()
fetch dt.entity.application | summarize count()
fetch dt.entity.cloud_application_namespace | summarize count()
fetch dt.entity.process_group | summarize count()
fetch dt.entity.process_group_instance | summarize count()
fetch dt.entity.disk | fieldsAdd belongs_to = belongs_to[dt.entity.host] | expand belongs_to | summarize count = countDistinct(belongs_to)
fetch dt.entity.cloud_application | fieldsAdd ns = belongs_to[dt.entity.cloud_application_namespace] | expand ns | summarize count = countDistinct(ns)
```

Used as denominators for many criteria. After v2.5.0 these run in
**Phase 1** of the two-phase execution (see §7 C3 smart-skip).

#### Metric timeseries (cheap, metadata only)

```dql
timeseries val=avg(dt.host.cpu.usage), by:{dt.entity.host}
| fields dt.entity.host
| dedup dt.entity.host
| summarize c=count()
```

Pattern: aggregate by entity, dedup, count distinct entities seen with
the metric. Used for Infrastructure i1–i8 (host CPU/memory/disk/availability/network/process/k8s coverage).

#### Logs (heavy — `logs` is the biggest scan source)

Window: `2h` by default for log criteria. Scale Tier narrows to 30m
(Large) or 5m (xLarge) when activated.

```dql
# Numerator pattern: count logs with property X
fetch logs
| filter timestamp > now() - 2h
| filter isNotNull(<property>)
| summarize count()

# Denominator pattern: total logs in the window
fetch logs
| filter timestamp > now() - 2h
| summarize count()
```

Some criteria distinct-count entities seen in logs:
```dql
fetch logs
| filter timestamp > now() - 2h
| filter isNotNull(dt.entity.host)
| summarize count = countDistinct(dt.entity.host)
| fields count
```

#### Spans (medium — `spans` is the second biggest)

Window: `2h` for non-AI criteria. **72h for AI Obs criteria** (ai1–ai9) —
see §14.7.

```dql
# Total span volume
fetch spans, from:now()-2h
| summarize count = countDistinct(coalesce(dt.entity.service, service.name))
| fields count

# Cross-service traces
fetch spans, from:now()-2h
| summarize services = countDistinct(dt.service.name), by:{trace.id}
| filter services > 1
| summarize count()
```

#### Davis problems (already 72h, sparse)

```dql
fetch dt.davis.problems, from:now()-72h
| filter not(dt.davis.is_duplicate)
| summarize count()
```

Used by i9, t1, t2, t3, t9, t10, sd8. The 72h window is intentional
— Davis problems are infrequent and dedup-heavy.

#### Events

Two windows in use: 2h and 24h. Events are continuous (the tenant
always has SDLC_EVENT, SYNTHETIC_EVENT, DAVIS_EVENT, DAVIS_PROBLEM).
Sparse-by-kind queries (e.g. SECURITY_EVENT) may legitimately
return 0 if the tenant doesn't ingest that kind.

```dql
fetch events
| filter timestamp > now() - 2h
| summarize countDistinct(event.kind)
```

#### Bizevents

Window: `2h`. Bizevents are typically continuous in tenants that
ingest them.

```dql
fetch bizevents
| filter timestamp > now() - 2h
| filter isNotNull(dt.entity.service)
| summarize count()
```

#### Generic AI provider filter (the AI Obs fingerprint)

Every AI Obs criterion (ai1–ai9) starts with this filter:

```dql
fetch spans, from:now()-72h
| filter isNotNull(gen_ai.system)
      or isNotNull(gen_ai.provider.name)
      or isNotNull(gen_ai.request.model)
      or isNotNull(gen_ai.operation.name)
```

This is the OTel-inclusive AI detection pattern. Don't change it
without re-validating all 9 ai* criteria via MCP.

### 4.2 Complete criterion catalog

> The single source of truth is `ui/app/queries.ts`. Reading the file
> directly is faster than maintaining a parallel list here. Below is
> a quick index by capability + ID + label. Open the file for the
> actual DQL.

The file structure is:

```ts
export const CAPABILITIES: CapabilityDef[] = [
  // ─── 1. INFRASTRUCTURE OBSERVABILITY ───
  {
    name: "Infrastructure Observability",
    color: "#3B82F6",
    criteria: [
      {
        id: "i1", label: "Host CPU coverage (%)",
        description: "Percentage of monitored hosts with active CPU usage metrics from any source (OneAgent, OTel, cloud integration).",
        query: "timeseries val=avg(dt.host.cpu.usage), ...",
        queryB: "fetch dt.entity.host | summarize count()",
        thresholds: [{ min: 90 }, { min: 50 }, { min: 1 }],
      },
      // ... 21 more
    ],
  },
  // ... 8 more capabilities
];
```

When adding a criterion:

1. Pick the next ID (e.g. `i23`, never reuse retired IDs).
2. Pick the right tier in `ui/app/data/criterionTiers.ts` (`foundation`,
   `bestPractice`, or `excellence`).
3. Add `description` for `ui/app/data/criterionRemediation.ts` if you
   want the criterion to show a remediation hint in the Executive view.
4. Add an `importance` in `ui/app/data/criterionImportance.ts` (high /
   medium / low) for the Executive view sorting.
5. Run the new query via MCP against a real tenant. Confirm it returns
   a sensible number (not always 0, not always 100).
6. If queryB would be a literal constant (`5`, `10`, etc.), use
   `denominatorConstant` instead — see §14.6.
7. Bump the app version and CHANGELOG.

---

## 5. Scale Tier

> Source: `ui/app/scale-tier.ts`, `ui/app/hooks/useScaleTier.ts`,
> `ui/app/components/ScaleTierBanner.tsx`.

### 5.1 Why it exists

The default DQL queries scan `now()-2h` of logs / spans / events /
bizevents. On a small tenant that's ~12 GB; on an 80k-host tenant
that's ~17 TB per log query, which:
- Exceeds the Grail per-query timeout
- Costs $1.8k for a single assessment
- Hits the per-tenant concurrency cap

Scale Tier narrows the window + adds a `scanLimitGBytes` safety cap
so the app remains runnable.

### 5.2 The three tiers

| Tier | Trigger | Window | scanLimitGBytes | Sampled? |
|---|---|---|---:|---|
| `exact` | hosts ≤ 5 000 | 2h (verbatim) | none | No — ground truth |
| `large` | 5 000 ≤ hosts < 50 000 | 30 min | 200 GB | Yes — minor drift on sparse signals |
| `xlarge` | hosts ≥ 50 000 | 5 min | 50 GB | Yes — ±5–10% on typical workloads |

Auto-selected from `useScaleTier`'s host count detection
(`fetch dt.entity.host | summarize count = count()`). User can override
via the ScaleTierBanner buttons; override persists in
`localStorage.cca.scaleTier.override`.

### 5.3 What `scaleQuery` does

Pure function. Input: query string + tier. Output: query string Grail
will actually run.

```ts
scaleQuery(q, 'exact')  → q                              // verbatim
scaleQuery(q, 'large')  → q rewritten with 30 min window + 200 GB cap
scaleQuery(q, 'xlarge') → q rewritten with 5 min window + 50 GB cap
```

The rewrite ONLY applies to "hot sources":
```ts
isHotSource(q) iff q contains  fetch logs|fetch spans|fetch events|fetch bizevents
```

For hot sources, the rewrite:
1. Strips any `| filter timestamp > now() - Nh` stage
2. Strips any `, from:now()-Nh` from the fetch clause
3. Replaces with `fetch <src>, from: now()-WINDOWm, scanLimitGBytes: CAP`

**Critical**: `fetch dt.davis.problems` is NOT a hot source. AI Obs
criteria use `fetch spans, from:now()-72h` — `scaleQuery` rewrites
this to `5m` in xlarge tier. That's intentional (xlarge accepts the
accuracy loss for cost), but it means **bursty AI workloads are
invisible in xlarge tier**. Document this for customers.

### 5.4 Cache key includes tier

Cached results are keyed by `tier.fnv32(originalQuery)`. A Large-tier
value is never served to an Exact-tier caller, because the rewritten
query produced different data. See §6.4.

### 5.5 UI surface

The `ScaleTierBanner` renders:
- **Hidden** when `tier === 'exact'` (zero-impact for small tenants)
- **Yellow** for live `large` / `xlarge` (informational, not blocking)
- **Magenta** when a demo scenario is active (different cue entirely)

Includes inline buttons to toggle between `exact` / `large` / `xlarge`
manually. Override is persisted; clicking the tier matching the
auto-detected one removes the override.

---

## 6. 24h persistent cache

> Source: `ui/app/perf/queryCache.ts`. Storage: Document Store.

### 6.1 What's cached

The numeric result of every DQL query the assessment runs. Same-day
re-runs return the value at zero Grail cost.

### 6.2 Document shape

One document per tenant, ID `pulse-querycache`, type `pulse-querycache`.

```ts
interface CacheDocument {
  schemaVersion: 1;
  tenantId: string;
  entries: Record<string, CacheEntry>;  // key = makeKey(query, tier)
}

interface CacheEntry {
  v: number;        // the value returned by extractValue()
  ts: number;       // epoch ms when stored
  bytes: number;    // scannedBytes at time of write (for "saved" stats)
  records: number;  // scannedRecords at time of write
}
```

### 6.3 Lifecycle within a run

```
1. await persistentCache.load()         ← one Doc Store GET
   - Reads the doc, prunes entries older than 24h, populates in-mem Map
   - Captures docVersion for optimistic locking on write

2. For each unique query the run will execute:
     entry = persistentCache.get(query, tier)
     if entry:
       value = entry.v          ← cache hit, zero scan
     else:
       value = await executeDql(scaleQuery(query, tier))
       persistentCache.set(query, tier, value, ...)

3. void persistentCache.flush()         ← fire-and-forget Doc Store PATCH/CREATE
```

### 6.4 Cache key

`makeKey(query, tier)` returns `<tier>.<fnv32(query)>` where `fnv32` is
a tiny 32-bit hash producing an 8-char hex string.

Rationale:
- **Tier-segmented**: Large-tier value ≠ Exact-tier value, must not
  serve cross-tier.
- **Hashed**: query strings can be hundreds of chars; the hash keeps
  the document small (~16 KB for ~110 entries).
- **Same hash family** as `mulberry32` PRNG seed in
  `demo/scenarios.ts` — deliberate, easy to reuse.

### 6.5 TTL

24 hours, enforced at load time. An expired entry is dropped from the
in-memory map and (eventually) overwritten on flush.

Rationale: most assessment values change on a multi-hour scale. A 24h
TTL means a customer who runs the assessment in the morning and again
in the afternoon pays once. After day rollover, full cost again.

There's a deliberately-not-shipped option for tier-aware TTL (24h for
fast signals, 7d for entity counts) — see `HANDOFF.md` §7.4 (option C7).
Pros: even cheaper re-runs. Cons: drift in entity counts when topology
changes mid-week.

### 6.6 Failure modes

All gracefully degrade. The app NEVER fails because of cache:

| Failure | Behavior |
|---|---|
| HTTP 404 on load | Treated as empty cache (first run for this tenant). All queries miss. |
| HTTP 5xx on load | Logged warning, `loaded=false` set, every query misses. App runs as pre-v2.5. |
| HTTP 409 on flush (optimistic locking) | Try createDocument fallback; if that also conflicts, drop this run's additions. Next run re-caches what it can. |
| HTTP 5xx on flush | Logged warning, drops this run's additions. |
| Invalid JSON in document | Treated as empty (schema mismatch). |

### 6.7 Force-refresh

Operator path: click 🗘 Force refresh in the DemoControlBar (gated by
`?dev=1` — see §10.5). Calls `forceRefresh()` from `useCoverageData`
which deletes the document on the server.

Programmatic path: any flow that wants a fresh run can call
`coverageData.forceRefresh()` before triggering `refresh()`.

---

## 7. C3 smart-skip

> Implementation: `useCoverageData.runAssessment` two-phase pass.

### 7.1 What it does

If a criterion's denominator is `fetch dt.entity.X | summarize count()`
and that returns `0`, the numerator is mathematically guaranteed to
produce coverage `0/0 = 0`. Executing it is pure waste. Skip it.

### 7.2 The two phases

```
Phase 1: execute only entity-count denominators
         (isEntityCountQuery matches /^fetch dt.entity.[a-z_0-9]+ | summarize count()$/)
         These are cheap — metadata, not data scan.

Compute skip set: criteria whose phase-1 result is 0, -1, or null

Phase 2: execute everything else EXCEPT the numerators of skipped
         criteria. Persistent cache fed by both phases.
```

### 7.3 Why ONLY entity-count denominators

A denominator like `fetch logs | summarize count()` (total logs in 2h)
might also return 0 if the tenant has no logs — but that's a data
problem, not a topology zero. The "entity is absent" signal is unique
to entity counts.

### 7.4 What's surfaced in the perf JSON

```json
{
  "run": {
    "skippedQueries": 17,
    "skippedCriteria": ["i7", "i10", "i12", "d1", ..., "l8"]
  },
  "queries": [
    {
      "originalQuery": "fetch logs ... | filter ... cluster ...",
      "skipped": true,
      "skipReason": "fetch dt.entity.kubernetes_cluster | summarize count()",
      "scannedBytes": 0,
      "resultValue": 0
    }
  ]
}
```

Each skipped numerator gets a synthetic `PerfQueryEntry` so the JSON
shows exactly what was elided and why.

### 7.5 Demo simulation

The legacy-no-k8s demo scenario sets `k8sClusters: 0`,
`cloud_application_namespace: 0`, `applications: 0` in its
`entityCounts`. `zeroEntityCountQueriesFor(scenario)` builds the same
skip set the live path would, and the demo run reports it in the JSON.

This is how SEs can demo C3 in action without finding a K8s-less
production tenant.

---

## 8. Demo Mode

> Source: `ui/app/demo/scenarios.ts`, `ui/app/demo/useDemoMode.ts`,
> `ui/app/components/DemoControlBar.tsx`. Full operator guide:
> `docs/DEMO-MODE.md`.

### 8.1 Five scenarios

| ID | Label | Hosts | Tier | Purpose |
|---|---|---:|---|---|
| `small-corp` | Acme Inc. (SaaS startup) | 240 | exact | "small healthy customer" |
| `medium-bank` | Atlas Banco | 8 500 | large | "compliance-driven mid-size" |
| `legacy-no-k8s` | Banco Itamaraty | 12 000 | large | **C3 demo** — zero K8s/RUM/applications |
| `xlarge-telco` | GlobalCom | 80 000 | xlarge | "scale showcase" |
| `xxlarge-cloud` | Nimbus Cloud | 250 000 | xlarge | "stress case" |

### 8.2 Activation

Priority: URL param > localStorage > console helper.

```
?demo=xlarge-telco                       ← URL (shareable)
localStorage.cca.demo.scenario           ← sticky (per browser)
window.__pulseDemo('xlarge-telco')       ← DevTools console
window.__pulseDemo()                     ← lists catalog
window.__pulseDemo(null)                 ← clear + reload
```

### 8.3 What's faked vs real in demo runs

| Surface | Demo mode |
|---|---|
| DQL execution | **bypassed** — zero Grail calls, zero DPS |
| Per-criterion values | synthesized deterministically (`mulberry32(hash32("<scenarioId>|<criterionId>"))`) |
| Capability scores | **real math** applied to synthesized values |
| Entity counts panel | from `scenario.entityCounts` |
| Tier | forced from `scenario.tier`; manual override IGNORED |
| Wall-time | `setTimeout` mimicking real Grail latency (1.5s → 7.5s by scenario) |
| Live scan counter | climbs proportionally to `scenario.simulatedScanGB` |
| Snapshot save | **disabled** — guard in CoverageAssessment |
| PDF report | works normally with scenario data |

### 8.4 Per-criterion value model

```ts
// For each criterion in a capability:
value = scenario.criterionOverrides[id]    // if explicitly overridden
     ?? drawAroundTarget(seededRng, scenario.capabilityTargets[capName], spread)
     ?? 0    // if this criterion's queryB is in zeroEntityCountQueriesFor(scenario)
```

`drawAroundTarget(rng, target, spread)` returns
`clamp(target + (rng() * 2 - 1) * spread, 0, 100)` rounded to one
decimal. `spread` defaults to 8 for `exact`, 12 for `large`, 18 for
`xlarge` — bigger jitter at bigger scales to look realistic.

### 8.5 Synthesized perf entries

Each scenario also synthesises a `PerfQueryEntry` per unique query so
the downloadable JSON looks roughly like a real run:

```
1. Each query: scannedBytes drawn from a per-source budget
   (logs 95%, spans 3%, events/bizevents/problems 0.5% each)
   with PRNG-determined jitter (factor in [0.3, 2.5] per query)

2. Wall-time correlated with scan: floorMs + (scanGB / 12 GB/s)
   This makes P95 diverge from P50 like a real Grail run.

3. resultValue mapped from scenario.entityCounts when the query
   is a known entity counter (so the JSON shows consistent numbers
   to the reader).
```

### 8.6 Banner styling

`ScaleTierBanner` renders differently when a demo is active:
- Background `Colors.Background.Container.Primary.Default` (magenta) vs
  `Colors.Background.Container.Warning.Default` (yellow) for live tier
- Label `🎭 DEMO: <scenario.label>` vs `Scale tier: <Tier>`
- Tier-switch buttons HIDDEN (the demo's tier is hardcoded)

Anyone glancing at a screenshot can tell demo from live by color.

---

## 9. Perf instrumentation

> Source: `ui/app/perf/types.ts`, `ui/app/perf/buildReport.ts`,
> `useCoverageData` perfEntries capture.

### 9.1 What's captured per query

```ts
interface PerfQueryEntry {
  index: number;             // 0-based, after dedup
  originalQuery: string;     // string in queries.ts
  executedQuery: string;     // what scaleQuery produced
  source: 'logs' | 'spans' | 'events' | 'bizevents'
        | 'metrics' | 'entity' | 'problems' | 'security' | 'other';
  tier: ScaleTier;
  wallTimeMs: number;        // client-side round-trip
  scannedBytes: number;      // Grail-reported
  scannedRecords: number;
  scannedDataPoints: number;
  resultValue: number;       // post-extractValue()
  ok: boolean;
  errorMessage: string | null;
  usedByCriteria: string[];  // criterion IDs that consumed this query
  cached?: boolean;          // true if served from 24h cache
  cacheAgeSec?: number;      // age at the time of the run
  skipped?: boolean;         // true if C3 skip happened
  skipReason?: string;       // entity queryB that triggered the skip
}
```

### 9.2 PerfReport shape

`buildReport()` assembles:

```ts
interface PerfReport {
  schemaVersion: 1;
  generated: string;          // ISO timestamp
  app: { name, version };
  environment: { tenant, date, demoActive, demoScenarioId, userAgent };
  scale: { tier, autoTier, manualOverride, hostCount };
  entityCounts: EntityCounts | null;
  run: {
    startedAt, finishedAt, wallTimeMs, concurrency,
    totalUniqueQueries, totalScannedBytes, totalScannedRecords,
    totalScannedDataPoints,
    estimatedDpsUsdHigh, estimatedDpsUsdLow,
    queriesFailed,
    cacheHits, cacheMisses, cachedBytesSaved,
    skippedQueries, skippedCriteria,
  };
  bySource: Record<source, {
    count, scannedBytes, wallTimeMs,
    wallTimeP50, wallTimeP95, wallTimeMax, failed,
  }>;
  topExpensiveQueries: Array<{
    originalQuery, source, scannedBytes, wallTimeMs,
    usedByCriteriaCount, scanBytesPerCriterion, rank,
  }>;
  capabilities: PerfCapabilitySummary[];
  queries: PerfQueryEntry[];  // sorted by scannedBytes desc
}
```

`topExpensiveQueries` mixes two rankings:
- top-N/2 by raw `scannedBytes` (absolute cost outliers)
- top-N/2 by `scanBytesPerCriterion` (one-off cost amortization failures)

### 9.3 Filename pattern

```
pulse-perf-<tenant>-<tierSlug>-<isoTimestamp>.json
                    ↑
   For demo runs: tierSlug = `demo-<scenarioId>`
   For live runs: tierSlug = `exact` / `large` / `xlarge`
```

Sorted alphabetically in a directory becomes chronological per tenant.

### 9.4 Pricing assumption

`estimatedDpsUsdHigh = totalGB * 0.01`
`estimatedDpsUsdLow  = totalGB * 0.0065`

Published Dynatrace DPS pricing range for standard contracts. The UI
shows the high bound (conservative), the JSON includes both so external
analyzers can pick.

---

## 10. UI & presentation layer

> Source: `ui/app/pages/CoverageAssessment.tsx`, `ui/app/components/*`.

### 10.1 The three views

Toggled via `ToggleButtonGroup` in the toolbar:

| View | What it shows |
|---|---|
| `coverage` | Radar (left) + capability cards (right) |
| `maturity` | Maturity scorecard with foundation/bestPractice/excellence breakdown |
| `recommendations` | Executive summary with prioritized improvement actions |

### 10.2 Idle, loading, loaded, error states

`CoverageAssessment.tsx` has four state branches:

```tsx
{idle && !loading && (
  <IdleLeftPanel + capability picker grid>  // pre-run state
)}
{loading && (
  <Centered progress bar + "Querying X capabilities">
)}
{!idle && !loading && capabilities.length > 0 && (
  <Toolbar + ScaleTierBanner + main view + How-to-Analyze footer>
)}
{error && (
  <Centered error message>
)}
```

The DemoControlBar (when `isDev`) is OUTSIDE all four branches, pinned
to the bottom via `position: sticky` so it's always reachable.

### 10.3 The toolbar (top, when results loaded)

```
[← Back] [↻ Refresh] [View: Coverage|Maturity|Exec] [Evolution Over Time] [First Day Results ▼]
                                                              Tenant: X · date · stats · DPS badge
```

The DPS badge (`DpsCostBadge.tsx`) renders inline at the end of the
right-aligned text. Customer-facing (no dev gate).

### 10.4 The chart area

`TechRadar.tsx` is the SVG radar. Receives `capabilities` directly,
animates fill via `requestAnimationFrame`. Click a segment to focus
that capability in the cards.

`CapabilityCards.tsx` renders the right-side card stack. Click a card
to drill into per-criterion detail. Click outside to collapse all.

### 10.5 The footer (bottom, conditional)

Two stacked sections, both gated:

| Section | Gate | Renders |
|---|---|---|
| `DemoControlBar` (magenta sticky) | `demo` prop AND `isDev` | scenario chips + Run + Download + Force-refresh |
| `How to Analyze` collapsible | `viewMode === 'coverage' \|\| 'maturity'` | Legend + color scale |

### 10.6 Theme

`useCurrentTheme()` from `@dynatrace/strato-components/core`. Derived
`dk` (dark mode boolean) controls every `style` computation. The app
intentionally mirrors the Dynatrace tenant theme — don't hardcode
colors.

---

## 11. DPS cost model

> Surfaces: `DpsCostBadge.tsx` in the toolbar, `PerfReport.run.estimatedDpsUsd*`
> in the JSON, tooltip projections.

### 11.1 Per-run estimate

```
scannedGB = run.scannedBytes / (1024 ** 3)
costHigh  = scannedGB * $0.01
costLow   = scannedGB * $0.0065
```

### 11.2 Cadence projections (badge tooltip)

```
coldRunUsd     = costHigh + (cached_bytes_saved * 0.01 / 1024^3)
weeklyYearly   = coldRunUsd * 52
dailyYearly    = coldRunUsd * 122   (assumes 24h cache absorbs ~67% of daily re-runs)
dailyYearlyNoC = coldRunUsd * 365
```

The "122" comes from: if a customer runs 3×/day with a 24h cache, only
1 of the 3 is a cold run. 365 cold runs/year → 122 cold runs/year (1/3).

### 11.3 What the badge renders

```
· ≈ $1.61 DPS · 173 GB scanned                       ← cold run
· ≈ <$0.01 DPS · 0 MB scanned · cache hit            ← warm run
· ≈ $0.12 DPS · 13 GB scanned · saved $1.50          ← partial cache
· ≈ $0.45 DPS · 48 GB scanned · (running…)           ← mid-run
```

### 11.4 Tooltip (hover)

Multi-line text via the `title` attribute:

```
Current run scanned 173 GB of Grail data.
Cost estimate at standard DPS pricing: $1.12-$1.61 per run.

Cache: 0/113 queries served from the 24h Document Store cache.

Annual cost projection at this scale (assuming similar runs):
  • Weekly:                $84 / year
  • Daily (with cache):    $196 / year
  • Daily (without cache): $587 / year

Numbers are upper-bound estimates at $0.01/GiB. Your contract may be cheaper.
```

---

## 12. Snapshot persistence

> Source: `ui/app/hooks/useAssessmentHistory.ts`. Independent of query cache.

### 12.1 What's persisted

```ts
interface AssessmentSnapshot {
  id: string;
  timestamp: string;        // ISO
  totalScore: number;
  tenant: string;
  capabilities: Array<{
    name: string;
    color: string;
    score: number;
    consolidation?: number;
    criteriaResults: Array<{
      id: string;
      label: string;
      value: number;
      points: number;
      error: boolean;
    }>;
  }>;
}
```

### 12.2 Storage layout

- localStorage key: `ppa-assessment-history` (cache for fast UI startup)
- Document Store type: `ppa-snapshot`
- Document ID: `cca-<snapshot.id>`
- Retention: keep 15 days, deduplicate to one per calendar day, delete
  older from Document Store.

### 12.3 When a snapshot is saved

In `CoverageAssessment.tsx`'s save effect: whenever a real run transitions
from loading=true → false AND `capabilities.length > 0` AND the
capability score signature differs from the last saved one.

**Demo runs do NOT save snapshots.** Guarded by `if (demoScenario) return`
to prevent canned values from polluting Evolution Over Time history.

### 12.4 Evolution Over Time view

`ComparisonPage.tsx`. Lets the user pick any two snapshots and see:
- Side-by-side radar diff
- Per-criterion deltas
- Tier movement (Foundation → Operational, etc.)

A "Save current run" CTA explicitly persists if the user wants to
override the auto-save dedup.

---

## 13. Build, deploy, run

### 13.1 Prerequisites

- Node.js 20+ (24 recommended per dt-app's warning)
- npm 10+
- `npm ci` (NEVER `npm install` — package-lock pins required versions)
- OAuth scopes (declared in `app.config.json`):
  ```
  storage:logs:read, storage:events:read, storage:spans:read,
  storage:metrics:read, storage:entities:read, storage:bizevents:read,
  storage:buckets:read, storage:system:read,
  document:documents:read, document:documents:write, document:documents:delete
  ```

### 13.2 Commands

```sh
# Local dev with hot reload
node_modules/.bin/dt-app dev
# → http://localhost:3000/ui (or 3001 if 3000 occupied)
# → Embedded URL: https://<tenant>.apps.dynatrace.com/ui/apps/local-dev-server/?locationAppIds=...

# Typecheck only (fast)
npx tsc --noEmit -p ui/tsconfig.json

# Full prod bundle
node_modules/.bin/dt-app build

# Deploy to the tenant in app.config.json#environmentUrl
node_modules/.bin/dt-app deploy
```

### 13.3 Version bump procedure

To deploy a new version, bump BOTH:

```sh
# 1. app.config.json
"version": "2.5.2",  →  "2.5.3"

# 2. ui/app/appVersion.ts
export const APP_VERSION = "2.5.2";  →  "2.5.3"
```

If you skip either, the app catalog and the PDF reports will disagree.

### 13.4 Deploy gotchas

| Error | Fix |
|---|---|
| HTTP 400 "same version already installed" | Bump version (both files above) |
| HTTP 403 Forbidden | OAuth user lacks `app-engine:apps:install` on target. Use `dt-app dev` instead (no install needed). |
| Port 3000 already in use | Old `dt-app dev` zombie. `lsof -i :3000` → `kill <pid>` |
| Stale tokens, prompts browser | Expected if `.dt-app/.tokens.json` exp < now. Browser SSO completes refresh. |

### 13.5 Where the OAuth tokens live

`.dt-app/.tokens.json` in the project root. Two tokens:
- `toolkit_token` — for tooling (build, dev server). Wide scope. Tied to
  the user's Dynatrace SSO identity.
- `app_token` — for runtime API calls during local dev. Narrower scope
  matching `app.config.json#scopes`. Per-tenant.

**Treat this file as sensitive.** Don't commit. Don't paste. Refresh
fails (HTTP 401 from sso.dynatrace.com) require deleting the file and
re-running `dt-app dev` to get fresh tokens via SSO.

---

## 14. Design decisions

These are choices that look weird in code but are deliberate. Don't
"fix" them without understanding why.

### 14.1 The 24h cache is keyed by ORIGINAL query string, but executes the SCALED query

The in-memory `cache: Map<string, number>` in `useCoverageData.executeAllUnique`
uses the ORIGINAL query string as the key. The actual Grail call uses
`scaleQuery(q, tier)`. This is intentional — downstream scoring looks up
results by the original criterion.query field. Switching to scaled keys
would require rewriting the entire scoring path.

### 14.2 Two-phase execution adds latency the first time

Phase 1 (entity counts) adds ~100–500ms of wall time even when no skips
happen. We measured this on our dev tenant — 620ms total instead of ~520ms.
Worth it because: (a) entity counts hit the cache on day-2 anyway,
(b) the savings on tenants WHERE skips happen are large.

### 14.3 Demo mode runs the full scoring pipeline against synthetic values

`buildCoverageFromScenario` doesn't just return canned capability
scores. It runs the actual maturity computation, threshold checks, tier
counting, weighted score formulas — same code path the live run uses,
just with synthesized criterion values. This exercises the scoring
logic in CI-like situations even without Grail.

### 14.4 Demo entity-count synthesis ALSO drives C3

A scenario with `k8sClusters: 0` causes:
- `buildCoverageFromScenario` to force value=0 on k8s-dependent criteria
- The demo perf-entry synthesizer to mark those criteria as `skipped: true`

Both go through `zeroEntityCountQueriesFor(scenario)`. If you add a new
entity class as a scenario field, also map it in `ENTITY_KEY_TO_QUERY`
in `demo/scenarios.ts`.

### 14.5 `useCoverageData(tier, demoScenario, scaleMeta)` accepts an optional 3rd arg

`scaleMeta` exists ONLY so the perf JSON can record `autoTier` and
`manualOverride` (the data lives in `useScaleTier`'s state, but the
JSON builder is in `useCoverageData`). Don't promote `scaleMeta` to
required — backward compatibility for any code that calls
`useCoverageData(tier)` without it.

### 14.6 `denominatorConstant` and `queryB` are mutually exclusive

Set ONE per criterion, never both. Scoring honors `queryB` first if
both are set, which silently masks the constant. TypeScript can't
catch this. The contract is the comment block in `queries.ts:22-30`
and a code review rule.

Eleven criteria currently use `denominatorConstant`. Their previous
queryB strings scanned ~15 GB just to return a literal — see
`docs/PERFORMANCE-REPORT-80K-HOSTS.md` §4 for the audit.

### 14.7 AI Obs uses 72h, other span queries use 2h

Pre-v2.5.1 AI Obs used 2h to match the rest. On our dev tenant, MCP confirmed
the 2h window returned 0 gen_ai spans while 72h returned 244 964
(workload is bursty: LLM batch jobs, async). Switched to 72h for ai1–ai9
only. Other span-based criteria (Application Observability) stay at 2h
because their workloads are continuous.

When adding a new span criterion, ask: is the signal you're measuring
continuous or bursty? If continuous, 2h. If bursty (queues, batch jobs,
infrequent user actions), 24h–72h.

### 14.8 `scaleQuery` does NOT rewrite Davis problems queries

`isHotSource(q)` matches only `fetch logs|spans|events|bizevents`. Problem
queries (`fetch dt.davis.problems`) stay verbatim across tiers, because:
- They already use a 72h window (sparse signal)
- Narrowing to 5min would zero them out
- Davis dedup keeps them small anyway

### 14.9 Strato banner colors are semantic, not aesthetic

Yellow `Background.Container.Warning` = "live sampled, informational
warning"
Magenta `Background.Container.Primary` = "demo, completely different
context"

These can't be swapped or made customizable. The whole point is that
screenshots can be classified at a glance.

### 14.10 Dev mode auto-activates when a demo is loaded

`useDevMode(demoActive)` returns `true` if `demoActive` is true,
regardless of URL/localStorage. This is because a shareable demo
link (`?demo=xlarge-telco`) would otherwise render the magenta banner
without the tier-switch / exit-demo buttons — broken UX. Demo activation
implies "we need the controls", so the gate opens.

### 14.11 `forceRefresh` is separated from `refresh`

`refresh` triggers a new assessment run (`setRunId(n+1)`). `forceRefresh`
clears the cache but doesn't re-run. The DemoControlBar's Force-refresh
button calls both in sequence — that's the common case. But callers
that want to invalidate without re-running can call only `forceRefresh`.

### 14.12 Snapshot save guards on BOTH `demoScenario` AND `sampled`

We could have guarded only on `demoScenario != null` (demo mode), but
also added `sampled: boolean` to the CoverageData return. This was for
a future "save with disclaimer" feature where Large/xLarge runs save
snapshots tagged as "sampled". Currently `sampled` isn't read by the
snapshot save — keeping the field for that future use.

---

## 15. Known limitations and false-positive guidance

### 15.1 Capabilities that score low because of missing data, not bugs

| Capability | Common low-score cause | How to confirm |
|---|---|---|
| Application Security | Tenant doesn't ingest `event.kind == "SECURITY_EVENT"` | MCP: `fetch events, from:now()-72h \| filter event.kind == "SECURITY_EVENT" \| summarize count()` returns 0 |
| Business Observability | Specific bizevent providers absent | MCP: `fetch bizevents, from:now()-72h \| summarize countDistinct(event.provider)` then check the criterion's filter against the list |
| Threat Observability (t4) | Same as AppSec (security events) | Same query |
| Software Delivery (sd2) | Tenant doesn't emit `event.kind == "CUSTOM_DEPLOYMENT"` | MCP: `fetch events, from:now()-72h \| filter event.kind == "CUSTOM_DEPLOYMENT" \| summarize count()` |

These are tenant truth. C3 smart-skip doesn't catch them because the
filter is on `event.kind` not on entity count.

### 15.2 Sampling-related differences are NOT bugs

Large / xLarge tier runs produce sampled estimates. Coverage values
will differ from Exact-tier ground truth. The ScaleTierBanner discloses
this. If a customer asks "why does my coverage drop after auto-switching
to Large", the answer is "the window was narrowed for cost; sampled
estimate".

### 15.3 Cache staleness is intentional

A criterion's value can be up to 24h old when served from cache. If a
customer fixes a coverage gap and re-runs an hour later, they see the
old number. Two paths forward:
- Click 🗘 Force refresh (dev mode only)
- Wait for the 24h TTL to expire

Don't shorten the TTL to "1h" or whatever — defeats the cache's purpose
on iteratively-tuning teams.

### 15.4 Concurrency cap = 10

`useCoverageData.CONCURRENCY = 10`. This is a per-run concurrency cap on
worker Promises. It's been tested up to 20 (no improvement) and down
to 4 (slower without freeing tenant concurrency). Don't change without
benchmarking on a multi-thousand-host tenant.

### 15.5 `extractValue` is forgiving

`useCoverageData.extractValue(record)` iterates `Object.values(record)`
and returns the first numeric. For result objects like `{count: 42}`,
`{c: 42}`, `{always5: 5}`, it just works. If a future query returns
multiple numerics in one row and we care about a specific column,
add a field name argument.

### 15.6 The Document Store cache document grows

Cache entries are pruned at load time (24h TTL). But within a single
day, every unique query the assessment encounters becomes an entry.
Max bound: ~130 entries × 100 bytes ≈ 13 KB per tenant per day. Document
Store handles megabytes per doc; we're four orders of magnitude below
any limit.

---

## 16. Glossary

| Term | Meaning |
|---|---|
| Capability | One of 9 top-level scoring areas (Infrastructure, AppObs, DigEx, Logs, AppSec, Threat, AI, BizObs, Delivery) |
| Criterion | One of ~111 fine-grained measurements, identified by `<prefix><number>` (e.g. `ai3`, `sd10`) |
| Threshold | Numeric cutoff a criterion's value must meet to pass at a given tier |
| Coverage | The criterion-pass-rate-based score (0–100%). Mean across capabilities = `totalScore`. |
| Maturity | The progressively-weighted score (Foundation 60% / Best Practice 25% / Excellence 15%) with gating |
| Foundation tier | The basic-must-have criteria for a capability |
| Best Practice tier | Mature operating criteria, only counted if Foundation ≥ 80% |
| Excellence tier | Stretch goals, only counted if Best Practice ≥ 60% |
| Scale Tier | The execution mode (exact / large / xlarge) that determines window + scan cap |
| C3 smart-skip | The two-phase optimization that skips numerators when entity-count denominators are 0 |
| denominatorConstant | A code-level number replacing a queryB that would have returned a literal |
| Cold run | First assessment of the day for a tenant; pays full DPS cost |
| Warm run | Re-run within 24h; serves results from cache, ~zero cost |
| Hot source | A DQL data source that scales linearly with ingest (logs / spans / events / bizevents). Subject to `scaleQuery` rewriting. |
| Bursty workload | A signal that fires intermittently (LLM batch jobs, deploys). Needs a wider window to be visible. |
| Demo Mode | The synthesized-scenario path for SE-led previews. Zero DPS. Activated by URL/localStorage/console. |
| Dev Mode | The flag that exposes diagnostic UI (DemoControlBar, perf JSON download) to SEs. Hidden from customers. |
| PerfReport | The downloadable JSON containing per-query timing, scan, cache, skip data |
| DPS | Davis Pipeline Storage — Dynatrace's per-GiB-scanned billing metric |
| MCP | Model Context Protocol — used during development to run DQL directly against the tenant for validation |
| Grail | Dynatrace's query engine — the thing `executeDql` calls |
| Strato | Dynatrace's design system — UI components and tokens we use |

---

End of memory file. Combined with `HANDOFF.md`, `PERFORMANCE-REPORT-80K-HOSTS.md`,
`DEMO-MODE.md`, `CHANGELOG.md`, and the inline code comments, this should
be everything a new dev needs to understand the app in depth.
