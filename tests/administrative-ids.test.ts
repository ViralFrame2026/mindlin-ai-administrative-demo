import { beforeEach, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { assignAdministrativeIds } from "../lib/administrative-ids";
import {
  initialState,
  addAdministrativeInvoice,
  changeAdministrativeStatus,
} from "../lib/administration";
import { transactState, getPdfBlob } from "../lib/storage";
import { invoicesToCsv, historyToCsv } from "../lib/csv";
import { matchesInvoiceSearch } from "../lib/invoice-search";
import { DEMO_INVOICES } from "../lib/demo-data";
import { readCsv } from "./csv-reader";
const legacy = () => ({
  ...initialState(),
  nextAdministrativeNumber: undefined,
  history: initialState().history.map(
    ({ administrativeId, ...entry }) => entry,
  ),
  invoices: [
    ...structuredClone(DEMO_INVOICES),
    ...[1, 2, 3].map((n) => ({
      ...structuredClone(DEMO_INVOICES[0]),
      id: `legacy-extra-${n}`,
      number: `0000800${n}`,
    })),
  ],
});
const fresh = (number = "00009001") => ({
  ...structuredClone(DEMO_INVOICES[0]),
  id: `new-${number}`,
  number,
  pdfStorageKey: `pdf-${number}`,
});
beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("mindlin-ai-demo");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});
it("migra siete registros de forma determinista e idempotente sin alterar PDFs, estados ni auditoría", () => {
  const old = legacy();
  const migrated = assignAdministrativeIds(old);
  expect(migrated.invoices).toHaveLength(7);
  expect(new Set(migrated.invoices.map((i) => i.administrativeId)).size).toBe(
    7,
  );
  expect(assignAdministrativeIds(migrated)).toEqual(migrated);
  const reversed = assignAdministrativeIds({
    ...old,
    invoices: [...old.invoices].reverse(),
  });
  for (const item of migrated.invoices) {
    expect(
      reversed.invoices.find((i) => i.id === item.id)?.administrativeId,
    ).toBe(item.administrativeId);
    const { administrativeId, ...rest } = item;
    expect(rest).toEqual(old.invoices.find((i) => i.id === item.id));
  }
  expect(
    migrated.history.map(({ administrativeId, ...entry }) => entry),
  ).toEqual(old.history);
});
it("preserva asignados, avanza sobre el mayor y detiene IDs duplicados o inválidos", () => {
  const state = legacy();
  state.invoices[0].administrativeId = "FAC-000100";
  const migrated = assignAdministrativeIds(state);
  expect(migrated.invoices[0].administrativeId).toBe("FAC-000100");
  expect(migrated.nextAdministrativeNumber).toBe(107);
  state.invoices[1].administrativeId = "FAC-000100";
  expect(() => assignAdministrativeIds(state)).toThrow(/duplicado/);
  state.invoices[1].administrativeId = "FAC-000000";
  expect(() => assignAdministrativeIds(state)).toThrow(/inválido/);
});
it("asigna automáticamente, ignora IDs propuestos y conserva código en aprobación, rechazo, búsqueda y CSV", () => {
  let state = addAdministrativeInvoice(assignAdministrativeIds(legacy()), {
    ...fresh(),
    administrativeId: "FAC-999999",
  });
  const invoice = state.invoices[0];
  const code = invoice.administrativeId!;
  expect(code).toBe("FAC-000008");
  expect(state.history[0].administrativeId).toBe(code);
  state = changeAdministrativeStatus(state, invoice.id, 0, "needs_review");
  const approved = changeAdministrativeStatus(state, invoice.id, 1, "approved");
  const rejected = changeAdministrativeStatus(
    state,
    invoice.id,
    1,
    "rejected",
    "Documento incorrecto",
  );
  for (const next of [approved, rejected]) {
    expect(next.invoices[0].administrativeId).toBe(code);
    expect(next.history[0].administrativeId).toBe(code);
    expect(readCsv(historyToCsv(next.history))[1][5]).toContain(code);
    expect(readCsv(invoicesToCsv(next.invoices))[1][0]).toBe(code);
    expect(matchesInvoiceSearch(next.invoices[0], code.toLowerCase())).toBe(
      true,
    );
  }
});
it("serializa registros concurrentes, conserva PDF e historial tras recarga y no reutiliza números eliminados", async () => {
  await transactState(legacy);
  const [a, b] = await Promise.all(
    ["00009001", "00009002"].map((number) =>
      transactState(legacy, (state, pdfs) => {
        const invoice = fresh(number);
        pdfs.put(new Blob(["pdf original"]), invoice.pdfStorageKey!);
        return addAdministrativeInvoice(state, invoice);
      }),
    ),
  );
  expect(a.invoices[0].administrativeId).not.toBe(
    b.invoices[0].administrativeId,
  );
  let state = await transactState(legacy);
  expect(state.invoices).toHaveLength(9);
  expect(
    state.history.filter((h) => h.invoiceId?.startsWith("new-")),
  ).toHaveLength(2);
  expect(await (await getPdfBlob("pdf-00009001"))!.text()).toBe("pdf original");
  expect(await transactState(legacy)).toEqual(state);
  const counter = state.nextAdministrativeNumber!;
  await transactState(legacy, (s) => ({ ...s, invoices: [] }));
  state = await transactState(legacy, (s) =>
    addAdministrativeInvoice(s, fresh("00009003")),
  );
  expect(state.invoices[0].administrativeId).toBe(
    `FAC-${String(counter).padStart(6, "0")}`,
  );
});
it("aborta cambios del identificador y conserva datos para recuperación", async () => {
  const before = await transactState(legacy);
  await expect(
    transactState(legacy, (s) => ({
      ...s,
      invoices: s.invoices.map((i, n) =>
        n ? i : { ...i, administrativeId: "FAC-999999" },
      ),
    })),
  ).rejects.toThrow(/modificar/);
  expect(await transactState(legacy)).toEqual(before);
});
it("el contador sobrevive al reemplazo del estado y no reutiliza números", async () => {
  const before = await transactState(legacy);
  await transactState(legacy, (s) => ({ ...s, invoices: [] }));
  const after = await transactState(legacy, () => legacy());
  expect(
    Math.min(
      ...after.invoices.map((i) => Number(i.administrativeId!.slice(4))),
    ),
  ).toBe(before.nextAdministrativeNumber);
});

it("rechaza agotamiento del contador sin escribir ni reutilizar códigos", () => {
  const state = legacy();
  state.invoices[0].administrativeId = "FAC-9007199254740991";
  expect(() => assignAdministrativeIds(state)).toThrow(/secuencia/);
});

it("migra estado v2 almacenado con siete PDFs sin modificar sus bytes ni la trazabilidad", async () => {
  const old = legacy();
  old.invoices = old.invoices.map((invoice, index) => ({ ...invoice, pdfStorageKey: `legacy-pdf-${index}` }));
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("mindlin-ai-demo", 2);
    open.onupgradeneeded = () => {
      open.result.createObjectStore("administrative-state");
      open.result.createObjectStore("pdf-files");
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(["administrative-state", "pdf-files"], "readwrite");
      tx.objectStore("administrative-state").put(old, "current");
      old.invoices.forEach((invoice, index) => tx.objectStore("pdf-files").put(new Blob([`PDF previo ${index}`]), invoice.pdfStorageKey!));
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => reject(tx.error);
    };
  });
  const migrated = await transactState(legacy);
  for (const [index, invoice] of migrated.invoices.entries()) {
    const {administrativeId, ...rest} = invoice;
    expect(rest).toEqual(old.invoices[index]);
    expect(await (await getPdfBlob(invoice.pdfStorageKey!))!.text()).toBe(`PDF previo ${index}`);
  }
  expect(migrated.history.map(({administrativeId, ...entry}) => entry)).toEqual(old.history);
  expect(await transactState(legacy)).toEqual(migrated);
});
