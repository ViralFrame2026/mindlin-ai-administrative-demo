import { DEMO_HISTORY, DEMO_INVOICES } from "./demo-data";
import {
  calculateRetentions,
  DEFAULT_RETENTION_RULES,
  validateRetentionRules,
} from "./retention";
import { parseState, type AdministrativeState } from "./state-schema";
import {
  DEMO_ACTOR,
  type Invoice,
  type InvoiceStatus,
  type RetentionRule,
  type HistoryEntry,
} from "./types";
import { invoiceData, validateInvoice } from "./validation";
import { initializeInvoiceWorkflow, transitionInvoice } from "./workflow";
import { uid } from "./utils";
export function initialState(
  storage?: Pick<Storage, "getItem">,
): AdministrativeState {
  const keys = [
    "mindlin.invoices.v1",
    "mindlin.retention-rules.v1",
    "mindlin.history.v1",
  ];
  const raw = keys.map((key) => storage?.getItem(key));
  try {
    if (
      raw.some((value) => value !== null && value !== undefined) &&
      raw.some((value) => value === null || value === undefined)
    )
      throw new Error(
        "Almacenamiento anterior incompleto: se requiere recuperación manual.",
      );
    const rules = raw[1] ? JSON.parse(raw[1]) : DEFAULT_RETENTION_RULES;
    const invoices: Invoice[] = raw[0] ? JSON.parse(raw[0]) : DEMO_INVOICES;
    const history = raw[2] ? JSON.parse(raw[2]) : DEMO_HISTORY;
    const checked = parseState({
      schemaVersion: 2,
      revision: 0,
      rulesVersion: 1,
      invoices,
      rules,
      history,
    });
    return {
      ...checked,
      invoices: checked.invoices.map((invoice) => ({
        ...invoice,
        revision: invoice.revision ?? 0,
        retentionRulesVersion: invoice.retentionRulesVersion ?? 1,
        retentionRulesSnapshot: invoice.retentionRulesSnapshot ?? rules,
        validation: validateInvoice(
          invoiceData(invoice),
          checked.invoices.filter((other) => other.id !== invoice.id),
          invoice.pdfHash,
        ),
      })),
    };
  } catch (cause) {
    console.error(
      "[local-migration] Datos conservados; migración detenida",
      cause,
    );
    throw new Error(
      "No pudimos migrar los datos locales. Las claves anteriores y los PDFs se conservaron. Exportá una copia antes de restaurar o solicitar recuperación.",
    );
  }
}
function event(
  action: HistoryEntry["action"],
  description: string,
  extra: Partial<HistoryEntry> = {},
): HistoryEntry {
  return {
    id: uid("history"),
    action,
    description,
    timestamp: new Date().toISOString(),
    actor: DEMO_ACTOR,
    ...extra,
  };
}
function checkedInvoice(
  state: AdministrativeState,
  id: string,
  expected: number,
) {
  const invoice = state.invoices.find((item) => item.id === id);
  if (!invoice) throw new Error("No se encontró la factura.");
  if ((invoice.revision ?? 0) !== expected)
    throw new Error(
      "Otra pestaña modificó esta factura. Revisá el estado actualizado y volvé a intentar.",
    );
  return invoice;
}
export function addAdministrativeInvoice(
  state: AdministrativeState,
  invoice: Invoice,
): AdministrativeState {
  const validation = validateInvoice(
    invoiceData(invoice),
    state.invoices,
    invoice.pdfHash,
  );
  if (validation.errors.length || validation.duplicate)
    throw new Error(
      validation.duplicate
        ? "La factura ya existe: se detectó un duplicado."
        : validation.errors.join(" "),
    );
  if (invoice.extractionWarnings?.length && !invoice.extractionConfirmed)
    throw new Error("Confirmá manualmente las advertencias de extracción.");
  const retention = calculateRetentions(invoice.amounts, state.rules);
  const pending = {
    ...initializeInvoiceWorkflow(invoice),
    validation,
    revision: 0,
    retentionRulesVersion: state.rulesVersion,
    retentionRulesSnapshot: state.rules,
    retentionLines: retention.lines,
    retentionTotal: retention.total,
  };
  return {
    ...state,
    invoices: [pending, ...state.invoices],
    history: [
      event(
        "uploaded",
        `Factura ${invoice.pointOfSale}-${invoice.number} cargada en estado Pendiente.`,
        {
          invoiceId: invoice.id,
          invoiceNumber: `${invoice.pointOfSale}-${invoice.number}`,
        },
      ),
      ...state.history,
    ],
  };
}
export function changeAdministrativeStatus(
  state: AdministrativeState,
  id: string,
  expected: number,
  target: InvoiceStatus,
  reason?: string,
): AdministrativeState {
  const original = checkedInvoice(state, id, expected);
  const validation = validateInvoice(
    invoiceData(original),
    state.invoices.filter((item) => item.id !== id),
    original.pdfHash,
  );
  const next = {
    ...transitionInvoice({ ...original, validation }, target, reason),
    revision: expected + 1,
  };
  return {
    ...state,
    invoices: state.invoices.map((item) => (item.id === id ? next : item)),
    history: [
      event(
        target === "approved"
          ? "approved"
          : target === "rejected"
            ? "rejected"
            : "review_started",
        `Factura ${original.pointOfSale}-${original.number}: ${original.status} → ${target}.`,
        {
          invoiceId: id,
          invoiceNumber: `${original.pointOfSale}-${original.number}`,
          fromStatus: original.status,
          toStatus: target,
          reason: reason?.trim(),
        },
      ),
      ...state.history,
    ],
  };
}
export function changeAdministrativeRules(
  state: AdministrativeState,
  rules: RetentionRule[],
  expectedVersion: number,
): AdministrativeState {
  validateRetentionRules(rules);
  if (state.rulesVersion !== expectedVersion)
    throw new Error(
      "Otra pestaña cambió las reglas. Revisá la nueva versión antes de guardar.",
    );
  const version = state.rulesVersion + 1;
  return {
    ...state,
    rules,
    rulesVersion: version,
    history: [
      event(
        "rules_updated",
        `Reglas demostrativas versión ${version}. Los cálculos existentes se conservaron.`,
        {
          before: { version: state.rulesVersion, rules: state.rules },
          after: { version, rules },
        },
      ),
      ...state.history,
    ],
  };
}
export function recalculateAdministrativeInvoice(
  state: AdministrativeState,
  id: string,
  expected: number,
  reason: string,
): AdministrativeState {
  if (reason.trim().length < 5)
    throw new Error(
      "El recálculo requiere un motivo de al menos cinco caracteres.",
    );
  const original = checkedInvoice(state, id, expected);
  const validation = validateInvoice(invoiceData(original), []);
  if (validation.errors.length)
    throw new Error(
      "No se puede recalcular una factura con importes inválidos.",
    );
  const calculation = calculateRetentions(original.amounts, state.rules);
  const next = {
    ...original,
    retentionLines: calculation.lines,
    retentionTotal: calculation.total,
    retentionRulesVersion: state.rulesVersion,
    retentionRulesSnapshot: state.rules,
    revision: expected + 1,
    updatedAt: new Date().toISOString(),
  };
  return {
    ...state,
    invoices: state.invoices.map((item) => (item.id === id ? next : item)),
    history: [
      event(
        "retention_recalculated",
        `Recálculo explícito: ${original.retentionTotal} → ${next.retentionTotal} ARS; reglas v${original.retentionRulesVersion ?? 1} → v${state.rulesVersion}.`,
        {
          invoiceId: id,
          reason: reason.trim(),
          before: {
            total: original.retentionTotal,
            lines: original.retentionLines,
            version: original.retentionRulesVersion,
          },
          after: {
            total: next.retentionTotal,
            lines: next.retentionLines,
            version: next.retentionRulesVersion,
          },
        },
      ),
      ...state.history,
    ],
  };
}
