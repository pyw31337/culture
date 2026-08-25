/**
 * Soft-fix / report REGION_ADDRESS_MISMATCH style issues.
 * Default: write a report only.
 * Pass --write to rewrite src/data/*.json region fields in place (canonical id).
 *
 * Usage:
 *   npx tsx scripts/fix-region-mismatches.ts
 *   npx tsx scripts/fix-region-mismatches.ts --write
 */
import fs from 'fs';
import path from 'path';
import {
  isRegionAddressMismatch,
  normalizeRegionId,
  regionIdFromAddress,
  resolveRegion,
} from '../src/lib/region-normalize';

const root = process.cwd();
const dataDir = path.join(root, 'src/data');
const writeMode = process.argv.includes('--write');

type Row = {
  file: string;
  id?: string;
  title?: string;
  regionBefore?: string;
  regionAfter: string;
  address?: string;
  reason: 'mismatch' | 'alias' | 'from_address';
};

function listJsonFiles(): string[] {
  if (!fs.existsSync(dataDir)) return [];
  return fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'venue-dictionary.json');
}

function processArray(file: string, items: any[]): { rows: Row[]; changed: number } {
  const rows: Row[] = [];
  let changed = 0;
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const before = item.region;
    const address = item.address;
    const resolved = resolveRegion(before, address);
    if (!resolved) continue;

    const normalizedBefore = normalizeRegionId(before);
    if (normalizedBefore === resolved && before === resolved) continue;

    let reason: Row['reason'] = 'alias';
    if (isRegionAddressMismatch(before, address)) reason = 'mismatch';
    else if (!normalizedBefore && regionIdFromAddress(address)) reason = 'from_address';

    rows.push({
      file,
      id: item.id,
      title: item.title,
      regionBefore: before,
      regionAfter: resolved,
      address,
      reason,
    });

    if (writeMode) {
      item.region = resolved;
      changed += 1;
    }
  }
  return { rows, changed };
}

function main() {
  const allRows: Row[] = [];
  let totalChanged = 0;

  for (const file of listJsonFiles()) {
    const full = path.join(dataDir, file);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(raw)) continue;

    const { rows, changed } = processArray(file, raw);
    allRows.push(...rows);
    totalChanged += changed;

    if (writeMode && changed > 0) {
      fs.writeFileSync(full, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
      console.log(`[write] ${file}: ${changed} region field(s) updated`);
    }
  }

  const reportPath = path.join(root, 'public/data/region-mismatch-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    writeMode,
    totalIssues: allRows.length,
    totalChanged,
    byReason: {
      mismatch: allRows.filter((r) => r.reason === 'mismatch').length,
      alias: allRows.filter((r) => r.reason === 'alias').length,
      from_address: allRows.filter((r) => r.reason === 'from_address').length,
    },
    samples: allRows.slice(0, 200),
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[region] issues=${allRows.length} changed=${totalChanged} report=${reportPath}`);
}

main();
