
import fs from 'fs';
import path from 'path';
import { cleanTitle as libCleanTitle, formatUnifiedDate as libFormatUnifiedDate } from '../../src/lib/utils';
import { Performance } from '../../src/types';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/**
 * Shared Scraper Utilities for CultureFlow
 */

/**
 * Clean building/venue names by removing company suffixes, regional tags, and noise.
 */
export function cleanVenueName(name: string): string {
    if (!name) return '';
    return name
        .replace(/\(주\)/g, '')
        .replace(/\(재\)/g, '')
        .replace(/\(유\)/g, '')
        .replace(/\[서울\]/g, '')
        .replace(/\[경기\]/g, '')
        .replace(/\[인천\]/g, '')
        .replace(/［본점］/g, '')
        .replace(/【[^】]*】/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Standardize titles using the shared library logic
 */
export const cleanTitle = libCleanTitle;

/**
 * Robust date formatting for scrapers
 */
export const formatUnifiedDate = libFormatUnifiedDate;

/**
 * Create a stable, unique ID for a performance based on its core identity.
 */
export function generateStableId(title: string, date: string, venue: string, source: string): string {
    const cleanId = `${source}_${title}_${venue}`
        .replace(/[^a-z0-9가-힣]/gi, '_')
        .replace(/_+/g, '_')
        .toLowerCase()
        .substring(0, 150);
    return cleanId;
}

/**
 * Helper to save JSON data safely
 */
export function saveJson(filename: string, data: any) {
    const filePath = path.join(process.cwd(), 'src/data', filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[Scraper] Saved ${data.length || Object.keys(data).length} items to ${filename}`);
}

/**
 * Helper to load JSON data with a default value
 */
export function loadJson(filename: string, defaultValue: any = []) {
    const filePath = path.join(process.cwd(), 'src/data', filename);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return defaultValue;
}

/**
 * Clean price strings and extract numeric values if needed
 */
export function cleanPrice(price: string): string {
    if (!price) return '정보 없음';
    return price.trim().replace(/\s+/g, ' ');
}

/**
 * Standardize error reporting for scrapers.
 * Writes a .error file that the validator can pick up.
 */
export function reportError(scraperName: string, error: any) {
    const errorMsg = error instanceof Error ? error.stack || error.message : String(error);
    const filePath = path.join(process.cwd(), 'src/data', `${scraperName}.error`);
    fs.writeFileSync(filePath, `[${new Date().toISOString()}] ${errorMsg}`, 'utf8');
    console.error(`\n🚨 [${scraperName}] Critical Error Reported:`, errorMsg);
}

/**
 * Remove an existing error file if the scraper succeeds.
 */
export function clearError(scraperName: string) {
    const filePath = path.join(process.cwd(), 'src/data', `${scraperName}.error`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

/**
 * Centralized Puppeteer configuration for CI/CD and Local stability.
 */
export async function getBrowserConfig() {
    return {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,800',
            '--hide-scrollbars'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    };
}

/**
 * Standardized wrapper for scrapers with error reporting.
 */
export async function withErrorHandling(scraperName: string, fn: () => Promise<void>) {
    try {
        console.log(`\n🚀 Starting Scraper: ${scraperName}`);
        await fn();
        clearError(scraperName);
        console.log(`\n✨ Scraper Finished Successfully: ${scraperName}`);
    } catch (error) {
        reportError(scraperName, error);
        // We don't rethrow because we want the daily update workflow to continue with other scrapers.
    }
}
