import type { Output } from "pdf2json";

export interface PdfTextResult {
  text: string;
  pages: number;
}

export interface PdfTextExtractor {
  extract: () => Promise<PdfTextResult>;
  destroy: () => void;
}

function parserError(errorData: unknown) {
  if (errorData && typeof errorData === "object" && "parserError" in errorData) {
    const nested = (errorData as { parserError: unknown }).parserError;
    return nested instanceof Error ? nested : new Error(String(nested));
  }
  return errorData instanceof Error ? errorData : new Error(String(errorData));
}

export async function createPdfTextExtractor(data: Uint8Array): Promise<PdfTextExtractor> {
  // pdf2json contains its own in-memory PDF canvas and does not load browser
  // graphics globals or native canvas. Keep the import lazy so startup errors
  // remain inside the API route's guarded request flow.
  const { default: PDFParser } = await import("pdf2json");
  const parser = new PDFParser(null, true);
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  let cancelActiveExtraction: (() => void) | undefined;

  return {
    extract: () => new Promise<PdfTextResult>((resolve, reject) => {
      let settled = false;
      const onReady = (pdfData: Output) => {
        finish(() => resolve({
          text: parser.getRawTextContent(),
          pages: pdfData.Pages.length,
        }));
      };
      const onError = (errorData: { parserError: Error } | Error) => {
        finish(() => reject(parserError(errorData)));
      };
      const cleanup = () => {
        parser.removeListener("pdfParser_dataReady", onReady);
        parser.removeListener("pdfParser_dataError", onError);
        cancelActiveExtraction = undefined;
      };
      const finish = (operation: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        operation();
      };

      cancelActiveExtraction = () => finish(() => reject(new Error("PDF extraction cancelled")));
      parser.once("pdfParser_dataReady", onReady);
      parser.once("pdfParser_dataError", onError);

      try {
        parser.parseBuffer(buffer, 0);
      } catch (error) {
        finish(() => reject(parserError(error)));
      }
    }),
    destroy: () => {
      cancelActiveExtraction?.();
      parser.destroy();
    },
  };
}
