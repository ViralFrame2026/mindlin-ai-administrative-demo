import type { HistoryAction, InvoiceStatus } from "./types";
export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: "Pendiente",
  needs_review: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
};
export const ACTION_LABELS: Record<HistoryAction, string> = {
  seeded: "Datos preparados",
  uploaded: "Factura cargada",
  review_started: "Enviada a revisión",
  approved: "Aprobación",
  rejected: "Rechazo",
  rules_updated: "Reglas actualizadas",
  demo_reset: "Demo restaurada",
  retention_recalculated: "Recálculo explícito",
};
// Format legacy descriptions without modifying stored audit events.
export function traceDescription(description: string) {
  return description.replace(
    /:\s*(pending|needs_review|approved|rejected)\s*→\s*(pending|needs_review|approved|rejected)\./g,
    (_match, from: InvoiceStatus, to: InvoiceStatus) =>
      `: ${STATUS_LABELS[from]} → ${STATUS_LABELS[to]}.`,
  );
}
