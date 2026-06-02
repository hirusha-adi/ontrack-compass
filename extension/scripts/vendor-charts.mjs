import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "vendor");

const files = [
  [
    "node_modules/chart.js/dist/chart.umd.min.js",
    "chart.umd.min.js",
  ],
  [
    "node_modules/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js",
    "chartjs-adapter-date-fns.bundle.min.js",
  ],
  [
    "node_modules/chartjs-plugin-annotation/dist/chartjs-plugin-annotation.min.js",
    "chartjs-plugin-annotation.min.js",
  ],
];

mkdirSync(out, { recursive: true });

for (const [src, dest] of files) {
  copyFileSync(join(root, src), join(out, dest));
}

console.log("Copied Chart.js vendor files to extension/vendor/");
