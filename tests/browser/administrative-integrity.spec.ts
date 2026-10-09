import { expect, test, type Page } from "@playwright/test";
async function persisted(page: Page) {
  return page.evaluate(
    async () =>
      new Promise<{
        invoices: Array<{
          id: string;
          status: string;
          amounts: { net: number; vat: number; total: number };
          retentionTotal: number;
          retentionRulesVersion: number;
        }>;
        history: Array<{
          action: string;
          reason?: string;
          before?: unknown;
          after?: unknown;
        }>;
        rulesVersion: number;
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
async function load(page: Page, id: string) {
  await page.goto(`/facturas/${id}`);
  await expect(page.getByText("Total del comprobante")).toBeVisible();
}
test("aprueba explícitamente, conserva decisión e historial tras recarga", async ({
  page,
}) => {
  await load(page, "demo-construccion");
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  expect(
    (await persisted(page)).invoices.find((x) => x.id === "demo-construccion")!
      .status,
  ).toBe("needs_review");
  await page.getByRole("button", { name: "Confirmar aprobación" }).click();
  await expect
    .poll(
      async () =>
        (await persisted(page)).invoices.find(
          (x) => x.id === "demo-construccion",
        )!.status,
    )
    .toBe("approved");
  await page.reload();
  await expect(page.getByText("Total del comprobante")).toBeVisible();
  const state = await persisted(page);
  expect(state.history.slice(0, 2).map((x) => x.action)).toEqual([
    "approved",
    "review_started",
  ]);
});
test("rechazo exige motivo y conserva trazabilidad", async ({ page }) => {
  await load(page, "demo-mantenimiento");
  await page.getByRole("button", { name: "Rechazar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirmar rechazo" }),
  ).toBeDisabled();
  await page.locator("textarea").fill("Falta remito conformado");
  await page.getByRole("button", { name: "Confirmar rechazo" }).click();
  await expect
    .poll(
      async () =>
        (await persisted(page)).invoices.find(
          (x) => x.id === "demo-mantenimiento",
        )!.status,
    )
    .toBe("rejected");
  await page.reload();
  expect((await persisted(page)).history[0]).toMatchObject({
    action: "rejected",
    reason: "Falta remito conformado",
  });
});
test("dos pestañas conservan decisiones distintas y sincronizan estados", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await Promise.all([
    load(page, "demo-construccion"),
    load(other, "demo-mantenimiento"),
  ]);
  await other.getByRole("button", { name: "Rechazar", exact: true }).click();
  await other.locator("textarea").fill("Falta remito conformado");
  await Promise.all([
    page.getByRole("button", { name: "Enviar a revisión" }).click(),
    other.getByRole("button", { name: "Confirmar rechazo" }).click(),
  ]);
  await expect
    .poll(async () =>
      (await persisted(page)).history
        .slice(0, 2)
        .map((x) => x.action)
        .sort(),
    )
    .toEqual(["rejected", "review_started"]);
  const state = await persisted(page);
  expect(state.invoices.find((x) => x.id === "demo-construccion")!.status).toBe(
    "needs_review",
  );
  expect(
    state.invoices.find((x) => x.id === "demo-mantenimiento")!.status,
  ).toBe("rejected");
  await other.goto("/facturas/demo-construccion");
  await expect(
    other.getByRole("button", { name: "Aprobar", exact: true }),
  ).toBeVisible();
  await page.reload();
  expect((await persisted(page)).history[0].action).toMatch(
    /rejected|review_started/,
  );
});
test("rechaza alícuotas inválidas y conserva cálculo aprobado hasta recálculo con motivo", async ({
  page,
}) => {
  await page.goto("/retenciones");
  await expect(
    page.getByRole("button", { name: "Guardar reglas" }),
  ).toBeVisible();
  await page.getByLabel("Alícuota", { exact: true }).first().fill("150");
  await page.getByRole("button", { name: "Guardar reglas" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Las alícuotas" }),
  ).toContainText("entre 0 y 100");
  expect((await persisted(page)).rulesVersion).toBe(1);
  await page.getByLabel("Alícuota", { exact: true }).first().fill("10");
  await page.getByRole("button", { name: "Guardar reglas" }).click();
  await expect.poll(async () => (await persisted(page)).rulesVersion).toBe(2);
  expect(
    (await persisted(page)).invoices.find((x) => x.id === "demo-arquitectura")!
      .retentionTotal,
  ).toBe(14050);
  await load(page, "demo-arquitectura");
  await expect(
    page.getByRole("button", { name: "Recalcular explícitamente" }),
  ).toBeDisabled();
  await page
    .getByLabel("Motivo del recálculo")
    .fill("Simulación con nueva versión");
  await page.getByRole("button", { name: "Recalcular explícitamente" }).click();
  await expect
    .poll(async () => (await persisted(page)).history[0].action)
    .toBe("retention_recalculated");
  expect((await persisted(page)).history[0]).toMatchObject({
    reason: "Simulación con nueva versión",
    before: { total: 14050 },
    after: { version: 2 },
  });
});
test("la interfaz impide guardar la factura inconsistente del hallazgo original", async ({
  page,
}) => {
  await page.goto("/facturas/nueva");
  await page.getByRole("button", { name: /Construcción/ }).click();
  await expect(page.getByLabel("Razón social", { exact: true })).toBeVisible();
  await page.getByLabel("Número", { exact: true }).fill("00009999");
  await page.getByLabel("Tipo", { exact: true }).fill("XYZ");
  await page.getByLabel("Punto de venta", { exact: true }).fill("abc");
  await page.getByLabel("Importe neto", { exact: true }).fill("-100");
  await page.getByLabel("IVA", { exact: true }).fill("0");
  await page.getByLabel("Total", { exact: true }).fill("121");
  await expect(
    page.getByRole("button", { name: /Guardar.*pendiente/i }),
  ).toBeDisabled();
  expect((await persisted(page)).invoices).toHaveLength(4);
});

test("dos decisiones concurrentes sobre la misma factura confirman solamente una", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await Promise.all([
    load(page, "demo-mantenimiento"),
    load(other, "demo-mantenimiento"),
  ]);
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await other.getByRole("button", { name: "Rechazar", exact: true }).click();
  await other.locator("textarea").fill("Falta remito conformado");
  await Promise.all([
    page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((element) =>
        element.textContent?.includes("Confirmar aprobación"),
      );
      button?.click();
    }),
    other.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((element) =>
        element.textContent?.includes("Confirmar rechazo"),
      );
      button?.click();
    }),
  ]);
  await expect
    .poll(
      async () =>
        (await persisted(page)).history.filter(
          (entry) => entry.action === "approved" || entry.action === "rejected",
        ).length,
    )
    .toBe(3); // two seeded decisions, one new decision
  const state = await persisted(page);
  expect(["approved", "rejected"]).toContain(
    state.invoices.find((invoice) => invoice.id === "demo-mantenimiento")!
      .status,
  );
  await page.reload();
  await other.reload();
  expect(
    (await persisted(other)).history.filter(
      (entry) => entry.action === "approved" || entry.action === "rejected",
    ),
  ).toHaveLength(3);
});

test("migra datos v1 y conserva el PDF almacenado antes de actualizar", async ({
  page,
}) => {
  const { DEMO_INVOICES, DEMO_HISTORY } = await import("../../lib/demo-data");
  const { DEFAULT_RETENTION_RULES } = await import("../../lib/retention");
  const { readFile } = await import("node:fs/promises");
  const bytes = Array.from(
    await readFile("public/samples/factura-construccion-andina.pdf"),
  );
  await page.goto("/404");
  await page.evaluate(
    async ({ invoices, history, rules, content }) => {
      const open = indexedDB.open("mindlin-ai-demo", 2);
      await new Promise<void>((resolve, reject) => {
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          open.result.close();
          resolve();
        };
      });
      await new Promise<void>((resolve, reject) => {
        const deletion = indexedDB.deleteDatabase("mindlin-ai-demo");
        deletion.onsuccess = () => resolve();
        deletion.onerror = () => reject(deletion.error);
      });
      const legacy = {
        ...invoices[0],
        pdfUrl: undefined,
        pdfStorageKey: "legacy-file",
        source: "uploaded",
      };
      localStorage.setItem(
        "mindlin.invoices.v1",
        JSON.stringify([legacy, ...invoices.slice(1)]),
      );
      localStorage.setItem("mindlin.retention-rules.v1", JSON.stringify(rules));
      localStorage.setItem("mindlin.history.v1", JSON.stringify(history));
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("mindlin-ai-demo", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("pdf-files");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("pdf-files", "readwrite");
          tx.objectStore("pdf-files").put(
            new Blob([new Uint8Array(content)], { type: "application/pdf" }),
            "legacy-file",
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      });
    },
    {
      invoices: DEMO_INVOICES,
      history: DEMO_HISTORY,
      rules: DEFAULT_RETENTION_RULES,
      content: bytes,
    },
  );
  await load(page, "demo-construccion");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-rendered-page",
    "1",
  );
  expect((await persisted(page)).invoices).toHaveLength(4);
  expect(
    await page.evaluate(() => localStorage.getItem("mindlin.invoices.v1")),
  ).not.toBeNull();
});

test("alta desde extractor real guarda pendiente, PDF y permite revisión y aprobación", async ({
  page,
}) => {
  await page.goto("/facturas/nueva");
  await page.getByRole("button", { name: /Construcción/ }).click();
  await expect(page.getByLabel("Número", { exact: true })).toBeVisible();
  await page.getByLabel("Número", { exact: true }).fill("00009998");
  await page.getByRole("button", { name: "Guardar como pendiente" }).click();
  await expect(page.getByText("Total del comprobante")).toBeVisible();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-rendered-page",
    "1",
  );
  const state = await persisted(page);
  const added = state.invoices.find((item) => !item.id.startsWith("demo-"))!;
  expect(added.status).toBe("pending");
  expect(state.history[0].action).toBe("uploaded");
  await page.getByRole("button", { name: "Enviar a revisión" }).click();
  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar aprobación" }).click();
  await expect
    .poll(
      async () =>
        (await persisted(page)).invoices.find((item) => item.id === added.id)!
          .status,
    )
    .toBe("approved");
  await page.reload();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-rendered-page",
    "1",
  );
  expect(
    (await persisted(page)).history.slice(0, 3).map((item) => item.action),
  ).toEqual(["approved", "review_started", "uploaded"]);
});

test("reinicio confirmado conserva los ejemplos y registra la operación", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Buen día, María")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reiniciar demo" }).click();
  await expect
    .poll(async () => (await persisted(page)).history[0].action)
    .toBe("demo_reset");
  expect((await persisted(page)).invoices).toHaveLength(4);
  await page.reload();
  expect((await persisted(page)).history[0].action).toBe("demo_reset");
});

for (const sample of [
  { label: /Construcción/, net: "1250000", vat: "262500", total: "1512500" },
  { label: /Arquitectura/, net: "480000", vat: "0", total: "480000" },
  { label: /Mantenimiento/, net: "360000", vat: "75600", total: "435600" },
  { label: /Logística/, net: "610000", vat: "128100", total: "738100" },
]) {
  test(`extrae y guarda el PDF original ${sample.label}`, async ({ page }) => {
    await page.goto("/facturas/nueva");
    await page.getByRole("button", { name: sample.label }).click();
    await expect(page.getByLabel("Importe neto", { exact: true })).toHaveValue(
      sample.net,
    );
    // Zero VAT must be visible as a real zero, not a blank/missing field.
    await expect(page.getByLabel("IVA", { exact: true })).toHaveValue(
      sample.vat,
    );
    await expect(page.getByLabel("Total", { exact: true })).toHaveValue(
      sample.total,
    );
    await page.getByLabel("Número", { exact: true }).fill("00009997");
    await page.getByRole("button", { name: "Guardar como pendiente" }).click();
    await expect(page.getByText("Total del comprobante")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Total del comprobante")).toBeVisible();
    const state = await persisted(page);
    expect(state.invoices).toHaveLength(5);
    const saved = state.invoices.find(
      (invoice) => !invoice.id.startsWith("demo-"),
    )!;
    expect(saved.status).toBe("pending");
    expect(saved.amounts).toMatchObject({
      net: Number(sample.net),
      vat: Number(sample.vat),
      total: Number(sample.total),
    });
  });
}
