import { describe, expect, it } from "vitest";
import type { Invoice } from "../lib/types";
import { initializeInvoiceWorkflow, transitionInvoice, validateStatusTransition } from "../lib/workflow";

function invoice(status: Invoice["status"]): Invoice {
  return {
    id: "invoice-test",
    number: "00001842",
    type: "A",
    pointOfSale: "0004",
    issueDate: "2026-10-06",
    supplier: { name: "Construcciones Andinas S.A.", cuit: "30-71500123-9" },
    amounts: { net: 100, vat: 21, total: 121, currency: "ARS" },
    status,
    source: "uploaded",
    pdfName: "factura.pdf",
    pdfSize: 100,
    pages: 1,
    createdAt: "2026-10-09T10:00:00.000Z",
    updatedAt: "2026-10-09T10:00:00.000Z",
    validation: { cuitValid: true, amountConsistent: true, duplicate: false, errors: [], warnings: [] },
    retentionLines: [],
    retentionTotal: 0,
  };
}

describe("circuito administrativo", () => {
  it("inicializa toda factura nueva como Pendiente", () => {
    const newInvoice = initializeInvoiceWorkflow({ ...invoice("approved"), rejectionReason: "estado previo" });
    expect(newInvoice.status).toBe("pending");
    expect(newInvoice.rejectionReason).toBeUndefined();
  });

  it("recorre Pendiente → En revisión → Aprobada", () => {
    const underReview = transitionInvoice(invoice("pending"), "needs_review", undefined, "2026-10-09T11:00:00.000Z");
    expect(underReview.status).toBe("needs_review");
    const approved = transitionInvoice(underReview, "approved", undefined, "2026-10-09T12:00:00.000Z");
    expect(approved).toMatchObject({ status: "approved", updatedAt: "2026-10-09T12:00:00.000Z" });
  });

  it("impide saltar revisión o reabrir una decisión final", () => {
    expect(validateStatusTransition(invoice("pending"), "approved").allowed).toBe(false);
    expect(validateStatusTransition(invoice("approved"), "needs_review").allowed).toBe(false);
    expect(() => transitionInvoice(invoice("pending"), "rejected", "motivo")).toThrow(/No se permite/);
  });

  it("exige motivo para rechazar y lo conserva", () => {
    expect(validateStatusTransition(invoice("needs_review"), "rejected").error).toMatch(/obligatorio/);
    const rejected = transitionInvoice(invoice("needs_review"), "rejected", "Falta el remito conformado.");
    expect(rejected).toMatchObject({ status: "rejected", rejectionReason: "Falta el remito conformado." });
  });

  it("bloquea la aprobación de un duplicado", () => {
    const duplicate = invoice("needs_review");
    duplicate.validation.duplicate = true;
    expect(validateStatusTransition(duplicate, "approved").error).toMatch(/duplicado/);
  });
});
