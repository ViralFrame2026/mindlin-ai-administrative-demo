"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  FileText,
  History,
  LayoutDashboard,
  Menu,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/retenciones", label: "Retenciones", icon: ShieldCheck },
  { href: "/historial", label: "Historial", icon: History },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="Mindlin AI, inicio">
      <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-cobalt to-blue-400 text-white shadow-lg shadow-blue-950/20">
        <Sparkles className="size-5" />
      </span>
      <span>
        <span className="block text-[17px] font-bold leading-none tracking-tight text-white">Mindlin AI</span>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Administración</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-navy px-4 py-6 md:flex">
        <div className="px-2"><Brand /></div>
        <nav className="mt-10 space-y-1.5" aria-label="Navegación principal">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition",
                  isActive(item.href)
                    ? "bg-white/10 text-white shadow-inner"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className={cn("size-[18px]", isActive(item.href) && "text-blue-400")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-blue-300">
            <span className="size-2 rounded-full bg-emerald-400" />
            PROTOTIPO ACTIVO
          </div>
          <p className="text-xs leading-5 text-slate-400">Persistencia local y datos ficticios para demostración.</p>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-navy p-6 md:hidden">
          <div className="flex items-center justify-between">
            <Brand />
            <button onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-white" aria-label="Cerrar menú">
              <X />
            </button>
          </div>
          <nav className="mt-10 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3.5 font-medium",
                    isActive(item.href) ? "bg-white/10 text-white" : "text-slate-300",
                  )}
                >
                  <Icon className="size-5" />{item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button className="rounded-lg p-2 text-ink md:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
            <Menu className="size-5" />
          </button>
          <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 md:flex">
            <span className="size-2 rounded-full bg-emerald-500" />
            Flujo administrativo operativo
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/facturas/nueva" className="btn-primary hidden !min-h-9 !px-3 !py-1.5 sm:inline-flex">
              <Plus className="size-4" /> Nueva factura
            </Link>
            <button className="relative rounded-xl border border-line p-2.5 text-slate-500" aria-label="Notificaciones">
              <Bell className="size-4" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-cobalt" />
            </button>
            <div className="flex items-center gap-2 border-l border-line pl-3">
              <span className="grid size-9 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">MG</span>
              <span className="hidden text-sm font-semibold text-ink lg:inline">María González</span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 border-t border-line bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {navigation.slice(0, 2).map((item) => {
          const Icon = item.icon;
          return <MobileNavItem key={item.href} {...item} active={isActive(item.href)} />;
        })}
        <Link href="/facturas/nueva" className="flex flex-col items-center justify-center gap-1 text-[10px] font-semibold text-cobalt">
          <span className="grid size-10 -translate-y-2 place-items-center rounded-full bg-cobalt text-white shadow-lg shadow-blue-300"><Plus className="size-5" /></span>
          <span className="-mt-2">Cargar</span>
        </Link>
        {navigation.slice(2).map((item) => <MobileNavItem key={item.href} {...item} active={isActive(item.href)} />)}
      </nav>
    </div>
  );
}

function MobileNavItem({ href, label, icon: Icon, active }: (typeof navigation)[number] & { active: boolean }) {
  return (
    <Link href={href} className={cn("flex flex-col items-center justify-center gap-1 text-[10px] font-medium", active ? "text-cobalt" : "text-slate-500")}>
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
