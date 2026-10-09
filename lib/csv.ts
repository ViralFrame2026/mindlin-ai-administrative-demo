import type { HistoryEntry, Invoice } from "./types";

import { STATUS_LABELS, ACTION_LABELS, traceDescription } from "./presentation";

function escapeCsv(value: unknown) {
  const stringValue = String(value ?? "");
  const safeValue =
    /^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(stringValue) ||
    /^[\t\r\n]/.test(stringValue)
      ? `'${stringValue}`
      : stringValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
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
    "Motivo rechazo",
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
    STATUS_LABELS[invoice.status],
    invoice.rejectionReason ?? "",
    invoice.source === "demo" ? "Ejemplo ficticio" : "PDF cargado",
  ]);
  return [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");
}

export function historyToCsv(history: HistoryEntry[]) {
  const headers = [
    "Fecha",
    "Acción",
    "Estado anterior",
    "Estado nuevo",
    "Comprobante",
    "Descripción",
    "Motivo",
    "Usuario",
  ];
  const rows = history.map((entry) => [
    entry.timestamp,
    ACTION_LABELS[entry.action],
    entry.fromStatus ? STATUS_LABELS[entry.fromStatus] : "",
    entry.toStatus ? STATUS_LABELS[entry.toStatus] : "",
    entry.invoiceNumber ?? "",
    traceDescription(entry.description),
    entry.reason ?? "",
    entry.actor,
  ]);
  return [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");
}
