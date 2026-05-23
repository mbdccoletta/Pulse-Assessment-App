// ui/app/components/DemoControlBar.tsx
//
// Footer band that lets the operator toggle Demo Mode with a single click and
// see — side by side — how the app would perform on a tenant at a different
// scale. Replaces the "open DevTools and run __pulseDemo('...')" workflow with
// something a customer-facing SE can use during a live demo.
//
// Behaviour summary ─────────────────────────────────────────────────────────
//   • Demo OFF → shows the current live tenant scale + a primary
//     "Simulate xLarge tenant" button (the headline use case) and a row of
//     chip-shaped buttons for each scenario.
//   • Demo ON  → shows the active scenario's narrative + a side-by-side
//     "what would this cost?" comparison + an "Exit demo" button.
//
// Why we reload on switch ───────────────────────────────────────────────────
// Toggling a scenario changes both the Scale Tier and the cached coverage
// results. Triggering a clean reload guarantees every consumer (radar
// animation, snapshot guard, entityCounts panel, ScaleTierBanner) reinitialises
// from the new scenario in a single step, instead of trying to thread fresh
// state through ~7 hooks mid-session.
//
// This component is pure presentation — it doesn't touch Grail and doesn't
// run any DQL itself. The only side effect is `setScenario(...)` which writes
// to localStorage via useDemoMode.

import React from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Text, Strong } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import Colors from '@dynatrace/strato-design-tokens/colors';
import { TIER_CONFIG } from '../scale-tier';
import type { DemoScenario } from '../demo/scenarios';

interface DemoControlBarProps {
  /** Full catalog (small-corp, medium-bank, xlarge-telco, xxlarge-cloud, ...). */
  catalog: DemoScenario[];
  /** The scenario currently active, or null when the app is in live mode. */
  activeScenario: DemoScenario | null;
  /** Setter from useDemoMode. We wrap it to force a reload after persistence
   *  so every hook reinitialises cleanly from the new state. */
  setScenario: (id: string | null) => void;
  /** Live host count from useScaleTier — only used to label the "real tenant"
   *  context line when not in demo. May be null briefly during detection. */
  liveHostCount: number | null;
  /** Live tenant identifier for the same purpose. */
  liveTenantName: string;
  /** Compact mode — render in a single horizontal row instead of the
   *  multi-row "rich" layout. Used on narrow screens. */
  isMobile?: boolean;
  /** Trigger a fresh assessment run (useCoverageData.refresh / .start).
   *  Optional — when omitted, the "Run + measure" button is hidden. */
  onRunTest?: () => void;
  /** True when a run completed and a downloadable report is available. */
  hasPerfReport?: boolean;
  /** Download the most recently captured perf report as JSON. Provided by
   *  useCoverageData; returns the filename used (for surfacing in a toast)
   *  or null when no report is captured yet. */
  onDownloadPerfReport?: () => string | null;
  /** Cache stats from the most recent run (queries served from 24h Doc
   *  Store cache vs Grail). Surfaced as a small badge so the operator can
   *  see at a glance whether the last run was cold or warm. */
  cacheStats?: {
    hits: number;
    misses: number;
    bytesSaved: number;
  } | null;
  /** Force-clear the 24h Doc Store cache before the next run. Optional;
   *  when omitted the "Force refresh" button is hidden. */
  onForceRefresh?: () => Promise<void> | void;
}

/** The scenario id we treat as "the" xLarge headline demo. Surfaced as the
 *  primary call-to-action button so the most common demo flow is one click. */
const FEATURED_SCENARIO_ID = 'xlarge-telco';

/** Wrap setScenario with a window.location.reload() so the whole React tree
 *  rebuilds from fresh state. Reload-on-toggle is intentional — see the
 *  "Why we reload on switch" comment at the top of this file. */
function activateAndReload(setScenario: (id: string | null) => void, id: string | null) {
  setScenario(id);
  // Defer reload so React commits the localStorage write before navigating.
  // Without this micro-task tick, Safari occasionally drops the write.
  if (typeof window !== 'undefined') {
    setTimeout(() => window.location.reload(), 30);
  }
}

/** Format a DPS dollar figure in a way that reads at a glance: <$1 → cents,
 *  >=$1 → dollars with no decimals. */
function formatDps(gb: number): string {
  const usd = gb * 0.01; // upper-bound estimate, matches the perf report
  if (usd < 0.5) return `~$${usd.toFixed(2)}`;
  if (usd < 100) return `~$${usd.toFixed(0)}`;
  return `~$${Math.round(usd / 10) * 10}`;
}

/** Pretty-print a GB figure: <1 GB → MB, <1024 GB → GB, else TB. */
function formatScan(gb: number): string {
  if (gb < 1) return `${Math.round(gb * 1024)} MB`;
  if (gb < 1024) return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`;
  return `${(gb / 1024).toFixed(1)} TB`;
}

export const DemoControlBar: React.FC<DemoControlBarProps> = ({
  catalog,
  activeScenario,
  setScenario,
  liveHostCount,
  liveTenantName,
  isMobile,
  onRunTest,
  hasPerfReport,
  onDownloadPerfReport,
  cacheStats,
  onForceRefresh,
}) => {
  const featured = catalog.find((s) => s.id === FEATURED_SCENARIO_ID) ?? null;
  // Track the last-downloaded filename so we can flash it next to the
  // Download button for a couple of seconds — gives the operator visual
  // confirmation without resorting to a toast.
  const [lastFilename, setLastFilename] = React.useState<string | null>(null);
  const handleDownload = React.useCallback(() => {
    if (!onDownloadPerfReport) return;
    const name = onDownloadPerfReport();
    if (name) {
      setLastFilename(name);
      // Clear the confirmation label after 4 seconds. Long enough to read,
      // short enough that it doesn't linger across navigations.
      window.setTimeout(() => setLastFilename(null), 4000);
    }
  }, [onDownloadPerfReport]);
  const handleForceRefresh = React.useCallback(async () => {
    if (!onForceRefresh) return;
    await onForceRefresh();
    // Then immediately trigger a run if we have one wired up — that's the
    // user's most likely intent when they hit this button.
    if (onRunTest) onRunTest();
  }, [onForceRefresh, onRunTest]);
  // Compact human-readable cache badge: "23/123 cached (0.5 GB saved)" or
  // "cold start" for the first run of the day. Hidden in demo mode (cache
  // is bypassed there and the numbers would always be 0).
  const cacheBadge = React.useMemo(() => {
    if (!cacheStats || activeScenario) return null;
    const total = cacheStats.hits + cacheStats.misses;
    if (total === 0) return null;
    if (cacheStats.hits === 0) return 'cold cache';
    const savedGB = cacheStats.bytesSaved / (1024 ** 3);
    const savedText = savedGB >= 1 ? `${savedGB.toFixed(1)} GB` : `${Math.round(savedGB * 1024)} MB`;
    return `${cacheStats.hits}/${total} cached (${savedText} saved)`;
  }, [cacheStats, activeScenario]);

  // ─── Demo OFF state ──────────────────────────────────────────────────
  if (!activeScenario) {
    const hostsLabel = liveHostCount != null && liveHostCount > 0
      ? `${liveHostCount.toLocaleString()} hosts`
      : 'unknown size';
    return (
      <Surface
        style={{
          background: Colors.Background.Container.Primary.Default,
          borderTop: `1px solid ${Colors.Border.Primary.Default}`,
          padding: isMobile ? '8px 12px' : '10px 20px',
          flexShrink: 0,
        }}
        aria-label="Performance simulation controls"
      >
        <Flex
          justifyContent="space-between"
          alignItems="center"
          gap={12}
          flexWrap="wrap"
        >
          <Flex gap={8} alignItems="baseline" flexWrap="wrap">
            <Text textStyle="small">
              🎭 <Strong>Performance simulation</Strong> · Real tenant: <Strong>{liveTenantName}</Strong> · {hostsLabel}
            </Text>
          </Flex>
          <Flex gap={6} alignItems="center" flexWrap="wrap">
            {/* Performance test controls — always visible so the operator can
                trigger a fresh run on the LIVE tenant and download the JSON
                without first stepping into a demo. Hidden in compact callers
                that don't expose onRunTest. */}
            {onRunTest && (
              <Button
                size="condensed"
                variant="default"
                onClick={onRunTest}
                aria-label="Run a fresh assessment and capture per-query perf metrics"
              >
                ▶ Run + measure
              </Button>
            )}
            {hasPerfReport && onDownloadPerfReport && (
              <Button
                size="condensed"
                variant="default"
                onClick={handleDownload}
                aria-label="Download performance report as JSON"
              >
                📥 Download perf JSON
              </Button>
            )}
            {onForceRefresh && (
              <Button
                size="condensed"
                variant="default"
                onClick={handleForceRefresh}
                aria-label="Clear 24h result cache and run a fresh assessment"
              >
                🗘 Force refresh
              </Button>
            )}
            {cacheBadge && (
              <Text textStyle="small" style={{ opacity: 0.8 }}>
                {cacheBadge}
              </Text>
            )}
            {lastFilename && (
              <Text textStyle="small" style={{ opacity: 0.8 }}>
                Saved: {lastFilename}
              </Text>
            )}
            {/* Headline CTA: one click → xLarge demo. Primary variant so it
                visually anchors the bar. */}
            {featured && (
              <Button
                variant="accent"
                color="primary"
                onClick={() => activateAndReload(setScenario, featured.id)}
                aria-label={`Simulate ${featured.label}`}
              >
                Simulate xLarge tenant ▶
              </Button>
            )}
            {/* Smaller chips for the other scenarios so the operator can pick
                any of them without opening DevTools. Featured one is already
                covered by the primary button above; show it here too for the
                muscle-memory case where someone scans the row left-to-right. */}
            {catalog.map((s) => (
              <Button
                key={s.id}
                size="condensed"
                variant="default"
                onClick={() => activateAndReload(setScenario, s.id)}
                aria-label={`Switch to scenario: ${s.label}`}
              >
                {s.id === featured?.id ? `★ ${TIER_CONFIG[s.tier].label}` : TIER_CONFIG[s.tier].label} · {s.hostCount.toLocaleString()}
              </Button>
            ))}
          </Flex>
        </Flex>
      </Surface>
    );
  }

  // ─── Demo ON state ───────────────────────────────────────────────────
  // Compute the "without Scale Tier" projection so users see the value of
  // the sampling layer. The Exact-tier full scan at the same host count
  // would scale approximately linearly with the host count vs. the bwm98081
  // baseline of ~122 GB at 54 hosts. We use the same 80k → 176 TB ratio
  // documented in PERFORMANCE-REPORT-80K-HOSTS.md (~2.2 GB scan per host).
  const projectedExactGB = (activeScenario.hostCount / 54) * 122; // upper-bound

  return (
    <Surface
      style={{
        background: Colors.Background.Container.Primary.Emphasized,
        borderTop: `2px solid ${Colors.Border.Primary.Accent}`,
        padding: isMobile ? '8px 12px' : '12px 20px',
        flexShrink: 0,
      }}
      aria-label="Active demo scenario controls"
    >
      <Flex flexDirection="column" gap={8}>
        <Flex
          justifyContent="space-between"
          alignItems="center"
          gap={12}
          flexWrap="wrap"
        >
          <Flex gap={8} alignItems="baseline" flexWrap="wrap">
            <Text textStyle="small">
              🎭 <Strong>Now simulating:</Strong> {activeScenario.label} · <Strong>{activeScenario.hostCount.toLocaleString()}</Strong> hosts · tier <Strong>{TIER_CONFIG[activeScenario.tier].label}</Strong>
            </Text>
          </Flex>
          <Flex gap={6} alignItems="center" flexWrap="wrap">
            {/* Same Run + Download controls as in the live state, but they
                operate on the demo run (the JSON will record demoActive:true
                and demoScenarioId so the analyzer can tell scripted entries
                apart from real measurements). */}
            {onRunTest && (
              <Button
                size="condensed"
                variant="default"
                onClick={onRunTest}
                aria-label="Replay this scenario and capture per-query perf metrics"
              >
                ▶ Run + measure
              </Button>
            )}
            {hasPerfReport && onDownloadPerfReport && (
              <Button
                size="condensed"
                variant="default"
                onClick={handleDownload}
                aria-label="Download performance report as JSON"
              >
                📥 Download perf JSON
              </Button>
            )}
            {onForceRefresh && (
              <Button
                size="condensed"
                variant="default"
                onClick={handleForceRefresh}
                aria-label="Clear 24h result cache and run a fresh assessment"
              >
                🗘 Force refresh
              </Button>
            )}
            {cacheBadge && (
              <Text textStyle="small" style={{ opacity: 0.8 }}>
                {cacheBadge}
              </Text>
            )}
            {lastFilename && (
              <Text textStyle="small" style={{ opacity: 0.8 }}>
                Saved: {lastFilename}
              </Text>
            )}
            {catalog.map((s) => (
              <Button
                key={s.id}
                size="condensed"
                variant={s.id === activeScenario.id ? 'accent' : 'default'}
                onClick={() => {
                  if (s.id === activeScenario.id) return;
                  activateAndReload(setScenario, s.id);
                }}
                aria-pressed={s.id === activeScenario.id}
                aria-label={`Switch to scenario: ${s.label}`}
              >
                {TIER_CONFIG[s.tier].label} · {s.hostCount.toLocaleString()}
              </Button>
            ))}
            <Button
              variant="default"
              onClick={() => activateAndReload(setScenario, null)}
              aria-label="Exit demo and return to live data"
            >
              ← Exit demo
            </Button>
          </Flex>
        </Flex>

        {/* Performance comparison strip. This is the "analyze performance"
            payoff for the operator: it shows the headline cost number AND
            what the cost would have been WITHOUT the Scale Tier sampling. */}
        <Flex
          gap={isMobile ? 8 : 24}
          flexWrap="wrap"
          style={{
            padding: '6px 8px',
            borderRadius: 4,
            background: Colors.Background.Surface.Default,
          }}
        >
          <Flex flexDirection="column" gap={2} style={{ minWidth: 140 }}>
            <Text textStyle="small">
              <Strong>With Scale Tier</Strong> (current)
            </Text>
            <Text textStyle="small">
              {formatScan(activeScenario.simulatedScanGB)} scanned · {formatDps(activeScenario.simulatedScanGB)} · ~{(activeScenario.simulatedWallTimeMs / 1000).toFixed(1)} s
            </Text>
          </Flex>
          <Flex flexDirection="column" gap={2} style={{ minWidth: 140 }}>
            <Text textStyle="small">
              <Strong>Without Scale Tier</Strong> (full scan)
            </Text>
            <Text textStyle="small">
              {formatScan(projectedExactGB)} scanned · {formatDps(projectedExactGB)} · would likely timeout
            </Text>
          </Flex>
          <Flex flexDirection="column" gap={2} style={{ minWidth: 140 }}>
            <Text textStyle="small">
              <Strong>Savings</Strong>
            </Text>
            <Text textStyle="small">
              {Math.round((1 - activeScenario.simulatedScanGB / projectedExactGB) * 1000) / 10}% DPS · same coverage shape · sampled estimate
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </Surface>
  );
};
