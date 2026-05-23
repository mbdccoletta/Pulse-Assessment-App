// ui/app/demo/useDemoMode.ts
//
// Tells the rest of the app whether we're running in a canned demo scenario
// instead of a real Grail-backed assessment. See ./scenarios.ts for the
// scenario catalog and ../../docs/DEMO-MODE.md for the operator guide.
//
// Activation precedence (highest wins) ───────────────────────────────────
//   1. URL query parameter        — ?demo=<id>     (per-tab, no persistence)
//   2. localStorage 'cca.demo.scenario' — sticky across reloads/tabs
//   3. window.__pulseDemo('<id>') — console helper, writes localStorage + reloads
//
// Why three mechanisms ───────────────────────────────────────────────────
// URL param is the canonical way to share a demo link with a colleague.
// localStorage is the sticky path for "I want to keep showing this scenario
// across reloads while iterating." The console helper exists because customer
// demos happen in shared Dynatrace tenants where typing in localStorage is
// faster than fiddling with URLs.
//
// Important ──────────────────────────────────────────────────────────────
// This hook is intentionally a thin reader. It does NOT mutate the URL.
// Consumers (useCoverageData, useScaleTier, banner) only read scenario via
// `scenario`; the live path is taken whenever scenario is null.

import { useEffect, useState } from 'react';
import { findScenario, DEMO_SCENARIOS, type DemoScenario } from './scenarios';

const STORAGE_KEY = 'cca.demo.scenario';
const URL_PARAM = 'demo';

function readUrlParam(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get(URL_PARAM);
  } catch {
    return null;
  }
}

function readStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode / quota — silent */
  }
}

function resolveActiveId(): string | null {
  // URL param wins over localStorage so a shared link is always honored even
  // if the recipient has a different scenario stuck in localStorage.
  return readUrlParam() ?? readStorage();
}

export interface UseDemoModeResult {
  /** Resolved scenario, or null when not in demo mode. */
  scenario: DemoScenario | null;
  /** Convenience: scenario !== null. */
  isDemo: boolean;
  /** Set or clear the active scenario (persists to localStorage). */
  setScenario: (id: string | null) => void;
  /** Catalog of available scenarios — for a future demo-picker menu. */
  catalog: typeof DEMO_SCENARIOS;
}

export function useDemoMode(): UseDemoModeResult {
  // Resolve once on mount. We deliberately do NOT subscribe to URL changes —
  // demo activation typically happens on initial load. Switching scenarios
  // mid-session goes through setScenario(), which reloads anyway to ensure
  // the rest of the app picks up the new state cleanly.
  const [activeId, setActiveId] = useState<string | null>(() => resolveActiveId());

  // Register the console helper exactly once, regardless of how many places
  // call this hook. The check on window is intentional: SSR safety.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as { __pulseDemo?: (id?: string | null) => void };
    if (w.__pulseDemo) return; // already installed
    w.__pulseDemo = (id?: string | null) => {
      if (id === undefined) {
        // No arg → list catalog
        // eslint-disable-next-line no-console
        console.log(
          '[Pulse demo] Available scenarios:\n' +
            DEMO_SCENARIOS.map((s) => `  • ${s.id}\t— ${s.label}`).join('\n') +
            "\n\nUse: __pulseDemo('<id>')  or  __pulseDemo(null) to clear.",
        );
        return;
      }
      if (id === null) {
        writeStorage(null);
        // eslint-disable-next-line no-console
        console.log('[Pulse demo] Cleared. Reloading…');
        window.location.reload();
        return;
      }
      if (!findScenario(id)) {
        // eslint-disable-next-line no-console
        console.warn(`[Pulse demo] Unknown scenario '${id}'. Try __pulseDemo() to list.`);
        return;
      }
      writeStorage(id);
      // eslint-disable-next-line no-console
      console.log(`[Pulse demo] Activated '${id}'. Reloading…`);
      window.location.reload();
    };
  }, []);

  const setScenario = (id: string | null) => {
    writeStorage(id);
    setActiveId(id);
  };

  const scenario = findScenario(activeId);
  return {
    scenario,
    isDemo: scenario !== null,
    setScenario,
    catalog: DEMO_SCENARIOS,
  };
}
