// ui/app/teams.ts
//
// Which teams to involve in each capability, from the environment's own
// Ownership teams (settings schema builtin:ownership.teams). Every team there
// declares its responsibilities; a capability calls for one or two of them.
// Read from configuration: no Grail scan.
//
// This is an indication by area, not by criterion: it names the teams that
// hold the responsibility for the capability, not the owner of each entity.

export type Responsibility = "development" | "security" | "operations" | "infrastructure" | "lineOfBusiness";

export interface OwnershipTeam { name: string; responsibilities: Responsibility[] }

/** The responsibilities each capability calls for, the lead one first. Read
 *  from what the capability's criteria ask for, which is rarely one team's work:
 *  instrumenting is development, ingesting and agents are infrastructure,
 *  alerting, automation and ownership are operations, masking, access and
 *  findings are security, and the business meaning belongs to the line of business. */
export const CAPABILITY_RESPONSIBILITIES: Record<string, Responsibility[]> = {
  // Hosts, Kubernetes and cloud are deployed by infrastructure; problems and their automation are run by operations.
  "Infrastructure Observability": ["infrastructure", "operations"],
  // Tracing and OpenTelemetry are instrumented by development; root cause, tagging and ownership are kept by operations.
  "Application Observability": ["development", "operations"],
  // RUM is added to the frontends by development, synthetic monitors are run by operations, journeys belong to the business.
  "Digital Experience": ["development", "operations", "lineOfBusiness"],
  // Logs are written by development, collected by infrastructure, parsed, routed and alerted on by operations.
  "Log Analytics": ["operations", "development", "infrastructure"],
  // Findings are triaged by security and fixed by development.
  "Application Security": ["security", "development"],
  // Detections are investigated by security and responded to with operations.
  "Threat Observability": ["security", "operations"],
  // AI calls are instrumented by development; guardrails and permissions are security's; cost and reliability are operations'.
  "AI/LLM Observability": ["development", "security", "operations"],
  // Business events are defined by the line of business and emitted by development.
  "Business Observability": ["lineOfBusiness", "development"],
  // Pipelines and deployments are development's; release validation and their automation are operations'.
  "Software Delivery": ["development", "operations"],
  // Ownership, automation and SLOs are operations'; masking, access and the audit trail are security's; agent versions are infrastructure's.
  "Platform Governance": ["operations", "security", "infrastructure"],
  // Cost and carbon are governed with the platform (operations), sized by infrastructure and owned by the line of business.
  "FinOps & Sustainability": ["operations", "infrastructure", "lineOfBusiness"],
};

const KEYS: Responsibility[] = ["development", "security", "operations", "infrastructure", "lineOfBusiness"];

/** The Ownership teams of the environment; null when they could not be read. */
export async function loadOwnershipTeams(): Promise<OwnershipTeam[] | null> {
  const base = "/platform/classic/environment-api/v2/settings/objects";
  try {
    const teams: OwnershipTeam[] = [];
    let url = `${base}?schemaIds=${encodeURIComponent("builtin:ownership.teams")}&pageSize=500&fields=value`;
    for (let page = 0; page < 10; page++) {
      const r = await fetch(url);
      if (!r.ok) return null;
      const j = await r.json();
      for (const o of (j?.items ?? []) as { value?: { name?: string; responsibilities?: Record<string, boolean> } }[]) {
        const name = (o.value?.name ?? "").trim();
        if (!name) continue;
        teams.push({ name, responsibilities: KEYS.filter(k => o.value?.responsibilities?.[k] === true) });
      }
      if (!j?.nextPageKey) break;
      url = `${base}?nextPageKey=${encodeURIComponent(j.nextPageKey)}`;
    }
    return teams;
  } catch {
    return null;
  }
}

/** For a capability: each responsibility it calls for, with the teams that hold it, by name.
 *  A team with two of the responsibilities appears under both: each is a different part of the work. */
export function teamsFor(capability: string, teams: OwnershipTeam[] | null | undefined): { responsibility: Responsibility; teams: string[] }[] {
  return (CAPABILITY_RESPONSIBILITIES[capability] ?? []).map(responsibility => ({
    responsibility,
    teams: [...new Set((teams ?? []).filter(t => t.responsibilities.includes(responsibility)).map(t => t.name))].sort((a, b) => a.localeCompare(b)),
  }));
}
