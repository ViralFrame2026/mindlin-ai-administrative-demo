import type { ExtractedInvoiceData, Invoice, ValidationResult } from "./types";

export function normalizeCuit(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCuit(value: string) {
  const digits = normalizeCuit(value);
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export function isValidCuit(value: string) {
  const digits = normalizeCuit(value);
  if (!/^\d{11}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  let verifier = 11 - (sum % 11);
  if (verifier === 11) verifier = 0;
  if (verifier === 10) verifier = 9;
  return verifier === Number(digits[10]);
}

export function invoiceBusinessKey(data: Pick<ExtractedInvoiceData, "supplierCuit" | "pointOfSale" | "number">) {
  return `${normalizeCuit(data.supplierCuit)}:${data.pointOfSale.replace(/\D/g, "")}:${data.number.replace(/\D/g, "")}`;
}

export function invoiceKey(invoice: Invoice) {
  return invoiceBusinessKey({
    supplierCuit: invoice.supplier.cuit,
    pointOfSale: invoice.pointOfSale,
    number: invoice.number,
  });
}

export function findDuplicate(
  data: ExtractedInvoiceData,
  invoices: Invoice[],
  pdfHash?: string,
) {
  const key = invoiceBusinessKey(data);
  return invoices.find(
    (invoice) => (pdfHash && invoice.pdfHash === pdfHash) || invoiceKey(invoice) === key,
  );
}

export function validateInvoice(
  data: ExtractedInvoiceData,
  invoices: Invoice[],
  pdfHash?: string,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cuitValid = isValidCuit(data.supplierCuit);
  const tolerance = 0.02;
  const amountConsistent =
    data.net >= 0 && data.vat >= 0 && data.total > 0 && Math.abs(data.net + data.vat - data.total) <= tolerance;
  const duplicate = findDuplicate(data, invoices, pdfHash);

  if (!data.supplierName.trim()) errors.push("No se pudo identificar la razón social del proveedor.");
  if (!cuitValid) errors.push("El CUIT no supera la validación de dígito verificador.");
  if (!data.number.trim()) errors.push("No se pudo identificar el número de comprobante.");
  if (!data.issueDate) errors.push("No se pudo identificar la fecha de emisión.");
  if (data.total <= 0) errors.push("El importe total debe ser mayor que cero.");
  if (!amountConsistent) warnings.push("El neto más IVA no coincide con el total informado.");
  if (duplicate) warnings.push(`Posible duplicado de ${duplicate.number} (${duplicate.supplier.name}).`);

  return {
    cuitValid,
    amountConsistent,
    duplicate: Boolean(duplicate),
    duplicateOf: duplicate?.id,
    errors,
    warnings,
  };
}
