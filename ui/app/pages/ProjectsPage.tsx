// ui/app/pages/ProjectsPage.tsx
//
// Customer-declared observability projects (dev-only prototype).
//
// Flow:
//   1. The customer/SE declares a project (name + objective + optional
//      team/target). It persists in the Document Store and renders as a card.
//   2. "Analyze with AI" asks Davis which of the nine Pulse capabilities
//      serve the objective and for a 30/60/90-day execution plan grounded
//      in the live assessment gaps. Detected capabilities render as
//      coloured chips; the plan is stored on the card.
//   3. Deliverables: the plan downloads as .md, and per-audience
//      deliverables (kickoff briefing / technical runbook / executive
//      update) open in the NATIVE Dynatrace Assist with the project +
//      analysis attached as hidden context — same conversation-starter
//      pattern as the rest of the app.

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Modal } from "@dynatrace/strato-components-preview/overlays";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text, Strong } from "@dynatrace/strato-components/typography";
import { SkeletonText } from "@dynatrace/strato-components/content";
import { DynatraceIntelligenceSignetIcon } from "@dynatrace/strato-icons";
import type { CoverageData } from "../hooks/useCoverageData";
import { useProjects, type ObservabilityProject } from "../hooks/useProjects";
import { useOwnershipTeams } from "../hooks/useOwnershipTeams";
import { useSegments } from "../hooks/useSegments";
import { useOwnershipDiscovery, summarizeOwnership } from "../hooks/useOwnershipDiscovery";
import { analyzeProject } from "../ai/projectAnalysis";
import { openDynatraceAssist } from "../ai/assistIntent";
import type { ReportContext } from "../ai/reportPrompt";
import { renderMarkdown } from "../components/DavisInsightSection";
import { ProjectRadar } from "../components/ProjectRadar";
import { ProjectDetailModal } from "../components/ProjectDetailModal";
import { CAPABILITIES } from "../queries";

interface Props {
  coverageData: CoverageData;
  isDev: boolean;
}

const CAP_COLOR: Record<string, string> = Object.fromEntries(
  CAPABILITIES.map(c => [c.name, c.color]),
);

/** Per-audience deliverable starters — question-form (guardrail-safe). */
const DELIVERABLES: { title: string; prompt: (p: ObservabilityProject) => string }[] = [
  {
    title: "Kickoff briefing",
    prompt: (p) =>
      `What should I include in a kickoff briefing for the observability project "${p.name}"? ` +
      `Please cover: the objective in plain language, the Dynatrace capabilities involved and why, ` +
      `the first-30-days actions, roles needed, and how we'll measure success.`,
  },
  {
    title: "Technical runbook",
    prompt: (p) =>
      `What technical steps should the platform team follow to deliver the project "${p.name}"? ` +
      `Please give concrete, ordered steps with the exact Dynatrace settings, integrations, or ` +
      `attributes involved, prerequisites between steps, and validation checks after each phase.`,
  },
  {
    title: "Executive update",
    prompt: (p) =>
      `What are the key points for an executive status update about the project "${p.name}"? ` +
      `Please frame it around business outcomes: what the project achieves, current observability ` +
      `gaps it closes, expected risk reduction, and the recommended next investment.`,
  },
];

export const ProjectsPage: React.FC<Props> = ({ coverageData, isDev }) => {
  const navigate = useNavigate();
  const dk = useCurrentTheme() === "dark";
  const { projects, loading, addProject, removeProject, saveAnalysis } = useProjects();

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [team, setTeam] = useState("");
  /** Identifier of the selected official Ownership team ("" = none/free-text). */
  const [teamId, setTeamId] = useState("");
  /** uid of the selected platform Segment ("" = none). */
  const [segmentUid, setSegmentUid] = useState("");
  const [targetDate, setTargetDate] = useState("");
  // Official Dynatrace sources. Ownership teams load on page mount — the
  // analysis needs them (Davis flags involved teams); Segments stay lazy
  // on the modal.
  const ownership = useOwnershipTeams(true);
  const segmentsSrc = useSegments(showNew);
  // Real ownership discovery: sweep dt.owner-tagged entities per type and
  // classify them into capabilities (team × capability × count matrix).
  const discovery = useOwnershipDiscovery(true);

  /** identifier → display name (falls back to the identifier itself). */
  const teamName = (identifier: string) =>
    ownership.teams.find(t => t.identifier === identifier)?.name ?? identifier;

  /** For one capability: the teams that own components in it (discovered). */
  const ownersOf = (capName: string) =>
    discovery.teams
      .filter(t => (t.byCapability[capName] ?? 0) > 0)
      .map(t => ({ identifier: t.identifier, name: teamName(t.identifier), count: t.byCapability[capName] }));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, "loading" | string | undefined>>({});
  /** Project id whose detail modal (charts view) is open. */
  const [detailId, setDetailId] = useState<string | null>(null);

  const text = Colors.Text.Neutral.Default;
  const textSec = Colors.Text.Neutral.Subdued;
  const textTert = Colors.Text.Neutral.Disabled;
  const accent = Colors.Text.Primary.Default;
  const border = Colors.Border.Neutral.Default;
  const surface = Colors.Background.Surface.Default;
  const bg = Colors.Background.Base.Default;
  const borderSub = dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  const ctx: ReportContext = useMemo(() => ({
    tenant: coverageData.tenant ?? "(unknown)",
    date: coverageData.date ?? "",
    overallCoverage: coverageData.totalScore,
    overallMaturity: coverageData.overallMaturityLevel,
    capabilities: coverageData.capabilities,
  }), [coverageData]);

  const hasAssessment = coverageData.capabilities.length > 0;

  const runAnalysis = async (p: ObservabilityProject) => {
    setBusy(prev => ({ ...prev, [p.id]: "loading" }));
    const result = await analyzeProject(
      p, ctx,
      ownership.teams.map(t => t.name),
      summarizeOwnership(discovery.teams, teamName),
    );
    if (result.ok) {
      saveAnalysis(p.id, { ts: Date.now(), text: result.text, capabilities: result.capabilities, teams: result.teams });
      setBusy(prev => ({ ...prev, [p.id]: undefined }));
      setExpanded(prev => ({ ...prev, [p.id]: true }));
    } else {
      setBusy(prev => ({ ...prev, [p.id]: `${result.err.message} — ${result.err.hint}` }));
    }
  };

  const downloadPlan = (p: ObservabilityProject) => {
    if (!p.analysis) return;
    const md =
      `# ${p.name}\n\n**Objective:** ${p.objective}\n` +
      (p.team ? `**Team:** ${p.team}\n` : "") +
      (p.targetDate ? `**Target:** ${p.targetDate}\n` : "") +
      `\n---\n\n${p.analysis.text}\n`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-plan-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openDeliverable = (p: ObservabilityProject, prompt: string) => {
    openDynatraceAssist({
      prompt,
      ctx,
      execute: false,
      extraContext:
        `Declared customer project: "${p.name}". Objective: ${p.objective}.` +
        (p.team ? ` Team: ${p.team}${p.teamIdentifier ? ` (Ownership identifier ${p.teamIdentifier})` : ""}.` : "") +
        (p.segmentName ? ` Platform Segment: "${p.segmentName}" (uid ${p.segmentUid}).` : "") +
        (p.targetDate ? ` Target: ${p.targetDate}.` : "") +
        (p.analysis ? `\nPrior AI analysis and execution plan for this project:\n${p.analysis.text}` : ""),
    });
  };

  const submitNew = () => {
    if (!name.trim() || !objective.trim()) return;
    const officialTeam = teamId ? ownership.teams.find(t => t.identifier === teamId) : undefined;
    const segment = segmentUid ? segmentsSrc.segments.find(s => s.uid === segmentUid) : undefined;
    addProject({
      name: name.trim(),
      objective: objective.trim(),
      // Prefer the official Ownership team; fall back to free text.
      team: officialTeam?.name ?? (team.trim() || undefined),
      teamIdentifier: officialTeam?.identifier,
      segmentUid: segment?.uid,
      segmentName: segment?.name,
      targetDate: targetDate.trim() || undefined,
    });
    setName(""); setObjective(""); setTeam(""); setTeamId(""); setSegmentUid(""); setTargetDate("");
    setShowNew(false);
  };

  if (!isDev) {
    return (
      <Flex flexDirection="column" alignItems="center" justifyContent="center"
        style={{ height: "100vh", padding: 32, background: bg, color: text }}>
        <Text style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          Projects are an SE-only prototype
        </Text>
        <Button onClick={() => navigate("/")}>← Back to Assessment</Button>
      </Flex>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", fontSize: 13, borderRadius: 6,
    border: `1px solid ${borderSub}`,
    background: dk ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.85)",
    color: text, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  return (
    <Flex flexDirection="column" style={{ height: "100%", overflow: "auto", background: bg, color: text }}>

      {/* ── Header ── */}
      <Flex flexDirection="row" alignItems="center" justifyContent="space-between"
        style={{
          padding: "12px 24px", borderBottom: `1px solid ${border}`,
          background: surface, position: "sticky", top: 0, zIndex: 10,
        }}>
        <Flex flexDirection="row" alignItems="center" gap={12}>
          <Button onClick={() => navigate("/")} size="condensed">← Back</Button>
          <Flex flexDirection="column">
            <Text style={{ fontSize: 16, fontWeight: 700, color: text }}>Observability Projects</Text>
            <Text style={{ fontSize: 11, color: textTert }}>
              Declared customer initiatives · Tenant <Strong style={{ color: textSec }}>{ctx.tenant}</Strong>
            </Text>
          </Flex>
        </Flex>
        <Button variant="emphasized" color="primary" onClick={() => setShowNew(true)}>
          New project
        </Button>
      </Flex>

      {/* ── Ownership discovery status ── */}
      <Flex style={{ padding: "8px 24px 0" }}>
        <Text style={{ fontSize: 11, color: textTert }}>
          {discovery.loading
            ? "Discovering component ownership (dt.owner sweep)…"
            : discovery.teams.length > 0
              ? `Ownership discovery: ${discovery.teams.length} team${discovery.teams.length === 1 ? "" : "s"} own ${discovery.teams.reduce((s, t) => s + t.total, 0)} components across the entity model.`
              : "Ownership discovery: no dt.owner-tagged components found — assign teams to entities via Ownership to ground the maps in real data."}
        </Text>
      </Flex>

      {/* ── Missing-assessment hint ── */}
      {!hasAssessment && (
        <Flex style={{ padding: "10px 24px" }}>
          <Text style={{ fontSize: 12, color: Colors.Charts.Status.Warning.Default }}>
            No assessment data loaded yet — run the assessment first so project plans
            are grounded in the customer's real gaps.
          </Text>
        </Flex>
      )}

      {/* ── Cards ── */}
      <Flex flexDirection="column" gap={12} style={{ padding: "16px 24px 32px" }}>
        {loading && <SkeletonText lines={3} />}

        {!loading && projects.length === 0 && (
          <Flex flexDirection="column" alignItems="center" gap={8} style={{ padding: 48, textAlign: "center" }}>
            <DynatraceIntelligenceSignetIcon size="large" />
            <Text style={{ fontSize: 14, fontWeight: 700, color: text }}>No projects declared yet</Text>
            <Text style={{ fontSize: 12, color: textSec, maxWidth: 460, lineHeight: 1.5 }}>
              Declare a customer initiative — a migration, an MTTR goal, an audit —
              and Davis will map which platform capabilities serve it and propose an
              execution plan grounded in this assessment.
            </Text>
            <Button variant="emphasized" color="primary" onClick={() => setShowNew(true)}>
              Declare the first project
            </Button>
          </Flex>
        )}

        {projects.map(p => {
          const state = busy[p.id];
          const isLoading = state === "loading";
          const errText = typeof state === "string" && state !== "loading" ? state : null;
          const isOpen = !!expanded[p.id];
          return (
            <Flex key={p.id} flexDirection="column" gap={8} style={{
              padding: 16, borderRadius: 10,
              border: `1px solid ${border}`, background: surface,
              borderLeft: `4px solid ${p.analysis?.capabilities[0] ? CAP_COLOR[p.analysis.capabilities[0]] ?? accent : accent}`,
            }}>
              {/* Card header */}
              <Flex flexDirection="row" alignItems="center" justifyContent="space-between">
                <Flex flexDirection="column">
                  <Text style={{ fontSize: 15, fontWeight: 700, color: text }}>{p.name}</Text>
                  <Text style={{ fontSize: 11, color: textTert }}>
                    {p.team ? `${p.team} · ` : ""}
                    {p.segmentName ? `segment ${p.segmentName} · ` : ""}
                    {p.targetDate ? `target ${p.targetDate} · ` : ""}
                    declared {new Date(p.createdAt).toLocaleDateString()}
                  </Text>
                </Flex>
                <Flex flexDirection="row" gap={6}>
                  {!p.analysis && (
                    <Button size="condensed" variant="emphasized" color="primary"
                      disabled={isLoading} onClick={() => void runAnalysis(p)}>
                      {isLoading ? "Analyzing…" : "Analyze with AI"}
                    </Button>
                  )}
                  {p.analysis && (
                    <>
                      <Button size="condensed" variant="emphasized" color="primary"
                        onClick={() => setDetailId(p.id)}>
                        Details &amp; charts
                      </Button>
                      <Button size="condensed" onClick={() => setExpanded(prev => ({ ...prev, [p.id]: !isOpen }))}>
                        {isOpen ? "Hide plan" : "Show plan"}
                      </Button>
                      <Button size="condensed" onClick={() => downloadPlan(p)}>Download .md</Button>
                      <Button size="condensed" disabled={isLoading} onClick={() => void runAnalysis(p)}>
                        {isLoading ? "Analyzing…" : "Re-analyze"}
                      </Button>
                    </>
                  )}
                  <Button size="condensed" onClick={() => removeProject(p.id)} aria-label={`Remove project ${p.name}`}>
                    Remove
                  </Button>
                </Flex>
              </Flex>

              {/* Objective */}
              <Text style={{ fontSize: 12, color: textSec, lineHeight: 1.55 }}>{p.objective}</Text>

              {/* Objective map: radar (capabilities × current readiness) +
                  involved teams + per-capability scores */}
              {p.analysis && p.analysis.capabilities.length > 0 && (() => {
                const radarItems = p.analysis!.capabilities.map(capName => ({
                  name: capName,
                  color: CAP_COLOR[capName] ?? accent,
                  value: coverageData.capabilities.find(c => c.name === capName)?.score ?? 0,
                }));
                // Teams that MUST be involved = union of the teams Davis
                // flagged in the plan and the teams that actually OWN
                // components (dt.owner) in the involved capabilities.
                const discovered = new Set(
                  p.analysis!.capabilities.flatMap(capName => ownersOf(capName).map(o => o.name)),
                );
                for (const t of p.analysis!.teams ?? []) discovered.add(t);
                if (discovered.size === 0 && p.team) discovered.add(p.team);
                const involvedTeams = [...discovered];
                return (
                  <Flex flexDirection="row" gap={16} alignItems="flex-start" flexWrap="wrap">
                    {radarItems.length >= 3 && (
                      <Flex flexDirection="column" alignItems="center" gap={2}>
                        <ProjectRadar items={radarItems} />
                        <Text style={{ fontSize: 9, color: textTert }}>
                          current readiness of involved capabilities
                        </Text>
                      </Flex>
                    )}
                    <Flex flexDirection="column" gap={8} style={{ flex: 1, minWidth: 240 }}>
                      {/* Capability scores (radar legend) */}
                      <Flex flexDirection="column" gap={4}>
                        <Text style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                          textTransform: "uppercase", color: textSec,
                        }}>
                          Capabilities involved
                        </Text>
                        {radarItems.map(it => {
                          const owners = ownersOf(it.name);
                          return (
                            <Flex key={it.name} flexDirection="column" gap={2}>
                              <Flex flexDirection="row" alignItems="center" gap={6}>
                                <Flex style={{ width: 8, height: 8, borderRadius: "50%", background: it.color, flexShrink: 0 }} />
                                <Text style={{ fontSize: 11, color: text, flex: 1 }}>{it.name}</Text>
                                <Text style={{ fontSize: 11, fontWeight: 700, color: it.color }}>{it.value}%</Text>
                              </Flex>
                              {/* Discovered owners of components in this capability */}
                              {owners.length > 0 && (
                                <Flex flexDirection="row" gap={4} flexWrap="wrap" style={{ marginLeft: 14 }}>
                                  {owners.map(o => (
                                    <Flex key={o.identifier} style={{
                                      padding: "1px 8px", borderRadius: 6,
                                      background: it.color + (dk ? "1c" : "12"),
                                      border: `1px solid ${it.color}33`,
                                    }}>
                                      <Text style={{ fontSize: 10, color: text }}>
                                        {o.name} · {o.count}
                                      </Text>
                                    </Flex>
                                  ))}
                                </Flex>
                              )}
                            </Flex>
                          );
                        })}
                      </Flex>
                      {/* Involved teams (official Ownership names Davis flagged) */}
                      {involvedTeams.length > 0 && (
                        <Flex flexDirection="column" gap={4}>
                          <Text style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                            textTransform: "uppercase", color: textSec,
                          }}>
                            Teams involved
                          </Text>
                          <Flex flexDirection="row" gap={6} flexWrap="wrap">
                            {involvedTeams.map(tn => (
                              <Flex key={tn} style={{
                                padding: "2px 10px", borderRadius: 8,
                                background: accent + (dk ? "22" : "15"),
                                border: `1px solid ${accent}44`,
                              }}>
                                <Text style={{ fontSize: 11, fontWeight: 600, color: text }}>{tn}</Text>
                              </Flex>
                            ))}
                          </Flex>
                        </Flex>
                      )}
                    </Flex>
                  </Flex>
                );
              })()}

              {/* In-flight / error */}
              {isLoading && <SkeletonText lines={3} />}
              {errText && (
                <Text style={{ fontSize: 11, color: Colors.Text.Critical.Default, lineHeight: 1.5 }}>
                  {errText}
                </Text>
              )}

              {/* Plan body */}
              {p.analysis && isOpen && (
                <Flex flexDirection="column" gap={2} style={{
                  padding: 12, borderRadius: 8,
                  border: `1px solid ${borderSub}`,
                  background: dk ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.04)",
                }}>
                  {renderMarkdown(p.analysis.text, text, accent)}
                  <Text style={{ fontSize: 10, color: textTert, fontStyle: "italic", marginTop: 8 }}>
                    AI-generated {new Date(p.analysis.ts).toLocaleString()} · may contain inaccuracies · verify before acting
                  </Text>
                </Flex>
              )}

              {/* Deliverables — native Assist conversation starters */}
              {p.analysis && (
                <Flex flexDirection="column" gap={4} style={{ paddingTop: 8, borderTop: `1px solid ${borderSub}` }}>
                  <Text style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                    textTransform: "uppercase", color: textSec,
                  }}>
                    Deliverables · opens in Dynatrace Assist
                  </Text>
                  <Flex flexDirection="row" gap={6} flexWrap="wrap">
                    {DELIVERABLES.map(d => (
                      <Button key={d.title} size="condensed" onClick={() => openDeliverable(p, d.prompt(p))}>
                        {d.title}
                      </Button>
                    ))}
                  </Flex>
                </Flex>
              )}
            </Flex>
          );
        })}
      </Flex>

      {/* ── Project detail modal (charts view) ── */}
      {detailId && (() => {
        const p = projects.find(x => x.id === detailId);
        if (!p) return null;
        const caps = (p.analysis?.capabilities ?? []).map(capName => ({
          name: capName,
          color: CAP_COLOR[capName] ?? accent,
          coverage: coverageData.capabilities.find(c => c.name === capName)?.score ?? 0,
          maturity: coverageData.capabilities.find(c => c.name === capName)?.maturity.maturityScore ?? 0,
        }));
        return (
          <ProjectDetailModal
            project={p}
            capabilities={caps}
            discovery={discovery.teams}
            teamName={teamName}
            onDismiss={() => setDetailId(null)}
            onDownloadMd={() => downloadPlan(p)}
          />
        );
      })()}

      {/* ── New project modal ── */}
      <Modal show={showNew} onDismiss={() => setShowNew(false)} title="Declare an observability project" size="small">
        <Flex flexDirection="column" gap={12} style={{ minWidth: 460 }}>
          <Flex flexDirection="column" gap={4}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: text }}>Project name</Text>
            <input style={inputStyle} value={name} autoFocus
              placeholder="e.g. Checkout migration to Kubernetes"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.stopPropagation()} onKeyUp={e => e.stopPropagation()} />
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: text }}>Objective</Text>
            <textarea style={{ ...inputStyle, resize: "vertical" }} rows={4} value={objective}
              placeholder="What does the customer want to achieve? e.g. Full tracing and log correlation for the new checkout services, with MTTR under 30 minutes."
              onChange={e => setObjective(e.target.value)}
              onKeyDown={e => e.stopPropagation()} onKeyUp={e => e.stopPropagation()} />
          </Flex>
          <Flex flexDirection="row" gap={8}>
            <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: 600, color: text }}>Owning team (optional)</Text>
              {ownership.teams.length > 0 ? (
                <>
                  <select
                    style={{ ...inputStyle, appearance: "auto" as React.CSSProperties["appearance"] }}
                    value={teamId}
                    onChange={e => setTeamId(e.target.value)}
                    aria-label="Select an official Dynatrace Ownership team"
                  >
                    <option value="">— No team —</option>
                    {ownership.teams.map(t => (
                      <option key={t.identifier} value={t.identifier}>{t.name}</option>
                    ))}
                  </select>
                  <Text style={{ fontSize: 10, color: textTert }}>
                    Official Ownership teams (Settings &gt; Ownership &gt; Teams)
                  </Text>
                </>
              ) : (
                <>
                  <input style={inputStyle} value={team} placeholder="e.g. Platform SRE"
                    onChange={e => setTeam(e.target.value)}
                    onKeyDown={e => e.stopPropagation()} onKeyUp={e => e.stopPropagation()} />
                  <Text style={{ fontSize: 10, color: textTert }}>
                    {ownership.loading
                      ? "Loading Ownership teams…"
                      : "No Ownership teams found — define them under Settings > Ownership > Teams to pick officially."}
                  </Text>
                </>
              )}
            </Flex>
            <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: 600, color: text }}>Target (optional)</Text>
              <input style={inputStyle} value={targetDate} placeholder="e.g. Q4 2026"
                onChange={e => setTargetDate(e.target.value)}
                onKeyDown={e => e.stopPropagation()} onKeyUp={e => e.stopPropagation()} />
            </Flex>
          </Flex>
          {/* Platform Segment — the official Grail scoping mechanism
              (Segments app). Identifies which slice of the environment the
              project belongs to; forwarded to Davis so plans stay scoped. */}
          <Flex flexDirection="column" gap={4}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: text }}>Segment (optional)</Text>
            {segmentsSrc.segments.length > 0 ? (
              <>
                <select
                  style={{ ...inputStyle, appearance: "auto" as React.CSSProperties["appearance"] }}
                  value={segmentUid}
                  onChange={e => setSegmentUid(e.target.value)}
                  aria-label="Select a platform Segment"
                >
                  <option value="">— No segment —</option>
                  {segmentsSrc.segments.map(s => (
                    <option key={s.uid} value={s.uid}>
                      {s.name}{s.isPublic === false ? " (private)" : ""}
                    </option>
                  ))}
                </select>
                <Text style={{ fontSize: 10, color: textTert }}>
                  Platform Segments (Segments app) — scopes the project the way the
                  customer already slices their environment
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 10, color: textTert }}>
                {segmentsSrc.loading
                  ? "Loading Segments…"
                  : "No Segments found — define them in the Segments app to identify projects by scope."}
              </Text>
            )}
          </Flex>
          <Flex flexDirection="row" justifyContent="flex-end" gap={8}
            style={{ paddingTop: 8, borderTop: `1px solid ${borderSub}` }}>
            <Button onClick={() => setShowNew(false)}>Cancel</Button>
            <Button variant="emphasized" color="primary"
              disabled={!name.trim() || !objective.trim()} onClick={submitNew}>
              Create project
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </Flex>
  );
};
ProjectsPage.displayName = "ProjectsPage";
