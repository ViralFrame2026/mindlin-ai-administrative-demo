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
  const sum = weights.reduce(
    (total, weight, index) => total + Number(digits[index]) * weight,
    0,
  );
  let verifier = 11 - (sum % 11);
  if (verifier === 11) verifier = 0;
  if (verifier === 10) verifier = 9;
  return verifier === Number(digits[10]);
}

export function invoiceBusinessKey(
  data: Pick<ExtractedInvoiceData, "supplierCuit" | "pointOfSale" | "number">,
) {
  return `${normalizeCuit(data.supplierCuit)}:${String(Number(data.pointOfSale))}:${String(Number(data.number))}`;
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
    (invoice) =>
      (pdfHash && invoice.pdfHash === pdfHash) || invoiceKey(invoice) === key,
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
  const finiteAmounts = [data.net, data.vat, data.total].every(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
  const amountConsistent =
    finiteAmounts &&
    data.net >= 0 &&
    data.vat >= 0 &&
    data.total > 0 &&
    Math.abs(data.net + data.vat - data.total) <= tolerance;
  const duplicate = findDuplicate(data, invoices, pdfHash);

  if (!data.supplierName.trim())
    errors.push("No se pudo identificar la razón social del proveedor.");
  if (!cuitValid)
    errors.push("El CUIT no supera la validación de dígito verificador.");
  if (!/^[ABCEMT]$/.test(data.type))
    errors.push("No se pudo identificar el tipo de comprobante.");
  if (!/^\d{1,5}$/.test(data.pointOfSale) || Number(data.pointOfSale) === 0)
    errors.push("No se pudo identificar el punto de venta.");
  if (!/^\d{1,8}$/.test(data.number) || Number(data.number) === 0)
    errors.push("No se pudo identificar el número de comprobante.");
  if (!isValidIsoDate(data.issueDate))
    errors.push("No se pudo identificar la fecha de emisión.");
  if (
    data.dueDate &&
    (!isValidIsoDate(data.dueDate) || data.dueDate < data.issueDate)
  )
    errors.push(
      "El vencimiento debe ser válido y posterior o igual a la emisión.",
    );
  if (!finiteAmounts || data.net < 0 || data.vat < 0)
    errors.push("Los importes deben ser números finitos no negativos.");
  if (data.total <= 0) errors.push("El importe total debe ser mayor que cero.");
  if (!amountConsistent)
    errors.push(
      "La consistencia contable es obligatoria para guardar y aprobar.",
    );
  if (!amountConsistent)
    warnings.push("El neto más IVA no coincide con el total informado.");
  if (duplicate)
    warnings.push(
      `Posible duplicado de ${duplicate.number} (${duplicate.supplier.name}).`,
    );

  return {
    cuitValid,
    amountConsistent,
    duplicate: Boolean(duplicate),
    duplicateOf: duplicate?.id,
    errors,
    warnings,
  };
}

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    Number(value.slice(0, 4)) >= 1900
  );
}
export function invoiceData(invoice: Invoice): ExtractedInvoiceData {
  return {
    number: invoice.number,
    type: invoice.type,
    pointOfSale: invoice.pointOfSale,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    supplierName: invoice.supplier.name,
    supplierCuit: invoice.supplier.cuit,
    ...invoice.amounts,
  };
}
