import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, "..", "icons");

const sizes = [16, 32, 48, 128];

function drawCompass(size) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) << 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r8 = 30;
      let g8 = 58;
      let b8 = 95;
      let a8 = 255;

      if (dist <= r && dist > r * 0.75) {
        r8 = 248;
        g8 = 250;
        b8 = 252;
      } else if (dist <= r * 0.75) {
        const angle = Math.atan2(dy, dx);
        const needle =
          Math.abs(Math.sin(angle * 2)) > 0.85 ||
          Math.abs(Math.cos(angle * 2)) > 0.85;
        if (needle) {
          r8 = 13;
          g8 = 148;
          b8 = 136;
        } else {
          r8 = 241;
          g8 = 245;
          b8 = 249;
        }
      } else {
        a8 = 0;
      }

      png.data[i] = r8;
      png.data[i + 1] = g8;
      png.data[i + 2] = b8;
      png.data[i + 3] = a8;
    }
  }
  return png;
}

fs.mkdirSync(iconsDir, { recursive: true });

for (const size of sizes) {
  const png = drawCompass(size);
  const out = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(out, PNG.sync.write(png));
  console.log("Wrote", out);
}
