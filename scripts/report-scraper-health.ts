/**
 * Aggregate source file freshness + session health into public/data/scraper-health.json
 * Run after scrapers / generate-data.
 */
import fs from 'fs';
import path from 'path';
import { SOURCE_REGISTRY } from '../src/lib/source-registry';

const root = process.cwd();
const dataDir = path.join(root, 'src/data');
const publicOut = path.join(root, 'public/data/scraper-health.json');
const sessionPath = path.join(dataDir, '_scraper-health-session.json');

type SessionEntry = {
  name: string;
  status: 'success' | 'failure' | 'skipped';
  itemCount?: number;
  error?: string;
  durationMs?: number;
  finishedAt: string;
};

function fileStats(file: string) {
  const full = path.join(dataDir, file);
  if (!fs.existsSync(full)) {
    return { exists: false as const, itemCount: 0, mtime: null as string | null, ageHours: null as number | null };
  }
  const st = fs.statSync(full);
  let itemCount = 0;
  try {
    const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
    itemCount = Array.isArray(raw) ? raw.length : raw && typeof raw === 'object' ? Object.keys(raw).length : 0;
  } catch {
    itemCount = 0;
  }
  const ageHours = (Date.now() - st.mtimeMs) / 36e5;
  return {
    exists: true as const,
    itemCount,
    mtime: st.mtime.toISOString(),
    ageHours: Math.round(ageHours * 10) / 10,
  };
}

function loadSession(): SessionEntry[] {
  if (!fs.existsSync(sessionPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  } catch {
    return [];
  }
}

function main() {
  const session = loadSession();
  const byName = new Map(session.map((e) => [e.name, e]));

  const sources = SOURCE_REGISTRY.map((entry) => {
    const stats = fileStats(entry.file);
    const run = byName.get(entry.key);
    const freshDays = entry.freshDays ?? 3;
    const staleDays = entry.staleDays ?? 30;
    let freshness: 'fresh' | 'aging' | 'stale' | 'missing' = 'missing';
    if (stats.exists && stats.ageHours != null) {
      const ageDays = stats.ageHours / 24;
      if (ageDays <= freshDays) freshness = 'fresh';
      else if (ageDays <= staleDays) freshness = 'aging';
      else freshness = 'stale';
    }

    return {
      key: entry.key,
      label: entry.label,
      file: entry.file,
      homepage: entry.homepage,
      itemCount: stats.itemCount,
      mtime: stats.mtime,
      ageHours: stats.ageHours,
      freshness,
      lastRun: run
        ? {
            status: run.status,
            itemCount: run.itemCount,
            error: run.error,
            durationMs: run.durationMs,
            finishedAt: run.finishedAt,
          }
        : null,
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    totals: {
      sources: sources.length,
      fresh: sources.filter((s) => s.freshness === 'fresh').length,
      aging: sources.filter((s) => s.freshness === 'aging').length,
      stale: sources.filter((s) => s.freshness === 'stale').length,
      missing: sources.filter((s) => s.freshness === 'missing').length,
      runFailures: session.filter((s) => s.status === 'failure').length,
    },
    sources,
  };

  fs.mkdirSync(path.dirname(publicOut), { recursive: true });
  fs.writeFileSync(publicOut, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`[scraper-health] wrote ${publicOut}`);
  console.log(JSON.stringify(summary.totals, null, 2));

  // Soft warning only — do not fail CI by default
  if (summary.totals.missing > 0 || summary.totals.stale > 5) {
    console.warn('[scraper-health] warning: missing or many stale sources');
  }
}

main();
