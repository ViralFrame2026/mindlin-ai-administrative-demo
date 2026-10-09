"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_HISTORY, DEMO_INVOICES } from "./demo-data";
import { calculateRetentions, DEFAULT_RETENTION_RULES } from "./retention";
import { clearPdfBlobs, savePdfBlob } from "./storage";
import { DEMO_ACTOR, type HistoryEntry, type Invoice, type InvoiceStatus, type RetentionRule } from "./types";
import { uid } from "./utils";
import { invoiceKey } from "./validation";
import { initializeInvoiceWorkflow, transitionInvoice, validateStatusTransition } from "./workflow";

const INVOICE_KEY = "mindlin.invoices.v1";
const RULES_KEY = "mindlin.retention-rules.v1";
const HISTORY_KEY = "mindlin.history.v1";

interface AppStoreValue {
  invoices: Invoice[];
  rules: RetentionRule[];
  history: HistoryEntry[];
  hydrated: boolean;
  addInvoice: (invoice: Invoice, file: File) => Promise<void>;
  updateInvoiceStatus: (invoiceId: string, status: InvoiceStatus, reason?: string) => StatusUpdateResult;
  updateRules: (rules: RetentionRule[]) => void;
  resetDemo: () => Promise<void>;
}

export interface StatusUpdateResult {
  ok: boolean;
  error?: string;
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
  const pendingAdds = useRef(new Set<string>());

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
    const businessKey = invoiceKey(invoice);
    const hashKey = invoice.pdfHash ? `hash:${invoice.pdfHash}` : "";
    const duplicate = invoices.find(
      (existing) => (invoice.pdfHash && existing.pdfHash === invoice.pdfHash) || invoiceKey(existing) === businessKey,
    );
    if (duplicate || pendingAdds.current.has(businessKey) || (hashKey && pendingAdds.current.has(hashKey))) {
      throw new Error(duplicate
        ? `La factura ya existe como ${duplicate.pointOfSale}-${duplicate.number}.`
        : "La misma factura ya se está guardando.");
    }
    pendingAdds.current.add(businessKey);
    if (hashKey) pendingAdds.current.add(hashKey);
    const pendingInvoice = initializeInvoiceWorkflow(invoice);
    try {
      await savePdfBlob(invoice.pdfStorageKey, file);
      setInvoices((current) => [pendingInvoice, ...current]);
      setHistory((current) => [
        {
          id: uid("history"),
          action: "uploaded",
          description: `Factura ${invoice.pointOfSale}-${invoice.number} cargada desde PDF en estado Pendiente.`,
          timestamp: new Date().toISOString(),
          actor: DEMO_ACTOR,
          invoiceId: invoice.id,
          invoiceNumber: `${invoice.pointOfSale}-${invoice.number}`,
        },
        ...current,
      ]);
    } finally {
      pendingAdds.current.delete(businessKey);
      if (hashKey) pendingAdds.current.delete(hashKey);
    }
  }, [invoices]);

  const updateInvoiceStatus = useCallback(
    (invoiceId: string, status: InvoiceStatus, reason?: string) => {
      const target = invoices.find((invoice) => invoice.id === invoiceId);
      if (!target) return { ok: false, error: "No se encontró la factura." };
      const validation = validateStatusTransition(target, status, reason);
      if (!validation.allowed) return { ok: false, error: validation.error };
      const timestamp = new Date().toISOString();
      setInvoices((current) =>
        current.map((invoice) =>
          invoice.id === invoiceId
            ? transitionInvoice(invoice, status, reason, timestamp)
            : invoice,
        ),
      );
      const action = status === "needs_review" ? "review_started" : status === "approved" ? "approved" : "rejected";
      const invoiceNumber = `${target.pointOfSale}-${target.number}`;
      const description = status === "needs_review"
        ? `Factura ${invoiceNumber} enviada a revisión administrativa.`
        : status === "approved"
          ? `Factura ${invoiceNumber} aprobada por confirmación explícita.`
          : `Factura ${invoiceNumber} rechazada. Motivo: ${reason?.trim()}.`;
      setHistory((current) => [
        {
          id: uid("history"),
          action,
          description,
          timestamp,
          actor: DEMO_ACTOR,
          invoiceId,
          invoiceNumber,
          reason: status === "rejected" ? reason?.trim() : undefined,
          fromStatus: target.status,
          toStatus: status,
        },
        ...current,
      ]);
      return { ok: true };
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
        actor: DEMO_ACTOR,
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
        actor: DEMO_ACTOR,
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
