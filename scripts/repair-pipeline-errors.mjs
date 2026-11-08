import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'src', 'data');
const PUBLIC_DATA_DIR = path.join(ROOT, 'public', 'data');
const TARGET_FILES = ['kopis-performances.json', 'interpark.json'];
const dryRun = process.env.PIPELINE_REPAIR_DRY_RUN === '1';
const SOURCE_FILES = [
  'kopis-performances.json',
  'interpark.json',
  'culture-portal.json',
  'yes24.json',
  'timeticket.json',
];
const REPAIR_FIELDS = [
  'price',
  'priceList',
  'age',
  'ageDetail',
  'runtime',
  'runningTime',
  'image',
  'backupPoster',
  'synopsis',
  'description',
  'bookingLinks',
];

const emptyValue = (value) => {
  if (Array.isArray(value)) return value.length === 0;
  if (value == null) return true;
  const text = String(value).trim();
  return !text || /정보\s*없음|미정|문의|예매처\s*확인|가격\s*확인/i.test(text);
};

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
  .replace(/[^0-9a-z가-힣]/g, '');

const dateRange = (value) => {
  const dates = String(value || '').match(/20\d{2}[./-]\d{1,2}[./-]\d{1,2}/g) || [];
  return dates.map((date) => {
    const [year, month, day] = date.split(/[./-]/).map(Number);
    return new Date(year, month - 1, day).getTime();
  }).filter(Number.isFinite);
};

const overlaps = (left, right) => {
  const a = dateRange(left);
  const b = dateRange(right);
  if (a.length === 0 || b.length === 0) return false;
  const aStart = Math.min(...a);
  const aEnd = Math.max(...a);
  const bStart = Math.min(...b);
  const bEnd = Math.max(...b);
  return aStart <= bEnd && bStart <= aEnd;
};

const stableKey = (item) => {
  const title = normalize(item.title || item.name);
  const venue = normalize(item.venue || item.place || item.address);
  return title && venue ? `${title}|${venue}` : '';
};

const readArray = (file) => {
  const fullPath = path.join(DATA_DIR, file);
  if (!fs.existsSync(fullPath)) return [];
  try {
    const value = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const writeJson = (file, value) => {
  const fullPath = path.join(DATA_DIR, file);
  const tempPath = `${fullPath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, fullPath);
};

function repairFromDuplicateSources() {
  const sourceRows = new Map(SOURCE_FILES.map((file) => [file, readArray(file)]));
  const allPeers = SOURCE_FILES.flatMap((file) => sourceRows.get(file).map((item) => ({ file, item })));
  const repairs = [];

  for (const file of TARGET_FILES) {
    const rows = sourceRows.get(file);
    let changed = false;
    for (const row of rows) {
      const key = stableKey(row);
      if (!key) continue;
      const peers = allPeers.filter((peer) => (
        peer.file !== file
        && stableKey(peer.item) === key
        && overlaps(row.date, peer.item.date)
      ));

      for (const field of REPAIR_FIELDS) {
        if (!emptyValue(row[field])) continue;
        const peer = peers.find(({ item }) => !emptyValue(item[field]));
        if (!peer) continue;
        row[field] = peer.item[field];
        changed = true;
        repairs.push({
          id: row.id,
          source: row.source || file,
          field,
          fromSource: peer.item.source || peer.file,
          reason: 'same-title-venue-overlapping-date',
        });
      }
    }
    if (changed && !dryRun) writeJson(file, rows);
  }

  return repairs;
}

function classifyFailures() {
  const failurePath = path.join(ROOT, 'scrape_failures.txt');
  if (!fs.existsSync(failurePath)) return [];
  const names = fs.readFileSync(failurePath, 'utf8').split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
  return names.map((name) => {
    if (name === 'umclass' || name === 'mochaclass') {
      return { source: name, kind: 'access-or-structure', action: 'retained-last-good-data', blocking: false };
    }
    if (name === 'museum') {
      return { source: name, kind: 'timeout', action: 'retained-last-good-data', blocking: false };
    }
    return { source: name, kind: 'scraper-failure', action: 'retry-and-retain-on-failure', blocking: false };
  });
}

function detailCoverage() {
  const fullPath = path.join(PUBLIC_DATA_DIR, 'performances.json');
  if (!fs.existsSync(fullPath)) return [];
  let rows = [];
  try { rows = JSON.parse(fs.readFileSync(fullPath, 'utf8')); } catch { return []; }
  if (!Array.isArray(rows)) return [];

  return ['kopis', 'interpark'].map((source) => {
    const sample = rows
      .filter((item) => item.source === source && ['musical', 'play', 'concert', 'classic_tradition'].includes(item.genre))
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
      .slice(0, 120);
    const countMissing = (fields) => sample.filter((item) => fields.every((field) => emptyValue(item[field]))).length;
    return {
      source,
      sample: sample.length,
      missingPrice: countMissing(['price', 'priceList']),
      missingAge: countMissing(['age', 'ageRating']),
      missingRuntime: countMissing(['runningTime', 'runtime']),
      policy: source === 'kopis' ? 'warn-and-report-in-github-fallback' : 'warn-and-report',
    };
  });
}

const repairs = repairFromDuplicateSources();
const report = {
  generatedAt: new Date().toISOString(),
  runId: process.env.GITHUB_RUN_ID || null,
  commit: process.env.GITHUB_SHA || null,
  failures: classifyFailures(),
  repairs: {
    attempted: true,
    changedRecords: new Set(repairs.map((repair) => repair.id)).size,
    changedFields: repairs.length,
    details: repairs,
  },
  detailCoverage: detailCoverage(),
  retainedDataPolicy: 'Failed optional sources never replace the last known-good source file.',
  dryRun,
};

fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
fs.writeFileSync(
  path.join(PUBLIC_DATA_DIR, 'pipeline-error-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);

console.log(`[pipeline-repair] failures=${report.failures.length} changedRecords=${report.repairs.changedRecords} changedFields=${report.repairs.changedFields}`);
console.log(`[pipeline-repair] wrote ${path.join(PUBLIC_DATA_DIR, 'pipeline-error-report.json')}`);
