// Diagnostic only: reads the original fictitious PDF, never edits it.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import PDFParser from "pdf2json";
const name = "factura-arquitectura-urbana.pdf";
const bytes = await readFile(
  new URL(`../public/samples/${name}`, import.meta.url),
);
console.log(`SHA-256 ${createHash("sha256").update(bytes).digest("hex")}`);
const parser = new PDFParser(null, true);
try {
  const text = await new Promise((resolve, reject) => {
    parser.once("pdfParser_dataReady", () =>
      resolve(parser.getRawTextContent()),
    );
    parser.once("pdfParser_dataError", (error) =>
      reject(error.parserError ?? error),
    );
    parser.parseBuffer(bytes);
  });
  console.log(text);
} finally {
  parser.destroy();
}
