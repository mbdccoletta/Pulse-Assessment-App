// ui/app/hooks/useDavisRecommendations.ts
//
// React hook that produces dynamic Davis CoPilot recommendations for the
// current assessment AND enables conversation follow-ups per capability.
//
// Contract ───────────────────────────────────────────────────────────────
//   Input:  CapabilityResult[] (post-run, fully scored)
//   Output: {
//     byCapability: Record<capName, DavisRecommendationState>,
//     sendFollowUp: (capName, text) => Promise<void>,
//   }
//
// Lifecycle ──────────────────────────────────────────────────────────────
//   1. When `enabled === true` AND capabilities transition from empty to
//      populated, load the cache once, then fan out one Davis call per
//      capability that has at least one failed criterion.
//   2. Each call's response (text + opaque State) is stored. The State is
//      what enables follow-ups — the SDK uses it to continue the same
//      conversation context.
//   3. `sendFollowUp(capName, text)` calls Davis again with the previous
//      State + the new question, then appends the response to the
//      capability's conversation thread.
//   4. After the initial fan-out completes, flush() persists any new
//      INITIAL responses to the Doc Store cache. Follow-ups are NOT
//      persisted (session-scoped).
//   5. Re-runs with the SAME capabilities reuse cached initials; ongoing
//      conversations survive a re-render of the consumer but reset on a
//      full reload (which is the typical chat UX).
//
// Bounded cost ───────────────────────────────────────────────────────────
// Davis CoPilot enforces 25 questions/user/15min and 60/environment/15min
// (per the docs). With 9 capabilities + 5 follow-ups each, a worst-case
// session would burn 54 questions — close to the per-user ceiling. We cap
// follow-ups at MAX_FOLLOWUPS to leave headroom for normal SE work.

import { useCallback, useEffect, useRef, useState } from "react";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import type { State } from "@dynatrace-sdk/client-davis-copilot";
import type { CapabilityResult } from "./useCoverageData";
import {
  DavisCache,
  getRecommendation,
  getFollowUp,
  type DavisRecommendation,
} from "../ai/davisRecommendations";
import { failureSignature } from "../ai/promptTemplates";

/** One turn of the conversation surfaced to the UI. */
export interface DavisConversationTurn {
  role: "assistant" | "user";
  text: string;
  ts: number;
  /** Davis-issued ID. Required to submit feedback later. Only present on
   *  assistant turns. */
  messageToken?: string;
  /** True when the assistant turn came from the persistent cache (i.e.
   *  the initial recommendation, served warm). */
  fromCache?: boolean;
}

/** Per-capability state surfaced to the UI. */
export interface DavisRecommendationState {
  /** Coarse lifecycle of the LATEST turn. While a follow-up is in flight,
   *  status is "loading" even if a prior turn already succeeded. */
  status: "idle" | "loading" | "success" | "error" | "skipped";
  /** Convenience handle to the latest assistant turn. */
  rec?: DavisRecommendation;
  /** Full conversation thread. The first entry is the assistant's initial
   *  recommendation; subsequent entries alternate user/assistant. */
  conversation: DavisConversationTurn[];
  /** Error message from the latest failed call (initial or follow-up). */
  error?: string;
}

/** Map keyed by capability name. */
export type DavisRecommendationMap = Record<string, DavisRecommendationState>;

interface UseDavisOptions {
  /** Gate the entire hook. When false, never calls Davis and returns
   *  an empty map. Used to hide behind ?dev=1 while we validate quality. */
  enabled: boolean;
}

/** Result returned by the hook. */
export interface UseDavisHandle {
  /** Per-capability state. Empty when disabled or before fan-out completes. */
  byCapability: DavisRecommendationMap;
  /** Send a follow-up question on a capability's existing conversation.
   *  No-op if the capability never received an initial response. Capped at
   *  MAX_FOLLOWUPS questions per capability per session. */
  sendFollowUp: (capabilityName: string, text: string) => Promise<void>;
}

/** Hard cap on follow-ups per capability per session. Davis allows up to
 *  25 calls/user/15min; this lets every capability take ~3 follow-ups
 *  while still leaving budget for the initial fan-out + the SE's normal
 *  Dynatrace Assist usage. */
const MAX_FOLLOWUPS = 5;

function tenantIdFrom(envUrl: string | null): string {
  if (!envUrl) return "unknown";
  const m = envUrl.match(/\/\/([^.]+)\./);
  return m?.[1] ?? "unknown";
}

export function useDavisRecommendations(
  capabilities: CapabilityResult[],
  { enabled }: UseDavisOptions,
): UseDavisHandle {
  const [map, setMap] = useState<DavisRecommendationMap>({});
  /** Joined signature of the last capabilities array we processed. */
  const lastSigRef = useRef<string>("");
  /** Single per-tenant cache instance reused across runs in this session. */
  const cacheRef = useRef<DavisCache | null>(null);
  /** Opaque SDK State per capability — needed to continue a conversation.
   *  Kept in a ref rather than state because it's only consumed by the
   *  sendFollowUp callback and changes shouldn't re-render the consumer. */
  const stateRef = useRef<Record<string, State | undefined>>({});
  /** Follow-up call count per capability (to enforce MAX_FOLLOWUPS). */
  const followUpCountRef = useRef<Record<string, number>>({});
  /** Live capability list, kept in a ref so sendFollowUp can resolve a
   *  CapabilityResult by name without becoming a closure-stale callback. */
  const capabilitiesRef = useRef<CapabilityResult[]>(capabilities);
  capabilitiesRef.current = capabilities;

  useEffect(() => {
    if (!enabled || capabilities.length === 0) {
      if (Object.keys(map).length) setMap({});
      lastSigRef.current = "";
      return;
    }

    const combined = capabilities.map(c => failureSignature(c)).join("|");
    if (combined === lastSigRef.current) return;
    lastSigRef.current = combined;

    let cancelled = false;

    (async () => {
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

      const initial: DavisRecommendationMap = {};
      for (const cap of capabilities) {
        const failed = cap.criteriaResults.filter(cr => cr.points === 0 && !cr.error).length;
        initial[cap.name] = failed === 0
          ? { status: "skipped", conversation: [] }
          : { status: "loading", conversation: [] };
      }
      if (!cancelled) setMap(initial);

      await Promise.all(
        capabilities.map(async (cap) => {
          if (initial[cap.name].status === "skipped") return;
          try {
            const rec = await getRecommendation(cap, cacheRef.current);
            if (cancelled) return;
            if (!rec) {
              setMap(prev => ({
                ...prev,
                [cap.name]: {
                  status: "error",
                  conversation: [],
                  error: "Davis CoPilot unavailable",
                },
              }));
              return;
            }
            stateRef.current[cap.name] = rec.state;
            followUpCountRef.current[cap.name] = 0;
            setMap(prev => ({
              ...prev,
              [cap.name]: {
                status: "success",
                rec,
                conversation: [{
                  role: "assistant",
                  text: rec.text,
                  ts: rec.ts,
                  messageToken: rec.messageToken,
                  fromCache: rec.fromCache,
                }],
              },
            }));
          } catch (err) {
            if (cancelled) return;
            setMap(prev => ({
              ...prev,
              [cap.name]: {
                status: "error",
                conversation: [],
                error: err instanceof Error ? err.message : String(err),
              },
            }));
          }
        }),
      );

      if (cacheRef.current && !cancelled) {
        void cacheRef.current.flush();
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilities, enabled]);

  // ─── Follow-up sender ─────────────────────────────────────────────────
  const sendFollowUp = useCallback(async (capabilityName: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const cap = capabilitiesRef.current.find(c => c.name === capabilityName);
    if (!cap) return;

    // Quota guard
    const used = followUpCountRef.current[capabilityName] ?? 0;
    if (used >= MAX_FOLLOWUPS) {
      setMap(prev => ({
        ...prev,
        [capabilityName]: {
          ...(prev[capabilityName] ?? { status: "idle", conversation: [] }),
          status: "error",
          error: `Follow-up limit reached (max ${MAX_FOLLOWUPS} per capability per session).`,
        },
      }));
      return;
    }

    // Optimistically append the user turn + mark loading
    setMap(prev => {
      const current = prev[capabilityName] ?? { status: "idle" as const, conversation: [] };
      return {
        ...prev,
        [capabilityName]: {
          ...current,
          status: "loading",
          conversation: [
            ...current.conversation,
            { role: "user", text: trimmed, ts: Date.now() },
          ],
        },
      };
    });

    const previousState = stateRef.current[capabilityName];
    const rec = await getFollowUp(cap, trimmed, previousState);

    if (!rec) {
      setMap(prev => {
        const current = prev[capabilityName];
        if (!current) return prev;
        return {
          ...prev,
          [capabilityName]: {
            ...current,
            status: "error",
            error: "Davis CoPilot unavailable for this follow-up.",
          },
        };
      });
      return;
    }

    // Persist new state + bump counter
    stateRef.current[capabilityName] = rec.state;
    followUpCountRef.current[capabilityName] = used + 1;

    setMap(prev => {
      const current = prev[capabilityName];
      if (!current) return prev;
      return {
        ...prev,
        [capabilityName]: {
          ...current,
          status: "success",
          rec,
          error: undefined,
          conversation: [
            ...current.conversation,
            {
              role: "assistant",
              text: rec.text,
              ts: rec.ts,
              messageToken: rec.messageToken,
              fromCache: false,
            },
          ],
        },
      };
    });
  }, []);

  return { byCapability: map, sendFollowUp };
}
