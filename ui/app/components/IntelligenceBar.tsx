// ui/app/components/IntelligenceBar.tsx
//
// The intelligence layer at the top of a page: a few specialised, predefined
// questions. One click returns a short answer grounded in the assessment;
// "Go deeper in Assist" hands the same question, with the assessment as
// context, to the Dynatrace Assist app for a full conversation.
//
// Nothing runs until a question is clicked — each answer is one AI call.

import React, { useRef, useState } from "react";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Flex } from "@dynatrace/strato-components/layouts";
import { AiLoadingIndicator, Markdown, MessageContainer } from "@dynatrace/strato-components/content";
import { Text } from "@dynatrace/strato-components/typography";
import { ChevronDownIcon, ChevronUpIcon, DynatraceIntelligenceSignetIcon } from "@dynatrace/strato-icons";
import { generateSmartReportText } from "../ai/smartReport";
import { openDynatraceAssist } from "../ai/assistIntent";
import type { ReportContext } from "../ai/reportPrompt";

import { questionLabel, type PageQuestion } from "../ai/pageIntelligence";
import { useLang, useTr } from "../i18n/lang";

type Question = PageQuestion;

/** The bar gives the short reading; "Go deeper in Assist" gives the long one. */
const SUMMARY_SUFFIX = " Answer in at most 4 bullets of at most 35 words each, one per line, as a markdown list, most important first. Each bullet starts with a bold conclusion, then the evidence with one number quoted from the context, then what it implies. No introduction and no closing paragraph. Quote only numbers that are written in the context: do not add, subtract, average or estimate any number yourself.";

/** The model often returns \"•\" bullets on one line; give each its own list item. */
const asList = (md: string) => md.replace(/\s*•\s*/g, "\n- ").trim();

type Answer = { state: "loading" } | { state: "ok"; markdown: string } | { state: "error"; message: string; hint: string };

export const IntelligenceBar: React.FC<{ ctx: ReportContext; questions: Question[]; /** Page actions, shown at the right end of the same row. */ actions?: React.ReactNode }> = ({ ctx, questions, actions }) => {
  const tr = useTr();
  const lang = useLang();
  const [active, setActive] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [assistError, setAssistError] = useState<string | null>(null);
  /** Answer hidden but kept: the chip stays selected and reopens it without a new call. */
  const [collapsed, setCollapsed] = useState(false);
  const inFlight = useRef<Set<number>>(new Set());
  const accent = Colors.Text.Primary.Default;
  const ink = Colors.Text.Neutral.Default;
  const sub = Colors.Text.Neutral.Subdued;
  const line = Colors.Border.Neutral.Default;

  const ask = async (i: number) => {
    // Clicking the selected question again folds / unfolds its answer.
    if (active === i) { setCollapsed(c => !c); return; }
    setCollapsed(false);
    setActive(i);
    setAssistError(null);
    if (answers[i]?.state === "ok" || inFlight.current.has(i)) return;
    inFlight.current.add(i);
    setAnswers(a => ({ ...a, [i]: { state: "loading" } }));
    const r = await generateSmartReportText(ctx, questions[i].ask + SUMMARY_SUFFIX);
    inFlight.current.delete(i);
    setAnswers(a => ({ ...a, [i]: r.ok ? { state: "ok", markdown: r.markdown } : { state: "error", message: r.err.message, hint: r.err.hint } }));
  };

  const deeper = (i: number) => {
    const err = openDynatraceAssist({ prompt: questions[i].ask, ctx, execute: true });
    setAssistError(err ? `${err.message} ${err.hint}` : null);
  };

  const cur = active != null ? answers[active] : undefined;

  return (
    <Flex flexDirection="column" style={{ flexShrink: 0, borderBottom: `1px solid ${line}`, background: Colors.Background.Surface.Default }}>
      <Flex alignItems="center" gap={8} flexWrap="wrap" style={{ padding: "8px 16px" }}>
        <Flex alignItems="center" gap={6} style={{ color: accent }}>
          <DynatraceIntelligenceSignetIcon />
          <Text textStyle="small-emphasized" style={{ color: accent, whiteSpace: "nowrap" }}>Dynatrace Intelligence</Text>
        </Flex>
        {questions.map((q, i) => (
          <Button key={q.label} size="condensed" variant={active === i ? "emphasized" : "default"} color={active === i ? "primary" : "neutral"} onClick={() => ask(i)}>
            {questionLabel(q.label, lang)}
            {active === i && <Button.Suffix>{collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}</Button.Suffix>}
          </Button>
        ))}
        {actions && <Flex alignItems="center" gap={8} style={{ marginLeft: "auto" }}>{actions}</Flex>}
      </Flex>
      {active != null && cur && !collapsed && (
        <Flex flexDirection="column" gap={8} style={{ padding: "4px 16px 12px", maxWidth: 980 }}>
          {cur.state === "loading" && <AiLoadingIndicator><AiLoadingIndicator.Icon />{tr("Analyzing the assessment", "Analisando a avaliação", "Analizando la evaluación")}</AiLoadingIndicator>}
          {cur.state === "error" && (
            <MessageContainer variant="warning">
              <MessageContainer.Prefix />
              <MessageContainer.Title>{cur.message}</MessageContainer.Title>
              <MessageContainer.Description>{cur.hint}</MessageContainer.Description>
            </MessageContainer>
          )}
          {cur.state === "ok" && (
            <Markdown>{asList(cur.markdown)}</Markdown>
          )}
          <Flex alignItems="center" gap={8} flexWrap="wrap">
            <Button size="condensed" variant="emphasized" color="primary" onClick={() => deeper(active)}><Button.Prefix><DynatraceIntelligenceSignetIcon /></Button.Prefix>{tr("Go deeper in Assist", "Aprofundar no Assist", "Profundizar en Assist")}</Button>
            <Button size="condensed" onClick={() => setCollapsed(true)}><Button.Prefix><ChevronUpIcon /></Button.Prefix>{tr("Collapse", "Recolher", "Contraer")}</Button>
            {cur.state === "ok" && <Text textStyle="small" style={{ color: sub }}>{tr("Dynatrace Intelligence is an AI system. Verify before acting on important information.", "Dynatrace Intelligence é um sistema de AI. Verifique antes de agir com base em informações importantes.", "Dynatrace Intelligence es un sistema de AI. Verifique antes de actuar sobre información importante.")}</Text>}
          </Flex>
          {assistError && <MessageContainer variant="warning"><MessageContainer.Prefix /><MessageContainer.Description>{assistError}</MessageContainer.Description></MessageContainer>}
        </Flex>
      )}
    </Flex>
  );
};
