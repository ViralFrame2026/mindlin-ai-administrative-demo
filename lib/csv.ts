import type { HistoryEntry, Invoice } from "./types";

import { STATUS_LABELS, ACTION_LABELS, traceDescription } from "./presentation";

function escapeCsv(value: string | number) {
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("No se puede exportar un importe inválido.");
    return value.toFixed(2).replace(".", ",");
  }
  const stringValue = String(value ?? "");
  const safeValue =
    /^[\s\u0000-\u001f\u007f\u200b-\u200f\u2060]*[=+\-@]/.test(stringValue) ||
    /^[\t\r\n]/.test(stringValue)
      ? `'${stringValue}`
      : stringValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function serializeCsv(headers: string[], rows: Array<Array<string | number>>) {
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\r\n") +
    "\r\n"
  );
}
function cuitText(value: string) {
  const digits = value.replace(/-/g, "");
  return /^\d{11}$/.test(digits)
    ? `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
    : value;
}
function receiptText(point: string, number: string) {
  return /^\d{1,5}$/.test(point) && /^\d{1,8}$/.test(number)
    ? `${point.padStart(4, "0")}-${number.padStart(8, "0")}`
    : `${point}-${number}`;
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
    invoice.administrativeId ?? "",
    receiptText(invoice.pointOfSale, invoice.number),
    invoice.type,
    invoice.issueDate,
    invoice.supplier.name,
    cuitText(invoice.supplier.cuit),
    invoice.amounts.net,
    invoice.amounts.vat,
    invoice.amounts.total,
    invoice.retentionTotal,
    STATUS_LABELS[invoice.status],
    invoice.rejectionReason ?? "",
    invoice.source === "demo" ? "Ejemplo ficticio" : "PDF cargado",
  ]);
  return serializeCsv(headers, rows);
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
    entry.administrativeId ? `${entry.administrativeId} · ${traceDescription(entry.description)}` : traceDescription(entry.description),
    entry.reason ?? "",
    entry.actor,
  ]);
  return serializeCsv(headers, rows);
}
