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

/** The responsibilities each capability calls for. */
export const CAPABILITY_RESPONSIBILITIES: Record<string, Responsibility[]> = {
  "Infrastructure Observability": ["infrastructure"],
  "Application Observability": ["development"],
  "Digital Experience": ["lineOfBusiness", "operations"],
  "Log Analytics": ["operations", "development"],
  "Application Security": ["security"],
  "Threat Observability": ["security"],
  "AI/LLM Observability": ["development"],
  "Business Observability": ["lineOfBusiness"],
  "Software Delivery": ["development"],
  "Platform Governance": ["operations"],
  // Cost and carbon are governed by the same teams that govern the platform.
  "FinOps & Sustainability": ["operations", "lineOfBusiness"],
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

/** The responsibilities a capability calls for and the teams that hold any of them, by name. */
export function teamsFor(capability: string, teams: OwnershipTeam[] | null | undefined): { responsibilities: Responsibility[]; teams: string[] } {
  const responsibilities = CAPABILITY_RESPONSIBILITIES[capability] ?? [];
  const names = (teams ?? [])
    .filter(t => t.responsibilities.some(r => responsibilities.includes(r)))
    .map(t => t.name);
  return { responsibilities, teams: [...new Set(names)].sort((a, b) => a.localeCompare(b)) };
}
