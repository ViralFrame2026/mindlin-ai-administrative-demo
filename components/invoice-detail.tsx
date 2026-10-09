"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPdfBlob } from "@/lib/storage";
import { createManagedPdfUrl, supportsInlinePdfPreview } from "@/lib/pdf-preview";
import { useAppStore } from "@/lib/store";
import { formatCurrency, formatDate, formatDateTime, formatFileSize } from "@/lib/utils";
import { PageHeader, StatusBadge } from "./ui";

export function InvoiceDetail() {
  const params = useParams<{ id: string }>();
  const { invoices, history, hydrated, updateInvoiceStatus } = useAppStore();
  const invoice = invoices.find((item) => item.id === params.id);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [inlinePreview, setInlinePreview] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [confirmingApproval, setConfirmingApproval] = useState(false);
  const [reason, setReason] = useState("");
  const [workflowError, setWorkflowError] = useState("");
  const transitionLock = useRef("");

  useEffect(() => {
    setInlinePreview(supportsInlinePdfPreview(window.navigator.userAgent));
  }, []);

  useEffect(() => {
    transitionLock.current = "";
  }, [invoice?.status]);

  useEffect(() => {
    setPdfError("");
    setPdfUrl(null);
    setLoadingPdf(false);
    if (!invoice) return;
    if (invoice.pdfUrl) {
      setPdfUrl(invoice.pdfUrl);
      return;
    }
    if (!invoice.pdfStorageKey) {
      setPdfError("El archivo PDF no está asociado a este comprobante.");
      return;
    }
    let disposed = false;
    let managedUrl: ReturnType<typeof createManagedPdfUrl> | undefined;
    setLoadingPdf(true);
    getPdfBlob(invoice.pdfStorageKey)
      .then((blob) => {
        if (!blob) throw new Error("PDF_NOT_FOUND");
        managedUrl = createManagedPdfUrl(blob);
        if (disposed) managedUrl.release();
        else setPdfUrl(managedUrl.url);
      })
      .catch((error) => {
        console.error("[pdf-viewer] No fue posible recuperar el archivo local", error);
        if (!disposed) setPdfError("No fue posible recuperar el PDF guardado en este navegador.");
      })
      .finally(() => {
        if (!disposed) setLoadingPdf(false);
      });
    return () => {
      disposed = true;
      managedUrl?.release();
    };
  }, [invoice?.pdfStorageKey, invoice?.pdfUrl]);

  const invoiceHistory = useMemo(
    () => history.filter((entry) => entry.invoiceId === invoice?.id),
    [history, invoice?.id],
  );

  if (!hydrated && !invoice) {
    return <div className="grid min-h-[50vh] place-items-center"><LoaderCircle className="size-8 animate-spin text-cobalt" /></div>;
  }
  if (!invoice) {
    return (
      <div className="panel mx-auto max-w-xl p-10 text-center">
        <FileText className="mx-auto size-10 text-slate-300" />
        <h1 className="mt-4 text-xl font-bold text-navy">Factura no encontrada</h1>
        <p className="mt-2 text-sm text-slate-500">Puede haber sido eliminada al restaurar los datos de la demo.</p>
        <Link href="/facturas" className="btn-primary mt-6">Volver a facturas</Link>
      </div>
    );
  }

  const canApprove = !invoice.validation.errors.length && !invoice.validation.duplicate;
  const changeStatus = (status: "needs_review" | "approved" | "rejected", rejectionReason?: string) => {
    const transitionKey = `${invoice.status}:${status}`;
    if (transitionLock.current === transitionKey) return false;
    transitionLock.current = transitionKey;
    setWorkflowError("");
    const result = updateInvoiceStatus(invoice.id, status, rejectionReason);
    if (!result.ok) {
      transitionLock.current = "";
      setWorkflowError(result.error || "No se pudo actualizar el estado.");
    }
    return result.ok;
  };
  const submitRejection = () => {
    if (reason.trim().length < 5) return;
    if (changeStatus("rejected", reason.trim())) setRejecting(false);
  };

  return (
    <div>
      <PageHeader
        eyebrow={`Factura ${invoice.type}`}
        title={`${invoice.pointOfSale}-${invoice.number}`}
        description={`${invoice.supplier.name} · ${invoice.supplier.cuit}`}
        backHref="/facturas"
        actions={<StatusBadge status={invoice.status} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <section className="panel overflow-hidden xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
            <div className="min-w-0"><p className="truncate text-sm font-bold text-navy">{invoice.pdfName}</p><p className="mt-0.5 text-xs text-slate-500">{invoice.pages} página{invoice.pages === 1 ? "" : "s"} · {formatFileSize(invoice.pdfSize)}</p></div>
            {pdfUrl && <div className="flex gap-2"><a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-secondary !min-h-9 !px-3 !py-1.5"><ExternalLink className="size-4" /><span className="hidden sm:inline">Abrir</span></a><a href={pdfUrl} download={invoice.pdfName} className="btn-secondary !min-h-9 !px-3 !py-1.5"><Download className="size-4" /><span className="hidden sm:inline">Descargar</span></a></div>}
          </div>
          {loadingPdf ? (
            <div className="grid h-[600px] place-items-center bg-slate-100"><LoaderCircle className="size-7 animate-spin text-cobalt" /></div>
          ) : pdfUrl && inlinePreview ? (
            <iframe src={pdfUrl} title={`PDF de factura ${invoice.number}`} className="h-[640px] w-full bg-slate-100 xl:h-[calc(100%-66px)]" />
          ) : pdfUrl ? (
            <div className="grid h-[600px] place-items-center bg-slate-50 p-8 text-center"><div><FileText className="mx-auto size-10 text-cobalt" /><p className="mt-4 text-sm font-bold text-navy">Vista previa no disponible en este navegador</p><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">En Android podés abrir el documento con el visor instalado o descargarlo sin enviarlo a servicios externos.</p><div className="mt-5 flex justify-center gap-2"><a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-primary"><ExternalLink className="size-4" />Abrir PDF</a><a href={pdfUrl} download={invoice.pdfName} className="btn-secondary"><Download className="size-4" />Descargar</a></div></div></div>
          ) : (
            <div className="grid h-[600px] place-items-center bg-slate-50 p-8 text-center"><div><AlertTriangle className="mx-auto size-8 text-amber-500" /><p className="mt-3 text-sm font-semibold text-slate-600">El PDF no está disponible.</p><p className="mt-1 text-xs text-slate-500">{pdfError || "Los metadatos se conservaron, pero el archivo local no pudo recuperarse."}</p></div></div>
          )}
        </section>

        <div className="space-y-5">
          <section className="panel p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Total del comprobante</p><p className="mt-2 text-3xl font-bold tracking-tight text-navy">{formatCurrency(invoice.amounts.total)}</p></div><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">ARS</span></div>
            <div className="mt-6 grid grid-cols-2 gap-4 border-y border-line py-5 text-sm">
              <DataItem label="Emisión" value={formatDate(invoice.issueDate)} />
              <DataItem label="Vencimiento" value={invoice.dueDate ? formatDate(invoice.dueDate) : "No informado"} />
              <DataItem label="Importe neto" value={formatCurrency(invoice.amounts.net)} />
              <DataItem label="IVA" value={formatCurrency(invoice.amounts.vat)} />
            </div>
            {invoice.status === "pending" && <button onClick={() => changeStatus("needs_review")} className="btn-primary mt-5 w-full"><Clock3 className="size-4" />Enviar a revisión</button>}
            {invoice.status === "needs_review" && <div className="mt-5 flex flex-col gap-3 sm:flex-row"><button onClick={() => setConfirmingApproval(true)} disabled={!canApprove} className="btn-primary flex-1 !bg-emerald-600 hover:!bg-emerald-700"><Check className="size-4" />Aprobar</button><button onClick={() => setRejecting(true)} className="btn-secondary flex-1 !border-rose-200 !text-rose-700 hover:!bg-rose-50"><X className="size-4" />Rechazar</button></div>}
            {(invoice.status === "approved" || invoice.status === "rejected") && <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Decisión final registrada. Esta demo no permite reabrir una factura aprobada o rechazada.</p>}
            {!canApprove && invoice.status === "needs_review" && <p className="mt-3 text-xs leading-5 text-amber-700">La aprobación está bloqueada mientras existan errores críticos o un duplicado detectado.</p>}
            {workflowError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{workflowError}</p>}
          </section>

          {confirmingApproval && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="text-sm font-bold text-emerald-900">Confirmar aprobación</h2>
              <p className="mt-2 text-xs leading-5 text-emerald-800">Vas a registrar una decisión final para {invoice.pointOfSale}-{invoice.number}. Esta acción no es automática.</p>
              <div className="mt-4 flex justify-end gap-2"><button onClick={() => setConfirmingApproval(false)} className="btn-secondary">Cancelar</button><button onClick={() => { if (changeStatus("approved")) setConfirmingApproval(false); }} className="btn-primary !bg-emerald-600"><Check className="size-4" />Confirmar aprobación</button></div>
            </section>
          )}

          {rejecting && (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <h2 className="text-sm font-bold text-rose-900">Motivo del rechazo</h2>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="field mt-3 min-h-24 resize-y" placeholder="Describí el motivo para dejar trazabilidad…" />
              <div className="mt-3 flex justify-end gap-2"><button onClick={() => setRejecting(false)} className="btn-secondary">Cancelar</button><button onClick={submitRejection} disabled={reason.trim().length < 5} className="btn-primary !bg-rose-600">Confirmar rechazo</button></div>
            </section>
          )}

          <section className="panel p-5 sm:p-6">
            <h2 className="font-bold text-navy">Controles automáticos</h2>
            <div className="mt-4 space-y-3">
              <CheckRow ok={invoice.validation.cuitValid} label="CUIT con dígito verificador válido" />
              <CheckRow ok={invoice.validation.amountConsistent} label="Neto + IVA coincide con el total" />
              <CheckRow ok={!invoice.validation.duplicate} label="No se encontró duplicado" />
            </div>
            {[...invoice.validation.errors, ...invoice.validation.warnings].map((message) => <div key={message} className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{message}</div>)}
            {invoice.validation.duplicateOf && <Link href={`/facturas/${invoice.validation.duplicateOf}`} className="mt-3 inline-flex text-xs font-bold text-cobalt">Abrir posible duplicado →</Link>}
          </section>

          <section className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="font-bold text-navy">Retenciones estimadas</h2><p className="mt-1 text-xs text-slate-500">Reglas configurables de demostración</p></div><ShieldCheck className="size-5 text-violet-500" /></div>
            <div className="mt-5 space-y-3">
              {invoice.retentionLines.length ? invoice.retentionLines.map((line) => (
                <div key={line.ruleId} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{line.ruleName}</span><strong className="text-navy">{formatCurrency(line.amount)}</strong></div>
                  <p className="mt-1 text-xs text-slate-500">{line.rate}% sobre {formatCurrency(line.base)}</p>
                </div>
              )) : <p className="text-sm text-slate-500">Ninguna regla se activa para esta factura.</p>}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-4"><span className="text-sm font-bold text-slate-600">Total estimado</span><strong className="text-lg text-violet-700">{formatCurrency(invoice.retentionTotal)}</strong></div>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">Cálculo ilustrativo. No contempla padrón, jurisdicción, régimen, certificados ni normativa vigente.</p>
          </section>

          <section className="panel p-5 sm:p-6">
            <h2 className="font-bold text-navy">Trazabilidad</h2>
            <div className="mt-5 space-y-4">
              {invoiceHistory.length ? invoiceHistory.map((entry) => (
                <div key={entry.id} className="flex gap-3"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-cobalt">{entry.action === "approved" ? <CheckCircle2 className="size-4" /> : entry.action === "rejected" ? <XCircle className="size-4" /> : <Clock3 className="size-4" />}</span><div><p className="text-xs font-semibold leading-5 text-slate-700">{entry.description}</p><p className="mt-1 text-[11px] text-slate-400">{entry.actor} · {formatDateTime(entry.timestamp)}</p></div></div>
              )) : <p className="text-sm text-slate-500">Todavía no hay movimientos registrados.</p>}
            </div>
          </section>

          {invoice.rejectionReason && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5"><div className="flex gap-3"><XCircle className="size-5 shrink-0 text-rose-600" /><div><h3 className="text-sm font-bold text-rose-900">Motivo del rechazo</h3><p className="mt-1 text-sm leading-6 text-rose-800">{invoice.rejectionReason}</p></div></div></div>}
        </div>
      </div>
    </div>
  );
}

function DataItem({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-700">{value}</p></div>;
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-600">{ok ? <CheckCircle2 className="size-5 text-emerald-500" /> : <AlertTriangle className="size-5 text-amber-500" />}{label}</div>;
}
