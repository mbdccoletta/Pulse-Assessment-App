// Renderiza CapabilityCards REAL, offline, e imprime o resultado.
// Sem tenant, sem browser — a verificação que deveria preceder todo deploy.
(globalThis as any).MutationObserver = class { observe(){} disconnect(){} takeRecords(){return []} };
(globalThis as any).ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
(globalThis as any).matchMedia = () => ({ matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { CapabilityCards } from "../ui/app/components/CapabilityCards";
import type { CapabilityResult } from "../ui/app/hooks/useCoverageData";

const cap = (name: string, color: string, score: number, util: number, n: number): CapabilityResult => ({
  name, color, score, rawScore: score, details: [],
  criteriaResults: Array.from({ length: n }, (_, i) => ({
    id: `${name[0]}${i}`, label: `check ${i}`, description: "", value: 0,
    points: i < Math.round(n * score / 100) ? 1 : 0, error: false, notAssessed: false,
    query: "", thresholds: "", tier: "foundation" as const, isRatio: false, proxied: false,
  })),
  assessedCount: n, notAssessedCount: 0,
  utilization: { foundation: { total: 3, passed: 2 }, bestPractice: { total: 4, passed: 2 },
    excellence: { total: 3, passed: 1 }, level: 1, levelLabel: "Foundation",
    utilizationScore: util, utilizationBand: "Moderate" },
  consolidation: 100, effectiveUtilizationScore: util,
});

// Valores reais lidos da tenant em 29/09.
const capabilities = [
  cap("Infrastructure Observability", "#3B82F6", 100, 90, 22),
  cap("Digital Experience", "#EC4899", 82, 70, 11),
  cap("Threat Observability", "#F97316", 91, 40, 11),
  cap("Application Security", "#EF4444", 64, 45, 11),
];
const adoption = {
  "Infrastructure Observability": { users: 6, rate: 16 },
  "Digital Experience": { users: 3, rate: 8 },
  "Threat Observability": { users: 9, rate: 24 },
  "Application Security": { users: 0, rate: 0 },
};

const html = renderToStaticMarkup(
  React.createElement(CapabilityCards, {
    capabilities, anim: 1, activeIdx: null, onSelect: () => {},
    adoptionByCapability: adoption, adoptionTotalUsers: 37, adoptionWindowDays: 30,
  })
);
const out = process.env.PROBE_HTML;
if (out) {
  writeFileSync(out, `<!doctype html><meta charset="utf-8"><title>Pulse cards</title>
<style>body{margin:0;padding:20px;background:#0f1114}
.n{color:#9aa4b2;font:13px/1.5 system-ui;margin:0 0 14px}
.w{max-width:440px;background:#161a20;border-radius:10px;padding:8px}</style>
<p class="n">Cards reais do app. A faixa colorida sob o nome e o veredicto.</p><div class="w">${html}</div>`);
  console.log("HTML:", out);
}
const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
console.log("\n--- RENDERIZADO ---\n" + text.slice(0, 900));
