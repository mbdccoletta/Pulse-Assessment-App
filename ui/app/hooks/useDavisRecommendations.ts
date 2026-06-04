// ui/app/hooks/useDavisRecommendations.ts
//
// React hook that produces dynamic Davis CoPilot recommendations for the
// current assessment.
//
// Contract ───────────────────────────────────────────────────────────────
//   Input:  CapabilityResult[] (post-run, fully scored)
//   Output: Map<capabilityName, DavisRecommendationState>
//
// Lifecycle ──────────────────────────────────────────────────────────────
//   1. When `enabled === true` AND capabilities transition from empty to
//      populated, load the cache once, then fan out one Davis call per
//      capability that has at least one failed criterion.
//   2. Calls run in parallel; state per capability flips
//      idle → loading → success/error independently.
//   3. After the last call returns, flush() persists any new cache entries
//      to the Document Store.
//   4. Re-runs with the SAME capabilities are no-ops; we identify "same"
//      by the failure signature so a redundant re-render does not hammer
//      Davis.

import { useEffect, useRef, useState } from "react";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import type { CapabilityResult } from "./useCoverageData";
import {
  DavisCache,
  getRecommendation,
  type DavisRecommendation,
} from "../ai/davisRecommendations";
import { failureSignature } from "../ai/promptTemplates";

/** Per-capability state surfaced to the UI. */
export interface DavisRecommendationState {
  status: "idle" | "loading" | "success" | "error" | "skipped";
  rec?: DavisRecommendation;
  error?: string;
}

/** Map keyed by capability name. */
export type DavisRecommendationMap = Record<string, DavisRecommendationState>;

interface UseDavisOptions {
  /** Gate the entire hook. When false, never calls Davis and returns
   *  an empty map. Used to hide behind ?dev=1 while we validate quality. */
  enabled: boolean;
}

function tenantIdFrom(envUrl: string | null): string {
  if (!envUrl) return "unknown";
  const m = envUrl.match(/\/\/([^.]+)\./);
  return m?.[1] ?? "unknown";
}

export function useDavisRecommendations(
  capabilities: CapabilityResult[],
  { enabled }: UseDavisOptions,
): DavisRecommendationMap {
  const [map, setMap] = useState<DavisRecommendationMap>({});
  /** Joined signature of the last capabilities array we processed. If the
   *  user re-runs the same assessment without data changes, this short-
   *  circuits the effect. */
  const lastSigRef = useRef<string>("");
  /** Single per-tenant cache instance reused across runs in this session. */
  const cacheRef = useRef<DavisCache | null>(null);

  useEffect(() => {
    if (!enabled || capabilities.length === 0) {
      // Reset state when disabled or empty so UI does not show stale data.
      if (Object.keys(map).length) setMap({});
      lastSigRef.current = "";
      return;
    }

    // De-dup: if the combined signature did not change, skip.
    const combined = capabilities.map(c => failureSignature(c)).join("|");
    if (combined === lastSigRef.current) return;
    lastSigRef.current = combined;

    let cancelled = false;

    (async () => {
      // Lazy-init cache once per session.
      if (!cacheRef.current) {
        try {
          const envUrl = getEnvironmentUrl();
          const tenantId = tenantIdFrom(envUrl ?? null);
          cacheRef.current = new DavisCache(tenantId);
          await cacheRef.current.load();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[useDavisRecommendations] cache init failed:", err);
          cacheRef.current = null;
        }
      }

      // Seed initial state — every capability gets a slot.
      const initial: DavisRecommendationMap = {};
      for (const cap of capabilities) {
        const failed = cap.criteriaResults.filter(cr => cr.points === 0 && !cr.error).length;
        initial[cap.name] = failed === 0
          ? { status: "skipped" }
          : { status: "loading" };
      }
      if (!cancelled) setMap(initial);

      // Fan out concurrently. We await Promise.all so we can flush() once at
      // the end, but each result updates state as soon as it resolves.
      await Promise.all(
        capabilities.map(async (cap) => {
          if (initial[cap.name].status === "skipped") return;
          try {
            const rec = await getRecommendation(cap, cacheRef.current);
            if (cancelled) return;
            if (!rec) {
              setMap(prev => ({
                ...prev,
                [cap.name]: { status: "error", error: "Davis CoPilot unavailable" },
              }));
              return;
            }
            setMap(prev => ({
              ...prev,
              [cap.name]: { status: "success", rec },
            }));
          } catch (err) {
            if (cancelled) return;
            setMap(prev => ({
              ...prev,
              [cap.name]: {
                status: "error",
                error: err instanceof Error ? err.message : String(err),
              },
            }));
          }
        }),
      );

      // Persist any new entries collected this run. Fire-and-forget.
      if (cacheRef.current && !cancelled) {
        void cacheRef.current.flush();
      }
    })();

    return () => { cancelled = true; };
    // Intentionally exclude `map` from deps — we only want to fan out when
    // `capabilities` changes shape, not on every internal state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilities, enabled]);

  return map;
}
