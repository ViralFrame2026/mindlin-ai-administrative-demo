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
  it.each([
    ["factura-construccion-andina.pdf", { supplierName: "Construcciones Andinas S.A.", supplierCuit: "30-71500123-9", type: "A", pointOfSale: "0004", number: "00001842", net: 1_250_000, vat: 262_500, total: 1_512_500 }],
    ["factura-arquitectura-urbana.pdf", { supplierName: "Arquitectura Urbana S.R.L.", supplierCuit: "30-71423456-7", type: "C", pointOfSale: "0016", number: "00000427", net: 480_000, vat: 0, total: 480_000 }],
    ["factura-mantenimiento-integral.pdf", { supplierName: "Mantenimiento Integral S.A.", supplierCuit: "30-71654321-4", type: "A", pointOfSale: "0009", number: "00000763", net: 360_000, vat: 75_600, total: 435_600 }],
    ["factura-logistica-sur.pdf", { supplierName: "Logistica Sur S.A.", supplierCuit: "30-69876543-3", type: "A", pointOfSale: "0007", number: "00004591", net: 610_000, vat: 128_100, total: 738_100 }],
  ])("extrae la estructura real de %s", async (name, expected) => {
    const response = await postPdf(await sampleFile(name));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(payload.data).toMatchObject(expected);
    expect(payload.warnings).toEqual([]);
  });

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
    const info = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
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
    info.mockRestore();
    warning.mockRestore();
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
