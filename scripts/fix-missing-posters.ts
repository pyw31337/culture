/**
 * Fix remaining missing movie posters using KOBIS and Google approaches
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const POSTER_DIR = path.join(process.cwd(), 'public', 'images', 'posters', 'movies');
const OUTPUT_FILE = path.join(DATA_DIR, 'movies.json');

function slugify(text: string): string {
    return text.replace(/[^가-힣a-zA-Z0-9]/g, '').substring(0, 40);
}

async function downloadAndSave(url: string, filename: string): Promise<string | null> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Referer': 'https://www.kobis.or.kr/' }
        });
        if (!res.ok) { console.log(`    HTTP ${res.status} for ${url.substring(0, 80)}`); return null; }
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length < 1000) { console.log(`    Too small: ${buffer.length} bytes`); return null; }

        const outPath = path.join(POSTER_DIR, filename);
        await sharp(buffer).resize(400, null, { withoutEnlargement: true }).webp({ quality: 80 }).toFile(outPath);
        console.log(`    ✓ Saved: ${filename} (${buffer.length} bytes)`);
        return `/images/posters/movies/${filename}`;
    } catch (e: any) {
        console.log(`    ✗ Error: ${e.message}`);
        return null;
    }
}

// Search KOBIS for movie and get poster
async function searchKobisForPoster(title: string): Promise<string | null> {
    console.log(`  [KOBIS] Searching: ${title}`);
    try {
        const form = new URLSearchParams();
        form.append('movieNm', title.split(':')[0].trim()); // Use main title only
        const res = await fetch('https://www.kobis.or.kr/kobis/business/mast/mvie/searchMovieList.do', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
            body: form.toString()
        });
        const html = await res.text();

        // Find movie detail links
        const codeMatches = [...html.matchAll(/fn_detail\([^']*?'(\d+)'/g)];
        if (codeMatches.length === 0) {
            console.log('    No KOBIS results');
            return null;
        }

        // Check each movie for poster
        for (const match of codeMatches.slice(0, 3)) {
            const movieCd = match[1];
            const detailRes = await fetch(`https://www.kobis.or.kr/kobis/business/mast/mvie/searchMovieInfo.do?movieCd=${movieCd}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const detailHtml = await detailRes.text();

            // Try to find poster image
            const imgMatches = [...detailHtml.matchAll(/<img[^>]+src="([^"]+)"/g)];
            for (const img of imgMatches) {
                const src = img[1];
                if (src.includes('poster') || src.includes('movie') || src.includes('/uploadImage/') || src.includes('thumb')) {
                    if (!src.includes('icon') && !src.includes('logo') && !src.includes('btn')) {
                        const fullUrl = src.startsWith('http') ? src : `https://www.kobis.or.kr${src}`;
                        console.log(`    Found KOBIS image: ${fullUrl.substring(0, 80)}`);
                        return fullUrl;
                    }
                }
            }
            await new Promise(r => setTimeout(r, 100));
        }
    } catch (e: any) {
        console.log(`    KOBIS error: ${e.message}`);
    }
    return null;
}

// Search Google Images for poster
async function searchGoogleForPoster(title: string): Promise<string | null> {
    console.log(`  [Google] Searching: ${title} 영화 포스터`);
    try {
        const query = encodeURIComponent(`${title} 영화 포스터`);
        const url = `https://www.google.com/search?q=${query}&tbm=isch&udm=2`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'ko-KR,ko;q=0.9'
            }
        });
        const html = await res.text();

        // Google images are embedded in the page as data-src or thumbnails
        // Try to extract actual image URLs from Google image search
        const imgMatches = [...html.matchAll(/\["(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))",\d+,\d+\]/g)];

        for (const m of imgMatches.slice(0, 3)) {
            const imgUrl = m[1];
            // Skip Google-internal images
            if (imgUrl.includes('google.com') || imgUrl.includes('gstatic.com') || imgUrl.includes('googleapis.com')) continue;
            console.log(`    Found Google image: ${imgUrl.substring(0, 80)}`);
            return imgUrl;
        }

        // Alternative pattern
        const altMatches = [...html.matchAll(/\["(https?:\/\/[^"]+)",(\d+),(\d+)\]/g)];
        for (const m of altMatches) {
            const imgUrl = m[1];
            const w = parseInt(m[2]);
            const h = parseInt(m[3]);
            if (w < 200 || h < 200) continue;
            if (imgUrl.includes('google') || imgUrl.includes('gstatic')) continue;
            if (imgUrl.match(/\.(jpg|jpeg|png|webp)/i)) {
                console.log(`    Found Google image (alt): ${imgUrl.substring(0, 80)}`);
                return imgUrl;
            }
        }
    } catch (e: any) {
        console.log(`    Google error: ${e.message}`);
    }
    return null;
}

async function main() {
    const movies: any[] = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    let fixed = 0;

    // Find movies still missing posters
    const missing: any[] = [];
    for (const movie of movies) {
        const img = movie.image || '';
        if (!img) {
            missing.push(movie);
        } else if (img.startsWith('/')) {
            const fp = path.join(process.cwd(), 'public', img);
            if (!fs.existsSync(fp)) {
                missing.push(movie);
            }
        }
    }

    console.log(`=== ${missing.length} movies still missing posters ===\n`);

    for (const movie of missing) {
        console.log(`\n[${movie.title}]`);

        // 1. Try KOBIS
        let posterUrl = await searchKobisForPoster(movie.title);

        // 2. Try Google Images
        if (!posterUrl) {
            posterUrl = await searchGoogleForPoster(movie.title);
        }

        if (posterUrl) {
            const filename = `movie_${slugify(movie.title)}.webp`;
            const localPath = await downloadAndSave(posterUrl, filename);
            if (localPath) {
                movie.image = localPath;
                fixed++;
            }
        } else {
            console.log('    ✗ No poster found from any source');
        }

        await new Promise(r => setTimeout(r, 300));
    }

    if (fixed > 0) {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(movies, null, 2), 'utf-8');
        console.log(`\n✓ Fixed ${fixed} more posters. Saved to movies.json`);
    } else {
        console.log(`\nNo additional posters fixed.`);
    }
}

main().catch(console.error);
