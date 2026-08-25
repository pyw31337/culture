import fs from 'fs';
import path from 'path';
import { cleanTitle as libCleanTitle, formatUnifiedDate as libFormatUnifiedDate } from '../../src/lib/utils';
import type { Performance } from '../../src/types';
import { normalizeRegionId, resolveRegion } from '../../src/lib/region-normalize';

/**
 * Shared Scraper Utilities for CultureFlow
 */

export function cleanVenueName(name: string): string {
  if (!name) return '';
  return name
    .replace(/\(주\)/g, '')
    .replace(/\(재\)/g, '')
    .replace(/\(유\)/g, '')
    .replace(/\[서울\]/g, '')
    .replace(/\[경기\]/g, '')
    .replace(/\[인천\]/g, '')
    .replace(/［본점］/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const cleanTitle = libCleanTitle;
export const formatUnifiedDate = libFormatUnifiedDate;

export function generateStableId(title: string, date: string, venue: string, source: string): string {
  const cleanId = `${source}_${title}_${venue}`
    .replace(/[^a-z0-9가-힣]/gi, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
    .substring(0, 150);
  return cleanId;
}

export function atomicWriteJson(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

export function saveJson(filename: string, data: unknown) {
  const filePath = path.join(process.cwd(), 'src/data', filename);
  atomicWriteJson(filePath, data);
  const count = Array.isArray(data)
    ? data.length
    : data && typeof data === 'object'
      ? Object.keys(data as object).length
      : 0;
  console.log(`[Scraper] Saved ${count} items to ${filename}`);
}

export function loadJson<T = unknown>(filename: string, defaultValue: T): T {
  const filePath = path.join(process.cwd(), 'src/data', filename);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  }
  return defaultValue;
}

export function cleanPrice(price: string): string {
  if (!price) return '정보 없음';
  return price.trim().replace(/\s+/g, ' ');
}

/**
 * Normalize region fields on a performance-like object before save.
 */
export function applyRegionCanonical<T extends { region?: string; address?: string }>(item: T): T {
  const resolved = resolveRegion(item.region, item.address);
  if (resolved) {
    return { ...item, region: resolved };
  }
  if (item.region) {
    return { ...item, region: normalizeRegionId(item.region) || item.region };
  }
  return item;
}

export function applyRegionCanonicalAll<T extends { region?: string; address?: string }>(items: T[]): T[] {
  return items.map(applyRegionCanonical);
}

export type ScraperHealthEntry = {
  name: string;
  status: 'success' | 'failure' | 'skipped';
  itemCount?: number;
  error?: string;
  durationMs?: number;
  finishedAt: string;
};

const HEALTH_PATH = path.join(process.cwd(), 'src/data', '_scraper-health-session.json');

export function appendScraperHealth(entry: ScraperHealthEntry) {
  let list: ScraperHealthEntry[] = [];
  try {
    if (fs.existsSync(HEALTH_PATH)) {
      list = JSON.parse(fs.readFileSync(HEALTH_PATH, 'utf8'));
    }
  } catch {
    list = [];
  }
  list = list.filter((e) => e.name !== entry.name);
  list.push(entry);
  atomicWriteJson(HEALTH_PATH, list);
}

/**
 * Soft assert: log and continue instead of crashing the whole pipeline.
 */
export function softAssert(condition: unknown, message: string): boolean {
  if (!condition) {
    console.warn(`[softAssert] ${message}`);
    return false;
  }
  return true;
}

/**
 * Ensure Performance-like rows have minimum required fields before save.
 */
export function filterValidPerformances(items: Partial<Performance>[], source: string): Performance[] {
  const out: Performance[] = [];
  for (const raw of items) {
    if (!raw?.title || !raw?.id) {
      console.warn(`[${source}] drop item missing title/id`);
      continue;
    }
    const withRegion = applyRegionCanonical({
      ...raw,
      source: raw.source || source,
    } as Performance);
    out.push(withRegion as Performance);
  }
  return out;
}
