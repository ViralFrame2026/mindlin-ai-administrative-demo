"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  Download,
  FilePlus2,
  History,
  RotateCcw,
  Settings2,
  XCircle,
} from "lucide-react";
import { traceDescription } from "@/lib/presentation";
import { historyToCsv } from "@/lib/csv";
import { useAppStore } from "@/lib/store";
import type { HistoryAction } from "@/lib/types";
import { downloadTextFile, formatDateTime } from "@/lib/utils";
import { PageHeader } from "./ui";

const actionMeta: Record<
  HistoryAction,
  { label: string; icon: typeof History; style: string }
> = {
  seeded: {
    label: "Datos preparados",
    icon: History,
    style: "bg-slate-100 text-slate-600",
  },
  uploaded: {
    label: "Factura cargada",
    icon: FilePlus2,
    style: "bg-blue-50 text-blue-600",
  },
  review_started: {
    label: "Enviada a revisión",
    icon: Clock3,
    style: "bg-sky-50 text-sky-600",
  },
  approved: {
    label: "Aprobación",
    icon: CheckCircle2,
    style: "bg-emerald-50 text-emerald-600",
  },
  rejected: {
    label: "Rechazo",
    icon: XCircle,
    style: "bg-rose-50 text-rose-600",
  },
  rules_updated: {
    label: "Reglas actualizadas",
    icon: Settings2,
    style: "bg-violet-50 text-violet-600",
  },
  retention_recalculated: {
    label: "Recálculo explícito",
    icon: Settings2,
    style: "bg-violet-50 text-violet-600",
  },
  demo_reset: {
    label: "Demo restaurada",
    icon: RotateCcw,
    style: "bg-amber-50 text-amber-600",
  },
};

export function HistoryView() {
  const { history } = useAppStore();
  const exportCsv = () =>
    downloadTextFile(
      historyToCsv(history),
      "historial-mindlin-ai.csv",
      "text/csv;charset=utf-8",
    );

  return (
    <div>
      <PageHeader
        eyebrow="Auditoría local"
        title="Historial de operaciones"
        description="Registro cronológico de cargas, decisiones y cambios de configuración realizados en este navegador."
        actions={
          <button
            onClick={exportCsv}
            className="btn-secondary"
            disabled={!history.length}
          >
            <Download className="size-4" /> Exportar CSV
          </button>
        }
      />

      <section className="panel overflow-hidden">
        <div className="border-b border-line bg-slate-50/70 px-5 py-3 text-xs font-semibold text-slate-500">
          {history.length} movimientos registrados
        </div>
        <div className="divide-y divide-line">
          {history.map((entry) => {
            const meta = actionMeta[entry.action];
            const Icon = meta.icon;
            const content = (
              <div className="flex gap-4 px-5 py-5 transition hover:bg-slate-50 sm:px-6">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${meta.style}`}
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-bold text-navy">{meta.label}</p>
                    <time className="text-xs font-medium text-slate-400">
                      {formatDateTime(entry.timestamp)}
                    </time>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {traceDescription(entry.description)}
                  </p>
                  {entry.reason && (
                    <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                      <strong>Motivo:</strong> {entry.reason}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>{entry.actor}</span>
                    {entry.invoiceNumber && (
                      <>
                        <span>·</span>
                        <span className="font-semibold text-cobalt">
                          {entry.invoiceNumber}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
            return entry.invoiceId ? (
              <Link
                key={entry.id}
                href={`/facturas/${entry.invoiceId}`}
                className="block"
              >
                {content}
              </Link>
            ) : (
              <div key={entry.id}>{content}</div>
            );
          })}
        </div>
      </section>

      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-5 text-blue-800">
        El historial es demostrativo y se almacena en <strong>IndexedDB</strong>
        . No ofrece inmutabilidad, firma digital ni auditoría multiusuario; esas
        capacidades requieren backend y autenticación.
      </div>
    </div>
  );
}
