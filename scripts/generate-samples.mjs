import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const outputDirectory = join(process.cwd(), "public", "samples");

const samples = [
  {
    file: "factura-construccion-andina.pdf",
    type: "A",
    supplier: "Construcciones Andinas S.A.",
    meta: [
      "DATOS DEL EMISOR",
      "Razon Social del Emisor: Construcciones Andinas S.A.",
      "CUIT del Emisor: 30-71500123-9",
      "FACTURA A Nro. 0004-00001842",
      "Fecha de emision: 06/10/2026",
      "Fecha de vencimiento: 21/10/2026",
      "DATOS DEL RECEPTOR",
      "Razon Social: Desarrolladora Horizonte S.A.",
      "CUIT: 30-71234567-8",
    ],
    concepts: ["120 bolsas de cemento portland", "8 m3 de arena fina", "4 pallets de ladrillo hueco"],
    amounts: [["Importe Neto Gravado", "1.250.000,00"], ["IVA 21 %", "262.500,00"], ["Importe Total", "1.512.500,00"]],
  },
  {
    file: "factura-arquitectura-urbana.pdf",
    type: "C",
    supplier: "Arquitectura Urbana S.R.L.",
    meta: [
      "FACTURA C",
      "DATOS DEL RECEPTOR",
      "Razon Social: Desarrolladora Horizonte S.A.",
      "CUIT: 30-71234567-8",
      "DATOS DEL EMISOR",
      "Razon Social: Arquitectura Urbana S.R.L.",
      "CUIT: 30-71423456-7",
      "Punto de Venta: 0016   Comp. Nro: 00000427",
      "Emitida el: 04/10/2026   Vence: 19/10/2026",
    ],
    concepts: ["Anteproyecto ejecutivo torre residencial", "Documentacion municipal y computo"],
    amounts: [["Subtotal", "480.000,00"], ["IVA", "0,00"], ["TOTAL", "480.000,00"]],
  },
  {
    file: "factura-mantenimiento-integral.pdf",
    type: "A",
    supplier: "Mantenimiento Integral S.A.",
    meta: [
      "Tipo de comprobante: FACTURA A",
      "Emisor: Mantenimiento Integral S.A.",
      "CUIT Emisor: 30-71654321-4",
      "P.V.: 0009",
      "Numero: 00000763",
      "Fecha emision: 03/10/2026",
      "Vencimiento: 18/10/2026",
      "Cliente: Desarrolladora Horizonte S.A.",
      "CUIT Cliente: 30-71234567-8",
    ],
    concepts: ["Mantenimiento preventivo de ascensores", "Revision de bombas y tableros"],
    amounts: [["Total Neto", "360.000,00"], ["Importe IVA", "75.600,00"], ["Total a Pagar", "435.600,00"]],
  },
  {
    file: "factura-logistica-sur.pdf",
    type: "A",
    supplier: "Logistica Sur S.A.",
    meta: [
      "FACTURA A",
      "Proveedor: Logistica Sur S.A.",
      "CUIT: 30-69876543-3",
      "Comprobante Nro: 0007-00004591",
      "Fecha de emision: 27/09/2026",
      "Fecha de vencimiento: 12/10/2026",
      "Receptor: Desarrolladora Horizonte S.A.",
      "CUIT Receptor: 30-71234567-8",
    ],
    concepts: ["Transporte de materiales a obra", "Descarga y movimiento interno", "Seguro de carga"],
    amounts: [["Neto", "610.000,00"], ["IVA 21 %", "128.100,00"], ["Total Comprobante", "738.100,00"]],
  },
];

async function createInvoice(sample) {
  const document = await PDFDocument.create();
  document.setTitle(`Factura ficticia - ${sample.supplier}`);
  document.setAuthor("Mindlin AI - Demo comercial 2.0");
  document.setSubject("Comprobante ficticio sin validez fiscal");
  const page = document.addPage([595, 842]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const blue = rgb(0.09, 0.27, 0.62);
  const ink = rgb(0.09, 0.14, 0.22);
  const gray = rgb(0.38, 0.43, 0.5);

  page.drawRectangle({ x: 0, y: 748, width: 595, height: 94, color: rgb(0.04, 0.11, 0.21) });
  page.drawText("MINDLIN AI", { x: 42, y: 798, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("COMPROBANTE FICTICIO - SIN VALIDEZ FISCAL", { x: 42, y: 776, size: 9, font: regular, color: rgb(0.65, 0.75, 0.9) });
  page.drawText(`FACTURA ${sample.type}`, { x: 458, y: 793, size: 21, font: bold, color: rgb(1, 1, 1) });

  sample.meta.forEach((line, index) => {
    const heading = /^DATOS DEL/.test(line);
    page.drawText(line, {
      x: 42,
      y: 710 - index * 24,
      size: heading ? 9 : 10.5,
      font: heading ? bold : regular,
      color: heading ? blue : gray,
    });
  });

  page.drawRectangle({ x: 42, y: 405, width: 511, height: 35, color: rgb(0.95, 0.97, 1) });
  page.drawText("CONCEPTOS", { x: 56, y: 418, size: 9, font: bold, color: blue });
  sample.concepts.forEach((concept, index) => {
    page.drawText(concept, { x: 56, y: 382 - index * 20, size: 10.5, font: regular, color: ink });
  });

  sample.amounts.forEach(([label, amount], index) => {
    const y = 270 - index * 42;
    const total = index === sample.amounts.length - 1;
    page.drawText(`${label}:`, { x: 292, y, size: total ? 13 : 11, font: total ? bold : regular, color: total ? ink : gray });
    page.drawText(`$ ${amount}`, { x: 450, y, size: total ? 13 : 11, font: total ? bold : regular, color: total ? blue : ink });
  });

  page.drawLine({ start: { x: 42, y: 92 }, end: { x: 553, y: 92 }, thickness: 1, color: rgb(0.86, 0.89, 0.93) });
  page.drawText("Documento ficticio generado para la demo Mindlin AI. No representa una operacion real.", { x: 42, y: 68, size: 9, font: regular, color: gray });
  return document.save();
}

await mkdir(outputDirectory, { recursive: true });
const requestedFile = process.argv[2];
const selectedSamples = requestedFile
  ? samples.filter((sample) => sample.file === requestedFile)
  : samples;
if (!selectedSamples.length) throw new Error(`Unknown sample PDF: ${requestedFile}`);
for (const sample of selectedSamples) {
  await writeFile(join(outputDirectory, sample.file), await createInvoice(sample));
}
console.log(`Generated ${selectedSamples.length} sample PDF(s) in public/samples.`);
