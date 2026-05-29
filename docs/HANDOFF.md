# Pulse Assessment — Developer Handoff

> Pick-up document for the next developer. Captures the state of v2.5.2,
> what was done during the v2.5.x perf pass, validation evidence, and
> what's still open. Read this before opening `useCoverageData.ts` cold.

Date written: 2026-05-29
Author: Marcelo Coletta — `marcelo.coletta@dynatrace.com`
Current version: **v2.5.2** (deployed to `bwm98081`)

---

## 1. Quick reference

### Production

| Item | Value |
|---|---|
| Deployed tenant | `bwm98081.apps.dynatrace.com` |
| Deployed URL | https://bwm98081.apps.dynatrace.com/ui/apps/my.pulse.assessment |
| Version installed | **2.5.2** |
| App id | `my.pulse.assessment` |

### Git

| Item | Value |
|---|---|
| Repo | `git@github.com:mbdccoletta/Pulse-Assessment-App.git` |
| Working branch | `feat/v2.5.0-perf-optimizations` |
| State | All 5 commits pushed; local in sync with `origin/feat/v2.5.0-perf-optimizations` |
| Base for next branch | `feat/v2.5.0-perf-optimizations` (until PR is merged into `main`) |
| PR | Not yet opened. URL: `https://github.com/mbdccoletta/Pulse-Assessment-App/pull/new/feat/v2.5.0-perf-optimizations` |

### Commit history of v2.5.x

```
21b6f76  feat: customer-facing DPS cost badge in toolbar (v2.5.2)
83fb2ec  chore: bump version 2.5.0 → 2.5.1 (AI Obs window fix)
74a1543  fix(ai-obs): restore 72h window for AI Observability criteria
901b203  chore: gate demo + diagnostic UI behind dev flag for production
b35eece  feat: v2.5.0 — Scale Tier sampling, Demo Mode, Cache, C3 smart-skip
```

### Other tenants the OAuth tokens have toolkit access to

| Tenant | Access type | Notes |
|---|---|---|
| `bwm98081` | full (app token + toolkit) | dev environment, install rights |
| `demo.apps.dynatrace.com` | **toolkit only** | install attempts return HTTP 403. Local `dt-app dev` works but `dt-app deploy` does not. |

---

## 2. What v2.5.x added

Six tracks of performance and UX work, all reachable from the same branch:

| Track | Where to look | Impact (measured on bwm98081) |
|---|---|---|
| **denominatorConstant** — eliminate queryB scans that returned a literal | `ui/app/queries.ts` (the `Criterion` type + 11 criteria), `ui/app/hooks/useCoverageData.ts` (scoring path) | **-21% scan** per run (220 GB → 173 GB) |
| **Scale Tier** auto-sampling (exact / large / xlarge) | `ui/app/scale-tier.ts` + `ui/app/hooks/useScaleTier.ts` + `ui/app/components/ScaleTierBanner.tsx` | **-98% projected scan @ 80k hosts** ($1,800/run → $32/run) |
| **24h persistent result cache** | `ui/app/perf/queryCache.ts` + integration in `useCoverageData.ts` | **-100% on same-day re-runs** (173 GB → 0 GB) |
| **C3 smart-skip** — skip numerators when entity-count denominator is 0 | Two-phase loop in `useCoverageData.runAssessment` | -15 to -30% on tenants without K8s/RUM/etc |
| **Per-query perf instrumentation + JSON download** | `ui/app/perf/types.ts`, `ui/app/perf/buildReport.ts` | Observability surface, not a perf fix |
| **Demo Mode** (5 canned scenarios) | `ui/app/demo/scenarios.ts` + `ui/app/demo/useDemoMode.ts` + `ui/app/components/DemoControlBar.tsx` | Zero DPS, lets SEs preview at scales we don't have |
| **AI Obs window 2h → 72h** | `ui/app/queries.ts` (criteria ai1–ai9 only) | Fixed a hidden zero-data bug on bursty AI workloads |
| **Customer-facing DPS cost badge** | `ui/app/components/DpsCostBadge.tsx` + toolbar in `CoverageAssessment.tsx` | UX — surfaces estimated DPS in the toolbar |

Full prose in `docs/PERFORMANCE-REPORT-80K-HOSTS.md` and `docs/DEMO-MODE.md`.

### Production posture (since `901b203`)

The diagnostic surfaces (DemoControlBar, scenario chips, Force-refresh,
Download-perf-JSON) are **hidden by default**. A customer tenant sees only
the radar + cards + the auto-detected Scale Tier banner. SEs unlock the
controls via:

- URL param `?dev=1`
- `localStorage.cca.dev = '1'`
- Any active demo scenario (`?demo=xlarge-telco` forces dev on)
- Console: `__pulseDemo('<scenario-id>')` then reload

Gate lives in `ui/app/hooks/useDevMode.ts`.

---

## 3. Architecture: how the new modules connect

```
                                   ┌─────────────────────────┐
                                   │  useDemoMode (URL/LS)   │
                                   └────────────┬────────────┘
                                                │ scenario | null
                                                ▼
┌─────────────────┐    tier      ┌─────────────────────────┐
│  useScaleTier   │─────────────▶│       App.tsx           │
│ (host count)    │              │  resolves tier + demo + │
└─────────────────┘              │  isDev, threads them    │
                                 │  into useCoverageData   │
                                 └────────────┬────────────┘
                                              │
                                              ▼
                ┌─────────────────────────────────────────────┐
                │           useCoverageData                   │
                │                                             │
                │  Phase 1: entity-count denominators         │
                │           (C3 smart-skip preflight)         │
                │           ↓                                 │
                │  Skip set: criteria where entity = 0        │
                │           ↓                                 │
                │  Phase 2: all other queries                 │
                │           (less skip-set numerators)        │
                │                                             │
                │  Each unique query goes through:            │
                │    1. persistentCache.get() (24h Doc Store) │
                │    2. scaleQuery(q, tier)  ← narrows window │
                │    3. executeDql(q)        ← Grail call     │
                │    4. persistentCache.set()                 │
                │                                             │
                │  Result: cache: Map<originalQuery, value>   │
                └────────────┬────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │   Scoring (lines ~750-820)   │
              │ value = valueA / valueB ×100 │
              │   or valueA / denominator-   │
              │   Constant if set            │
              └──────────────┬───────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ CoverageData out │
                    │ + perfEntries[]  │
                    │ + lastRunMeta    │
                    └──────────────────┘
```

### File map (new in v2.5.x)

| File | Lines | Purpose |
|---|---:|---|
| `ui/app/scale-tier.ts` | 162 | Pure module: `scaleQuery(q, tier)`, `TIER_CONFIG`, `tierFromHostCount()` |
| `ui/app/hooks/useScaleTier.ts` | 180 | Detects host count → picks tier; persists manual override |
| `ui/app/hooks/useDevMode.ts` | ~80 | Reads `?dev=1` / `localStorage.cca.dev` |
| `ui/app/components/ScaleTierBanner.tsx` | 138 | Yellow banner for Large/xLarge; magenta variant for demo |
| `ui/app/components/DemoControlBar.tsx` | 396 | Footer bar with scenario chips, Run, Download, Force-refresh |
| `ui/app/components/DpsCostBadge.tsx` | 165 | Customer-facing toolbar badge (USD/GB scanned + tooltip projections) |
| `ui/app/demo/scenarios.ts` | 496 | 5 canned tenants + deterministic value generator (mulberry32) |
| `ui/app/demo/useDemoMode.ts` | 130 | URL/localStorage activation + `__pulseDemo()` console helper |
| `ui/app/perf/types.ts` | 267 | `PerfReport` schema + `PerfQueryEntry` + `classifySource` |
| `ui/app/perf/buildReport.ts` | 226 | Assembles `PerfReport` from in-flight entries + downloads as JSON |
| `ui/app/perf/queryCache.ts` | 292 | 24h Document Store cache with TTL prune, optimistic locking |

### File map (modified in v2.5.x)

| File | What changed |
|---|---|
| `ui/app/queries.ts` | Added `denominatorConstant?: number` to `Criterion`. 11 criteria converted. 16 substring swaps in the AI Obs block (`from:now()-2h` → `from:now()-72h`). |
| `ui/app/hooks/useCoverageData.ts` | Two-phase execution, C3 skip set, cache integration, scaleQuery, perf entry capture, demo short-circuit. **The big diff.** Read carefully before editing. |
| `ui/app/pages/CoverageAssessment.tsx` | New props: `scale`, `demo`, `isDev`. Toolbar wires `DpsCostBadge`. Footer renders `DemoControlBar` (gated by `isDev`). Snapshot save guard for demo mode. |
| `ui/app/App.tsx` | Mounts `useDemoMode`, `useScaleTier`, `useDevMode`. Threads everything into `CoverageAssessment`. |
| `app.config.json` | Bumped to `2.5.2`. **`environmentUrl` defaults to `bwm98081`** — change before deploying to a different tenant. |
| `ui/app/appVersion.ts` | `"2.5.2"`. |
| `CHANGELOG.md` | v2.5.0 entry. (v2.5.1 / v2.5.2 entries are pending — see §7.) |

---

## 4. Validation evidence

All claims in §2 are backed by actual JSON files I downloaded during the
v2.5.x dev pass. The relevant ones (paths from my Downloads at the time):

| Filename | Run type | Key result |
|---|---|---|
| `pulse-perf-bwm98081-exact-2026-05-23T13-26-02-325Z.json` | pre-`denominatorConstant` cold | 123 unique queries, 220 GB scanned, $2.05 |
| `pulse-perf-bwm98081-exact-2026-05-23T13-37-37-162Z.json` | post-`denominatorConstant` cold | 113 unique queries, **173 GB** scanned, $1.61 (**-21.4%**) |
| `pulse-perf-bwm98081-exact-2026-05-23T13-53-02-860Z.json` | cache hit (immediate re-run) | 113/113 cached, **0 GB**, $0 |
| `pulse-perf-bwm98081-demo-legacy-no-k8s-…json` | C3 smart-skip demo | `skippedQueries: 17`, `skippedCriteria` lists d1-d8, d11, i7, i10, i12, i19-i22, l8 |
| `pulse-perf-bwm98081-demo-xxlarge-cloud-…json` | xLarge tier projection | 10.5 TB simulated scan, $63-$98 |

**Capability scores comparison** (pre vs post `denominatorConstant`):
9 of 9 capabilities returned identical scores. Run the same comparison
on every future query change.

**MCP-confirmed AI Obs fix** (this is in the conversation log, not a file):

| Window | gen_ai spans @ bwm98081 |
|---:|---:|
| 2h | 0 |
| 24h | 0 |
| 72h | 244 964 (4 distinct providers) |

The `from:now()-2h → from:now()-72h` swap in queries.ts is the entire fix.

---

## 5. Develop / build / deploy

### One-time setup

```sh
git clone git@github.com:mbdccoletta/Pulse-Assessment-App.git
cd Pulse-Assessment-App
git checkout feat/v2.5.0-perf-optimizations
npm ci                # use ci, not install — package-lock pins required versions
```

### Run locally

```sh
node_modules/.bin/dt-app dev
# Opens OAuth flow on first run; opens an embedded URL like:
#   https://<tenant>.apps.dynatrace.com/ui/apps/local-dev-server/?locationAppIds=http%3A%2F%2Flocalhost%3A3000%2Fui%2Clocal-dev-server
```

Notes:

- The dev server binds to port 3000 by default. If a zombie process holds
  3000 (common after `KillBash` of a Claude-spawned dev), the new server
  picks 3001 silently. Check the printed URL.
- The embedded URL queries Grail in the **deployed tenant's** context;
  the UI loads from localhost. To test against a different tenant,
  change `app.config.json` `environmentUrl` and restart.

### Deploy

```sh
# Change app.config.json -> environmentUrl to the target tenant first.
node_modules/.bin/dt-app deploy
```

Common failure modes:

- **HTTP 400 — same version already installed with a different checksum.**
  Bump `app.config.json` `version` AND `ui/app/appVersion.ts` `APP_VERSION`.
- **HTTP 403 — Forbidden.** The OAuth user doesn't have install rights on
  the target tenant. Confirmed for `demo.apps.dynatrace.com` — only
  toolkit access. Workaround: run via `dt-app dev` instead.

### Typecheck and full build

```sh
npx tsc --noEmit -p ui/tsconfig.json     # types only, fast
node_modules/.bin/dt-app build           # full prod bundle, takes ~30 s
```

The deploy command runs build implicitly, but during iteration a standalone
`tsc --noEmit` is the fastest way to validate type safety.

---

## 6. Critical context (decisions and rationale)

These were chosen during the v2.5.x sprint and aren't obvious from code:

### 6.1 `scaleQuery` ONLY rewrites hot sources

`fetch logs / spans / events / bizevents` get narrowed in Large/xLarge tiers.
`fetch dt.entity.* / dt.davis.problems / timeseries` do NOT. The
classification is `isHotSource(query)` in `scale-tier.ts:96`. Don't widen
this without sanity checking AI Obs (72h problems queries would explode).

### 6.2 Cache key includes tier

`makeKey(query, tier)` returns `${tier}.${fnv32(query)}`. A Large-tier
result is NEVER served to an Exact-tier caller. This matters because the
scaleQuery rewrite produces different actual data even for the same
original-query string. See `queryCache.ts:103`.

### 6.3 Demo mode bypasses persistent cache

The demo path in `useCoverageData` short-circuits before the cache layer
because scenario data is synthesised, not stored. This is intentional —
caching demo data would corrupt the analyzer's ability to tell scripted
from measured runs.

### 6.4 Snapshot save is suppressed during demo

`CoverageAssessment.tsx` snapshot effect has a `demoScenario` guard.
Demo runs must NOT pollute Evolution Over Time's `pulse-snapshot`
documents.

### 6.5 The `denominatorConstant` field is mutually exclusive with `queryB`

Scoring (`useCoverageData.ts` around line 760) checks `queryB` first,
`denominatorConstant` second, then `valueA` raw. If both are set on a
criterion, `queryB` wins and you've just shipped a regression. The
TypeScript type doesn't enforce this — comment in `queries.ts:22-30` is
the contract.

### 6.6 AI Obs uses 72h, all other span queries use 2h

This is the asymmetry from the `74a1543` fix. The pattern was: AI workloads
are bursty (LLM batch jobs, async pipelines). Other span workloads
(microservices) are continuous. If you add a new span-based criterion,
think about whether it's bursty or continuous before picking a window.

### 6.7 Scale Tier override forces the tier choice

The user can hit any of three buttons (Exact / Large / xLarge) in the
ScaleTierBanner. The override is stored in `localStorage.cca.scaleTier.override`
and beats auto-detection. Demo mode IGNORES the override (scenarios are
pre-baked for one tier).

### 6.8 Pricing assumption in `DpsCostBadge`

USD per GiB is the conservative published Dynatrace rate ($0.0065–$0.01).
The badge shows the HIGH bound by default. Customers on cheaper contracts
see a number bigger than their actual cost — that's the right direction
to err.

---

## 7. Pending work / open issues

### 7.1 Open the PR

Branch is pushed but no PR has been opened. URL:

```
https://github.com/mbdccoletta/Pulse-Assessment-App/pull/new/feat/v2.5.0-perf-optimizations
```

A long-form PR body is saved at `/tmp/pulse-v2.5.0-PR-BODY.md` on
Marcelo's machine. Reproducible content is in §2 + §4 of this doc.

### 7.2 CHANGELOG.md is incomplete

`CHANGELOG.md` has the `[2.5.0]` entry but not `[2.5.1]` (AI Obs fix)
nor `[2.5.2]` (DPS badge + dev-mode gate). Add them before merging the
PR.

### 7.3 field-asset-library submission

Staging at `/tmp/pulse-staging/apps/platform/pulse-assessment/` reflects
v2.4.x. Re-stage with v2.5.2 before submitting. Forking is disabled on
`Dynatrace-Internal/field-asset-library` and `mbdccoletta` doesn't have
write access — request access via SE Enablement Team using the template
in chat history (search for "write access request").

### 7.4 Optimization roadmap (from §3 of the v2.5.x perf report)

Not implemented. Listed in order of ROI given a "centavos per run on
medium/large tenants" goal:

| Option | Estimated impact | Risk | Effort |
|---|---|---|---|
| **C1** Query coalescing (merge log queries with same prefix) | -75% cold scan | **HIGH** — single failure breaks N criteria | 2-3 days dev + 1 week side-by-side validation |
| **C4** Metric-based denominators (replace `fetch logs \| count()` with metric query) | -15 GB absolute | Medium (metric values may drift <2%) | 1 day + MCP validation per criterion |
| **C7** Tier-aware cache TTL (7 days for slow signals like entity counts) | -100% on day-2-to-day-7 re-runs | Medium (stale denominators if topology changes) | 0.5 day |
| **C8** Workflow-precomputed metrics (hourly background job) | -99% cold | **HIGH** — operational complexity, scores stagnate on Workflow failure | 5-7 days dev |

The user paused on these in favor of validating v2.5.2 first. Re-engage
after the production observation window closes (suggest 2 weeks of real
usage).

### 7.5 Known false-zeroes that AREN'T bugs

Don't waste time re-investigating these — they're tenant-truth:

| Capability | Why low on bwm98081 |
|---|---|
| Application Security ~73% | `bwm98081` doesn't ingest `event.kind == "SECURITY_EVENT"`. Confirmed via MCP — zero records in 72h. |
| Business Observability ~63% | Specific bizevent providers (Shopify, Stripe, etc.) aren't present. Tenant has 25 distinct providers but not these particular ones. |

If the user reports "low score on AppSec — is there a bug?", point them
at this row first. C3 smart-skip doesn't help here because the failed
filters are on `event.kind` not on an entity-count denominator.

---

## 8. Things NOT to do without thinking

1. **Don't refactor `useCoverageData.runAssessment` without reading §3.**
   The two-phase C3 split + cache integration + demo short-circuit
   intersect in subtle ways. Adding a fourth integration breaks one
   of the three.

2. **Don't change the cache key shape (`tier.fnv32(query)`).** A
   schema-bump invalidates every existing cache document silently;
   users see "cold runs" for the next 24 h and don't know why.

3. **Don't widen `isHotSource(q)` to cover problems/entity tables.**
   Will break AI Obs (72 h problem queries get narrowed to 5 min →
   zero results).

4. **Don't ship a deploy with `app.config.json` `environmentUrl`
   pointing at someone else's tenant.** Lasts as long as the dev
   forgets to revert. The default in main should always be the
   project's dev tenant (`bwm98081`).

5. **Don't add a new `Criterion` with both `queryB` AND
   `denominatorConstant` set.** TypeScript doesn't catch this. Pick
   one. Comment block in `queries.ts:22-30` is the contract.

6. **Don't enable the Demo / Force-refresh / Download-perf-JSON
   controls by default.** They're dev tools. Customer view stays clean
   — `useDevMode` gates them. If you find a reason to expose any
   of them to customers, audit the wording (e.g., a customer seeing
   "Simulate xLarge tenant" makes no sense).

---

## 9. Useful files outside the source tree

| Location | What's there |
|---|---|
| `docs/PERFORMANCE-REPORT-80K-HOSTS.md` | The sizing study that justified Scale Tier. Reads like a research note. |
| `docs/DEMO-MODE.md` | Operator guide for SEs using demo mode. |
| `docs/DPS-WASTE-AUDIT.md` | Not written — was on the v2.5.x roadmap. |
| `CHANGELOG.md` | Project history. v2.5.0 only — needs 2.5.1/2.5.2 added. |
| `README.md` | The main project README. Not touched in v2.5.x. |
| `CONTRIBUTING.md` | App contribution guide (within this repo). |
| `app.config.json.bwm-backup` | Local backup of the bwm tenant config. Safe to delete after onboarding. |

---

## 10. First-week checklist for the next dev

- [ ] Read this doc end-to-end.
- [ ] Clone, `npm ci`, `dt-app dev`. Confirm the embedded URL on bwm98081 renders the radar.
- [ ] Run an assessment. Confirm the DPS badge appears in the toolbar.
- [ ] Re-run immediately. Confirm cache hit (`≈ <$0.01 DPS · cache hit`).
- [ ] Append `?dev=1` and confirm the magenta footer appears.
- [ ] Try `?demo=legacy-no-k8s`. Confirm the radar zeroes out RUM / K8s criteria.
- [ ] Download a perf JSON. Open it. Confirm `cacheHits`, `skippedQueries`,
      `bySource.wallTimeP95` are populated.
- [ ] Open the PR (§7.1) so review can start.
- [ ] Add the `[2.5.1]` and `[2.5.2]` entries to `CHANGELOG.md` (§7.2).
- [ ] Decide whether to pursue C1/C4/C7/C8 (§7.4) based on production
      observability data after 2 weeks of usage.

Welcome aboard.
