/**
 * Fills empty detail fields from text read off intro images (소개 이미지).
 *
 * scripts/ai/extract-intro-images.ts runs on the Mac mini: Apple Vision reads the images,
 * a local Ollama model picks out cast / running time / age / seat prices and writes a short
 * summary, and only values whose text is found in the OCR output are stored in
 * src/data/ai-detail-extractions.json. Here those values fill fields the sources left empty;
 * nothing a source provided is overwritten. CI only reads the file.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = Record<string, any>;

export interface AiDetailFields {
    runningTime?: string;
    ageRating?: string;
    cast?: string[];
    priceList?: { label: string; price: string }[];
    summary?: string;
}

export interface AiDetailEntry {
    imagesKey: string;
    checkedAt: string;
    model?: string;
    ocrChars?: number;
    fields: AiDetailFields;
}

export interface AiDetailExtractions {
    items?: Record<string, AiDetailEntry>;
}

export interface AiDetailFillStats {
    items: number;
    runningTime: number;
    ageRating: number;
    cast: number;
    priceList: number;
    description: number;
}

/** Descriptions generate-performance-json writes when a source has none (buildFallbackDescription). */
export function isTemplateDescription(value: unknown) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return true;
    return /(특별한 .{0,20}공연\/행사입니다|에서 관람할 수 있는 전시 행사입니다|액티비티 체험 콘텐츠입니다)/.test(text);
}

function isPlaceholderPrice(value: unknown) {
    const text = String(value ?? '').replace(/\s/g, '');
    return !text || /^(정보없음|가격정보없음|가격미정|미정|-)$/.test(text);
}

function hasText(value: unknown) {
    return typeof value === 'string' && value.trim() !== '' && !/^(정보없음|미정|-)$/.test(value.trim());
}

function findEntry(item: Item, entries: Record<string, AiDetailEntry>) {
    const ids = [item.id, ...(Array.isArray(item.aliasIds) ? item.aliasIds : [])];
    for (const id of ids) {
        if (typeof id === 'string' && entries[id]) return entries[id];
    }
    return null;
}

export function applyAiDetailExtractions(items: Item[], file: AiDetailExtractions = {}) {
    const entries = file.items || {};
    const stats: AiDetailFillStats = { items: 0, runningTime: 0, ageRating: 0, cast: 0, priceList: 0, description: 0 };
    if (Object.keys(entries).length === 0) return { items, stats };

    const filled = items.map((item) => {
        const entry = findEntry(item, entries);
        const fields = entry?.fields;
        if (!fields) return item;

        const next: Item = { ...item };
        let changed = false;
        if (fields.runningTime && !hasText(item.runningTime)) {
            next.runningTime = fields.runningTime;
            stats.runningTime += 1;
            changed = true;
        }
        if (fields.ageRating && !hasText(item.ageRating) && !hasText(item.age)) {
            next.ageRating = fields.ageRating;
            stats.ageRating += 1;
            changed = true;
        }
        if (fields.cast?.length && !(Array.isArray(item.cast) && item.cast.length > 0)) {
            next.cast = fields.cast;
            stats.cast += 1;
            changed = true;
        }
        if (fields.priceList?.length && !(Array.isArray(item.priceList) && item.priceList.length > 0)) {
            next.priceList = fields.priceList;
            if (isPlaceholderPrice(item.price)) {
                next.price = fields.priceList.slice(0, 3).map((row) => `${row.label} ${row.price}`.trim()).join(' / ');
            }
            stats.priceList += 1;
            changed = true;
        }
        if (fields.summary && isTemplateDescription(item.description)) {
            next.description = fields.summary;
            stats.description += 1;
            changed = true;
        }
        if (changed) stats.items += 1;
        return changed ? next : item;
    });

    return { items: filled, stats };
}
