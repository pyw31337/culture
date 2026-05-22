import fs from 'fs';
import path from 'path';

type PlaceItem = {
    id: string;
    title: string;
    image?: string;
    link?: string;
    synopsisImages?: string[];
    stillImages?: string[];
    description?: string;
    longDescription?: string;
    lastCollected?: string;
    sourceUpdatedAt?: string;
    [key: string]: unknown;
};

const TARGET_FILES = (process.env.MOMMOM_PLACE_IMAGE_FILES || 'src/data/museum.json,src/data/mommom.json')
    .split(',')
    .map((file) => file.trim())
    .filter(Boolean);
const LIMIT_PER_FILE = Number(process.env.MOMMOM_PLACE_IMAGE_LIMIT || 260);
const CONCURRENCY = Number(process.env.MOMMOM_PLACE_IMAGE_CONCURRENCY || 6);
const DELAY_MS = Number(process.env.MOMMOM_PLACE_IMAGE_DELAY_MS || 180);

function compactText(value?: string) {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function extractFlightText(html: string) {
    const re = /<script>(?:self\.__next_f\.push\((\[[\s\S]*?\])\))<\/script>/g;
    let match: RegExpExecArray | null;
    let text = '';
    while ((match = re.exec(html))) {
        try {
            const chunk = JSON.parse(match[1]);
            if (typeof chunk[1] === 'string') text += chunk[1];
        } catch {
            // Continue with other chunks.
        }
    }
    return text;
}

function extractBalancedObject(text: string, start: number) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
        }
        if (char === '"') inString = true;
        else if (char === '{') depth += 1;
        else if (char === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(start, index + 1);
        }
    }
    return '';
}

function extractPlaceFromHtml(html: string): any | null {
    const flight = extractFlightText(html);
    const placeIndex = flight.indexOf('"place":');
    if (placeIndex < 0) return null;
    const start = flight.indexOf('{', placeIndex + '"place":'.length);
    if (start < 0) return null;
    const raw = extractBalancedObject(flight, start);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function pickImageUrl(image: any) {
    return compactText(image?.link || image?.origin || image?.url || image?.thumb || image?.thumbnail || image?.src);
}

function uniqueImages(values: string[]) {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        const image = compactText(value).replace(/&amp;/g, '&');
        if (!/^https?:\/\//i.test(image)) continue;
        if (/logo|icon|marker|placeholder|blank|default|profile|avatar|review/i.test(image)) continue;
        const key = image.replace(/[?#].*$/, '');
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(image);
    }
    return result;
}

async function fetchPlaceDetail(link: string) {
    const response = await fetch(link, {
        headers: {
            accept: 'text/html,application/xhtml+xml',
            'accept-language': 'ko-KR,ko;q=0.9',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) CultureFlowBot/1.0',
        },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const html = await response.text();
    const place = extractPlaceFromHtml(html);
    if (!place) return null;

    const mediaImages = Array.isArray(place.media?.images)
        ? place.media.images.map(pickImageUrl).filter(Boolean)
        : [];
    const contentImages = [
        place.image,
        place.imageUrl,
        place.thumbnail,
        place.mainImage,
        ...(Array.isArray(place.contents) ? place.contents.flatMap((entry: any) => [
            pickImageUrl(entry?.image),
            entry?.imageUrl,
            entry?.thumbnail,
        ]) : []),
    ].filter(Boolean);
    const description = [
        place.description,
        typeof place.introductionHtml === 'string' ? place.introductionHtml.replace(/<[^>]+>/g, ' ') : '',
        place.tip,
    ].map(compactText).filter(Boolean).join('\n\n');

    return {
        images: uniqueImages([...mediaImages, ...contentImages]),
        description,
    };
}

async function enrichFile(file: string) {
    const absolute = path.resolve(process.cwd(), file);
    if (!fs.existsSync(absolute)) {
        console.warn(`[mommom-place-images] missing file: ${file}`);
        return;
    }

    const items = JSON.parse(fs.readFileSync(absolute, 'utf8')) as PlaceItem[];
    const targets = items
        .filter((item) => item.link && /^https?:\/\//i.test(item.link))
        .filter((item) => !Array.isArray(item.synopsisImages) || item.synopsisImages.length === 0)
        .slice(0, LIMIT_PER_FILE);
    const byId = new Map(items.map((item) => [item.id, item]));

    console.log(`[mommom-place-images] ${file}: targets ${targets.length}/${items.length}`);

    let processed = 0;
    for (let index = 0; index < targets.length; index += CONCURRENCY) {
        const chunk = targets.slice(index, index + CONCURRENCY);
        await Promise.all(chunk.map(async (item) => {
            try {
                const detail = await fetchPlaceDetail(item.link || '');
                if (!detail) return;
                const images = uniqueImages([
                    item.image || '',
                    ...(detail.images || []),
                    ...(Array.isArray(item.synopsisImages) ? item.synopsisImages : []),
                    ...(Array.isArray(item.stillImages) ? item.stillImages : []),
                ]);
                if (images.length === 0) return;
                const description = compactText(item.description).length >= 80
                    ? item.description
                    : (compactText(detail.description).length >= 80 ? detail.description : item.description);
                byId.set(item.id, {
                    ...item,
                    image: item.image || images[0],
                    synopsisImages: images.slice(0, 10),
                    stillImages: images.slice(1, 5),
                    description,
                    lastCollected: item.lastCollected || new Date().toISOString(),
                    sourceUpdatedAt: item.sourceUpdatedAt || new Date().toISOString(),
                });
            } catch (error) {
                console.warn(`[mommom-place-images] failed ${item.id}: ${error instanceof Error ? error.message : error}`);
            }
        }));
        processed += chunk.length;
        process.stdout.write(`\r${file}: processed ${processed}/${targets.length}`);
        fs.writeFileSync(absolute, JSON.stringify(items.map((item) => byId.get(item.id) || item), null, 2));
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
    process.stdout.write('\n');
    fs.writeFileSync(absolute, JSON.stringify(items.map((item) => byId.get(item.id) || item), null, 2));
}

async function main() {
    for (const file of TARGET_FILES) {
        await enrichFile(file);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
