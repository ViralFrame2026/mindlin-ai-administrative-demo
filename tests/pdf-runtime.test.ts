import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createPdfTextExtractor } from "../lib/pdf-text-extractor";

const browserGraphicsGlobals = ["DOMMatrix", "ImageData", "Path2D"] as const;

describe("runtime Node del extractor PDF", () => {
  it("carga y extrae texto sin canvas ni APIs gráficas del navegador", async () => {
    const descriptors = new Map(
      browserGraphicsGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    );
    browserGraphicsGlobals.forEach((name) => Reflect.deleteProperty(globalThis, name));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const lockfile = JSON.parse(
        await readFile(join(process.cwd(), "package-lock.json"), "utf8"),
      ) as { packages: Record<string, unknown> };
      // PDF.js belongs to the client viewer. The server extractor must remain pdf2json
      // and must not depend on the optional native canvas shipped with PDF.js.
      expect(lockfile.packages["node_modules/pdf-parse"]).toBeUndefined();
      const extractorSource = await readFile(join(process.cwd(), "lib", "pdf-text-extractor.ts"), "utf8");
      expect(extractorSource).not.toMatch(/import\(["'](?:pdfjs-dist|@napi-rs\/canvas)/);

      const bytes = await readFile(
        join(process.cwd(), "public", "samples", "factura-materiales-multiconcepto.pdf"),
      );
      const extractor = await createPdfTextExtractor(new Uint8Array(bytes));
      try {
        const result = await extractor.extract();
        expect(result.pages).toBe(1);
        expect(result.text).toContain("Materiales Construccion Demo S.A.");
        expect(result.text).toContain("Transporte y descarga en obra");
        for (const name of browserGraphicsGlobals) {
          expect(typeof globalThis[name]).toBe("undefined");
        }
      } finally {
        extractor.destroy();
      }
    } finally {
      warning.mockRestore();
      for (const name of browserGraphicsGlobals) {
        const descriptor = descriptors.get(name);
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    }
  });
});
