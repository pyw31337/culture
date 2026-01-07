
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

interface Performance {
    id: string;
    title: string;
    date: string;
    venue: string;
    link: string;
    genre: string;
    image: string;
    region: string;
    price?: string;
}

const HOCKEY_URL = 'http://www.hlicehockey.com/%EC%9D%BC%EC%A0%95-%EA%B2%B0%EA%B3%BC/';

async function scrapeHockey() {
    console.log('Starting Hockey Scraper (HL Anyang)...');

    try {
        const response = await axios.get(HOCKEY_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const data: Performance[] = [];

        const VENUE_MAP: Record<string, string> = {
            'ANYANG': '안양 종합운동장 실내빙상장',
        };

        // Select rows based on the HTML dump structure
        $('.sp-row.sp-post').each((_, row) => {
            const dateStrRaw = $(row).find('td.data-date a date').text().trim(); // e.g., "2025-09-21 14:00:00"
            const timeStrRaw = $(row).find('td.data-time a date').text().trim(); // e.g., "14:00:00"
            const homeTeamRaw = $(row).find('td.data-home').text().trim();
            const awayTeamRaw = $(row).find('td.data-away').text().trim();
            const venueRaw = $(row).find('td.data-venue div').text().trim(); // e.g., "ANYANG"

            if (dateStrRaw && homeTeamRaw && awayTeamRaw) {
                // Parse Date
                // The dump shows <date>2026-02-28 15:00:00</date> inside the first column.
                // We can use that directly.
                // Or if dateStrRaw is "2026-02-28 15:00:00", we can sanitize it.
                // The time column also has time, but if the date column has full datetime, let's use it.
                // It seems dateStrRaw might be "2026-02-28 15:00:00" (from the inner text of <date> tag).

                let date = dateStrRaw.replace(/\./g, '-');
                if (!date.includes(':')) {
                    // Try combining with time if date didn't have time
                    if (timeStrRaw) {
                        date = `${date} ${timeStrRaw}`;
                    }
                }

                // Cleanup Team Names (remove leading/trailing spaces, maybe extra info)
                const homeTeam = homeTeamRaw.replace(/\s+/g, ' ').trim();
                const awayTeam = awayTeamRaw.replace(/\s+/g, ' ').trim();

                const venueName = VENUE_MAP[venueRaw] || venueRaw;

                const title = `${homeTeam} vs ${awayTeam}`;

                // Generate ID
                const id = `hockey_${date.replace(/[- :]/g, '')}_${title.replace(/\s/g, '')}`;

                // Region Logic
                let region = 'etc';
                if (venueName === '안양 종합운동장 실내빙상장') {
                    region = 'gyeonggi';
                } else if (['HACHINOHE', 'AMAGASAKI', 'TOMAKOMAI', 'NIKKO', 'KUSHIRO', 'YOKOHAMA', 'TOKYO', 'SEOUL'].includes(venueRaw)) {
                    // Basic Japan/Other mapping logic
                    region = 'etc';
                }

                data.push({
                    id,
                    title,
                    date,
                    venue: venueName,
                    link: HOCKEY_URL,
                    genre: 'hockey',
                    image: '/culture/images/hockey_poster.png',
                    region
                });
            }
        });

        console.log(`Extracted ${data.length} matches.`);

        // Use process.cwd() since we run from project root
        const outputPath = path.resolve(process.cwd(), 'src/data/hockey.json');
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log(`Saved ${data.length} items to ${outputPath}`);

    } catch (error) {
        console.error('Scraping failed:', error);
    }
}

scrapeHockey();
