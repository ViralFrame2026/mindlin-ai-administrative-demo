import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { DEMO_INVOICES } from "../../lib/demo-data";
import { readCsv } from "../csv-reader";

test("descarga siete ejemplos con BOM, columnas regionales e importes intactos", async ({
  page,
  request,
}) => {
  const names = [
    "factura-construccion-andina.pdf",
    "factura-arquitectura-urbana.pdf",
    "factura-mantenimiento-integral.pdf",
    "factura-logistica-sur.pdf",
    "factura-servicios-norte.pdf",
    "factura-estudio-delta.pdf",
    "factura-insumos-oficina.pdf",
  ];
  const invoices = [];
  for (const [index, name] of names.entries()) {
    const response = await request.post("/api/extract-pdf", {
      multipart: {
        file: {
          name,
          mimeType: "application/pdf",
          buffer: await readFile(`public/samples/${name}`),
        },
      },
    });
    expect(response.ok()).toBe(true);
    const { data } = await response.json();
    expect([data.net, data.vat, data.total].every(Number.isFinite)).toBe(true);
    invoices.push({
      ...DEMO_INVOICES[0],
      id: `csv-original-${index}`,
      number: data.number,
      pointOfSale: data.pointOfSale,
      type: data.type,
      issueDate: data.issueDate,
      supplier: { name: data.supplierName, cuit: data.supplierCuit },
      amounts: {
        net: data.net,
        vat: data.vat,
        total: data.total,
        currency: "ARS" as const,
      },
      pdfName: name,
    });
  }
  // Isolated export fixture only: legacy PDFs contain duplicate business keys.
  // Production upload duplicate checks are not disabled or modified.
  await page.goto("/facturas");
  await expect(
    page.getByRole("heading", { name: "Facturas", exact: true }),
  ).toBeVisible();
  await page.evaluate(async (invoices) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("mindlin-ai-demo", 2);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("administrative-state", "readwrite");
        const store = tx.objectStore("administrative-state");
        const req = store.get("current");
        req.onsuccess = () => {
          const state = req.result;
          state.invoices = invoices;
          state.revision++;
          store.put(state, "current");
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => reject(tx.error);
      };
    });
  }, invoices);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("7 de 7 comprobantes");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("facturas-mindlin-ai.csv");
  const bytes = await readFile((await download.path())!);
  expect([...bytes.subarray(0, 3)]).toEqual([239, 187, 191]);
  const csv = bytes.toString("utf8");
  expect(csv.match(/\uFEFF/g)).toHaveLength(1);
  expect(csv).toContain("\r\n");
  const rows = readCsv(csv);
  expect(rows).toHaveLength(8);
  rows.forEach((row) => expect(row).toHaveLength(13));
  invoices.forEach((invoice, index) => {
    expect(rows[index + 1][1]).toBe(`${invoice.pointOfSale}-${invoice.number}`);
    expect(rows[index + 1][5]).toBe(invoice.supplier.cuit);
    expect(rows[index + 1].slice(6, 9)).toEqual(
      [invoice.amounts.net, invoice.amounts.vat, invoice.amounts.total].map(
        (value) => value.toFixed(2).replace(".", ","),
      ),
    );
  });
});
