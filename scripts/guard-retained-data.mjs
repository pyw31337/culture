#!/usr/bin/env node
/**
 * Keeps the last good data when a scraper run silently comes back short.
 *
 * Some sources are only reachable from the local Mac mini (Interpark ticket
 * API, 국가유산청, YES24, IP-restricted Kakao REST). When a run happens from a
 * network that is blocked, a scraper can "succeed" with far fewer records or
 * with enrichment fields stripped. This guard compares each file listed in
 * scripts/scraper-plan.json → retainGuard with the committed version (git ref,
 * default HEAD) and restores the committed file when:
 *   - the new file is missing or not valid JSON while the committed one is, or
 *   - the record count dropped below minRatio (and by at least MIN_DROP rows), or
 *   - a listed enrichment field (e.g. interpark sessions/priceList) dropped
 *     below minRatio of the committed coverage (only when coverage >= MIN_FIELD_BASE).
 *
 * Usage: node scripts/guard-retained-data.mjs [--ref HEAD] [--dry-run]
 * Exit code is always 0 unless the plan itself is unreadable; restorations are
 * printed as warnings (and as ::warning:: annotations on GitHub Actions).
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const args = process.argv.slice(2);
const refIndex = args.indexOf('--ref');
const ref = refIndex >= 0 ? args[refIndex + 1] : 'HEAD';
const dryRun = args.includes('--dry-run');
const MIN_DROP = Number(process.env.RETAIN_GUARD_MIN_DROP || 20);
const MIN_FIELD_BASE = Number(process.env.RETAIN_GUARD_MIN_FIELD_BASE || 50);
const inCi = process.env.GITHUB_ACTIONS === 'true';

const root = process.cwd();
const plan = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'scraper-plan.json'), 'utf8'));
const rules = Array.isArray(plan.retainGuard) ? plan.retainGuard : [];

function warn(message) {
  console.warn(`[retain-guard] ${message}`);
  if (inCi) console.log(`::warning title=Retained data guard::${message}`);
}

function readCommitted(file) {
  try {
    const text = execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    return { text, json: JSON.parse(text.toString('utf8')) };
  } catch {
    return null;
  }
}

function readCurrent(file) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { missing: true };
  try {
    return { json: JSON.parse(fs.readFileSync(abs, 'utf8')) };
  } catch {
    return { invalid: true };
  }
}

function records(json, countKey) {
  const value = countKey ? json?.[countKey] : json;
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function fieldCoverage(list, field) {
  return list.reduce((count, item) => {
    const value = item?.[field];
    if (Array.isArray(value)) return count + (value.length > 0 ? 1 : 0);
    return count + (value !== undefined && value !== null && value !== '' ? 1 : 0);
  }, 0);
}

let restored = 0;
for (const rule of rules) {
  const file = rule.file;
  const committed = readCommitted(file);
  if (!committed) continue; // nothing to protect yet (new source)

  const current = readCurrent(file);
  const minRatio = Number(rule.minRatio ?? 0.7);
  let reason = null;

  if (current.missing) reason = 'file disappeared';
  else if (current.invalid) reason = 'file is not valid JSON';
  else {
    const before = records(committed.json, rule.countKey);
    const after = records(current.json, rule.countKey);
    if (before.length > 0 && after.length < before.length * minRatio && before.length - after.length >= MIN_DROP) {
      reason = `record count dropped ${before.length} → ${after.length} (< ${Math.round(minRatio * 100)}%)`;
    }
    for (const field of rule.fields || []) {
      if (reason) break;
      const was = fieldCoverage(before, field);
      const now = fieldCoverage(after, field);
      if (was >= MIN_FIELD_BASE && now < was * minRatio) {
        reason = `"${field}" coverage dropped ${was} → ${now} (< ${Math.round(minRatio * 100)}%)`;
      }
    }
  }

  if (!reason) continue;
  restored += 1;
  if (dryRun) {
    warn(`${file}: ${reason}; would restore ${ref} version (dry-run).`);
    continue;
  }
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), committed.text);
  warn(`${file}: ${reason}; restored the ${ref} version so the last good data is kept.`);
}

console.log(`[retain-guard] checked ${rules.length} file(s) against ${ref}; restored ${restored}.`);
