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

export function calculateRetentions(amounts: MoneyBreakdown, rules: RetentionRule[]) {
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
