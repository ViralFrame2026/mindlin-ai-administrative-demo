"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEMO_HISTORY, DEMO_INVOICES } from "./demo-data";
import { calculateRetentions, DEFAULT_RETENTION_RULES } from "./retention";
import { clearPdfBlobs, savePdfBlob } from "./storage";
import type { HistoryEntry, Invoice, InvoiceStatus, RetentionRule } from "./types";
import { uid } from "./utils";

const INVOICE_KEY = "mindlin.invoices.v1";
const RULES_KEY = "mindlin.retention-rules.v1";
const HISTORY_KEY = "mindlin.history.v1";

interface AppStoreValue {
  invoices: Invoice[];
  rules: RetentionRule[];
  history: HistoryEntry[];
  hydrated: boolean;
  addInvoice: (invoice: Invoice, file: File) => Promise<void>;
  updateInvoiceStatus: (invoiceId: string, status: InvoiceStatus, reason?: string) => void;
  updateRules: (rules: RetentionRule[]) => void;
  resetDemo: () => Promise<void>;
}

const AppStore = createContext<AppStoreValue | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>(DEMO_INVOICES);
  const [rules, setRules] = useState<RetentionRule[]>(DEFAULT_RETENTION_RULES);
  const [history, setHistory] = useState<HistoryEntry[]>(DEMO_HISTORY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setInvoices(readStorage(INVOICE_KEY, DEMO_INVOICES));
    setRules(readStorage(RULES_KEY, DEFAULT_RETENTION_RULES));
    setHistory(readStorage(HISTORY_KEY, DEMO_HISTORY));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(INVOICE_KEY, JSON.stringify(invoices));
  }, [hydrated, invoices]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(RULES_KEY, JSON.stringify(rules));
  }, [hydrated, rules]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history, hydrated]);

  const addInvoice = useCallback(async (invoice: Invoice, file: File) => {
    if (!invoice.pdfStorageKey) throw new Error("Falta la clave de almacenamiento del PDF.");
    await savePdfBlob(invoice.pdfStorageKey, file);
    setInvoices((current) => [invoice, ...current]);
    setHistory((current) => [
      {
        id: uid("history"),
        action: "uploaded",
        description: `Factura ${invoice.pointOfSale}-${invoice.number} cargada y procesada desde PDF.`,
        timestamp: new Date().toISOString(),
        actor: "María González",
        invoiceId: invoice.id,
        invoiceNumber: `${invoice.pointOfSale}-${invoice.number}`,
      },
      ...current,
    ]);
  }, []);

  const updateInvoiceStatus = useCallback(
    (invoiceId: string, status: InvoiceStatus, reason?: string) => {
      const target = invoices.find((invoice) => invoice.id === invoiceId);
      if (!target) return;
      const timestamp = new Date().toISOString();
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === invoiceId
            ? { ...invoice, status, rejectionReason: status === "rejected" ? reason : undefined, updatedAt: timestamp }
            : invoice,
        ),
      );
      const action = status === "approved" ? "approved" : "rejected";
      setHistory((current) => [
        {
          id: uid("history"),
          action,
          description:
            status === "approved"
              ? `Factura ${target.pointOfSale}-${target.number} aprobada por el circuito administrativo.`
              : `Factura ${target.pointOfSale}-${target.number} rechazada. Motivo: ${reason || "Sin detalle"}.`,
          timestamp,
          actor: "María González",
          invoiceId,
          invoiceNumber: `${target.pointOfSale}-${target.number}`,
        },
        ...current,
      ]);
    },
    [invoices],
  );

  const updateRules = useCallback((nextRules: RetentionRule[]) => {
    setRules(nextRules);
    setInvoices((current) =>
      current.map((invoice) => {
        const retention = calculateRetentions(invoice.amounts, nextRules);
        return { ...invoice, retentionLines: retention.lines, retentionTotal: retention.total };
      }),
    );
    setHistory((current) => [
      {
        id: uid("history"),
        action: "rules_updated",
        description: "Se actualizaron las reglas demostrativas de retención y se recalcularon las facturas.",
        timestamp: new Date().toISOString(),
        actor: "María González",
      },
      ...current,
    ]);
  }, []);

  const resetDemo = useCallback(async () => {
    await clearPdfBlobs();
    setInvoices(DEMO_INVOICES);
    setRules(DEFAULT_RETENTION_RULES);
    setHistory([
      {
        id: uid("history"),
        action: "demo_reset",
        description: "Se restauraron los datos ficticios de la demostración.",
        timestamp: new Date().toISOString(),
        actor: "María González",
      },
      ...DEMO_HISTORY,
    ]);
  }, []);

  const value = useMemo(
    () => ({ invoices, rules, history, hydrated, addInvoice, updateInvoiceStatus, updateRules, resetDemo }),
    [invoices, rules, history, hydrated, addInvoice, updateInvoiceStatus, updateRules, resetDemo],
  );

  return <AppStore.Provider value={value}>{children}</AppStore.Provider>;
}

export function useAppStore() {
  const store = useContext(AppStore);
  if (!store) throw new Error("useAppStore debe usarse dentro de AppStoreProvider.");
  return store;
}
