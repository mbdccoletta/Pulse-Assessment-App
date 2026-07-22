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
import { analyzeProject } from "../ai/projectAnalysis";
import { openDynatraceAssist } from "../ai/assistIntent";
import type { ReportContext } from "../ai/reportPrompt";
import { renderMarkdown } from "../components/DavisInsightSection";
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
  const [targetDate, setTargetDate] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, "loading" | string | undefined>>({});

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
    const result = await analyzeProject(p, ctx);
    if (result.ok) {
      saveAnalysis(p.id, { ts: Date.now(), text: result.text, capabilities: result.capabilities });
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
        (p.team ? ` Team: ${p.team}.` : "") +
        (p.targetDate ? ` Target: ${p.targetDate}.` : "") +
        (p.analysis ? `\nPrior AI analysis and execution plan for this project:\n${p.analysis.text}` : ""),
    });
  };

  const submitNew = () => {
    if (!name.trim() || !objective.trim()) return;
    addProject({
      name: name.trim(),
      objective: objective.trim(),
      team: team.trim() || undefined,
      targetDate: targetDate.trim() || undefined,
    });
    setName(""); setObjective(""); setTeam(""); setTargetDate("");
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
                    {p.team ? `${p.team} · ` : ""}{p.targetDate ? `target ${p.targetDate} · ` : ""}
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

              {/* Capability chips */}
              {p.analysis && p.analysis.capabilities.length > 0 && (
                <Flex flexDirection="row" gap={6} flexWrap="wrap">
                  {p.analysis.capabilities.map(capName => (
                    <Flex key={capName} flexDirection="row" alignItems="center" gap={4} style={{
                      padding: "2px 10px", borderRadius: 8,
                      background: (CAP_COLOR[capName] ?? accent) + (dk ? "22" : "15"),
                      border: `1px solid ${(CAP_COLOR[capName] ?? accent)}44`,
                    }}>
                      <Flex style={{ width: 8, height: 8, borderRadius: "50%", background: CAP_COLOR[capName] ?? accent }} />
                      <Text style={{ fontSize: 11, fontWeight: 600, color: text }}>{capName}</Text>
                    </Flex>
                  ))}
                </Flex>
              )}

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
              <Text style={{ fontSize: 12, fontWeight: 600, color: text }}>Team (optional)</Text>
              <input style={inputStyle} value={team} placeholder="e.g. Platform SRE"
                onChange={e => setTeam(e.target.value)}
                onKeyDown={e => e.stopPropagation()} onKeyUp={e => e.stopPropagation()} />
            </Flex>
            <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: 600, color: text }}>Target (optional)</Text>
              <input style={inputStyle} value={targetDate} placeholder="e.g. Q4 2026"
                onChange={e => setTargetDate(e.target.value)}
                onKeyDown={e => e.stopPropagation()} onKeyUp={e => e.stopPropagation()} />
            </Flex>
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
