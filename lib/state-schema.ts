import { z } from "zod";
import { isValidIsoDate } from "./validation";
import type { Invoice, HistoryEntry, RetentionRule } from "./types";
const finite = z.number().finite();
const rule = z
  .object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    enabled: z.boolean(),
    rate: finite.min(0).max(100),
    minimum: finite.min(0),
    base: z.enum(["net", "total"]),
  })
  .passthrough();
const invoice = z
  .object({
    id: z.string(),
    administrativeId: z.string().optional(),
    number: z.string(),
    type: z.string(),
    pointOfSale: z.string(),
    issueDate: z.string().refine(isValidIsoDate, "Fecha de emisión inválida"),
    dueDate: z
      .string()
      .refine(isValidIsoDate, "Vencimiento inválido")
      .optional(),
    supplier: z.object({ name: z.string(), cuit: z.string() }),
    amounts: z.object({
      net: finite,
      vat: finite,
      total: finite,
      currency: z.literal("ARS"),
    }),
    status: z.enum(["pending", "needs_review", "approved", "rejected"]),
    source: z.enum(["demo", "uploaded"]),
    pdfName: z.string(),
    pdfSize: finite,
    pdfUrl: z.string().optional(),
    pdfStorageKey: z.string().optional(),
    pdfHash: z.string().optional(),
    pages: finite,
    createdAt: z.string(),
    updatedAt: z.string(),
    validation: z
      .object({
        cuitValid: z.boolean(),
        amountConsistent: z.boolean(),
        duplicate: z.boolean(),
        errors: z.array(z.string()),
        warnings: z.array(z.string()),
      })
      .passthrough(),
    retentionLines: z.array(
      z.object({
        ruleId: z.string(),
        ruleName: z.string(),
        base: finite,
        rate: finite,
        amount: finite,
      }),
    ),
    retentionTotal: finite,
    revision: z.number().int().nonnegative().optional(),
    extractionWarnings: z.array(z.string()).optional(),
    extractionConfirmed: z.boolean().optional(),
    retentionRulesVersion: z.number().int().positive().optional(),
    retentionRulesSnapshot: z.array(rule).optional(),
  })
  .passthrough();
const history = z
  .object({
    id: z.string(),
    administrativeId: z.string().optional(),
    action: z.enum([
      "seeded",
      "uploaded",
      "review_started",
      "approved",
      "rejected",
      "rules_updated",
      "demo_reset",
      "retention_recalculated",
    ]),
    description: z.string(),
    timestamp: z.string(),
    actor: z.string(),
  })
  .passthrough();
const schema = z.object({
  schemaVersion: z.literal(2),
  revision: z.number().int().nonnegative(),
  rulesVersion: z.number().int().positive(),
  nextAdministrativeNumber: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  invoices: z.array(invoice),
  rules: z.array(rule),
  history: z.array(history),
});
export interface AdministrativeState {
  schemaVersion: 2;
  revision: number;
  rulesVersion: number;
  nextAdministrativeNumber?: number;
  invoices: Invoice[];
  rules: RetentionRule[];
  history: HistoryEntry[];
}
export function parseState(value: unknown): AdministrativeState {
  return schema.parse(value) as AdministrativeState;
}
