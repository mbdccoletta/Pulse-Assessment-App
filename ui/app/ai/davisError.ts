// ui/app/ai/davisError.ts
//
// One shape for every failure of a Davis CoPilot call, with a hint the person
// in front of the screen can act on.

export interface DavisError {
  /** HTTP status code if available, or 0 for network errors. */
  status: number;
  /** Concise message — the API body's `message` field when present, else
   *  the SDK error's message. Safe to render in the UI. */
  message: string;
  /** SE-actionable hint based on status code. */
  hint: string;
}

/** Convert any thrown error into a structured DavisError. */
export function classifyError(err: unknown): DavisError {
  // SDK errors carry response.status and body.
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
    case 401:
      hint = "Unauthorized. Your session expired — sign out and back in.";
      break;
    case 403:
      hint = "Forbidden. The OAuth token is missing the davis-copilot:conversations:execute scope. Sign out and back in to re-grant the scope, or contact your admin if the scope was rejected.";
      break;
    case 404:
      hint = "Not found. Davis CoPilot is likely not enabled on this tenant. Ask an admin to enable Davis CoPilot, or verify the feature is in your subscription.";
      break;
    case 429:
      hint = "Rate-limited. Davis CoPilot caps usage at 25 questions per user and 60 per environment per 15 minutes. Wait a few minutes.";
      break;
    case 500:
    case 502:
    case 503:
      hint = "Davis CoPilot service error. Retry in a minute.";
      break;
    case 0:
      hint = "Network error. Check connectivity to the Dynatrace tenant.";
      break;
    case 400:
      hint = "The request was rejected as invalid, usually because it is too long. Ask a shorter question.";
      break;
    default:
      hint = `Unexpected error (HTTP ${status}). See the raw message above.`;
  }
  return { status, message, hint };
}
