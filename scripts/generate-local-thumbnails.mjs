import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sourceRoot = path.join(rootDir, 'public', 'images', 'posters');
const outputRoot = path.join(rootDir, 'public', 'images', 'thumbs', 'w320', 'posters');
const supportedExt = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function writeFallbackThumb(outputPath, relativePath) {
  const title = path.parse(relativePath).name.replace(/[_-]+/g, ' ').slice(0, 34);
  const svg = `
    <svg width="320" height="448" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#111827"/>
          <stop offset="1" stop-color="#020617"/>
        </linearGradient>
      </defs>
      <rect width="320" height="448" fill="url(#g)"/>
      <text x="160" y="210" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="800" fill="#e5e7eb">Culture Flow</text>
      <text x="160" y="246" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#94a3b8">${escapeXml(title)}</text>
    </svg>
  `;
  await sharp(Buffer.from(svg)).webp({ quality: 70 }).toFile(outputPath);
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
      continue;
    }
    if (supportedExt.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const files = await walk(sourceRoot);
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    const relativePath = path.relative(sourceRoot, filePath);
    const parsed = path.parse(relativePath);
    const outputPath = path.join(outputRoot, parsed.dir, `${parsed.name}.webp`);

    try {
      const [sourceStat, outputExists] = await Promise.all([
        fs.stat(filePath),
        exists(outputPath),
      ]);

      if (outputExists) {
        const outputStat = await fs.stat(outputPath);
        if (outputStat.mtimeMs >= sourceStat.mtimeMs) {
          skipped += 1;
          continue;
        }
      }

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await sharp(filePath, { failOn: 'none' })
        .rotate()
        .resize({ width: 320, withoutEnlargement: true })
        .webp({ quality: 62, effort: 4 })
        .toFile(outputPath);
      created += 1;
    } catch (error) {
      try {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await writeFallbackThumb(outputPath, relativePath);
        created += 1;
        console.warn(`[thumb] fallback: ${relativePath} - ${error instanceof Error ? error.message : String(error)}`);
      } catch (fallbackError) {
        failed += 1;
        console.warn(`[thumb] failed: ${relativePath} - ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
      }
    }
  }

  console.log(JSON.stringify({ source: files.length, created, skipped, failed }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
