#!/usr/bin/env node
// Builds out/pulse-coverage-kit: Pulse (engine + every screen) as a folder
// another Dynatrace app copies into its ui/app and mounts as a section.
//
//   node scripts/export-coverage-kit.mjs
//
// The kit is generated from this repo's own source, so it is always the same
// code Pulse runs. Re-run after every Pulse release and copy the folder again.

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out", "pulse-coverage-kit");
const src = join(root, "ui", "app");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(root, "app.config.json"), "utf8"));
const version = /APP_VERSION = "([^"]+)"/.exec(readFileSync(join(src, "appVersion.ts"), "utf8"))[1];
let commit = "unknown";
try { commit = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim(); } catch { /* not a git checkout */ }
let dirty = false;
try { dirty = execSync("git status --porcelain -- ui", { cwd: root }).toString().trim() !== ""; } catch { /* ignore */ }

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Everything under ui/app except Pulse's own app shell.
cpSync(src, join(out, "pulse"), {
  recursive: true,
  filter: s => !s.endsWith(join("ui", "app", "App.tsx")) && !s.endsWith(".DS_Store"),
});

// The copied source is type-checked here, under Pulse's compiler settings.
// A host with stricter settings (noUncheckedIndexedAccess, noUnusedLocals…)
// would reject code Pulse already proved, so every copied file except the
// mounting surface (kit/) carries @ts-nocheck. The code itself is unchanged.
const NOCHECK = "// @ts-nocheck -- generated copy of Pulse Assessment; type-checked in the Pulse repo.\n";
const walk = dir => readdirSync(dir).flatMap(n => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
for (const file of walk(join(out, "pulse"))) {
  if (!/\.(ts|tsx)$/.test(file) || file.includes(join("pulse", "kit"))) continue;
  writeFileSync(file, NOCHECK + readFileSync(file, "utf8"));
}

writeFileSync(join(out, "index.ts"), `// Pulse Coverage kit ${version} (${commit}${dirty ? ", uncommitted changes" : ""}). Generated: do not edit.
export { PulseCoverage, PULSE_NAV } from "./pulse/kit/PulseCoverage";
export { usePulseLatest } from "./pulse/kit/usePulseLatest";
export { scoreBand } from "./pulse/utils/colors";
export type { PulseLatest, PulseLatestState, PulseParts, PulseReading, PulseFinding, PulseCapabilitySummary } from "./pulse/kit/usePulseLatest";
export { criterionText } from "./pulse/i18n/lang";
export type { PulseCoverageProps } from "./pulse/kit/PulseCoverage";
export { APP_VERSION as PULSE_VERSION } from "./pulse/appVersion";
`);

// The light entry for a host page that only shows a summary of Pulse's latest reading (e.g. an Overview): it must
// not import PulseCoverage. Importing the full entry from an eagerly loaded page pulls every Pulse screen into that
// page and, in the PoC host, made the page's in-flight queries cancel and never re-run (tiles read "No telemetry").
writeFileSync(join(out, "summary.ts"), `// Pulse Coverage kit ${version}: summary entry (no screens). Generated: do not edit.
export { usePulseLatest } from "./pulse/kit/usePulseLatest";
export { scoreBand } from "./pulse/utils/colors";
export type { PulseLatest, PulseLatestState, PulseParts, PulseReading, PulseFinding, PulseCapabilitySummary } from "./pulse/kit/usePulseLatest";
export { criterionText } from "./pulse/i18n/lang";
`);

const runtimeDeps = Object.fromEntries(
  Object.entries(pkg.dependencies ?? {}).filter(([n]) => !["react", "react-dom"].includes(n)),
);
const scopes = manifest.app.scopes.map(s => ({ name: s.name, comment: s.comment }));

writeFileSync(join(out, "kit.json"), JSON.stringify({
  name: "pulse-coverage-kit",
  pulseVersion: version,
  commit,
  uncommittedChanges: dirty,
  peerDependencies: { react: pkg.dependencies.react, "react-dom": pkg.dependencies["react-dom"] },
  dependencies: runtimeDeps,
  scopes,
  documents: {
    "ppa-snapshot": "Assessment history (Evolution). Shared with the Pulse app in the same environment.",
    "pulse-querycache-2": "Per-user query cache document. Shared with the Pulse app in the same environment.",
  },
}, null, 2) + "\n");

const depLines = Object.entries(runtimeDeps).map(([n, v]) => `| \`${n}\` | \`${v}\` |`).join("\n");
const scopeLines = scopes.map(s => `| \`${s.name}\` | ${s.comment ?? ""} |`).join("\n");

writeFileSync(join(out, "INTEGRATION.md"), `# Pulse Coverage kit ${version}

Pulse Assessment (engine and every screen) as one React component, to mount as the
Coverage section of another Dynatrace app. It is the same code the Pulse app runs:
same criteria, queries, cost controls, score, history and reports.

Source commit: \`${commit}\`${dirty ? " (built with uncommitted changes)" : ""}.

## 1. Copy

Copy this folder into the host app, for example to \`ui/app/pulse-coverage-kit/\`.
Do not edit files inside it: regenerate it from the Pulse repo
(\`node scripts/export-coverage-kit.mjs\`) and copy it again.

## 2. Mount

\`\`\`tsx
import { PulseCoverage } from "./pulse-coverage-kit";

// inside the host's <Routes>
<Route path="/coverage/*" element={<PulseCoverage basePath="/coverage" embedded />} />
\`\`\`

| Prop | Default | Meaning |
| --- | --- | --- |
| \`basePath\` | \`""\` | Route the section is mounted under. Every Pulse link is prefixed with it. |
| \`embedded\` | \`false\` | Draws Pulse's section bar (Overview, Overall score, Evolution, Guide) and its Refresh / Reports actions at the top of the section, because the host owns the AppHeader. |
| \`headerSlotId\` | \`"pulse-header-actions"\` | Element id for Refresh / Reports. Change only if the host uses that id. |

Pulse routes under the base path: \`/\` Overview, \`/summary\` Overall score,
\`/compare\` Evolution, \`/guide\` Guide, \`/capability/:name\` capability detail.

The host must render it inside its own \`AppRoot\` and a react-router v6 router
(\`BrowserRouter\` or \`MemoryRouter\`), and inside the content area of its \`PageLayout\`.
Load the route lazily (\`React.lazy\`), so Pulse's screens stay out of the host's first bundle.

A host page that only shows a summary of the latest reading (\`usePulseLatest\`, \`scoreBand\`,
\`criterionText\`) imports from \`./pulse-coverage-kit/summary\`, never from the full entry: the
full entry carries every Pulse screen, and loading it eagerly in a host page made that page's
queries cancel and never run again.

## 3. Dependencies (host package.json)

| Package | Version |
| --- | --- |
${depLines}

Peer: \`react\` ${pkg.dependencies.react}, \`react-dom\` ${pkg.dependencies["react-dom"]}.

## 4. Scopes (host app.config.json)

All of them are required for the screens to show what Pulse shows. A missing scope
shows the same "no permission" state Pulse shows, it does not break the page.

| Scope | Why |
| --- | --- |
${scopeLines}

## 5. Shared with the Pulse app

- **History** (Evolution) is stored as documents of type \`ppa-snapshot\`. If the Pulse app
  is installed in the same environment, both read and write the same history.
- **Query cache** is the per-user document \`pulse-querycache-2\`, shared the same way.
- Dynatrace Assist calls report the **host's** app id (read with \`getAppId()\`).

## 6. Update

1. In the Pulse repo: \`node scripts/export-coverage-kit.mjs\`.
2. Replace the folder in the host with \`out/pulse-coverage-kit\`.
3. Check \`kit.json\` for new dependencies or scopes.
`);

console.log(`Pulse Coverage kit ${version} (${commit}${dirty ? ", uncommitted" : ""}) -> ${out}`);
console.log(existsSync(join(out, "pulse", "kit", "PulseCoverage.tsx")) ? "ok" : "MISSING PulseCoverage.tsx");
