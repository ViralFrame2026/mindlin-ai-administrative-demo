import { describe, expect, it } from "vitest";
import { parseArgentineAmount, parseInvoiceText } from "../lib/extraction";
import { calculateRetentions, DEFAULT_RETENTION_RULES } from "../lib/retention";
import type { Invoice } from "../lib/types";
import { isValidCuit, validateInvoice } from "../lib/validation";

describe("validación de CUIT", () => {
  it("acepta CUIT ficticios con dígito verificador correcto", () => {
    expect(isValidCuit("30-71654321-4")).toBe(true);
    expect(isValidCuit("27-23456789-1")).toBe(true);
  });

  it("rechaza CUIT con dígito incorrecto o repetido", () => {
    expect(isValidCuit("30-71654321-5")).toBe(false);
    expect(isValidCuit("11-11111111-1")).toBe(false);
  });
});

describe("extracción estructurada", () => {
  const text = `
    FACTURA A
    Proveedor: Servicios Norte S.A.
    CUIT: 30-71654321-4
    Comprobante Nro: 0001-00001234
    Fecha de emision: 02/10/2026
    Fecha de vencimiento: 17/10/2026
    Importe Neto Gravado: $ 825.000,00
    IVA 21 %: $ 173.250,00
    Importe Total: $ 998.250,00
  `;

  it("interpreta importes en formato argentino", () => {
    expect(parseArgentineAmount("$ 1.234.567,89")).toBe(1_234_567.89);
    expect(parseArgentineAmount("420000.50")).toBe(420_000.5);
  });

  it("extrae campos de una factura digital", () => {
    expect(parseInvoiceText(text)).toEqual({
      number: "00001234", type: "A", pointOfSale: "0001", issueDate: "2026-10-02", dueDate: "2026-10-17",
      supplierName: "Servicios Norte S.A.", supplierCuit: "30-71654321-4", net: 825_000, vat: 173_250, total: 998_250,
    });
  });
});

describe("validaciones de factura", () => {
  const data = { number: "00001234", type: "A", pointOfSale: "0001", issueDate: "2026-10-02", supplierName: "Servicios Norte S.A.", supplierCuit: "30-71654321-4", net: 825_000, vat: 173_250, total: 998_250 };

  it("detecta duplicados por CUIT, punto de venta y número", () => {
    const existing = [{ id: "existing", number: data.number, pointOfSale: data.pointOfSale, supplier: { name: data.supplierName, cuit: data.supplierCuit } }] as Invoice[];
    const result = validateInvoice(data, existing);
    expect(result.duplicate).toBe(true);
    expect(result.duplicateOf).toBe("existing");
  });

  it("advierte si neto e IVA no coinciden con el total", () => {
    const result = validateInvoice({ ...data, total: 900_000 }, []);
    expect(result.amountConsistent).toBe(false);
    expect(result.warnings).toContain("El neto más IVA no coincide con el total informado.");
  });
});

describe("motor demostrativo de retenciones", () => {
  it("aplica mínimo no sujeto y alícuota configurada", () => {
    const result = calculateRetentions({ net: 825_000, vat: 173_250, total: 998_250, currency: "ARS" }, DEFAULT_RETENTION_RULES);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({ base: 725_000, rate: 2, amount: 14_500 });
    expect(result.total).toBe(26_125);
  });
});
