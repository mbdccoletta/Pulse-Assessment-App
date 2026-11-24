// ui/app/components/SmartReportModal.tsx
//
// Smart Report — the user describes the report they need in their own
// words; Davis CoPilot (Dynatrace Assist) writes it grounded in the live
// assessment. Two outputs:
//   - "Open in Assist": native intent — the answer appears in the
//     Dynatrace Assist panel, conversation stays interactive.
//   - "Generate PDF": Davis CoPilot SDK call; the markdown answer is
//     rendered into the app's PDF shell with an AI disclosure.
//
// Shipped to production in v2.5.6. No Davis call fires until the user
// submits a request, so simply opening the modal spends no quota.

import { Chip } from "@dynatrace/strato-components/content";
import React, { useState } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text, Strong } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { Modal } from "@dynatrace/strato-components/overlays";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { openDynatraceAssist } from "../ai/assistIntent";
import { generateSmartReportText, SMART_REPORT_SUGGESTIONS } from "../ai/smartReport";
import type { ReportContext } from "../ai/reportPrompt";
import { generateAiNarrativePdf } from "../reports/aiNarrativePdf";
import type { DavisError } from "../ai/davisError";
import { useTr } from "../i18n/lang";

interface SmartReportModalProps {
  open: boolean;
  onClose: () => void;
  ctx: ReportContext;
  /** Loads the measured FinOps facts. Called only when the request is about
   *  cost, energy or carbon: those queries are a billable scan. */
  loadFinopsNote?: () => Promise<string | undefined>;
  dk: boolean;
}

/** Requests that need cost, energy or carbon figures (EN, PT, ES). */
const FINOPS_ASK = /finops|cost|spend|cloud|bill|budget|saving|carbon|energy|emission|sustainab|custo|gasto|nuvem|fatura|orçamento|econom|carbono|energia|emiss|sustentab|consumo|gasto|nube|factura|presupuesto|ahorr|sostenib/i;

export const SmartReportModal: React.FC<SmartReportModalProps> = ({ open, onClose, ctx, loadFinopsNote, dk }) => {
  const tr = useTr();
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DavisError | null>(null);

  const accent = Colors.Text.Primary.Default;
  const border = Colors.Border.Neutral.Default;
  const textSec = Colors.Text.Neutral.Subdued;

  const effectiveAsk = ask.trim() || SMART_REPORT_SUGGESTIONS[0].ask;

  /** The context for this request: FinOps facts are fetched only when it asks about them. */
  const contextFor = async (request: string): Promise<ReportContext> => {
    if (ctx.finopsNote || !loadFinopsNote || !FINOPS_ASK.test(request)) return ctx;
    const note = await loadFinopsNote().catch(() => undefined);
    return note ? { ...ctx, finopsNote: note } : ctx;
  };

  const openInAssist = async () => {
    setError(null);
    setBusy(true);
    const ctx = await contextFor(effectiveAsk);
    setBusy(false);
    // Intents only work when the app runs embedded in the Dynatrace shell.
    // On the local dev server the platform rejects them ("detached mode"),
    // so surface that instead of closing on a silent failure.
    const err = openDynatraceAssist({ prompt: effectiveAsk, ctx, execute: true });
    if (err) {
      setError({ status: 0, message: err.message, hint: err.hint });
      return;
    }
    onClose();
  };

  const generatePdf = async () => {
    setBusy(true);
    setError(null);
    const result = await generateSmartReportText(await contextFor(effectiveAsk), effectiveAsk);
    setBusy(false);
    if (!result.ok) {
      setError(result.err);
      return;
    }
    generateAiNarrativePdf(result.markdown, {
      title: "Smart Report",
      tenant: ctx.tenant,
      date: ctx.date,
      coverage: ctx.overallCoverage,
      utilization: ctx.overallUtilization,
      ask: effectiveAsk,
    });
    onClose();
  };

  return (
    <Modal show={open} onDismiss={() => { if (!busy) onClose(); }} title={tr("Smart report — Dynatrace Assist", "Relatório inteligente — Dynatrace Assist", "Informe inteligente — Dynatrace Assist")} size="small">
      <Flex flexDirection="column" gap={12} style={{ minWidth: 520, maxWidth: 640 }}>
        <Text style={{ fontSize: 12, color: textSec, lineHeight: 1.5 }}>
          {tr(
            "Describe the report you need — Davis CoPilot writes it grounded in this assessment. Phrase it as a question (What / How / Which) for best results.",
            "Descreva o relatório de que precisa — o Davis CoPilot o escreve com base nesta avaliação. Formule como pergunta (O que / Como / Qual) para melhores resultados.",
            "Describa el informe que necesita — Davis CoPilot lo escribe basado en esta evaluación. Formúlelo como pregunta (Qué / Cómo / Cuál) para mejores resultados.",
          )}
        </Text>

        <Flex gap={6} flexWrap="wrap">
          {SMART_REPORT_SUGGESTIONS.map(s => (
            <Chip key={s.label} color={ask === s.ask ? "primary" : "neutral"} variant={ask === s.ask ? "accent" : "emphasized"} onClick={() => setAsk(s.ask)}>
              {s.label}
            </Chip>
          ))}
        </Flex>

        <textarea
          value={ask}
          rows={4}
          placeholder={SMART_REPORT_SUGGESTIONS[0].ask}
          onChange={e => setAsk(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onKeyPress={(e) => e.stopPropagation()}
          style={{
            padding: "8px 10px", borderRadius: 6, fontSize: 13, lineHeight: 1.5,
            border: `1px solid ${border}`, outline: "none", resize: "vertical",
            background: dk ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
            color: "inherit", fontFamily: "inherit",
          }}
        />

        {error && (
          <Flex flexDirection="column" gap={4} style={{
            padding: "8px 12px", borderRadius: 6,
            border: `1px solid ${Colors.Border.Critical.Default}`,
            background: dk ? "rgba(229,57,53,0.08)" : "rgba(229,57,53,0.05)",
          }}>
            <Text style={{ fontSize: 12, color: Colors.Text.Critical.Default }}>
              <Strong>Davis CoPilot:</Strong> {error.message}
            </Text>
            {error.hint && <Text style={{ fontSize: 11, color: textSec }}>{error.hint}</Text>}
          </Flex>
        )}

        <Flex justifyContent="space-between" alignItems="center" gap={8} style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 10, color: textSec }}>
            {tr("AI-generated content — review before sharing.", "Conteúdo gerado por AI — revise antes de compartilhar.", "Contenido generado por AI — revíselo antes de compartir.")}
          </Text>
          <Flex gap={8}>
            <Button onClick={onClose} disabled={busy}>{tr("Cancel", "Cancelar", "Cancelar")}</Button>
            <Button onClick={openInAssist} disabled={busy} color="primary">
              {tr("Open in Assist", "Abrir no Assist", "Abrir en Assist")}
            </Button>
            <Button onClick={generatePdf} loading={busy} variant="emphasized" color="primary">
              {tr("Generate PDF", "Gerar PDF", "Generar PDF")}
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </Modal>
  );
};
