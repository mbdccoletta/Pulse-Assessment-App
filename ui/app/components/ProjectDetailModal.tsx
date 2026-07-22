// ui/app/components/ProjectDetailModal.tsx
//
// Detailed view of a saved observability project — the card, expanded into
// charts. Everything here is DETERMINISTIC (drawn from stored/discovered
// data, not re-asked from the LLM):
//
//   1. Readiness radar (enlarged ProjectRadar)
//   2. Coverage × Maturity bars per involved capability (live assessment)
//   3. Ownership bars — who owns how many components per capability
//      (dt.owner discovery matrix)
//   4. Execution timeline — week blocks parsed from the saved plan's
//      "Weeks X-Y" headings, with milestone titles; degrades gracefully
//      to a notice when the plan has no week headings
//   5. Full plan markdown + exports (.md report / .json data)
//
// The project itself is already persisted in the Document Store
// ("pulse-projects"); this modal is the rich read view.

import React from "react";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Modal } from "@dynatrace/strato-components-preview/overlays";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text, Strong } from "@dynatrace/strato-components/typography";
import type { ObservabilityProject } from "../hooks/useProjects";
import type { TeamOwnership } from "../hooks/useOwnershipDiscovery";
import { renderMarkdown } from "./DavisInsightSection";
import { ProjectRadar } from "./ProjectRadar";

interface CapInfo {
  name: string;
  color: string;
  coverage: number;
  maturity: number;
}

interface Props {
  project: ObservabilityProject;
  /** Involved capabilities with live scores (already colour-resolved). */
  capabilities: CapInfo[];
  /** Discovery matrix rows (all teams). */
  discovery: TeamOwnership[];
  /** identifier → display name. */
  teamName: (identifier: string) => string;
  onDismiss: () => void;
  onDownloadMd: () => void;
}

// ── Plan timeline parsing ────────────────────────────────────────────────
// The analysis prompt mandates week-range headings ("Weeks 1-2", "Weeks
// 5-8"...). We extract those blocks plus the bold milestone titles inside
// each. Pure regex on our own mandated format; anything else → fallback.

interface TimelineBlock {
  label: string;
  start: number;
  end: number;
  milestones: string[];
}

export function parsePlanTimeline(text: string): TimelineBlock[] {
  const lines = text.split("\n");
  const blocks: TimelineBlock[] = [];
  let current: TimelineBlock | null = null;
  const headingRe = /weeks?\s+(\d+)\s*[-–—]\s*(\d+)/i;
  const boldRe = /\*\*(.+?)\*\*/;

  for (const raw of lines) {
    const line = raw.trim();
    const isHeading = /^#{1,4}\s/.test(line) || /^\*\*[^*]+\*\*:?\s*$/.test(line);
    const wm = line.match(headingRe);
    if (wm && isHeading) {
      current = {
        label: `Weeks ${wm[1]}–${wm[2]}`,
        start: parseInt(wm[1], 10),
        end: parseInt(wm[2], 10),
        milestones: [],
      };
      blocks.push(current);
      continue;
    }
    if (current && current.milestones.length < 4) {
      // Milestone titles: bold text on list/numbered lines inside a block.
      if (/^(\d+\.|[-•*])\s/.test(line)) {
        const bm = line.match(boldRe);
        const title = (bm ? bm[1] : line.replace(/^(\d+\.|[-•*])\s*/, "")).trim();
        if (title && title.length > 2) current.milestones.push(title.slice(0, 70));
      }
    }
  }
  return blocks.filter(b => b.start >= 1 && b.end >= b.start && b.end <= 52);
}

export const ProjectDetailModal: React.FC<Props> = ({
  project, capabilities, discovery, teamName, onDismiss, onDownloadMd,
}) => {
  const dk = useCurrentTheme() === "dark";
  const text = Colors.Text.Neutral.Default;
  const textSec = Colors.Text.Neutral.Subdued;
  const textTert = Colors.Text.Neutral.Disabled;
  const accent = Colors.Text.Primary.Default;
  const borderSub = dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const trackBg = dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";

  const analysis = project.analysis;
  const timeline = analysis ? parsePlanTimeline(analysis.text) : [];
  const maxWeek = Math.max(12, ...timeline.map(b => b.end));

  /** Owners of components per involved capability (from discovery). */
  const ownersOf = (capName: string) =>
    discovery
      .filter(t => (t.byCapability[capName] ?? 0) > 0)
      .map(t => ({ id: t.identifier, name: teamName(t.identifier), count: t.byCapability[capName] }))
      .sort((a, b) => b.count - a.count);

  const onDownloadJson = () => {
    const blob = new Blob(
      [JSON.stringify({ project, exportedAt: new Date().toISOString() }, null, 2)],
      { type: "application/json;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sectionTitle = (label: string) => (
    <Text style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
      textTransform: "uppercase", color: textSec,
    }}>
      {label}
    </Text>
  );

  const barRow = (label: string, value: number, color: string, suffix = "%") => (
    <Flex flexDirection="row" alignItems="center" gap={6}>
      <Text style={{ fontSize: 10, color: textSec, width: 64, flexShrink: 0 }}>{label}</Text>
      <Flex style={{ flex: 1, height: 8, borderRadius: 4, background: trackBg, overflow: "hidden" }}>
        <Flex style={{
          height: "100%", width: `${Math.max(0, Math.min(100, value))}%`,
          borderRadius: 4, background: `linear-gradient(90deg, ${color}99, ${color})`,
        }} />
      </Flex>
      <Text style={{ fontSize: 10, fontWeight: 700, color, width: 34, textAlign: "right" }}>
        {value}{suffix}
      </Text>
    </Flex>
  );

  return (
    <Modal show onDismiss={onDismiss} title={project.name} size="large">
      <Flex flexDirection="column" gap={16} style={{ minWidth: 680, maxWidth: 900 }}>

        {/* Meta */}
        <Flex flexDirection="column" gap={2}>
          <Text style={{ fontSize: 12, color: textSec, lineHeight: 1.5 }}>{project.objective}</Text>
          <Text style={{ fontSize: 11, color: textTert }}>
            {project.team ? `${project.team} · ` : ""}
            {project.segmentName ? `segment ${project.segmentName} · ` : ""}
            {project.targetDate ? `target ${project.targetDate} · ` : ""}
            declared {new Date(project.createdAt).toLocaleDateString()}
            {analysis ? ` · analyzed ${new Date(analysis.ts).toLocaleString()}` : ""}
            {" · stored in Document Store"}
          </Text>
        </Flex>

        {!analysis && (
          <Text style={{ fontSize: 12, color: textSec }}>
            No AI analysis yet — run "Analyze with AI" on the card to generate the
            capability map, plan, and charts.
          </Text>
        )}

        {analysis && (
          <>
            {/* ── Charts row: radar + coverage×maturity ── */}
            <Flex flexDirection="row" gap={16} flexWrap="wrap" alignItems="flex-start">
              {capabilities.length >= 3 && (
                <Flex flexDirection="column" alignItems="center" gap={2}>
                  <ProjectRadar
                    items={capabilities.map(c => ({ name: c.name, color: c.color, value: c.coverage }))}
                    size={230}
                  />
                  <Text style={{ fontSize: 9, color: textTert }}>current readiness (coverage)</Text>
                </Flex>
              )}
              <Flex flexDirection="column" gap={8} style={{ flex: 1, minWidth: 300 }}>
                {sectionTitle("Coverage × Maturity per involved capability")}
                {capabilities.map(c => (
                  <Flex key={c.name} flexDirection="column" gap={2}>
                    <Flex flexDirection="row" alignItems="center" gap={6}>
                      <Flex style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                      <Text style={{ fontSize: 11, fontWeight: 600, color: text }}>{c.name}</Text>
                    </Flex>
                    <Flex flexDirection="column" gap={2} style={{ marginLeft: 14 }}>
                      {barRow("coverage", c.coverage, c.color)}
                      {barRow("maturity", c.maturity, accent, "/100")}
                    </Flex>
                  </Flex>
                ))}
              </Flex>
            </Flex>

            {/* ── Ownership per capability (discovery) ── */}
            <Flex flexDirection="column" gap={8} style={{ paddingTop: 12, borderTop: `1px solid ${borderSub}` }}>
              {sectionTitle("Component ownership (dt.owner discovery)")}
              {capabilities.map(c => {
                const owners = ownersOf(c.name);
                if (owners.length === 0) {
                  return (
                    <Flex key={c.name} flexDirection="row" gap={6} alignItems="center">
                      <Flex style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                      <Text style={{ fontSize: 11, color: textTert }}>
                        {c.name}: no dt.owner-tagged components discovered
                      </Text>
                    </Flex>
                  );
                }
                const total = owners.reduce((s, o) => s + o.count, 0);
                return (
                  <Flex key={c.name} flexDirection="column" gap={2}>
                    <Flex flexDirection="row" alignItems="center" gap={6}>
                      <Flex style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                      <Text style={{ fontSize: 11, fontWeight: 600, color: text }}>{c.name}</Text>
                      <Text style={{ fontSize: 10, color: textTert }}>{total} components</Text>
                    </Flex>
                    {/* Stacked bar: one segment per owning team */}
                    <Flex style={{
                      marginLeft: 14, height: 10, borderRadius: 5,
                      background: trackBg, overflow: "hidden",
                    }}>
                      {owners.map((o, i) => (
                        <Flex key={o.id} title={`${o.name}: ${o.count}`} style={{
                          width: `${(o.count / total) * 100}%`,
                          background: c.color,
                          opacity: 1 - i * 0.22,
                          minWidth: 3,
                        }} />
                      ))}
                    </Flex>
                    <Flex flexDirection="row" gap={6} flexWrap="wrap" style={{ marginLeft: 14 }}>
                      {owners.map((o, i) => (
                        <Text key={o.id} style={{ fontSize: 10, color: textSec }}>
                          <span style={{
                            display: "inline-block", width: 7, height: 7, borderRadius: 2,
                            background: c.color, opacity: 1 - i * 0.22, marginRight: 3,
                          }} />
                          {o.name} · {o.count}
                        </Text>
                      ))}
                    </Flex>
                  </Flex>
                );
              })}
            </Flex>

            {/* ── Execution timeline (parsed from the plan) ── */}
            <Flex flexDirection="column" gap={8} style={{ paddingTop: 12, borderTop: `1px solid ${borderSub}` }}>
              {sectionTitle(`Execution timeline (${maxWeek} weeks)`)}
              {timeline.length === 0 ? (
                <Text style={{ fontSize: 11, color: textTert }}>
                  The saved plan has no week-range headings to chart — re-analyze the
                  project to regenerate it on the week-by-week format.
                </Text>
              ) : timeline.map(b => (
                <Flex key={b.label} flexDirection="column" gap={2}>
                  <Flex flexDirection="row" alignItems="center" gap={8}>
                    <Text style={{ fontSize: 10, fontWeight: 700, color: text, width: 86, flexShrink: 0 }}>
                      {b.label}
                    </Text>
                    <Flex style={{ flex: 1, height: 10, borderRadius: 5, background: trackBg, position: "relative" }}>
                      <Flex style={{
                        position: "absolute",
                        left: `${((b.start - 1) / maxWeek) * 100}%`,
                        width: `${((b.end - b.start + 1) / maxWeek) * 100}%`,
                        top: 0, bottom: 0, borderRadius: 5,
                        background: `linear-gradient(90deg, ${accent}88, ${accent})`,
                      }} />
                    </Flex>
                    <Text style={{ fontSize: 10, color: textTert, width: 76, textAlign: "right" }}>
                      {b.milestones.length} milestone{b.milestones.length === 1 ? "" : "s"}
                    </Text>
                  </Flex>
                  {b.milestones.length > 0 && (
                    <Flex flexDirection="column" gap={2} style={{ marginLeft: 94 }}>
                      {b.milestones.map((m, i) => (
                        <Text key={i} style={{ fontSize: 10, color: textSec }}>• {m}</Text>
                      ))}
                    </Flex>
                  )}
                </Flex>
              ))}
            </Flex>

            {/* ── Full plan ── */}
            <Flex flexDirection="column" gap={4} style={{ paddingTop: 12, borderTop: `1px solid ${borderSub}` }}>
              {sectionTitle("Execution plan")}
              <Flex flexDirection="column" gap={2} style={{
                padding: 12, borderRadius: 8, border: `1px solid ${borderSub}`,
                background: dk ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.04)",
                maxHeight: 320, overflowY: "auto",
              }}>
                {renderMarkdown(analysis.text, text, accent)}
              </Flex>
              <Text style={{ fontSize: 10, color: textTert, fontStyle: "italic" }}>
                AI-generated · may contain inaccuracies · verify before acting
              </Text>
            </Flex>
          </>
        )}

        {/* Footer */}
        <Flex flexDirection="row" justifyContent="space-between" alignItems="center"
          style={{ paddingTop: 8, borderTop: `1px solid ${borderSub}` }}>
          <Flex flexDirection="row" gap={6}>
            <Button size="condensed" disabled={!analysis} onClick={onDownloadMd}>Download .md</Button>
            <Button size="condensed" onClick={onDownloadJson}>Download .json</Button>
          </Flex>
          <Button onClick={onDismiss}>Close</Button>
        </Flex>
      </Flex>
    </Modal>
  );
};
ProjectDetailModal.displayName = "ProjectDetailModal";
