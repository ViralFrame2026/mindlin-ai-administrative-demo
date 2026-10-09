import type { ExtractedInvoiceData } from "./types";
import { formatCuit } from "./validation";

interface Candidate {
  value: string;
  score: number;
  context: string;
}

export interface InvoiceTextAnalysis {
  data: ExtractedInvoiceData;
  warnings: string[];
}

function uniqueCandidates(candidates: Candidate[]) {
  return candidates.filter(
    (candidate, index) =>
      candidates.findIndex((other) => other.value === candidate.value) ===
      index,
  );
}

function chooseCandidate(
  candidates: Candidate[],
  field: string,
  warnings: string[],
) {
  const unique = uniqueCandidates(
    [...candidates].sort((left, right) => right.score - left.score),
  );
  if (!unique.length) return "";
  const selected = unique[0];
  const competing = unique.filter(
    (candidate) =>
      candidate.value !== selected.value &&
      candidate.score >= selected.score - 10,
  );
  if (competing.length) {
    warnings.push(
      `Se detectaron valores ambiguos para ${field}. Confirmación manual obligatoria.`,
    );
    return "";
  }
  return selected.value;
}

function normalizeDocumentLines(rawText: string) {
  const clean = rawText.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
  const rawLines = clean
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // pdf2json entrega cada página desde el pie hacia el encabezado. Invertir únicamente
  // cuando está presente su marcador conserva el orden normal en textos de otros orígenes.
  if (!rawLines.some((line) => /^-+Page \(\d+\) Break-+$/i.test(line)))
    return rawLines;

  const pages: string[][] = [[]];
  for (const line of rawLines) {
    if (/^-+Page \(\d+\) Break-+$/i.test(line)) pages.push([]);
    else pages[pages.length - 1].push(line);
  }
  return pages.flatMap((page, index) => [
    ...(index ? ["__PAGE_BREAK__"] : []),
    ...page.reverse(),
  ]);
}

function sectionForLine(lines: string[], index: number) {
  let section: "issuer" | "receiver" | "unknown" = "unknown";
  for (let cursor = 0; cursor <= index; cursor += 1) {
    const line = lines[cursor];
    if (line === "__PAGE_BREAK__") section = "unknown";
    if (
      /(?:datos\s+del\s+)?(?:emisor|proveedor)/i.test(line) &&
      !/(?:cuit|raz[oó]n social)\s+del?\s+emisor/i.test(line)
    ) {
      section = "issuer";
    }
    if (/(?:datos\s+del\s+)?(?:receptor|cliente|destinatario)/i.test(line))
      section = "receiver";
    if (
      /^(?:detalle|conceptos?|descripci[oó]n|items?|totales?|importes?)\b/i.test(
        line,
      )
    )
      section = "unknown";
  }
  return section;
}

function followingValue(lines: string[], index: number) {
  const next = lines[index + 1]?.trim() ?? "";
  return /^(?:datos|emisor|receptor|cliente|domicilio|cuit|condici[oó]n|fecha|punto|comprobante)\b/i.test(
    next,
  )
    ? ""
    : next;
}

function collectSupplierNames(lines: string[]) {
  const candidates: Candidate[] = [];
  lines.forEach((line, index) => {
    const explicit = line.match(
      /^(?:raz[oó]n\s+social\s+(?:del\s+)?emisor|emisor|proveedor)\s*:?\s*(.*)$/i,
    );
    const generic = line.match(
      /^(?:apellido\s+y\s+nombre\s*\/\s*)?raz[oó]n\s+social\s*:?\s*(.*)$/i,
    );
    const match = explicit ?? generic;
    if (!match) return;
    const section = sectionForLine(lines, index);
    const value = (match[1] || followingValue(lines, index))
      .replace(/\s+(?:CUIT|Domicilio|Condici[oó]n|Ingresos Brutos).*$/i, "")
      .trim();
    if (!value || /^(?:emisor|receptor|cliente|proveedor)$/i.test(value))
      return;
    const receiverLabel = /(?:receptor|cliente|destinatario)/i.test(line);
    const score =
      (explicit ? 120 : 80) +
      (section === "issuer" ? 40 : 0) -
      (section === "receiver" || receiverLabel ? 160 : 0);
    if (score > 0) candidates.push({ value, score, context: line });
  });
  return candidates;
}

function collectCuits(lines: string[]) {
  const candidates: Candidate[] = [];
  lines.forEach((line, index) => {
    const matches = [
      ...line.matchAll(
        /(?:CUIT|C\.U\.I\.T\.)\s*(?:(?:del?\s+)?(?:emisor|proveedor|receptor|cliente|destinatario))?\s*(?:N[°ºo]\.?)?\s*:?\s*([0-9]{2}[-\s]?[0-9]{8}[-\s]?[0-9])/gi,
      ),
    ];
    matches.forEach((match) => {
      const section = sectionForLine(lines, index);
      const issuerLabel = /CUIT\s+(?:del?\s+)?(?:emisor|proveedor)/i.test(line);
      const receiverLabel =
        /CUIT\s+(?:del?\s+)?(?:receptor|cliente|destinatario)/i.test(line);
      const score =
        80 +
        (issuerLabel ? 80 : 0) +
        (section === "issuer" ? 40 : 0) -
        (section === "receiver" || receiverLabel ? 160 : 0);
      if (score > 0)
        candidates.push({ value: formatCuit(match[1]), score, context: line });
    });
    if (
      !matches.length &&
      /^(?:CUIT|C\.U\.I\.T\.)\s*(?:(?:del?\s+)?(?:emisor|proveedor))?\s*:?\s*$/i.test(
        line,
      )
    ) {
      const following = lines[index + 1]?.match(
        /^([0-9]{2}[-\s]?[0-9]{8}[-\s]?[0-9])$/,
      );
      if (following) {
        const section = sectionForLine(lines, index);
        const score =
          80 +
          (/emisor|proveedor/i.test(line) ? 80 : 0) +
          (section === "issuer" ? 40 : 0) -
          (section === "receiver" ? 160 : 0);
        if (score > 0)
          candidates.push({
            value: formatCuit(following[1]),
            score,
            context: `${line} ${following[1]}`,
          });
      }
    }
  });
  return candidates;
}

function collectCombinedNumbers(lines: string[]) {
  const candidates: Array<{
    point: string;
    number: string;
    score: number;
    context: string;
  }> = [];
  lines.forEach((line) => {
    for (const match of line.matchAll(/\b(\d{4,5})\s*-\s*(\d{6,8})\b/g)) {
      const labelled =
        /(?:comprobante|factura|n(?:ro|°|º|úm(?:ero)?)\.?)/i.test(line);
      const excluded = /(?:CAE|c[oó]digo\s+de\s+autorizaci[oó]n)/i.test(line);
      if (!excluded)
        candidates.push({
          point: match[1],
          number: match[2],
          score: labelled ? 120 : 60,
          context: line,
        });
    }
  });
  return candidates;
}

function collectSingleField(lines: string[], patterns: RegExp[], score = 100) {
  const candidates: Candidate[] = [];
  lines.forEach((line) => {
    patterns.forEach((pattern) => {
      const match = line.match(pattern);
      if (match?.[1])
        candidates.push({ value: match[1].trim(), score, context: line });
    });
  });
  return candidates;
}

function chooseAmount(
  lines: string[],
  patterns: Array<{ pattern: RegExp; score: number }>,
  field: string,
  warnings: string[],
) {
  const candidates: Candidate[] = [];
  lines.forEach((line) => {
    patterns.forEach(({ pattern, score }) => {
      const match = line.match(pattern);
      if (match?.[1])
        candidates.push({ value: match[1], score, context: line });
    });
  });
  const selected = chooseCandidate(candidates, field, warnings);
  return readAmount(selected, field, warnings);
}

function readAmount(value: string, field: string, warnings: string[]) {
  try {
    return parseArgentineAmount(value);
  } catch {
    warnings.push(
      `No se pudo interpretar ${field}; completá y confirmá el importe manualmente.`,
    );
    return Number.NaN;
  }
}

function chooseVatAmount(lines: string[], warnings: string[]) {
  const summaries = lines.flatMap((line) => {
    const match = line.match(/(?:Importe|Total)\s+IVA\s*:?\s*\$?\s*([\d.,]+)/i);
    return match?.[1] ? [{ value: match[1], score: 130, context: line }] : [];
  });
  if (summaries.length)
    return readAmount(
      chooseCandidate(summaries, "el IVA", warnings),
      "el IVA",
      warnings,
    );

  // Preserve concept identity: never deduplicate individual equal VAT amounts.
  // A repeated fiscal block is identified by its full net/rate/total signature.
  const pages: string[][] = [[]];
  for (const line of lines) {
    if (line === "__PAGE_BREAK__") pages.push([]);
    else pages[pages.length - 1].push(line);
  }
  const summaryBlocks = new Map<string, number>();
  let detailSum = 0,
    foundDetail = false;
  for (const page of pages) {
    const fiscal = page.filter((line) =>
      /^(?:Importe Neto|Total Neto|Neto|Subtotal|IVA|Importe Total|Total a Pagar|TOTAL)\b/i.test(
        line,
      ),
    );
    const summary =
      fiscal.some((line) =>
        /^(?:Importe Neto|Total Neto|Neto|Subtotal)\b/i.test(line),
      ) &&
      fiscal.some((line) =>
        /^(?:Importe Total|Total a Pagar|TOTAL)\b/i.test(line),
      );
    let pageSum = 0,
      found = false;
    for (const line of summary ? fiscal : page) {
      const match = line.match(
        /\bIVA\s+(?:10[,.]5|21|27)\s*%\s*:?\s*\$?\s*([\d.,]+)/i,
      );
      if (match) {
        found = true;
        pageSum += readAmount(match[1], "el IVA", warnings);
      }
    }
    if (found && summary) summaryBlocks.set(fiscal.join("\n"), pageSum);
    else if (found) {
      foundDetail = true;
      detailSum += pageSum;
    }
  }
  if (summaryBlocks.size === 1) return [...summaryBlocks.values()][0];
  if (summaryBlocks.size > 1) {
    warnings.push(
      "Se detectaron resúmenes fiscales diferentes; confirmá manualmente el IVA.",
    );
    return Number.NaN;
  }
  if (foundDetail) return detailSum;
  return chooseAmount(
    lines,
    [{ pattern: /\bIVA\s*:?\s*\$?\s*([\d.,]+)/i, score: 100 }],
    "el IVA",
    warnings,
  );
}

export function parseArgentineAmount(value: string) {
  const clean = value.trim().replace(/^\$\s*/, "");
  let normalized: string;
  if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(clean))
    normalized = clean.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+(?:,\d{1,2})?$/.test(clean))
    normalized = clean.replace(",", ".");
  else if (/^-?\d+\.\d{1,2}$/.test(clean)) normalized = clean;
  else throw new Error(`Formato monetario inválido o ambiguo: ${value}`);
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error("Importe fuera de rango.");
  return number;
}

export function parseDate(value: string) {
  const match = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!match) return "";
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  )
    return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function analyzeInvoiceText(rawText: string): InvoiceTextAnalysis {
  const lines = normalizeDocumentLines(rawText);
  const warnings: string[] = [];

  const supplierName = chooseCandidate(
    collectSupplierNames(lines),
    "la razón social del emisor",
    warnings,
  );
  const supplierCuit = chooseCandidate(
    collectCuits(lines),
    "el CUIT del emisor",
    warnings,
  );

  const combined = collectCombinedNumbers(lines).sort(
    (left, right) => right.score - left.score,
  );
  const combinedValues = [
    ...new Set(
      combined.map((candidate) => `${candidate.point}-${candidate.number}`),
    ),
  ];
  if (combinedValues.length > 1)
    warnings.push(
      "Se detectaron varios números de comprobante. Revisá punto de venta y número.",
    );

  const pointCandidates = collectSingleField(lines, [
    /(?:Punto\s+de\s+Venta|Pto\.?\s*(?:de\s+)?Venta|P\.?\s*V\.?)\s*:?\s*(\d{1,5})/i,
  ]);
  const numberCandidates = collectSingleField(lines, [
    /(?:Comp(?:robante)?\.?\s*)?(?:Nro|N[°º]|N[uú]mero|No)\.?\s*(?:de\s+comprobante)?\s*:?\s*(\d{6,8})/i,
  ]);
  const rawPointOfSale =
    combined[0]?.point ||
    chooseCandidate(pointCandidates, "el punto de venta", warnings);
  const rawNumber =
    combined[0]?.number ||
    chooseCandidate(numberCandidates, "el número de comprobante", warnings);
  const pointOfSale = rawPointOfSale ? rawPointOfSale.padStart(4, "0") : "";
  const number = rawNumber ? rawNumber.padStart(8, "0") : "";

  const type = chooseCandidate(
    collectSingleField(lines, [
      /(?:Tipo\s+de\s+comprobante\s*:?\s*)?(?:FACTURA|FC)\s+([ABCEMT])\b/i,
      /(?:Tipo\s+de\s+comprobante)\s*:?\s*([ABCEMT])\b/i,
    ]),
    "el tipo de comprobante",
    warnings,
  ).toUpperCase();

  const issueDateRaw = chooseCandidate(
    collectSingleField(lines, [
      /(?:Fecha\s+de\s+emisi[oó]n|Fecha\s+emisi[oó]n|Emitida?\s+el)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
      /\bFecha\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
    ]),
    "la fecha de emisión",
    warnings,
  );
  const dueDateRaw = chooseCandidate(
    collectSingleField(lines, [
      /(?:Fecha\s+de\s+vencimiento|Vencimiento|Vence)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
    ]),
    "la fecha de vencimiento",
    warnings,
  );

  const net = chooseAmount(
    lines,
    [
      {
        pattern:
          /(?:Importe\s+Neto(?:\s+Gravado)?|Total\s+Neto)\s*:?\s*\$?\s*([\d.,]+)/i,
        score: 120,
      },
      { pattern: /(?:Subtotal|Neto)\s*:?\s*\$?\s*([\d.,]+)/i, score: 80 },
    ],
    "el importe neto",
    warnings,
  );
  const vat = chooseVatAmount(lines, warnings);
  const total = chooseAmount(
    lines,
    [
      {
        pattern:
          /(?:Importe\s+Total|Total\s+(?:a\s+Pagar|Comprobante))\s*:?\s*\$?\s*([\d.,]+)/i,
        score: 130,
      },
      { pattern: /^TOTAL\s*:?\s*\$?\s*([\d.,]+)/i, score: 100 },
    ],
    "el importe total",
    warnings,
  );

  if (
    ![net, vat, total].every(Number.isFinite) ||
    Math.abs(net + vat - total) > 0.02
  )
    warnings.push(
      "Los importes extraídos no son coherentes: revisá neto, IVA y total.",
    );
  if (!supplierName)
    warnings.push("No se identificó con certeza la razón social del emisor.");
  if (!supplierCuit)
    warnings.push("No se identificó con certeza el CUIT del emisor.");
  if (!pointOfSale || !number)
    warnings.push("No se identificó el comprobante completo.");
  if (!type)
    warnings.push(
      "No se identificó el tipo de comprobante; no se completó automáticamente.",
    );

  return {
    data: {
      number,
      type,
      pointOfSale,
      issueDate: parseDate(issueDateRaw),
      dueDate: dueDateRaw ? parseDate(dueDateRaw) : undefined,
      supplierName,
      supplierCuit,
      net,
      vat,
      total,
    },
    warnings,
  };
}

export function parseInvoiceText(rawText: string): ExtractedInvoiceData {
  return analyzeInvoiceText(rawText).data;
}
