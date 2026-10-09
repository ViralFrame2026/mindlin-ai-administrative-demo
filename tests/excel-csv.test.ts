import { describe, expect, it } from "vitest";
import { invoicesToCsv, historyToCsv } from "../lib/csv";
import { DEMO_INVOICES } from "../lib/demo-data";
import { readCsv } from "./csv-reader";

describe("CSV regional argentino", () => {
  it("exporta siete registros, 13 columnas, BOM único y CRLF sin sep extra", () => {
    const invoices = Array.from({ length: 7 }, (_, i) => ({
      ...DEMO_INVOICES[i % 4],
      id: `ejemplo-${i}`,
    }));
    const csv = invoicesToCsv(invoices);
    const rows = readCsv(csv);
    expect([...new TextEncoder().encode(csv).slice(0, 3)]).toEqual([
      239, 187, 191,
    ]);
    expect(csv.match(/\uFEFF/g)).toHaveLength(1);
    expect(csv).not.toContain("sep=");
    expect(csv).toContain("\r\n");
    expect(rows).toHaveLength(8);
    rows.forEach((row) => expect(row).toHaveLength(13));
    expect(rows[0]).toEqual([
      "ID",
      "Comprobante",
      "Tipo",
      "Fecha",
      "Proveedor",
      "CUIT",
      "Neto",
      "IVA",
      "Total",
      "Retenciones demo",
      "Estado",
      "Motivo rechazo",
      "Origen",
    ]);
  });
  it("preserva identificadores sin fórmulas ni notación científica", () => {
    const row = readCsv(
      invoicesToCsv([
        {
          ...DEMO_INVOICES[0],
          pointOfSale: "4",
          number: "1842",
          supplier: { name: "Álvarez", cuit: "30715001239" },
        },
      ]),
    )[1];
    expect(row[1]).toBe("0004-00001842");
    expect(row[5]).toBe("30-71500123-9");
    expect(row[1]).not.toContain("=");
  });
  it("exporta importes positivos y negativos como números regionales utilizables", () => {
    const row = readCsv(
      invoicesToCsv([
        {
          ...DEMO_INVOICES[0],
          amounts: {
            net: -1000.5,
            vat: -210.11,
            total: -1210.61,
            currency: "ARS",
          },
          retentionTotal: 25.2,
        },
      ]),
    )[1];
    expect(row.slice(6, 10)).toEqual([
      "-1000,50",
      "-210,11",
      "-1210,61",
      "25,20",
    ]);
    expect(
      Number(row[6].replace(",", ".")) + Number(row[7].replace(",", ".")),
    ).toBeCloseTo(-1210.61);
    expect(invoicesToCsv(DEMO_INVOICES)).not.toContain('"1512500,00"');
  });
  it("preserva acentos, delimitadores, comillas y motivos multilínea", () => {
    const name = 'Álvarez, "Sur"; Ingeniería';
    const reason =
      "Falta remito; revisar\r\nSegunda línea, con acento: gestión";
    const row = readCsv(
      invoicesToCsv([
        {
          ...DEMO_INVOICES[0],
          supplier: { ...DEMO_INVOICES[0].supplier, name },
          rejectionReason: reason,
        },
      ]),
    )[1];
    expect(row[4]).toBe(name);
    expect(row[11]).toBe(reason);
    expect(row).toHaveLength(13);
  });
  it.each([
    "=1+1",
    "+SUM(A1)",
    "-1+2",
    "@SUM(A1)",
    " \t=1+1",
    "\u0000=1+1",
    "\u200b=1+1",
    "\u2060@SUM(A1)",
  ])("neutraliza texto no confiable %j sin alterar importes", (value) => {
    const row = readCsv(
      invoicesToCsv([
        {
          ...DEMO_INVOICES[0],
          supplier: { ...DEMO_INVOICES[0].supplier, name: value },
          rejectionReason: value,
        },
      ]),
    )[1];
    expect(row[4]).toBe(`'${value}`);
    expect(row[11]).toBe(`'${value}`);
    expect(row[6]).toBe("1250000,00");
  });
  it.each([NaN, Infinity, -Infinity])("rechaza importe no finito %s", (net) =>
    expect(() =>
      invoicesToCsv([
        { ...DEMO_INVOICES[0], amounts: { ...DEMO_INVOICES[0].amounts, net } },
      ]),
    ).toThrow(/inválido/),
  );
  it("historial comparte formato y estados en español", () => {
    const rows = readCsv(
      historyToCsv([
        {
          id: "x",
          action: "rejected",
          description: "Rechazo",
          actor: "María",
          timestamp: "2026-10-09T12:00:00Z",
          fromStatus: "needs_review",
          toStatus: "rejected",
          reason: "=1+1",
        },
      ]),
    );
    expect(rows[0]).toHaveLength(8);
    expect(rows[1][2]).toBe("En revisión");
    expect(rows[1][3]).toBe("Rechazada");
    expect(rows[1][6]).toBe("'=1+1");
  });
});
