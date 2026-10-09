"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Download, ExternalLink, LoaderCircle, ZoomIn, ZoomOut } from "lucide-react";
import { pdfCanvasSize } from "@/lib/pdf-preview";

export function PdfViewer({ url, fileName }: { url: string; fileName: string }) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let disposed = false;
    let task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
    setDocument(null);
    setPage(1);
    setZoom(1);
    setError("");
    setLoading(true);
    const load = async () => {
      try {
        // Never import PDF.js during SSR: browser canvas and graphics globals are required.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (disposed) return;
        const assets = `/pdfjs/${pdfjs.version}/`;
        pdfjs.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.min.mjs`;
        task = pdfjs.getDocument({
          url,
          cMapUrl: `${assets}cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${assets}standard_fonts/`,
          wasmUrl: `${assets}wasm/`,
          iccUrl: `${assets}iccs/`,
          enableXfa: false,
        });
        const pdf = await task.promise;
        if (!disposed) setDocument(pdf);
      } catch (caught) {
        if (disposed) return;
        console.error("[pdf-viewer] Error al cargar el documento", caught);
        const name = caught instanceof Error ? caught.name : "";
        setError(name === "PasswordException"
          ? "El PDF está protegido con contraseña. Abrí el original con tu visor o usá una copia sin protección."
          : "No pudimos visualizar el PDF. Puede estar dañado o ya no estar disponible.");
      } finally {
        if (!disposed) setLoading(false);
      }
    };
    void load();
    return () => {
      disposed = true;
      // Destroying the loading task also terminates its worker and releases the PDF transport.
      void task?.destroy().catch((caught) => console.error("[pdf-viewer] Error al liberar el documento", caught));
    };
  }, [url]);

  useEffect(() => {
    const target = canvas.current;
    if (!document || !target || width <= 0) return;
    let disposed = false;
    let renderTask: RenderTask | undefined;
    setRendering(true);
    setError("");
    target.style.visibility = "hidden";
    const render = async () => {
      try {
        const pdfPage = await document.getPage(page);
        if (disposed) return;
        const original = pdfPage.getViewport({ scale: 1 });
        const size = pdfCanvasSize(original.width, original.height, width, zoom, window.devicePixelRatio || 1);
        const viewport = pdfPage.getViewport({ scale: size.scale });
        target.width = size.pixelWidth;
        target.height = size.pixelHeight;
        target.style.width = `${size.width}px`;
        target.style.height = `${size.height}px`;
        renderTask = pdfPage.render({
          canvas: target,
          viewport,
          transform: [size.ratio, 0, 0, size.ratio, 0, 0],
          background: "rgb(255,255,255)",
        });
        await renderTask.promise;
        if (!disposed) {
          target.style.visibility = "visible";
          target.dataset.renderedPage = String(page);
        }
      } catch (caught) {
        if (disposed || (caught instanceof Error && caught.name === "RenderingCancelledException")) return;
        console.error("[pdf-viewer] Error al renderizar la página", caught);
        setError("No pudimos mostrar esta página. Podés abrir o descargar el PDF original.");
      } finally {
        if (!disposed) setRendering(false);
      }
    };
    void render();
    return () => {
      disposed = true;
      renderTask?.cancel();
    };
  }, [document, page, width, zoom]);

  return (
    <div className="flex h-[min(75vh,760px)] min-h-[360px] min-w-0 flex-col" aria-label="Visor de documento PDF">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-3 py-2">
        <div className="flex items-center gap-1">
          <button type="button" className="btn-secondary !px-2" aria-label="Página anterior" disabled={!document || page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="size-4" /></button>
          <span className="min-w-24 text-center text-xs font-semibold text-slate-600" aria-live="polite">Página {page} de {document?.numPages ?? "…"}</span>
          <button type="button" className="btn-secondary !px-2" aria-label="Página siguiente" disabled={!document || page >= document.numPages} onClick={() => setPage((current) => current + 1)}><ChevronRight className="size-4" /></button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-secondary !px-2" aria-label="Alejar" disabled={!document || zoom <= 0.5} onClick={() => setZoom((current) => Math.max(0.5, current - 0.25))}><ZoomOut className="size-4" /></button>
          <span className="w-10 text-center text-xs text-slate-600">{Math.round(zoom * 100)}%</span>
          <button type="button" className="btn-secondary !px-2" aria-label="Acercar" disabled={!document || zoom >= 2.5} onClick={() => setZoom((current) => Math.min(2.5, current + 0.25))}><ZoomIn className="size-4" /></button>
          <button type="button" className="btn-secondary !px-2 !text-xs" disabled={!document} onClick={() => setZoom(1)}>Ajustar</button>
        </div>
        <div className="flex gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-3"><ExternalLink className="size-4" />Abrir</a>
          <a href={url} download={fileName} className="btn-secondary !px-3"><Download className="size-4" />Descargar</a>
        </div>
      </div>
      <div ref={container} className="relative min-h-0 min-w-0 flex-1 overflow-auto bg-slate-100" data-testid="pdf-scroll-area">
        {(loading || rendering) && <div role="status" className="sticky left-0 top-0 z-10 flex items-center justify-center gap-2 bg-slate-100/95 p-3 text-sm text-slate-600"><LoaderCircle className="size-4 animate-spin" />{loading ? "Cargando documento…" : "Mostrando página…"}</div>}
        {error && <p role="alert" className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
        <div className="w-max min-w-full p-3">
          <canvas ref={canvas} aria-label={`Página ${page} del documento ${fileName}`} className="mx-auto block bg-white shadow-md" style={{ visibility: "hidden" }} />
        </div>
      </div>
    </div>
  );
}
