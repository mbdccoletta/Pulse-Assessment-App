// ui/app/components/ScaleTierBanner.tsx
//
// Visible disclosure that the assessment is running in a sampled tier.
//
// Why a banner ────────────────────────────────────────────────────────────
// The Scale Tier mechanism (see ../scale-tier.ts) narrows the time window
// and applies scanLimitGBytes safety nets on log/span/event/bizevent
// queries so the app remains runnable on tenants with thousands of hosts.
// In doing so, coverage values become *estimates* rather than ground truth.
// This banner makes that tradeoff visible to every viewer of the dashboard,
// PDF export and snapshot — there is no scenario where a user should see
// a sampled score and not know it.
//
// Behavior ────────────────────────────────────────────────────────────────
//   - Hidden entirely when tier === 'exact' (no behavior change for tenants
//     ≤ 5,000 hosts; presentation layer is bit-identical to v2.4.2).
//   - Yellow ish surface + Strato semantic color for "neutral / informational
//     warning". Does not block interaction.
//   - Optional override dropdown lets an operator force a specific tier
//     (e.g., switch to 'exact' on a 60k-host tenant to get ground-truth
//     numbers at the cost of wall-time).
//
// This component is purely presentational. It does not query Grail; it
// only renders what useScaleTier reports.

import React from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Text, Strong } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import Colors from '@dynatrace/strato-design-tokens/colors';
import { TIER_CONFIG, type ScaleTier } from '../scale-tier';
import type { UseScaleTierResult } from '../hooks/useScaleTier';
import type { DemoScenario } from '../demo/scenarios';

interface ScaleTierBannerProps {
  scale: UseScaleTierResult;
  /** When non-null, the banner switches to "demo mode" styling and surfaces
   *  the scenario narrative. Tier-switch buttons are disabled because the
   *  scenario's coverage values are pre-baked for a specific tier. */
  demoScenario?: DemoScenario | null;
  /** Optional className passthrough for the host page layout. */
  className?: string;
}

const TIER_ORDER: ScaleTier[] = ['exact', 'large', 'xlarge'];

export const ScaleTierBanner: React.FC<ScaleTierBannerProps> = ({ scale, demoScenario, className }) => {
  // Demo mode takes precedence: it always renders, even at 'exact' tier, so the
  // operator (and any customer in the room) can see clearly that the figures
  // on screen are scripted rather than measured.
  if (demoScenario) {
    return (
      <Surface
        className={className}
        style={{
          // Magenta/purple is intentionally distinct from the Warning yellow
          // used for the real Scale Tier banner. Operators glancing at a
          // screenshot should never confuse a demo with a real run.
          background: Colors.Background.Container.Primary.Default,
          borderLeft: `4px solid ${Colors.Border.Primary.Accent}`,
          padding: 12,
          marginBottom: 16,
          width: '100%',
        }}
        aria-label="Demo mode active"
      >
        <Flex flexDirection="column" gap={6}>
          <Flex justifyContent="space-between" alignItems="center" gap={12} flexWrap="wrap">
            <Flex gap={8} alignItems="baseline">
              <Strong>🎭 DEMO: {demoScenario.label}</Strong>
              <Text textStyle="small">
                {demoScenario.hostCount.toLocaleString()} hosts · tier {TIER_CONFIG[demoScenario.tier].label} · 0 DPS consumed
              </Text>
            </Flex>
          </Flex>
          <Text textStyle="small">{demoScenario.narrative}</Text>
          <Text textStyle="small" style={{ opacity: 0.7 }}>
            Coverage values are scripted for this scenario. Exit demo by clearing the URL <Strong>?demo=</Strong> param or running <Strong>__pulseDemo(null)</Strong> in the console.
          </Text>
        </Flex>
      </Surface>
    );
  }

  // Default tier is invisible — the goal is zero presentation impact for the
  // common case (small/medium tenants). Above-threshold tenants get the disclosure.
  if (scale.tier === 'exact') return null;

  const cfg = TIER_CONFIG[scale.tier];
  const isOverridden = scale.override !== null && scale.override !== scale.autoTier;
  const hostLabel =
    scale.hostCount != null && scale.hostCount > 0
      ? `${scale.hostCount.toLocaleString()} hosts detected`
      : 'host count unavailable';

  return (
    <Surface
      className={className}
      style={{
        // Strato's Background.Container.Warning gives the conventional yellow
        // tone for "informational, not blocking". A heavier border on the left
        // signals that this is a banner, not a regular card.
        background: Colors.Background.Container.Warning.Default,
        borderLeft: `4px solid ${Colors.Border.Warning.Accent}`,
        padding: 12,
        marginBottom: 16,
        width: '100%',
      }}
    >
      <Flex flexDirection="column" gap={6}>
        <Flex justifyContent="space-between" alignItems="center" gap={12} flexWrap="wrap">
          <Flex gap={8} alignItems="baseline">
            <Strong>Scale tier: {cfg.label}</Strong>
            <Text textStyle="small">
              {hostLabel}
              {isOverridden ? ' · manual override' : ' · auto-selected'}
            </Text>
          </Flex>
          <Flex gap={4}>
            {TIER_ORDER.map((t) => (
              <Button
                key={t}
                size="condensed"
                variant={t === scale.tier ? 'accent' : 'default'}
                onClick={() => scale.setOverride(t === scale.autoTier ? null : t)}
                aria-pressed={t === scale.tier}
                aria-label={`Switch to ${TIER_CONFIG[t].label} tier`}
              >
                {TIER_CONFIG[t].label}
              </Button>
            ))}
          </Flex>
        </Flex>
        <Text textStyle="small">{cfg.description}</Text>
      </Flex>
    </Surface>
  );
};
