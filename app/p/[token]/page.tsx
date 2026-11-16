import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { CabecalhoPublico } from "@/components/publico/cabecalho-publico";
import { RegistrarAbertura } from "@/components/publico/registrar-abertura";
import { RespostaCliente } from "@/components/publico/resposta-cliente";
import { AcceptanceStamp } from "@/components/zelo/acceptance-stamp";
import { FormMessage } from "@/components/zelo/form-message";
import { ProposalDocument } from "@/components/zelo/proposal/proposal-document";
import { formatDateTime, maskCpf, maskEmail } from "@/lib/format";
import { urlWhatsApp } from "@/lib/proposals/envio";
import { textoConsentimento } from "@/lib/publico/consentimento";
import { carregarPropostaPublica, type PropostaPublica } from "@/lib/publico/queries";
import { cn } from "@/lib/utils";

// Nunca indexar: o link é pessoal. (Cabeçalhos no next.config.ts reforçam: no-referrer, no-store.)
export const metadata: Metadata = { title: "Proposta", robots: { index: false, follow: false } };

/**
 * Página pública do cliente (DESIGN.md 7.2.7), a tela mais importante do produto.
 * Server Component: chega pronta do servidor e quase não carrega JavaScript (só a barra de
 * resposta e o registro de abertura), porque costuma ser aberta no celular com rede ruim.
 */
export default async function PaginaDoCliente(props: PageProps<"/p/[token]">) {
  const { token } = await props.params;
  const proposta = await carregarPropostaPublica(token);
  if (!proposta) notFound(); // inválido, inexistente ou substituído: a mesma resposta

  const prestador = proposta.prestadorDocumento.empresa || proposta.prestadorDocumento.nome;
  const aberta = proposta.estado === "aberta" && proposta.conteudo !== null;

  const duvidasHref = proposta.contato.telefone
    ? urlWhatsApp(
        proposta.contato.telefone,
        `Olá! Tenho uma dúvida sobre a proposta “${proposta.titulo}”.`,
      )
    : proposta.contato.email
      ? `mailto:${proposta.contato.email}?subject=${encodeURIComponent(`Dúvida sobre a proposta “${proposta.titulo}”`)}`
      : null;

  return (
    <div className="min-h-dvh">
      <CabecalhoPublico nome={prestador} />

      <main
        className={cn(
          "mx-auto max-w-[var(--container-doc)] px-4 pt-5 md:pt-8",
          aberta ? "pb-36" : "pb-12",
        )}
      >
        <h1 className="sr-only">Proposta de {prestador}</h1>
        <Situacao proposta={proposta} prestador={prestador} />

        {proposta.conteudo && (
          <>
            <ProposalDocument
              titulo={proposta.titulo}
              prestador={proposta.prestadorDocumento}
              clienteNome={proposta.cliente.nome}
              conteudo={proposta.conteudo}
              validade={
                proposta.validadeEm
                  ? { ate: proposta.validadeEm }
                  : { dias: proposta.conteudo.validade_dias }
              }
            />

            {proposta.hash && (
              <section aria-labelledby="integridade" className="mt-4 px-1">
                <h2 id="integridade" className="text-label text-slate-600">
                  Código de integridade do documento (SHA-256)
                </h2>
                <p className="mt-0.5 font-mono text-xs leading-5 break-all text-navy-800">
                  {proposta.hash}
                </p>
                {proposta.enviadaEm && (
                  <p className="mt-0.5 text-label text-slate-600">
                    Enviada em {formatDateTime(proposta.enviadaEm)}
                  </p>
                )}
              </section>
            )}
          </>
        )}

        {aberta && proposta.conteudo ? (
          <RespostaCliente
            token={token}
            titulo={proposta.titulo}
            valorCentavos={proposta.conteudo.valor_total_centavos}
            prestadorNome={prestador}
            clienteNome={proposta.cliente.nome}
            emailMascarado={maskEmail(proposta.cliente.email)}
            duvidasHref={duvidasHref}
            consentimentos={{
              aceito: textoConsentimento("aceito", consentimentoBase(proposta, prestador)),
              recusado: textoConsentimento("recusado", consentimentoBase(proposta, prestador)),
              ajuste: textoConsentimento("ajuste", consentimentoBase(proposta, prestador)),
            }}
          />
        ) : (
          duvidasHref && (
            <Button asChild variant="secondary" className="mt-6">
              <a href={duvidasHref} target="_blank" rel="noopener noreferrer">
                Falar com {prestador}
              </a>
            </Button>
          )
        )}
      </main>

      {aberta && <RegistrarAbertura token={token} />}
    </div>
  );
}

function consentimentoBase(p: PropostaPublica, prestador: string) {
  return { titulo: p.titulo, prestador, valorCentavos: p.conteudo?.valor_total_centavos ?? 0 };
}

/** Faixa no topo com a situação da proposta, quando ela não está mais aberta para resposta. */
function Situacao({ proposta, prestador }: { proposta: PropostaPublica; prestador: string }) {
  const r = proposta.resposta;

  switch (proposta.estado) {
    case "aceita":
      return r ? (
        <section aria-label="Aceite registrado" className="mb-5 flex flex-col gap-3">
          <AcceptanceStamp
            size="lg"
            acceptedAt={formatDateTime(r.criadoEm)}
            code={r.codigo}
            className="self-start"
          />
          <p className="text-support text-slate-600">
            Aceita por {r.clienteNome}
            {r.cpf ? ` (CPF ${maskCpf(r.cpf)})` : ""}. Guarde o código do comprovante.
          </p>
        </section>
      ) : null;
    case "recusada":
      return (
        <FormMessage tone="info" className="mb-5">
          Você recusou esta proposta{r ? ` em ${formatDateTime(r.criadoEm)}` : ""}.
          {r?.comentario ? ` Motivo: “${r.comentario}”` : ""}
        </FormMessage>
      );
    case "ajuste":
      return (
        <FormMessage tone="info" className="mb-5">
          Você pediu ajuste{r ? ` em ${formatDateTime(r.criadoEm)}` : ""}
          {r?.comentario ? `: “${r.comentario}”` : ""}. {prestador} pode enviar uma nova versão da
          proposta.
        </FormMessage>
      );
    case "expirada":
      return (
        <FormMessage tone="error" className="mb-5">
          Esta proposta venceu
          {proposta.validadeEm ? ` em ${formatDateTime(proposta.validadeEm)}` : ""} e não pode mais
          ser aceita. Se ainda tiver interesse, fale com {prestador}.
        </FormMessage>
      );
    case "em_atualizacao":
      return (
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="text-h2 text-navy-950">Esta proposta está sendo atualizada</h2>
          <p className="mt-2 text-slate-600">
            {prestador} está preparando uma nova versão. Quando ela estiver pronta, você recebe um
            novo link.
          </p>
        </section>
      );
    default:
      return null;
  }
}
