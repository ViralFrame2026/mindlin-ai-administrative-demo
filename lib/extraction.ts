import type { ExtractedInvoiceData } from "./types";
import { formatCuit } from "./validation";

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

export function parseArgentineAmount(value: string) {
  const clean = value.replace(/[$\s]/g, "").replace(/[^\d,.-]/g, "");
  if (!clean) return 0;
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  let normalized = clean;
  if (lastComma > lastDot) {
    normalized = clean.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && lastComma >= 0) {
    normalized = clean.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = clean.replace(",", ".");
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

export function parseDate(value: string) {
  const match = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseInvoiceText(rawText: string): ExtractedInvoiceData {
  const text = rawText.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
  const cuit = firstMatch(text, [/(?:CUIT|C\.U\.I\.T\.)\s*(?:N[°ºo]\.?|:)??\s*([0-9]{2}[-\s]?[0-9]{8}[-\s]?[0-9])/i]);
  const combinedNumber = firstMatch(text, [
    /(?:Comprobante|Factura)\s*(?:N(?:ro|°|º)?\.?|número)?\s*:?\s*([0-9]{4,5})[-\s]([0-9]{6,8})/i,
  ]);
  const combinedMatch = text.match(/(?:Comprobante|Factura)\s*(?:N(?:ro|°|º)?\.?|número)?\s*:?\s*([0-9]{4,5})[-\s]([0-9]{6,8})/i);
  const pointOfSale = combinedMatch?.[1] ?? firstMatch(text, [/(?:Punto de Venta|Pto\. Venta)\s*:?\s*([0-9]{1,5})/i]);
  const number = combinedMatch?.[2] ?? combinedNumber;
  const issueDateRaw = firstMatch(text, [/(?:Fecha de emisi[oó]n|Fecha)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i]);
  const dueDateRaw = firstMatch(text, [/(?:Fecha de vencimiento|Vencimiento)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i]);
  const supplierName = firstMatch(text, [
    /(?:Raz[oó]n Social|Proveedor|Emisor)\s*:?\s*([^\n\r]+)/i,
  ]).replace(/\s+(?:CUIT|Domicilio|Condici[oó]n).*$/i, "").trim();
  const invoiceType = firstMatch(text, [/(?:FACTURA|Tipo de comprobante)\s*:?\s*([ABC])/i]) || "A";
  const netRaw = firstMatch(text, [/(?:Importe Neto(?: Gravado)?|Subtotal|Neto)\s*:?\s*\$?\s*([\d.,]+)/i]);
  const vatRaw = firstMatch(text, [/(?:IVA(?:\s+21\s*%)?|Importe IVA)\s*:?\s*\$?\s*([\d.,]+)/i]);
  const totalRaw = firstMatch(text, [/(?:Importe Total|TOTAL)\s*:?\s*\$?\s*([\d.,]+)/i]);

  return {
    number,
    type: invoiceType.toUpperCase(),
    pointOfSale: pointOfSale.padStart(4, "0"),
    issueDate: parseDate(issueDateRaw),
    dueDate: dueDateRaw ? parseDate(dueDateRaw) : undefined,
    supplierName,
    supplierCuit: formatCuit(cuit),
    net: parseArgentineAmount(netRaw),
    vat: parseArgentineAmount(vatRaw),
    total: parseArgentineAmount(totalRaw),
  };
}
