"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  initialState,
  addAdministrativeInvoice,
  changeAdministrativeStatus,
  changeAdministrativeRules,
  recalculateAdministrativeInvoice,
} from "./administration";
import { transactState, readRawAdministrativeState } from "./storage";
import type { AdministrativeState } from "./state-schema";
import {
  DEMO_ACTOR,
  type Invoice,
  type InvoiceStatus,
  type RetentionRule,
} from "./types";
import { downloadTextFile, uid } from "./utils";
export interface StatusUpdateResult {
  ok: boolean;
  error?: string;
}
interface AppStoreValue extends AdministrativeState {
  hydrated: boolean;
  addInvoice: (invoice: Invoice, file: File) => Promise<void>;
  updateInvoiceStatus: (
    id: string,
    status: InvoiceStatus,
    reason?: string,
  ) => Promise<StatusUpdateResult>;
  updateRules: (rules: RetentionRule[]) => Promise<void>;
  recalculateInvoice: (id: string, reason: string) => Promise<void>;
  resetDemo: () => Promise<void>;
}
const AppStore = createContext<AppStoreValue | null>(null);
export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdministrativeState>(() => initialState());
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const channel = useRef<BroadcastChannel | null>(null);
  const apply = useCallback(
    (next: AdministrativeState) =>
      setState((current) =>
        next.revision >= current.revision ? next : current,
      ),
    [],
  );
  useEffect(() => {
    let active = true;
    const refresh = () =>
      transactState(() => initialState(localStorage))
        .then((next) => {
          if (active) {
            apply(next);
            setHydrated(true);
          }
        })
        .catch((cause) => {
          console.error("[local-state]", cause);
          if (active)
            setError(
              cause instanceof Error
                ? cause.message
                : "No se pudo abrir el almacenamiento local.",
            );
        });
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("mindlin-administration-v2");
      channel.current.onmessage = refresh;
    }
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("pageshow", focus);
    void refresh();
    return () => {
      active = false;
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("focus", focus);
      window.removeEventListener("pageshow", focus);
    };
  }, [apply]);
  const commit = useCallback(
    async (operation: Parameters<typeof transactState>[1]) => {
      try {
        const next = await transactState(
          () => initialState(localStorage),
          operation,
        );
        apply(next);
        channel.current?.postMessage({ revision: next.revision });
      } catch (cause) {
        console.error("[local-operation] Operación no confirmada", cause);
        try {
          apply(await transactState(() => initialState(localStorage)));
        } catch {}
        throw cause;
      }
    },
    [apply],
  );
  const addInvoice = useCallback(
    async (invoice: Invoice, file: File) => {
      await commit((current, pdfs) => {
        if (!invoice.pdfStorageKey) throw new Error("Falta el archivo PDF.");
        const next = addAdministrativeInvoice(current, invoice);
        pdfs.put(file, invoice.pdfStorageKey);
        return next;
      });
    },
    [commit],
  );
  const updateInvoiceStatus = useCallback(
    async (
      id: string,
      status: InvoiceStatus,
      reason?: string,
    ): Promise<StatusUpdateResult> => {
      try {
        const expected =
          state.invoices.find((item) => item.id === id)?.revision ?? 0;
        await commit((current) =>
          changeAdministrativeStatus(current, id, expected, status, reason),
        );
        return { ok: true };
      } catch (cause) {
        return {
          ok: false,
          error:
            cause instanceof Error
              ? cause.message
              : "No se confirmó el cambio de estado.",
        };
      }
    },
    [commit, state.invoices],
  );
  const updateRules = useCallback(
    async (rules: RetentionRule[]) => {
      await commit((current) =>
        changeAdministrativeRules(current, rules, state.rulesVersion),
      );
    },
    [commit, state.rulesVersion],
  );
  const recalculateInvoice = useCallback(
    async (id: string, reason: string) => {
      const expected =
        state.invoices.find((item) => item.id === id)?.revision ?? 0;
      await commit((current) =>
        recalculateAdministrativeInvoice(current, id, expected, reason),
      );
    },
    [commit, state.invoices],
  );
  const resetDemo = useCallback(async () => {
    if (
      !window.confirm(
        "Se borrarán todas las facturas y PDFs locales, incluidos los cargados por vos. ¿Restaurar la demo?",
      )
    )
      return;
    await commit((current, pdfs) => {
      pdfs.clear();
      const seed = initialState();
      return {
        ...seed,
        rulesVersion: current.rulesVersion + 1,
        history: [
          {
            id: uid("history"),
            action: "demo_reset",
            description:
              "Se restauraron los datos ficticios tras confirmación explícita y se eliminaron los PDFs locales.",
            timestamp: new Date().toISOString(),
            actor: DEMO_ACTOR,
          },
          ...seed.history,
        ],
        invoices: seed.invoices.map((item) => ({
          ...item,
          retentionRulesVersion: current.rulesVersion + 1,
          revision:
            (current.invoices.find((previous) => previous.id === item.id)
              ?.revision ?? 0) + 1,
        })),
      };
    });
  }, [commit]);
  const value = useMemo(
    () => ({
      ...state,
      hydrated,
      addInvoice,
      updateInvoiceStatus,
      updateRules,
      recalculateInvoice,
      resetDemo,
    }),
    [
      state,
      hydrated,
      addInvoice,
      updateInvoiceStatus,
      updateRules,
      recalculateInvoice,
      resetDemo,
    ],
  );
  if (!hydrated)
    return (
      <div className="panel m-6 p-6" role={error ? "alert" : "status"}>
        {error || "Preparando datos locales…"}
        {error && (
          <button
            className="btn-secondary mt-4"
            onClick={async () => {
              try {
                const current = await readRawAdministrativeState();
                const legacy = Object.fromEntries(
                  [
                    "mindlin.invoices.v1",
                    "mindlin.retention-rules.v1",
                    "mindlin.history.v1",
                  ].map((key) => [key, localStorage.getItem(key)]),
                );
                downloadTextFile(
                  JSON.stringify({ current, legacy }, null, 2),
                  "mindlin-recuperacion.json",
                  "application/json",
                );
              } catch (cause) {
                console.error("[local-recovery]", cause);
                setError(
                  "No se pudo descargar la copia. Conservá este navegador y solicitá recuperación técnica.",
                );
              }
            }}
          >
            Descargar copia para recuperación
          </button>
        )}
      </div>
    );
  return <AppStore.Provider value={value}>{children}</AppStore.Provider>;
}
export function useAppStore() {
  const store = useContext(AppStore);
  if (!store)
    throw new Error("useAppStore debe usarse dentro de AppStoreProvider.");
  return store;
}
