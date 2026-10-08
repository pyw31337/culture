import fs from 'fs';
import path from 'path';

const mode = process.argv[2];
const planPath = path.join(process.cwd(), 'scripts', 'scraper-plan.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
// Runnable plans: github (CI fallback), local (full Mac run), local-light
// (sources GitHub-hosted runners cannot reach). retainGuard is config, not a plan.
const runnable = Object.keys(plan).filter((key) => key !== 'retainGuard');
if (!mode || !runnable.includes(mode)) {
  console.error(`Usage: node scripts/print-scraper-plan.mjs <${runnable.join('|')}>`);
  process.exit(1);
}

const entries = plan[mode];

if (!Array.isArray(entries)) {
  console.error(`No scraper plan found for mode: ${mode}`);
  process.exit(1);
}

for (const entry of entries) {
  if (!entry?.name || !entry?.priority || !entry?.command) {
    console.error(`Invalid scraper plan entry for mode ${mode}: ${JSON.stringify(entry)}`);
    process.exit(1);
  }
  process.stdout.write(`${entry.name}\t${entry.priority}\t${entry.command}\n`);
}
