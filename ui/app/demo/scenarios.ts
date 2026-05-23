// ui/app/demo/scenarios.ts
//
// Demo scenarios — canned tenants for previewing the app at scales we don't
// have real access to. Activated via the URL param ?demo=<id> or the console
// helper window.__pulseDemo(). See ../docs/DEMO-MODE.md for the operator guide.
//
// Design ─────────────────────────────────────────────────────────────────
// A scenario does NOT ship a hand-tuned value for every one of the 107
// criteria. That would be unmaintainable as queries.ts evolves. Instead, a
// scenario declares **per-capability target coverage** + optional per-criterion
// overrides, and `buildCoverageFromScenario()` generates the full result by
// drawing each criterion's value from a deterministic distribution around the
// capability target. The same scenario + criterion id always yields the same
// number — runs are reproducible across reloads and across sessions.
//
// What's faked vs real ───────────────────────────────────────────────────
//   • Coverage values per criterion: faked (deterministic, around target).
//   • Capability score, maturity tiers, weighted score: REAL math, applied to
//     the faked criterion values. This means the demo exercises the same
//     scoring pipeline production users see.
//   • DPS, Grail queries: ZERO. Demo bypasses queryExecutionClient entirely.
//   • Snapshot save: disabled (useAssessmentHistory is gated by isDemo).
//   • Entity counts: faked from the scenario's `entityCounts` block.
//   • Wall-time: simulated via a single setTimeout to match the latency a
//     real run of that tier would take (1–3 s for exact, 3–5 s for large,
//     5–8 s for xlarge), so demos feel realistic but never hang.

import { CAPABILITIES, type CapabilityDef, type Threshold } from '../queries';
import { CRITERION_TIERS, type CriterionTier } from '../data/criterionTiers';
import type { ScaleTier } from '../scale-tier';
import type {
  CapabilityResult,
  EntityCounts,
  MaturityResult,
  QueryStats,
} from '../hooks/useCoverageData';

// ─────────────────────────────────────────────────────────────────────────
// Scenario type
// ─────────────────────────────────────────────────────────────────────────

export interface DemoScenario {
  /** Stable identifier used in the URL param and localStorage. Lowercase, kebab-case. */
  id: string;
  /** Display name shown on the demo banner. */
  label: string;
  /** Short narrative paragraph for the demo banner / tooltip. */
  narrative: string;
  /** Tier the scenario emulates. The auto-detection is bypassed in demo mode. */
  tier: ScaleTier;
  /** Faked host count surfaced in the banner and in entityCounts. */
  hostCount: number;
  /** Total simulated DQL run wall-time (ms). Mimics real Grail latency for the tier. */
  simulatedWallTimeMs: number;
  /** Per-capability target coverage (0-100). Criterion values are drawn around this. */
  capabilityTargets: Record<string, number>;
  /** Optional per-criterion forced value (id → 0-100). Wins over capabilityTargets. */
  criterionOverrides?: Record<string, number>;
  /** Faked entity counts. */
  entityCounts: EntityCounts;
  /** Simulated total Grail scan that a REAL assessment at this scale would consume.
   *  Used by the demo to populate QueryStats so users see realistic DPS numbers. */
  simulatedScanGB: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Catalog
// ─────────────────────────────────────────────────────────────────────────

/**
 * Scenario catalog. Order matters — UI may surface them in this order on a
 * future demo-picker menu. Add new scenarios at the end to preserve URLs.
 */
export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'small-corp',
    label: 'Acme Inc. (Small SaaS startup)',
    narrative:
      'A growing SaaS startup with 240 hosts and a single Kubernetes cluster. Good on basic infra observability, still building out security and AI maturity.',
    tier: 'exact',
    hostCount: 240,
    simulatedWallTimeMs: 1500,
    simulatedScanGB: 0.6, // ~$0.006 — typical exact-tier run on small tenant
    capabilityTargets: {
      'Infrastructure Observability': 75,
      'Application Observability': 65,
      'Digital Experience': 80,
      'Log Analytics': 55,
      'Application Security': 40,
      'Threat Observability': 30,
      'AI Observability': 20,
      'Business Observability': 50,
      'Software Delivery': 60,
    },
    entityCounts: {
      hosts: 240, services: 38, serviceMethods: 142, processGroups: 88, processInstances: 312,
      applications: 6, mobileApps: 2, k8sClusters: 1, k8sNamespaces: 14, k8sNodes: 18,
      syntheticTests: 12, syntheticLocations: 4, httpChecks: 28, networkInterfaces: 220, disks: 410,
      logs: 0, spans: 0, aiSpans: 0, events: 0, problems: 0, bizEvents: 0, cloudLogs: 0, securityEvents: 0,
    },
  },
  {
    id: 'medium-bank',
    label: 'Atlas Banco (Mid-size financial institution)',
    narrative:
      '8,500 hosts across two data centers and a hybrid AWS footprint. Strong infrastructure and security maturity (compliance-driven), weak AI observability (heavily regulated).',
    tier: 'large',
    hostCount: 8500,
    simulatedWallTimeMs: 3500,
    simulatedScanGB: 18, // ~$0.18 — large-tier with 30m window
    capabilityTargets: {
      'Infrastructure Observability': 90,
      'Application Observability': 78,
      'Digital Experience': 55,
      'Log Analytics': 70,
      'Application Security': 85,
      'Threat Observability': 60,
      'AI Observability': 15,
      'Business Observability': 70,
      'Software Delivery': 65,
    },
    criterionOverrides: {
      // Bank has strict change windows → high delivery practice but slower deploys.
      sd5: 35, // deploy frequency low
      sd6: 88, // change failure rate excellent
      // AI Obs basically untouched
      ai1: 5, ai2: 5, ai3: 5, ai4: 0, ai5: 0,
    },
    entityCounts: {
      hosts: 8500, services: 420, serviceMethods: 2800, processGroups: 1620, processInstances: 7100,
      applications: 84, mobileApps: 8, k8sClusters: 12, k8sNamespaces: 188, k8sNodes: 340,
      syntheticTests: 240, syntheticLocations: 12, httpChecks: 410, networkInterfaces: 7900, disks: 14200,
      logs: 0, spans: 0, aiSpans: 0, events: 0, problems: 0, bizEvents: 0, cloudLogs: 0, securityEvents: 0,
    },
  },
  {
    id: 'xlarge-telco',
    label: 'GlobalCom (xLarge telco)',
    narrative:
      '80,000 hosts across four continents, mix of bare-metal core network and cloud-native customer-facing services. Strong infrastructure and logs, partial app obs because of legacy COBOL/Mainframe footprint.',
    tier: 'xlarge',
    hostCount: 80_000,
    simulatedWallTimeMs: 5500,
    simulatedScanGB: 3200, // ~$32 — xlarge tier with 5m window
    capabilityTargets: {
      'Infrastructure Observability': 88,
      'Application Observability': 72,
      'Digital Experience': 60,
      'Log Analytics': 82,
      'Application Security': 65,
      'Threat Observability': 70,
      'AI Observability': 35,
      'Business Observability': 55,
      'Software Delivery': 50,
    },
    entityCounts: {
      hosts: 80_000, services: 3500, serviceMethods: 28_000, processGroups: 14_200,
      processInstances: 62_000, applications: 480, mobileApps: 18, k8sClusters: 96,
      k8sNamespaces: 1820, k8sNodes: 3100, syntheticTests: 4200, syntheticLocations: 24,
      httpChecks: 3800, networkInterfaces: 76_000, disks: 138_000,
      logs: 0, spans: 0, aiSpans: 0, events: 0, problems: 0, bizEvents: 0, cloudLogs: 0, securityEvents: 0,
    },
  },
  {
    id: 'legacy-no-k8s',
    label: 'Banco Itamaraty (legacy on-prem, no K8s/RUM)',
    narrative:
      '12,000 hosts of bare-metal and VMs across two data centers. No Kubernetes, no public-facing RUM-monitored applications, no mobile apps. Logs and traces are well-instrumented; AppSec and Threat coverage strong because of compliance. Exists primarily to demonstrate C3 smart-skip — every criterion whose denominator is an absent entity class will be skipped at zero DPS cost.',
    tier: 'large',
    hostCount: 12_000,
    simulatedWallTimeMs: 4200,
    simulatedScanGB: 24, // ~$0.24 — Large tier with most criteria still running
    capabilityTargets: {
      'Infrastructure Observability': 88,
      'Application Observability': 70,
      'Digital Experience': 0, // no RUM at all
      'Log Analytics': 78,
      'Application Security': 82,
      'Threat Observability': 75,
      'AI Observability': 5,
      'Business Observability': 45,
      'Software Delivery': 55,
    },
    entityCounts: {
      // The four "this tenant doesn't have it" entity classes. The C3
      // smart-skip pass detects these and skips the dependent criteria —
      // surfaced in the perf JSON as skippedQueries / skippedCriteria.
      applications: 0,           // → skip all 9 criteria using application as queryB
      mobileApps: 0,             // → cosmetic only; not currently used as queryB
      k8sClusters: 0,            // → skip 3 criteria using kubernetes_cluster as queryB
      k8sNamespaces: 0,          // → skip 5 criteria using cloud_application_namespace
      k8sNodes: 0,
      // Everything else populated normally.
      hosts: 12_000, services: 420, serviceMethods: 3200, processGroups: 1800,
      processInstances: 7800, syntheticTests: 80, syntheticLocations: 6,
      httpChecks: 140, networkInterfaces: 11_800, disks: 22_400,
      logs: 0, spans: 0, aiSpans: 0, events: 0, problems: 0,
      bizEvents: 0, cloudLogs: 0, securityEvents: 0,
    },
  },
  {
    id: 'xxlarge-cloud',
    label: 'Nimbus Cloud (xxLarge hyperscaler)',
    narrative:
      '250,000 hosts running a public cloud platform. Best-in-class infra and logs, mature security and threat obs, strong but not perfect AI observability.',
    tier: 'xlarge',
    hostCount: 250_000,
    simulatedWallTimeMs: 7500,
    simulatedScanGB: 9800, // ~$98 — xlarge tier at hyperscale, still bounded by 50 GB scan cap × 19 log queries
    capabilityTargets: {
      'Infrastructure Observability': 92,
      'Application Observability': 85,
      'Digital Experience': 78,
      'Log Analytics': 95,
      'Application Security': 80,
      'Threat Observability': 85,
      'AI Observability': 60,
      'Business Observability': 78,
      'Software Delivery': 88,
    },
    entityCounts: {
      hosts: 250_000, services: 12_000, serviceMethods: 95_000, processGroups: 48_000,
      processInstances: 210_000, applications: 1800, mobileApps: 42, k8sClusters: 380,
      k8sNamespaces: 6800, k8sNodes: 12_400, syntheticTests: 12_000, syntheticLocations: 38,
      httpChecks: 9400, networkInterfaces: 240_000, disks: 420_000,
      logs: 0, spans: 0, aiSpans: 0, events: 0, problems: 0, bizEvents: 0, cloudLogs: 0, securityEvents: 0,
    },
  },
];

/** Lookup by id. Returns null when the id isn't known — caller falls back to live mode. */
export function findScenario(id: string | null | undefined): DemoScenario | null {
  if (!id) return null;
  return DEMO_SCENARIOS.find((s) => s.id === id) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// Deterministic per-criterion value generator
// ─────────────────────────────────────────────────────────────────────────

/**
 * Hash a string to a 32-bit unsigned integer. Fast xfnv-1a variant; quality is
 * fine for our use case (spread criterion values around a target, not crypto).
 */
function hash32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/**
 * Mulberry32 — a tiny, deterministic PRNG. Returns a float in [0,1) and is
 * seeded by the 32-bit hash above. Identical seed → identical sequence.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw a value in [target - spread, target + spread] then clamp to [0, 100]. */
function drawAroundTarget(rng: () => number, target: number, spread: number): number {
  const v = target + (rng() * 2 - 1) * spread;
  return Math.max(0, Math.min(100, Math.round(v * 10) / 10));
}

function meetsThreshold(value: number, thresholds: Threshold[]): boolean {
  return thresholds.some((t) => value >= t.min);
}

// ─────────────────────────────────────────────────────────────────────────
// Build full CapabilityResult[] from a scenario
// ─────────────────────────────────────────────────────────────────────────

const FOUNDATION_WEIGHT = 60;
const BEST_PRACTICE_WEIGHT = 25;
const EXCELLENCE_WEIGHT = 15;

export interface DemoBuiltResult {
  capabilities: CapabilityResult[];
  totalScore: number;
  overallMaturityLevel: number;
  stats: QueryStats;
  entityCounts: EntityCounts;
}

/**
 * Maps `entityCounts` keys to the `fetch dt.entity.X | summarize count()`
 * queryB strings that show up in queries.ts. Used by the C3 smart-skip
 * simulation so a scenario with `k8sClusters: 0` causes every k8s-dependent
 * criterion to be reported as skipped.
 *
 * Only the keys that ARE used as queryB denominators in queries.ts matter
 * here. Keys like `mobileApps`, `securityEvents`, `aiSpans` aren't referenced
 * as queryB by any criterion (verified during the v2.5.1 perf audit), so
 * setting them to 0 in a scenario has no C3 effect — but they're still useful
 * to surface in the entityCounts panel.
 */
const ENTITY_KEY_TO_QUERY: Record<string, string> = {
  hosts: 'fetch dt.entity.host | summarize count()',
  services: 'fetch dt.entity.service | summarize count()',
  applications: 'fetch dt.entity.application | summarize count()',
  k8sClusters: 'fetch dt.entity.kubernetes_cluster | summarize count()',
  k8sNamespaces: 'fetch dt.entity.cloud_application_namespace | summarize count()',
  processGroups: 'fetch dt.entity.process_group | summarize count()',
  processInstances: 'fetch dt.entity.process_group_instance | summarize count()',
};

/**
 * Returns the set of queryB strings (entity-count denominators) that
 * resolve to 0 in this scenario. The C3 simulation in useCoverageData
 * marks any criterion using one of these as skipped, so demo runs of e.g.
 * legacy-no-k8s show the same `skippedQueries` shape that a real K8s-less
 * tenant would produce.
 */
export function zeroEntityCountQueriesFor(scenario: DemoScenario): Set<string> {
  const out = new Set<string>();
  // Cast via `unknown` because EntityCounts has named keys (not an index
  // signature) and TS rejects the direct Record<string, number> cast — the
  // runtime shape is identical, the type system just doesn't know.
  const ec = scenario.entityCounts as unknown as Record<string, number>;
  for (const [key, query] of Object.entries(ENTITY_KEY_TO_QUERY)) {
    if (ec[key] === 0) out.add(query);
  }
  return out;
}

/**
 * Materialises a full assessment result from a scenario. Replaces what
 * useCoverageData.runAssessment() would produce from live Grail queries.
 *
 * This is pure (modulo PRNG seed). It always returns the same values for the
 * same scenario id, so a demo is reproducible across reloads.
 *
 * Criteria whose `queryB` references an entity class that's 0 in the
 * scenario's `entityCounts` are forced to value=0 (matching what live
 * scoring would do when valueB <= 0). This keeps the radar consistent
 * with the perf JSON's `skippedCriteria` set.
 */
export function buildCoverageFromScenario(scenario: DemoScenario): DemoBuiltResult {
  const zeroDenoms = zeroEntityCountQueriesFor(scenario);
  // Per-criterion jitter spread. Higher tier = slightly noisier (matches the
  // real observation that at xlarge scale individual criteria fluctuate more).
  const spread = scenario.tier === 'xlarge' ? 18 : scenario.tier === 'large' ? 12 : 8;

  const capabilities: CapabilityResult[] = CAPABILITIES.map((cap: CapabilityDef) => {
    const target = scenario.capabilityTargets[cap.name] ?? 50;

    const criteriaResults: CapabilityResult['criteriaResults'] = cap.criteria.map((criterion) => {
      // C3-consistent forcing: if this criterion depends on an entity
      // class that has 0 count in the scenario, its coverage MUST be 0 —
      // exactly what the live scoring path produces when valueB <= 0. This
      // keeps the radar visually consistent with the perf JSON's
      // skippedCriteria list (no "100% k8s coverage" in a scenario that
      // declares zero clusters).
      const isZeroDenom =
        criterion.queryB != null && zeroDenoms.has(criterion.queryB);
      // Override wins; otherwise jitter around capability target. Zero-denom
      // forces 0 regardless of override.
      const override = scenario.criterionOverrides?.[criterion.id];
      const value = isZeroDenom
        ? 0
        : override != null
          ? Math.max(0, Math.min(100, override))
          : drawAroundTarget(mulberry32(hash32(`${scenario.id}|${criterion.id}`)), target, spread);
      const rng = mulberry32(hash32(`${scenario.id}|${criterion.id}`));
      const passed = meetsThreshold(value, criterion.thresholds);
      const thDesc = criterion.thresholds
        .slice()
        .sort((a, b) => b.min - a.min)
        .map((t) => `≥${t.min}`)
        .join(', ');
      const tier: CriterionTier = (CRITERION_TIERS[criterion.id] as CriterionTier) || 'foundation';

      return {
        id: criterion.id,
        label: criterion.label,
        description: criterion.description,
        value,
        points: passed ? 1 : 0,
        error: false,
        query: criterion.queryB
          ? `${criterion.query}\n÷ ${criterion.queryB}`
          : criterion.denominatorConstant != null
            ? `${criterion.query}\n÷ ${criterion.denominatorConstant} (constant)`
            : criterion.query,
        thresholds: thDesc,
        tier,
        isRatio: !!criterion.queryB || criterion.denominatorConstant != null,
      };
    });

    // Maturity computation — IDENTICAL to the live path in useCoverageData,
    // so the demo exercises the real scoring code.
    const tierCounts = {
      foundation: { total: 0, passed: 0 },
      bestPractice: { total: 0, passed: 0 },
      excellence: { total: 0, passed: 0 },
    };
    for (const cr of criteriaResults) {
      tierCounts[cr.tier].total++;
      if (cr.points > 0) tierCounts[cr.tier].passed++;
    }
    const fPct = tierCounts.foundation.total > 0 ? tierCounts.foundation.passed / tierCounts.foundation.total : 0;
    const bPct = tierCounts.bestPractice.total > 0 ? tierCounts.bestPractice.passed / tierCounts.bestPractice.total : 0;
    const ePct = tierCounts.excellence.total > 0 ? tierCounts.excellence.passed / tierCounts.excellence.total : 0;
    let level: 0 | 1 | 2 | 3 = 0;
    let levelLabel = 'Not Adopted';
    if (fPct >= 0.5) {
      level = 1;
      levelLabel = 'Foundation';
    }
    if (fPct >= 1.0 && bPct >= 0.5) {
      level = 2;
      levelLabel = 'Operational';
    }
    if (fPct >= 1.0 && bPct >= 1.0 && ePct >= 0.5) {
      level = 3;
      levelLabel = 'Optimized';
    }
    const effB = fPct >= 0.8 ? bPct : 0;
    const effE = effB >= 0.6 ? ePct : 0;
    const maturityScore = Math.round(
      fPct * FOUNDATION_WEIGHT + effB * BEST_PRACTICE_WEIGHT + effE * EXCELLENCE_WEIGHT,
    );
    const maturityBand =
      maturityScore >= 80
        ? 'Excellent'
        : maturityScore >= 60
        ? 'Good'
        : maturityScore >= 40
        ? 'Moderate'
        : maturityScore >= 20
        ? 'Low'
        : 'N/A';
    const maturity: MaturityResult = {
      foundation: tierCounts.foundation,
      bestPractice: tierCounts.bestPractice,
      excellence: tierCounts.excellence,
      level,
      levelLabel,
      maturityScore,
      maturityBand,
    };

    const passedCount = criteriaResults.filter((cr) => cr.points > 0).length;
    const capScore = Math.round((passedCount / cap.criteria.length) * 100);

    return {
      name: cap.name,
      color: cap.color,
      score: capScore,
      rawScore: capScore,
      details: [],
      criteriaResults,
      maturity,
      consolidation: 100,
      effectiveMaturityScore: maturityScore,
    };
  });

  const totalScore =
    capabilities.length > 0
      ? Math.round(capabilities.reduce((s, c) => s + c.score, 0) / capabilities.length)
      : 0;
  const overallMaturityLevel =
    capabilities.length > 0
      ? Math.round(capabilities.reduce((s, c) => s + c.effectiveMaturityScore, 0) / capabilities.length)
      : 0;

  const totalCriteria = capabilities.reduce((s, c) => s + c.criteriaResults.length, 0);
  const stats: QueryStats = {
    total: totalCriteria,
    succeeded: totalCriteria,
    failed: 0,
    scannedBytes: Math.round(scenario.simulatedScanGB * 1024 * 1024 * 1024),
    scannedRecords: scenario.hostCount * 980, // rough heuristic — keep visually plausible
    scannedDataPoints: 0,
  };

  return {
    capabilities,
    totalScore,
    overallMaturityLevel,
    stats,
    entityCounts: scenario.entityCounts,
  };
}
