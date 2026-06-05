// ui/app/hooks/useAiReport.ts
//
// One-shot Davis-powered report generation across the whole assessment.
//
// Different from useDavisRecommendations: that hook produces per-capability
// recommendations and supports follow-ups. This one runs ONE call against
// the full assessment context with a free-form user prompt, and returns
// the markdown + status.
//
// No cache — each user prompt is unique, caching would hurt more than help.

import { useCallback, useState } from "react";
import { publicClient } from "@dynatrace-sdk/client-davis-copilot";
import type { CapabilityResult } from "./useCoverageData";
import type { DavisError } from "../ai/davisRecommendations";
import { buildReportPrompt, type ReportContext } from "../ai/reportPrompt";

interface UseAiReportResult {
  /** Current lifecycle: idle / loading / success / error. */
  status: "idle" | "loading" | "success" | "error";
  /** Markdown body returned by Davis. */
  text: string;
  /** SDK messageToken for feedback (when status==='success'). */
  messageToken?: string;
  /** Structured error info (when status==='error'). */
  errorDetail?: DavisError;
  /** Fire the call. Replaces any prior result. */
  generate: (userPrompt: string) => Promise<void>;
  /** Reset to idle (e.g. when the modal closes). */
  reset: () => void;
}

function classifyError(err: unknown): DavisError {
  const e = err as {
    response?: { status?: number };
    body?: { error?: { message?: string }; message?: string };
    message?: string;
  };
  const status = e?.response?.status ?? 0;
  const bodyMsg = e?.body?.error?.message ?? e?.body?.message;
  const fallbackMsg = e?.message ?? String(err);
  const message = (bodyMsg || fallbackMsg).slice(0, 240);
  let hint: string;
  switch (status) {
    case 401: hint = "Unauthorized. Sign out and back in."; break;
    case 403: hint = "Forbidden. The OAuth token is missing davis-copilot:conversations:execute. Sign out and back in to re-grant the scope."; break;
    case 404: hint = "Davis CoPilot may not be enabled on this tenant. Ask an admin to enable it."; break;
    case 429: hint = "Rate-limited. Wait a few minutes — Davis allows 25 questions/user/15min."; break;
    case 0:   hint = "Network error. Check connectivity."; break;
    default:  hint = `Unexpected error (HTTP ${status}).`;
  }
  return { status, message, hint };
}

export function useAiReport(ctx: ReportContext): UseAiReportResult {
  const [status, setStatus] = useState<UseAiReportResult["status"]>("idle");
  const [text, setText] = useState("");
  const [messageToken, setMessageToken] = useState<string | undefined>(undefined);
  const [errorDetail, setErrorDetail] = useState<DavisError | undefined>(undefined);

  const generate = useCallback(async (userPrompt: string) => {
    if (!userPrompt.trim()) return;
    setStatus("loading");
    setText("");
    setMessageToken(undefined);
    setErrorDetail(undefined);

    const { text: promptText, supplementary, instruction } = buildReportPrompt(ctx, userPrompt);
    const context: { type: "supplementary" | "document-retrieval" | "instruction"; value: string }[] = [
      { type: "instruction", value: instruction },
      { type: "document-retrieval", value: "dynatrace" },
    ];
    if (supplementary) {
      context.unshift({ type: "supplementary", value: supplementary });
    }

    try {
      const resp = await publicClient.recommenderConversation({
        body: {
          text: promptText,
          context,
          annotations: {
            origin_app: "my.pulse.assessment",
            request_type: "full_report",
          },
        },
      });

      if (Array.isArray(resp)) {
        // eslint-disable-next-line no-console
        console.warn("[AI Report] unexpected event-stream response");
        setStatus("error");
        setErrorDetail({ status: 0, message: "Unexpected event-stream response", hint: "Davis returned a streaming response when JSON was expected." });
        return;
      }
      if (!resp || resp.status === "FAILED" || !resp.text) {
        // eslint-disable-next-line no-console
        console.warn("[AI Report] FAILED or empty:", resp);
        const metaSummary = resp?.metadata
          ? ` Metadata: ${JSON.stringify(resp.metadata).slice(0, 200)}`
          : "";
        setStatus("error");
        setErrorDetail({
          status: 0,
          message: `Response status: ${resp?.status ?? "empty"}.${metaSummary}`,
          hint: "Davis processed the request but produced no usable answer. Try rephrasing your request more naturally (e.g. start with 'Can you help me...').",
        });
        return;
      }

      setText(resp.text);
      setMessageToken(resp.messageToken);
      setStatus("success");
    } catch (err) {
      const classified = classifyError(err);
      // eslint-disable-next-line no-console
      console.warn("[AI Report] call failed:", classified, err);
      setStatus("error");
      setErrorDetail(classified);
    }
  }, [ctx]);

  const reset = useCallback(() => {
    setStatus("idle");
    setText("");
    setMessageToken(undefined);
    setErrorDetail(undefined);
  }, []);

  return { status, text, messageToken, errorDetail, generate, reset };
}
