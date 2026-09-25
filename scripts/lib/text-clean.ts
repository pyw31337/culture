/**
 * Upstream scrapers pass HTML text through verbatim, sometimes double-encoded: a 문화포털 title
 * arrived as "상설전시 &&#35;39;깨달음을 찾는 길&&#35;39;" ("&#39;" whose "#" was itself encoded as
 * "&#35;"), Interpark descriptions carry "&#13;" line endings, mommom titles "&amp;". Decodes
 * until the text stops changing (bounded), so cards show "'깨달음을 찾는 길'".
 */
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…' };

export function decodeHtmlEntities(value: string): string {
  let text = String(value ?? '');
  for (let pass = 0; pass < 3; pass += 1) {
    const next = text
      .replace(/&&#35;/g, '&#')
      .replace(/&#(\d+);/g, (m, code) => {
        const n = Number(code);
        if (n === 13) return '';
        return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      })
      .replace(/&#x([0-9a-f]+);/gi, (m, code) => {
        const n = parseInt(code, 16);
        return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      })
      .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
    if (next === text) break;
    text = next;
  }
  return text;
}

/** Decodes the free-text fields of a feed item in place. */
export function decodeItemText<T extends Record<string, unknown>>(item: T, fields: string[]): T {
  for (const field of fields) {
    const value = item[field];
    if (typeof value === 'string' && value.includes('&')) (item as Record<string, unknown>)[field] = decodeHtmlEntities(value);
  }
  return item;
}
