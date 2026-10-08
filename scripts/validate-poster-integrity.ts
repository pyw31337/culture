import fs from 'fs';
import path from 'path';
import {
  isPerformanceRecord,
  isLocalPosterUrl,
  isPosterAuditedDataFile,
  type PosterRecord,
} from './lib/poster-integrity';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const REPORT_PATH = path.join(DATA_DIR, 'poster-integrity-report.json');

/**
 * Hard-fail only when poster problems are systemic. A handful of records with a
 * missing/odd poster state must not block the whole daily publish (that is what
 * froze the live site from 2026-09-29): they are reported as warnings instead and
 * the UI already falls back to a placeholder for posterless cards.
 *
 * POSTER_INTEGRITY_MAX_INVALID_RATIO: share of audited records allowed to be
 *   invalid before failing (default 0.05 = 5%).
 * POSTER_INTEGRITY_MAX_INVALID: absolute cap that always fails (default 1500).
 */
const MAX_INVALID_RATIO = Number.parseFloat(process.env.POSTER_INTEGRITY_MAX_INVALID_RATIO || '0.05');
const MAX_INVALID_ABSOLUTE = Number.parseInt(process.env.POSTER_INTEGRITY_MAX_INVALID || '1500', 10);

function isObject(value: JsonValue): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function walk(value: JsonValue, visitor: (object: JsonObject) => void) {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor));
    return;
  }
  if (!isObject(value)) return;
  visitor(value);
  Object.values(value).forEach((child) => walk(child, visitor));
}

function collectJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full);
  }
  return files;
}

function readJson(file: string): JsonValue {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as JsonValue;
}

type Issue = { id: string; kind: 'missing-status' | 'verified-without-local' | 'excluded-with-url'; file: string };

function main() {
  if (!fs.existsSync(REPORT_PATH)) {
    throw new Error('poster integrity report is missing; run npm run cache:posters before publishing');
  }
  const report = readJson(REPORT_PATH) as Record<string, unknown>;
  if (report.policy !== 'verified-local-poster-or-exclude' || typeof report.checkedAt !== 'string') {
    throw new Error('poster integrity report is malformed or from an incompatible cache run');
  }

  const issues: Issue[] = [];
  const statusCounts = new Map<string, number>();
  const seenIds = new Set<string>();
  for (const file of collectJsonFiles(DATA_DIR)) {
    // Diagnostic reports (build-info, *-report.json, manifests) embed sample
    // records that the poster cache intentionally never rewrites. Auditing them
    // produced false "missing recognized poster status" failures and, because
    // ids are de-duplicated, masked the real record in the data file.
    if (!isPosterAuditedDataFile(path.relative(DATA_DIR, file))) continue;
    const rel = path.relative(ROOT, file);
    const data = readJson(file);
    walk(data, (object) => {
      if (!isPerformanceRecord(object)) return;
      const record = object as PosterRecord;
      const id = String(record.id);
      if (seenIds.has(id)) return;
      seenIds.add(id);
      const status = typeof record.posterStatus === 'string' ? record.posterStatus : 'missing';
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

      if (status === 'verified') {
        if (!isLocalPosterUrl(record.image) || !fs.existsSync(path.join(PUBLIC_DIR, record.image))) {
          issues.push({ id, kind: 'verified-without-local', file: rel });
        }
        return;
      }
      if (status === 'unavailable' || status === 'pending') {
        if (record.image || record.poster || record.posterUrl || record.backupPoster) {
          issues.push({ id, kind: 'excluded-with-url', file: rel });
        }
        return;
      }
      issues.push({ id, kind: 'missing-status', file: rel });
    });
  }

  const summary = [...statusCounts.entries()].map(([status, count]) => `${status}: ${count}`).join(', ');
  const total = seenIds.size;
  const allowed = Math.min(MAX_INVALID_ABSOLUTE, Math.max(0, Math.floor(total * MAX_INVALID_RATIO)));

  if (issues.length > 0) {
    const byKind = issues.reduce<Record<string, number>>((acc, issue) => {
      acc[issue.kind] = (acc[issue.kind] || 0) + 1;
      return acc;
    }, {});
    const sample = issues.slice(0, 20).map((issue) => `  - ${issue.id} (${issue.kind}, ${issue.file})`).join('\n');
    const message = `[poster-integrity] ${issues.length}/${total} record(s) have poster issues (${JSON.stringify(byKind)}; allowed ${allowed}):\n${sample}`;
    if (issues.length > allowed) {
      throw new Error(`${message}\nToo many poster integrity issues; refusing to publish.`);
    }
    // GitHub Actions annotation so the warning is visible on the run summary.
    if (process.env.GITHUB_ACTIONS === 'true') {
      console.log(`::warning title=Poster integrity::${issues.length} record(s) have poster issues; they render with a placeholder.`);
    }
    console.warn(message);
  }

  console.log(`[poster-integrity] audited ${total} records (${summary}); issues ${issues.length}/${allowed} allowed`);
}

try {
  main();
} catch (error) {
  console.error('[poster-integrity] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
