// Draws the app icons into public/icons/: one blue ball with the tokens.css recipe (base
// gradient + specular), like the favicon. No dependencies: Node's zlib writes the PNGs.
// Run `npm run icons` after changing this file and commit the PNGs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

const OUT = new URL('../public/icons/', import.meta.url);

/** tokens.css: --bb-blue-hi, --bb-blue, --bb-blue-edge. */
const HI = [0x50, 0x64, 0xff];
const BODY = [0x14, 0x14, 0xd2];
const EDGE = [0x00, 0x00, 0x5a];
const WHITE = [0xff, 0xff, 0xff];

/** `background` null = transparent; `ball` = ball diameter / icon size. */
const ICONS = [
  { file: 'icon-192.png', size: 192, ball: 0.92, background: null },
  { file: 'icon-512.png', size: 512, ball: 0.92, background: null },
  // Maskable: full-bleed board white, ball inside the 80 % safe zone.
  { file: 'icon-maskable-512.png', size: 512, ball: 0.64, background: WHITE },
  // iOS fills transparency with black.
  { file: 'apple-touch-icon.png', size: 180, ball: 0.8, background: WHITE },
];

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** radial-gradient(circle farthest-side at 35% 30%, hi 0%, body 40%, edge 100%). */
function base(x, y) {
  const t = Math.min(Math.hypot(x - 0.35, y - 0.3) / 0.7, 1);
  return t < 0.4 ? mix(HI, BODY, t / 0.4) : mix(BODY, EDGE, (t - 0.4) / 0.6);
}

/** --bb-specular: white at 30% 28%, alpha .95 → .55 at 5 % → 0 at 11 % of the corner distance. */
function specular(x, y) {
  const t = Math.hypot(x - 0.3, y - 0.28) / Math.hypot(0.7, 0.72);
  if (t >= 0.11) {
    return 0;
  }
  return t < 0.05 ? 0.95 - (0.4 * t) / 0.05 : 0.55 * (1 - (t - 0.05) / 0.06);
}

/** RGBA pixels, 4 × 4 samples per pixel for smooth edges. */
function draw({ size, ball, background }) {
  const pixels = Buffer.alloc(size * size * 4);
  const diameter = size * ball;
  const offset = (size - diameter) / 2;
  const samples = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          // Position inside the ball's box, 0…1.
          const x = (px + (sx + 0.5) / samples - offset) / diameter;
          const y = (py + (sy + 0.5) / samples - offset) / diameter;
          let color = background;
          if (Math.hypot(x - 0.5, y - 0.5) <= 0.5) {
            color = mix(base(x, y), WHITE, specular(x, y));
          }
          if (color !== null) {
            r += color[0];
            g += color[1];
            b += color[2];
            a += 1;
          }
        }
      }
      const i = (py * size + px) * 4;
      if (a > 0) {
        pixels[i] = Math.round(r / a);
        pixels[i + 1] = Math.round(g / a);
        pixels[i + 2] = Math.round(b / a);
      }
      pixels[i + 3] = Math.round((255 * a) / (samples * samples));
    }
  }
  return pixels;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function png(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    // Filter byte 0 (none), then the row.
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const icon of ICONS) {
  const data = png(icon.size, draw(icon));
  writeFileSync(new URL(icon.file, OUT), data);
  console.log(
    `${icon.file} ${String(icon.size)}×${String(icon.size)} ${String(data.length)} bytes`,
  );
}
