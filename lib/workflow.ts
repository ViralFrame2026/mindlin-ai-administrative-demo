import { STATUS_LABELS } from "./presentation";
import { invoiceData, validateInvoice } from "./validation";
import type { Invoice, InvoiceStatus } from "./types";

export interface TransitionValidation {
  allowed: boolean;
  error?: string;
}

const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  pending: ["needs_review"],
  needs_review: ["approved", "rejected"],
  approved: [],
  rejected: [],
};

export function initializeInvoiceWorkflow(invoice: Invoice): Invoice {
  return { ...invoice, status: "pending", rejectionReason: undefined };
}

export function validateStatusTransition(
  invoice: Invoice,
  target: InvoiceStatus,
  reason?: string,
): TransitionValidation {
  if (!ALLOWED_TRANSITIONS[invoice.status].includes(target)) {
    return {
      allowed: false,
      error: `No se permite cambiar una factura ${STATUS_LABELS[invoice.status]} a ${STATUS_LABELS[target]}.`,
    };
  }

  const fresh = validateInvoice(invoiceData(invoice), []);
  if (
    target === "approved" &&
    (fresh.errors.length > 0 ||
      invoice.validation.errors.length > 0 ||
      invoice.validation.duplicate ||
      (invoice.extractionWarnings?.length && !invoice.extractionConfirmed))
  ) {
    return {
      allowed: false,
      error:
        "La factura no puede aprobarse mientras tenga errores críticos o sea un duplicado.",
    };
  }

  if (target === "rejected" && !reason?.trim()) {
    return { allowed: false, error: "El motivo de rechazo es obligatorio." };
  }

  return { allowed: true };
}

export function transitionInvoice(
  invoice: Invoice,
  target: InvoiceStatus,
  reason?: string,
  timestamp = new Date().toISOString(),
): Invoice {
  const validation = validateStatusTransition(invoice, target, reason);
  if (!validation.allowed) throw new Error(validation.error);

  return {
    ...invoice,
    status: target,
    rejectionReason: target === "rejected" ? reason?.trim() : undefined,
    updatedAt: timestamp,
  };
}
