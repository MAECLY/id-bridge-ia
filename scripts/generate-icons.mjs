// Rasterizes assets/icon.svg into the PNG sizes WXT auto-discovers in public/.
// The generated PNGs are committed, so a normal `pnpm build` never runs this.
// Run manually with `pnpm icons` after editing the SVG.
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'assets/icon.svg');
const outDir = resolve(root, 'public/icon');
const sizes = [16, 32, 48, 96, 128];

const svg = await readFile(src);
await mkdir(outDir, { recursive: true });

await Promise.all(
  sizes.map((size) =>
    sharp(svg, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(resolve(outDir, `${size}.png`)),
  ),
);

console.log(`Generated ${sizes.length} icons -> ${outDir}`);
