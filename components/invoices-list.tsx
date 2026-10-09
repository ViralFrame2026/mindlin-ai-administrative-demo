"use client";

import Link from "next/link";
import { Download, FileText, Filter, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { matchesInvoiceSearch } from "@/lib/invoice-search";
import { invoicesToCsv } from "@/lib/csv";
import { useAppStore } from "@/lib/store";
import type { InvoiceStatus } from "@/lib/types";
import { downloadTextFile, formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader, StatusBadge } from "./ui";

const filters: Array<{ value: "all" | InvoiceStatus; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "needs_review", label: "En revisión" },
  { value: "approved", label: "Aprobadas" },
  { value: "rejected", label: "Rechazadas" },
];

export function InvoicesList() {
  const { invoices } = useAppStore();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | InvoiceStatus>("all");
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const matchesStatus = status === "all" || invoice.status === status;
      const matchesSearch = matchesInvoiceSearch(invoice, needle);
      return matchesStatus && matchesSearch;
    });
  }, [invoices, search, status]);

  const exportCsv = () => {
    downloadTextFile(invoicesToCsv(visible), "facturas-mindlin-ai.csv", "text/csv;charset=utf-8");
  };

  return (
    <div>
      <PageHeader
        eyebrow="Gestión documental"
        title="Facturas"
        description="Consultá, filtrá y administrá los comprobantes procesados."
        actions={
          <>
            <button className="btn-secondary" onClick={exportCsv} disabled={!visible.length}><Download className="size-4" /> Exportar CSV</button>
            <Link href="/facturas/nueva" className="btn-primary"><Plus className="size-4" /> Nueva factura</Link>
          </>
        }
      />

      <section className="panel overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block max-w-lg flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input aria-label="Buscar facturas" type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="field pl-10" placeholder="Buscar por proveedor, CUIT o comprobante…" />
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              <Filter className="size-4 shrink-0 text-slate-400" />
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  aria-pressed={status === filter.value}
                  onClick={() => setStatus(filter.value)}
                  className={`min-h-11 shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${status === filter.value ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <p role="status" className="mt-3 text-xs font-medium text-slate-500">{visible.length} de {invoices.length} comprobantes</p>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-5 py-3.5 font-bold">Proveedor</th>
                <th className="px-5 py-3.5 font-bold">Comprobante</th>
                <th className="px-5 py-3.5 font-bold">Fecha</th>
                <th className="px-5 py-3.5 text-right font-bold">Total</th>
                <th className="px-5 py-3.5 text-right font-bold">Retención demo</th>
                <th className="px-5 py-3.5 font-bold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((invoice) => (
                <tr key={invoice.id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <Link href={`/facturas/${invoice.id}`} className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600"><FileText className="size-4" /></span>
                      <span><strong className="block text-sm text-navy">{invoice.supplier.name}</strong><small className="mt-0.5 block text-xs text-slate-500">{invoice.supplier.cuit}</small></span>
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-700">{invoice.type} · {invoice.pointOfSale}-{invoice.number}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatDate(invoice.issueDate)}</td>
                  <td className="px-5 py-4 text-right text-sm font-bold text-navy">{formatCurrency(invoice.amounts.total)}</td>
                  <td className="px-5 py-4 text-right text-sm text-slate-600">{formatCurrency(invoice.retentionTotal)}</td>
                  <td className="px-5 py-4"><StatusBadge status={invoice.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-line md:hidden">
          {visible.map((invoice) => (
            <Link key={invoice.id} href={`/facturas/${invoice.id}`} className="block p-4 active:bg-slate-50">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><FileText className="size-5" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-navy">{invoice.supplier.name}</p><p className="mt-1 text-xs text-slate-500">{invoice.type} · {invoice.pointOfSale}-{invoice.number}</p></div>
                <StatusBadge status={invoice.status} />
              </div>
              <div className="mt-4 flex items-end justify-between border-t border-dashed border-line pt-3"><span className="text-xs text-slate-500">{formatDate(invoice.issueDate)}</span><strong className="text-sm text-navy">{formatCurrency(invoice.amounts.total)}</strong></div>
            </Link>
          ))}
        </div>

        {!visible.length && (
          <div className="grid place-items-center px-5 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400"><FileText /></span>
            <h2 className="mt-4 font-bold text-navy">No hay resultados</h2>
            <p className="mt-1 text-sm text-slate-500">Probá con otra búsqueda o filtro.</p>
          </div>
        )}
      </section>
    </div>
  );
}
