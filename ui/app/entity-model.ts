// ui/app/entity-model.ts
//
// Smartscape entity model — run the assessment on environments WITHOUT the
// classic entity tables (`fetch dt.entity.*` answers UNKNOWN_DATA_OBJECT).
//
// Same contract as Trace Proxy Mode (./trace-proxy.ts):
//   - a criterion whose classic query has a Smartscape equivalent is REWRITTEN
//     (same id, same tier, same target);
//   - a criterion with no equivalent is EXCLUDED: it leaves the scoring
//     denominator, it is never counted as a failure;
//   - the mode switches on by itself from one probe, and the screen says so.
//
// Every rewrite below was run side by side with its classic original on a
// reference environment that has both models (2026-11-18):
//   hosts 30 = 30 · processes 1172 ≈ 1171 · clusters 4 = 4 · namespaces 47 ≈ 46
//   hosts with a network interface 30 = 30 · hosts with a disk 29 = 29
//   hosts with a process 30 = 30 · clusters with namespaces 4 = 4
//   namespaces with workloads 33 ≈ 30 · HTTP monitors 8 = 8 · browser monitors 8 = 8
//   synthetic locations 95 ≈ 94 · process groups 564 ≈ 563 · OneAgents 30 = 30
// Two differ by definition, not by error:
//   services  141 → 110: Smartscape SERVICE has no database, external or queue
//             listener services; ratios over services move by a few points.
//   web apps  7 → 16: classic lists applications seen in the timeframe,
//             Smartscape lists every configured web frontend.
// Signal dimensions (dt.entity.host on metrics, logs, spans…) have a
// dt.smartscape.* twin with the same coverage; they are swapped too.
//
// Not rewritten: Davis problem criteria (they read affected_entity_types and
// classic id prefixes) run unchanged; where the environment cannot answer
// them they report "not assessed".

import type { CapabilityDef, Criterion } from "./queries";

const PARSE_BUILT = "\"LD '.' LD '.' LD '.' TIMESTAMP('yyyyMMdd'):built\"";

/** Classic statement → Smartscape statement, matched on the whole query. */
const STATEMENTS: Record<string, string> = {
  "fetch dt.entity.host | summarize count()":
    "smartscapeNodes HOST | summarize count()",
  "fetch dt.entity.network_interface | fieldsAdd belongs_to = belongs_to[dt.entity.host] | expand belongs_to | summarize count = countDistinct(belongs_to)":
    "smartscapeNodes NETWORK_INTERFACE | traverse belongs_to, HOST | summarize count = countDistinct(id)",
  "fetch dt.entity.process_group_instance | summarize count()":
    "smartscapeNodes PROCESS | summarize count()",
  "fetch dt.entity.kubernetes_cluster | summarize count()":
    "smartscapeNodes K8S_CLUSTER | summarize count()",
  "fetch dt.entity.disk | fieldsAdd belongs_to = belongs_to[dt.entity.host] | expand belongs_to | summarize count = countDistinct(belongs_to)":
    "smartscapeNodes DISK | traverse belongs_to, HOST | summarize count = countDistinct(id)",
  "fetch dt.entity.cloud_application | fieldsAdd ns = belongs_to[dt.entity.cloud_application_namespace] | expand ns | summarize count = countDistinct(ns)":
    "smartscapeNodes K8S_POD | traverse belongs_to, K8S_NAMESPACE | summarize count = countDistinct(id)",
  "fetch dt.entity.cloud_application_namespace | summarize count()":
    "smartscapeNodes K8S_NAMESPACE | summarize count()",
  "fetch dt.entity.process_group_instance | fieldsAdd host = belongs_to[dt.entity.host] | expand host | summarize count = countDistinct(host)":
    "smartscapeNodes PROCESS | traverse runs_on, HOST | summarize count = countDistinct(id)",
  "fetch dt.entity.cloud_application_namespace | fieldsAdd c = clustered_by[dt.entity.kubernetes_cluster] | expand c | filter isNotNull(c) | summarize count = countDistinct(c)":
    "smartscapeNodes K8S_NAMESPACE | traverse belongs_to, K8S_CLUSTER | summarize count = countDistinct(id)",
  "fetch dt.entity.service | summarize count()":
    "smartscapeNodes SERVICE | summarize count()",
  "fetch dt.entity.service | fieldsAdd pgi = runs_on[dt.entity.process_group_instance] | expand pgi | filter isNotNull(pgi) | summarize count = countDistinct(id)":
    "smartscapeNodes SERVICE | traverse runs_on, PROCESS | summarize count = countDistinct(dt.traverse.history[0][id])",
  "fetch dt.entity.application | summarize count()":
    'smartscapeNodes FRONTEND | filter frontend.type == "web" | summarize count()',
  "fetch dt.entity.http_check | summarize count()":
    "smartscapeNodes HTTP_MONITOR | summarize count()",
  "fetch dt.entity.synthetic_test | summarize count()":
    "smartscapeNodes BROWSER_MONITOR | summarize count()",
  "fetch dt.entity.mobile_application | summarize count()":
    'smartscapeNodes FRONTEND | filter frontend.type == "mobile" | summarize count()',
  'fetch dt.entity.application | fieldsAdd type = "web" | append [fetch dt.entity.mobile_application | fieldsAdd type = "mob"] | summarize count()':
    "smartscapeNodes FRONTEND | summarize count()",
  "fetch dt.entity.synthetic_location | summarize count()":
    "smartscapeNodes SYNTHETIC_LOCATION | summarize count()",
  'fetch dt.entity.http_check | fieldsAdd type = "http" | append [fetch dt.entity.synthetic_test | fieldsAdd type = "browser"] | summarize count()':
    "smartscapeNodes HTTP_MONITOR | append [smartscapeNodes BROWSER_MONITOR] | summarize count()",
  "fetch dt.entity.process_group | summarize count()":
    "smartscapeNodes PROCESS | summarize count = countDistinct(dt.process_group.id)",
  [`fetch dt.entity.host | parse installerVersion, ${PARSE_BUILT} | filter built > now() - 365d | summarize count()`]:
    `smartscapeNodes ONEAGENT | parse dt.agent.module.version, ${PARSE_BUILT} | filter built > now() - 365d | summarize count()`,
  "fetch dt.entity.host | filter isNotNull(installerVersion) | summarize count()":
    "smartscapeNodes ONEAGENT | filter isNotNull(dt.agent.module.version) | summarize count()",
};

/** Signal dimensions, longest name first so a prefix never matches early. */
const DIMENSIONS: [RegExp, string][] = [
  [/dt\.entity\.process_group_instance\b/g, "dt.smartscape.process"],
  [/dt\.entity\.cloud_application_namespace\b/g, "dt.smartscape.k8s_namespace"],
  [/dt\.entity\.kubernetes_cluster\b/g, "dt.smartscape.k8s_cluster"],
  [/dt\.entity\.application\b/g, "dt.smartscape.frontend"],
  [/dt\.entity\.service\b/g, "dt.smartscape.service"],
  [/dt\.entity\.host\b/g, "dt.smartscape.host"],
];

/** Why a criterion has no Smartscape form. */
export const SMARTSCAPE_EXCLUSION_REASONS: Record<string, string> = {
  a2: "Service methods are not Smartscape nodes.",
  a12: "Service tags are not exposed as one field on Smartscape SERVICE nodes.",
  sd10: "Ownership is read from classic service tags; Smartscape SERVICE nodes carry no owner field to count.",
  l16: "Custom devices are not part of the Smartscape model.",
};

/** Problem criteria keep their classic field names (see header). */
// Cost & Carbon events carry classic host ids only, so their dimensions stay.
const UNTOUCHED = /fetch dt\.davis\.(problems|events)|dynatrace\.biz\.carbon/;

function rewrite(q: string): string | null {
  if (STATEMENTS[q]) return STATEMENTS[q];
  if (UNTOUCHED.test(q)) return q;
  if (q.includes("fetch dt.entity.")) return null; // classic table with no mapping
  let out = q;
  for (const [re, to] of DIMENSIONS) out = out.replace(re, to);
  return out;
}

export interface SmartscapeModelInfo {
  /** Criteria whose queries now read Smartscape. */
  rewrittenIds: string[];
  /** Criteria removed from the run (and from every denominator). */
  excludedIds: string[];
}

export function applySmartscapeModel(caps: CapabilityDef[]): { caps: CapabilityDef[]; info: SmartscapeModelInfo } {
  const rewrittenIds: string[] = [];
  const excludedIds: string[] = [];
  const out: CapabilityDef[] = [];
  for (const cap of caps) {
    const criteria: Criterion[] = [];
    for (const cr of cap.criteria) {
      const query = SMARTSCAPE_EXCLUSION_REASONS[cr.id] ? null : rewrite(cr.query);
      const queryB = cr.queryB == null ? undefined : rewrite(cr.queryB);
      if (query == null || queryB === null) { excludedIds.push(cr.id); continue; }
      if (query !== cr.query || queryB !== cr.queryB) rewrittenIds.push(cr.id);
      criteria.push({ ...cr, query, ...(queryB !== undefined ? { queryB } : {}) });
    }
    if (criteria.length > 0) out.push({ ...cap, criteria });
  }
  return { caps: out, info: { rewrittenIds, excludedIds } };
}
