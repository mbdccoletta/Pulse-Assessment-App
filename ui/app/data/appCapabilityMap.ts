// ui/app/data/appCapabilityMap.ts
//
// Which Dynatrace app serves which Pulse capability.
//
// The assessment measures whether the DATA is there. This map is the other
// half of the story: whether PEOPLE actually open the app that consumes
// that data. Adoption is reported alongside coverage — it never changes a
// score (see useAppAdoption.ts).
//
// Two layers, deliberately:
//   1. EXPLICIT — verified app ids observed on real tenants. Authoritative.
//   2. KEYWORD  — a fallback so an app we have not catalogued yet (a new
//      Dynatrace app, or a custom "my.*" app) still lands in a sensible
//      bucket instead of disappearing. Unmatched apps are reported under
//      "Other" rather than being silently dropped.

import { CAPABILITIES } from "../queries";

export const OTHER_BUCKET = "Other apps";

/** Verified app ids → capability name (must match CAPABILITIES names). */
const EXPLICIT: Record<string, string> = {
  // ── Infrastructure Observability ──
  "dynatrace.infraops": "Infrastructure Observability",
  "dynatrace.kubernetes": "Infrastructure Observability",
  "dynatrace.hosts": "Infrastructure Observability",
  "dynatrace.smartscape": "Infrastructure Observability",
  "dynatrace.clouds": "Infrastructure Observability",
  "dynatrace.extensions.manager": "Infrastructure Observability",
  "dynatrace.database.overview": "Infrastructure Observability",
  // ── Application Observability ──
  "dynatrace.services": "Application Observability",
  "dynatrace.distributedtracing": "Application Observability",
  "dynatrace.error.inspector": "Application Observability",
  "dynatrace.service.level.objectives": "Application Observability",
  // ── Digital Experience ──
  "dynatrace.experience.vitals": "Digital Experience",
  "dynatrace.users.sessions": "Digital Experience",
  "dynatrace.synthetic": "Digital Experience",
  "dynatrace.frontend.observability": "Digital Experience",
  "dynatrace.sessionreplay": "Digital Experience",
  // ── Log Analytics ──
  "dynatrace.logs": "Log Analytics",
  "dynatrace.openpipeline": "Log Analytics",
  // ── Application Security ──
  "dynatrace.security.vulnerabilities": "Application Security",
  "dynatrace.vulnerabilities": "Application Security",
  "dynatrace.security.posturemanagement": "Application Security",
  "dynatrace.codelevelvulnerabilities": "Application Security",
  // ── Threat Observability ──
  "dynatrace.security.investigator": "Threat Observability",
  "dynatrace.attacks": "Threat Observability",
  "dynatrace.threats": "Threat Observability",
  // ── AI/LLM Observability ──
  "dynatrace.genai.observability": "AI/LLM Observability",
  "dynatrace.ai.observability": "AI/LLM Observability",
  // ── Business Observability ──
  "dynatrace.biz.flow": "Business Observability",
  "dynatrace.biz.explore": "Business Observability",
  "dynatrace.business.analytics": "Business Observability",
  // ── Platform Governance ──
  "dynatrace.settings": "Platform Governance",
  "dynatrace.storage.management": "Platform Governance",
  "dynatrace.classic.settings": "Platform Governance",
  "dynatrace.segments.management": "Platform Governance",
  "dynatrace.ownership": "Platform Governance",
  "dynatrace.fleet.management": "Platform Governance",
  "dynatrace.classic.one.agent.health": "Platform Governance",
  "dynatrace.classic.tokens": "Platform Governance",
  "dynatrace.platform.services.settings": "Platform Governance",
  // ── FinOps & Sustainability ──
  "dynatrace.biz.carbon": "FinOps & Sustainability",
  // ── Software Delivery ──
  "dynatrace.sitereliabilityguardian": "Software Delivery",
  "dynatrace.releases": "Software Delivery",
  "dynatrace.dora": "Software Delivery",
  "dynatrace.pipeline.observability": "Software Delivery",
};

/** Fallback: first keyword found in the app id decides the bucket. Order
 *  matters — more specific terms first. */
const KEYWORDS: [string, string][] = [
  ["kubernetes", "Infrastructure Observability"],
  ["k8s", "Infrastructure Observability"],
  ["infra", "Infrastructure Observability"],
  ["host", "Infrastructure Observability"],
  ["cloud", "Infrastructure Observability"],
  ["rightsize", "Infrastructure Observability"],
  ["trace", "Application Observability"],
  ["service", "Application Observability"],
  ["vitals", "Digital Experience"],
  ["session", "Digital Experience"],
  ["synthetic", "Digital Experience"],
  ["journey", "Digital Experience"],
  ["rum", "Digital Experience"],
  ["frontend", "Digital Experience"],
  ["log", "Log Analytics"],
  ["pipeline.observability", "Software Delivery"],
  ["cicd", "Software Delivery"],
  ["automation", "Software Delivery"],
  ["release", "Software Delivery"],
  ["deploy", "Software Delivery"],
  ["vulnerab", "Application Security"],
  ["appsec", "Application Security"],
  ["security", "Threat Observability"],
  ["attack", "Threat Observability"],
  ["threat", "Threat Observability"],
  ["genai", "AI/LLM Observability"],
  ["ai.observability", "AI/LLM Observability"],
  ["llm", "AI/LLM Observability"],
  ["biz", "Business Observability"],
  ["business", "Business Observability"],
];

const CAP_NAMES = new Set(CAPABILITIES.map(c => c.name));

/** Apps that serve several capabilities. They are LISTED in every one of them
 *  (so a team sees every app it can use), but only a primary mapping above
 *  feeds the adoption part of the score — otherwise one popular cross-cutting
 *  app (Problems, Dashboards) would lift adoption everywhere at once. */
const OBSERVED = ["Infrastructure Observability", "Application Observability", "Digital Experience", "AI/LLM Observability", "Business Observability", "Software Delivery"];
const SHARED: Record<string, string[]> = {
  "dynatrace.davis.problems": OBSERVED,
  "dynatrace.davis.anomalydetection": OBSERVED,
  // Workflows serve whatever capability the workflow acts on: listed in all of them, primary in none.
  "dynatrace.automations": CAPABILITIES.map(c => c.name),
  "dynatrace.davis.copilot": CAPABILITIES.map(c => c.name),
  "dynatrace.notebooks": [...OBSERVED, "Log Analytics", "Application Security", "Threat Observability"],
  "dynatrace.dashboards": [...OBSERVED, "Log Analytics", "Application Security", "Threat Observability"],
  "dynatrace.distributedtracing": ["AI/LLM Observability"],
  "dynatrace.logs": ["Infrastructure Observability", "Application Observability", "Threat Observability"],
  "dynatrace.service.level.objectives": ["Software Delivery", "Digital Experience"],
  "dynatrace.kubernetes": ["Application Security"],
  "dynatrace.fleet.management": ["Infrastructure Observability"],
  "dynatrace.storage.management": ["Log Analytics"],
  "dynatrace.openpipeline": ["Platform Governance"],
  "dynatrace.sitereliabilityguardian": ["Application Observability"],
};

/** Apps with no primary capability: they never feed one capability's adoption
 *  score, and are listed in every capability they can serve. */
const SHARED_ONLY = new Set(["dynatrace.automations", "dynatrace.davis.copilot"]);

/** Capabilities an app also serves, beyond its primary one. */
export function sharedCapabilitiesForApp(appId: string): string[] {
  const id = appId.toLowerCase();
  const primary = capabilityForApp(id);
  return (SHARED[id] ?? []).filter(c => c !== primary);
}

/** Resolve an app id to a capability, or OTHER_BUCKET when nothing fits. */
export function capabilityForApp(appId: string): string {
  const id = appId.toLowerCase();
  if (SHARED_ONLY.has(id)) return OTHER_BUCKET;
  const explicit = EXPLICIT[id];
  if (explicit && CAP_NAMES.has(explicit)) return explicit;
  for (const [kw, cap] of KEYWORDS) {
    if (id.includes(kw) && CAP_NAMES.has(cap)) return cap;
  }
  return OTHER_BUCKET;
}

/** Human-friendly app name from its id ("dynatrace.davis.problems" →
 *  "Davis Problems"). Keeps report tables readable without a lookup call. */
export function prettyAppName(appId: string): string {
  return appId
    .replace(/^(dynatrace|my|community)\./, "")
    .split(".")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .replace(/\bApp\b$/, "")
    .trim();
}
