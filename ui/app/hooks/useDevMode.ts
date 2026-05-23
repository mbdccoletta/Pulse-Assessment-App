// ui/app/hooks/useDevMode.ts
//
// Tells the UI whether to expose developer / SE controls (Demo Mode chips,
// Force-refresh, perf-JSON download, scale-tier-override buttons).
//
// Production posture ─────────────────────────────────────────────────────
// A customer tenant should NEVER see the magenta "🎭 Performance
// simulation" footer bar — that's an internal SE diagnostic surface. The
// production-default app is the radar + cards + the (auto-detected) Scale
// Tier Banner only.
//
// Activation paths (any one is enough; URL param wins) ───────────────────
//   1. `?dev=1` query param                  — one-tab, shareable
//   2. `localStorage.cca.dev = '1'`          — sticky on this browser
//   3. An active demo scenario (`?demo=...`) — shareable demo links keep
//      working because operators presenting a demo absolutely need the
//      tier-switch / exit-demo controls
//
// SEs can also bypass entirely via console (`__pulseDemo('xlarge-telco')`
// from useDemoMode.ts) — that triggers a reload with the demo scenario
// active, which in turn flips this hook to true via path (3).
//
// Why a tiny hook rather than a global ─────────────────────────────────
// Two reasons: (a) React components that consume it re-render on any
// future "toggle dev mode at runtime" feature; (b) the hook is the right
// place to also lazily check window/localStorage with the SSR-safety
// guards that the rest of the app uses elsewhere.

import { useState } from 'react';

const STORAGE_KEY = 'cca.dev';
const URL_PARAM = 'dev';

function readUrlFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = new URLSearchParams(window.location.search).get(URL_PARAM);
    return v === '1' || v === 'true' || v === 'yes';
  } catch {
    return false;
  }
}

function readStorageFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === '1' || v === 'true' || v === 'yes';
  } catch {
    return false;
  }
}

export interface UseDevModeResult {
  /** True when demo / diagnostic controls should be visible. */
  isDev: boolean;
}

/**
 * @param demoActive  When the parent already knows a demo scenario is
 *                    active, pass true so the dev flag is forced on
 *                    regardless of URL/localStorage. Otherwise the
 *                    "shared demo link" workflow would render a broken
 *                    UI (banner visible but no tier-switch controls).
 */
export function useDevMode(demoActive = false): UseDevModeResult {
  // Resolved once on mount. The flag is sticky for the session lifetime
  // because dev controls aren't worth re-rendering everything for.
  const [isDev] = useState<boolean>(() => {
    if (demoActive) return true;
    return readUrlFlag() || readStorageFlag();
  });
  return { isDev };
}
