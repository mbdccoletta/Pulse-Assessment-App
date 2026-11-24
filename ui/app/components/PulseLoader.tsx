// ui/app/components/PulseLoader.tsx
//
// The loading state of Pulse Assessment: an electrocardiogram trace with a
// pulse running along it while the assessment is reading the environment.
// Motion here is telemetry, not decoration: it runs only while queries are in
// flight and stops with them. Reduced motion shows the trace still.

import React from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text } from "@dynatrace/strato-components/typography";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { useTr } from "../i18n/lang";

/** One heartbeat in a 100-wide cell: baseline, P wave, QRS spike, T wave. */
const BEAT = "l18 0 l6 -6 l6 6 l8 0 l4 6 l6 -38 l6 46 l4 -14 l8 0 l8 -9 l8 9 l18 0";
const BEATS = 3;
const WIDTH = 100 * BEATS;
const PATH = `M0 30 ${Array.from({ length: BEATS }, () => BEAT).join(" ")}`;
/** Length of the trace, close enough for the dash animation (sum of segments). */
const LENGTH = 600;

const CSS = `
.pl-run { stroke-dasharray: 90 ${LENGTH * 2}; animation: pl-sweep 2.4s linear infinite; }
@keyframes pl-sweep { from { stroke-dashoffset: 90; } to { stroke-dashoffset: -${LENGTH}; } }
@media (prefers-reduced-motion: reduce) { .pl-run { animation: none; stroke-dasharray: none; opacity: .9; } }
`;

interface Props {
  /** 0–100 when the share of queries done is known; omitted while it is not. */
  value?: number;
  label?: string;
}

export const PulseLoader: React.FC<Props> = ({ value, label: labelProp }) => {
  const tr = useTr();
  const label = labelProp ?? tr("Assessing the environment", "Avaliando o ambiente", "Evaluando el entorno");
  const known = typeof value === "number" && value > 0;
  const pct = known ? Math.floor(value as number) : undefined;
  return (
    <Flex flexDirection="column" alignItems="center" gap={12}
      role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
      style={{ width: "min(420px, 100%)" }}>
      <style>{CSS}</style>
      <svg viewBox={`0 0 ${WIDTH} 60`} width="100%" height={72} preserveAspectRatio="none" aria-hidden="true">
        <path d={PATH} fill="none" stroke={Colors.Border.Neutral.Default} strokeWidth={1.5}
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path className="pl-run" d={PATH} fill="none" stroke={Colors.Text.Primary.Default} strokeWidth={2.5}
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <Flex alignItems="baseline" gap={8}>
        <Text textStyle="base-emphasized">{label}</Text>
        {pct != null && (
          <Text style={{ fontFamily: "var(--dt-typography-code-base-default-family, 'Roboto Mono', monospace)", fontVariantNumeric: "tabular-nums", color: Colors.Text.Neutral.Subdued }}>
            {pct}%
          </Text>
        )}
      </Flex>
    </Flex>
  );
};
