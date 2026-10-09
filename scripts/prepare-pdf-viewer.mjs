import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const packagePath = require.resolve("pdfjs-dist/package.json");
const { version } = require(packagePath);
const source = dirname(packagePath);
const target = join(process.cwd(), "public", "pdfjs", version);
await mkdir(target, { recursive: true });
await cp(join(source, "legacy/build/pdf.worker.min.mjs"), join(target, "pdf.worker.min.mjs"));
for (const directory of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  await cp(join(source, directory), join(target, directory), { recursive: true });
}
console.log(`PDF.js ${version}: worker and resources prepared locally.`);
