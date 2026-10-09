import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { DEMO_INVOICES } from "../lib/demo-data";
import { invoiceData, validateInvoice } from "../lib/validation";
import { transitionInvoice } from "../lib/workflow";
import {
  initialState,
  addAdministrativeInvoice,
  changeAdministrativeStatus,
  changeAdministrativeRules,
  recalculateAdministrativeInvoice,
} from "../lib/administration";
import { transactState, getPdfBlob } from "../lib/storage";
import { parseArgentineAmount, analyzeInvoiceText } from "../lib/extraction";
import { DEFAULT_RETENTION_RULES } from "../lib/retention";

const base = () => structuredClone(initialState());
const valid = () => ({
  ...structuredClone(DEMO_INVOICES[0]),
  id: "new",
  number: "00009999",
  pdfHash: "newhash",
  pdfStorageKey: "newpdf",
});
describe("regresiones de integridad contable", () => {
  it.each([-100, NaN, Infinity, -Infinity])(
    "rechaza neto %s al guardar y aprobar aun con validación antigua limpia",
    (net) => {
      const invoice = {
        ...valid(),
        status: "needs_review" as const,
        amounts: { net, vat: 0, total: 121, currency: "ARS" as const },
      };
      expect(
        validateInvoice(invoiceData(invoice), []).errors.length,
      ).toBeGreaterThan(0);
      expect(() => addAdministrativeInvoice(base(), invoice)).toThrow();
      expect(() => transitionInvoice(invoice, "approved")).toThrow();
    },
  );
  it.each([
    { type: "XYZ" },
    { pointOfSale: "abc" },
    { pointOfSale: "0000" },
    { number: "abc" },
    { number: "00000000" },
    { issueDate: "2026-02-30" },
    { dueDate: "2020-01-01" },
  ])("rechaza campos inválidos %j", (fields) => {
    const invoice = { ...valid(), ...fields };
    expect(() => addAdministrativeInvoice(base(), invoice)).toThrow();
    expect(() =>
      transitionInvoice({ ...invoice, status: "needs_review" }, "approved"),
    ).toThrow();
  });
  it("bloquea inconsistencia y detecta duplicado sin ceros iniciales", () => {
    const invoice = valid();
    invoice.amounts.total += 100;
    expect(() => addAdministrativeInvoice(base(), invoice)).toThrow();
    expect(
      validateInvoice(
        { ...invoiceData(DEMO_INVOICES[0]), pointOfSale: "4", number: "1842" },
        DEMO_INVOICES,
      ).duplicate,
    ).toBe(true);
  });
});
describe("regresiones del extractor", () => {
  it.each([
    ["1.000", 1000],
    ["1.250.000", 1250000],
    ["1.000,50", 1000.5],
    ["1250,50", 1250.5],
    ["420000.50", 420000.5],
  ])("interpreta %s", (text, value) =>
    expect(parseArgentineAmount(String(text))).toBe(value),
  );
  it.each(["", "abc", "1.23.4", "12,345", "NaN", "Infinity", "1,234.56"])(
    "no convierte %s a cero",
    (value) => expect(() => parseArgentineAmount(value)).toThrow(),
  );
  it("excluye CUIT separado del receptor anterior al emisor", () => {
    expect(
      analyzeInvoiceText(
        "DATOS DEL RECEPTOR\nCUIT\n30-71234567-8\nDATOS DEL EMISOR\nCUIT\n30-71500123-9",
      ).data.supplierCuit,
    ).toBe("30-71500123-9");
  });
  it("no selecciona CUIT ambiguo y exige confirmación al guardar", () => {
    const result = analyzeInvoiceText(
      "CUIT: 30-71234567-8\nCUIT: 30-71500123-9",
    );
    expect(result.data.supplierCuit).toBe("");
    expect(result.warnings.join()).toMatch(/manual/);
    expect(() =>
      addAdministrativeInvoice(base(), {
        ...valid(),
        extractionWarnings: result.warnings,
      }),
    ).toThrow(/Confirmá/);
    expect(
      addAdministrativeInvoice(base(), {
        ...valid(),
        extractionWarnings: result.warnings,
        extractionConfirmed: true,
      }).invoices[0].extractionWarnings,
    ).toEqual(result.warnings);
  });
  it("no duplica IVA de resumen repetido entre páginas", () => {
    // Raw pdf2json order is reversed within each page.
    const page = "Importe Total: 121,00\nIVA 21%: 21,00\nImporte Neto: 100,00";
    const data = analyzeInvoiceText(
      `${page}\n----------------Page (1) Break----------------\n${page}\n----------------Page (2) Break----------------`,
    ).data;
    expect(data).toMatchObject({ net: 100, vat: 21, total: 121 });
  });
  it("mantiene dos conceptos legítimos con IVA igual", () => {
    expect(
      analyzeInvoiceText("Concepto 1 IVA 21%: 21,00\nConcepto 2 IVA 21%: 21,00")
        .data.vat,
    ).toBe(42);
  });
  it("prefiere resumen fiscal a detalle y advierte incoherencia", () => {
    const result = analyzeInvoiceText(
      "Importe Total: 121\nIVA 21%: 21\nImporte Neto: 100\n----------------Page (1) Break----------------\nConcepto IVA 21%: 21\n----------------Page (2) Break----------------",
    );
    expect(result.data.vat).toBe(21);
    expect(
      analyzeInvoiceText("Neto: 100\nIVA 21%: 42\nTotal: 121").warnings.join(),
    ).toMatch(/coherentes/);
  });
});
describe("retenciones versionadas", () => {
  it.each([150, -1, NaN, Infinity])("rechaza alícuota %s", (rate) =>
    expect(() =>
      changeAdministrativeRules(
        base(),
        [{ ...DEFAULT_RETENTION_RULES[0], rate }],
        1,
      ),
    ).toThrow(),
  );
  it("conserva aprobadas y audita recálculo explícito con motivo", () => {
    const old = base();
    const approved = old.invoices.find((item) => item.status === "approved")!;
    const next = changeAdministrativeRules(
      old,
      old.rules.map((rule) => ({ ...rule, rate: 10 })),
      1,
    );
    expect(next.rulesVersion).toBe(2);
    expect(next.invoices).toEqual(old.invoices);
    expect(() =>
      recalculateAdministrativeInvoice(next, approved.id, 0, ""),
    ).toThrow();
    const recalculated = recalculateAdministrativeInvoice(
      next,
      approved.id,
      0,
      "Nueva simulación solicitada",
    );
    expect(
      recalculated.invoices.find((item) => item.id === approved.id)!
        .retentionTotal,
    ).not.toBe(approved.retentionTotal);
    expect(recalculated.history[0]).toMatchObject({
      action: "retention_recalculated",
      reason: "Nueva simulación solicitada",
      before: { total: approved.retentionTotal },
      after: { version: 2 },
    });
    expect(approved.retentionTotal).toBe(14050);
  });
});
describe("transacciones, concurrencia y migración", () => {
  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("mindlin-ai-demo");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
  it("migra sin alterar estados finales ni descartar datos inválidos", () => {
    const original = base();
    const legacy = {
      getItem: (key: string) =>
        JSON.stringify(
          key.includes("invoices")
            ? original.invoices
            : key.includes("rules")
              ? original.rules
              : original.history,
        ),
    };
    expect(initialState(legacy).invoices.map((item) => item.status)).toEqual(
      original.invoices.map((item) => item.status),
    );
    expect(() => initialState({ getItem: () => "{}" })).toThrow(/migrar/);
  });
  it("serializa dos operaciones y conserva ambos eventos al recargar", async () => {
    const seed = base();
    const pending = seed.invoices.find((item) => item.status === "pending")!;
    const review = seed.invoices.find(
      (item) => item.status === "needs_review",
    )!;
    await Promise.all([
      transactState(base, (state) =>
        changeAdministrativeStatus(state, pending.id, 0, "needs_review"),
      ),
      transactState(base, (state) =>
        changeAdministrativeStatus(
          state,
          review.id,
          0,
          "rejected",
          "Falta remito",
        ),
      ),
    ]);
    const loaded = await transactState(base);
    expect(loaded.invoices.find((item) => item.id === pending.id)!.status).toBe(
      "needs_review",
    );
    expect(loaded.invoices.find((item) => item.id === review.id)!.status).toBe(
      "rejected",
    );
    expect(
      loaded.history
        .slice(0, 2)
        .map((item) => item.action)
        .sort(),
    ).toEqual(["rejected", "review_started"]);
  });
  it("detecta decisiones incompatibles sobre la misma revisión", async () => {
    const id = base().invoices.find(
      (item) => item.status === "needs_review",
    )!.id;
    const results = await Promise.allSettled([
      transactState(base, (state) =>
        changeAdministrativeStatus(state, id, 0, "approved"),
      ),
      transactState(base, (state) =>
        changeAdministrativeStatus(state, id, 0, "rejected", "Falta remito"),
      ),
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(
      1,
    );
  });
  it("revierte PDF, factura e historial juntos al abortar", async () => {
    await transactState(base);
    const invoice = valid();
    await expect(
      transactState(base, (state, pdfs) => {
        pdfs.put(new Blob(["PDF"]), invoice.pdfStorageKey!);
        addAdministrativeInvoice(state, invoice);
        throw new Error("interrupción");
      }),
    ).rejects.toThrow();
    expect(await getPdfBlob(invoice.pdfStorageKey!)).toBeUndefined();
    expect((await transactState(base)).invoices).toHaveLength(4);
  });
});
