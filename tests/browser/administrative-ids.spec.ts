import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readCsv } from "../csv-reader";
async function state(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        invoices: Array<{
          id: string;
          administrativeId: string;
          status: string;
          pdfStorageKey?: string;
        }>;
        history: Array<{ invoiceId?: string; administrativeId?: string }>;
      }>((resolve, reject) => {
        const open = indexedDB.open("mindlin-ai-demo", 2);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("administrative-state");
          const req = tx.objectStore("administrative-state").get("current");
          req.onsuccess = () => resolve(req.result);
          tx.oncomplete = () => db.close();
        };
      }),
  );
}
test("dos altas concurrentes conservan IDs en PDF, recarga, decisiones, búsqueda, historial y CSV", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await Promise.all(
    [page, other].map(async (tab, index) => {
      await tab.goto("/facturas/nueva");
      await tab
        .getByRole("button", { name: index ? /Arquitectura/ : /Construcción/ })
        .click();
      await expect(tab.getByLabel("Número", { exact: true })).toBeVisible();
      await tab.getByLabel("Número", { exact: true }).fill(`0000910${index}`);
    }),
  );
  await Promise.all(
    [page, other].map(async (tab) => {
      await tab.getByRole("button", { name: "Guardar como pendiente" }).click();
      await expect(tab.getByText("Total del comprobante")).toBeVisible();
      await expect(tab.locator("canvas")).toHaveAttribute(
        "data-rendered-page",
        "1",
      );
    }),
  );
  const saved = (await state(page)).invoices.filter(
    (i) => !i.id.startsWith("demo-"),
  );
  expect(saved).toHaveLength(2);
  expect(new Set(saved.map((i) => i.administrativeId)).size).toBe(2);
  expect(saved.map((i) => i.administrativeId).sort()).toEqual([
    "FAC-000005",
    "FAC-000006",
  ]);
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar aprobación" }).click();
  await other.getByRole("button", { name: "Enviar a revisión" }).click();
  await other.getByRole("button", { name: "Rechazar", exact: true }).click();
  await other.locator("textarea").fill("Falta documentación respaldatoria");
  await other.getByRole("button", { name: "Confirmar rechazo" }).click();
  await expect
    .poll(async () =>
      (await state(page)).invoices
        .filter((i) => saved.some((s) => s.id === i.id))
        .map((i) => i.status)
        .sort(),
    )
    .toEqual(["approved", "rejected"]);
  await page.reload();
  await expect(page.getByText("Total del comprobante")).toBeVisible();
  const after = await state(page);
  for (const original of saved) {
    expect(
      after.invoices.find((i) => i.id === original.id)?.administrativeId,
    ).toBe(original.administrativeId);
    expect(
      after.history
        .filter((h) => h.invoiceId === original.id)
        .every((h) => h.administrativeId === original.administrativeId),
    ).toBe(true);
  }
  await page.goto("/facturas");
  await page.getByRole("searchbox").fill(saved[0].administrativeId);
  await expect(page.getByRole("status")).toHaveText("1 de 6 comprobantes");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  const rows = readCsv(await readFile((await (await pending).path())!, "utf8"));
  expect(rows).toHaveLength(2);
  expect(rows[1]).toHaveLength(13);
  expect(rows[1][0]).toBe(saved[0].administrativeId);
  await page.goto("/historial");
  await expect(
    page.getByText(new RegExp(saved[0].administrativeId)).first(),
  ).toBeVisible();
});
