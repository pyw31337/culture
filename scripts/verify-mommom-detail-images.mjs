// 검증 스크립트(순수 JS): 개선된 맘맘 상세 이미지 추출이 광고 배너를 제거하는지 확인.
// 실행: node scripts/verify-mommom-detail-images.mjs
import * as cheerio from 'cheerio';

const BASE_URL = 'https://mom-mom.net';
const MOMMOM_IMAGE_PREFIX = 'https://image.mom-mom.net/';
const AD_KEY_PREFIXES = ['events/', 'showcases/', 'banners/', 'promotions/', 'curations/'];

const compact = (v) => (v || '').replace(/\s+/g, ' ').trim();

function clean(v) {
    return compact(v).replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&').replace(/[),.;]+$/u, '');
}

function parsePayload(v) {
    const url = clean(v);
    if (!url.startsWith(MOMMOM_IMAGE_PREFIX)) return null;
    const enc = url.slice(MOMMOM_IMAGE_PREFIX.length).split(/[?#]/)[0];
    if (!enc) return null;
    try { return JSON.parse(Buffer.from(decodeURIComponent(enc), 'base64').toString('utf8')); } catch { return null; }
}

const isAdKey = (k) => !!k && AD_KEY_PREFIXES.some((p) => k.startsWith(p));

function extractFlight(html) {
    const re = /<script>self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g;
    let m, text = '';
    while ((m = re.exec(html))) {
        try { const c = JSON.parse(m[1]); if (typeof c[1] === 'string') text += c[1]; } catch {}
    }
    return text;
}

function extractBalanced(text, start) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
    }
    return '';
}

function getProductDetail(html) {
    const text = extractFlight(html);
    const idx = text.indexOf('"product":');
    if (idx < 0) return null;
    const start = text.indexOf('{', idx);
    const raw = extractBalanced(text, start);
    try { return JSON.parse(raw); } catch { return null; }
}

function extractImagesFromContentHtml(html) {
    if (!html) return [];
    const norm = html.replace(/\\u002F/g, '/').replace(/\\\//g, '/');
    const $ = cheerio.load(norm);
    const seen = new Set(), result = [];
    $('img').each((_, el) => {
        const a = el.attribs || {};
        const src = (a.src || a['data-src'] || a['data-original'] || '').trim();
        if (!src) return;
        let url = src;
        if (url.startsWith('//')) url = `https:${url}`;
        if (url.startsWith('http://')) url = `https://${url.slice(7)}`;
        if (url.includes('image.mom-mom.net/')) {
            const p = parsePayload(url);
            if (p && isAdKey(p.key)) return;
        }
        const dedupe = parsePayload(url)?.key || url;
        if (seen.has(dedupe)) return;
        seen.add(dedupe);
        result.push(url);
    });
    return result;
}

async function verify(productNo) {
    const r = await fetch(`${BASE_URL}/shop/products/${productNo}`, {
        headers: {
            accept: 'text/html,application/xhtml+xml',
            'accept-language': 'ko-KR,ko;q=0.9',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) CultureFlowBot/1.0',
        },
    });
    const html = await r.text();
    const detail = getProductDetail(html);
    if (!detail) { console.log(productNo, '- no detail'); return; }

    const contentHtml = [detail.baseInfo?.contentHeader, detail.baseInfo?.content, detail.baseInfo?.contentFooter]
        .filter(Boolean).join('\n');
    const detailImages = extractImagesFromContentHtml(contentHtml);

    // 비교용: 옛 알고리즘
    const norm = html.replace(/\\u002F/g, '/').replace(/\\\//g, '/');
    const oldMatches = norm.match(/https:\/\/image\.mom-mom\.net\/[^"'<>\\\s)]+/g) || [];
    const oldSeen = new Set(), oldKeys = [];
    for (const m of oldMatches) {
        const p = parsePayload(m);
        if (!p?.key?.startsWith('events/')) continue;
        if (oldSeen.has(p.key)) continue;
        oldSeen.add(p.key);
        oldKeys.push(p.key);
    }

    console.log(`\n=== ${productNo} : ${compact(detail.baseInfo?.productName)} ===`);
    console.log(`[OLD] events/* in whole HTML  : ${oldKeys.length}개 (모두 광고)`);
    oldKeys.forEach((k) => console.log('   ⚠ AD:', k));
    console.log(`[NEW] from baseInfo.content*  : ${detailImages.length}개`);
    detailImages.forEach((u) => {
        const p = parsePayload(u);
        console.log('   ✓', p?.key ? `mom-mom ${p.key}` : `EXT  ${u.slice(0, 110)}`);
    });
}

for (const id of [133340022, 118088163, 120904162, 132375467, 131218229]) {
    await verify(id);
    await new Promise((r) => setTimeout(r, 200));
}
