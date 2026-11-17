import { CircleX } from "lucide-react";

import { formatCentavos, formatDateTime } from "@/lib/format";
import { formatDecimal } from "@/lib/masks";
import { totalItemCentavos, type ConteudoRascunho } from "@/lib/validation/proposta";
import { cn } from "@/lib/utils";

type ProposalDocumentProps = {
  titulo: string;
  prestador: { nome: string; empresa?: string | null };
  clienteNome: string;
  conteudo: ConteudoRascunho;
  validade: { dias: number } | { ate: string };
  referenciaTitulo?: string | null;
  className?: string;
};

export function ProposalDocument({
  titulo,
  prestador,
  clienteNome,
  conteudo,
  validade,
  referenciaTitulo,
  className,
}: ProposalDocumentProps) {
  const total = conteudo.valor_total_centavos;
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
        <h2 className="mt-1 text-h2 break-words text-navy-950">
          {titulo || <Pendente>Título da proposta</Pendente>}
        </h2>
        <p className="mt-1 text-support text-slate-600">
          Para {clienteNome || <Pendente>nome do cliente</Pendente>}
        </p>
        {referenciaTitulo && (
          <p className="mt-2 text-support text-slate-600">
            Aditivo à proposta <span className="font-semibold">“{referenciaTitulo}”</span>
          </p>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-line bg-surface-2 px-4 py-4 md:px-6">
        <div className="col-span-2">
          <dt className="text-label text-slate-600">Valor total</dt>
          <dd className="tabular mt-0.5 text-h1 text-navy-950">{formatCentavos(total)}</dd>
        </div>
        <div>
          <dt className="text-label text-slate-600">Prazo</dt>
          <dd className="mt-0.5 text-support break-words text-navy-900">
            {conteudo.prazo || <Pendente>não informado</Pendente>}
          </dd>
        </div>
        <div>
          <dt className="text-label text-slate-600">Validade da proposta</dt>
          <dd className="mt-0.5 text-support text-navy-900">{validadeTexto}</dd>
        </div>
      </dl>

      <div className="space-y-6 px-4 py-5 md:px-6">
        <Secao titulo="Escopo">
          {conteudo.escopo ? (
            <p className="text-body break-words whitespace-pre-line text-navy-900">
              {conteudo.escopo}
            </p>
          ) : (
            <Pendente>O escopo ainda não foi preenchido.</Pendente>
          )}
        </Secao>

        <Secao titulo="O que está incluso">
          {conteudo.itens.length === 0 ? (
            <Pendente>Nenhum item incluído ainda.</Pendente>
          ) : (
            <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
              {conteudo.itens.map((item, i) => (
                <li key={i} className="flex items-start justify-between gap-4 px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-support font-semibold break-words text-navy-900">
                      {item.descricao || <Pendente>Item sem descrição</Pendente>}
                    </p>
                    <p className="tabular text-support text-slate-600">
                      {formatDecimal(item.quantidade)} {item.unidade} ×{" "}
                      {formatCentavos(item.valor_unitario_centavos)}
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-support font-semibold text-navy-900">
                    {formatCentavos(totalItemCentavos(item))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {conteudo.exclusoes.length > 0 && (
          <section
            aria-labelledby="doc-exclusoes"
            className="rounded-[var(--radius-control)] border border-warning/30 bg-warning-bg px-3.5 py-3.5"
          >
            <h3 id="doc-exclusoes" className="text-h3 text-warning">
              Não está incluso
            </h3>
            <ul className="mt-2 space-y-1.5">
              {conteudo.exclusoes.map((e, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-support break-words text-navy-900"
                >
                  <CircleX className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  {e}
                </li>
              ))}
            </ul>
          </section>
        )}

        <Secao titulo="Pagamento">
          {conteudo.pagamento ? (
            <p className="text-body break-words text-navy-900">{conteudo.pagamento}</p>
          ) : (
            <Pendente>A forma de pagamento ainda não foi preenchida.</Pendente>
          )}
        </Secao>

        <Secao titulo="Garantia">
          {conteudo.garantia ? (
            <p className="text-body break-words text-navy-900">{conteudo.garantia}</p>
          ) : (
            <Pendente>A garantia ainda não foi preenchida.</Pendente>
          )}
        </Secao>

        {conteudo.observacoes && (
          <Secao titulo="Observações">
            <p className="text-body break-words whitespace-pre-line text-navy-900">
              {conteudo.observacoes}
            </p>
          </Secao>
        )}
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
