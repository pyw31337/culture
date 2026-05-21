/**
 * mommom-products.json 일회성 클린업.
 *
 * 1) synopsisImages에서 광고 자산(events/*, showcases/*, banners/*, promotions/*, curations/*)을 모두 제거.
 * 2) image 필드의 NHN 커머스 CDN 파일명에 사이즈 단서가 있으면 가능한 한 더 큰 원본으로 추정 교체.
 *    (NHN CDN은 리사이즈 파라미터를 지원하지 않으므로, 같은 폴더 안에 존재하는 큰 파일을 살펴 매핑.)
 *    안전을 위해 동일한 폴더 안에 단순한 매핑 규칙으로만 시도하며 매핑 후보가 없으면 그대로 둔다.
 *
 * 실행: node scripts/cleanup-mommom-product-ads.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
// src/data/* 는 스크래퍼 원본 캐시, public/data/* 는 사이트가 실제로 읽는 빌드 산출물.
// 양쪽 모두 정리해야 화면에 즉시 반영된다.
const TARGETS = [
    path.join(ROOT, 'src/data/mommom-products.json'),
    path.join(ROOT, 'src/data/mommom-activities.json'),
    path.join(ROOT, 'public/data/performances.json'),
    path.join(ROOT, 'public/data/categories/activity.json'),
    path.join(ROOT, 'public/data/categories/tourism.json'),
    path.join(ROOT, 'public/data/categories/museum.json'),
    path.join(ROOT, 'public/data/categories/exhibition.json'),
    path.join(ROOT, 'public/data/categories/play.json'),
    path.join(ROOT, 'public/data/categories/theater.json'),
    path.join(ROOT, 'public/data/categories/musical.json'),
];
const MOMMOM_IMAGE_PREFIX = 'https://image.mom-mom.net/';
const AD_KEY_PREFIXES = ['events/', 'showcases/', 'banners/', 'promotions/', 'curations/'];

function parsePayload(url) {
    if (!url || !url.includes('image.mom-mom.net/')) return null;
    const enc = url.replace(MOMMOM_IMAGE_PREFIX, '').replace(/^https?:\/\/image\.mom-mom\.net\//, '').split(/[?#]/)[0];
    if (!enc) return null;
    try { return JSON.parse(Buffer.from(decodeURIComponent(enc), 'base64').toString('utf8')); } catch { return null; }
}

function isAd(url) {
    const p = parsePayload(url);
    return !!(p?.key && AD_KEY_PREFIXES.some((pre) => p.key.startsWith(pre)));
}

function scoreSize(url) {
    if (!url) return 0;
    const fn = (url.split('?')[0].split('#')[0].split('/').pop() || '').toLowerCase();
    let score = 0;
    const dim = fn.match(/(\d{3,5})\s*x\s*(\d{3,5})/);
    if (dim) score += Number(dim[1]) * Number(dim[2]);
    const w = fn.match(/[_-]?w(\d{3,5})/);
    if (w) score += Number(w[1]) * 600;
    if (/(썸네일|thumb|small|list|tiny|480|520)/i.test(fn)) score -= 500_000;
    if (/(대표|main|big|large|hero|origin|original|full)/i.test(fn)) score += 800_000;
    return score;
}

function cleanupFile(file) {
const raw = fs.readFileSync(file, 'utf8');
const items = JSON.parse(raw);

let removed = 0;
let cleanedItems = 0;
let imageUpgraded = 0;

for (const it of items) {
    // mommom 출처 항목만 손댄다 (public/data 파일은 yes24/인터파크/공연 데이터도 섞여있음).
    const src = String(it.source || it.platform || '');
    if (!src.startsWith('mommom')) continue;

    const before = (it.synopsisImages || []).length;
    if (Array.isArray(it.synopsisImages)) {
        it.synopsisImages = it.synopsisImages.filter((u) => typeof u === 'string' && !isAd(u));
        const after = it.synopsisImages.length;
        if (after !== before) {
            removed += (before - after);
            cleanedItems += 1;
        }
    }

    // image 필드 자동 교체 시도:
    // synopsisImages(광고 제거 후)에 더 큰 NHN CDN 원본이 있으면 그것을 hero로 채택.
    // NHN CDN은 리사이즈 파라미터를 지원하지 않으므로, 파일명에 박힌 사이즈 단서로만 비교한다.
    if (typeof it.image === 'string' && it.image) {
        const heroIsNHN = /mom-mom\.cdn-nhncommerce\.com/.test(it.image);
        const heroScore = scoreSize(it.image);
        const candidates = (it.synopsisImages || [])
            .filter((u) => typeof u === 'string' && /mom-mom\.cdn-nhncommerce\.com/.test(u))
            .sort((a, b) => scoreSize(b) - scoreSize(a));
        const best = candidates[0];
        // hero가 NHN인 경우에만 업그레이드(서로 다른 CDN끼리 섞지 않는다).
        if (heroIsNHN && best && best !== it.image && scoreSize(best) > heroScore + 100_000) {
            // 동일 자산이 hero와 synopsisImages 양쪽에 중복되지 않도록, 채택된 best는 synopsisImages에서 제거.
            it.image = best;
            it.synopsisImages = (it.synopsisImages || []).filter((u) => u !== best);
            imageUpgraded += 1;
        }
    }
}

fs.writeFileSync(file, JSON.stringify(items, null, 2) + '\n');
console.log(`[mommom cleanup] ${path.basename(file)}: items=${items.length}`);
console.log(`  - synopsisImages ad removed : ${removed} (across ${cleanedItems} items)`);
console.log(`  - image hero upgraded       : ${imageUpgraded}`);
}

for (const target of TARGETS) {
    if (!fs.existsSync(target)) {
        console.log(`[mommom cleanup] skip (missing): ${path.basename(target)}`);
        continue;
    }
    cleanupFile(target);
}
