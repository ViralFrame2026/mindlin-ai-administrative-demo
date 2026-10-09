import Link from "next/link";
import { ArrowLeft, ArrowUpRight, type LucideIcon } from "lucide-react";
import type { InvoiceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {backHref && (
          <Link href={backHref} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-cobalt">
            <ArrowLeft className="size-4" /> Volver
          </Link>
        )}
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-cobalt">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const statusStyles: Record<InvoiceStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-50 text-amber-700 ring-amber-600/15" },
  needs_review: { label: "En revisión", className: "bg-blue-50 text-blue-700 ring-blue-600/15" },
  approved: { label: "Aprobada", className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  rejected: { label: "Rechazada", className: "bg-rose-50 text-rose-700 ring-rose-600/15" },
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const style = statusStyles[status];
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset", style.className)}>{style.label}</span>;
}

export function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "blue",
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "blue" | "green" | "amber" | "violet";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-navy">{value}</p>
        </div>
        <span className={cn("grid size-10 place-items-center rounded-xl", tones[tone])}><Icon className="size-5" /></span>
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500">{detail}</p>
    </div>
  );
}

export function SectionTitle({ title, description, href }: { title: string; description?: string; href?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="font-bold text-navy">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {href && <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-cobalt">Ver todo <ArrowUpRight className="size-4" /></Link>}
    </div>
  );
}
