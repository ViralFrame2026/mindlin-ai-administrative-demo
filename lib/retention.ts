import type { MoneyBreakdown, RetentionLine, RetentionRule } from "./types";

export const DEFAULT_RETENTION_RULES: RetentionRule[] = [
  {
    id: "ganancias-servicios",
    name: "Ganancias · servicios",
    code: "GAN-SRV",
    enabled: true,
    rate: 2,
    minimum: 100_000,
    base: "net",
  },
  {
    id: "iibb-demo",
    name: "Ingresos Brutos · demo",
    code: "IIBB-BA",
    enabled: true,
    rate: 1.5,
    minimum: 50_000,
    base: "net",
  },
  {
    id: "suss-demo",
    name: "SUSS · demo",
    code: "SUSS",
    enabled: false,
    rate: 1,
    minimum: 400_000,
    base: "total",
  },
];

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateRetentions(
  amounts: MoneyBreakdown,
  rules: RetentionRule[],
) {
  validateRetentionRules(rules);
  if (
    ![amounts.net, amounts.vat, amounts.total].every(
      (value) => Number.isFinite(value) && value >= 0,
    )
  )
    throw new Error(
      "Los importes de cálculo deben ser finitos y no negativos.",
    );
  const lines: RetentionLine[] = rules
    .filter((rule) => rule.enabled)
    .map((rule) => {
      const selectedBase = rule.base === "net" ? amounts.net : amounts.total;
      const taxableBase = Math.max(0, selectedBase - rule.minimum);
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        base: roundMoney(taxableBase),
        rate: rule.rate,
        amount: roundMoney((taxableBase * rule.rate) / 100),
      };
    })
    .filter((line) => line.base > 0);

  return {
    lines,
    total: roundMoney(lines.reduce((sum, line) => sum + line.amount, 0)),
  };
}

export function validateRetentionRules(rules: RetentionRule[]) {
  if (
    !rules.length ||
    new Set(rules.map((rule) => rule.id)).size !== rules.length
  )
    throw new Error("Las reglas requieren identificadores únicos.");
  for (const rule of rules) {
    if (
      !Number.isFinite(rule.rate) ||
      rule.rate < 0 ||
      rule.rate > 100 ||
      !Number.isFinite(rule.minimum) ||
      rule.minimum < 0 ||
      !["net", "total"].includes(rule.base)
    )
      throw new Error(
        "Las alícuotas deben estar entre 0 y 100 y los mínimos deben ser finitos no negativos.",
      );
  }
}
