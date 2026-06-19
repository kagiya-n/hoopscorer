// PWA 用アイコン（192/512）を SVG から生成する。
// npm run icons で実行。生成物は public/icons/ に出力。
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'public', 'icons');

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#1d2630"/>
      <stop offset="100%" stop-color="#12161B"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>
  <text x="50%" y="60%" font-family="Oswald, system-ui, sans-serif" font-weight="700"
        font-size="${size * 0.52}" text-anchor="middle" fill="#F5C451">H</text>
</svg>
`;

await mkdir(outDir, { recursive: true });
for (const size of [192, 512]) {
  const out = resolve(outDir, `icon-${size}.png`);
  await sharp(Buffer.from(svg(size))).png().toFile(out);
  console.log('wrote', out);
}
