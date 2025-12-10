import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

async function testScrape() {
    // Example ID from a known performance (need a real ID)
    // I'll pick a random ID pattern or try to fetch list first

    console.log("Fetching list to get a real ID...");
    // Minimal list fetch logic
    const listUrl = 'http://ticket.interpark.com/TPGoodsList.asp?Ca=Mu&SubCa=Musical&Place=Seoul'; // Example URL from earlier knowledge or I can use the existing lib

    // Actually let's use the lib's fetch logic if possible, or just raw axios for a known page
    // Let's hardcode a known Interpark GoodsCode if I can find one in the logs? 
    // I saw "GoodsCode=(\d+)" in logs?
    // Let's look at venues.json again to see if I stored IDs? No, keys are names.

    // Let's just run fetchPerformances('seoul') for 1 item
    const { fetchPerformances } = await import('../src/lib/interpark');
    const items = await fetchPerformances('seoul');
    if (items.length === 0) {
        console.log("No items found");
        return;
    }

    const target = items[0];
    console.log(`Testing ID: ${target.id}, Title: ${target.title}, Venue: ${target.venue}`);

    // logic from build-venues.ts
    const url = `https://ticket.interpark.com/TIKI/Main/TikiGoodsInfo.asp?GoodsCode=${target.id}`;

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const decoded = iconv.decode(response.data, 'euc-kr');
        const $ = cheerio.load(decoded);

        console.log("Page Title:", $('title').text());

        // Check for PlaceCode
        const html = $.html();

        const fs = await import('fs');
        fs.writeFileSync('debug_page.html', html);
        console.log("Dumped HTML to debug_page.html");

        // Quick check for JSON
        if (html.includes('__NEXT_DATA__')) console.log("Found __NEXT_DATA__");
        if (html.includes('goodsInfo')) console.log("Found goodsInfo");

        // Sometimes it's in a Javascript function like: javascript:fnPlacePopup('12345')
        // Or hidden input
        // Or in the 'place' dt/dd

        const $place = $('.place');
        console.log("Place section html:", $place.html());

        const placeCodeMatch = html.match(/PlaceCode=(\w+)/) || html.match(/fnPlacePopup\('(\w+)'\)/);

        if (placeCodeMatch) {
            console.log("Found PlaceCode:", placeCodeMatch[1]);

            // Now fetch Place Popup
            const popupUrl = `https://ticket.interpark.com/TPPlace/Main/TPPlace_Detail.asp?PlaceCode=${placeCodeMatch[1]}`;
            const pRes = await axios.get(popupUrl, { responseType: 'arraybuffer' });
            const pDec = iconv.decode(pRes.data, 'euc-kr');
            const $p = cheerio.load(pDec);

            // Dump text to see address
            console.log("Popup Body Text Snippet:", $p('body').text().substring(0, 500).replace(/\s+/g, ' '));

            // Try invalid selectors
            let address = '';
            $p('td, li, div').each((i, el) => {
                const text = $p(el).text();
                if (text.includes('주소')) {
                    console.log("Found '주소' in tag:", text.trim());
                }
            });

        } else {
            console.log("No PlaceCode found in HTML");
        }

    } catch (e) {
        console.error(e);
    }
}

testScrape();
