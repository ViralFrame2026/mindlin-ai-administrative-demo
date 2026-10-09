"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  FileText,
  LoaderCircle,
  ShieldAlert,
  UploadCloud,
  X,
} from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_PDF_SAMPLES } from "@/lib/demo-data";
import { PdfApiResponseError, requestPdfExtraction, type PdfExtractionApiResult } from "@/lib/pdf-api";
import { MAX_PDF_FILE_SIZE, MAX_PDF_FILE_SIZE_LABEL } from "@/lib/pdf-constraints";
import { calculateRetentions } from "@/lib/retention";
import { useAppStore } from "@/lib/store";
import type { ExtractedInvoiceData, Invoice } from "@/lib/types";
import { uid, formatCurrency, formatFileSize } from "@/lib/utils";
import { validateInvoice } from "@/lib/validation";
import { PageHeader } from "./ui";

const EMPTY_DATA: ExtractedInvoiceData = {
  number: "",
  type: "",
  pointOfSale: "",
  issueDate: "",
  dueDate: "",
  supplierName: "",
  supplierCuit: "",
  net: 0,
  vat: 0,
  total: 0,
};

export function UploadInvoice() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { invoices, rules, addInvoice } = useAppStore();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [data, setData] = useState<ExtractedInvoiceData>(EMPTY_DATA);
  const [result, setResult] = useState<PdfExtractionApiResult | null>(null);
  const [pdfHash, setPdfHash] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingExample, setLoadingExample] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const validation = useMemo(() => validateInvoice(data, invoices, pdfHash), [data, invoices, pdfHash]);
  const retention = useMemo(
    () => calculateRetentions({ net: data.net, vat: data.vat, total: data.total, currency: "ARS" }, rules),
    [data, rules],
  );

  const fileError = (selected: File) => {
    if (selected.type !== "application/pdf" && !selected.name.toLowerCase().endsWith(".pdf")) {
      return "Seleccioná un archivo con formato PDF.";
    }
    if (selected.size > MAX_PDF_FILE_SIZE) {
      return `El archivo supera el máximo de ${MAX_PDF_FILE_SIZE_LABEL} permitido en producción.`;
    }
    return "";
  };

  const chooseFile = (selected?: File) => {
    if (!selected) return false;
    setError("");
    setResult(null);
    setPdfHash("");
    setData(EMPTY_DATA);
    const selectionError = fileError(selected);
    if (selectionError) {
      setError(selectionError);
      setFile(null);
      return false;
    }
    setFile(selected);
    return true;
  };

  const onInput = (event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  };

  const extractFile = async (selected: File) => {
    setBusy(true);
    setError("");
    try {
      const bytes = await selected.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const payload = await requestPdfExtraction(selected);
      setPdfHash(hash);
      setResult(payload);
      setData(payload.data);
    } catch (caught) {
      if (caught instanceof PdfApiResponseError) {
        console.error("[pdf-upload] La API devolvió una respuesta inválida", {
          message: caught.message,
          status: caught.status,
          code: caught.code,
          requestId: caught.requestId,
          contentType: caught.contentType,
          responsePreview: caught.responsePreview,
        });
        setError(caught.userMessage);
      } else {
        console.error("[pdf-upload] Falló la solicitud de extracción", caught);
        setError("No fue posible comunicarse con el servicio de extracción. Revisá tu conexión e intentá nuevamente.");
      }
    } finally {
      setBusy(false);
    }
  };

  const extract = async () => {
    if (file) await extractFile(file);
  };

  const loadExample = async (sample: (typeof DEMO_PDF_SAMPLES)[number]) => {
    setLoadingExample(sample.fileName);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(sample.url, { cache: "no-store" });
      if (!response.ok) throw new Error(`No se pudo obtener el ejemplo (HTTP ${response.status}).`);
      const exampleFile = new File([await response.blob()], sample.fileName, { type: "application/pdf" });
      if (!chooseFile(exampleFile)) return;
      await extractFile(exampleFile);
    } catch (caught) {
      console.error("[pdf-example] No fue posible cargar el PDF ficticio", caught);
      setError("No fue posible cargar el ejemplo. Podés volver a intentarlo o seleccionar un PDF local.");
    } finally {
      setLoadingExample(null);
      setBusy(false);
    }
  };

  const updateText = (field: keyof ExtractedInvoiceData, value: string) => {
    setData((current) => ({ ...current, [field]: value }));
  };
  const updateAmount = (field: "net" | "vat" | "total", value: string) => {
    setData((current) => ({ ...current, [field]: Number(value) || 0 }));
  };

  const save = async () => {
    if (!file || !result || validation.errors.length || validation.duplicate) return;
    setBusy(true);
    setError("");
    const id = uid("invoice");
    const now = new Date().toISOString();
    const invoice: Invoice = {
      id,
      number: data.number,
      type: data.type,
      pointOfSale: data.pointOfSale,
      issueDate: data.issueDate,
      dueDate: data.dueDate || undefined,
      supplier: { name: data.supplierName, cuit: data.supplierCuit },
      amounts: { net: data.net, vat: data.vat, total: data.total, currency: "ARS" },
      status: "pending",
      source: "uploaded",
      pdfName: file.name,
      pdfSize: file.size,
      pdfStorageKey: `pdf:${id}`,
      pdfHash,
      pages: result.pages,
      extractedTextPreview: result.textPreview,
      createdAt: now,
      updatedAt: now,
      validation,
      retentionLines: retention.lines,
      retentionTotal: retention.total,
    };
    try {
      await addInvoice(invoice, file);
      router.push(`/facturas/${id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible guardar el comprobante localmente.");
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Ingreso de comprobante"
        title="Cargar factura"
        description="Subí un PDF digital. Extraemos la capa de texto y te pedimos revisar los datos antes de guardar."
        backHref="/facturas"
      />

      <div className="mb-6 flex items-center rounded-2xl border border-line bg-white p-3 shadow-sm">
        {[
          ["1", "Archivo", Boolean(file)],
          ["2", "Extracción", Boolean(result)],
          ["3", "Revisión", Boolean(result && !validation.errors.length)],
        ].map(([number, label, done], index) => (
          <div key={String(number)} className="flex flex-1 items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? "bg-emerald-500 text-white" : index === (file ? (result ? 2 : 1) : 0) ? "bg-cobalt text-white" : "bg-slate-100 text-slate-400"}`}>
                {done ? <Check className="size-4" /> : number}
              </span>
              <span className="hidden text-xs font-bold text-slate-600 sm:block">{label}</span>
            </div>
            {index < 2 && <ChevronRight className="mx-1 size-4 shrink-0 text-slate-300" />}
          </div>
        ))}
      </div>

      {!result ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section className="panel p-5 sm:p-7">
            <div
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`grid min-h-80 place-items-center rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? "border-cobalt bg-blue-50" : file ? "border-emerald-300 bg-emerald-50/40" : "border-slate-300 bg-slate-50/60 hover:border-blue-300"}`}
            >
              {file ? (
                <div>
                  <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-600"><FileText className="size-8" /></span>
                  <h2 className="mt-4 font-bold text-navy">{file.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{formatFileSize(file.size)}</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <button className="btn-secondary" onClick={() => inputRef.current?.click()}>Cambiar archivo</button>
                    <button className="btn-primary" onClick={extract} disabled={busy}>
                      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <FileSearch className="size-4" />}
                      {busy ? "Extrayendo texto…" : "Extraer información"}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-blue-100 text-cobalt"><UploadCloud className="size-8" /></span>
                  <h2 className="mt-4 text-lg font-bold text-navy">Arrastrá tu factura PDF</h2>
                  <p className="mt-2 text-sm text-slate-500">o seleccioná un archivo desde tu equipo</p>
                  <button className="btn-primary mt-5" onClick={() => inputRef.current?.click()}>Seleccionar PDF</button>
                  <p className="mt-4 text-xs text-slate-400">PDF digital · máximo {MAX_PDF_FILE_SIZE_LABEL} · sin contraseña</p>
                </div>
              )}
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={onInput} className="sr-only" />
            </div>
            {error && <ErrorMessage message={error} />}
          </section>

          <aside className="space-y-5">
            <div className="panel p-5 sm:p-6">
              <h2 className="font-bold text-navy">PDFs ficticios para probar</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Elegí un caso y lo enviaremos al mismo endpoint de extracción que procesa tus archivos.</p>
              <div className="mt-4 space-y-2">
                {DEMO_PDF_SAMPLES.map((sample) => (
                  <button
                    key={sample.fileName}
                    type="button"
                    onClick={() => loadExample(sample)}
                    disabled={busy}
                    className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {loadingExample === sample.fileName ? <LoaderCircle className="size-4 shrink-0 animate-spin text-cobalt" /> : <FileText className="size-4 shrink-0 text-cobalt" />}
                    <span className="min-w-0 flex-1"><span className="block">{sample.label}</span><span className="mt-0.5 block text-xs font-normal text-slate-500">{sample.detail}</span></span>
                    <span className="text-xs text-cobalt">Usar</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" /><div><h3 className="text-sm font-bold text-amber-900">Limitación transparente</h3><p className="mt-1.5 text-xs leading-5 text-amber-800">Esta versión lee texto embebido; no realiza OCR. Los datos se interpretan con patrones argentinos y siempre deben revisarse.</p></div></div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
          <section className="panel overflow-hidden xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-navy">{file?.name}</p><p className="text-xs text-slate-500">{result.pages} página{result.pages === 1 ? "" : "s"}</p></div><button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={() => { setFile(null); setResult(null); }}><X className="size-4" /></button></div>
            {previewUrl && <iframe src={previewUrl} title="Vista previa del PDF" className="h-[640px] w-full bg-slate-100 xl:h-[calc(100%-65px)]" />}
          </section>

          <section className="space-y-5">
            <div className="panel p-5 sm:p-6">
              <div className="mb-5 flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="size-5" /></span><div><h2 className="font-bold text-navy">Extracción completada</h2><p className="mt-1 text-sm text-slate-500">Revisá y corregí los campos antes de incorporar la factura.</p></div></div>
              {result.warnings.map((warning) => <p key={warning} className="mb-3 flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"><AlertCircle className="mt-0.5 size-4 shrink-0" />{warning}</p>)}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Razón social" value={data.supplierName} onChange={(value) => updateText("supplierName", value)} wide />
                <Field label="CUIT" value={data.supplierCuit} onChange={(value) => updateText("supplierCuit", value)} />
                <Field label="Tipo" value={data.type} onChange={(value) => updateText("type", value)} />
                <Field label="Punto de venta" value={data.pointOfSale} onChange={(value) => updateText("pointOfSale", value)} />
                <Field label="Número" value={data.number} onChange={(value) => updateText("number", value)} />
                <Field label="Fecha de emisión" value={data.issueDate} type="date" onChange={(value) => updateText("issueDate", value)} />
                <Field label="Vencimiento" value={data.dueDate || ""} type="date" onChange={(value) => updateText("dueDate", value)} />
              </div>
              <div className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
                <AmountField label="Importe neto" value={data.net} onChange={(value) => updateAmount("net", value)} />
                <AmountField label="IVA" value={data.vat} onChange={(value) => updateAmount("vat", value)} />
                <AmountField label="Total" value={data.total} onChange={(value) => updateAmount("total", value)} />
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="panel p-5">
                <h3 className="text-sm font-bold text-navy">Validaciones</h3>
                <div className="mt-4 space-y-3">
                  <ValidationRow ok={validation.cuitValid} label="Dígito verificador de CUIT" />
                  <ValidationRow ok={validation.amountConsistent} label="Consistencia de importes" />
                  <ValidationRow ok={!validation.duplicate} label="Sin duplicado detectado" />
                </div>
                {[...validation.errors, ...validation.warnings].map((message) => <p key={message} className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{message}</p>)}
              </div>
              <div className="panel p-5">
                <h3 className="text-sm font-bold text-navy">Retenciones demostrativas</h3>
                <div className="mt-4 space-y-2">
                  {retention.lines.length ? retention.lines.map((line) => <div key={line.ruleId} className="flex justify-between text-xs"><span className="text-slate-500">{line.ruleName} · {line.rate}%</span><strong className="text-navy">{formatCurrency(line.amount)}</strong></div>) : <p className="text-xs text-slate-500">No se activan reglas para estos importes.</p>}
                </div>
                <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm"><span className="font-semibold text-slate-600">Total estimado</span><strong className="text-cobalt">{formatCurrency(retention.total)}</strong></div>
              </div>
            </div>

            {error && <ErrorMessage message={error} />}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link href="/facturas" className="btn-secondary">Cancelar</Link>
              <button onClick={save} disabled={busy || validation.errors.length > 0 || validation.duplicate} className="btn-primary">
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                {busy ? "Guardando…" : validation.duplicate ? "Duplicado bloqueado" : "Guardar como pendiente"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", wide = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; wide?: boolean }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="label">{label}</span><input className="field" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function AmountField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return <label><span className="label">{label}</span><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">$</span><input className="field pl-8 text-right font-semibold" type="number" min="0" step="0.01" value={value || ""} onChange={(event) => onChange(event.target.value)} /></div></label>;
}

function ValidationRow({ ok, label }: { ok: boolean; label: string }) {
  return <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">{ok ? <CheckCircle2 className="size-4 text-emerald-500" /> : <AlertCircle className="size-4 text-amber-500" />}{label}</div>;
}

function ErrorMessage({ message }: { message: string }) {
  return <div className="mt-4 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="mt-0.5 size-5 shrink-0" /><p>{message}</p></div>;
}
