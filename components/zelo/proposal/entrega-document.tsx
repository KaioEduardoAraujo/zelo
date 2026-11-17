import { CircleCheck, ImageOff } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConteudoEntrega } from "@/lib/validation/entrega";

type Props = {
  titulo: string;
  prestador: { nome: string; empresa?: string | null };
  clienteNome: string;
  conteudo: ConteudoEntrega;
  /** Título da proposta aceita a que esta entrega se refere. */
  referenciaTitulo?: string | null;
  /** Rascunho: "N dias depois do envio". Enviada: a data em que vence. */
  validade: { dias: number } | { ate: string };
  /** Caminho da foto → URL para exibir (assinada ou local, no editor). */
  fotoUrls: Record<string, string>;
  className?: string;
};

/**
 * O registro de entrega como o cliente o vê, no mesmo padrão visual da proposta. Só apresentação,
 * sem estado: serve para a pré-visualização do editor, o detalhe do prestador e a página pública.
 */
export function EntregaDocument({
  titulo,
  prestador,
  clienteNome,
  conteudo,
  referenciaTitulo,
  validade,
  fotoUrls,
  className,
}: Props) {
  const validadeTexto =
    "ate" in validade
      ? `Até ${formatDateTime(validade.ate)}`
      : `${validade.dias} ${validade.dias === 1 ? "dia" : "dias"} após o envio`;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-hairline)]",
        className,
      )}
    >
      <header className="border-b border-line px-4 py-5 md:px-6">
        <p className="text-support text-slate-600">
          {prestador.empresa ? `${prestador.empresa} · ${prestador.nome}` : prestador.nome}
        </p>
        <h2 className="mt-1 text-h2 break-words text-navy-950">{titulo}</h2>
        <p className="mt-1 text-support text-slate-600">Para {clienteNome}</p>
        {referenciaTitulo && (
          <p className="mt-2 text-support text-slate-600">
            Refere-se à proposta <span className="font-semibold">“{referenciaTitulo}”</span>
          </p>
        )}
      </header>

      <div className="space-y-6 px-4 py-5 md:px-6">
        <Secao titulo="O que foi entregue">
          {conteudo.resumo ? (
            <p className="text-body break-words whitespace-pre-line text-navy-900">
              {conteudo.resumo}
            </p>
          ) : (
            <Pendente>O resumo ainda não foi preenchido.</Pendente>
          )}
        </Secao>

        <Secao titulo="Checklist">
          {conteudo.checklist.length === 0 ? (
            <Pendente>Nenhum item no checklist ainda.</Pendente>
          ) : (
            <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
              {conteudo.checklist.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 px-3.5 py-3">
                  <CircleCheck
                    className={cn(
                      "mt-0.5 size-5 shrink-0",
                      item.feito ? "text-success" : "text-line-strong",
                    )}
                    aria-hidden="true"
                  />
                  <p className="text-support break-words text-navy-900">
                    {item.texto || <Pendente>Item sem descrição</Pendente>}
                    <span className="sr-only">{item.feito ? " (entregue)" : " (não marcado)"}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao titulo={`Fotos${conteudo.fotos.length ? ` (${conteudo.fotos.length})` : ""}`}>
          {conteudo.fotos.length === 0 ? (
            <Pendente>Nenhuma foto anexada.</Pendente>
          ) : (
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {conteudo.fotos.map((foto) => {
                const url = fotoUrls[foto.path];
                return (
                  <li key={foto.path} className="min-w-0">
                    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[var(--radius-control)] border border-line bg-surface-2">
                      {url ? (
                        // <img> comum: URL assinada do Storage, sem passar pelo otimizador do Next.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={`Foto da entrega: ${foto.nome}`}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <ImageOff
                          className="size-6 text-slate-600"
                          aria-label="Foto indisponível"
                        />
                      )}
                    </div>
                    <p className="mt-1 truncate text-label text-slate-600">{foto.nome}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Secao>

        {conteudo.observacoes && (
          <Secao titulo="Observações">
            <p className="text-body break-words whitespace-pre-line text-navy-900">
              {conteudo.observacoes}
            </p>
          </Secao>
        )}

        <p className="text-support text-slate-600">Confirmação aberta: {validadeTexto}</p>
      </div>
    </article>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-h3 text-navy-950">{titulo}</h3>
      {children}
    </section>
  );
}

function Pendente({ children }: { children: React.ReactNode }) {
  return <span className="text-support text-slate-600 italic">{children}</span>;
}
