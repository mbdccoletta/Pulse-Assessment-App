import React, { useState, useCallback } from "react";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text, Strong } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { CAPABILITIES } from "../queries";

interface Props {
  consolidation: Record<string, number>;
  onApply: (factors: Record<string, number>) => void;
  dk: boolean;
  text: string;
  textSec: string;
  accent: string;
  border: string;
  excludedCaps: Set<string>;
}

export const ConsolidationPanel: React.FC<Props> = React.memo(function ConsolidationPanel({ consolidation, onApply, dk, text, textSec, accent, border, excludedCaps }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>(() => ({ ...consolidation }));

  const handleSliderChange = useCallback((capName: string, value: number) => {
    setDraft(prev => ({ ...prev, [capName]: value }));
  }, []);

  const handleApply = useCallback(() => {
    onApply(draft);
  }, [draft, onApply]);

  const handleReset = useCallback(() => {
    const empty: Record<string, number> = {};
    setDraft(empty);
    onApply(empty);
  }, [onApply]);

  const hasAnyCustom = Object.values(draft).some(v => v < 100);
  const activeCaps = CAPABILITIES.filter(c => !excludedCaps.has(c.name));

  if (!open) {
    return (
      <Flex flexDirection="column" style={{ marginBottom: 16, width: "100%", maxWidth: 340 }}>
        <Flex flexDirection="column"
          onClick={() => setOpen(true)}
          style={{
            cursor: "pointer", padding: "10px 16px", borderRadius: 8,
            background: hasAnyCustom
              ? (dk ? "rgba(255,170,50,0.12)" : "rgba(255,170,50,0.08)")
              : (dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"),
            border: `1px solid ${hasAnyCustom ? Colors.Border.Warning.Default : border}`,
            transition: "all 0.2s",
          }}
        >
          <Flex alignItems="center" justifyContent="space-between">
            <Text style={{ fontSize: 12, fontWeight: 700, color: hasAnyCustom ? Colors.Text.Warning.Default : accent }}>
              {hasAnyCustom ? "Consolidation Context Active" : "Consolidation Context"}
            </Text>
            <Flex alignItems="center" gap={4}>
              {hasAnyCustom && (
                <Text style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                  background: Colors.Background.Container.Warning.Default,
                  color: Colors.Text.Warning.Default,
                }}>Active</Text>
              )}
              <Text style={{ fontSize: 10, color: textSec }}>▼</Text>
            </Flex>
          </Flex>
          <Text style={{ fontSize: 11, color: textSec, lineHeight: 1.5, marginTop: 4 }}>
            {hasAnyCustom
              ? "Scores are adjusted to reflect data split across multiple tools."
              : "Is the client using other tools? Adjust scores to reflect how much data is already in Dynatrace."}
          </Text>
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex flexDirection="column" style={{
      marginBottom: 16, width: "100%", maxWidth: 340, borderRadius: 10,
      background: dk ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.03)",
      border: `1px solid ${hasAnyCustom ? Colors.Border.Warning.Default : border}`,
      overflow: "hidden",
    }}>
      {/* Header */}
      <Flex
        alignItems="center" justifyContent="space-between"
        style={{
          padding: "10px 16px", cursor: "pointer",
          borderBottom: `1px solid ${border}`,
        }}
        onClick={() => setOpen(false)}
      >
        <Flex alignItems="center" gap={6}>
          <Text style={{ fontSize: 12, fontWeight: 700, color: accent }}>Consolidation Context</Text>
          {hasAnyCustom && (
            <Text style={{
              fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
              background: Colors.Background.Container.Warning.Default,
              color: Colors.Text.Warning.Default,
            }}>Active</Text>
          )}
        </Flex>
        <Text style={{ fontSize: 10, color: textSec, transform: "rotate(180deg)" }}>▼</Text>
      </Flex>

      {/* Description */}
      <Flex flexDirection="column" style={{ padding: "8px 16px 4px", fontSize: 11, color: textSec, lineHeight: 1.6 }}>
        <Text>
          What <Strong style={{ color: text }}>% of the client's total observability volume</Strong> is already in Dynatrace?
          This adjusts scores to reflect real-world coverage when data is split across tools.
        </Text>
      </Flex>

      {/* Sliders */}
      <Flex flexDirection="column" style={{ padding: "8px 16px 12px" }} gap={8}>
        {activeCaps.map(cap => {
          const value = draft[cap.name] ?? 100;
          const isCustom = value < 100;
          return (
            <Flex key={cap.name} flexDirection="column" gap={2}>
              <Flex alignItems="center" justifyContent="space-between">
                <Flex alignItems="center" gap={6}>
                  <Flex style={{ width: 8, height: 8, borderRadius: "50%", background: cap.color, flexShrink: 0 }} />
                  <Text style={{ fontSize: 11, fontWeight: 600, color: isCustom ? text : textSec }}>
                    {cap.name.replace(" Observability", "").replace(" Analytics", "")}
                  </Text>
                </Flex>
                <Text style={{
                  fontSize: 11, fontWeight: 700, fontFamily: "system-ui, sans-serif",
                  color: isCustom ? Colors.Text.Warning.Default : Colors.Text.Success.Default,
                  minWidth: 32, textAlign: "right",
                }}>
                  {value}%
                </Text>
              </Flex>
              <Flex alignItems="center" gap={8}>
                <input
                  type="range" min={0} max={100} step={5} value={value}
                  onChange={e => handleSliderChange(cap.name, Number(e.target.value))}
                  style={{
                    width: "100%", height: 4, cursor: "pointer",
                    accentColor: isCustom ? Colors.Charts.Status.Warning.Default : cap.color,
                  }}
                />
              </Flex>
            </Flex>
          );
        })}
      </Flex>

      {/* Actions */}
      <Flex alignItems="center" justifyContent="center" gap={8} style={{
        padding: "8px 16px 12px",
        borderTop: `1px solid ${border}`,
      }}>
        <Button onClick={handleApply} variant="emphasized" color="primary" size="condensed">
          Apply
        </Button>
        {hasAnyCustom && (
          <Button onClick={handleReset} size="condensed">
            Reset to 100%
          </Button>
        )}
      </Flex>
    </Flex>
  );
});
