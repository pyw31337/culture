import { chromium } from 'playwright';

async function testKobisUpcoming() {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const url = 'https://www.kobis.or.kr/kobis/business/mast/mvie/findOpenScheduleList.do';
        console.log(`Navigating to ${url}`);

        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Change Date Range: Mar 1, 2026 to Dec 31, 2026
        // KOBIS typically uses input IDs: 
        // Start date: sOpenYear, sOpenMonth
        // Or flat inputs. Let's inspect the page first.
        const pageInputs = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input'));
            const selects = Array.from(document.querySelectorAll('select'));
            return {
                inputs: inputs.map(i => ({ id: i.id, name: i.name, value: i.value })),
                selects: selects.map(s => ({ id: s.id, name: s.name, value: s.value })),
            };
        });

        console.log("Inputs:", pageInputs.inputs.filter(i => i.name.includes('Dt') || i.name.includes('YVMO') || i.name.includes('Month') || i.name.includes('Year')));
        console.log("Selects:", pageInputs.selects.filter(s => s.name.includes('Dt') || s.name.includes('YVMO') || s.name.includes('Month') || s.name.includes('Year')));

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

testKobisUpcoming();
