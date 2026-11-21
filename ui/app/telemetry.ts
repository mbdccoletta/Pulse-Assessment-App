// ui/app/telemetry.ts
//
// How the customer collects telemetry: the classification the assessment
// states on every screen and report. It is a fact about the estate, not a
// judgement: Full OneAgent, Mixed and Pure OpenTelemetry are all valid
// strategies, so the chip that shows it is neutral.
//
// Detected on open by one free probe (hooks/usePreflight.ts): hosts that
// OneAgent reports, and hosts or Kubernetes nodes that only OpenTelemetry
// reports, matched by short host name so a host seen by both counts once.

export type TelemetrySource = "oneagent" | "otel" | "mixed";

export interface TelemetryProfile {
  source: TelemetrySource;
  /** Hosts monitored by OneAgent (some of them also report OpenTelemetry). */
  oneAgentHosts: number;
  /** Hosts and Kubernetes nodes that only OpenTelemetry reports. */
  otelOnlyHosts: number;
  /** OneAgent hosts that also report OpenTelemetry. */
  sharedHosts: number;
}

export const TELEMETRY_LABEL: Record<TelemetrySource, string> = {
  oneagent: "Full OneAgent",
  mixed: "Mixed",
  otel: "Pure OpenTelemetry",
};

/** Share of the hosts on each side, floored. */
export function telemetryShares(p: TelemetryProfile): { oneAgent: number; otelOnly: number } {
  const total = p.oneAgentHosts + p.otelOnlyHosts;
  if (total <= 0) return { oneAgent: p.source === "otel" ? 0 : 100, otelOnly: p.source === "otel" ? 100 : 0 };
  return {
    oneAgent: Math.floor((p.oneAgentHosts / total) * 100),
    otelOnly: Math.floor((p.otelOnlyHosts / total) * 100),
  };
}

/** One line for reports and AI facts: "Mixed (OneAgent 24% of hosts, OpenTelemetry only 75%)". */
export function telemetrySummary(p: TelemetryProfile): string {
  const s = telemetryShares(p);
  if (p.source === "oneagent") return `${TELEMETRY_LABEL.oneagent} (every host monitored by OneAgent)`;
  if (p.source === "otel") return `${TELEMETRY_LABEL.otel} (no host monitored by OneAgent)`;
  return `${TELEMETRY_LABEL.mixed} (OneAgent ${s.oneAgent}% of hosts, OpenTelemetry only ${s.otelOnly}%)`;
}

/** The profile of the run on screen, for the parts of the app that save or
 *  export it without owning the detection (the run history in App.tsx). */
let current: TelemetryProfile | null = null;
export const setCurrentTelemetry = (p: TelemetryProfile | null) => { current = p; };
export const getCurrentTelemetry = () => current;
