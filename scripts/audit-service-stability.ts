import fs from 'fs';
import path from 'path';
import type { Performance } from '../src/types';
import { buildLocationIntegrityReport } from './utils/location-integrity';

const root = process.cwd();
const performancesPath = path.join(root, 'public/data/performances.json');
const venuesPath = path.join(root, 'public/data/venues.json');
const outPath = path.join(root, 'public/data/service-stability-report.json');

function clean(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function compact(value?: string | null) {
    return clean(value).replace(/\s+/g, '');
}

function comparable(value?: string | null) {
  return clean(value)
    .replace(/[·ㆍ,./\\\-_:|"'“”‘’()[\]\s]/g, '')
    .toLowerCase();
}

function isLocalImage(value?: string | null) {
  return Boolean(value && value.startsWith('/images/'));
}

function isPlaceholderImage(value?: string | null) {
    const text = (value || '').toLowerCase();
  return !text || text.includes('placeholder') || text.includes('noimage') || text.includes('no-image');
}

function localPath(value: string) {
  return path.join(root, 'public', value.replace(/^\//, ''));
}

function getDescriptionSimilarity(item: Performance) {
  const description = compact(item.description);
  if (!description || description.length < 35) return 0;
  const facts = compact([
    item.title,
    item.venue,
    item.address,
    item.date,
    item.performanceTime,
    item.operatingHours,
    item.price,
    item.priceDetail,
  ].filter(Boolean).join(' '));
  if (!facts) return 0;
  let covered = 0;
  const tokens = [item.title, item.venue, item.address, item.date, item.price]
    .map((value) => compact(value))
    .filter((value) => value.length >= 3);
  tokens.forEach((token) => {
    if (description.includes(token)) covered += Math.min(token.length, 24);
  });
  return Math.min(1, covered / Math.max(1, Math.min(description.length, 120)));
}

function isGeneratedSummaryDescription(item: Performance) {
  const text = clean(item.description);
  if (!text || item.genre === 'movie') return false;
  const comparableText = comparable(text);
  const patterns = [
    /에서\s+진행되는\s+.+입니다/u,
    /일정은\s+.+기준입니다/u,
    /위치는\s+.+입니다/u,
    /현장\s+편의\s+정보는\s+.+입니다/u,
    /이용\s+정보는\s+.+기준입니다/u,
  ];
  const signalCount = patterns.filter((pattern) => pattern.test(text)).length;
  if (signalCount >= 3) return true;

  const title = clean(item.title);
  const startsWithTitleSummary = Boolean(title && (
    text.startsWith(`${title}는 `)
    || text.startsWith(`"${title}"는 `)
    || text.startsWith(`'${title}'는 `)
  ));
  if (startsWithTitleSummary && signalCount >= 2) return true;

  const redundantFieldHits = [
    item.venue,
    item.address,
    item.date,
    item.performanceTime,
    item.price,
    item.priceDetail,
    item.facilities,
  ]
    .map((field) => comparable(field))
    .filter((field) => field.length >= 4 && comparableText.includes(field))
    .length;

  return startsWithTitleSummary && signalCount >= 1 && redundantFieldHits >= 3;
}

function isRedundantSportsDescription(item: Performance) {
  if (!['soccer', 'baseball', 'basketball', 'volleyball', 'handball'].includes(item.genre)) return false;
  const text = clean(item.description);
  if (!text) return false;
  const hasTeamPair = Boolean(item.homeTeam && item.awayTeam && text.includes(item.homeTeam) && text.includes(item.awayTeam));
  return hasTeamPair && /경기입니다|일정은|위치는|장소는|기준입니다/u.test(text);
}

function hasUsefulSourceDetail(item: Performance) {
  const text = clean(item.description);
  if (!text) return false;
  const usefulSignals = [
    '유의사항',
    '이용정보',
    '장소안내',
    '자주묻는질문',
    '공연시간 안내',
    '배송정보',
    '할인정보',
    '행사내용',
    '관람 포인트',
    '취소/환불',
    '프로그램',
    '예약 방법',
    '상담 일정',
    '수강권 정보',
    '클래스 정보',
    '커리큘럼',
    '다른 수강권',
    '키워드:',
  ];
  return usefulSignals.some((signal) => text.includes(signal));
}

function sample<T>(rows: T[], limit = 20) {
  return rows.slice(0, limit);
}

const performances = JSON.parse(fs.readFileSync(performancesPath, 'utf8')) as Performance[];
const venues = JSON.parse(fs.readFileSync(venuesPath, 'utf8')) as Record<string, any>;

const missingLocalImages: any[] = [];
const placeholderImages: any[] = [];
const duplicatedDescriptions: any[] = [];
const missingSourceDates: any[] = [];
const suspiciousVenueAddress: any[] = [];
const ambiguousVenueDictionary: any[] = [];
const noBookingLinks: any[] = [];
const locationReport = buildLocationIntegrityReport(performances, venues);

for (const item of performances) {
  const image = item.image || item.posterUrl || item.poster || '';
  const backup = item.backupPoster || '';
  if (isLocalImage(image) && !fs.existsSync(localPath(image))) {
    missingLocalImages.push({ id: item.id, title: item.title, genre: item.genre, image });
  }
  if (isPlaceholderImage(image) && !backup) {
    placeholderImages.push({ id: item.id, title: item.title, genre: item.genre, source: item.source || '', image });
  }
  const similarity = getDescriptionSimilarity(item);
  if (
    similarity >= 0.45
    && !isGeneratedSummaryDescription(item)
    && !isRedundantSportsDescription(item)
    && !hasUsefulSourceDetail(item)
    && !clean((item as any).detailDescription)
    && !clean((item as any).noticeText)
  ) {
    duplicatedDescriptions.push({ id: item.id, title: item.title, genre: item.genre, similarity: Number(similarity.toFixed(2)) });
  }
  if (!clean((item as any).dataCollectedAt) && !clean((item as any).statsCollectedAt) && !clean((item as any).lastModifiedAt) && !clean((item as any).sourceUpdatedAt)) {
    missingSourceDates.push({ id: item.id, title: item.title, genre: item.genre, source: item.source || '' });
  }
  if (!clean(item.link) && !clean(item.website) && !['movie'].includes(item.genre)) {
    noBookingLinks.push({ id: item.id, title: item.title, genre: item.genre, source: item.source || '' });
  }
}

locationReport.unresolvedSamples.forEach((row) => {
  suspiciousVenueAddress.push({
    id: row.id,
    title: row.title,
    genre: row.genre,
    venue: row.venue,
    itemAddress: row.performanceAddress,
    resolvedAddress: row.resolvedAddress,
  });
});

locationReport.topAmbiguousVenues.forEach((row) => {
  ambiguousVenueDictionary.push(row);
});

const report = {
  checkedAt: new Date().toISOString(),
  itemCount: performances.length,
  status: missingLocalImages.length > 0 || suspiciousVenueAddress.length > 0 ? 'fail' : (placeholderImages.length > 0 || ambiguousVenueDictionary.length > 0 ? 'warn' : 'pass'),
  metrics: {
    missingLocalImageCount: missingLocalImages.length,
    placeholderImageCount: placeholderImages.length,
    placeholderImageRate: Number((placeholderImages.length / Math.max(1, performances.length)).toFixed(4)),
    duplicatedDescriptionCount: duplicatedDescriptions.length,
    missingSourceDateCount: missingSourceDates.length,
    suspiciousVenueAddressCount: suspiciousVenueAddress.length,
    ambiguousVenueDictionaryCount: ambiguousVenueDictionary.length,
    noBookingLinkCount: noBookingLinks.length,
  },
  samples: {
    missingLocalImages: sample(missingLocalImages),
    placeholderImages: sample(placeholderImages),
    duplicatedDescriptions: sample(duplicatedDescriptions),
    missingSourceDates: sample(missingSourceDates),
    suspiciousVenueAddress: sample(suspiciousVenueAddress),
    ambiguousVenueDictionary: sample(ambiguousVenueDictionary),
    noBookingLinks: sample(noBookingLinks),
  },
};

fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.metrics, null, 2));
if (missingLocalImages.length > 0 || suspiciousVenueAddress.length > 0) process.exit(1);
