import { build } from "esbuild";
import { writeFileSync } from "node:fs";
const r = await build({ stdin: { contents: `
import { CAPABILITIES } from "./ui/app/queries";
import { CRITERION_TIERS } from "./ui/app/data/criterionTiers";
import { passLine } from "./ui/app/passLine";
const TIER = { foundation: "Foundation", bestPractice: "Best practice", excellence: "Excellence" };
const ORDER = ["foundation", "bestPractice", "excellence"];
const esc = s => String(s).replace(/\\|/g, "\\\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let out = [];
let total = 0, kinds = { share: 0, presence: 0, config: 0 };
const sections = [];
for (const c of CAPABILITIES) {
  const rows = [...c.criteria].sort((a, b) => ORDER.indexOf(CRITERION_TIERS[a.id]) - ORDER.indexOf(CRITERION_TIERS[b.id]));
  const lines = [];
  const t = { foundation: 0, bestPractice: 0, excellence: 0 };
  for (const k of rows) {
    total++; t[CRITERION_TIERS[k.id]]++;
    const config = /^(settings:count|slos:count)/.test(k.query) && !k.queryB;
    const presence = !k.queryB && (k.denominatorConstant == null || k.denominatorConstant === 1);
    const line = passLine(k.thresholds.map(x => x.min), "middle");
    let reading, target;
    if (config) { kinds.config++; reading = "Configuration count"; target = "At least 1"; }
    else if (presence) { kinds.presence++; reading = "Presence"; target = "At least 1"; }
    else { kinds.share++; reading = k.queryB ? "Share" : "Share of " + k.denominatorConstant; target = line + "%"; }
    lines.push("| " + [esc(k.label.replace(/\\s*\\(%\\)\\s*$/, "")), TIER[CRITERION_TIERS[k.id]], reading, target, esc(k.description)].join(" | ") + " |");
  }
  sections.push({ name: c.name, n: rows.length, t, lines });
}
globalThis.__o = { sections, total, kinds };
`, resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent" });
await import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
const { sections, total, kinds } = globalThis.__o;
let md = `# Criteria summary

Every criterion the assessment reads: ${total} criteria across ${sections.length} capabilities. This file is generated from the catalog (\`ui/app/queries.ts\`, \`ui/app/data/criterionTiers.ts\`, \`ui/app/passLine.ts\`); regenerate it when the catalog changes rather than editing it by hand.

## How to read the tables

| Column | Meaning |
|---|---|
| Tier | Foundation, Best practice or Excellence. Utilization weighs them 60 / 25 / 15 and gates them (see \`SCORING-CALCULATIONS.md\`) |
| Reading | **Share**: a numerator over a denominator, as a percentage. **Share of N**: a count over a fixed number. **Presence**: is there at least one. **Configuration count**: read from the settings API or the SLO service, with no Grail scan |
| Met at | The value the criterion must reach. For a share with three targets it is the middle one |

A criterion that cannot be measured in the environment is not assessed: it leaves the score and is never counted as not met.

Readings by kind: ${kinds.share} shares, ${kinds.presence} presence checks, ${kinds.config} configuration counts.

## Capabilities

| Capability | Criteria | Foundation | Best practice | Excellence |
|---|---|---|---|---|
${sections.map(s => `| ${s.name} | ${s.n} | ${s.t.foundation} | ${s.t.bestPractice} | ${s.t.excellence} |`).join("\n")}
| **Total** | **${total}** | **${sections.reduce((a, s) => a + s.t.foundation, 0)}** | **${sections.reduce((a, s) => a + s.t.bestPractice, 0)}** | **${sections.reduce((a, s) => a + s.t.excellence, 0)}** |
`;
for (const s of sections) md += `\n## ${s.name}\n\n| Criterion | Tier | Reading | Met at | What it measures |\n|---|---|---|---|---|\n${s.lines.join("\n")}\n`;
writeFileSync("docs/CRITERIA-SUMMARY.md", md);
console.log(total, JSON.stringify(kinds));
