# Pulse Assessment — Demo Mode

> Run the app against canned tenant scenarios (240 hosts up to 250,000 hosts)
> without touching Grail. Zero DPS consumed, deterministic results,
> reproducible across reloads.

> **Production posture:** the demo UI (magenta "🎭 Performance simulation"
> footer bar with scenario chips, Force-refresh, Download-perf-JSON) is
> **hidden by default** in customer tenants. SEs unlock it with one of:
>
> - URL param `?dev=1`
> - `localStorage.cca.dev = '1'`
> - Activating any demo scenario (e.g. `?demo=xlarge-telco` — the demo
>   activation implies "we need the controls" so the bar is forced visible)
>
> See `ui/app/hooks/useDevMode.ts` for the gate logic.

---

## Why this exists

Pulse Assessment behaves very differently on a 200-host dev tenant vs. an
80,000-host production telco. You can't always demo a customer on their own
tenant (auth, compliance, access reviews), and you definitely don't want
sales engineers burning 1.8k USD of DPS per click while exploring the app
on a real xLarge environment.

Demo Mode short-circuits the live path: scenario data is synthesized
deterministically and fed into the **real** scoring pipeline. The UI, PDF
export, radar chart, capability cards, maturity computation — everything
runs exactly as in production. Only the Grail calls are replaced.

---

## What's faked vs. real

| Surface | Behavior in demo mode |
|---|---|
| DQL execution against Grail | **Skipped entirely** (zero DPS, zero network) |
| Per-criterion coverage values | Synthesized from `capabilityTargets` + deterministic PRNG |
| Capability scores, maturity tiers, weighted score | **Real math** applied to the synthesized values |
| Entity counts panel | Fed from `scenario.entityCounts` |
| Scale Tier (`exact`/`large`/`xlarge`) | Forced from `scenario.tier`; manual override is ignored |
| Wall-time | Simulated via `setTimeout` (1.5 s for `small-corp` up to 7.5 s for `xxlarge-cloud`) |
| Live "scanned bytes" counter | Climbs from 0 to `scenario.simulatedScanGB` during the run |
| Snapshot save (Evolution Over Time) | **Disabled** — canned data must not corrupt real history |
| PDF report generation | Works as normal, with scenario data |

This means a customer demo looks visually identical to a real run — same
animation, same loading bar, same radar fill — but the back-end is silent.

---

## Activating demo mode

### Option A — URL parameter (preferred for sharing)

```
https://YOUR_TENANT.apps.dynatrace.com/.../pulse-assessment/?demo=xlarge-telco
http://localhost:3000/ui?demo=xlarge-telco
```

The `?demo=<id>` query parameter is read on every page load. It does **not**
persist if the user navigates away — perfect for sending a one-off demo link
without permanently changing the recipient's local state.

### Option B — Console helper (preferred during live demos)

Open DevTools console anywhere in the running app and type:

```js
__pulseDemo()                  // list available scenarios
__pulseDemo('xlarge-telco')    // activate scenario, reloads page
__pulseDemo(null)              // exit demo mode, reloads page
```

This writes `localStorage.cca.demo.scenario`, so the scenario persists
across reloads of the same tab/browser. Activating a different scenario
overwrites the previous one.

### Option C — localStorage directly (CI / automation)

```js
localStorage.setItem('cca.demo.scenario', 'xlarge-telco');
location.reload();
```

Functionally equivalent to Option B. Used by scripted UI tests.

### Precedence

URL parameter > localStorage. A shared `?demo=` link always wins, even if
the recipient has a different scenario stuck in localStorage.

---

## Available scenarios

| ID | Customer name | Tier | Hosts | Services | DPS simulated |
|---|---|---|---:|---:|---:|
| `small-corp` | Acme Inc. (SaaS startup) | `exact` | 240 | 38 | ~$0.006 |
| `medium-bank` | Atlas Banco (mid-size bank) | `large` | 8,500 | 420 | ~$0.18 |
| `xlarge-telco` | GlobalCom (xLarge telco) | `xlarge` | 80,000 | 3,500 | ~$32 |
| `xxlarge-cloud` | Nimbus Cloud (hyperscaler) | `xlarge` | 250,000 | 12,000 | ~$98 |

Each scenario has a hand-tuned coverage profile (e.g., the bank is strong
on AppSec and weak on AI Obs, the hyperscaler is balanced and high across
the board). See `ui/app/demo/scenarios.ts` for the full definitions.

---

## Visual indicator

When demo mode is active a magenta-styled banner appears above the radar:

```
🎭 DEMO: GlobalCom (xLarge telco) · 80,000 hosts · tier xLarge · 0 DPS consumed
```

The banner color is intentionally **distinct** from the yellow Scale Tier
banner used on real `large`/`xlarge` runs, so anyone looking at a screenshot
can immediately tell whether it's a real measurement or a canned demo.

The banner also reminds the operator how to exit:

> Exit demo by clearing the URL `?demo=` param or running `__pulseDemo(null)` in the console.

---

## Adding a new scenario

1. Append to `DEMO_SCENARIOS` in `ui/app/demo/scenarios.ts`.
2. Fill in every field of `DemoScenario`. The required fields are exhaustive
   on purpose — TypeScript will flag missing ones.
3. Keep `id` lowercase, kebab-case, stable. URLs and shared links rely on it.
4. Capability targets are 0–100; criterion values are jittered around the
   target deterministically (mulberry32 seeded by `scenario.id|criterion.id`).
   To pin a specific criterion at a specific value, use `criterionOverrides`.
5. Test by appending `?demo=<your-new-id>` to the dev server URL.

The PRNG seed is **the scenario id concatenated with the criterion id**, so
renaming a scenario id will re-roll every criterion value. Stable demos
require stable ids.

---

## Snapshots, reports, and PDF export under demo

- **Snapshots:** save is suppressed. Existing snapshots are still listed in
  Evolution Over Time, but the demo's totalScore/criteriaResults are never
  written. This is enforced in `CoverageAssessment.tsx` around the snapshot
  save effect.
- **PDF reports:** generate normally. The "Tenant: …" line in the report
  header will show the live tenant name (`bwm98081`, `demo`, etc.) — if
  you're producing a demo PDF to share, edit the tenant header in the PDF
  generator or take a screenshot from the UI instead.
- **Evolution Over Time:** shows real snapshots only. Switching from demo
  back to live and clicking Refresh will save a new real snapshot on top of
  the prior history.

---

## What demo mode is NOT for

- **Performance testing** of the actual Grail queries. Use the real
  `PERFORMANCE-REPORT-80K-HOSTS.md` workflow for that.
- **Validating that a query syntactically works.** Demo bypasses Grail; if
  you've added a new criterion, you still need to run it against a real
  tenant.
- **Replacing the production Pulse Assessment.** Demo mode is opt-in via a
  URL param or explicit console call. Default behavior is unchanged.

---

## Quick-reference cheat sheet

```js
// List scenarios
__pulseDemo()

// Activate
__pulseDemo('small-corp')
__pulseDemo('medium-bank')
__pulseDemo('xlarge-telco')
__pulseDemo('xxlarge-cloud')

// Exit demo
__pulseDemo(null)

// Direct URL activation
?demo=xlarge-telco
```
