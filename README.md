# Pulse Assessment

> Automated observability coverage and maturity assessment for Dynatrace environments.

Pulse Assessment is a native **Dynatrace App** that evaluates your environment's observability posture across **9 capabilities** and **111 criteria** using real-time DQL queries against Grail. It provides dual-dimension scoring (Coverage + Maturity), guided remediation, historical snapshots, and PDF reporting.

---

## Features

- **Automated Assessment** — Executes ~94 unique DQL queries (111 criteria with cross-entity ratios) against your Dynatrace tenant
- **Dual Scoring Dimensions**
  - **Coverage** — Percentage of criteria passing thresholds (simple pass/fail ratio)
  - **Maturity** — Weighted progressive scoring across Foundation (60%), Best Practice (25%), and Excellence (15%) tiers with gating rules
- **Interactive Radar Chart** — Canvas-rendered polar chart with hover tooltips and click-to-drill-down
- **3 View Modes** — Coverage, Maturity, and Executive Summary (Recommendations)
- **Guided Remediation** — Specific actions and documentation links for every unmet criterion
- **Historical Snapshots** — Auto-saved to Dynatrace Document Store with up to 12 snapshots retained
- **Evolution Over Time** — A/B comparison of any two snapshots with delta analysis per capability and criterion
- **PDF Reports** — Three report types: Summary, Coverage Detail, and Maturity Detail (dark-themed A4)
- **Preflight Validation** — Verifies all 7 API scopes before running the assessment
- **Dark/Light Theme** — Full support via Dynatrace Strato design tokens

## 9 Capabilities Assessed

| Capability | Criteria | Tiers (F / BP / E) | Color |
|---|---|---|---|
| Infrastructure Observability | 22 | 4 / 10 / 8 | `#3B82F6` |
| Application Observability | 13 | 3 / 4 / 6 | `#8B5CF6` |
| Digital Experience | 11 | 3 / 5 / 3 | `#EC4899` |
| Log Analytics | 16 | 4 / 6 / 6 | `#F59E0B` |
| Application Security | 11 | 4 / 4 / 3 | `#EF4444` |
| Threat Observability | 11 | 3 / 5 / 3 | `#F97316` |
| AI Observability | 9 | 3 / 2 / 4 | `#06B6D4` |
| Business Observability | 8 | 3 / 2 / 3 | `#10B981` |
| Software Delivery | 10 | 3 / 4 / 3 | `#6366F1` |
| **Total** | **111** | **30 / 46 / 40** | |

## Maturity Scoring Model

### Tier Weights (Progressive)

| Tier | Weight | Gate |
|---|---|---|
| Foundation | 60% | Always counted |
| Best Practice | 25% | Only counts if Foundation ≥ 80% |
| Excellence | 15% | Only counts if Best Practice ≥ 60% |

### Maturity Levels

| Level | Label | Condition |
|---|---|---|
| L0 | Not Adopted | Foundation < 50% |
| L1 | Foundation | Foundation ≥ 50% |
| L2 | Operational | Foundation = 100% AND Best Practice ≥ 50% |
| L3 | Optimized | Foundation = 100% AND Best Practice = 100% AND Excellence ≥ 50% |

> **Why progressive?** Coverage shows *how much* you cover. Maturity shows *if you're covering in the right order*. A solid Foundation must come before chasing Excellence.

## Prerequisites

- **Node.js** 24+
- **Dynatrace App Toolkit** (`dt-app` CLI v1.8+)
- Access to a Dynatrace tenant (SaaS or Managed)
- VSCode with the [Dynatrace Apps extension](https://marketplace.visualstudio.com/items?itemName=dynatrace.dynatrace-extensions) (recommended)

## Quick Start

### 1. Clone the repository
```bash
git clone <repository-url>
cd cca-app
```

### 2. Configure your tenant
Edit `app.config.json` and set your environment URL:
```json
"environmentUrl": "https://YOUR_TENANT_ID.apps.dynatrace.com"
```

### 3. Install dependencies
```bash
npm install
```

### 4. Run locally (dev mode)
```bash
npm run start
```
Opens in browser connected to your tenant with hot reload.

### 5. Deploy to production
```bash
npm run build
npm run deploy
```

## Required Scopes

The app requires 11 scopes (configured in `app.config.json`):

| Scope | Purpose |
|---|---|
| `storage:entities:read` | Entity queries (hosts, services, apps) |
| `storage:logs:read` | Log Analytics criteria |
| `storage:metrics:read` | Infrastructure metrics (timeseries) |
| `storage:spans:read` | APM + AI Observability tracing |
| `storage:events:read` | Security, Delivery, Problems |
| `storage:bizevents:read` | Business Observability events |
| `storage:buckets:read` | Grail bucket access for DQL |
| `storage:system:read` | System table access |
| `document:documents:read` | Load assessment snapshots |
| `document:documents:write` | Save assessment snapshots |
| `document:documents:delete` | Cleanup old snapshots |

## Project Structure

```
cca-app/
├── app.config.json               # App manifest
├── package.json                  # Dependencies
├── ui/
│   ├── main.tsx                  # Entry point
│   └── app/
│       ├── App.tsx               # Routes (/, /compare)
│       ├── queries.ts            # 111 DQL criteria definitions
│       ├── remediationActions.ts # Remediation for all criteria
│       ├── components/           # Reusable UI components
│       ├── data/                 # Static data (tiers, summaries)
│       ├── hooks/                # Business logic hooks
│       ├── pages/                # Page components
│       └── utils/                # Shared utilities
└── docs/
    └── ARCHITECTURE.md           # Detailed architecture docs
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture, data flow, and scoring model documentation.

## Tech Stack

| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript 5.3 | Type safety |
| Dynatrace Strato | Design system |
| Chart.js | Evolution charts |
| jsPDF | PDF report generation |
| DQL | Grail data queries |
| dt-app CLI | Build, dev, deploy |

## Grail Query Cost (DPS Consumption)

> **Important:** Each assessment execution queries Grail tables (logs, spans, events, bizevents) which consume **DPS** based on GiB scanned.

### Estimated cost per assessment (based on real BWM tenant data)

| Source | GiB/query | Unique Queries | Total Scanned |
|---|---|---|---|
| Logs (2h window) | ~6 GiB | 24 | ~138 GiB |
| Spans (2h window) | ~0.1 GiB | 23 | ~2.4 GiB |
| Davis Problems (72h) | ~0.04 GiB | 7 | ~0.3 GiB |
| Events (2h window) | ~0.05 GiB | 8 | ~0.4 GiB |
| Bizevents (2h window) | ~0.1 GiB | 11 | ~1.1 GiB |
| **Total** | | **73 unique** | **~142 GiB** |

- Entity queries (`fetch dt.entity.*`) and `timeseries` queries have **zero or negligible** scan cost.
- Actual cost depends on your tenant's data volume, Grail pricing tier, and contract.
- Estimated cost: **~$0.92 – $1.42 per assessment** (at $0.0065–$0.01/GiB).
- Running once per week: **~$4–$6/month**. Once per day: **~$28–$43/month**.

### Cost optimization applied (v2.3.51)

- AI Observability span queries reduced from 72h → 2h window (**90% cost reduction**).
- Query deduplication: identical queries execute only once regardless of how many criteria share them.
- All queries return only aggregated counts (`summarize count()`), minimizing data transfer.

## Scripts

| Command | Description |
|---|---|
| `npm run start` | Start dev server with hot reload |
| `npm run build` | Build for production |
| `npm run deploy` | Deploy to Dynatrace tenant |
| `npm run uninstall` | Remove app from tenant |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

Internal — Dynatrace. See [LICENSE](LICENSE).
