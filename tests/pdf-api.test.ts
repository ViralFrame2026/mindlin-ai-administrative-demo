import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/extract-pdf/route";
import {
  PdfApiResponseError,
  parsePdfExtractionResponse,
  requestPdfExtraction,
} from "../lib/pdf-api";
import { MAX_PDF_FILE_SIZE } from "../lib/pdf-constraints";

const samplesDirectory = join(process.cwd(), "public", "samples");

async function sampleFile(name: string) {
  const bytes = await readFile(join(samplesDirectory, name));
  return new File([bytes], name, { type: "application/pdf" });
}

async function postPdf(file: File) {
  const form = new FormData();
  form.append("file", file);
  return POST(new Request("http://localhost/api/extract-pdf", { method: "POST", body: form }));
}

describe("POST /api/extract-pdf", () => {
  it("extrae un PDF digital y siempre responde JSON", async () => {
    const response = await postPdf(await sampleFile("factura-servicios-norte.pdf"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-request-id")).toBeTruthy();

    const payload = await response.json();
    expect(payload).toMatchObject({
      data: {
        supplierName: "Servicios Norte S.A.",
        supplierCuit: "30-71654321-4",
        number: "00001234",
        total: 998_250,
      },
      pages: 1,
    });
  });

  it("procesa un PDF digital con múltiples conceptos", async () => {
    const response = await postPdf(await sampleFile("factura-materiales-multiconcepto.pdf"));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      supplierName: "Materiales Construccion Demo S.A.",
      supplierCuit: "30-71500123-9",
      pointOfSale: "0021",
      number: "00000341",
      net: 1_250_000,
      vat: 262_500,
      total: 1_512_500,
    });
    expect(payload.textPreview).toContain("Transporte y descarga en obra");
  });

  it("devuelve JSON válido cuando el PDF está dañado", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await postPdf(
      new File(["%PDF-1.7\ncontenido truncado"], "dañado.pdf", { type: "application/pdf" }),
    );
    const payload = await response.json();
    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(payload).toMatchObject({ code: "PDF_PARSE_FAILED" });
    expect(payload.error).toMatch(/No fue posible leer el PDF/);
    expect(payload.requestId).toBeTruthy();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("rechaza antes de parsear un archivo que excede el límite de Vercel", async () => {
    const oversized = new File(
      [new Uint8Array(MAX_PDF_FILE_SIZE + 1)],
      "demasiado-grande.pdf",
      { type: "application/pdf" },
    );
    const response = await postPdf(oversized);
    const payload = await response.json();
    expect(response.status).toBe(413);
    expect(payload).toMatchObject({ code: "PDF_TOO_LARGE" });
  });
});

describe("cliente de extracción PDF", () => {
  it("regresión: una respuesta vacía no intenta ejecutar response.json()", async () => {
    const validPdf = await sampleFile("factura-servicios-norte.pdf");
    const emptyServerResponse: typeof fetch = async () =>
      new Response(null, { status: 500, statusText: "Internal Server Error" });

    const operation = requestPdfExtraction(validPdf, emptyServerResponse);
    await expect(operation).rejects.toBeInstanceOf(PdfApiResponseError);
    await expect(operation).rejects.not.toBeInstanceOf(SyntaxError);
    await expect(operation).rejects.toMatchObject({
      code: "EMPTY_ERROR_RESPONSE",
      status: 500,
      userMessage: expect.stringContaining("servicio de extracción"),
    });
  });

  it("convierte una respuesta HTML de timeout en un error comprensible", async () => {
    const response = new Response("Gateway timeout", {
      status: 504,
      headers: { "content-type": "text/plain" },
    });
    await expect(parsePdfExtractionResponse(response)).rejects.toMatchObject({
      status: 504,
      userMessage: expect.stringContaining("tardó demasiado"),
      responsePreview: "Gateway timeout",
    });
  });

  it("detecta JSON truncado aun cuando el servidor responde 200", async () => {
    const response = new Response('{"data":', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    await expect(parsePdfExtractionResponse(response)).rejects.toMatchObject({
      code: "INVALID_JSON_RESPONSE",
      userMessage: expect.stringContaining("respuesta incompleta"),
    });
  });
});
