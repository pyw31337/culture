
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

async function checkImage(url: string) {
    try {
        const res = await axios.head(url);
        return res.status;
    } catch (e: any) {
        return e.response?.status || 500;
    }
}

async function debugInterparkImages() {
    const url = `https://ticket.interpark.com/TiKi/Special/TPRegionReserve.asp?Region=42001`; // Seoul
    console.log(`Fetching ${url}...`);

    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
    });

    const decoded = iconv.decode(response.data, 'euc-kr');
    const $ = cheerio.load(decoded);

    const maxCheck = 5;

    const items: string[] = [];
    const maxScan = 200; // Scan more items to find edge cases

    $('.obj .content').each((_, el) => {
        if (items.length >= maxScan) return;
        const $el = $(el);
        const $img = $el.find('dd.name img');
        const originalImage = $img.attr('src') || '';
        if (originalImage) items.push(originalImage);
    });

    console.log(`Scanned ${items.length} images.`);

    for (let i = 0; i < items.length; i++) {
        const originalImage = items[i];

        // Check for edge cases: Path exists but NOT _p_s.jpg
        if (originalImage.includes('/rz/image/play/goods/poster/') && !originalImage.endsWith('_p_s.jpg')) {
            console.log(`\n[EDGE CASE FOUND] ${originalImage}`);

            let transformed = originalImage.replace('/rz/image/play/goods/poster/', '/Play/image/large/');
            // Current logic would stop here for the extension, leaving it with _p_s.gif or whatever

            console.log(`    Current Logic Result: ${transformed}`);
            const status = await checkImage(transformed);
            console.log(`    Status: ${status}`);

            // Proposed fix: Regex replace
            const fixed = originalImage.replace('/rz/image/play/goods/poster/', '/Play/image/large/').replace(/_p_s\.(jpg|gif|png|bmp)/i, '_p.gif');
            console.log(`    Proposed Fix: ${fixed}`);
            const fixedStatus = await checkImage(fixed);
            console.log(`    Fixed Status: ${fixedStatus}`);
        }
    }
}

debugInterparkImages();
