"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileText,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MetricCard, PageHeader, SectionTitle, StatusBadge } from "./ui";

export function DashboardView() {
  const { invoices, resetDemo } = useAppStore();
  const [resetting, setResetting] = useState(false);
  const stats = useMemo(() => {
    const approved = invoices.filter((invoice) => invoice.status === "approved");
    return {
      total: invoices.reduce((sum, invoice) => sum + invoice.amounts.total, 0),
      pending: invoices.filter((invoice) => invoice.status === "pending" || invoice.status === "needs_review").length,
      approved: approved.length,
      retained: approved.reduce((sum, invoice) => sum + invoice.retentionTotal, 0),
    };
  }, [invoices]);

  const handleReset = async () => {
    setResetting(true);
    await resetDemo();
    setResetting(false);
  };

  const statusCount = (status: string) => invoices.filter((invoice) => invoice.status === status).length;
  const totalCount = Math.max(invoices.length, 1);
  const chart = [36, 54, 42, 68, 59, 86, 72, 94, 77, Math.min(100, 38 + invoices.length * 11)];

  return (
    <div>
      <PageHeader
        eyebrow="Centro de control"
        title="Buen día, María"
        description="Seguí el circuito de facturas, validaciones y aprobaciones desde un solo lugar."
        actions={
          <>
            <button onClick={handleReset} disabled={resetting} className="btn-secondary">
              <RotateCcw className="size-4" /> {resetting ? "Restaurando…" : "Reiniciar demo"}
            </button>
            <Link href="/facturas/nueva" className="btn-primary"><Plus className="size-4" /> Cargar factura</Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Volumen administrado" value={formatCurrency(stats.total)} detail={`${invoices.length} comprobantes registrados`} icon={CircleDollarSign} />
        <MetricCard title="En cola" value={String(stats.pending)} detail="Pendientes o en revisión" icon={Clock3} tone="amber" />
        <MetricCard title="Aprobadas" value={String(stats.approved)} detail="Con validación administrativa" icon={FileCheck2} tone="green" />
        <MetricCard title="Retenciones demo" value={formatCurrency(stats.retained)} detail="Solo sobre facturas aprobadas" icon={Sparkles} tone="violet" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <section className="panel p-5 sm:p-6">
          <SectionTitle title="Procesamiento de facturas" description="Evolución ilustrativa de los últimos 10 períodos" />
          <div className="mt-8 flex h-56 items-end gap-2 sm:gap-3" aria-label="Gráfico de procesamiento">
            {chart.map((height, index) => (
              <div key={index} className="group flex h-full flex-1 items-end">
                <div
                  className="relative w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-300 transition group-hover:from-blue-700"
                  style={{ height: `${height}%` }}
                >
                  <span className="absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded bg-navy px-1.5 py-1 text-[10px] text-white group-hover:block">{height}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[10px] font-medium uppercase tracking-wider text-slate-400">
            <span>Período 1</span><span>Período 10</span>
          </div>
        </section>

        <section className="panel p-5 sm:p-6">
          <SectionTitle title="Estado del circuito" description="Distribución actual" />
          <div className="mt-6 flex flex-col items-center gap-7 sm:flex-row xl:flex-col 2xl:flex-row">
            <div
              className="relative grid size-40 shrink-0 place-items-center rounded-full"
              style={{
                background: `conic-gradient(#10b981 0 ${(statusCount("approved") / totalCount) * 100}%, #f59e0b 0 ${((statusCount("approved") + statusCount("pending")) / totalCount) * 100}%, #3b82f6 0 ${((statusCount("approved") + statusCount("pending") + statusCount("needs_review")) / totalCount) * 100}%, #f43f5e 0)`,
              }}
            >
              <div className="grid size-28 place-items-center rounded-full bg-white text-center">
                <span><strong className="block text-3xl text-navy">{invoices.length}</strong><small className="text-xs text-slate-500">facturas</small></span>
              </div>
            </div>
            <div className="w-full space-y-3">
              {[
                ["Aprobadas", statusCount("approved"), "bg-emerald-500"],
                ["Pendientes", statusCount("pending"), "bg-amber-500"],
                ["A revisar", statusCount("needs_review"), "bg-blue-500"],
                ["Rechazadas", statusCount("rejected"), "bg-rose-500"],
              ].map(([label, count, color]) => (
                <div key={String(label)} className="flex items-center text-sm">
                  <span className={`mr-2.5 size-2.5 rounded-full ${color}`} />
                  <span className="text-slate-600">{label}</span>
                  <strong className="ml-auto text-navy">{count}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="p-5 pb-1 sm:p-6 sm:pb-2"><SectionTitle title="Facturas recientes" description="Últimos movimientos incorporados" href="/facturas" /></div>
          <div className="divide-y divide-line">
            {invoices.slice(0, 4).map((invoice) => (
              <Link key={invoice.id} href={`/facturas/${invoice.id}`} className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50 sm:px-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500"><FileText className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{invoice.supplier.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{invoice.pointOfSale}-{invoice.number} · {formatDate(invoice.issueDate)}</p>
                </div>
                <div className="hidden text-right sm:block"><p className="text-sm font-bold text-navy">{formatCurrency(invoice.amounts.total)}</p><div className="mt-1"><StatusBadge status={invoice.status} /></div></div>
                <ArrowRight className="size-4 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="panel border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 sm:p-6">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700"><CheckCircle2 className="size-5" /></span>
              <div>
                <h2 className="font-bold text-navy">Extracción PDF real</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Los archivos digitales se procesan en el servidor. Los datos quedan editables antes de confirmar.</p>
                <Link href="/facturas/nueva" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-cobalt">Probar con un PDF <ArrowRight className="size-4" /></Link>
              </div>
            </div>
          </div>
          <div className="panel border-amber-100 bg-amber-50/60 p-5">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div>
                <h3 className="text-sm font-bold text-amber-900">Alcance del prototipo</h3>
                <p className="mt-1.5 text-xs leading-5 text-amber-800">Sin OCR para escaneos. Las retenciones son reglas demostrativas y no reemplazan validación fiscal o contable.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
