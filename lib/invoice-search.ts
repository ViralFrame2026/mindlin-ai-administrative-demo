import type { Invoice } from "./types";
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
export function matchesInvoiceSearch(invoice: Invoice, query: string) {
  const needle = normalize(query);
  if (!needle) return true;
  const fields = [
    invoice.supplier.name,
    invoice.supplier.cuit,
    invoice.number,
    invoice.pointOfSale,
    `${invoice.pointOfSale}-${invoice.number}`,
  ];
  if (fields.some((value) => normalize(value).includes(needle))) return true;
  if (
    /^\d{11}$/.test(needle) &&
    invoice.supplier.cuit.replace(/\D/g, "") === needle
  )
    return true;
  const combined = needle.match(/^(\d{1,5})\s*[-/]\s*(\d{1,8})$/);
  return Boolean(
    combined &&
      Number(combined[1]) === Number(invoice.pointOfSale) &&
      Number(combined[2]) === Number(invoice.number),
  );
}
