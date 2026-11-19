// ui/app/finopsData.ts
//
// What Cost & Carbon Optimization has already written to Grail, aggregated
// for the FinOps report and for the Assist context: the imported cloud bill
// (FOCUS columns) and the energy and carbon measurements per host and cluster.
//
// Loaded on demand only (FinOps report, Smart report): four queries over
// business events, each with a scan ceiling. Nothing here is estimated: every
// figure is a sum or an average of fields the app itself stored.
//
// Units: energy.measurement.* is in Wh and carbon.emissions in g CO2e
// (emissions = energy x carbon.intensity, which the events carry in kg/kWh).
// They are reported as kWh and kg CO2e.

import { queryExecutionClient } from "@dynatrace-sdk/client-query";

export interface FinOpsSpend {
  currency: string;
  /** Effective cost of the latest import (billing period to date). */
  cost: number;
  listCost: number;
  /** Cost covered by a commitment discount. */
  commitmentCost: number;
  /** Cost whose billing tags name an owner or a cost center. */
  ownedCost: number;
  periodStart: string | null;
  periodEnd: string | null;
  importedAt: string | null;
  services: { name: string; cost: number }[];
  regions: { name: string; cost: number }[];
  accounts: { name: string; cost: number }[];
}

export interface FinOpsHost {
  id: string;
  name: string;
  /** Average CPU usage, %. Null when the measurement carries no CPU reading:
   *  such a host is never called idle. */
  cpu: number | null;
  energyKwh: number;
  wastedKwh: number;
  emissionsKg: number;
  region: string | null;
}

export interface FinOpsData {
  spend: FinOpsSpend | null;
  /** Hosts measured in the last 24h, most wasted energy first. */
  hosts: FinOpsHost[];
  /** Hosts whose average CPU is under the idle threshold. */
  idleHosts: FinOpsHost[];
  energyKwh: number;
  wastedKwh: number;
  emissionsKg: number;
  clusters: { name: string; energyKwh: number; emissionsKg: number }[];
  windowHours: number;
  /** True when the host list hit its limit: totals then cover those hosts only. */
  hostsCapped: boolean;
}

/** The idle threshold Cost & Carbon Optimization applies (energy.cpu_idle_threshold). */
export const IDLE_CPU = 3;
/** Most hosts read for the ranked lists. */
const HOST_LIMIT = 1000;

const SRC = (window: string, type: string) =>
  `fetch bizevents, from:now()-${window}, scanLimitGBytes: 50 | filter event.provider == "dynatrace.biz.carbon" and event.type == "${type}"`;

const num = (v: unknown): number => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return 0;
};
const str = (v: unknown): string | null => (v == null || v === "" ? null : String(v));

async function run(query: string, max = 5000): Promise<Record<string, unknown>[] | null> {
  try {
    const res = await queryExecutionClient.queryExecute({ body: { query, requestTimeoutMilliseconds: 50_000, maxResultRecords: max } });
    if (res?.state === "FAILED" || res?.state === "CANCELLED") return null;
    const records = (res?.result as { records?: Record<string, unknown>[] } | undefined)?.records;
    return Array.isArray(records) ? records : null;
  } catch {
    return null;
  }
}

function top(rows: Record<string, unknown>[], key: string, n: number) {
  const m = new Map<string, number>();
  for (const r of rows) { const k = str(r[key]) ?? "Not specified"; m.set(k, (m.get(k) ?? 0) + num(r.cost)); }
  return [...m].map(([name, cost]) => ({ name, cost })).sort((a, b) => b.cost - a.cost).slice(0, n);
}

async function loadSpend(): Promise<FinOpsSpend | null> {
  // The bill is imported once a day as a whole file; 30h always holds the
  // latest import, and grouping by import date keeps a second one out.
  const base = SRC("30h", "cost.real.spend");
  const [totals, parts] = await Promise.all([
    run(`${base} | summarize cost = sum(focus.EffectiveCost), list = sum(focus.ListCost), commit = sum(if(isNotNull(focus.CommitmentDiscountId), focus.EffectiveCost, else: 0)), owned = sum(if(contains(lower(focus.Tags), "owner") or contains(lower(focus.Tags), "cost"), focus.EffectiveCost, else: 0)), currency = takeAny(focus.BillingCurrency), periodStart = min(focus.BillingPeriodStart), periodEnd = max(focus.BillingPeriodEnd), by:{imp = metadata.import.date} | sort imp desc | limit 5`),
    run(`${base} | summarize cost = sum(focus.EffectiveCost), by:{imp = metadata.import.date, service = focus.ServiceName, region = focus.RegionId, account = focus.SubAccountName} | sort imp desc, cost desc | limit 5000`),
  ]);
  if (!totals || totals.length === 0) return null;
  const t = totals[0];
  const mine = (parts ?? []).filter(r => str(r.imp) === str(t.imp));
  return {
    currency: str(t.currency) ?? "",
    cost: num(t.cost), listCost: num(t.list), commitmentCost: num(t.commit), ownedCost: num(t.owned),
    periodStart: str(t.periodStart), periodEnd: str(t.periodEnd), importedAt: str(t.imp),
    services: top(mine, "service", 10), regions: top(mine, "region", 6), accounts: top(mine, "account", 6),
  };
}

async function loadHosts(): Promise<FinOpsHost[]> {
  const agg = `${SRC("24h", "carbon.measurement")} | summarize cpu = avg(utilization.cpu.average), energy = sum(energy.measurement.total), wasted = sum(energy.measurement.total_wasted), emissions = sum(carbon.emissions), region = takeAny(cloud.region), by:{host = dt.entity.host}`;
  // Host names come from the classic entity model; without it the id is shown.
  const rows = (await run(`${agg} | fieldsAdd name = entityName(host, type: "dt.entity.host") | sort wasted desc | limit ${HOST_LIMIT}`))
    ?? (await run(`${agg} | sort wasted desc | limit ${HOST_LIMIT}`)) ?? [];
  return rows.map(r => ({
    id: str(r.host) ?? "", name: str(r.name) ?? str(r.host) ?? "",
    cpu: r.cpu == null || r.cpu === "" ? null : num(r.cpu), energyKwh: num(r.energy) / 1000, wastedKwh: num(r.wasted) / 1000, emissionsKg: num(r.emissions) / 1000,
    region: str(r.region),
  }));
}

async function loadClusters() {
  const rows = (await run(`${SRC("24h", "carbon.measurement.k8s.cluster")} | summarize energy = sum(energy.measurement.total), emissions = sum(carbon.emissions), by:{name = k8s.cluster.name} | sort emissions desc | limit 50`)) ?? [];
  return rows.map(r => ({ name: str(r.name) ?? "", energyKwh: num(r.energy) / 1000, emissionsKg: num(r.emissions) / 1000 }));
}

/** Null when Cost & Carbon Optimization has written nothing readable. */
export async function loadFinOpsData(): Promise<FinOpsData | null> {
  const [spend, hosts, clusters] = await Promise.all([loadSpend(), loadHosts(), loadClusters()]);
  if (!spend && hosts.length === 0 && clusters.length === 0) return null;
  const sum = (f: (h: FinOpsHost) => number) => hosts.reduce((t, h) => t + f(h), 0);
  return {
    spend, hosts, clusters,
    idleHosts: hosts.filter((h): h is FinOpsHost & { cpu: number } => h.cpu != null && h.cpu < IDLE_CPU).sort((a, b) => a.cpu - b.cpu),
    energyKwh: sum(h => h.energyKwh), wastedKwh: sum(h => h.wastedKwh), emissionsKg: sum(h => h.emissionsKg),
    windowHours: 24,
    hostsCapped: hosts.length >= HOST_LIMIT,
  };
}

const pct = (a: number, b: number) => (b > 0 ? Math.floor((a / b) * 1000) / 10 : 0);
const money = (n: number, c: string) => `${c} ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`.trim();

/** The same facts as plain text, for the Assist context. */
export function finopsNote(d: FinOpsData): string {
  // The guard goes first: a long note is clamped from the end, never from here.
  const lines: string[] = ["FinOps data from Cost & Carbon Optimization (measured, not estimated). There is no data on what a change would save: do not estimate savings."];
  const s = d.spend;
  if (s) {
    lines.push(`- Cloud bill imported, billing period to date: effective cost ${money(s.cost, s.currency)}, list cost ${money(s.listCost, s.currency)}.`);
    lines.push(`- ${pct(s.commitmentCost, s.cost)}% of the cost is under a commitment discount; ${pct(s.ownedCost, s.cost)}% carries an owner or cost-center tag.`);
    lines.push(`- Top services by cost: ${s.services.slice(0, 6).map(x => `${x.name} ${money(x.cost, s.currency)}`).join("; ")}.`);
    lines.push(`- Cost by region: ${s.regions.slice(0, 4).map(x => `${x.name} ${money(x.cost, s.currency)}`).join("; ")}.`);
  } else {
    lines.push("- No cloud bill has been imported, so there is no cost figure.");
  }
  if (d.hosts.length > 0) {
    lines.push(`- Last ${d.windowHours}h: ${d.hostsCapped ? `the ${d.hosts.length} hosts with the most wasted energy` : `${d.hosts.length} hosts measured`}, ${d.energyKwh.toFixed(1)} kWh used, ${d.wastedKwh.toFixed(1)} kWh classified as wasted (${pct(d.wastedKwh, d.energyKwh)}%), ${d.emissionsKg.toFixed(1)} kg CO2e.`);
    lines.push(`- ${d.idleHosts.length} hosts average under ${IDLE_CPU}% CPU (idle)${d.idleHosts.length ? `: ${d.idleHosts.slice(0, 8).map(h => `${h.name} ${(Math.floor((h.cpu ?? 0) * 10) / 10).toFixed(1)}%`).join("; ")}` : ""}.`);
  }
  if (d.clusters.length > 0) lines.push(`- Kubernetes clusters by emissions: ${d.clusters.slice(0, 5).map(c => `${c.name} ${c.emissionsKg.toFixed(1)} kg CO2e`).join("; ")}.`);
  return lines.join("\n");
}
