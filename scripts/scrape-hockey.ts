
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

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
    homeTeam?: string;
    awayTeam?: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
}

const HOCKEY_URL = 'https://www.hlicehockey.com/%EC%9D%BC%EC%A0%95-%EA%B2%B0%EA%B3%BC/';

async function scrapeHockey() {
    console.log('Starting Hockey Scraper (HL Anyang) [Clean Run]...');

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--ignore-certificate-errors'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.goto(HOCKEY_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for table
        try {
            await page.waitForSelector('#DataTables_Table_0', { timeout: 10000 });
        } catch (e) {
            console.log('DataTable selector not found, trying generic .sp-post');
        }

        const data: Performance[] = await page.evaluate(function () {
            const rows = Array.from(document.querySelectorAll('.sp-row.sp-post'));
            const results: Performance[] = [];

            const VENUE_MAP: Record<string, string> = {
                'ANYANG': '안양 종합운동장 실내빙상장',
            };

            // Helper to clean logo URL (remove -32x32, -300x300 etc.)
            function processLogo(src?: string | null) {
                if (!src) return '';
                let abs = src;
                if (!abs.startsWith('http')) {
                    const base = 'https://www.hlicehockey.com';
                    abs = `${base}${abs.startsWith('/') ? '' : '/'}${abs}`;
                }

                // Remove resolution pattern like -32x32, -150x150 before extension
                return abs.replace(/-\d+x\d+(?=\.[a-zA-Z]+$)/, '');
            }

            for (const row of rows) {
                // Selectors
                const dateEl = row.querySelector('td.data-date date');
                const timeEl = row.querySelector('td.data-time date');
                const homeEl = row.querySelector('td.data-home');
                const awayEl = row.querySelector('td.data-away');
                const venueEl = row.querySelector('td.data-venue div');

                if (!dateEl || !homeEl || !awayEl) continue;

                // Date Parsing
                const dateText = dateEl.textContent?.trim() || '';
                const timeText = timeEl?.textContent?.trim() || '';

                let dateStr = dateText.replace(/\./g, '-');
                // If date doesn't include time (:) and timeText exists, merge
                if (!dateStr.includes(':') && timeText) {
                    dateStr = `${dateStr} ${timeText}`;
                }

                // Convert to ISO 8601 for Safari compatibility (YYYY-MM-DDTHH:mm:ss)
                const date = dateStr.replace(' ', 'T');

                const homeTeam = homeEl.textContent?.trim() || '';
                const awayTeam = awayEl.textContent?.trim() || '';
                const venueRaw = venueEl?.textContent?.trim() || '';
                const venue = VENUE_MAP[venueRaw] || venueRaw;

                // Logos
                // User selector: td.data-home.has-logo > span > img
                // We use robust find
                const homeImg = row.querySelector('td.data-home img');
                const awayImg = row.querySelector('td.data-away img');

                const homeTeamLogo = processLogo(homeImg?.getAttribute('src'));
                const awayTeamLogo = processLogo(awayImg?.getAttribute('src'));

                const title = `${homeTeam} vs ${awayTeam}`;

                // Region Logic
                let region = 'etc';
                if (venue === '안양 종합운동장 실내빙상장') {
                    region = 'gyeonggi';
                } else if (['HACHINOHE', 'AMAGASAKI', 'TOMAKOMAI', 'NIKKO', 'KUSHIRO', 'YOKOHAMA', 'TOKYO', 'SEOUL'].includes(venueRaw)) {
                    region = 'etc';
                }

                // ID
                const safeDate = date.replace(/[- :T]/g, '');
                const safeTitle = title.replace(/\s/g, '');
                const id = `hockey_${safeDate}_${safeTitle}`;

                results.push({
                    id,
                    title,
                    date,
                    venue,
                    link: 'https://www.hlicehockey.com/%EC%9D%BC%EC%A0%95-%EA%B2%B0%EA%B3%BC/',
                    genre: 'hockey',
                    image: '/culture/images/hockey_poster.png',
                    region,
                    homeTeam,
                    awayTeam,
                    homeTeamLogo,
                    awayTeamLogo
                });
            }
            return results;
        });

        console.log(`Extracted ${data.length} matches.`);

        const outputPath = path.resolve(process.cwd(), 'src/data/hockey.json');
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log(`Saved items to ${outputPath}`);

    } catch (error) {
        console.error('Scraping failed:', error);
    } finally {
        await browser.close();
    }
}

scrapeHockey();
