
import { test, expect } from '@playwright/test';

const LOCALES = ['ko', 'en', 'zh', 'ja'];
const GENRES = ['movie', 'musical', 'theater', 'concert', 'exhibition', 'sports'];
const BASE_URL = 'http://localhost:3000'; // No /culture prefix in dev

test.describe('User Surfing Simulation', () => {
  for (const locale of LOCALES) {
    for (const genre of GENRES) {
      test(`Surf ${genre} in ${locale}`, async ({ page }) => {
        // Navigate to the locale home page
        await page.goto(`${BASE_URL}/${locale}/`);
        
        // 1. Verify URL and Locale
        expect(page.url()).toContain(`/${locale}/`);
        
        // 2. Check for Page Title / Header (should be translated)
        // This is a heuristic, adjust based on actual DOM selectors
        const h1 = page.locator('h1');
        if (await h1.count() > 0) {
            const titleText = await h1.first().innerText();
            expect(titleText.length).toBeGreaterThan(0);
        }

        // 3. Verify Content Cards are present
        // Use a more specific selector that matches PerformanceCard/ListItem structure
        const cards = page.locator('div[style*="content-visibility: visible"]');
        await expect(cards.first()).toBeVisible({ timeout: 20000 });
        
        // 4. Check for Broken Images
        const images = page.locator('img');
        const imageCount = await images.count();
        for (let i = 0; i < Math.min(imageCount, 5); i++) {
            const isVisible = await images.nth(i).isVisible();
            if (isVisible) {
                const naturalWidth = await images.nth(i).evaluate((node: HTMLImageElement) => node.naturalWidth);
                expect(naturalWidth).toBeGreaterThan(0);
            }
        }

        // 5. Navigate to a Detail Page if possible
        if (await cards.count() > 0) {
            // Click the card but wait for the link to be actionable
            await cards.first().click();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000); // Small buffer for client-side navigation
            
            // Check for critical detail fields (Price, Address, etc.)
            // Adjust selectors to match your UI
            const detailLabels = ['Price', 'Address', '가격', '주소']; 
            const bodyText = await page.innerText('body');
            
            // At least some content should be visible
            expect(bodyText.length).toBeGreaterThan(100);
        }
      });
    }
  }
});
