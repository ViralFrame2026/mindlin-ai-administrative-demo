import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { parseInvoiceText } from "@/lib/extraction";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Seleccioná un archivo PDF válido." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "El PDF debe pesar entre 1 byte y 10 MB." }, { status: 400 });
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "El archivo enviado no es un PDF." }, { status: 415 });
    }

    const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
    try {
      const result = await parser.getText();
      const text = result.text.trim();
      if (text.length < 20) {
        return NextResponse.json(
          {
            error: "No se encontró una capa de texto utilizable. El prototipo no aplica OCR a PDFs escaneados.",
            code: "NO_TEXT_LAYER",
          },
          { status: 422 },
        );
      }
      return NextResponse.json({
        data: parseInvoiceText(text),
        pages: result.total,
        textPreview: text.slice(0, 700),
      });
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    console.error("PDF extraction failed", error);
    return NextResponse.json(
      { error: "No fue posible leer el PDF. Verificá que no esté dañado o protegido con contraseña." },
      { status: 422 },
    );
  }
}
