const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function createSvg(isMaskable = false) {
  // Calendar card dimensions - precisely centered on 512x512 canvas
  // Total visual height of calendar + rings = 38px rings (-18px above card) + 312px card = 330px
  // Top margin = (512 - 330) / 2 = 91px
  // Bottom margin = 91px
  const cardX = 84;
  const cardY = 109;
  const cardW = 344;
  const cardH = 312;
  const cardRx = 42;
  const headerH = 74;

  const cardContent = `
    <!-- Calendar Card Dropshadow -->
    <g filter="url(#cardShadow)">
      <!-- Base Card & Purple Header clipped to rounded card corners -->
      <g clip-path="url(#cardClip)">
        <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" fill="#ffffff" />
        <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${headerH}" fill="#584fe6" />
      </g>

      <!-- 3 Binder Rings across the top edge (centered vertically over top edge of header) -->
      <g filter="url(#loopShadow)">
        <rect x="164" y="91" width="22" height="38" rx="11" ry="11" fill="none" stroke="#ffffff" stroke-width="4.8" stroke-linecap="round" />
        <rect x="245" y="91" width="22" height="38" rx="11" ry="11" fill="none" stroke="#ffffff" stroke-width="4.8" stroke-linecap="round" />
        <rect x="326" y="91" width="22" height="38" rx="11" ry="11" fill="none" stroke="#ffffff" stroke-width="4.8" stroke-linecap="round" />
      </g>

      <!-- Calendar Schedule Blocks -->
      <!-- Column 1: x = 110, width = 86 -->
      <rect x="110" y="203" width="86" height="62" rx="14" ry="14" fill="#42a2f8" />
      <rect x="110" y="279" width="86" height="120" rx="14" ry="14" fill="#27be7c" />

      <!-- Column 2: x = 213, width = 86 -->
      <rect x="213" y="203" width="86" height="120" rx="14" ry="14" fill="#f5771e" />
      <rect x="213" y="337" width="86" height="62" rx="14" ry="14" fill="#9b67ea" />

      <!-- Column 3: x = 316, width = 86 -->
      <rect x="316" y="203" width="86" height="78" rx="14" ry="14" fill="#eb4987" />
      <rect x="316" y="295" width="86" height="104" rx="14" ry="14" fill="#151b3d" />

      <!-- Graduation Cap in Midnight Navy Tile (center cx=359, cy=347) -->
      <g stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <polygon points="359,328 386,339 359,350 332,339" stroke-width="4.2" />
        <path d="M 340,344 L 340,354 C 340,363 378,363 378,354 L 378,344" stroke-width="3.8" />
        <path d="M 386,339 L 388,356 C 388,360 384,362 381,362" stroke-width="3.5" />
        <circle cx="380" cy="362" r="2.2" fill="#ffffff" stroke="none" />
      </g>
    </g>
  `;

  if (isMaskable) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2a2eb8" />
      <stop offset="100%" stop-color="#1f2398" />
    </linearGradient>
    <filter id="cardShadow" x="-20%" y="-15%" width="140%" height="145%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#0c103e" flood-opacity="0.48" />
    </filter>
    <filter id="loopShadow" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#0c103e" flood-opacity="0.32" />
    </filter>
    <clipPath id="cardClip">
      <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardRx}" ry="${cardRx}" />
    </clipPath>
  </defs>

  <!-- Full bleed background for safe-zone maskable cropping -->
  <rect width="512" height="512" fill="url(#bgGrad)" />

  <!-- Centered in 78% safe-zone -->
  <g transform="translate(56.32, 56.32) scale(0.78)">
    ${cardContent}
  </g>
</svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2a2eb8" />
      <stop offset="100%" stop-color="#1f2398" />
    </linearGradient>
    <filter id="cardShadow" x="-20%" y="-15%" width="140%" height="145%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#0c103e" flood-opacity="0.48" />
    </filter>
    <filter id="loopShadow" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#0c103e" flood-opacity="0.32" />
    </filter>
    <clipPath id="cardClip">
      <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardRx}" ry="${cardRx}" />
    </clipPath>
  </defs>

  <!-- Background squircle -->
  <rect width="512" height="512" rx="116" ry="116" fill="url(#bgGrad)" />

  ${cardContent}
</svg>`;
}

async function run() {
  const publicDir = path.resolve(__dirname, '../public');

  const standardSvg = createSvg(false);
  const maskableSvg = createSvg(true);

  fs.writeFileSync(path.join(publicDir, 'icon.svg'), standardSvg, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'icon-maskable.svg'), maskableSvg, 'utf8');

  const stdBuffer = Buffer.from(standardSvg);
  const maskableBuffer = Buffer.from(maskableSvg);

  await sharp(stdBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512x512.png'));
  await sharp(stdBuffer).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192x192.png'));
  await sharp(maskableBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  await sharp(stdBuffer).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Multi-size or 48px favicon.ico
  const faviconBuffer = await sharp(stdBuffer).resize(48, 48).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), faviconBuffer);

  console.log('Successfully re-centered and built all PWA icon assets!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
