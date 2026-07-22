// ui/app/hooks/useOwnershipTeams.ts
//
// Official Dynatrace Ownership teams.
//
// Teams in Dynatrace are defined under Settings > Ownership > Teams
// (settings schema `builtin:ownership.teams`) and referenced on entities
// via the `dt.owner` tag / ownership metadata. This hook reads those
// official team definitions through the Settings API v2 so the Projects
// page offers the tenant's REAL teams instead of free text.
//
// Requires scope: settings:objects:read.
// Degrades silently: on 403 / empty tenant the list is just empty and the
// UI falls back to a free-text field.

import { useEffect, useState } from "react";
import { settingsObjectsClient } from "@dynatrace-sdk/client-classic-environment-v2";

export interface OwnershipTeam {
  /** Settings object id (stable reference). */
  objectId: string;
  /** Team identifier — the value used in dt.owner tags. */
  identifier: string;
  /** Display name. */
  name: string;
  description?: string;
}

interface TeamValue {
  name?: string;
  identifier?: string;
  description?: string;
}

export interface UseOwnershipTeamsResult {
  teams: OwnershipTeam[];
  /** null = still loading; false = loaded (possibly empty); true only during fetch. */
  loading: boolean;
  /** Set when the fetch failed (e.g. missing scope) — UI shows fallback. */
  error: string | null;
}

export function useOwnershipTeams(active: boolean): UseOwnershipTeamsResult {
  const [teams, setTeams] = useState<OwnershipTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!active || started) return;
    setStarted(true);
    let cancelled = false;
    (async () => {
      try {
        const collected: OwnershipTeam[] = [];
        let nextPageKey: string | undefined = undefined;
        // Ownership team lists are small; loop defensively over pages anyway.
        for (let page = 0; page < 10; page++) {
          const res: Awaited<ReturnType<typeof settingsObjectsClient.getSettingsObjects>> =
            nextPageKey
              ? await settingsObjectsClient.getSettingsObjects({ nextPageKey })
              : await settingsObjectsClient.getSettingsObjects({
                  schemaIds: "builtin:ownership.teams",
                  fields: "objectId,value",
                  pageSize: 500,
                });
          for (const item of res.items ?? []) {
            const v = item.value as TeamValue | undefined;
            if (v?.name && v?.identifier) {
              collected.push({
                objectId: item.objectId ?? v.identifier,
                identifier: v.identifier,
                name: v.name,
                description: v.description,
              });
            }
          }
          nextPageKey = res.nextPageKey ?? undefined;
          if (!nextPageKey) break;
        }
        if (!cancelled) {
          collected.sort((a, b) => a.name.localeCompare(b.name));
          setTeams(collected);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[useOwnershipTeams] fetch failed (falling back to free text):", err);
        if (!cancelled) setError("Could not load Ownership teams (missing settings:objects:read or none defined).");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [active, started]);

  return { teams, loading, error };
}
