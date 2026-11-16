"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/zelo/form-field";
import { MoneyInput } from "@/components/zelo/masked-inputs";
import { useErros } from "@/components/zelo/proposal/erros-context";
import { formatCentavos } from "@/lib/format";
import { formatDecimal, onlyDigits, parseDecimal } from "@/lib/masks";
import { totalItemCentavos, type ConteudoRascunho } from "@/lib/validation/proposta";

/** Altera o conteúdo recebendo o estado anterior (evita perder edições rápidas seguidas). */
export type MudarConteudo = (fn: (c: ConteudoRascunho) => ConteudoRascunho) => void;

type CamposProps = { conteudo: ConteudoRascunho; mudar: MudarConteudo };

const UNIDADES = ["un", "m²", "m", "m³", "h", "dia", "mês", "kg", "vb"];
const MAX_ITENS = 100;
const MAX_EXCLUSOES = 50;

/**
 * Quantidade digitada em português ("22,5"). Guarda o TEXTO enquanto a pessoa digita
 * (para "22," não virar "22" no meio da digitação) e só avisa o pai quando o texto vira
 * um número válido. Se o valor mudar por fora (ex.: item removido acima), refaz o texto.
 */
function QuantityInput({
  value,
  onValue,
  ...props
}: { value: number; onValue: (n: number) => void } & Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "defaultValue"
>) {
  const [text, setText] = useState(formatDecimal(value));
  const [anterior, setAnterior] = useState(value);
  if (value !== anterior) {
    // "Ajustar estado durante a renderização": recomendado pelo React para derivar de props.
    setAnterior(value);
    if (parseDecimal(text) !== value) setText(formatDecimal(value));
  }

  return (
    <Input
      {...props}
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const bruto = e.target.value.replace(/[^\d.,\s]/g, "");
        setText(bruto);
        const n = parseDecimal(bruto);
        // Texto vazio ou incompleto vira 0: a validação aponta "maior que zero".
        onValue(n === null ? 0 : Math.round(n * 100) / 100);
      }}
      onBlur={(e) => {
        const n = parseDecimal(text);
        if (n !== null) setText(formatDecimal(Math.round(n * 100) / 100));
        props.onBlur?.(e);
      }}
    />
  );
}

/* ---------------- Etapa 2: escopo, itens e exclusões ---------------- */

export function EscopoFields({ conteudo, mudar }: CamposProps) {
  const { erro, tocar } = useErros();
  const itens = conteudo.itens;

  const alterarItem = (i: number, patch: Partial<ConteudoRascunho["itens"][number]>) =>
    mudar((c) => ({ ...c, itens: c.itens.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));

  return (
    <div className="flex flex-col gap-8">
      <FormField
        id="escopo"
        label="O que será feito"
        hint="Escreva como se explicasse ao cliente. Quanto mais claro, menos chance de “eu não pedi isso”."
        error={erro("escopo")}
      >
        {(a11y) => (
          <Textarea
            {...a11y}
            rows={6}
            value={conteudo.escopo}
            onChange={(e) => mudar((c) => ({ ...c, escopo: e.target.value }))}
            onBlur={() => tocar("escopo")}
          />
        )}
      </FormField>

      <section aria-labelledby="itens-titulo" className="flex flex-col gap-3">
        <div>
          <h3 id="itens-titulo" className="text-h3 text-navy-950">
            Itens
          </h3>
          <p className="text-support text-slate-600">
            Cada serviço ou produto da proposta. Os valores entram na próxima etapa.
          </p>
        </div>

        {erro("itens") && itens.length === 0 && (
          <p role="alert" className="text-support text-danger">
            {erro("itens")}
          </p>
        )}

        <datalist id="unidades">
          {UNIDADES.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>

        <ul className="flex flex-col gap-3">
          {itens.map((item, i) => (
            <li
              key={i}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-hairline)]"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-support font-semibold text-navy-900">Item {i + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover item ${i + 1}`}
                  onClick={() => mudar((c) => ({ ...c, itens: c.itens.filter((_, j) => j !== i) }))}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                <FormField
                  id={`item-${i}-descricao`}
                  label="Descrição"
                  error={erro(`itens.${i}.descricao`)}
                >
                  {(a11y) => (
                    <Input
                      {...a11y}
                      value={item.descricao}
                      onChange={(e) => alterarItem(i, { descricao: e.target.value })}
                      onBlur={() => tocar(`itens.${i}.descricao`)}
                    />
                  )}
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    id={`item-${i}-quantidade`}
                    label="Quantidade"
                    error={erro(`itens.${i}.quantidade`)}
                  >
                    {(a11y) => (
                      <QuantityInput
                        {...a11y}
                        value={item.quantidade}
                        onValue={(quantidade) => alterarItem(i, { quantidade })}
                        onBlur={() => tocar(`itens.${i}.quantidade`)}
                      />
                    )}
                  </FormField>
                  <FormField
                    id={`item-${i}-unidade`}
                    label="Unidade"
                    error={erro(`itens.${i}.unidade`)}
                  >
                    {(a11y) => (
                      <Input
                        {...a11y}
                        list="unidades"
                        maxLength={10}
                        value={item.unidade}
                        onChange={(e) => alterarItem(i, { unidade: e.target.value })}
                        onBlur={() => tocar(`itens.${i}.unidade`)}
                      />
                    )}
                  </FormField>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="secondary"
          disabled={itens.length >= MAX_ITENS}
          className="self-start"
          onClick={() =>
            mudar((c) => ({
              ...c,
              itens: [
                ...c.itens,
                { descricao: "", unidade: "un", quantidade: 1, valor_unitario_centavos: 0 },
              ],
            }))
          }
        >
          <Plus aria-hidden="true" />
          Adicionar item
        </Button>
      </section>

      <section aria-labelledby="exclusoes-titulo" className="flex flex-col gap-3">
        <div>
          <h3 id="exclusoes-titulo" className="text-h3 text-navy-950">
            O que não está incluso
          </h3>
          <p className="text-support text-slate-600">
            Aparece em destaque para o cliente. É o que mais evita cobranças contestadas depois.
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {conteudo.exclusoes.map((texto, i) => (
            <li key={i} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <FormField
                  id={`exclusao-${i}`}
                  label={`Exclusão ${i + 1}`}
                  error={erro(`exclusoes.${i}`)}
                >
                  {(a11y) => (
                    <Input
                      {...a11y}
                      value={texto}
                      onChange={(e) =>
                        mudar((c) => ({
                          ...c,
                          exclusoes: c.exclusoes.map((t, j) => (j === i ? e.target.value : t)),
                        }))
                      }
                      onBlur={() => tocar(`exclusoes.${i}`)}
                    />
                  )}
                </FormField>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-[1.6rem]"
                aria-label={`Remover exclusão ${i + 1}`}
                onClick={() =>
                  mudar((c) => ({ ...c, exclusoes: c.exclusoes.filter((_, j) => j !== i) }))
                }
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="secondary"
          disabled={conteudo.exclusoes.length >= MAX_EXCLUSOES}
          className="self-start"
          onClick={() => mudar((c) => ({ ...c, exclusoes: [...c.exclusoes, ""] }))}
        >
          <Plus aria-hidden="true" />
          Adicionar exclusão
        </Button>
      </section>
    </div>
  );
}

/* ---------- Etapa 3: valores, prazo, pagamento, garantia, validade ---------- */

export function ValoresFields({ conteudo, mudar }: CamposProps) {
  const { erro, tocar } = useErros();

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="valores-titulo" className="flex flex-col gap-3">
        <div>
          <h3 id="valores-titulo" className="text-h3 text-navy-950">
            Valor de cada item
          </h3>
          <p className="text-support text-slate-600">
            Informe o valor por unidade. O total de cada item e o da proposta são calculados.
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {conteudo.itens.map((item, i) => (
            <li
              key={i}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-hairline)]"
            >
              <p className="text-support font-semibold break-words text-navy-900">
                {item.descricao || `Item ${i + 1}`}
              </p>
              <p className="tabular mb-3 text-support text-slate-600">
                {formatDecimal(item.quantidade)} {item.unidade}
              </p>
              <FormField
                id={`valor-${i}`}
                label="Valor por unidade"
                error={erro(`itens.${i}.valor_unitario_centavos`)}
              >
                {(a11y) => (
                  <MoneyInput
                    {...a11y}
                    defaultCentavos={item.valor_unitario_centavos}
                    onBlur={() => tocar(`itens.${i}.valor_unitario_centavos`)}
                    onValueChange={(centavos) =>
                      mudar((c) => ({
                        ...c,
                        itens: c.itens.map((it, j) =>
                          j === i ? { ...it, valor_unitario_centavos: centavos } : it,
                        ),
                      }))
                    }
                  />
                )}
              </FormField>
              <p className="tabular mt-2 text-right text-support text-slate-600">
                Total do item:{" "}
                <span className="font-semibold text-navy-900">
                  {formatCentavos(totalItemCentavos(item))}
                </span>
              </p>
            </li>
          ))}
        </ul>

        <div
          aria-live="polite"
          className="flex items-baseline justify-between gap-4 rounded-[var(--radius-card)] border border-teal-600/25 bg-teal-50 px-4 py-3.5"
        >
          <p className="text-support font-semibold text-navy-900">Total da proposta</p>
          <p className="tabular text-h1 text-navy-950">
            {formatCentavos(conteudo.valor_total_centavos)}
          </p>
        </div>
        {erro("valor_total_centavos") && (
          <p role="alert" className="text-support text-danger">
            {erro("valor_total_centavos")}
          </p>
        )}
      </section>

      <div className="flex flex-col gap-5">
        <FormField
          id="prazo"
          label="Prazo"
          hint="Ex.: 15 dias úteis a partir do início da obra."
          error={erro("prazo")}
        >
          {(a11y) => (
            <Input
              {...a11y}
              value={conteudo.prazo}
              onChange={(e) => mudar((c) => ({ ...c, prazo: e.target.value }))}
              onBlur={() => tocar("prazo")}
            />
          )}
        </FormField>

        <FormField
          id="pagamento"
          label="Forma de pagamento"
          hint="Ex.: 40% na aprovação, 30% na metade e 30% na entrega, por Pix."
          error={erro("pagamento")}
        >
          {(a11y) => (
            <Textarea
              {...a11y}
              rows={3}
              value={conteudo.pagamento}
              onChange={(e) => mudar((c) => ({ ...c, pagamento: e.target.value }))}
              onBlur={() => tocar("pagamento")}
            />
          )}
        </FormField>

        <FormField
          id="garantia"
          label="Garantia"
          hint="Ex.: 12 meses sobre a mão de obra."
          error={erro("garantia")}
        >
          {(a11y) => (
            <Input
              {...a11y}
              value={conteudo.garantia}
              onChange={(e) => mudar((c) => ({ ...c, garantia: e.target.value }))}
              onBlur={() => tocar("garantia")}
            />
          )}
        </FormField>

        <FormField
          id="validade_dias"
          label="Validade da proposta, em dias"
          hint="Conta a partir do envio. Depois disso, o cliente não consegue mais aceitar."
          error={erro("validade_dias")}
        >
          {(a11y) => (
            <Input
              {...a11y}
              inputMode="numeric"
              autoComplete="off"
              className="max-w-32"
              value={conteudo.validade_dias === 0 ? "" : String(conteudo.validade_dias)}
              onChange={(e) => {
                const digitos = onlyDigits(e.target.value).slice(0, 3);
                mudar((c) => ({ ...c, validade_dias: digitos === "" ? 0 : Number(digitos) }));
              }}
              onBlur={() => tocar("validade_dias")}
            />
          )}
        </FormField>

        <FormField id="observacoes" label="Observações" optional error={erro("observacoes")}>
          {(a11y) => (
            <Textarea
              {...a11y}
              rows={3}
              value={conteudo.observacoes ?? ""}
              onChange={(e) => mudar((c) => ({ ...c, observacoes: e.target.value }))}
              onBlur={() => tocar("observacoes")}
            />
          )}
        </FormField>
      </div>
    </div>
  );
}
