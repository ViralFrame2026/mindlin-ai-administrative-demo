import { describe, expect, it } from "vitest";
import { DEMO_INVOICES } from "../lib/demo-data";
import { invoicesToCsv, historyToCsv } from "../lib/csv";
import { matchesInvoiceSearch } from "../lib/invoice-search";
import { traceDescription } from "../lib/presentation";
import { validateStatusTransition } from "../lib/workflow";

describe("CSV administrativo seguro", () => {
  it.each([
    "=1+1",
    "+SUM(A1)",
    "-1+2",
    "@SUM(A1)",
    "  =1+1",
    "\t=1+1",
    "\rtexto",
    "\ntexto",
  ])("neutraliza %j en proveedor, motivo y trazabilidad", (value) => {
    const invoice = {
      ...DEMO_INVOICES[0],
      supplier: { ...DEMO_INVOICES[0].supplier, name: value },
      rejectionReason: value,
    };
    expect(invoicesToCsv([invoice])).toContain(`"'${value}"`);
    expect(
      historyToCsv([
        {
          id: "1",
          action: "rejected",
          description: value,
          reason: value,
          timestamp: "2026-10-09T12:00:00Z",
          actor: value,
        },
      ]),
    ).toContain(`"'${value}"`);
  });
  it("conserva comillas, comas, importes y estados legibles", () => {
    const csv = invoicesToCsv([
      {
        ...DEMO_INVOICES[0],
        supplier: {
          ...DEMO_INVOICES[0].supplier,
          name: 'Servicios "Sur", S.A.',
        },
      },
    ]);
    expect(csv).toContain('"Servicios ""Sur"", S.A."');
    expect(csv).toContain(';1512500,00;');
    expect(csv).toContain('"Pendiente"');
    const history = historyToCsv([
      {
        id: "1",
        action: "review_started",
        description: "Factura 0004-00001842: pending → needs_review.",
        timestamp: "2026-10-09T12:00:00Z",
        actor: "Usuario demo",
        fromStatus: "pending",
        toStatus: "needs_review",
      },
    ]);
    expect(history).toContain('"Enviada a revisión"');
    expect(history).toContain('"En revisión"');
    expect(history).not.toContain("needs_review");
  });
});
describe("búsqueda y español sin alterar datos", () => {
  it.each([
    "0004-00001842",
    "4-1842",
    "0004 / 00001842",
    "30715001239",
    "CONSTRUCCIONES ANDINAS",
  ])("encuentra %s", (query) =>
    expect(matchesInvoiceSearch(DEMO_INVOICES[0], query)).toBe(true),
  );
  it("no combina campos independientes para producir falsos resultados", () =>
    expect(matchesInvoiceSearch(DEMO_INVOICES[0], "otro proveedor")).toBe(
      false,
    ));
  it("presenta un evento antiguo sin reescribirlo", () => {
    const original = "Factura 0004-00001842: pending → needs_review.";
    expect(traceDescription(original)).toBe(
      "Factura 0004-00001842: Pendiente → En revisión.",
    );
    expect(original).toContain("needs_review");
  });
  it("no expone estados internos en errores de transición", () => {
    const result = validateStatusTransition(DEMO_INVOICES[0], "approved");
    expect(result.error).toContain("Pendiente");
    expect(result.error).toContain("Aprobada");
    expect(result.error).not.toContain("pending");
  });
});
