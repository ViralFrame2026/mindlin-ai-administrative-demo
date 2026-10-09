import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("búsqueda de comprobante y filtros accesibles sin desbordar en 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/facturas");
  await page.getByRole("searchbox", { name: "Buscar facturas" }).fill("4-1842");
  await expect(page.getByRole("status")).toHaveText("1 de 4 comprobantes");
  await page.getByRole("button", { name: "Pendientes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pendientes", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toHaveText("1 de 4 comprobantes");
  await page.getByRole("button", { name: "Aprobadas", exact: true }).click();
  await expect(page.getByText("No hay resultados")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByText("Usuario demo", { exact: true })).toBeVisible();
});
test("menú móvil mantiene foco, responde a Escape y permite navegar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Abrir menú" });
  await opener.click();
  const menu = page.getByRole("dialog", { name: "Menú de navegación" });
  await expect(menu).toBeVisible();
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press("Tab");
    expect(
      await menu.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(opener).toBeFocused();
  await opener.click();
  await menu.getByRole("link", { name: "Historial", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Historial de operaciones" }),
  ).toBeVisible();
  await expect(menu).not.toBeVisible();
});
test("exportación descargada neutraliza fórmulas y presenta historial en español", async ({
  page,
}) => {
  await page.goto("/facturas");
  await expect(
    page.getByRole("heading", { name: "Facturas", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
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
          state.invoices[0].supplier.name = "=1+1";
          state.invoices[0].rejectionReason = "@SUM(A1)";
          state.history.unshift({
            id: "csv-test",
            action: "review_started",
            timestamp: "2026-10-09T12:00:00Z",
            actor: "Usuario demo",
            description: "Factura 0004-00001842: pending → needs_review.",
            fromStatus: "pending",
            toStatus: "needs_review",
            reason: "=1+1",
          });
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
  });
  await page.reload();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  const download = await downloadPromise;
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain('"\'=1+1"');
  expect(csv).toContain('"\'@SUM(A1)"');
  expect(csv).toContain('"Pendiente"');
  await page.goto("/historial");
  await expect(
    page.getByText("Factura 0004-00001842: Pendiente → En revisión.", {
      exact: true,
    }),
  ).toBeVisible();
  const historyPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  const history = await readFile(
    (await (await historyPromise).path())!,
    "utf8",
  );
  expect(history).toContain('"Enviada a revisión"');
  expect(history).not.toContain("needs_review");
  expect(history).toContain('"\'=1+1"');
});

test("dashboard conserva métricas y aclara evolución ilustrativa", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Volumen administrado", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/3\.166\.200,00/)).toBeVisible();
  await expect(page.getByText(/14\.050,00/)).toBeVisible();
  await expect(
    page.getByText("Evolución ilustrativa de los últimos 10 períodos", {
      exact: true,
    }),
  ).toBeVisible();
  const queue = page.getByText("En cola", { exact: true }).locator("..");
  await expect(queue).toContainText("2");
  const approved = page
    .getByText("Aprobadas", { exact: true })
    .first()
    .locator("..");
  await expect(approved).toContainText("1");
});
