// ui/app/components/TraceProxyBanner.tsx
//
// Visible disclosure that the assessment ran in Trace Proxy Mode — the
// tenant does not have the Traces on Grail entitlement, so span-based
// checks were either proxied from service metrics/topology or excluded.
//
// Same design contract as ScaleTierBanner: there is no scenario where a
// user should see proxied scores and not know it. Purely presentational.

import React from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Text, Strong } from '@dynatrace/strato-components/typography';
import Colors from '@dynatrace/strato-design-tokens/colors';
import type { TraceProxyInfo } from '../trace-proxy';
import { useTr } from '../i18n/lang';

interface TraceProxyBannerProps {
  /** Null when Trace Proxy Mode is off — banner renders nothing. */
  info: TraceProxyInfo | null;
  className?: string;
}

export const TraceProxyBanner: React.FC<TraceProxyBannerProps> = ({ info, className }) => {
  const tr = useTr();
  if (!info) return null;

  const excludedTotal = info.excludedIds.length;
  const capsList = info.excludedCapabilities.join(', ');
  const many = info.excludedCapabilities.length > 1;
  const capsNote = info.excludedCapabilities.length > 0
    ? ' ' + tr(
        `${capsList} ${many ? 'were' : 'was'} excluded entirely — it requires Traces on Grail.`,
        `${capsList} ${many ? 'foram excluídas' : 'foi excluída'} por completo — exige Traces on Grail.`,
        `${capsList} ${many ? 'se excluyeron' : 'se excluyó'} por completo — requiere Traces on Grail.`,
      )
    : '';

  return (
    <Surface
      className={className}
      style={{
        background: Colors.Background.Container.Warning.Default,
        borderLeft: `4px solid ${Colors.Border.Warning.Accent}`,
        padding: 12,
        marginBottom: 16,
        width: '100%',
      }}
    >
      <Flex flexDirection="column" gap={6}>
        <Flex gap={8} alignItems="baseline" flexWrap="wrap">
          <Strong>Trace Proxy Mode</Strong>
          <Text textStyle="small">{tr('Traces on Grail is not enabled on this environment', 'Traces on Grail não está habilitado neste ambiente', 'Traces on Grail no está habilitado en este entorno')}</Text>
        </Flex>
        <Text textStyle="small">
          {tr(
            `${info.proxiedIds.length} span-based checks were measured through service metrics and topology instead (marked “≈ proxy”); ${excludedTotal} checks have no honest equivalent and were removed from scoring — they do not count against this environment.`,
            `${info.proxiedIds.length} verificações baseadas em spans foram medidas por métricas de serviço e topologia (marcadas “≈ proxy”); ${excludedTotal} verificações não têm equivalente fiel e saíram da pontuação — não contam contra este ambiente.`,
            `${info.proxiedIds.length} comprobaciones basadas en spans se midieron con métricas de servicio y topología (marcadas “≈ proxy”); ${excludedTotal} comprobaciones no tienen un equivalente fiel y se quitaron de la puntuación — no cuentan en contra de este entorno.`,
          )}{capsNote}
        </Text>
      </Flex>
    </Surface>
  );
};
