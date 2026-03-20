import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

puppeteer.use(StealthPlugin());

const DATA_PATH = path.resolve(process.cwd(), 'src/data/mommom.json');
const TARGET_LINK = 'https://mom-mom.net/travel/places/655ac8ff7befcfe324f22e26';

async function patchTarget() {
    console.log(`Patching target item: ${TARGET_LINK}`);

    if (!fs.existsSync(DATA_PATH)) {
        console.error('Data file not found');
        return;
    }

    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    const index = data.findIndex((item: any) => item.link.includes('655ac8ff7befcfe324f22e26'));

    if (index === -1) {
        console.error('Target item not found in existing data.');
        return;
    }

    const item = data[index];
    console.log(`Found item: ${item.title}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        await page.goto(TARGET_LINK, { waitUntil: 'networkidle2', timeout: 30000 });

        // Use the improved logic from scrape-mommom.ts
        const details = await page.evaluate(() => {
            // 특징 (Feature)
            let feature = '';
            const descP = document.querySelector('p.item-description');
            if (descP) {
                feature = descP.textContent?.trim() || '';
            }
            if (!feature) {
                const articleP = document.querySelector('article > div > p');
                if (articleP) feature = articleP.textContent?.trim() || '';
            }

            // 대상 (Target Audience)
            let target = '';
            const allPs = Array.from(document.querySelectorAll('article p'));
            const targetEl = allPs.find(el => {
                const text = el.textContent || '';
                return (text.includes('인기') && text.includes('개월')) ||
                    (text.includes('세') && text.includes('이상')) ||
                    (text.includes('모두') && text.includes('추천'));
            });

            if (targetEl) {
                target = targetEl.textContent?.replace(/\n/g, ' ').trim() || '';
                target = target.replace(/\d{4}\.\d{2}\.\d{2}.*업데이트.*/, '').trim();
            }

            // 운영 (Operating Hours Summary)
            let operatingHours = '';
            const allKeyElements = Array.from(document.querySelectorAll('p.key'));
            const hoursKey = allKeyElements.find(el => el.textContent?.trim() === '영업시간');

            if (hoursKey && hoursKey.parentElement) {
                const hoursContainer = hoursKey.parentElement;
                const hourLines = [];
                const dayPatterns = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
                const hoursText = hoursContainer.textContent || '';
                let daysWithHours = 0;

                dayPatterns.forEach(day => {
                    if (hoursText.includes(day)) {
                        // Check if this day has hours (not just "정기휴무")
                        const dayIndex = hoursText.indexOf(day);
                        const afterDay = hoursText.substring(dayIndex, dayIndex + 30);
                        if (afterDay.includes(':') && !afterDay.includes('정기휴무')) {
                            daysWithHours++;
                        }
                    }
                });


                for (const day of dayPatterns) {
                    const idx = hoursText.indexOf(day);
                    if (idx !== -1) {
                        const afterDay = hoursText.substring(idx);
                        const timeMatch = afterDay.match(/(\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2})/);
                        if (timeMatch) {
                            const timeStr = timeMatch[1];
                            const dayAbbrev = day.replace('요일', '');
                            hourLines.push(`${dayAbbrev}: ${timeStr}`);
                            break;
                        }
                    }
                }

                if (hourLines.length > 0) {
                    if (daysWithHours >= 7) {
                        operatingHours = `매일 ${hourLines[0].split(': ')[1]}`;
                    } else if (daysWithHours >= 5) {
                        operatingHours = `월-일 ${hourLines[0].split(': ')[1]}`;
                    } else {
                        operatingHours = hourLines.join(', ');
                    }
                }
            }

            // Build description
            let description = '';
            if (feature) description += `[특징] ${feature}\n`;
            if (target) description += `[대상] ${target}\n`;
            if (operatingHours) description += `[운영] ${operatingHours}`;
            return description.trim();
        });

        console.log(`Extracted Description:\n${details}`);

        // Update item
        data[index].description = details;

        // Save
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
        console.log('Successfully patched mommom.json');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

patchTarget();
