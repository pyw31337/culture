
import { processImage } from './utils/image-processor';
import fs from 'fs';
import path from 'path';

async function test() {
    console.log('--- Testing Image Processor ---');

    // Case 1: NamuWiki URL (Squid Game Poster)
    const namuUrl = 'https://i.namu.wiki/i/ibAKmD8FfGGNOy_5cPFcEDNd3aYu3jPB440Gf6gi7WZ_SLBwgYpobSbID5XYHcMyDvCFON2tLVrkE75YHHHUKuCgrbnw-6AuS6LY_-EWMY1jml-Pnw8Ae6aiqiebzoN3xTreaonTQVqMTxv8pSMnSw.webp';
    const title = 'test_squid_game';

    console.log(`\n1. Testing NamuWiki URL...`);
    const processedNamu = await processImage(namuUrl, title);
    console.log(`   Result: ${processedNamu}`);

    if (processedNamu.startsWith('/images/posters/') && processedNamu.endsWith('.webp')) {
        console.log('   [PASS] Returned local WebP path.');

        const localPath = path.join(process.cwd(), 'public', processedNamu);
        if (fs.existsSync(localPath)) {
            console.log('   [PASS] File created successfully.');
            const stats = fs.statSync(localPath);
            console.log(`   [INFO] File size: ${stats.size} bytes`);
        } else {
            console.error('   [FAIL] File not found!');
        }
    } else {
        console.error('   [FAIL] Did not return local path!');
    }


    // Case 2: External URL (Google Logo)
    const extUrl = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';
    console.log(`\n2. Testing External URL...`);
    const processedExt = await processImage(extUrl, 'test_google');
    console.log(`   Result: ${processedExt}`);

    if (processedExt === extUrl) {
        console.log('   [PASS] Returned original URL.');
    } else {
        console.error('   [FAIL] Should have returned original URL!');
    }
}

test();
