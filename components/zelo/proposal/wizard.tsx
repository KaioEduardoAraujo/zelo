"use client";

import { ArrowLeft, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FormField } from "@/components/zelo/form-field";
import { PhoneInput } from "@/components/zelo/masked-inputs";
import { ErrosProvider, useErros } from "@/components/zelo/proposal/erros-context";
import { EscopoFields, ValoresFields, type MudarConteudo } from "@/components/zelo/proposal/fields";
import { ProposalDocument } from "@/components/zelo/proposal/proposal-document";
import { SaveIndicator } from "@/components/zelo/proposal/save-indicator";
import { Stepper } from "@/components/zelo/proposal/stepper";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { maskPhone } from "@/lib/masks";
import {
  ETAPAS,
  etapaDoCampo,
  normalizarConteudo,
  validarEtapa,
  validarTudo,
  type DraftForm,
  type Etapa,
} from "@/lib/proposals/draft";
import { salvarRascunho, type SalvarRascunhoEntrada } from "@/lib/proposals/actions";
import { totalCentavos } from "@/lib/validation/proposta";

type WizardProps = {
  propostaId: string;
  inicial: DraftForm;
  etapaInicial: Etapa;
  prestador: { nome: string; empresa: string | null };
};

/**
 * Assistente de proposta em 4 etapas (DESIGN.md 7.2.4): Cliente → Escopo → Valores → Revisar.
 * Desktop largo: formulário à esquerda e pré-visualização ao vivo à direita. Mobile: botão
 * "Ver como o cliente verá" abre a pré-visualização numa bottom sheet.
 *
 * Cada alteração agenda um autosave (debounce de 1,5 s). O avanço de etapa é validado.
 */
export function ProposalWizard({ propostaId, inicial, etapaInicial, prestador }: WizardProps) {
  const router = useRouter();
  const [form, setForm] = useState(inicial);
  const formRef = useRef(inicial); // valor mais recente, para handlers que rodam em sequência
  const [etapa, setEtapa] = useState<Etapa>(etapaInicial);
  const [tentou, setTentou] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [previewAberto, setPreviewAberto] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  const { state, schedule, flush, controller } = useAutosave<SalvarRascunhoEntrada>(salvarRascunho);

  const mudar = useCallback(
    (fn: (f: DraftForm) => DraftForm) => {
      const proximo = fn(formRef.current);
      formRef.current = proximo;
      setForm(proximo);
      schedule({
        id: propostaId,
        cliente: {
          nome: proximo.clienteNome,
          email: proximo.clienteEmail,
          telefone: proximo.clienteTelefone,
          titulo: proximo.titulo,
        },
        conteudo: proximo.conteudo,
      });
    },
    [propostaId, schedule],
  );

  const mudarConteudo: MudarConteudo = useCallback(
    (fn) =>
      mudar((f) => {
        const conteudo = fn(f.conteudo);
        // O total acompanha os itens na tela; o servidor recalcula de qualquer forma.
        return {
          ...f,
          conteudo: { ...conteudo, valor_total_centavos: totalCentavos(conteudo.itens) },
        };
      }),
    [mudar],
  );

  const erros = useMemo(() => validarEtapa(etapa, form), [etapa, form]);
  const documento = useMemo(() => normalizarConteudo(form.conteudo), [form.conteudo]);

  /* Foco no título da etapa ao trocar (leitores de tela e teclado acompanham). */
  const primeiraRender = useRef(true);
  useEffect(() => {
    if (primeiraRender.current) {
      primeiraRender.current = false;
      return;
    }
    tituloRef.current?.focus();
  }, [etapa]);

  /* Avisa ao sair com alterações ainda não salvas e salva ao esconder a aba. */
  useEffect(() => {
    const aoSair = (e: BeforeUnloadEvent) => {
      if (controller.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("beforeunload", aoSair);
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      window.removeEventListener("beforeunload", aoSair);
      document.removeEventListener("visibilitychange", aoEsconder);
    };
  }, [controller, flush]);

  const irPara = (destino: Etapa) => {
    setEtapa(destino);
    setTentou(false);
    window.history.replaceState(null, "", `?etapa=${destino}`);
    window.scrollTo({ top: 0 });
  };

  const focarPrimeiroErro = () => {
    setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 60);
  };

  const avancar = async () => {
    if (etapa === 2) {
      // Linhas de exclusão em branco não bloqueiam: somem sozinhas antes de validar.
      mudarConteudo((c) => ({ ...c, exclusoes: c.exclusoes.filter((e) => e.trim() !== "") }));
    }
    setTentou(true);
    if (Object.keys(validarEtapa(etapa, formRef.current)).length > 0) {
      focarPrimeiroErro();
      return;
    }
    const salvou = await flush();
    if (!salvou) {
      toast.error("Não conseguimos salvar agora.", {
        description: "Seus dados continuam aqui. Tente de novo.",
      });
    }
    irPara((etapa + 1) as Etapa);
  };

  const concluir = async () => {
    setTentou(true);
    if (Object.keys(validarTudo(formRef.current)).length > 0) return;
    setFinalizando(true);
    const salvou = await flush();
    if (!salvou) {
      setFinalizando(false);
      toast.error("Não conseguimos salvar agora.", {
        description: "Seus dados continuam aqui. Tente de novo.",
      });
      return;
    }
    router.push(`/propostas/${propostaId}`);
  };

  const preview = (
    <ProposalDocument
      titulo={form.titulo}
      prestador={{ nome: prestador.nome, empresa: prestador.empresa }}
      clienteNome={form.clienteNome}
      conteudo={documento}
      validade={{ dias: documento.validade_dias }}
    />
  );

  const ultima = etapa === 4;

  return (
    <ErrosProvider erros={erros} mostrarTodos={tentou}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Link
            href={`/propostas/${propostaId}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] text-support font-semibold text-navy-700 hover:text-navy-950"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Sair do assistente
          </Link>
          <SaveIndicator state={state} onRetry={() => void flush()} />
        </div>

        <h1 className="sr-only">Proposta em edição</h1>
        <Stepper atual={etapa} onIr={irPara} />

        <div className={ultima ? "" : "grid gap-8 xl:grid-cols-[minmax(0,1fr)_26rem]"}>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void (ultima ? concluir() : avancar());
            }}
            className="min-w-0"
          >
            <h2
              ref={tituloRef}
              tabIndex={-1}
              className="mb-5 text-h2 text-navy-950 outline-none max-md:sr-only"
            >
              {ETAPAS[etapa - 1].titulo}
            </h2>

            {!ultima && (
              <Button
                type="button"
                variant="secondary"
                className="mb-5 w-full sm:w-auto xl:hidden"
                onClick={() => setPreviewAberto(true)}
              >
                <Eye aria-hidden="true" />
                Ver como o cliente verá
              </Button>
            )}

            {etapa === 1 && <EtapaCliente form={form} mudar={mudar} />}
            {etapa === 2 && <EscopoFields conteudo={form.conteudo} mudar={mudarConteudo} />}
            {etapa === 3 && <ValoresFields conteudo={form.conteudo} mudar={mudarConteudo} />}
            {etapa === 4 && (
              <EtapaRevisar form={form} erros={erros} preview={preview} onIr={irPara} />
            )}

            <div className="sticky bottom-0 z-20 -mx-4 mt-8 flex gap-3 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-8 md:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-0">
              {etapa > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => irPara((etapa - 1) as Etapa)}
                  className="flex-1 sm:flex-none"
                >
                  Voltar
                </Button>
              )}
              <Button
                type="submit"
                disabled={finalizando}
                className="flex-[2] sm:min-w-44 sm:flex-none"
              >
                {ultima ? (finalizando ? "Salvando…" : "Concluir rascunho") : "Continuar"}
              </Button>
            </div>
          </form>

          {!ultima && (
            <aside aria-label="Pré-visualização do documento" className="hidden xl:block">
              <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-[var(--radius-card)]">
                <p className="mb-2 text-support font-semibold text-slate-600">
                  Como o cliente verá
                </p>
                {preview}
              </div>
            </aside>
          )}
        </div>
      </div>

      <Sheet open={previewAberto} onOpenChange={setPreviewAberto}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Como o cliente verá</SheetTitle>
            <SheetDescription>
              É assim que o documento aparece para quem recebe o link.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>{preview}</SheetBody>
        </SheetContent>
      </Sheet>
    </ErrosProvider>
  );
}

/* ----------------------------- Etapa 1 ----------------------------- */

function EtapaCliente({
  form,
  mudar,
}: {
  form: DraftForm;
  mudar: (fn: (f: DraftForm) => DraftForm) => void;
}) {
  const { erro, tocar } = useErros();
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <FormField id="cliente-nome" label="Nome do cliente" error={erro("cliente.nome")}>
        {(a11y) => (
          <Input
            {...a11y}
            autoComplete="off"
            value={form.clienteNome}
            onChange={(e) => mudar((f) => ({ ...f, clienteNome: e.target.value }))}
            onBlur={() => tocar("cliente.nome")}
          />
        )}
      </FormField>
      <FormField
        id="cliente-email"
        label="E-mail do cliente"
        hint="É para onde vai o código que confirma o aceite e a cópia do comprovante."
        error={erro("cliente.email")}
      >
        {(a11y) => (
          <Input
            {...a11y}
            type="email"
            inputMode="email"
            autoComplete="off"
            value={form.clienteEmail}
            onChange={(e) => mudar((f) => ({ ...f, clienteEmail: e.target.value }))}
            onBlur={() => tocar("cliente.email")}
          />
        )}
      </FormField>
      <FormField
        id="cliente-telefone"
        label="WhatsApp do cliente"
        optional
        hint="Usado para abrir a conversa já com a mensagem pronta."
        error={erro("cliente.telefone")}
      >
        {(a11y) => (
          <PhoneInput
            {...a11y}
            defaultValue={form.clienteTelefone}
            onValueChange={(d) => mudar((f) => ({ ...f, clienteTelefone: d }))}
            onBlur={() => tocar("cliente.telefone")}
          />
        )}
      </FormField>
      <FormField id="titulo" label="Título da proposta" error={erro("cliente.titulo")}>
        {(a11y) => (
          <Input
            {...a11y}
            autoComplete="off"
            value={form.titulo}
            onChange={(e) => mudar((f) => ({ ...f, titulo: e.target.value }))}
            onBlur={() => tocar("cliente.titulo")}
          />
        )}
      </FormField>
    </div>
  );
}

/* ----------------------------- Etapa 4 ----------------------------- */

function EtapaRevisar({
  form,
  erros,
  preview,
  onIr,
}: {
  form: DraftForm;
  erros: Record<string, string>;
  preview: React.ReactNode;
  onIr: (etapa: Etapa) => void;
}) {
  const problemas = Object.entries(erros);

  return (
    <div className="flex max-w-[var(--container-doc)] flex-col gap-6">
      {problemas.length > 0 ? (
        <section
          aria-labelledby="falta-titulo"
          className="rounded-[var(--radius-card)] border border-danger/30 bg-danger-bg px-4 py-4"
        >
          <h3 id="falta-titulo" className="text-h3 text-danger">
            Falta preencher
          </h3>
          <ul className="mt-2 space-y-2">
            {problemas.map(([campo, mensagem]) => (
              <li
                key={campo}
                className="flex items-start justify-between gap-3 text-support text-navy-900"
              >
                <span>{mensagem}</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onIr(etapaDoCampo(campo))}
                >
                  Corrigir
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-support text-slate-600">
          Tudo certo. Confira o documento abaixo; ele fica salvo como rascunho.
        </p>
      )}

      <dl className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
        {[
          ["Cliente", form.clienteNome || "—", 1 as Etapa],
          ["E-mail", form.clienteEmail || "—", 1 as Etapa],
          [
            "WhatsApp",
            form.clienteTelefone ? maskPhone(form.clienteTelefone) : "Não informado",
            1 as Etapa,
          ],
        ].map(([rotulo, valor, etapa]) => (
          <div key={rotulo as string} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <dt className="text-label text-slate-600">{rotulo as string}</dt>
              <dd className="text-support break-words text-navy-900">{valor as string}</dd>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => onIr(etapa as Etapa)}>
              <Pencil aria-hidden="true" />
              Editar
              <span className="sr-only"> {rotulo as string}</span>
            </Button>
          </div>
        ))}
      </dl>

      {preview}
    </div>
  );
}
