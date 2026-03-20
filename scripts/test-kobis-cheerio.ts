import * as cheerio from 'cheerio';
import fs from 'fs';

function parseKobis() {
    const html = fs.readFileSync('/Users/pyw31337/Developer/CultureFlow-New/scripts/kobis.html', 'utf-8');
    const $ = cheerio.load(html);

    const results: any[] = [];

    // The items are probably inside some list. Let's look for the spans with dates.
    $('.item, li, tr').each((_, el) => {
        const text = $(el).text();
        if (text.includes('2026-')) {
            // It might be a list item containing the date and the title
            const dateSpan = $(el).find('span').filter((_, s) => $(s).text().includes('2026-'));
            const date = dateSpan.text().trim();
            const title = $(el).find('.tit, .title, a').first().attr('title') || $(el).find('strong, .tit').first().text().trim();
            const poster = $(el).find('img').attr('src');

            if (date && title && poster) {
                // Avoid duplicates 
                if (!results.find(m => m.title === title && m.date === date)) {
                    results.push({ date, title: title.replace('상세정보', '').trim(), poster });
                }
            }
        }
    });

    console.log(`Found ${results.length} movies.`);
    console.log(results.slice(0, 10));
}

parseKobis();
