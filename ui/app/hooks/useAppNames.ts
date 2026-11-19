// ui/app/hooks/useAppNames.ts
//
// Real app names from the AppEngine registry ("dynatrace.genai.observability"
// → "AI Observability"), so screens show what people see in the launcher.
// One request per session; on any failure callers fall back to a name
// derived from the id.

import { useEffect, useState } from "react";
import { prettyAppName } from "../data/appCapabilityMap";

let cache: Record<string, string> | null = null;
let inFlight: Promise<Record<string, string>> | null = null;

async function load(): Promise<Record<string, string>> {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const r = await fetch("/platform/app-engine/registry/v1/apps?page-size=1000");
        if (!r.ok) return {};
        const j = (await r.json()) as { apps?: { id: string; name?: string }[] };
        const out: Record<string, string> = {};
        for (const a of j.apps ?? []) if (a.id && a.name) out[a.id] = a.name;
        return out;
      } catch {
        return {};
      }
    })().then(m => { cache = m; return m; });
  }
  return inFlight;
}

/** Ids of every installed app (empty until the registry answers). */
export function useInstalledApps(): string[] {
  const [ids, setIds] = useState<string[]>(cache ? Object.keys(cache) : []);
  useEffect(() => {
    let alive = true;
    load().then(m => { if (alive) setIds(Object.keys(m)); });
    return () => { alive = false; };
  }, []);
  return ids;
}

/** Returns a resolver: app id → the app's real name (or a readable fallback). */
export function useAppNames(): (appId: string) => string {
  const [names, setNames] = useState<Record<string, string>>(cache ?? {});
  useEffect(() => {
    let alive = true;
    load().then(m => { if (alive) setNames(m); });
    return () => { alive = false; };
  }, []);
  return (appId: string) => names[appId] ?? prettyAppName(appId);
}
