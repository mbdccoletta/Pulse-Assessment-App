/** Regras de diagnóstico — regressão sem tenant. node tools/diagnosis.test.mjs */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(mkdtempSync(join(tmpdir(), "dx-")), "diagnosis.mjs");
execFileSync(join(repo, "node_modules/.bin/esbuild"),
  [join(repo, "ui/app/diagnosis.ts"), "--bundle", "--format=esm", `--outfile=${out}`, "--log-level=error"]);
const { diagnose, DEFAULT_CUTS } = await import(out);

const TOTAL = 37;
// Cobertura e utilization lidas da tenant em 29/09; adoção da janela de 30d.
const CAPS = [
  { name: "Infrastructure Observability", coverage: 100, utilization: 90, users: 6, rate: 16, want: "healthy" },
  { name: "Threat Observability",         coverage: 91,  utilization: 40, users: 9, rate: 24, want: "skinDeep" },
  { name: "Digital Experience",           coverage: 82,  utilization: 70, users: 3, rate: 8,  want: "unwatched" },
  { name: "Application Security",         coverage: 64,  utilization: 45, users: 0, rate: 0,  want: "unwatched" },
];
let bad = 0;
const check = (n, a, e) => { const ok = JSON.stringify(a) === JSON.stringify(e);
  if (!ok) { bad++; console.log(`  FAIL ${n}\n    esperado ${JSON.stringify(e)}\n    obtido   ${JSON.stringify(a)}`); }
  else console.log(`  ok   ${n}`); };
const id = (c, cuts) => diagnose({ ...c, totalUsers: TOTAL, windowDays: 30 }, cuts).id;

console.log("\n1 · veredictos com os cortes padrão");
for (const c of CAPS) check(`${c.name.padEnd(30)} → ${id(c)}`, id(c), c.want);

console.log("\n2 · sem piso absoluto a regra deixa de classificar");
const noFloor = { ...DEFAULT_CUTS, adoptionRate: 25, adoptionFloor: 999 };
const ids = [...new Set(CAPS.map(c => id(c, noFloor)))].sort();
check("degenera em unwatched apenas", ids, ["unwatched"]);

console.log("\n3 · adoção indisponível não vira 'ninguém usa'");
const noAd = diagnose({ coverage: 100, utilization: 90 });
check("segue Healthy", noAd.id, "healthy");
check("marcado como desconhecido", noAd.adoptionKnown, false);

console.log("\n4 · nada mensurável ganha estado próprio");
check("notAssessed", diagnose({ coverage: 0, utilization: 0, users: 0, notAssessedCount: 11, totalCount: 11 }).id, "notAssessed");
console.log(`\n${bad === 0 ? "PASSOU" : `FALHOU — ${bad}`}\n`);
process.exit(bad === 0 ? 0 : 1);
