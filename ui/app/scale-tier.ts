// ui/app/scale-tier.ts
//
// Scale Tier — adapts DQL queries to the size of the target tenant.
//
// Background ──────────────────────────────────────────────────────────────
// The Pulse Assessment app was originally calibrated for tenants up to ~5k
// hosts. Above that, the default "fetch logs | filter timestamp > now()-2h"
// pattern scans ingest-proportional volume and can exceed Grail's per-query
// timeout (~10 min). At 80k hosts a single log query projects to ~17 TB of
// scan / ~30 min wall-time per query — not viable.
//
// What this module does ───────────────────────────────────────────────────
// Introduces three execution modes that adapt the SCAN STRATEGY without
// changing scoring semantics or result column names:
//
//   - "exact"  — default. Queries are returned verbatim. Use for tenants
//                up to 5,000 hosts. Ground-truth coverage values.
//   - "large"  — for logs/spans/events/bizevents only, narrows the window
//                to 30 minutes and applies a 200 GB scanLimitGBytes cap.
//                Distinct-count accuracy preserved on typical workloads
//                (every active host emits at least one record per 30 min).
//   - "xlarge" — same shape as Large, but with a 5-minute window and 50 GB
//                cap. Coverage values become estimates (±5-10% on typical
//                workloads at 80k+ hosts). REQUIRED above 50k hosts to fit
//                inside Grail's query timeout.
//
// Entity, metrics, and Davis problems queries are NEVER scaled — they are
// already cheap (entity counts are metadata, metrics use timeseries which
// doesn't scan raw data, problems are 72h-windowed but sparse).
//
// Contract ────────────────────────────────────────────────────────────────
// scaleQuery() is a PURE function over (query, tier) → query. It does not
// allocate the network. The result is a syntactically-valid DQL string
// that returns the SAME column shape as the input. Downstream consumers
// (useCoverageData, components, scoring) operate on the original query
// string as the cache key, so swapping the executed string is transparent.
//
// Result fidelity caveat ──────────────────────────────────────────────────
// In "large" and "xlarge" modes, numeric values may differ from "exact"
// because the scan covers less data. This is INTENTIONAL — it is what
// makes the app runnable at xlarge. The UI surfaces this via the
// ScaleTierBanner and an "≈" prefix on each affected coverage score.

export type ScaleTier = 'exact' | 'large' | 'xlarge';

export interface TierConfig {
  /** Window applied to fetch logs/spans/events/bizevents. */
  windowMinutes: number;
  /** scanLimitGBytes safety net for the same sources (undefined = no cap). */
  scanLimitGBytes?: number;
  /** True when results are estimates rather than ground truth. */
  sampled: boolean;
  /** Human-readable label shown in the UI banner. */
  label: string;
  /** Banner subtitle explaining the tradeoff. */
  description: string;
  /** Lower host-count bound for auto-selection (inclusive). */
  minHosts: number;
  /** Upper host-count bound for auto-selection (exclusive). Infinity = no cap. */
  maxHosts: number;
}

export const TIER_CONFIG: Record<ScaleTier, TierConfig> = {
  exact: {
    windowMinutes: 120,
    sampled: false,
    label: 'Exact',
    description:
      'Full 2-hour window, no sampling. Ground-truth coverage values. Recommended for tenants up to 5,000 hosts.',
    minHosts: 0,
    maxHosts: 5_000,
  },
  large: {
    windowMinutes: 30,
    scanLimitGBytes: 200,
    sampled: true,
    label: 'Large',
    description:
      '30-minute window with 200 GB scan cap. Suitable for tenants 5k–50k hosts. Coverage values may shift slightly for very sparse signals; otherwise indistinguishable from Exact.',
    minHosts: 5_000,
    maxHosts: 50_000,
  },
  xlarge: {
    windowMinutes: 5,
    scanLimitGBytes: 50,
    sampled: true,
    label: 'xLarge',
    description:
      '5-minute window with 50 GB scan cap. For tenants >50k hosts. Coverage values are sampled estimates (±5–10% on typical workloads with continuous ingest). Suitable for trend tracking, not formal audit.',
    minHosts: 50_000,
    maxHosts: Number.POSITIVE_INFINITY,
  },
};

/**
 * Auto-selects a tier from observed host count using the thresholds defined
 * in TIER_CONFIG (currently 5k / 50k). The user can override this via the
 * Scale Tier toggle in the header — the override is persisted in localStorage
 * by useScaleTier.
 */
export function tierFromHostCount(hostCount: number): ScaleTier {
  if (hostCount >= TIER_CONFIG.xlarge.minHosts) return 'xlarge';
  if (hostCount >= TIER_CONFIG.large.minHosts) return 'large';
  return 'exact';
}

/**
 * Hot sources are the high-cost streaming tables whose scan grows linearly
 * with ingest volume. Only these are scaled by tier. Davis problems are
 * intentionally excluded: they are sparse and Davis already deduplicates,
 * so reducing their 72h window would actually lose signal without saving
 * meaningful cost.
 */
function isHotSource(query: string): boolean {
  return (
    /\bfetch\s+logs\b/i.test(query) ||
    /\bfetch\s+spans\b/i.test(query) ||
    /\bfetch\s+events\b/i.test(query) ||
    /\bfetch\s+bizevents\b/i.test(query)
  );
}

/**
 * Returns the DQL string Grail will actually execute given a tier.
 *
 * In "exact" mode the input is returned verbatim — zero risk of regression
 * on tenants ≤ 5k hosts.
 *
 * In "large" / "xlarge" mode, for hot sources only, the function:
 *   1. Removes any "| filter timestamp > now() - N(h|m)" pipeline stage
 *      (the from: parameter would otherwise conflict).
 *   2. Replaces "fetch <src>" or "fetch <src>, from:now()-Xh" with
 *      "fetch <src>, from: now()-WINDOWm, scanLimitGBytes: CAP".
 *
 * Other clauses (field filters, summarize, fieldsAdd, fields) are preserved
 * bit-identical so the result column shape matches the original query.
 */
export function scaleQuery(query: string, tier: ScaleTier): string {
  if (tier === 'exact') return query;
  if (!isHotSource(query)) return query;

  const cfg = TIER_CONFIG[tier];
  const window = `now()-${cfg.windowMinutes}m`;
  const scanLimit =
    cfg.scanLimitGBytes != null ? `, scanLimitGBytes: ${cfg.scanLimitGBytes}` : '';

  // 1) Strip pipeline "filter timestamp > now() - Nh|m|s|d" stages — will be replaced by from:
  let q = query.replace(
    /\|\s*filter\s+timestamp\s*>\s*now\(\)\s*-\s*\d+\s*[hmsd]\s*/gi,
    '| ',
  );
  // Collapse any double pipes that may result from the strip above
  q = q.replace(/\|\s*\|/g, '| ');

  // 2) Inject from: + scanLimitGBytes into the fetch clause for the hot source.
  q = q.replace(
    /\bfetch\s+(logs|spans|events|bizevents)\b(\s*,\s*from\s*:\s*now\(\)\s*-\s*\d+\s*[hmsd])?/i,
    (_m, src) => `fetch ${src}, from: ${window}${scanLimit}`,
  );

  return q;
}
