import fs from 'fs';
import path from 'path';

type SearchItem = {
    title?: string;
    venue?: string;
    cast?: Array<string | { name?: string }>;
    genre?: string;
};

const CHECKS = [
    { query: '싸이', genreSlug: 'concert', expectedMin: 5 },
];

function readJson<T>(relativePath: string): T {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')) as T;
}

function normalize(value: unknown) {
    return String(value || '').replace(/\s+/g, '').toLowerCase().normalize('NFC');
}

function castText(cast: SearchItem['cast']) {
    if (!Array.isArray(cast)) return '';
    return cast.map((member) => typeof member === 'string' ? member : member?.name || '').join(' ');
}

function matchesKeyword(item: SearchItem, query: string) {
    const needle = normalize(query);
    return [
        item.title,
        item.venue,
        castText(item.cast),
    ].some((value) => normalize(value).includes(needle));
}

function loadCategoryItems(slug: string) {
    const manifest = readJson<{ pages: string[] }>(`public/data/category-pages/${slug}/manifest.json`);
    return manifest.pages.flatMap((pagePath) => readJson<SearchItem[]>(path.join('public', pagePath.replace(/^\/+/, ''))));
}

const allItems = readJson<SearchItem[]>('public/data/performances.json');
const errors: string[] = [];

for (const check of CHECKS) {
    const globalMatches = allItems.filter((item) => item.genre === check.genreSlug && matchesKeyword(item, check.query));
    const categoryMatches = loadCategoryItems(check.genreSlug).filter((item) => matchesKeyword(item, check.query));
    const globalIds = new Set(globalMatches.map((item) => `${item.title}::${item.venue}`));
    const categoryIds = new Set(categoryMatches.map((item) => `${item.title}::${item.venue}`));

    console.log(`[search][${check.query}] global=${globalMatches.length} category=${categoryMatches.length}`);

    if (globalMatches.length < check.expectedMin) {
        errors.push(`[search][${check.query}] 전체 데이터 매칭 ${globalMatches.length}건이 기대치 ${check.expectedMin}건보다 적습니다.`);
    }
    if (categoryMatches.length < check.expectedMin) {
        errors.push(`[search][${check.query}] ${check.genreSlug} 카테고리 매칭 ${categoryMatches.length}건이 기대치 ${check.expectedMin}건보다 적습니다.`);
    }

    for (const id of globalIds) {
        if (!categoryIds.has(id)) {
            errors.push(`[search][${check.query}] 전체에는 있지만 ${check.genreSlug} 카테고리에는 없는 항목: ${id}`);
        }
    }
}

if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exit(1);
}

console.log('[search] 검색/카테고리 일관성 검증 통과');
