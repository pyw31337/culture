/**
 * Test script to verify MochaClass address extraction
 * Tests multiple approaches to find address information
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const TEST_URLS = [
    'https://mochaclass.com/class/62ee251bc1784247173158d2', // 중원구
    'https://mochaclass.com/class/6020ad3406f4351656fd8413', // 강남구
    'https://mochaclass.com/class/601692ba8a53ab4f275ef0ba', // 송파구
    'https://mochaclass.com/class/60adf9e68d9f284f7820fc38', // 강서구
    'https://mochaclass.com/class/61ed19f94ce5867934438244', // 관악구
];

async function testAddressExtraction() {
    console.log('Testing MochaClass Address Extraction...\n');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    for (const url of TEST_URLS) {
        console.log(`\n=== Testing: ${url} ===`);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 2000));

            // Try multiple extraction strategies
            const result = await page.evaluate(() => {
                const results: { [key: string]: string } = {};

                // Strategy 1: Original selector
                const origSelector = '#topleft > div:nth-child(10) > div > p.MuiTypography-root';
                const orig = document.querySelector(origSelector);
                results['strategy1_original'] = orig?.textContent?.trim() || 'NOT FOUND';

                // Strategy 2: Look for text containing Korean address patterns
                // Korean addresses typically start with 대한민국, 서울, 경기도, etc.
                const addressPatterns = ['대한민국', '서울', '경기', '인천', '부산', '대전', '대구', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

                const allParagraphs = document.querySelectorAll('p');
                for (const p of allParagraphs) {
                    const text = p.textContent?.trim() || '';
                    if (addressPatterns.some(pattern => text.startsWith(pattern) || text.includes(pattern + '도') || text.includes(pattern + '시') || text.includes(pattern + '특별'))) {
                        // Check if it looks like an address (has road/street names)
                        if (text.includes('로') || text.includes('길') || text.includes('동') || text.includes('구')) {
                            results['strategy2_text_search'] = text;
                            break;
                        }
                    }
                }
                if (!results['strategy2_text_search']) {
                    results['strategy2_text_search'] = 'NOT FOUND';
                }

                // Strategy 3: Look for MuiTypography with address-like content
                const muiTexts = document.querySelectorAll('.MuiTypography-root');
                for (const el of muiTexts) {
                    const text = el.textContent?.trim() || '';
                    // Check if it matches Korean address format
                    const addressMatch = text.match(/(대한민국\s+)?(서울|경기|인천|부산|대전|대구|광주|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]+?(로|길|동)\s+[\d-]+/);
                    if (addressMatch) {
                        results['strategy3_mui_address'] = text;
                        break;
                    }
                }
                if (!results['strategy3_mui_address']) {
                    results['strategy3_mui_address'] = 'NOT FOUND';
                }

                // Strategy 4: Look near map/location icons
                const locationIcons = document.querySelectorAll('svg[data-testid="LocationOnIcon"], svg.MuiSvgIcon-root');
                for (const icon of locationIcons) {
                    const parent = icon.closest('div');
                    if (parent) {
                        const siblingP = parent.querySelector('p');
                        if (siblingP) {
                            const text = siblingP.textContent?.trim() || '';
                            if (text.length > 10 && (text.includes('로') || text.includes('길'))) {
                                results['strategy4_near_icon'] = text;
                                break;
                            }
                        }
                    }
                }
                if (!results['strategy4_near_icon']) {
                    results['strategy4_near_icon'] = 'NOT FOUND';
                }

                // Strategy 5: Look in #topleft for any text with address pattern
                const topleft = document.querySelector('#topleft');
                if (topleft) {
                    const allTexts = topleft.querySelectorAll('p, span, div');
                    for (const el of allTexts) {
                        const text = el.textContent?.trim() || '';
                        // Match: 대한민국 경기도 성남시... or 서울 강남구...
                        if (/^(대한민국\s+)?(서울|경기도?|인천|부산|대전|대구|광주|울산|세종|강원도?|충청북도?|충청남도?|전라북도?|전라남도?|경상북도?|경상남도?|제주)/.test(text)) {
                            if (text.length > 15 && text.length < 100) {
                                results['strategy5_topleft_search'] = text;
                                break;
                            }
                        }
                    }
                }
                if (!results['strategy5_topleft_search']) {
                    results['strategy5_topleft_search'] = 'NOT FOUND';
                }

                return results;
            });

            console.log('Extraction Results:');
            for (const [strategy, value] of Object.entries(result)) {
                const status = value === 'NOT FOUND' ? '❌' : '✅';
                console.log(`  ${status} ${strategy}: ${value.substring(0, 80)}${value.length > 80 ? '...' : ''}`);
            }

        } catch (error) {
            console.log(`  ERROR: ${error}`);
        }
    }

    await browser.close();
    console.log('\n=== Test Complete ===');
}

testAddressExtraction().catch(console.error);
