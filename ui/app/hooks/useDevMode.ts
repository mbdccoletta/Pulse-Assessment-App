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

/** True when the app is being served from the local dev server.
 *
 *  `dt-app dev` serves the app bundle from http://localhost:<port>/ui and
 *  loads it inside the Dynatrace local-dev-server iframe. Inside that
 *  iframe, window.location.hostname is "localhost" (or 127.0.0.1). A
 *  DEPLOYED app is always served from <tenant>.apps.dynatrace.com, which
 *  never matches localhost — so this is a safe, automatic proxy for
 *  "running locally for SE testing". It means the SE never has to set
 *  ?dev=1 or localStorage by hand, and customers can never trip it. */
function isLocalDevServer(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  } catch {
    return false;
  }
}

/** Non-hook variant for modules that need the dev answer outside React
 *  (e.g., usePreflight's simulated-entitlement guard). Same three paths
 *  as the hook, evaluated at call time. */
export function isDevEnvironment(): boolean {
  return isLocalDevServer() || readUrlFlag() || readStorageFlag();
}

export interface UseDevModeResult {
  /** True when diagnostic controls should be visible. */
  isDev: boolean;
}

export function useDevMode(): UseDevModeResult {
  // Resolved once on mount. The flag is sticky for the session lifetime
  // because dev controls aren't worth re-rendering everything for.
  //
  // Three independent activation paths (any one is enough):
  //   1. running on the local dev server  → automatic, zero setup
  //   2. ?dev=1 in the URL                 → shareable one-off
  //   3. localStorage.cca.dev              → sticky on this browser
  // A deployed customer tenant matches none of these, so the diagnostic
  // + Davis Assist surface stays hidden in production.
  const [isDev] = useState<boolean>(() =>
    isLocalDevServer() || readUrlFlag() || readStorageFlag()
  );
  return { isDev };
}
