
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

const TEST_URL = 'https://mom-mom.net/travel/places/646d780e27695e662cc7ed78';

async function testScrape() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    try {
        console.log('Navigating to:', TEST_URL);
        await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

        // Click all toggles to reveal hidden content
        await page.evaluate(async () => {
            const toggles = Array.from(document.querySelectorAll('.toggle-title'));
            for (const toggle of toggles) {
                (toggle as HTMLElement).click();
                await new Promise(res => setTimeout(res, 300));
            }
        });

        const details = await page.evaluate(() => {
            const allKeyElements = Array.from(document.querySelectorAll('p.key, th, dt, span.key'));
            const allPs = Array.from(document.querySelectorAll('p, li, article div, span'));
            const allDivs = Array.from(document.querySelectorAll('div'));
            
            // 1. Title
            const pageTitle = document.querySelector('h1')?.textContent?.trim() || 
                           document.querySelector('h2')?.textContent?.trim() || '';

            // 2. Address
            let address = '';
            const addressKey = allKeyElements.find(el => el.textContent?.trim() === '주소');
            if (addressKey) {
                let valueEl = addressKey.nextElementSibling;
                if (valueEl && (valueEl.classList.contains('value') || valueEl.tagName === 'P')) {
                    address = valueEl.textContent?.trim() || '';
                }
                if (!address && addressKey.parentElement) {
                    const parentValue = addressKey.parentElement.querySelector('.value, p:last-child');
                    if (parentValue) address = parentValue.textContent?.trim() || '';
                }
            }

            // 3. Website
            let website = '';
            const webKey = allKeyElements.find(el => el.textContent?.includes('홈페이지'));
            if (webKey) {
                const linkEl = webKey.parentElement?.querySelector('a') || webKey.nextElementSibling?.querySelector('a');
                if (linkEl) website = linkEl.href;
            }

            // 4. Target Audience (Popular Age)
            let targetAudience = '';
            const greyIcons = Array.from(document.querySelectorAll('.icon-help-grey'));
            greyIcons.forEach(icon => {
                const parent = icon.parentElement;
                if (parent && parent.textContent?.includes('인기 연령')) {
                    const infoEl = parent.nextElementSibling || parent.parentElement?.nextElementSibling;
                    if (infoEl) {
                        // Look for text like "48개월 이상 딸..."
                        const text = infoEl.textContent?.trim() || '';
                        if (text) targetAudience = text.replace(/업데이트.*/, '').trim();
                    }
                }
            });
            // Improved fallback
            if (!targetAudience) {
                const targetText = allPs.map(p => p.textContent?.trim()).find(t => t && t.includes('인기') && t.includes('개월'));
                if (targetText) targetAudience = targetText;
            }

            // 5. Operating Hours & Price Detail (Check Toggles)
            let priceDetail = '';
            let operatingHours = '';
            
            const toggles = Array.from(document.querySelectorAll('.toggle-title'));
            toggles.forEach(toggle => {
                const text = toggle.textContent || '';
                // Get the content from the expanded sibling
                const contentEl = toggle.nextElementSibling;
                const content = contentEl?.textContent?.trim() || '';

                if (text.includes('입장료') || text.includes('요금')) {
                    priceDetail = content;
                }
                if (text.includes('관람 시간') || text.includes('날짜') || text.includes('이용 시간')) {
                    operatingHours = content;
                }
            });

            // 6. Facilities
            let facilities = '';
            const facKey = allKeyElements.find(el => el.textContent?.includes('편의시설') || el.textContent?.includes('시설'));
            if (facKey && facKey.parentElement) {
                facilities = facKey.parentElement.textContent?.trim() || '';
            }

            return { 
                pageTitle, 
                address, 
                website, 
                targetAudience, 
                priceDetail, 
                operatingHours, 
                facilities 
            };
        });

        console.log('Scraped Details:', JSON.stringify(details, null, 2));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

testScrape();
