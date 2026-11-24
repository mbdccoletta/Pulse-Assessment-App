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
import { TIER_CONFIG, tierDescription, type ScaleTier } from '../scale-tier';
import type { UseScaleTierResult } from '../hooks/useScaleTier';
import { tr, useLang, localeTag, type PulseLang } from '../i18n/lang';

interface ScaleTierBannerProps {
  scale: UseScaleTierResult;
  /** Optional className passthrough for the host page layout. */
  className?: string;
}

const TIER_ORDER: ScaleTier[] = ['exact', 'large', 'xlarge'];

/** Cost mode runs at every tier, so its disclosure cannot live inside the
 *  tier banner (which hides itself on 'exact'). It is a single quiet line —
 *  the numbers are estimates and everyone reading a score should know it. */
/** What economy mode does, in one place. Shown as a tooltip on the toolbar
 *  chip (labels and numbers on screen, explanations in tooltips). The old
 *  banner promised "~370 GB to ~41 GB"; a real tenant scanned 453 GB with
 *  the mode on, so the text no longer quotes a saving it cannot guarantee. */
export const COST_MODE_TEXT =
  'Criteria read Dynatrace metrics and Smartscape wherever they answer the question. ' +
  'Ratio checks on logs and events read a 1-in-1000 sample; breadth checks read 15 minutes; ' +
  'AI checks read 4 hours unsampled; criteria over the same records share one read. ' +
  'Every read stops at 50 GB, and a value it cuts shows with ≈.';

/** COST_MODE_TEXT in the given language. */
export const costModeText = (lang: PulseLang): string => tr(lang,
  COST_MODE_TEXT,
  'Os critérios leem métricas do Dynatrace e o Smartscape sempre que respondem à pergunta. ' +
  'Verificações de proporção em logs e eventos leem uma amostra de 1 em 1000; verificações de abrangência leem 15 minutos; ' +
  'verificações de AI leem 4 horas sem amostragem; critérios sobre os mesmos registros compartilham uma leitura. ' +
  'Toda leitura para em 50 GB, e um valor cortado aparece com ≈.',
  'Los criterios leen métricas de Dynatrace y Smartscape siempre que responden a la pregunta. ' +
  'Las comprobaciones de proporción en logs y eventos leen una muestra de 1 en 1000; las de amplitud leen 15 minutos; ' +
  'las comprobaciones de AI leen 4 horas sin muestreo; los criterios sobre los mismos registros comparten una lectura. ' +
  'Toda lectura se detiene en 50 GB, y un valor recortado aparece con ≈.',
);

export const CostModeNote: React.FC<{ className?: string }> = ({ className }) => {
  const lang = useLang();
  return (
  <Text
    className={className}
    textStyle="small"
    style={{ color: Colors.Text.Neutral.Subdued, display: 'block', marginBottom: 8 }}
  >
    {costModeText(lang)}
  </Text>
  );
};

export const ScaleTierBanner: React.FC<ScaleTierBannerProps> = ({ scale, className }) => {
  const lang = useLang();
  // Default tier is invisible — the goal is zero presentation impact for the
  // common case (small/medium tenants). Above-threshold tenants get the disclosure.
  // Exact tier: nothing to choose, so no banner — the toolbar chip carries
  // the economy-mode disclosure.
  if (scale.tier === 'exact') return null;

  const cfg = TIER_CONFIG[scale.tier];
  const isOverridden = scale.override !== null && scale.override !== scale.autoTier;
  const hostLabel =
    scale.hostCount != null && scale.hostCount > 0
      ? tr(lang, `${scale.hostCount.toLocaleString(localeTag(lang))} hosts detected`, `${scale.hostCount.toLocaleString(localeTag(lang))} hosts detectados`, `${scale.hostCount.toLocaleString(localeTag(lang))} hosts detectados`)
      : tr(lang, 'host count unavailable', 'contagem de hosts indisponível', 'recuento de hosts no disponible');

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
            <Strong>{tr(lang, 'Scale tier', 'Nível de escala', 'Nivel de escala')}: {cfg.label}</Strong>
            <Text textStyle="small">
              {hostLabel}
              {isOverridden ? tr(lang, ' · manual override', ' · seleção manual', ' · selección manual') : tr(lang, ' · auto-selected', ' · seleção automática', ' · selección automática')}
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
                aria-label={tr(lang, `Switch to ${TIER_CONFIG[t].label} tier`, `Mudar para o nível ${TIER_CONFIG[t].label}`, `Cambiar al nivel ${TIER_CONFIG[t].label}`)}
              >
                {TIER_CONFIG[t].label}
              </Button>
            ))}
          </Flex>
        </Flex>
        <Text textStyle="small">{tierDescription(scale.tier, lang)}</Text>
        <CostModeNote />
      </Flex>
    </Surface>
  );
};
