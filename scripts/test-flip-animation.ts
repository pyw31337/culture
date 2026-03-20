import { chromium } from 'playwright';
import { execSync } from 'child_process';
import path from 'path';
import crypto from 'crypto';

async function captureAnimation() {
    execSync('npm run build', { stdio: 'ignore' });
    const serverProcess = execSync('npx serve@latest out -p 3004 &', { encoding: 'utf-8' });

    await new Promise(r => setTimeout(r, 2000));

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 414, height: 896 } });
    const page = await context.newPage();

    // Start recording
    const hashId = crypto.randomUUID();
    const videoPath = path.resolve(`/Users/pyw31337/.gemini/antigravity/brain/1ecad440-6eab-4aac-9b19-9afab64f7026/flip_anim_${hashId}.webm`);

    // Unfortunately playwright video is configured at context level, but I can use screenshot sequence for a gif
    // Actually, I can just launch the default browser subagent to record a webp for me!

    await browser.close();
    execSync('npx kill-port 3004', { stdio: 'ignore' });
}

captureAnimation().catch(console.error);
