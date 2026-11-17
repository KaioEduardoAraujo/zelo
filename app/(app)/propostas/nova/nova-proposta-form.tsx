"use client";

import { Check } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { FormField } from "@/components/zelo/form-field";
import { FormMessage } from "@/components/zelo/form-message";
import { PhoneInput } from "@/components/zelo/masked-inputs";
import { SubmitButton } from "@/components/zelo/submit-button";
import type { FormState } from "@/lib/auth/actions";
import { formatCentavos } from "@/lib/format";
import { criarRascunho } from "@/lib/proposals/actions";

export type ModeloOpcao = {
  id: string;
  titulo: string;
  nicho: string;
  proprio: boolean;
  escopo: string;
  itens: number;
  totalCentavos: number;
};

const CARTAO =
  "block h-full rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-hairline)] transition-colors duration-150 hover:border-line-strong peer-checked:border-teal-600 peer-checked:ring-2 peer-checked:ring-teal-600/25 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600";

export function NovaPropostaForm({
  modelos,
  preselecionado,
}: {
  modelos: ModeloOpcao[];
  preselecionado?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(criarRascunho, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};

  const [modelo, setModelo] = useState(v.modelo ?? preselecionado ?? "");
  const tituloInicial =
    v.titulo ?? modelos.find((m) => m.id === (v.modelo ?? preselecionado))?.titulo ?? "";
  const [titulo, setTitulo] = useState(tituloInicial);
  const tituloEditado = useRef(v.titulo !== undefined && v.titulo !== "");

  const escolher = (id: string, tituloDoModelo: string) => {
    setModelo(id);
    if (!tituloEditado.current) setTitulo(tituloDoModelo);
  };

  return (
    <form action={action} noValidate className="flex flex-col gap-8">
      {state.message && <FormMessage tone="error">{state.message}</FormMessage>}

      <fieldset className="min-w-0">
        <legend className="text-h3 text-navy-950">Comece por um modelo</legend>
        <p className="mt-1 mb-3 text-support text-slate-600">
          O modelo já traz escopo, itens, o que não está incluso e condições. Você ajusta tudo na
          próxima etapa.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {modelos.map((m) => (
            <label key={m.id} className="relative block cursor-pointer">
              <input
                type="radio"
                name="modelo"
                value={m.id}
                checked={modelo === m.id}
                onChange={() => escolher(m.id, m.titulo)}
                className="peer sr-only"
              />
              <span className={CARTAO}>
                <span className="block text-label text-slate-600">
                  {m.nicho}
                  {m.proprio && " · Meu modelo"}
                </span>
                <span className="mt-1 block pr-6 text-h3 text-navy-950">{m.titulo}</span>
                <span className="mt-1 line-clamp-2 hidden text-support text-slate-600 sm:block">
                  {m.escopo}
                </span>
                <span className="mt-3 flex items-baseline justify-between gap-3 text-support">
                  <span className="text-slate-600">
                    {m.itens} {m.itens === 1 ? "item" : "itens"}
                  </span>
                  <span className="tabular font-semibold text-navy-900">
                    {formatCentavos(m.totalCentavos)}
                  </span>
                </span>
              </span>
              <Check
                className="absolute top-3 right-3 hidden size-5 text-teal-600 peer-checked:block"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </label>
          ))}

          <label className="relative block cursor-pointer">
            <input
              type="radio"
              name="modelo"
              value="zero"
              checked={modelo === "zero"}
              onChange={() => escolher("zero", "")}
              className="peer sr-only"
            />
            <span className={CARTAO}>
              <span className="block text-label text-slate-600">Sem modelo</span>
              <span className="mt-1 block pr-6 text-h3 text-navy-950">Começar do zero</span>
              <span className="mt-1 block text-support text-slate-600">
                Você escreve o escopo e monta os itens do começo.
              </span>
            </span>
            <Check
              className="absolute top-3 right-3 hidden size-5 text-teal-600 peer-checked:block"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </label>
        </div>
        {state.message && !modelo && (
          <p className="mt-2 text-support text-danger">Escolha um modelo ou comece do zero.</p>
        )}
      </fieldset>

      <div className="flex max-w-xl flex-col gap-5">
        <h2 className="text-h3 text-navy-950">Para quem é</h2>
        <FormField id="nome" label="Nome do cliente" error={e.nome}>
          {(a11y) => (
            <Input {...a11y} name="nome" autoComplete="off" defaultValue={v.nome} required />
          )}
        </FormField>
        <FormField
          id="email"
          label="E-mail do cliente"
          hint="É para onde vai o código que confirma o aceite e a cópia do comprovante."
          error={e.email}
        >
          {(a11y) => (
            <Input
              {...a11y}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              defaultValue={v.email}
              required
            />
          )}
        </FormField>
        <FormField
          id="telefone"
          label="WhatsApp do cliente"
          optional
          hint="Usado para abrir a conversa já com a mensagem pronta."
          error={e.telefone}
        >
          {(a11y) => <PhoneInput {...a11y} name="telefone" defaultValue={v.telefone} />}
        </FormField>
        <FormField id="titulo" label="Título da proposta" error={e.titulo}>
          {(a11y) => (
            <Input
              {...a11y}
              name="titulo"
              autoComplete="off"
              value={titulo}
              onChange={(ev) => {
                tituloEditado.current = true;
                setTitulo(ev.target.value);
              }}
              required
            />
          )}
        </FormField>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 flex border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-8 md:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
        <SubmitButton pending={pending} pendingLabel="Criando…" className="sm:w-auto sm:min-w-44">
          Continuar
        </SubmitButton>
      </div>
    </form>
  );
}
