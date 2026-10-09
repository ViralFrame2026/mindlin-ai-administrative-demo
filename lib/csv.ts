import type { HistoryEntry, Invoice } from "./types";

const statusLabels: Record<Invoice["status"], string> = {
  pending: "Pendiente",
  needs_review: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
};

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
    statusLabels[invoice.status],
    invoice.rejectionReason ?? "",
    invoice.source,
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function historyToCsv(history: HistoryEntry[]) {
  const headers = ["Fecha", "Acción", "Estado anterior", "Estado nuevo", "Comprobante", "Descripción", "Motivo", "Usuario"];
  const rows = history.map((entry) => [
    entry.timestamp,
    entry.action,
    entry.fromStatus ?? "",
    entry.toStatus ?? "",
    entry.invoiceNumber ?? "",
    entry.description,
    entry.reason ?? "",
    entry.actor,
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}
