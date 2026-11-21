// Environment probes run before the first assessment: does the tenant have
// Traces on Grail, and does it have the classic entity model? The answers pick
// the catalog (Trace Proxy Mode, Smartscape) with no setup step.
import { queryExecutionClient } from "@dynatrace-sdk/client-query";
import { isDevEnvironment } from "./useDevMode";
import type { TelemetryProfile, TelemetrySource } from "../telemetry";

/** Tenant-level entitlement failures (e.g. TRACE_QUERY_ENTITLEMENT_MISSING /
 *  exceptionType ENTITLEMENT-MISSING) are NOT scope problems — granting
 *  OAuth scopes cannot fix them. They get their own status so the UI can
 *  offer Trace Proxy Mode instead of the misleading "grant scopes" advice. */
function isEntitlementError(detail: string): boolean {
  return detail.toUpperCase().includes("ENTITLEMENT");
}

/** Tenants on the Smartscape entity model do not expose the classic
 *  `dt.entity.*` tables at all: the query fails to parse with
 *  UNKNOWN_DATA_OBJECT ("dt.entity.host isn't a valid data object").
 *
 *  This is neither a scope nor an entitlement problem — no permission can
 *  conjure a table that the tenant does not have — so it gets its own status.
 *  Reported as issue #1 by a user who had hosts running and was told to grant
 *  scopes. */
function isClassicEntityModelMissing(detail: string): boolean {
  const d = detail.toUpperCase();
  return d.includes("UNKNOWN_DATA_OBJECT") && d.includes("DT.ENTITY.");
}

/** Everything the SDK error carries, flattened into one searchable string.
 *
 *  The query client throws `ClientRequestError`, which puts the parsed error
 *  envelope in `body` — `message` is generic. Classifying on `message` alone
 *  therefore never saw TRACE_QUERY_ENTITLEMENT_MISSING: a tenant without
 *  Traces on Grail was told to grant scopes (which cannot fix an entitlement)
 *  and Trace Proxy Mode was never offered — the exact case it exists for. */
function errorText(err: unknown): string {
  const e = err as Record<string, unknown> | null;
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (v == null) return;
    if (typeof v === "string") { parts.push(v); return; }
    try { parts.push(JSON.stringify(v)); } catch { /* circular — skip */ }
  };
  push(e?.message);
  push(e?.body);
  push(e?.cause);
  push(e?.details);
  if (parts.length === 0) parts.push(String(err));
  return parts.join(" | ");
}

/** The human-readable line out of the envelope, so the UI shows
 *  "Querying spans requires ... Trace query entitlement." instead of raw JSON. */
function humanDetail(err: unknown): string {
  const env = (err as { body?: { error?: { message?: string; details?: { errorMessage?: string } } } })?.body?.error;
  const msg = env?.details?.errorMessage || env?.message || (err as { message?: string })?.message;
  const out = msg ? String(msg) : String(err);
  return out.length > 160 ? out.slice(0, 160) + "…" : out;
}

/** Dev-only simulation of a tenant without Traces on Grail, so Trace Proxy
 *  Mode can be tested on any tenant (which HAS spans). Never active outside
 *  the dev environment — a customer tenant cannot trip this. */
function simulateNoTraces(): boolean {
  if (!isDevEnvironment()) return false;
  try {
    if (typeof window === "undefined") return false;
    const p = new URLSearchParams(window.location.search).get("noTraces");
    if (p === "1" || p === "true") return true;
    return window.localStorage.getItem("cca.noTraces") === "1";
  } catch {
    return false;
  }
}

/** `entitlement` is decided here, on the raw error, and carried out — the
 *  caller must not re-derive it from `detail`, which is human-facing text. */
async function probeQuery(query: string): Promise<{ ok: boolean; detail: string; entitlement: boolean; noClassicEntities: boolean }> {
  try {
    const response = await queryExecutionClient.queryExecute({
      body: { query, requestTimeoutMilliseconds: 15000, maxResultRecords: 1 },
    });
    const state = response?.state;
    if (state === "FAILED" || state === "CANCELLED") {
      const notes = (response?.result as any)?.metadata?.grail?.notifications ?? [];
      const msg = notes.map((n: any) => n.message).join("; ") || `Query ${state}`;
      return { ok: false, detail: msg, entitlement: isEntitlementError(msg), noClassicEntities: isClassicEntityModelMissing(msg) };
    }
    return { ok: true, detail: "Access confirmed", entitlement: false, noClassicEntities: false };
  } catch (err: unknown) {
    // Classify on the WHOLE error, not just `message` — see errorText above.
    const haystack = errorText(err);
    // Entitlement first: it is also a 403, so the scope branch below would
    // otherwise swallow it and give advice that cannot work.
    if (isClassicEntityModelMissing(haystack))
      return { ok: false, detail: humanDetail(err), entitlement: false, noClassicEntities: true };
    if (isEntitlementError(haystack))
      return { ok: false, detail: humanDetail(err), entitlement: true, noClassicEntities: false };
    if (haystack.includes("403") || haystack.includes("Forbidden") || haystack.includes("permission"))
      return { ok: false, detail: "Permission denied — scope not granted to this app", entitlement: false, noClassicEntities: false };
    if (haystack.includes("401") || haystack.includes("Unauthorized"))
      return { ok: false, detail: "Authentication failed — app token may be invalid", entitlement: false, noClassicEntities: false };
    return { ok: false, detail: humanDetail(err), entitlement: false, noClassicEntities: false };
  }
}

/** One cheap probe: does this tenant lack the Traces on Grail entitlement?
 *  Used to switch Trace Proxy Mode on by itself, before the first run.
 *  Any other outcome (spans readable, a scope problem, a network error)
 *  answers false: the normal catalog runs and each criterion reports for itself. */
export async function tracesNotEntitled(): Promise<boolean> {
  if (simulateNoTraces()) return true;
  const r = await probeQuery("fetch spans | limit 1 | summarize count()");
  return !r.ok && r.entitlement;
}

/** Dev-only simulation of an environment without the classic entity tables. */
function simulateNoClassicEntities(): boolean {
  if (!isDevEnvironment()) return false;
  try {
    if (typeof window === "undefined") return false;
    const p = new URLSearchParams(window.location.search).get("noEntities");
    return p === "1" || p === "true" || window.localStorage.getItem("cca.noEntities") === "1";
  } catch {
    return false;
  }
}

/** One cheap probe: does this environment lack the classic entity model
 *  (`fetch dt.entity.*`)? Then the run reads Smartscape (../entity-model.ts). */
export async function classicEntitiesMissing(): Promise<boolean> {
  if (simulateNoClassicEntities()) return true;
  const r = await probeQuery("fetch dt.entity.host | limit 1 | summarize count()");
  return !r.ok && r.noClassicEntities;
}

/** Dev-only simulation of an environment fed only by OpenTelemetry. */
function simulatePureOtel(): boolean {
  if (!isDevEnvironment()) return false;
  try {
    if (typeof window === "undefined") return false;
    const p = new URLSearchParams(window.location.search).get("pureOtel") ?? window.localStorage.getItem("cca.pureOtel");
    return p === "1" || p === "true" || p === "metrics";
  } catch {
    return false;
  }
}

/** Where the telemetry comes from: OneAgent only, OpenTelemetry only, or both.
 *  One free probe (metric series only). Hosts are matched by their short
 *  lower-case name, so a host that both OneAgent and OpenTelemetry report is
 *  counted once, on the OneAgent side. A failed probe answers "oneagent": the
 *  default catalog runs. With `noEntities` (no classic entity model) a mixed
 *  estate is read as OneAgent, because the mixed readings need host entity names. */
export async function detectTelemetry(noEntities = false): Promise<TelemetryProfile> {
  const none = (source: TelemetrySource): TelemetryProfile => ({ source, oneAgentHosts: 0, otelOnlyHosts: 0, sharedHosts: 0 });
  const forced = simulatedSource();
  if (forced) return none(forced);
  const short = (x: string) => `splitString(lower(${x}), ".")[0]`;
  const otel = (m: string) => `timeseries v = avg(${m}), by:{host.name, k8s.node.name, dt.entity.host} | filter isNull(dt.entity.host) | fields k = ${short("coalesce(k8s.node.name, host.name)")}, src = "otel"`;
  const query = [
    `timeseries v = avg(dt.host.cpu.usage), by:{dt.entity.host} | fields k = ${noEntities ? "toString(dt.entity.host)" : short("entityName(dt.entity.host)")}, src = "oa"`,
    ...["system.cpu.time", "system.cpu.utilization", "system.memory.utilization"].map(m => ` | append [${otel(m)}]`),
    ` | append [timeseries v = avg(k8s.node.cpu.usage), by:{k8s.node.name} | fields k = ${short("k8s.node.name")}, src = "otel"]`,
    ' | filter isNotNull(k) | summarize s = collectDistinct(src), by:{k}',
    ' | summarize oneAgent = countIf(in("oa", s)), otelOnly = countIf(not(in("oa", s))), shared = countIf(in("oa", s) and in("otel", s))',
  ].join("");
  try {
    const response = await queryExecutionClient.queryExecute({ body: { query, requestTimeoutMilliseconds: 20000, maxResultRecords: 1 } });
    if (response?.state !== "SUCCEEDED") return none("oneagent");
    const rec = (response.result as { records?: Record<string, unknown>[] } | undefined)?.records?.[0] ?? {};
    const oa = Number(rec.oneAgent ?? 0), ot = Number(rec.otelOnly ?? 0), sh = Number(rec.shared ?? 0);
    const source: TelemetrySource = oa === 0 && ot > 0 ? "otel" : oa > 0 && ot > 0 && !noEntities ? "mixed" : "oneagent";
    return { source, oneAgentHosts: oa, otelOnlyHosts: ot, sharedHosts: sh };
  } catch {
    return none("oneagent");
  }
}

/** Dev-only: force the source ("?telemetry=otel|mixed|oneagent"), as the older "pureOtel" switch did for "otel". */
function simulatedSource(): TelemetrySource | null {
  if (!isDevEnvironment()) return null;
  try {
    const t = new URLSearchParams(window.location.search).get("telemetry") ?? window.localStorage.getItem("cca.telemetry");
    if (t === "otel" || t === "mixed" || t === "oneagent") return t;
    return simulatePureOtel() ? "otel" : null;
  } catch {
    return null;
  }
}

/** One free probe: is this environment fed without OneAgent? True when no host
 *  reports the OneAgent host metric in the last two hours. Then the run reads
 *  hosts and Kubernetes from the OpenTelemetry signals (../otel-mode.ts).
 *  A failed probe answers false: the default catalog runs. */
/** True when the simulation asked to leave out the criteria that scan logs ("pureOtel=metrics"). */
export function simulatedOtelSkipsLogScans(): boolean {
  if (!isDevEnvironment()) return false;
  try {
    return (new URLSearchParams(window.location.search).get("pureOtel") ?? window.localStorage.getItem("cca.pureOtel")) === "metrics"
      || window.localStorage.getItem("cca.skipLogScans") === "1";
  } catch {
    return false;
  }
}

export async function oneAgentAbsent(): Promise<boolean> {
  if (simulatePureOtel()) return true;
  try {
    const response = await queryExecutionClient.queryExecute({
      body: { query: "timeseries v = avg(dt.host.cpu.usage), by:{dt.entity.host} | summarize c = count()", requestTimeoutMilliseconds: 15000, maxResultRecords: 1 },
    });
    if (response?.state !== "SUCCEEDED") return false;
    const rec = (response.result as { records?: Record<string, unknown>[] } | undefined)?.records?.[0];
    if (!rec) return true;
    const v = Object.values(rec).find(x => typeof x === "number" || typeof x === "string" || typeof x === "bigint");
    return Number(v ?? 0) === 0;
  } catch {
    return false;
  }
}
