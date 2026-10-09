import { NextResponse } from "next/server";
import { parseInvoiceText } from "@/lib/extraction";
import { MAX_PDF_FILE_SIZE, MAX_PDF_FILE_SIZE_LABEL } from "@/lib/pdf-constraints";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const EXTRACTION_TIMEOUT_MS = 20_000;

class ExtractionTimeoutError extends Error {
  constructor() {
    super(`PDF extraction exceeded ${EXTRACTION_TIMEOUT_MS} ms`);
    this.name = "ExtractionTimeoutError";
  }
}

function jsonResponse(
  payload: Record<string, unknown>,
  status: number,
  requestId: string,
) {
  return NextResponse.json(
    { ...payload, requestId },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    },
  );
}

function logServerError(
  event: string,
  error: unknown,
  requestId: string,
  context: Record<string, unknown> = {},
) {
  const technicalError = error instanceof Error
    ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
    : { errorValue: String(error) };
  console.error("[pdf-extraction]", { event, requestId, ...context, ...technicalError });
}

async function withTimeout<T>(operation: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ExtractionTimeoutError()), EXTRACTION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-vercel-id") || crypto.randomUUID();
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (error) {
    logServerError("invalid_multipart_body", error, requestId);
    return jsonResponse(
      { error: "La solicitud de carga no tiene un formato válido.", code: "INVALID_MULTIPART_BODY" },
      400,
      requestId,
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonResponse(
      { error: "Seleccioná un archivo PDF válido.", code: "MISSING_PDF" },
      400,
      requestId,
    );
  }
  if (file.size === 0) {
    return jsonResponse(
      { error: "El PDF está vacío.", code: "EMPTY_PDF" },
      400,
      requestId,
    );
  }
  if (file.size > MAX_PDF_FILE_SIZE) {
    return jsonResponse(
      { error: `El PDF supera el límite de ${MAX_PDF_FILE_SIZE_LABEL} permitido en producción.`, code: "PDF_TOO_LARGE" },
      413,
      requestId,
    );
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return jsonResponse(
      { error: "El archivo enviado no es un PDF.", code: "UNSUPPORTED_MEDIA_TYPE" },
      415,
      requestId,
    );
  }

  let PdfParser: (typeof import("pdf-parse"))["PDFParse"];
  try {
    // Keep module initialization inside the guarded request flow. If Vercel
    // cannot load pdfjs/native dependencies, the client still receives JSON.
    ({ PDFParse: PdfParser } = await import("pdf-parse"));
  } catch (error) {
    logServerError("pdf_runtime_load_failed", error, requestId, {
      fileName: file.name,
      fileSize: file.size,
      nodeVersion: process.version,
    });
    return jsonResponse(
      { error: "El servicio de lectura de PDF no está disponible temporalmente.", code: "PDF_RUNTIME_UNAVAILABLE" },
      500,
      requestId,
    );
  }

  const parser = new PdfParser({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const result = await withTimeout(parser.getText());
    const text = result.text.trim();
    if (text.length < 20) {
      return jsonResponse(
        {
          error: "No se encontró una capa de texto utilizable. El prototipo no aplica OCR a PDFs escaneados.",
          code: "NO_TEXT_LAYER",
        },
        422,
        requestId,
      );
    }
    return jsonResponse(
      {
        data: parseInvoiceText(text),
        pages: result.total,
        textPreview: text.slice(0, 700),
      },
      200,
      requestId,
    );
  } catch (error) {
    const timedOut = error instanceof ExtractionTimeoutError;
    logServerError(timedOut ? "pdf_extraction_timeout" : "pdf_parse_failed", error, requestId, {
      fileName: file.name,
      fileSize: file.size,
      nodeVersion: process.version,
    });
    return jsonResponse(
      timedOut
        ? { error: "La extracción tardó demasiado. Probá con un PDF más pequeño o con menos páginas.", code: "PDF_EXTRACTION_TIMEOUT" }
        : { error: "No fue posible leer el PDF. Verificá que no esté dañado o protegido con contraseña.", code: "PDF_PARSE_FAILED" },
      timedOut ? 504 : 422,
      requestId,
    );
  } finally {
    try {
      await parser.destroy();
    } catch (error) {
      logServerError("pdf_parser_cleanup_failed", error, requestId, { fileName: file.name });
    }
  }
}
