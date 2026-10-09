import type { AdministrativeState } from "./state-schema";

const pattern = /^FAC-(\d{6,})$/;
function sequence(id: string): number {
  const match = pattern.exec(id);
  const value = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(value) || value < 1 || id !== format(value))
    throw new Error(
      "Identificador administrativo inválido. Conservá los datos para recuperación.",
    );
  return value;
}
function format(value: number) {
  return `FAC-${String(value).padStart(6, "0")}`;
}

// Called inside the read/write transaction. No clock, random ID or array length.
export function assignAdministrativeIds(
  state: AdministrativeState,
  floor = 1,
): AdministrativeState {
  let next = Math.max(state.nextAdministrativeNumber ?? 1, floor);
  const used = new Set<string>();
  const internal = new Set<string>();
  for (const invoice of state.invoices) {
    if (internal.has(invoice.id))
      throw new Error(
        "Identificador interno duplicado. Se requiere recuperación.",
      );
    internal.add(invoice.id);
    if (!invoice.administrativeId) continue;
    const number = sequence(invoice.administrativeId);
    if (used.has(invoice.administrativeId))
      throw new Error(
        "Identificador administrativo duplicado. Se requiere recuperación.",
      );
    used.add(invoice.administrativeId);
    next = Math.max(next, number + 1);
  }
  if (!Number.isSafeInteger(next) || next < 1 || next >= Number.MAX_SAFE_INTEGER)
    throw new Error("Se agotó o invalidó la secuencia administrativa. Se requiere recuperación.");
  const assignments = new Map<string, string>();
  // Deterministic migration, independent of list ordering or locale.
  const missing = state.invoices
    .filter((item) => !item.administrativeId)
    .sort((a, b) =>
      a.createdAt < b.createdAt
        ? -1
        : a.createdAt > b.createdAt
          ? 1
          : a.id < b.id
            ? -1
            : a.id > b.id
              ? 1
              : 0,
    );
  for (const invoice of missing) {
    if (!Number.isSafeInteger(next) || next >= Number.MAX_SAFE_INTEGER)
      throw new Error(
        "Se agotó la secuencia administrativa. Se requiere recuperación.",
      );
    assignments.set(invoice.id, format(next++));
  }
  const invoices = state.invoices.map((invoice) => ({
    ...invoice,
    administrativeId: invoice.administrativeId ?? assignments.get(invoice.id)!,
  }));
  const ids = new Map(invoices.map((item) => [item.id, item.administrativeId]));
  return {
    ...state,
    nextAdministrativeNumber: next,
    invoices,
    history: state.history.map((entry) => ({
      ...entry,
      administrativeId:
        entry.administrativeId ??
        (entry.invoiceId ? ids.get(entry.invoiceId) : undefined),
    })),
  };
}
