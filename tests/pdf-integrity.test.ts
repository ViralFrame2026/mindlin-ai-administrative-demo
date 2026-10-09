import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { POST } from "../app/api/extract-pdf/route";
async function extract(pages: string[][]) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = document.addPage([595, 842]);
    lines.forEach((line, index) =>
      page.drawText(line, { font, size: 12, x: 35, y: 790 - index * 22 }),
    );
  }
  const form = new FormData();
  form.set(
    "file",
    new File([new Uint8Array(await document.save())], "integridad-demo.pdf", {
      type: "application/pdf",
    }),
  );
  const response = await POST(
    new Request("http://localhost/api/extract-pdf", {
      method: "POST",
      body: form,
    }),
  );
  expect(response.status).toBe(200);
  return response.json();
}
const header = [
  "FACTURA A",
  "DATOS DEL EMISOR",
  "Razon Social: Prueba S.A.",
  "CUIT: 30-71500123-9",
  "Comprobante: 0004-00009999",
  "Fecha de emision: 09/10/2026",
];
describe("PDFs digitales reales: regresiones de auditoría", () => {
  it("no atribuye al emisor el CUIT del receptor en líneas separadas", async () => {
    const result = await extract([
      [
        "FACTURA A",
        "DATOS DEL RECEPTOR",
        "Razon Social: Cliente S.A.",
        "CUIT",
        "30-71234567-8",
        "DATOS DEL EMISOR",
        "Razon Social: Prueba S.A.",
        "CUIT",
        "30-71500123-9",
        "Neto: 100",
        "IVA 21%: 21",
        "Total: 121",
      ],
    ]);
    expect(result.data).toMatchObject({
      supplierCuit: "30-71500123-9",
      supplierName: "Prueba S.A.",
    });
  });
  it("interpreta miles argentinos sin centavos", async () => {
    const result = await extract([
      [...header, "Neto: 1.000", "IVA 21%: 210", "Total: 1.210"],
    ]);
    expect(result.data).toMatchObject({ net: 1000, vat: 210, total: 1210 });
  });
  it("no duplica resumen fiscal repetido en dos páginas", async () => {
    const lines = [...header, "Neto: 100", "IVA 21%: 21", "Total: 121"];
    const result = await extract([lines, lines]);
    expect(result.pages).toBe(2);
    expect(result.data).toMatchObject({ net: 100, vat: 21, total: 121 });
    expect(result.warnings).toEqual([]);
  });
  it("mantiene IVA igual de conceptos diferentes y usa resumen global", async () => {
    const result = await extract([
      [...header, "Detalle", "Concepto 1 IVA 21%: 21,00"],
      [
        "Concepto 2 IVA 21%: 21,00",
        "Importe Neto: 200,00",
        "Importe IVA: 42,00",
        "Importe Total: 242,00",
      ],
    ]);
    expect(result.data).toMatchObject({ net: 200, vat: 42, total: 242 });
  });
  it("no inventa cero cuando un importe no puede interpretarse", async () => {
    const result = await extract([
      [...header, "Neto: 1.23.4", "IVA: 21", "Total: 121"],
    ]);
    expect(result.data.net).toBeNull();
    expect(result.warnings.join()).toMatch(/manual/);
  });
});
