import fs from 'fs';
import path from 'path';

const mode = process.argv[2];
if (!mode || !['github', 'local'].includes(mode)) {
  console.error('Usage: node scripts/print-scraper-plan.mjs <github|local>');
  process.exit(1);
}

const planPath = path.join(process.cwd(), 'scripts', 'scraper-plan.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
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
