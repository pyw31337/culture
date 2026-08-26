import { REGIONS } from './constants';
import {
  normalizeRegionId as canonicalRegionId,
  normalizeRegionLabel,
} from './region-normalize';

export const REGION_SELECTION_STORAGE_KEY = 'cf_region_selection_v2';
export const REGION_SELECTION_EVENT = 'cultureflow:region-selection-change';

export type DistrictSelectionMap = Record<string, string[]>;

function normalizeRegionId(region?: string | null) {
  const value = region?.trim();
  if (!value || value === 'all') return value || '';
  const canonical = canonicalRegionId(value);
  if (canonical && REGIONS.some((item) => item.id === canonical)) return canonical;
  return REGIONS.find((item) => item.id === value || item.label === value)?.id || canonical || value;
}

export function parseRegionSelection(value?: string | null): string[] {
  if (!value || value === 'all') return [];
  return Array.from(new Set(value.split(',').map((v) => normalizeRegionId(v)).filter(Boolean).filter((v) => v !== 'all')));
}

export function serializeRegionSelection(regionIds: string[]) {
  const clean = Array.from(new Set(regionIds.filter((id) => id && id !== 'all')));
  return clean.length ? clean.join(',') : 'all';
}

export function parseDistrictSelection(value?: string | null, fallbackRegion?: string | null): DistrictSelectionMap {
  if (!value || value === 'all') return {};
  const map: DistrictSelectionMap = {};
  value.split('|').map((v) => v.trim()).filter(Boolean).forEach((token) => {
    const [regionRaw, districtRaw] = token.includes(':') ? token.split(':') : [fallbackRegion || '', token];
    const region = normalizeRegionId(regionRaw);
    const district = districtRaw?.trim();
    if (!region || !district || district === 'all') return;
    if (!map[region]) map[region] = [];
    if (!map[region].includes(district)) map[region].push(district);
  });
  return map;
}

export function serializeDistrictSelection(map: DistrictSelectionMap) {
  const tokens = Object.entries(map)
    .flatMap(([region, districts]) => Array.from(new Set(districts)).map((district) => `${region}:${district}`));
  return tokens.length ? tokens.join('|') : 'all';
}

export function getRegionLabel(regionId: string) {
  if (regionId === 'all') return '전국';
  return REGIONS.find((region) => region.id === regionId)?.label || normalizeRegionLabel(regionId) || regionId;
}

export function getRegionSelectionLabel(regionValue?: string | null, districtValue?: string | null) {
  const regions = parseRegionSelection(regionValue);
  if (regions.length === 0) return '전국';
  const districts = parseDistrictSelection(districtValue, regions[0]);
  return regions.map((region) => {
    const selectedDistricts = districts[region] || [];
    const label = getRegionLabel(region);
    if (!selectedDistricts.length) return label;
    return `${label} ${selectedDistricts.join(', ')}`;
  }).join(' / ');
}

export function getRegionSelectionSentenceLabel(regionValue?: string | null, districtValue?: string | null) {
  const regions = parseRegionSelection(regionValue);
  if (regions.length === 0) return '전국';
  const districts = parseDistrictSelection(districtValue, regions[0]);
  return regions.map((region) => {
    const selectedDistricts = districts[region] || [];
    const label = getRegionLabel(region);
    if (!selectedDistricts.length) return label;
    return `${label} ${selectedDistricts.join(', ')}`;
  }).join(', ');
}

export function persistRegionSelection(region: string, district: string, venue = 'all') {
  if (typeof window === 'undefined') return;
  const detail = { region, district, venue };
  try {
    localStorage.setItem(REGION_SELECTION_STORAGE_KEY, JSON.stringify(detail));
  } catch {}
  window.dispatchEvent(new CustomEvent(REGION_SELECTION_EVENT, { detail }));
}

export function readPersistedRegionSelection() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(REGION_SELECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { region?: string; district?: string; venue?: string };
    return {
      region: parsed.region || 'all',
      district: parsed.district || 'all',
      venue: parsed.venue || 'all',
    };
  } catch {
    return null;
  }
}
