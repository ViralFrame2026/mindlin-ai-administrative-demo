import type { ExtractedInvoiceData } from "./types";

export interface PdfExtractionApiResult {
  data: ExtractedInvoiceData;
  pages: number;
  textPreview: string;
  requestId?: string;
}

interface ApiErrorPayload {
  error?: string;
  code?: string;
  requestId?: string;
}

export class PdfApiResponseError extends Error {
  readonly userMessage: string;
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly contentType: string;
  readonly responsePreview: string;

  constructor({
    userMessage,
    status,
    code,
    requestId,
    contentType,
    responsePreview,
  }: {
    userMessage: string;
    status: number;
    code: string;
    requestId?: string;
    contentType: string;
    responsePreview: string;
  }) {
    super(`PDF API ${code} (HTTP ${status || "sin respuesta"})${requestId ? ` [${requestId}]` : ""}`);
    this.name = "PdfApiResponseError";
    this.userMessage = userMessage;
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.contentType = contentType;
    this.responsePreview = responsePreview;
  }
}

function isJsonContentType(contentType: string) {
  return contentType.includes("application/json") || contentType.includes("+json");
}

function messageForStatus(status: number) {
  if (status === 413) return "El PDF supera el límite de carga permitido en producción (4 MB).";
  if (status === 408 || status === 504) return "La extracción tardó demasiado. Probá con un PDF más pequeño o con menos páginas.";
  if (status === 415) return "El archivo enviado no fue reconocido como PDF.";
  if (status >= 500) return "El servicio de extracción no pudo procesar el PDF. Intentá nuevamente en unos minutos.";
  return "No fue posible procesar el PDF. Revisá el archivo e intentá nuevamente.";
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function parsePdfExtractionResponse(response: Response): Promise<PdfExtractionApiResult> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const requestId = response.headers.get("x-request-id") ?? undefined;
  const body = await response.text();
  const preview = body.slice(0, 500);

  // Check the HTTP result before interpreting the response as the success type.
  if (!response.ok) {
    const payload = isJsonContentType(contentType) && body
      ? safeParseJson(body) as ApiErrorPayload | undefined
      : undefined;
    throw new PdfApiResponseError({
      userMessage: payload?.error || messageForStatus(response.status),
      status: response.status,
      code: payload?.code || (body ? "NON_JSON_ERROR_RESPONSE" : "EMPTY_ERROR_RESPONSE"),
      requestId: payload?.requestId || requestId,
      contentType,
      responsePreview: preview,
    });
  }

  if (!isJsonContentType(contentType)) {
    throw new PdfApiResponseError({
      userMessage: "El servidor respondió en un formato inesperado. Intentá nuevamente.",
      status: response.status,
      code: "UNEXPECTED_CONTENT_TYPE",
      requestId,
      contentType,
      responsePreview: preview,
    });
  }

  if (!body) {
    throw new PdfApiResponseError({
      userMessage: "El servidor no devolvió datos de la extracción. Intentá nuevamente.",
      status: response.status,
      code: "EMPTY_SUCCESS_RESPONSE",
      requestId,
      contentType,
      responsePreview: "",
    });
  }

  const payload = safeParseJson(body);
  if (!payload || typeof payload !== "object" || !("data" in payload) || !("pages" in payload)) {
    throw new PdfApiResponseError({
      userMessage: "El servidor devolvió una respuesta incompleta. Intentá nuevamente.",
      status: response.status,
      code: "INVALID_JSON_RESPONSE",
      requestId,
      contentType,
      responsePreview: preview,
    });
  }

  return payload as PdfExtractionApiResult;
}

export async function requestPdfExtraction(
  file: File,
  fetcher: typeof fetch = fetch,
): Promise<PdfExtractionApiResult> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetcher("/api/extract-pdf", { method: "POST", body: form });
  return parsePdfExtractionResponse(response);
}
