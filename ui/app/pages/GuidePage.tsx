// ui/app/pages/GuidePage.tsx
//
// The guide: how to read the app. A reading page (centred, one column), so
// this is the one place where explanations are written out in full. Every
// number quoted here is read from the same constants the scoring uses, so the
// guide cannot drift from what the app computes.

import React from "react";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Typography from "@dynatrace/strato-design-tokens/typography";
import { Heading, Paragraph, Text, Strong } from "@dynatrace/strato-components/typography";
import { Accordion, Chip } from "@dynatrace/strato-components/content";
import { Flex, Surface, Grid } from "@dynatrace/strato-components/layouts";
import { CAPABILITIES } from "../queries";
import { CRITERION_TIERS } from "../data/criterionTiers";
import { passLine } from "../passLine";
import { ADOPTION_FULL_RATE } from "../pulseScore";
import { DEFAULT_CUTS, DIAGNOSIS_META } from "../diagnosis";
import type { DiagnosisId } from "../diagnosis";
import { SCORE_BANDS } from "../utils/colors";
import { VerdictChip } from "./CapabilityDetailPage";
import { FOUNDATION_WEIGHT, BEST_PRACTICE_WEIGHT, EXCELLENCE_WEIGHT } from "../hooks/useCoverageData";
import type { CoverageData } from "../hooks/useCoverageData";
import { NO_ADOPTION } from "../hooks/useAppAdoption";
import { IntelligenceBar } from "../components/IntelligenceBar";
import { LENS, QUESTIONS, guideFacts } from "../ai/pageIntelligence";

const MONO = Typography.Code.Small.Default.Family;
const INK = Colors.Text.Neutral.Default;
const NEUTRAL = Colors.Text.Neutral.Subdued;
const LINE = Colors.Border.Neutral.Default;
const SURFACE = Colors.Background.Surface.Default;
const PART = {
  coverage: Colors.Charts.Categorical.Color01.Default,
  utilization: Colors.Charts.Categorical.Color08.Default,
  adoption: Colors.Charts.Categorical.Color07.Default,
};

const pct = (w: number) => Math.round(w <= 1 ? w * 100 : w);
const TIERS = [
  { key: "foundation", label: "Foundation", weight: pct(FOUNDATION_WEIGHT), what: "Is the capability switched on and sending data?" },
  { key: "bestPractice", label: "Best practice", weight: pct(BEST_PRACTICE_WEIGHT), what: "Is it set up the way Dynatrace recommends?" },
  { key: "excellence", label: "Excellence", weight: pct(EXCELLENCE_WEIGHT), what: "Is it used for automation and advanced analysis?" },
] as const;

/** When each verdict applies, in the order the rules are checked (../diagnosis.ts). */
const VERDICT_WHEN: { id: DiagnosisId; when: string }[] = [
  { id: "notAssessed", when: "None of the capability's criteria could be measured in this environment." },
  { id: "starved", when: `People open the apps (adoption at ${DEFAULT_CUTS.adoptionRate}% of active users or more), but coverage is below ${DEFAULT_CUTS.coverage}%.` },
  { id: "unwatched", when: `Coverage is at ${DEFAULT_CUTS.coverage}% or more, but fewer than ${DEFAULT_CUTS.adoptionRate}% of active users open the apps.` },
  { id: "skinDeep", when: `Coverage and adoption are both high, but utilization is below ${DEFAULT_CUTS.utilization}%.` },
  { id: "healthy", when: `Coverage, utilization and adoption are all high.` },
  { id: "dark", when: `Coverage is below ${DEFAULT_CUTS.coverage}% and few people open the apps.` },
];

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Surface elevation="flat" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
    <Heading level={4}>{title}</Heading>
    {children}
  </Surface>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Paragraph style={{ maxWidth: 760 }}>{children}</Paragraph>
);

/** Term on the left, explanation on the right. */
const Def: React.FC<{ term: React.ReactNode; children: React.ReactNode }> = ({ term, children }) => (
  <Grid style={{ gridTemplateColumns: "minmax(140px, 200px) minmax(0, 1fr)", gap: 16, padding: "10px 0", borderTop: `1px solid ${LINE}`, alignItems: "baseline" }}>
    <Text textStyle="base-emphasized" style={{ color: INK }}>{term}</Text>
    <Text textStyle="base" style={{ lineHeight: 1.6, color: INK }}>{children}</Text>
  </Grid>
);

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <Flex style={{ display: "inline-flex", width: 10, height: 10, borderRadius: 3, background: color, marginRight: 8, flexShrink: 0 }} />
);

const num = (n: React.ReactNode) => <Text style={{ fontFamily: MONO, fontWeight: 700 }}>{n}</Text>;

function target(c: (typeof CAPABILITIES)[number]["criteria"][number]): string {
  const line = passLine(c.thresholds.map(t => t.min));
  if (line == null) return "";
  // Same rule as the engine: a constant denominator other than 1 is a share too.
  return c.queryB || (c.denominatorConstant != null && c.denominatorConstant !== 1) ? `${line}% or more` : "at least one";
}

export const GuidePage: React.FC<{ coverageData: CoverageData }> = ({ coverageData }) => {
  const caps = coverageData.capabilities;
  const adoption = coverageData.adoption ?? NO_ADOPTION;

  return (
    <Flex flexDirection="column" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      <IntelligenceBar
        questions={QUESTIONS.guide}
        ctx={{
          tenant: coverageData.tenant, date: coverageData.date, overallCoverage: coverageData.totalScore, overallUtilization: coverageData.overallUtilizationLevel, capabilities: caps,
          lens: LENS.guide,
          pageNote: guideFacts(caps, adoption),
        }}
      />
      <Flex flexDirection="column" gap={16} style={{ width: "100%", maxWidth: 960, margin: "0 auto", padding: "24px 20px 48px" }}>
        <Flex flexDirection="column" gap={8}>
          <Heading level={2}>Guide</Heading>
          <P>
            Pulse Assessment measures how much of the Dynatrace platform this environment really uses. It reads the
            environment's own data, scores {num(CAPABILITIES.length)} capabilities from 0 to 100, and shows what to do to raise each score.
          </P>
        </Flex>

        <Section title="How the score is built">
          <P>
            Every capability gets three readings. The capability score is the average of the three, and the overall
            score is the average of the capabilities. Both are rounded down. When adoption cannot be read, the
            capability score is the average of coverage and utilization.
          </P>
          <Flex flexDirection="column">
            <Def term={<><Dot color={PART.coverage} />Coverage</>}>
              Is the data there? The share of the capability's assessed criteria that are met. A criterion that cannot
              be measured in this environment is not assessed and is left out. A criterion is met when its
              measured value reaches its target, for example "70% of hosts send CPU metrics".
            </Def>
            <Def term={<><Dot color={PART.utilization} />Utilization</>}>
              How deep is the setup? The same criteria, grouped in three tiers and weighted so that the basics count most (see below).
            </Def>
            <Def term={<><Dot color={PART.adoption} />Adoption</>}>
              Do people use it? The share of active users who opened the capability's most used app in the last 30 days.
              It counts as {num(100)} when {num(`${ADOPTION_FULL_RATE}%`)} of active users did; below that it scales in proportion.
            </Def>
          </Flex>
        </Section>

        <Section title="Utilization tiers">
          <P>
            Each criterion belongs to one tier. Utilization is the weighted share of criteria met in each tier. Best
            practice only counts once Foundation reaches {num("80%")}, and Excellence only once Best practice reaches {num("60%")}:
            advanced use on top of a weak base is not counted. A tier with no assessed criterion counts as {num("0%")}.
          </P>
          <Flex flexDirection="column">
            {TIERS.map(t => (
              <Def key={t.key} term={<>{t.label} <Text style={{ fontFamily: MONO, color: NEUTRAL, fontWeight: 400 }}>· weight {t.weight}%</Text></>}>{t.what}</Def>
            ))}
          </Flex>
        </Section>

        <Section title="Score bands">
          <P>The colour of a score is its band. The same bands apply to the overall score, a capability and each of its parts.</P>
          <Flex gap={8} flexWrap="wrap">
            {[...SCORE_BANDS].reverse().map(b => (
              <Chip key={b.label} color="neutral">
                <Chip.Prefix><Flex style={{ display: "inline-flex", width: 10, height: 10, borderRadius: "50%", background: b.token, flexShrink: 0 }} /></Chip.Prefix>
                {b.label} {b.min}–{b.max === 100 ? 100 : b.max - 1}
              </Chip>
            ))}
          </Flex>
        </Section>

        <Section title="Verdicts">
          <P>
            Next to each score there is a one-word verdict. It does not change the score: it reads the three parts
            together and says what kind of problem the capability has, so the next step is clear.
          </P>
          <Flex flexDirection="column">
            {VERDICT_WHEN.map(v => (
              <Def key={v.id} term={<VerdictChip id={v.id} label={DIAGNOSIS_META[v.id].label} />}>
                {v.when}<br /><Text style={{ color: NEUTRAL }}>Next step: {DIAGNOSIS_META[v.id].action}</Text>
              </Def>
            ))}
          </Flex>
        </Section>

        <Section title="The pages">
          <Flex flexDirection="column">
            <Def term="Overview">
              The radar. One sector per capability, with three bars: coverage, utilization and adoption. Point at a
              sector to read its numbers in the centre; click it to open the capability. Click the legend to hide or show a part.
            </Def>
            <Def term="Capability detail">
              Everything about one capability: the score and its parts, what to do (ordered by how much each
              action raises the score), every criterion with its value, the score over time and the apps people use. Click a
              utilization tier to filter the page by it.
            </Def>
            <Def term="Overall score">
              The whole environment on one page: the overall score and its parts, the capabilities from lowest to
              highest, and the actions that raise the overall score most. Also opens from the centre of the radar.
            </Def>
            <Def term="Evolution">
              Compares two saved runs: what changed in the score, in each capability, and which criteria were gained or lost.
            </Def>
            <Def term="Dynatrace Intelligence">
              The bar at the top answers ready-made questions about the assessment in a few lines. "Go deeper in
              Assist" continues the same question in Dynatrace Assist. Answers are generated by AI: verify them before acting.
            </Def>
          </Flex>
        </Section>

        <Section title="Running the assessment">
          <P>
            The assessment runs when the app opens and is saved automatically, so Evolution builds its history without
            any extra step. Results are reused for 24 hours; "Refresh" on the Overview runs everything again. "Run
            details" on the Overview shows how much data the run read.
          </P>
          <P>
            Criteria read Dynatrace metrics and Smartscape wherever they answer the question, at no Grail scan. The
            remaining log and AI reads share one scan per family and stop at 50 GB; a value read only in part shows
            with "≈" and its tooltip says so.
          </P>
        </Section>

        <Section title="Telemetry strategy">
          <P>
            On open the app classifies how the environment collects telemetry, and reads each criterion accordingly. The
            classification heads every report.
          </P>
          <Flex flexDirection="column">
            <Def term="Full OneAgent">Every host is monitored by OneAgent. Every criterion reads OneAgent data.</Def>
            <Def term="Mixed">
              Part of the hosts run OneAgent, part are reported only through OpenTelemetry. Hosts, Kubernetes, processes
              and logs are counted on both sides, and a host seen by both counts once.
            </Def>
            <Def term="Pure OpenTelemetry">
              No host runs OneAgent. Hosts, Kubernetes and logs are read from OpenTelemetry metrics and attributes, and the
              criteria that only exist with OneAgent are left out of the score instead of counting as not met.
            </Def>
          </Flex>
        </Section>

        <Section title="What is measured">
          <P>Select a capability to see its criteria, what each one measures and the value it needs to reach.</P>
          <Accordion>
            {CAPABILITIES.map(c => (
              <Accordion.Section key={c.name} id={c.name}>
                <Accordion.SectionLabel>
                  <Flex alignItems="center" gap={8}>
                    <Flex style={{ display: "inline-flex", width: 10, height: 10, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                    {c.name}
                  </Flex>
                </Accordion.SectionLabel>
                <Accordion.SectionContent>
                  <Flex flexDirection="column" gap={16}>
                    {TIERS.map(t => {
                      const rows = c.criteria.filter(cr => CRITERION_TIERS[cr.id] === t.key);
                      if (rows.length === 0) return null;
                      return (
                        <Flex key={t.key} flexDirection="column" gap={8}>
                          <Heading level={6}>{t.label}</Heading>
                          {rows.map(cr => (
                            <Grid key={cr.id} style={{ gridTemplateColumns: "minmax(0, 1fr) 110px", gap: 16, alignItems: "baseline" }}>
                              <Text textStyle="base" style={{ lineHeight: 1.5, color: INK }}>
                                <Strong>{cr.label.replace(/\s*\(%\)\s*$/, "")}</Strong>
                                <Text style={{ color: NEUTRAL }}> · {cr.description}</Text>
                              </Text>
                              <Text textStyle="small" style={{ fontFamily: MONO, color: NEUTRAL, textAlign: "right" }}>{target(cr)}</Text>
                            </Grid>
                          ))}
                        </Flex>
                      );
                    })}
                  </Flex>
                </Accordion.SectionContent>
              </Accordion.Section>
            ))}
          </Accordion>
        </Section>
      </Flex>
    </Flex>
  );
};
