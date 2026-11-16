"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/zelo/form-field";
import { ErrosProvider, useErros } from "@/components/zelo/proposal/erros-context";
import { EscopoFields, ValoresFields, type MudarConteudo } from "@/components/zelo/proposal/fields";
import { NICHO_ORDER, NICHOS, type Nicho } from "@/lib/nichos";
import { validarModelo } from "@/lib/proposals/draft";
import { salvarModelo } from "@/lib/templates/actions";
import { totalCentavos, type ConteudoRascunho } from "@/lib/validation/proposta";

type Props = { id: string; titulo: string; nicho: Nicho; conteudo: ConteudoRascunho };

/** Editor de um modelo próprio: mesmos campos do assistente, numa página só, salvo no botão. */
export function TemplateEditor(props: Props) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(props.titulo);
  const [nicho, setNicho] = useState<Nicho>(props.nicho);
  const [conteudo, setConteudo] = useState(props.conteudo);
  const [tentou, setTentou] = useState(false);
  const [errosServidor, setErrosServidor] = useState<Record<string, string>>({});
  const [salvando, iniciar] = useTransition();

  const mudar: MudarConteudo = useCallback((fn) => {
    setConteudo((atual) => {
      const novo = fn(atual);
      return { ...novo, valor_total_centavos: totalCentavos(novo.itens) };
    });
  }, []);

  const erros = useMemo(
    () => ({ ...validarModelo(titulo, conteudo), ...errosServidor }),
    [titulo, conteudo, errosServidor],
  );

  const salvar = () => {
    // Linhas de exclusão em branco somem sozinhas antes de validar.
    const limpo = { ...conteudo, exclusoes: conteudo.exclusoes.filter((e) => e.trim() !== "") };
    setConteudo(limpo);
    setTentou(true);
    setErrosServidor({});
    if (Object.keys(validarModelo(titulo, limpo)).length > 0) {
      setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 60);
      return;
    }
    iniciar(async () => {
      const r = await salvarModelo({ id: props.id, titulo, nicho, conteudo: limpo });
      if (r.ok) {
        toast.success("Modelo salvo.");
        router.push("/templates");
      } else {
        setErrosServidor(r.errors ?? {});
        toast.error(r.message ?? "Não conseguimos salvar agora.");
      }
    });
  };

  return (
    <ErrosProvider erros={erros} mostrarTodos={tentou}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        className="flex max-w-[var(--container-doc)] flex-col gap-8"
      >
        <div className="flex flex-col gap-2">
          <Link
            href="/templates"
            className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-[var(--radius-control)] text-support font-semibold text-navy-700 hover:text-navy-950"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Voltar para os templates
          </Link>
          <h1 className="text-h1 text-navy-950 max-lg:sr-only">Editar modelo</h1>
        </div>

        <Sobre titulo={titulo} setTitulo={setTitulo} nicho={nicho} setNicho={setNicho} />

        <section aria-labelledby="escopo-modelo" className="flex flex-col gap-5">
          <h2 id="escopo-modelo" className="text-h2 text-navy-950">
            Escopo e itens
          </h2>
          <EscopoFields conteudo={conteudo} mudar={mudar} />
        </section>

        <section aria-labelledby="valores-modelo" className="flex flex-col gap-5">
          <h2 id="valores-modelo" className="text-h2 text-navy-950">
            Valores, prazo e pagamento
          </h2>
          <ValoresFields conteudo={conteudo} mudar={mudar} />
        </section>

        <div className="sticky bottom-0 z-20 -mx-4 flex gap-3 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-8 md:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
          <Button asChild variant="secondary" className="flex-1 sm:flex-none">
            <Link href="/templates">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={salvando} className="flex-[2] sm:min-w-44 sm:flex-none">
            {salvando ? "Salvando…" : "Salvar modelo"}
          </Button>
        </div>
      </form>
    </ErrosProvider>
  );
}

function Sobre({
  titulo,
  setTitulo,
  nicho,
  setNicho,
}: {
  titulo: string;
  setTitulo: (v: string) => void;
  nicho: Nicho;
  setNicho: (v: Nicho) => void;
}) {
  const { erro, tocar } = useErros();
  return (
    <section aria-labelledby="sobre-modelo" className="flex max-w-xl flex-col gap-5">
      <h2 id="sobre-modelo" className="text-h2 text-navy-950">
        Sobre o modelo
      </h2>
      <FormField id="modelo-titulo" label="Nome do modelo" error={erro("titulo")}>
        {(a11y) => (
          <Input
            {...a11y}
            value={titulo}
            autoComplete="off"
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => tocar("titulo")}
          />
        )}
      </FormField>
      <FormField id="modelo-nicho" label="Ramo">
        {(a11y) => (
          <NativeSelect {...a11y} value={nicho} onChange={(e) => setNicho(e.target.value as Nicho)}>
            {NICHO_ORDER.map((n) => (
              <option key={n} value={n}>
                {NICHOS[n]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
    </section>
  );
}
