"use client";

import {
  Calculator,
  Check,
  Info,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { calculateRetentions, DEFAULT_RETENTION_RULES } from "@/lib/retention";
import { useAppStore } from "@/lib/store";
import type { RetentionRule } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "./ui";

export function RetentionRules() {
  const { rules, updateRules } = useAppStore();
  const [draft, setDraft] = useState<RetentionRule[]>(rules);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(rules), [rules]);

  const example = useMemo(() => {
    try {
      return calculateRetentions(
        { net: 825_000, vat: 173_250, total: 998_250, currency: "ARS" },
        draft,
      );
    } catch {
      return null;
    }
  }, [draft]);
  const update = (id: string, changes: Partial<RetentionRule>) => {
    setSaved(false);
    setDraft((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...changes } : rule)),
    );
  };
  const save = async () => {
    setSaved(false);
    setError("");
    try {
      await updateRules(draft);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se guardaron las reglas.",
      );
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Motor demostrativo"
        title="Reglas de retención"
        description="Configurá tasas, mínimos y bases para simular el cálculo. Los cambios crean una nueva versión. Las facturas conservan su cálculo hasta un recálculo explícito."
        actions={
          <button className="btn-primary" onClick={save}>
            {saved ? <Check className="size-4" /> : <Save className="size-4" />}
            {saved ? "Guardado" : "Guardar reglas"}
          </button>
        }
      />

      {error && (
        <p role="alert" className="mb-4 text-sm text-rose-700">
          {error}
        </p>
      )}
      <div className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <Info className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <p>
          <strong>Estas reglas no son oficiales.</strong> No consultan padrones,
          jurisdicciones, acumulados ni normativa de ARCA u organismos
          provinciales. Sirven únicamente para demostrar un flujo configurable.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <section className="space-y-4">
          {draft.map((rule) => (
            <div key={rule.id} className="panel p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <span
                  className={`grid size-11 shrink-0 place-items-center rounded-xl ${rule.enabled ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-400"}`}
                >
                  <ShieldCheck className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-bold text-navy">{rule.name}</h2>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        Código {rule.code}
                      </p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(event) =>
                          update(rule.id, { enabled: event.target.checked })
                        }
                        className="peer sr-only"
                      />
                      <span className="relative h-6 w-11 rounded-full bg-slate-200 transition after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-cobalt peer-checked:after:translate-x-5" />
                      {rule.enabled ? "Activa" : "Inactiva"}
                    </label>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <label>
                      <span className="label">Alícuota</span>
                      <div className="relative">
                        <input
                          className="field pr-8"
                          aria-label="Alícuota"
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={Number.isFinite(rule.rate) ? rule.rate : ""}
                          onChange={(event) =>
                            update(rule.id, {
                              rate:
                                event.target.value === ""
                                  ? Number.NaN
                                  : Number(event.target.value),
                            })
                          }
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                          %
                        </span>
                      </div>
                    </label>
                    <label>
                      <span className="label">Mínimo no sujeto</span>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                          $
                        </span>
                        <input
                          className="field pl-7"
                          aria-label="Mínimo no sujeto"
                          type="number"
                          min="0"
                          step="1000"
                          value={
                            Number.isFinite(rule.minimum) ? rule.minimum : ""
                          }
                          onChange={(event) =>
                            update(rule.id, {
                              minimum:
                                event.target.value === ""
                                  ? Number.NaN
                                  : Number(event.target.value),
                            })
                          }
                        />
                      </div>
                    </label>
                    <label>
                      <span className="label">Base de cálculo</span>
                      <select
                        className="field"
                        value={rule.base}
                        onChange={(event) =>
                          update(rule.id, {
                            base: event.target.value as "net" | "total",
                          })
                        }
                      >
                        <option value="net">Importe neto</option>
                        <option value="total">Importe total</option>
                      </select>
                    </label>
                  </div>
                  <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Fórmula: máx(0, {rule.base === "net" ? "neto" : "total"} −{" "}
                    {formatCurrency(rule.minimum)}) × {rule.rate}%
                  </p>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => setDraft(DEFAULT_RETENTION_RULES)}
            className="btn-secondary"
          >
            <RotateCcw className="size-4" /> Restaurar valores sugeridos
          </button>
        </section>

        <aside className="panel h-fit p-5 sm:p-6 xl:sticky xl:top-24">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-cobalt">
              <Calculator className="size-5" />
            </span>
            <div>
              <h2 className="font-bold text-navy">Vista previa</h2>
              <p className="text-xs text-slate-500">
                Ejemplo sobre factura Norte
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-2xl bg-navy p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Base de ejemplo
            </p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(825_000)}</p>
            <p className="mt-1 text-xs text-slate-400">
              Neto · total {formatCurrency(998_250)}
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {example?.lines.map((line) => (
              <div
                key={line.ruleId}
                className="flex justify-between gap-3 text-sm"
              >
                <span className="text-slate-500">{line.ruleName}</span>
                <strong className="text-navy">
                  {formatCurrency(line.amount)}
                </strong>
              </div>
            ))}
            {!example?.lines.length && (
              <p className="text-sm text-slate-500">
                {example
                  ? "Ninguna regla activa supera su mínimo."
                  : "Configuración inválida: revisá alícuotas y mínimos."}
              </p>
            )}
          </div>
          <div className="mt-5 flex justify-between border-t border-line pt-4">
            <span className="font-bold text-slate-600">Total estimado</span>
            <strong className="text-lg text-violet-700">
              {example ? formatCurrency(example.total) : "Importes inválidos"}
            </strong>
          </div>
        </aside>
      </div>
    </div>
  );
}
