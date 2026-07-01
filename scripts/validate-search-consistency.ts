import fs from 'fs';
import path from 'path';
import { includesSearchTerm } from '../src/lib/search-match';


type SearchItem = {
    title?: string;
    venue?: string;
    cast?: Array<string | { name?: string }>;
    genre?: string;
};


const CHECKS = [
    { query: '싸이', genreSlug: 'concert' },
];


function readJson<T>(relativePath: string): T {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')) as T;
}


function castText(cast: SearchItem['cast']) {
    if (!Array.isArray(cast)) return '';
    return cast.map((member) => typeof member === 'string' ? member : member?.name || '').join(' ');
}


function matchesKeyword(item: SearchItem, query: string) {
    return [
        item.title,
        item.venue,
        castText(item.cast),
    ].some((value) => includesSearchTerm(value, query));
}


function loadCategoryItems(slug: string) {
    const manifest = readJson<{ pages: string[] }>(`public/data/category-pages/${slug}/manifest.json`);
    return manifest.pages.flatMap((pagePath) => readJson<SearchItem[]>(path.join('public', pagePath.replace(/^\/+/, ''))));
}


const allItems = readJson<SearchItem[]>('public/data/performances.json');
const errors: string[] = [];


if (!includesSearchTerm('싸이흠뻑쇼', '싸이') || includesSearchTerm('업싸이클공예', '싸이')) {
    errors.push('[search][싸이] 한글 토큰 경계 검증에 실패했습니다.');
}


for (const check of CHECKS) {
    const globalMatches = allItems.filter((item) => item.genre === check.genreSlug && matchesKeyword(item, check.query));
    const categoryMatches = loadCategoryItems(check.genreSlug).filter((item) => matchesKeyword(item, check.query));
    const globalIds = new Set(globalMatches.map((item) => `${item.title}::${item.venue}`));
    const categoryIds = new Set(categoryMatches.map((item) => `${item.title}::${item.venue}`));


    console.log(`[search][${check.query}] global=${globalMatches.length} category=${categoryMatches.length}`);


    if (globalMatches.length !== categoryMatches.length) {
        errors.push(`[search][${check.query}] 전체 매칭(${globalMatches.length}건)과 ${check.genreSlug} 카테고리 매칭(${categoryMatches.length}건) 건수가 일치하지 않습니다.`);
    }


    for (const id of globalIds) {
        if (!categoryIds.has(id)) {
            errors.push(`[search][${check.query}] 전체에는 있지만 ${check.genreSlug} 카테고리에는 없는 항목: ${id}`);
        }
    }
    for (const id of categoryIds) {
        if (!globalIds.has(id)) {
            errors.push(`[search][${check.query}] ${check.genreSlug} 카테고리에는 있지만 전체에는 없는 항목: ${id}`);
        }
    }
}


if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exit(1);
}


console.log('[search] 검색/카테고리 일관성 검증 통과');
