/**
 * Genre-aware SVG poster placeholder.
 *
 * Generates a data: URL containing a gradient background, a large title and a
 * small genre label. Used by ImageWithFallback when a card has no usable
 * poster image (K-League / KBO / 키즈 체험 등 이미지·설명 커버리지가 낮은 항목들).
 *
 * Tuned so the output stays readable at small grid sizes (~128x170px) while
 * looking intentional, not "broken image".
 */

import { GENRE_STYLES, GENRES } from './constants';

interface PlaceholderInput {
    title?: string | null;
    genre?: string | null;
    /** Optional homeTeam vs awayTeam label for sports rows when image is missing. */
    matchLabel?: string | null;
}

/** Map of genre id -> richer palette used by the placeholder SVG. */
const GENRE_PALETTE: Record<string, { from: string; to: string; accent: string; onColor: string }> = {
    movie:             { from: '#0c4a6e', to: '#0ea5e9', accent: '#7dd3fc', onColor: '#f0f9ff' },
    musical:           { from: '#7f1d1d', to: '#f43f5e', accent: '#fda4af', onColor: '#fff1f2' },
    concert:           { from: '#1e3a8a', to: '#3b82f6', accent: '#93c5fd', onColor: '#eff6ff' },
    play:              { from: '#14532d', to: '#22c55e', accent: '#86efac', onColor: '#f0fdf4' },
    classic_tradition: { from: '#713f12', to: '#eab308', accent: '#fde68a', onColor: '#fefce8' },
    exhibition:        { from: '#581c87', to: '#a855f7', accent: '#d8b4fe', onColor: '#faf5ff' },
    activity:          { from: '#134e4a', to: '#14b8a6', accent: '#5eead4', onColor: '#f0fdfa' },
    class:             { from: '#3730a3', to: '#6366f1', accent: '#a5b4fc', onColor: '#eef2ff' },
    museum:            { from: '#064e3b', to: '#10b981', accent: '#6ee7b7', onColor: '#ecfdf5' },
    volleyball:        { from: '#365314', to: '#84cc16', accent: '#bef264', onColor: '#f7fee7' },
    basketball:        { from: '#7c2d12', to: '#f97316', accent: '#fdba74', onColor: '#fff7ed' },
    baseball:          { from: '#0c1844', to: '#1e40af', accent: '#93c5fd', onColor: '#eff6ff' },
    soccer:            { from: '#7f1d1d', to: '#ef4444', accent: '#fca5a5', onColor: '#fef2f2' },
    handball:          { from: '#78350f', to: '#f59e0b', accent: '#fcd34d', onColor: '#fffbeb' },
    tourism:           { from: '#164e63', to: '#06b6d4', accent: '#67e8f9', onColor: '#ecfeff' },
    all:               { from: '#1f2937', to: '#6b7280', accent: '#d1d5db', onColor: '#f9fafb' },
};

/** Friendly genre label (Korean) keyed by id. */
const GENRE_LABEL: Record<string, string> = Object.fromEntries(
    GENRES.map((g) => [g.id, g.label])
);

/** Small mark/icon glyph per genre, used as a watermark behind the title. */
const GENRE_GLYPH: Record<string, string> = {
    movie: '🎬',
    musical: '🎭',
    concert: '🎤',
    play: '🎭',
    classic_tradition: '🎻',
    exhibition: '🖼',
    activity: '🚴',
    class: '✏️',
    museum: '🏛',
    volleyball: '🏐',
    basketball: '🏀',
    baseball: '⚾',
    soccer: '⚽',
    handball: '🤾',
    tourism: '🧭',
    all: '✨',
};

function paletteFor(genre?: string | null) {
    const key = (genre && GENRE_PALETTE[genre]) ? genre : 'all';
    return GENRE_PALETTE[key];
}

export function getGenreLabel(genre?: string | null): string {
    if (!genre) return '문화';
    return GENRE_LABEL[genre] ?? '문화';
}

export function getGenrePalette(genre?: string | null) {
    return paletteFor(genre);
}

/** Get a single accent hex - convenient for chips, badges, ring colors. */
export function getGenreAccent(genre?: string | null): string {
    const style = GENRE_STYLES[genre ?? 'all'] ?? GENRE_STYLES.all;
    return style.hex;
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Break a long Korean/English title into up to N visual lines for the SVG.
 * Naive but predictable: split on whitespace, then re-group into lines whose
 * approximate width fits within `maxCharsPerLine`. Korean characters count as
 * ~1.8 vs latin ~1.0.
 */
function wrapTitle(title: string, maxCharsPerLine: number, maxLines: number): string[] {
    const trimmed = title.replace(/\s+/g, ' ').trim();
    if (!trimmed) return [];

    const widthOf = (str: string) =>
        Array.from(str).reduce((sum, ch) => {
            // Korean syllables roughly 1.8x latin width at the same font-size.
            if (/[가-힯㄰-㆏]/.test(ch)) return sum + 1.8;
            if (/[A-Za-z0-9]/.test(ch)) return sum + 1.0;
            return sum + 1.2;
        }, 0);

    const tokens = trimmed.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const token of tokens) {
        const candidate = current ? `${current} ${token}` : token;
        if (widthOf(candidate) <= maxCharsPerLine) {
            current = candidate;
        } else if (!current) {
            // Token alone is too long -> hard wrap by characters.
            const chars = Array.from(token);
            let buf = '';
            for (const ch of chars) {
                if (widthOf(buf + ch) > maxCharsPerLine) {
                    lines.push(buf);
                    if (lines.length === maxLines) {
                        return lines.map((l, i) => (i === maxLines - 1 ? l + '…' : l));
                    }
                    buf = ch;
                } else {
                    buf += ch;
                }
            }
            current = buf;
        } else {
            lines.push(current);
            if (lines.length === maxLines) {
                return [...lines.slice(0, -1), lines[lines.length - 1] + '…'];
            }
            current = token;
        }
    }
    if (current) lines.push(current);

    if (lines.length > maxLines) {
        return [...lines.slice(0, maxLines - 1), lines[maxLines - 1] + '…'];
    }
    return lines;
}

/**
 * Build a self-contained SVG string that fills a 3:4 poster slot with a
 * gradient + title + genre label. Returns a `data:image/svg+xml;...` URL
 * suitable for use in <img src> or <Image src>.
 */
export function buildPlaceholderDataUrl(input: PlaceholderInput): string {
    const palette = paletteFor(input.genre);
    const label = getGenreLabel(input.genre);
    const glyph = GENRE_GLYPH[input.genre ?? 'all'] ?? GENRE_GLYPH.all;
    const titleSource = (input.title || input.matchLabel || label).trim();

    // 3:4 viewBox keeps the SVG resolution-independent. The width is large
    // enough to host a readable title at common card sizes.
    const W = 600;
    const H = 800;

    // Adaptive sizing - shorter titles get bolder type.
    const lines = wrapTitle(titleSource, 9, 3);
    const fontSize = lines.length <= 1 ? 84 : lines.length === 2 ? 72 : 60;
    const lineHeight = fontSize * 1.18;
    const totalHeight = lineHeight * lines.length;
    const startY = (H + totalHeight) / 2 - lineHeight * (lines.length - 0.65);

    const titleSvg = lines
        .map((line, i) => {
            const y = startY + i * lineHeight;
            return `<text x="50%" y="${y.toFixed(1)}" text-anchor="middle" fill="${palette.onColor}" font-family="-apple-system, BlinkMacSystemFont, 'Pretendard Variable', 'Noto Sans KR', Pretendard, system-ui, sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="-1.5">${escapeXml(line)}</text>`;
        })
        .join('');

    // The match label (eg "두산 vs 한화") is rendered above the title for
    // sports cards. Only used when matchLabel is provided AND differs from
    // titleSource (so we don't double-print).
    const matchOverlay = input.matchLabel && input.matchLabel !== titleSource
        ? `<text x="50%" y="${(startY - lineHeight - 36).toFixed(1)}" text-anchor="middle" fill="${palette.accent}" font-family="system-ui, sans-serif" font-weight="700" font-size="44" letter-spacing="-1">${escapeXml(input.matchLabel)}</text>`
        : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${palette.from}"/>
                <stop offset="100%" stop-color="${palette.to}"/>
            </linearGradient>
            <radialGradient id="glow" cx="50%" cy="32%" r="60%">
                <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#bg)"/>
        <rect width="${W}" height="${H}" fill="url(#glow)"/>
        <text x="50%" y="${H * 0.28}" text-anchor="middle" fill="${palette.onColor}" opacity="0.16" font-size="280" font-family="system-ui, 'Apple Color Emoji', sans-serif">${escapeXml(glyph)}</text>
        ${matchOverlay}
        ${titleSvg}
        <rect x="32" y="${H - 92}" width="${W - 64}" height="2" fill="${palette.accent}" opacity="0.55"/>
        <text x="32" y="${H - 36}" fill="${palette.onColor}" font-family="system-ui, sans-serif" font-weight="700" font-size="32" letter-spacing="2">${escapeXml(label.toUpperCase())}</text>
        <text x="${W - 32}" y="${H - 36}" text-anchor="end" fill="${palette.accent}" font-family="system-ui, sans-serif" font-weight="600" font-size="28" opacity="0.85">Culture Flow</text>
    </svg>`;

    // Use percent-encoding (smaller and avoids base64 cost). Strip the leading
    // whitespace/newlines so the result is compact.
    const compact = svg.replace(/\n\s+/g, ' ').replace(/>\s+</g, '><');
    return `data:image/svg+xml;utf8,${encodeURIComponent(compact)}`;
}
