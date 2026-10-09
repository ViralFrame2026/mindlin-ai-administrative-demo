import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const outputDirectory = join(process.cwd(), "public", "samples");

const samples = [
  { file: "factura-servicios-norte.pdf", type: "A", point: "0001", number: "00001234", date: "02/10/2026", due: "17/10/2026", supplier: "Servicios Norte S.A.", cuit: "30-71654321-4", net: "825.000,00", vat: "173.250,00", total: "998.250,00" },
  { file: "factura-estudio-delta.pdf", type: "C", point: "0003", number: "00000872", date: "29/09/2026", due: "14/10/2026", supplier: "Estudio Delta S.R.L.", cuit: "30-71423456-7", net: "420.000,00", vat: "0,00", total: "420.000,00" },
  { file: "factura-logistica-sur.pdf", type: "A", point: "0007", number: "00004591", date: "27/09/2026", due: "12/10/2026", supplier: "Logistica Sur S.A.", cuit: "30-69876543-3", net: "610.000,00", vat: "128.100,00", total: "738.100,00" },
  { file: "factura-insumos-oficina.pdf", type: "B", point: "0012", number: "00000128", date: "25/09/2026", due: "10/10/2026", supplier: "Insumos Oficina AR", cuit: "27-23456789-1", net: "185.000,00", vat: "38.850,00", total: "223.850,00" },
  {
    file: "factura-materiales-multiconcepto.pdf",
    type: "A",
    point: "0021",
    number: "00000341",
    date: "06/10/2026",
    due: "21/10/2026",
    supplier: "Materiales Construccion Demo S.A.",
    cuit: "30-71500123-9",
    net: "1.250.000,00",
    vat: "262.500,00",
    total: "1.512.500,00",
    concepts: [
      "120 bolsas de cemento portland",
      "8 metros cubicos de arena fina",
      "4 pallets de ladrillo hueco",
      "Transporte y descarga en obra",
    ],
  },
];

async function createInvoice(sample) {
  const document = await PDFDocument.create();
  document.setTitle(`Factura ${sample.point}-${sample.number}`);
  document.setAuthor("Mindlin AI - Demo");
  document.setSubject("Comprobante ficticio para demostracion");
  const page = document.addPage([595, 842]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const blue = rgb(0.09, 0.27, 0.62);
  const ink = rgb(0.09, 0.14, 0.22);
  const gray = rgb(0.38, 0.43, 0.5);

  page.drawRectangle({ x: 0, y: 742, width: 595, height: 100, color: rgb(0.04, 0.11, 0.21) });
  page.drawText("MINDLIN AI", { x: 42, y: 795, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("COMPROBANTE FICTICIO PARA DEMOSTRACION", { x: 42, y: 773, size: 9, font: regular, color: rgb(0.65, 0.75, 0.9) });
  page.drawText(`FACTURA ${sample.type}`, { x: 465, y: 792, size: 22, font: bold, color: rgb(1, 1, 1) });

  page.drawText(`Proveedor: ${sample.supplier}`, { x: 42, y: 690, size: 17, font: bold, color: ink });
  page.drawText(`CUIT: ${sample.cuit}`, { x: 42, y: 660, size: 11, font: regular, color: gray });
  page.drawText(`Comprobante Nro: ${sample.point}-${sample.number}`, { x: 42, y: 630, size: 11, font: regular, color: gray });
  page.drawText(`Fecha de emision: ${sample.date}`, { x: 335, y: 660, size: 11, font: regular, color: gray });
  page.drawText(`Fecha de vencimiento: ${sample.due}`, { x: 335, y: 630, size: 11, font: regular, color: gray });

  page.drawRectangle({ x: 42, y: 520, width: 511, height: 54, color: rgb(0.95, 0.97, 1) });
  page.drawText("Concepto", { x: 58, y: 543, size: 10, font: bold, color: blue });
  const concepts = sample.concepts ?? ["Servicios profesionales y administrativos de ejemplo"];
  concepts.forEach((concept, index) => {
    page.drawText(concept, { x: 58, y: 500 - index * 21, size: 11, font: regular, color: ink });
  });

  const amountLines = [
    ["Importe Neto Gravado", sample.net],
    ["IVA 21 %", sample.vat],
    ["Importe Total", sample.total],
  ];
  amountLines.forEach(([label, amount], index) => {
    const y = (concepts.length > 1 ? 380 : 415) - index * 45;
    page.drawText(`${label}:`, { x: 305, y, size: index === 2 ? 13 : 11, font: index === 2 ? bold : regular, color: index === 2 ? ink : gray });
    page.drawText(`$ ${amount}`, { x: 462, y, size: index === 2 ? 13 : 11, font: index === 2 ? bold : regular, color: index === 2 ? blue : ink });
  });

  page.drawLine({ start: { x: 42, y: 110 }, end: { x: 553, y: 110 }, thickness: 1, color: rgb(0.86, 0.89, 0.93) });
  page.drawText("Documento sin validez fiscal. Generado exclusivamente para probar la demo Mindlin AI.", { x: 42, y: 85, size: 9, font: regular, color: gray });
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
