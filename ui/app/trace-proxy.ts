// ui/app/trace-proxy.ts
//
// Trace Proxy Mode — run the assessment on tenants WITHOUT the Traces on
// Grail entitlement (classic-SKU SaaS, DPS tenants with the trace
// entitlement disabled). See docs/STUDY-CLASSIC-SAAS-NO-GRAIL-TRACES.md.
//
// Principle ───────────────────────────────────────────────────────────────
// The same instrumentation that produces spans also produces service
// metrics (dt.service.request.*) and topology relations (calls/called_by)
// on Grail — which these tenants DO have. Span-based checks are therefore:
//   - PROXIED  when an honest metric/topology equivalent exists, or
//   - EXCLUDED when none does (never faked, never counted as a failure —
//     they leave the scoring denominator entirely).
//
// Fidelity was validated side-by-side on a reference tenant (which has both spans
// and metrics, 97 services, 2h window):
//   a1  traced services      spans 83  vs request-metric services 90  (Δ+7pts)
//   a3  root-span services   spans 75  vs request-metric services 90  (Δ+15, same band)
//   a4  OTel services        spans 64  vs UNIFIED-type services   60  (Δ-4pts)
//   a8  DB services          spans 6   vs DATABASE_SERVICE callers 1  (low here;
//       better on OneAgent-classic estates where DBs are modeled as entities)
//   a10 multi-service        27% of traces vs 40% of services w/ outgoing calls
// Every proxied check keeps the same pass/fail outcome at its lowest
// (operative) threshold.
//
// AI/LLM Observability loses every span criterion: gen_ai.* attributes exist
// ONLY on spans, so there is no honest proxy. The capability is then scored on
// its few criteria that do not read spans. The exclusion is disclosed in the
// TraceProxyBanner and becomes the enablement conversation.

import { CAPABILITIES, type CapabilityDef, type Criterion } from "./queries";

/** Query fragment that marks a criterion as span-dependent. */
const SPANS = "fetch spans";

export function isSpanCriterion(cr: Criterion): boolean {
  return cr.query.includes(SPANS) || (cr.queryB?.includes(SPANS) ?? false);
}

interface ProxyDef {
  /** Replacement numerator (metrics/topology — never spans). */
  query: string;
  /** Replacement denominator; omit to keep the original queryB. */
  queryB?: string;
  /** Appended to the criterion description so cards/PDF/Assist disclose it. */
  note: string;
}

// Since 3.0.13 the application criteria that once read spans (database,
// messaging, call relations) read the service metrics and topology Dynatrace
// derives from traces, on every tenant. No criterion outside AI/LLM
// Observability reads spans any more, so there is nothing left to proxy.
const PROXIES: Record<string, ProxyDef> = {};

/** Human-readable reasons for the span checks that have NO honest proxy. */
export const PROXY_EXCLUSION_REASONS: Record<string, string> = {};

export interface TraceProxyInfo {
  /** Criterion IDs whose queries were replaced with metric/topology proxies. */
  proxiedIds: string[];
  /** Criterion IDs removed from the run (and from every denominator). */
  excludedIds: string[];
  /** Capabilities removed entirely (all their checks need spans). */
  excludedCapabilities: string[];
}

/**
 * Transform a capability set for a tenant without Traces on Grail:
 * span criteria get proxy queries (same id → same utilization tier, same
 * thresholds), unproxiable span criteria are dropped from the criteria
 * array (scoring divides by criteria.length, so they leave the
 * denominator — the customer is not penalised for a missing entitlement),
 * and capabilities left with zero criteria (AI/LLM Observability) are dropped.
 */
export function applyTraceProxyMode(
  caps: CapabilityDef[],
): { caps: CapabilityDef[]; info: TraceProxyInfo } {
  const proxiedIds: string[] = [];
  const excludedIds: string[] = [];
  const excludedCapabilities: string[] = [];

  const out: CapabilityDef[] = [];
  for (const cap of caps) {
    const criteria: Criterion[] = [];
    for (const cr of cap.criteria) {
      if (!isSpanCriterion(cr)) {
        criteria.push(cr);
        continue;
      }
      const proxy = PROXIES[cr.id];
      if (proxy) {
        proxiedIds.push(cr.id);
        criteria.push({
          ...cr,
          query: proxy.query,
          queryB: proxy.queryB ?? cr.queryB,
          description: `${cr.description} ${proxy.note}`,
          proxied: true,
        });
      } else {
        excludedIds.push(cr.id);
      }
    }
    if (criteria.length === 0) {
      excludedCapabilities.push(cap.name);
    } else {
      out.push({ ...cap, criteria });
    }
  }
  return { caps: out, info: { proxiedIds, excludedIds, excludedCapabilities } };
}

