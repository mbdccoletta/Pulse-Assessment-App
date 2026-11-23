// ui/app/shared-scans.ts
//
// One Grail scan for a family of criteria that read the same records.
//
// Several criteria fetch the same table over the same window and differ only
// in a filter: "services with spans", "with root spans", "with db spans"...
// Each one used to scan the window again. Grail bills the scan, not the
// arithmetic, so one query that computes every member's number in one pass
// costs what a single member costs (measured on a ~20,000-host estate: one
// member 898 GiB, seven members together 898 GiB).
//
// Every field below is the exact same number as its member query: same
// window, same filter, same distinct key. The members keep their own DQL in
// the catalog, the reports and the 24h cache; only execution is shared.
//
// Two families are shared: the log breadth criteria and the AI span criteria.
// Since 3.0.13 every other span criterion reads the service metrics instead. The AI reads are unsampled in every mode (the
// signal is too sparse to sample) and get the same window, so the shared scan
// returns exactly what each member would.

const SVC = "coalesce(dt.entity.service, service.name)";
const LOGS = "fetch logs | filter timestamp > now() - 2h";
/** Same machine identity as ./otel-mode.ts. */
const HOST_KEY = "coalesce(k8s.node.name, host.name)";
const AI = "isNotNull(gen_ai.system) or isNotNull(gen_ai.provider.name) or isNotNull(gen_ai.request.model) or isNotNull(gen_ai.operation.name)";
const AI_SPANS = `fetch spans, from:now()-72h | filter ${AI}`;

export interface SharedScan {
  /** The one query that runs. Returns a single record with one field per member. */
  base: string;
  /** Member query (exactly as in the catalog) → field of the base record. */
  members: Record<string, string>;
}

export const SHARED_SCANS: SharedScan[] = [
  {
    // Distinct things that sent logs: one read for every log breadth
    // criterion, OneAgent entities and OpenTelemetry names alike. Each field is
    // the same countDistinct over the same records as its member (a filter
    // before countDistinct equals countDistinct of if(): nulls are not counted).
    base: `${LOGS} | summarize hosts = countDistinct(dt.entity.host), services = countDistinct(dt.entity.service),`
      + " sources = countDistinct(log.source), levels = countDistinct(loglevel), namespaces = countDistinct(k8s.namespace.name),"
      + ' errorServices = countDistinct(if(loglevel == "ERROR", dt.entity.service)),'
      + " cloudHosts = countDistinct(if(isNotNull(cloud.provider), dt.entity.host)),"
      + ` keyHosts = countDistinct(${HOST_KEY}), cloudKeyHosts = countDistinct(if(isNotNull(cloud.provider), ${HOST_KEY})),`
      + " anySources = countDistinct(coalesce(log.source, log.file.path, service.name))",
    members: {
      [`${LOGS} | filter isNotNull(dt.entity.host) | summarize count = countDistinct(dt.entity.host) | fields count`]: "hosts",
      [`${LOGS} | filter isNotNull(dt.entity.service) | summarize count = countDistinct(dt.entity.service) | fields count`]: "services",
      [`${LOGS} | summarize countDistinct(log.source)`]: "sources",
      [`${LOGS} | summarize countDistinct(loglevel)`]: "levels",
      [`${LOGS} | filter isNotNull(k8s.namespace.name) | summarize countDistinct(k8s.namespace.name)`]: "namespaces",
      [`${LOGS} | filter loglevel == "ERROR" | filter isNotNull(dt.entity.service) | summarize count = countDistinct(dt.entity.service) | fields count`]: "errorServices",
      [`${LOGS} | filter isNotNull(cloud.provider) | summarize count = countDistinct(dt.entity.host) | fields count`]: "cloudHosts",
      // OpenTelemetry and Mixed readings (./otel-mode.ts)
      [`${LOGS} | fieldsAdd k = ${HOST_KEY} | filter isNotNull(k) | summarize count = countDistinct(k) | fields count`]: "keyHosts",
      [`${LOGS} | filter isNotNull(cloud.provider) | fieldsAdd k = ${HOST_KEY} | filter isNotNull(k) | summarize count = countDistinct(k) | fields count`]: "cloudKeyHosts",
      [`${LOGS} | summarize countDistinct(coalesce(log.source, log.file.path, service.name))`]: "anySources",
    },
  },
  {
    // AI spans. Read over the same window as each member (4 hours once the
    // cost rules shape it). Tool calls (ai10) are a presence check with their
    // own 72-hour window, so they are read on their own.
    base: `${AI_SPANS} | summarize spans = count(), services = countDistinct(${SVC}),`
      + " providers = countDistinct(coalesce(gen_ai.system, gen_ai.provider.name)),"
      + " tokens = countIf(isNotNull(gen_ai.usage.input_tokens) or isNotNull(gen_ai.usage.output_tokens)),"
      + " tokensModel = countIf((isNotNull(gen_ai.usage.input_tokens) or isNotNull(gen_ai.usage.output_tokens)) and (isNotNull(gen_ai.request.model) or isNotNull(gen_ai.response.model))),"
      + " responseModel = countIf(isNotNull(gen_ai.response.model)),"
      + " agent = countIf(isNotNull(gen_ai.agent.name)),"
      + " content = countIf(isNotNull(gen_ai.prompt) or isNotNull(gen_ai.completion) or isNotNull(gen_ai.input.messages) or isNotNull(gen_ai.output.messages)),"
      + ' errors = countIf(status_code == "ERROR"),'
      + " guardrail = countIf(isNotNull(gen_ai.guardrail))",
    members: {
      [`${AI_SPANS} | summarize count = countDistinct(${SVC}) | fields count`]: "services",
      [`${AI_SPANS} | summarize count()`]: "spans",
      [`${AI_SPANS} | fieldsAdd provider = coalesce(gen_ai.system, gen_ai.provider.name) | summarize countDistinct(provider)`]: "providers",
      [`${AI_SPANS} | filter isNotNull(gen_ai.usage.input_tokens) or isNotNull(gen_ai.usage.output_tokens) | summarize count()`]: "tokens",
      [`${AI_SPANS} | filter isNotNull(gen_ai.usage.input_tokens) or isNotNull(gen_ai.usage.output_tokens) | filter isNotNull(gen_ai.request.model) or isNotNull(gen_ai.response.model) | summarize count()`]: "tokensModel",
      [`${AI_SPANS} | filter isNotNull(gen_ai.response.model) | summarize count()`]: "responseModel",
      [`${AI_SPANS} | filter isNotNull(gen_ai.agent.name) | summarize count()`]: "agent",
      [`${AI_SPANS} | filter isNotNull(gen_ai.prompt) or isNotNull(gen_ai.completion) or isNotNull(gen_ai.input.messages) or isNotNull(gen_ai.output.messages) | summarize count()`]: "content",
      [`${AI_SPANS} | filter status_code == "ERROR" | summarize count()`]: "errors",
      [`${AI_SPANS} | filter isNotNull(gen_ai.guardrail) | summarize count()`]: "guardrail",
    },
  },
];

const BY_MEMBER = new Map<string, { scan: SharedScan; field: string }>();
for (const scan of SHARED_SCANS) for (const [q, field] of Object.entries(scan.members)) BY_MEMBER.set(q.trim(), { scan, field });

/** The shared scan a catalog query belongs to, if any. */
export function sharedScanFor(query: string): { scan: SharedScan; field: string } | undefined {
  return BY_MEMBER.get(query.trim());
}
