import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function testPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 3; index += 1) {
    const page = pdf.addPage([595, 842]);
    page.drawRectangle({
      x: 40,
      y: 620,
      width: 510,
      height: 120,
      color: index === 0 ? rgb(0, 0.2, 0.8) : rgb(0.8, 0.2, 0),
    });
    page.drawText(`Factura ficticia - pagina ${index + 1}`, {
      x: 40,
      y: 580,
      size: 24,
      font,
    });
  }
  return Array.from(await pdf.save());
}

async function seedLocalInvoice(page: Page, bytes?: number[]) {
  await page.goto("/");
  await expect(page.getByText("Buen día, María")).toBeVisible();
  await page.evaluate(async (content) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("mindlin-ai-demo", 2);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const transaction = db.transaction(
          ["pdf-files", "administrative-state"],
          "readwrite",
        );
        const store = transaction.objectStore("administrative-state");
        const request = store.get("current");
        request.onsuccess = () => {
          const state = request.result;
          const invoice = {
            ...state.invoices[0],
            id: "browser-local-pdf",
            administrativeId: undefined,
            pdfName: "Factura de prueba.pdf",
            pdfUrl: undefined,
            pdfStorageKey: "browser-local-file",
            pages: 3,
          };
          state.invoices.unshift(invoice);
          state.revision += 1;
          store.put(state, "current");
          if (content)
            transaction
              .objectStore("pdf-files")
              .put(
                new Blob([new Uint8Array(content)], {
                  type: "application/pdf",
                }),
                "browser-local-file",
              );
        };
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error);
        };
      };
    });
  }, bytes);
  await page.goto("/facturas/browser-local-pdf");
}

async function rendered(page: Page, number: number) {
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-rendered-page", String(number));
  await expect(canvas).toBeVisible();
  await expect
    .poll(() =>
      canvas.evaluate((element: HTMLCanvasElement) => {
        const pixels = element
          .getContext("2d")!
          .getImageData(0, 0, element.width, element.height).data;
        let ink = 0;
        for (let index = 0; index < pixels.length; index += 80) {
          if (pixels[index] < 230 && pixels[index + 3] > 0) ink += 1;
        }
        return ink;
      }),
    )
    .toBeGreaterThan(100);
}

test("renderiza un PDF real con worker local y sin errores de navegador", async ({
  page,
}) => {
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      (message.type() === "error" || /fake worker/i.test(message.text())) &&
      !message.location().url.endsWith("/favicon.ico")
    )
      errors.push(message.text());
  });
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      !request.url().startsWith("http://127.0.0.1:3600")
    )
      externalRequests.push(request.url());
  });
  const workerResponse = page.waitForResponse((response) =>
    response.url().endsWith("pdf.worker.min.mjs"),
  );
  await page.goto("/facturas/demo-construccion");
  await rendered(page, 1);
  expect((await workerResponse).status()).toBe(200);
  expect(
    page
      .workers()
      .some((worker) => worker.url().includes("pdf.worker.min.mjs")),
  ).toBe(true);
  await expect(page.getByText("Página 1 de 1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Página siguiente" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Abrir", exact: true }),
  ).toHaveAttribute("href", "/samples/factura-construccion-andina.pdf");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Descargar", exact: true }).click();
  expect((await download).suggestedFilename()).toBe(
    "factura-construccion-andina.pdf",
  );
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("recupera IndexedDB, navega, hace zoom y no desborda el ancho móvil", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.location().url.endsWith("/favicon.ico")
    )
      errors.push(message.text());
  });
  await seedLocalInvoice(page, await testPdf());
  await rendered(page, 1);
  await page.getByRole("button", { name: "Página siguiente" }).click();
  await rendered(page, 2);
  await page.getByRole("button", { name: "Página siguiente" }).click();
  await rendered(page, 3);
  await expect(
    page.getByRole("button", { name: "Página siguiente" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Página anterior" }).click();
  await rendered(page, 2);
  const before = await page
    .locator("canvas")
    .evaluate((canvas) => canvas.getBoundingClientRect().width);
  await page.getByRole("button", { name: "Acercar" }).click();
  await expect(page.getByText("125%", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("canvas")
        .evaluate((canvas) => canvas.getBoundingClientRect().width),
    )
    .toBeGreaterThan(before);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Ajustar", exact: true }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  await expect
    .poll(() =>
      page
        .locator("canvas")
        .evaluate((canvas) => canvas.getBoundingClientRect().width),
    )
    .toBeLessThan(290);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("link", { name: "Abrir", exact: true }),
  ).toHaveAttribute("href", /^blob:/);
  const originalUrl = await page
    .getByRole("link", { name: "Abrir", exact: true })
    .getAttribute("href");
  await page.evaluate(() => {
    const revoke = URL.revokeObjectURL.bind(URL);
    (window as typeof window & { releasedPdfUrls: string[] }).releasedPdfUrls =
      [];
    URL.revokeObjectURL = (url) => {
      (
        window as typeof window & { releasedPdfUrls: string[] }
      ).releasedPdfUrls.push(url);
      revoke(url);
    };
  });
  await page.getByRole("link", { name: "Volver", exact: true }).click();
  await expect.poll(() => page.workers().length).toBe(0);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { releasedPdfUrls: string[] })
          .releasedPdfUrls,
    ),
  ).toContain(originalUrl);
  expect(errors).toEqual([]);
});

test("muestra un error comprensible para un PDF corrupto", async ({ page }) => {
  await seedLocalInvoice(
    page,
    Array.from(new TextEncoder().encode("%PDF-1.7\narchivo roto")),
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "No pudimos visualizar el PDF" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Descargar", exact: true }),
  ).toBeVisible();
});

test("renderiza durante la carga de una factura sin depender de iframe", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/facturas/nueva");
  await page.getByRole("button", { name: /Construcción · materiales/ }).click();
  await expect(
    page.getByText("Extracción completada", { exact: true }),
  ).toBeVisible();
  await rendered(page, 1);
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("muestra un mensaje si falta el archivo local", async ({ page }) => {
  await seedLocalInvoice(page);
  await expect(page.getByText("El PDF no está disponible.")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});
