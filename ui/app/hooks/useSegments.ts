// ui/app/hooks/useSegments.ts
//
// Official Dynatrace platform Segments.
//
// Segments are the platform mechanism for scoping data (Grail filter
// segments, managed in the Segments app and consumed across apps/DQL).
// The Projects page lets a declared project be identified by a Segment so
// its plan and deliverables are scoped the same way the customer already
// slices their environment (per team, per business unit, per app).
//
// Read via @dynatrace-sdk/client-filter-segment-management
// (filterSegmentsClient.getLeanFilterSegments). Requires scope
// storage:filter-segments:read. Degrades silently to an empty list.

import { useEffect, useState } from "react";
import { filterSegmentsClient } from "@dynatrace-sdk/client-filter-segment-management";

export interface PlatformSegment {
  /** Unique identifier of the filter-segment. */
  uid: string;
  name: string;
  isPublic?: boolean;
  owner?: string;
}

export interface UseSegmentsResult {
  segments: PlatformSegment[];
  loading: boolean;
  error: string | null;
}

export function useSegments(active: boolean): UseSegmentsResult {
  const [segments, setSegments] = useState<PlatformSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!active || started) return;
    setStarted(true);
    let cancelled = false;
    (async () => {
      try {
        const res = await filterSegmentsClient.getLeanFilterSegments({ addFields: ["OWNER"] });
        if (!cancelled) {
          const list = (res.filterSegments ?? [])
            .map(s => ({ uid: s.uid, name: s.name, isPublic: s.isPublic, owner: s.owner }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setSegments(list);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[useSegments] fetch failed (segment picker hidden):", err);
        if (!cancelled) setError("Could not load Segments (missing storage:filter-segments:read or none defined).");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [active, started]);

  return { segments, loading, error };
}
