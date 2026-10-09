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
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/retenciones", label: "Retenciones", icon: ShieldCheck },
  { href: "/historial", label: "Historial", icon: History },
];

function Brand({ onNavigate }: { onNavigate?: () => void } = {}) {
  return (
    <Link href="/" onClick={onNavigate} className="flex items-center gap-3" aria-label="Mindlin AI, inicio">
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
  const menuRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const menu = menuRef.current;
    if (mobileOpen && menu && !menu.open) menu.showModal();
    if (!mobileOpen && menu?.open) menu.close();
    if (mobileOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = previous; };
    }
  }, [mobileOpen]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const close = () => { if (media.matches) setMobileOpen(false); };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:p-3 focus:text-navy">Ir al contenido</a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-navy px-4 py-6 md:flex">
        <div className="px-2"><Brand /></div>
        <nav className="mt-10 space-y-1.5" aria-label="Navegación principal">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
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

      <dialog ref={menuRef} id="mobile-menu" aria-label="Menú de navegación" onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }} onCancel={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto border-0 bg-navy p-6 text-white backdrop:bg-navy/60">
          <div className="flex items-center justify-between">
            <Brand onNavigate={() => setMobileOpen(false)} />
            <button onClick={() => setMobileOpen(false)} className="min-h-11 min-w-11 rounded-xl p-2 text-white" aria-label="Cerrar menú">
              <X />
            </button>
          </div>
          <p className="mt-6 text-sm text-blue-200">María González · usuario demo · datos locales</p>
          <nav className="mt-10 space-y-2" aria-label="Navegación móvil">
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
      </dialog>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button className="min-h-11 min-w-11 rounded-lg p-2 text-ink md:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menú" aria-haspopup="dialog" aria-expanded={mobileOpen} aria-controls="mobile-menu">
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
            <Link href="/historial" className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-line text-slate-500" aria-label="Ver historial de operaciones"><Bell className="size-4" /></Link>
            <div className="flex items-center gap-2 border-l border-line pl-3">
              <span className="grid size-9 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">MG</span>
              <span className="text-xs font-semibold text-ink sm:text-sm"><span className="hidden lg:inline">María González · </span><span>Usuario demo</span></span>
            </div>
          </div>
        </header>
        <main id="contenido" tabIndex={-1} className="mx-auto max-w-[1500px] px-4 py-6 pb-24 md:pb-8 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <nav aria-label="Navegación inferior" className="fixed inset-x-0 bottom-0 z-40 grid min-h-[68px] grid-cols-5 border-t border-line bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
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
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center justify-center gap-1 text-[10px] font-medium", active ? "text-cobalt" : "text-slate-500")}>
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
