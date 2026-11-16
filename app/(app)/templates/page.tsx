import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/zelo/confirm-dialog";
import { EmptyState } from "@/components/zelo/empty-state";
import { FormMessage } from "@/components/zelo/form-message";
import { PageHeader } from "@/components/zelo/page-header";
import { requirePrestador } from "@/lib/auth/dal";
import { formatCentavos } from "@/lib/format";
import { NICHOS } from "@/lib/nichos";
import { listarModelos, type ModeloResumo } from "@/lib/proposals/queries";
import { duplicarModelo, excluirModelo } from "@/lib/templates/actions";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage(props: PageProps<"/templates">) {
  await requirePrestador();
  const { excluido, erro } = await props.searchParams;
  const modelos = await listarModelos();
  const proprios = modelos.filter((m) => m.proprio);
  const globais = modelos.filter((m) => !m.proprio);

  return (
    <>
      <PageHeader
        title="Templates"
        description="Modelos prontos por ramo. Duplique um e personalize para o seu jeito de trabalhar."
      />

      {excluido === "1" && (
        <FormMessage tone="success" className="mb-6">
          Modelo excluído.
        </FormMessage>
      )}
      {typeof erro === "string" && (
        <FormMessage tone="error" className="mb-6">
          Não conseguimos concluir essa ação agora. Tente de novo.
        </FormMessage>
      )}

      <div className="flex flex-col gap-10">
        <section aria-labelledby="proprios-titulo">
          <h2 id="proprios-titulo" className="mb-3 text-h2 text-navy-950">
            Seus modelos
          </h2>
          {proprios.length === 0 ? (
            <EmptyState
              title="Você ainda não personalizou nenhum modelo."
              description="Escolha um modelo do Zelo abaixo e toque em “Duplicar e personalizar”."
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {proprios.map((m) => (
                <li key={m.id} className="min-w-0">
                  <CartaoModelo modelo={m} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="globais-titulo">
          <h2 id="globais-titulo" className="mb-3 text-h2 text-navy-950">
            Modelos do Zelo
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {globais.map((m) => (
              <li key={m.id} className="min-w-0">
                <CartaoModelo modelo={m} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function CartaoModelo({ modelo }: { modelo: ModeloResumo }) {
  const { conteudo } = modelo;
  return (
    <article className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-hairline)] md:p-5">
      <p className="text-label text-slate-600">
        {NICHOS[modelo.nicho]}
        {modelo.proprio && " · Meu modelo"}
      </p>
      <h3 className="mt-1 text-h3 break-words text-navy-950">{modelo.titulo}</h3>
      <p className="mt-1 line-clamp-3 text-support text-slate-600">{conteudo.escopo}</p>
      <p className="mt-3 flex items-baseline justify-between gap-3 text-support">
        <span className="text-slate-600">
          {conteudo.itens.length} {conteudo.itens.length === 1 ? "item" : "itens"} · valida por{" "}
          {conteudo.validade_dias} dias
        </span>
        <span className="tabular font-semibold text-navy-900">
          {formatCentavos(conteudo.valor_total_centavos)}
        </span>
      </p>

      <div className="mt-4 flex flex-wrap gap-2 pt-1">
        <Button asChild>
          <Link href={`/propostas/nova?modelo=${modelo.id}`}>
            Usar modelo
            <span className="sr-only"> {modelo.titulo}</span>
          </Link>
        </Button>
        {modelo.proprio ? (
          <>
            <Button asChild variant="secondary">
              <Link href={`/templates/${modelo.id}/editar`}>
                Editar
                <span className="sr-only"> {modelo.titulo}</span>
              </Link>
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="ghost">
                  Excluir<span className="sr-only"> {modelo.titulo}</span>
                </Button>
              }
              title="Excluir este modelo?"
              description={`O modelo “${modelo.titulo}” será apagado. As propostas que você já criou com ele não mudam.`}
              confirmLabel="Excluir modelo"
              onConfirm={excluirModelo.bind(null, modelo.id)}
            />
          </>
        ) : (
          <form action={duplicarModelo.bind(null, modelo.id)}>
            <Button type="submit" variant="secondary">
              Duplicar e personalizar
              <span className="sr-only"> {modelo.titulo}</span>
            </Button>
          </form>
        )}
      </div>
    </article>
  );
}
