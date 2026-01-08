
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

async function patchOTT() {
    const dataPath = path.resolve(process.cwd(), 'src/data/ott.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const items = JSON.parse(rawData);

    // Filter items that need patching
    const targets = items.filter((item: any) => !item.grade || item.title === '스프링 피버');
    console.log(`Found ${targets.length} items to patch.`);

    if (targets.length === 0) {
        console.log('No items to patch.');
        return;
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844 });

        for (let i = 0; i < targets.length; i++) {
            const item = targets[i];
            console.log(`[${i + 1}/${targets.length}] Patching: ${item.title}`);

            try {
                await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 20000 });

                try {
                    await page.waitForSelector('.metadata__item', { timeout: 8000 }); // Longer timeout
                } catch (e) {
                    console.log(`  -> Metadata wait timeout for ${item.title}`);
                }

                const details = await page.evaluate(() => {
                    const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();

                    const getMetadataValue = (labelKeywords: string[]) => {
                        const items = Array.from(document.querySelectorAll('.metadata__item'));
                        for (const item of items) {
                            const titleEl = item.querySelector('.item__title');
                            if (titleEl) {
                                const titleText = cleanText(titleEl.textContent || '');
                                if (labelKeywords.some(k => titleText.includes(k))) {
                                    const fullText = cleanText(item.textContent || '');
                                    return fullText.replace(titleText, '').trim();
                                }
                            }
                        }
                        return '';
                    };

                    const getDirector = () => {
                        const staffs = Array.from(document.querySelectorAll('.staff'));
                        for (const staff of staffs) {
                            const titleEl = staff.querySelector('.staff__title');
                            if (titleEl && cleanText(titleEl.textContent || '').includes('감독')) {
                                const nameEl = staff.querySelector('.names__name');
                                return nameEl ? cleanText(nameEl.textContent || '') : '';
                            }
                        }
                        return '';
                    };

                    const getCast = () => {
                        const actors = Array.from(document.querySelectorAll('[id^="actorList-"] .name'));
                        return actors.slice(0, 5).map(el => cleanText(el.textContent || '')).filter(Boolean);
                    };

                    const genre = getMetadataValue(['장르']);
                    const runtime = getMetadataValue(['러닝타임']);
                    const date = getMetadataValue(['방영일', '개봉일']);
                    const grade = getMetadataValue(['연령등급']);

                    return {
                        movieInfo: [genre, runtime].filter(Boolean).join(' / '),
                        grade: grade,
                        director: getDirector(),
                        cast: getCast(),
                        detailDate: date
                    };
                });

                // Update item in main list
                const idx = items.findIndex((p: any) => p.id === item.id);
                if (idx !== -1) {
                    let finalDate = items[idx].date;
                    if (details.detailDate) {
                        const match = details.detailDate.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
                        if (match) {
                            finalDate = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
                        }
                    }

                    items[idx] = {
                        ...items[idx],
                        ...details,
                        date: finalDate,
                    };
                    console.log(`  -> Success: ${details.grade} | ${finalDate}`);
                }

            } catch (e) {
                console.error(`  -> Failed: ${e}`);
            }
        }

        fs.writeFileSync(dataPath, JSON.stringify(items, null, 2));
        console.log('Patch complete and saved.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

patchOTT();
