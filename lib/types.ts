export type InvoiceStatus =
  | "pending"
  | "needs_review"
  | "approved"
  | "rejected";
export type InvoiceSource = "demo" | "uploaded";

export const DEMO_ACTOR = "María González · usuario demo";

export interface MoneyBreakdown {
  net: number;
  vat: number;
  total: number;
  currency: "ARS";
}

export interface Supplier {
  name: string;
  cuit: string;
}

export interface ValidationResult {
  cuitValid: boolean;
  amountConsistent: boolean;
  duplicate: boolean;
  duplicateOf?: string;
  errors: string[];
  warnings: string[];
}

export interface RetentionLine {
  ruleId: string;
  ruleName: string;
  base: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  administrativeId?: string;
  number: string;
  type: string;
  pointOfSale: string;
  issueDate: string;
  dueDate?: string;
  supplier: Supplier;
  amounts: MoneyBreakdown;
  status: InvoiceStatus;
  source: InvoiceSource;
  pdfName: string;
  pdfSize: number;
  pdfUrl?: string;
  pdfStorageKey?: string;
  pdfHash?: string;
  pages: number;
  extractedTextPreview?: string;
  createdAt: string;
  updatedAt: string;
  validation: ValidationResult;
  retentionLines: RetentionLine[];
  retentionTotal: number;
  rejectionReason?: string;
  revision?: number;
  extractionWarnings?: string[];
  extractionConfirmed?: boolean;
  retentionRulesVersion?: number;
  retentionRulesSnapshot?: RetentionRule[];
}

export interface ExtractedInvoiceData {
  number: string;
  type: string;
  pointOfSale: string;
  issueDate: string;
  dueDate?: string;
  supplierName: string;
  supplierCuit: string;
  net: number;
  vat: number;
  total: number;
}

export interface RetentionRule {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
  rate: number;
  minimum: number;
  base: "net" | "total";
}

export type HistoryAction =
  | "seeded"
  | "uploaded"
  | "review_started"
  | "approved"
  | "rejected"
  | "rules_updated"
  | "demo_reset"
  | "retention_recalculated";

export interface HistoryEntry {
  id: string;
  action: HistoryAction;
  description: string;
  timestamp: string;
  actor: string;
  invoiceId?: string;
  administrativeId?: string;
  invoiceNumber?: string;
  reason?: string;
  fromStatus?: InvoiceStatus;
  toStatus?: InvoiceStatus;
  before?: unknown;
  after?: unknown;
}
