import { describe, expect, it } from "vitest";
import { analyzeInvoiceText, parseArgentineAmount, parseInvoiceText } from "../lib/extraction";
import { calculateRetentions, DEFAULT_RETENTION_RULES } from "../lib/retention";
import { DEMO_INVOICES } from "../lib/demo-data";
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

  it("prioriza los datos del emisor y admite comprobante en campos separados", () => {
    const analysis = analyzeInvoiceText(`
      FACTURA A
      DATOS DEL RECEPTOR
      Razón Social: Desarrolladora Receptora S.A.
      CUIT: 30-71234567-8
      DATOS DEL EMISOR
      Razón Social: Mantenimiento Integral S.A.
      CUIT: 30-71654321-4
      Punto de Venta: 0004
      Comp. Nro: 00001842
      Fecha de emisión: 03/10/2026
      Total Neto: $ 360.000,00
      Importe IVA: $ 75.600,00
      Total a Pagar: $ 435.600,00
    `);
    expect(analysis.data).toMatchObject({
      supplierName: "Mantenimiento Integral S.A.",
      supplierCuit: "30-71654321-4",
      pointOfSale: "0004",
      number: "00001842",
      net: 360_000,
      vat: 75_600,
      total: 435_600,
    });
  });

  it("no inventa el tipo cuando falta y advierte sobre valores ambiguos", () => {
    const analysis = analyzeInvoiceText(`
      Proveedor: Servicios Demo S.A.
      CUIT: 30-71654321-4
      Comprobante Nro: 0004-00001842
      Comprobante Nro: 0004-00001843
      Fecha: 03/10/2026
      Importe Neto: 100,00
      IVA 21 %: 21,00
      Importe Total: 121,00
    `);
    expect(analysis.data.type).toBe("");
    expect(analysis.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("varios números"),
      expect.stringContaining("tipo de comprobante"),
    ]));
  });

  it("suma alícuotas de IVA cuando no hay un total de IVA informado", () => {
    const analysis = analyzeInvoiceText(`
      FACTURA A
      Proveedor: Servicios Demo S.A.
      CUIT: 30-71654321-4
      Comprobante Nro: 0004-00001842
      Fecha de emisión: 03/10/2026
      Importe Neto Gravado: 300.000,00
      IVA 21 %: 42.000,00
      IVA 10,5 %: 10.500,00
      Importe Total: 352.500,00
    `);
    expect(analysis.data.vat).toBe(52_500);
    expect(analysis.data.net + analysis.data.vat).toBe(analysis.data.total);
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

  it.each(DEMO_INVOICES)("mantiene matemáticamente válido el ejemplo $id", (invoice) => {
    const result = validateInvoice({
      number: invoice.number,
      type: invoice.type,
      pointOfSale: invoice.pointOfSale,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      supplierName: invoice.supplier.name,
      supplierCuit: invoice.supplier.cuit,
      net: invoice.amounts.net,
      vat: invoice.amounts.vat,
      total: invoice.amounts.total,
    }, []);
    expect(result.errors).toEqual([]);
    expect(result.amountConsistent).toBe(true);
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
