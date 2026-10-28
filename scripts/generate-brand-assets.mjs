import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCE_IMAGE = path.join(ROOT, 'public', 'images', 'cultureflow-app-icon.png');
const CUTOUT_IMAGE = path.join(ROOT, 'public', 'images', 'cultureflow-app-icon-cutout.png');

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
  await sharp(CUTOUT_IMAGE)
    .resize(180, 180, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(appleTouchPath);
  console.log('✓ Created', appleTouchPath);

  // 4. Favicon PNG (64x64, crisp for retina)
  const faviconPngPath = path.join(ROOT, 'public', 'favicon.png');
  await sharp(CUTOUT_IMAGE)
    .resize(64, 64, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(faviconPngPath);
  console.log('✓ Created', faviconPngPath);

  // 5. Favicon ICO (multi-size ICO container with 32x32 & 16x16 PNGs)
  const png32 = await sharp(CUTOUT_IMAGE).resize(32, 32, { kernel: 'lanczos3' }).png().toBuffer();
  const png16 = await sharp(CUTOUT_IMAGE).resize(16, 16, { kernel: 'lanczos3' }).png().toBuffer();
  const icoBuffer = createIco([
    { size: 32, buffer: png32 },
    { size: 16, buffer: png16 },
  ]);
  const faviconIcoPath = path.join(ROOT, 'public', 'favicon.ico');
  fs.writeFileSync(faviconIcoPath, icoBuffer);
  console.log('✓ Created', faviconIcoPath);
}

function createIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + 16 * images.length;
  const entries = [];
  const buffers = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);

    entries.push(entry);
    buffers.push(img.buffer);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...buffers]);
}

async function generateOgImage() {
  console.log('[brand-assets] Generating paper OpenGraph image (1200x630)...');
  const width = 1200;
  const height = 630;
  const iconSize = 230;
  const iconLeft = 545;
  const iconTop = 200;

  const svgOverlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="night" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#070617"/><stop offset=".58" stop-color="#110827"/><stop offset="1" stop-color="#050611"/></linearGradient>
        <radialGradient id="pink" cx="12%" cy="72%" r="48%"><stop stop-color="#f0008c" stop-opacity=".85"/><stop offset="1" stop-color="#f0008c" stop-opacity="0"/></radialGradient>
        <radialGradient id="cyan" cx="92%" cy="12%" r="48%"><stop stop-color="#00c6f7" stop-opacity=".82"/><stop offset="1" stop-color="#00c6f7" stop-opacity="0"/></radialGradient>
        <radialGradient id="violet" cx="52%" cy="100%" r="44%"><stop stop-color="#8a16ec" stop-opacity=".72"/><stop offset="1" stop-color="#8a16ec" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#night)" />
      <rect width="100%" height="100%" fill="url(#pink)" />
      <rect width="100%" height="100%" fill="url(#cyan)" />
      <rect width="100%" height="100%" fill="url(#violet)" />
      <text x="520" y="350" font-family="Arial, sans-serif" font-size="108" font-weight="800" letter-spacing="-4" fill="#fff7ff" text-anchor="end">Culture</text>
      <text x="800" y="350" font-family="Arial, sans-serif" font-size="108" font-weight="800" letter-spacing="-4" fill="#ff66c7">Flow</text>
    </svg>
  `);

  const ogPath = path.join(ROOT, 'public', 'images', 'og-image.jpg');
  const icon = await sharp(CUTOUT_IMAGE).resize(iconSize, iconSize, { fit: 'contain' }).png().toBuffer();
  await sharp(svgOverlay)
    .composite([{ input: icon, top: iconTop, left: iconLeft }])
    .jpeg({ quality: 92 })
    .toFile(ogPath);
  fs.copyFileSync(ogPath, path.join(ROOT, 'public', 'images', 'og_image.jpg'));

  console.log('✓ Created', ogPath);
}

async function generateOgCalligraphyVariants() {
  const width = 1200;
  const height = 630;
  const iconTop = 200;
  const variants = [
    { name: 'signpainter', family: 'SignPainter', size: 104, weight: 400, iconSize: 230, stroke: 0 },
    { name: 'snell-roundhand', family: 'Snell Roundhand', size: 118, weight: 700, iconSize: 250, stroke: 1.35 },
    { name: 'kimjungchul-script', family: 'Kim jung chul Script', size: 104, weight: 400, iconSize: 230, stroke: 0 },
  ];

  for (const variant of variants) {
    const iconLeft = variant.iconSize === 250 ? 535 : 545;
    const icon = await sharp(CUTOUT_IMAGE)
      .resize(variant.iconSize, variant.iconSize, { fit: 'contain' })
      .png()
      .toBuffer();
    const svgOverlay = Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="night" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#070617"/><stop offset=".58" stop-color="#110827"/><stop offset="1" stop-color="#050611"/></linearGradient>
          <radialGradient id="pink" cx="12%" cy="72%" r="48%"><stop stop-color="#f0008c" stop-opacity=".85"/><stop offset="1" stop-color="#f0008c" stop-opacity="0"/></radialGradient>
          <radialGradient id="cyan" cx="92%" cy="12%" r="48%"><stop stop-color="#00c6f7" stop-opacity=".82"/><stop offset="1" stop-color="#00c6f7" stop-opacity="0"/></radialGradient>
          <radialGradient id="violet" cx="52%" cy="100%" r="44%"><stop stop-color="#8a16ec" stop-opacity=".72"/><stop offset="1" stop-color="#8a16ec" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#night)" />
        <rect width="100%" height="100%" fill="url(#pink)" />
        <rect width="100%" height="100%" fill="url(#cyan)" />
        <rect width="100%" height="100%" fill="url(#violet)" />
        <text x="520" y="350" font-family="${variant.family}" font-size="${variant.size}" font-weight="${variant.weight}" fill="#fff7ff" stroke="#fff7ff" stroke-width="${variant.stroke}" paint-order="stroke" text-anchor="end">Culture</text>
        <text x="800" y="350" font-family="${variant.family}" font-size="${variant.size}" font-weight="${variant.weight}" fill="#ff66c7" stroke="#ff66c7" stroke-width="${variant.stroke}" paint-order="stroke">Flow</text>
      </svg>
    `);
    const output = path.join(ROOT, 'public', 'images', `og-image-${variant.name}.jpg`);
    await sharp(svgOverlay)
      .composite([{ input: icon, top: iconTop, left: iconLeft }])
      .jpeg({ quality: 92 })
      .toFile(output);
    console.log('✓ Created', output);
  }
}

async function main() {
  await generateAppIcons();
  await generateOgImage();
  await generateOgCalligraphyVariants();
  const selectedOg = path.join(ROOT, 'public', 'images', 'og-image-snell-roundhand.jpg');
  fs.copyFileSync(selectedOg, path.join(ROOT, 'public', 'images', 'og-image.jpg'));
  fs.copyFileSync(selectedOg, path.join(ROOT, 'public', 'images', 'og_image.jpg'));
  console.log('[brand-assets] All brand assets successfully generated!');
}

main().catch((err) => {
  console.error('[brand-assets] Error:', err);
  process.exit(1);
});
