import { spawn } from 'child_process';
import path from 'path';

const target = process.argv[2];

const SCRAPER_MAP: Record<string, string> = {
    'movie': 'scripts/scrape-movies.ts',
    'museum': 'scripts/scrape-museum.ts',
    'mommom-food': 'scripts/scrape-mommom-food.ts',
};

if (!target || !SCRAPER_MAP[target]) {
    console.error('Usage: npx tsx scripts/troubleshoot-scraper.ts [target]');
    console.error('Available targets:', Object.keys(SCRAPER_MAP).join(', '));
    process.exit(1);
}

const scriptPath = SCRAPER_MAP[target];
console.log(`🚀 Launching ${target} scraper in DEBUG mode (Visible Browser)...`);
console.log(`Script: ${scriptPath}`);

// Spawn process with inherited stdio and HEADLESS=false
const child = spawn('npx', ['tsx', scriptPath], {
    stdio: 'inherit',
    env: { ...process.env, HEADLESS: 'false' }
});

child.on('exit', (code) => {
    console.log(`\nProcess exited with code ${code}`);
});
