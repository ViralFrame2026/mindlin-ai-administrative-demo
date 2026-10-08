import type { HistoryEntry, Invoice } from "./types";

function escapeCsv(value: unknown) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export function invoicesToCsv(invoices: Invoice[]) {
  const headers = [
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
    "Origen",
  ];
  const rows = invoices.map((invoice) => [
    invoice.id,
    `${invoice.pointOfSale}-${invoice.number}`,
    invoice.type,
    invoice.issueDate,
    invoice.supplier.name,
    invoice.supplier.cuit,
    invoice.amounts.net.toFixed(2),
    invoice.amounts.vat.toFixed(2),
    invoice.amounts.total.toFixed(2),
    invoice.retentionTotal.toFixed(2),
    invoice.status,
    invoice.source,
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function historyToCsv(history: HistoryEntry[]) {
  const headers = ["Fecha", "Acción", "Comprobante", "Descripción", "Usuario"];
  const rows = history.map((entry) => [
    entry.timestamp,
    entry.action,
    entry.invoiceNumber ?? "",
    entry.description,
    entry.actor,
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}
