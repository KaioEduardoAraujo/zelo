import { Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { CabecalhoPublico } from "@/components/publico/cabecalho-publico";
import { RegistrarAbertura } from "@/components/publico/registrar-abertura";
import { RespostaCliente } from "@/components/publico/resposta-cliente";
import { AcceptanceStamp } from "@/components/zelo/acceptance-stamp";
import { FormMessage } from "@/components/zelo/form-message";
import { EntregaDocument } from "@/components/zelo/proposal/entrega-document";
import { ProposalDocument } from "@/components/zelo/proposal/proposal-document";
import { formatDateTime, maskCpf, maskEmail } from "@/lib/format";
import { urlWhatsApp } from "@/lib/proposals/envio";
import { textoConsentimento } from "@/lib/publico/consentimento";
import { carregarPropostaPublica, type PropostaPublica } from "@/lib/publico/queries";
import { textosDe } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Proposta", robots: { index: false, follow: false } };

export default async function PaginaDoCliente(props: PageProps<"/p/[token]">) {
  const { token } = await props.params;
  const proposta = await carregarPropostaPublica(token);
  if (!proposta) notFound();

  const prestador = proposta.prestadorDocumento.empresa || proposta.prestadorDocumento.nome;
  const T = textosDe(proposta.tipo);
  const temDocumento = proposta.conteudo !== null || proposta.entrega !== null;
  const aberta = proposta.estado === "aberta" && temDocumento;

  const duvidasHref = proposta.contato.telefone
    ? urlWhatsApp(
        proposta.contato.telefone,
        `Olá! Tenho uma dúvida sobre ${T.artigo} “${proposta.titulo}”.`,
      )
    : proposta.contato.email
      ? `mailto:${proposta.contato.email}?subject=${encodeURIComponent(`Dúvida sobre a proposta “${proposta.titulo}”`)}`
      : null;

  return (
    <div className="min-h-dvh">
      <CabecalhoPublico nome={prestador} enviadaVia={T.enviadaVia} />

      <main
        className={cn(
          "mx-auto max-w-[var(--container-doc)] px-4 pt-5 md:pt-8",
          aberta ? "pb-36" : "pb-12",
        )}
      >
        <h1 className="sr-only">
          {T.rotulo} de {prestador}
        </h1>
        <Situacao proposta={proposta} prestador={prestador} token={token} />

        {temDocumento && (
          <>
            {proposta.entrega ? (
              <EntregaDocument
                titulo={proposta.titulo}
                prestador={proposta.prestadorDocumento}
                clienteNome={proposta.cliente.nome}
                referenciaTitulo={proposta.referenciaTitulo}
                conteudo={proposta.entrega}
                fotoUrls={proposta.fotoUrls}
                validade={
                  proposta.validadeEm
                    ? { ate: proposta.validadeEm }
                    : { dias: proposta.entrega.validade_dias }
                }
              />
            ) : (
              proposta.conteudo && (
                <ProposalDocument
                  titulo={proposta.titulo}
                  prestador={proposta.prestadorDocumento}
                  clienteNome={proposta.cliente.nome}
                  conteudo={proposta.conteudo}
                  referenciaTitulo={proposta.tipo === "aditivo" ? proposta.referenciaTitulo : null}
                  validade={
                    proposta.validadeEm
                      ? { ate: proposta.validadeEm }
                      : { dias: proposta.conteudo.validade_dias }
                  }
                />
              )
            )}

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

        {aberta ? (
          <RespostaCliente
            token={token}
            titulo={proposta.titulo}
            tipo={proposta.tipo}
            valorCentavos={proposta.conteudo?.valor_total_centavos ?? null}
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
  return {
    titulo: p.titulo,
    prestador,
    tipo: p.tipo,
    valorCentavos: p.conteudo?.valor_total_centavos ?? null,
  };
}

function Situacao({
  proposta,
  prestador,
  token,
}: {
  proposta: PropostaPublica;
  prestador: string;
  token: string;
}) {
  const r = proposta.resposta;
  const T = textosDe(proposta.tipo);
  const Este = T.este.charAt(0).toUpperCase() + T.este.slice(1);

  switch (proposta.estado) {
    case "aceita":
      return r ? (
        <section aria-label={T.registrado.aceito} className="mb-5 flex flex-col gap-3">
          <AcceptanceStamp
            size="lg"
            acceptedAt={formatDateTime(r.criadoEm)}
            code={r.codigo}
            className="self-start"
          />
          <p className="text-support text-slate-600">
            {T.aceitaPor} {r.clienteNome}
            {r.cpf ? ` (CPF ${maskCpf(r.cpf)})` : ""}. Guarde o comprovante.
          </p>
          {r.resultado === "aceito" && (
            <Button asChild className="self-start">
              {/* O token é conferido de novo na rota de download. */}
              <a href={`/p/${token}/comprovante`}>
                <Download aria-hidden="true" />
                Baixar comprovante
              </a>
            </Button>
          )}
        </section>
      ) : null;
    case "recusada":
      return (
        <FormMessage tone="info" className="mb-5">
          Você recusou {T.este}
          {r ? ` em ${formatDateTime(r.criadoEm)}` : ""}.
          {r?.comentario ? ` Motivo: “${r.comentario}”` : ""}
        </FormMessage>
      );
    case "ajuste":
      return (
        <FormMessage tone="info" className="mb-5">
          Você pediu ajuste{r ? ` em ${formatDateTime(r.criadoEm)}` : ""}
          {r?.comentario ? `: “${r.comentario}”` : ""}. {prestador} pode enviar uma nova versão{" "}
          {T.de}.
        </FormMessage>
      );
    case "expirada":
      return (
        <FormMessage tone="error" className="mb-5">
          {Este} venceu
          {proposta.validadeEm ? ` em ${formatDateTime(proposta.validadeEm)}` : ""} e não pode mais
          ser {T.aceitaAdj}. Se ainda tiver interesse, fale com {prestador}.
        </FormMessage>
      );
    case "em_atualizacao":
      return (
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="text-h2 text-navy-950">
            {Este} está sendo {T.atualizadaAdj}
          </h2>
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
