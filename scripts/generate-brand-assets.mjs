import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCE_IMAGE = '/Users/pyw31337/.gemini/antigravity/brain/83027dfd-7695-4f79-851a-42a62620364c/cultureflow_3d_ticket_star_icon_1793081361553.jpg';

async function generateAppIcons() {
  console.log('[brand-assets] Generating app icons from:', SOURCE_IMAGE);
  
  // 1. 512x512 PWA & Master Icon
  const icon512Path = path.join(ROOT, 'public', 'icon.png');
  await sharp(SOURCE_IMAGE)
    .resize(512, 512, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(icon512Path);
  console.log('✓ Created', icon512Path);

  // 2. ticket_icon.png (used in header & app references)
  const ticketIconPath = path.join(ROOT, 'public', 'images', 'ticket_icon.png');
  await sharp(SOURCE_IMAGE)
    .resize(512, 512, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(ticketIconPath);
  console.log('✓ Created', ticketIconPath);

  // 3. Apple Touch Icon (180x180)
  const appleTouchPath = path.join(ROOT, 'public', 'apple-touch-icon.png');
  await sharp(SOURCE_IMAGE)
    .resize(180, 180, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(appleTouchPath);
  console.log('✓ Created', appleTouchPath);

  // 4. Favicon PNG (64x64, crisp for retina)
  const faviconPngPath = path.join(ROOT, 'public', 'favicon.png');
  await sharp(SOURCE_IMAGE)
    .resize(64, 64, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(faviconPngPath);
  console.log('✓ Created', faviconPngPath);

  // 5. Favicon ICO (multi-size ICO container with 32x32 & 16x16 PNGs)
  const png32 = await sharp(SOURCE_IMAGE).resize(32, 32, { kernel: 'lanczos3' }).png().toBuffer();
  const png16 = await sharp(SOURCE_IMAGE).resize(16, 16, { kernel: 'lanczos3' }).png().toBuffer();
  const icoBuffer = createIco([
    { size: 32, buffer: png32 },
    { size: 16, buffer: png16 },
  ]);
  const faviconIcoPath = path.join(ROOT, 'public', 'favicon.ico');
  fs.writeFileSync(faviconIcoPath, icoBuffer);
  console.log('✓ Created', faviconIcoPath);
}

function createIco(images) {
  // ICO header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(images.length, 4); // Number of images

  let offset = 6 + 16 * images.length;
  const entries = [];
  const buffers = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0); // Width
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1); // Height
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Image size in bytes
    entry.writeUInt32LE(offset, 12); // Image data offset

    entries.push(entry);
    buffers.push(img.buffer);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...buffers]);
}

async function generateOgImage() {
  console.log('[brand-assets] Generating OpenGraph image (1200x630)...');
  const width = 1200;
  const height = 630;
  const iconSize = 340;

  // Render centered 3D ticket icon with smooth feathered edges to blend seamlessly
  const featherMask = Buffer.from(`
    <svg width="${iconSize}" height="${iconSize}">
      <defs>
        <radialGradient id="feather" cx="50%" cy="50%" r="50%">
          <stop offset="65%" stop-color="#fff" stop-opacity="1" />
          <stop offset="98%" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#feather)" />
    </svg>
  `);

  const featheredIcon = await sharp(SOURCE_IMAGE)
    .resize(iconSize, iconSize, { kernel: 'lanczos3' })
    .composite([{ input: featherMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const svgOverlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stop-color="#1e1338" stop-opacity="0.9" />
          <stop offset="45%" stop-color="#0f0c22" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#06070d" stop-opacity="1" />
        </radialGradient>
        <radialGradient id="neonCenter" cx="50%" cy="38%" r="35%">
          <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.35" />
          <stop offset="50%" stop-color="#A855F7" stop-opacity="0.15" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="65%" stop-color="#EDE9FE" />
          <stop offset="100%" stop-color="#C4B5FD" />
        </linearGradient>
        <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#A78BFA" />
          <stop offset="50%" stop-color="#F472B6" />
          <stop offset="100%" stop-color="#38BDF8" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="100%" height="100%" fill="url(#bgGlow)" />
      <rect width="100%" height="100%" fill="url(#neonCenter)" />

      <!-- Subtle Grid / Tech Lines -->
      <line x1="100" y1="520" x2="1100" y2="520" stroke="#a78bfa" stroke-opacity="0.15" stroke-width="1" />

      <!-- Typography -->
      <!-- Title -->
      <text x="600" y="445" 
            font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif" 
            font-size="64" 
            font-weight="900" 
            letter-spacing="-1.5" 
            fill="url(#titleGrad)" 
            text-anchor="middle">Culture Flow</text>

      <!-- Subtitle -->
      <text x="600" y="492" 
            font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif" 
            font-size="24" 
            font-weight="600" 
            letter-spacing="0.5" 
            fill="#DDD6FE" 
            text-anchor="middle">전국 통합 맞춤형 문화생활 큐레이션</text>

      <!-- Category Badges -->
      <text x="600" y="565" 
            font-family="-apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif" 
            font-size="17" 
            font-weight="700" 
            letter-spacing="4" 
            fill="url(#accentGrad)" 
            text-anchor="middle">공연 · 전시 · 뮤지컬 · 페스티벌 · 스포츠</text>
    </svg>
  `);

  const iconTop = 45;
  const iconLeft = Math.round((width - iconSize) / 2);

  const ogPath = path.join(ROOT, 'public', 'images', 'og-image.jpg');
  await sharp(svgOverlay)
    .composite([
      { input: featheredIcon, top: iconTop, left: iconLeft },
    ])
    .jpeg({ quality: 92 })
    .toFile(ogPath);

  console.log('✓ Created', ogPath);
}

async function main() {
  await generateAppIcons();
  await generateOgImage();
  console.log('[brand-assets] All brand assets successfully generated!');
}

main().catch((err) => {
  console.error('[brand-assets] Error:', err);
  process.exit(1);
});
