import type { Metadata } from "next";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AuditTimeline } from "@/components/zelo/audit-timeline";
import { ConfirmDialog } from "@/components/zelo/confirm-dialog";
import { CopyButton } from "@/components/zelo/copy-button";
import { FormMessage } from "@/components/zelo/form-message";
import { PageHeader } from "@/components/zelo/page-header";
import { GerarNovoLink } from "@/components/zelo/proposal/gerar-novo-link";
import { ProposalDocument } from "@/components/zelo/proposal/proposal-document";
import { StatusBadge } from "@/components/zelo/status-badge";
import { requirePrestador } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { maskPhone } from "@/lib/masks";
import { criarNovaVersao, excluirRascunho } from "@/lib/proposals/actions";
import { carregarProposta } from "@/lib/proposals/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Proposta" };

const ERROS: Record<string, string> = {
  aceita:
    "Uma proposta aceita não pode ser alterada. Para mudanças depois do aceite, use um aditivo.",
  "nova-versao": "Não conseguimos criar a nova versão agora. Tente de novo.",
  excluir:
    "Não conseguimos excluir este rascunho. Só rascunhos que nunca foram enviados podem ser excluídos.",
};

export default async function PropostaPage(props: PageProps<"/propostas/[id]">) {
  const profile = await requirePrestador();
  const { id } = await props.params;
  const { versao: versaoParam, erro } = await props.searchParams;
  const proposta = await carregarProposta(id);

  const pedida = Number(Array.isArray(versaoParam) ? versaoParam[0] : versaoParam);
  const versao =
    proposta.versoes.find((v) => v.numero === pedida) ??
    proposta.versoes.find((v) => v.numero === proposta.versaoAtual) ??
    proposta.versoes[proposta.versoes.length - 1];

  const ehAtual = versao.numero === proposta.versaoAtual;
  const rascunho = proposta.status === "rascunho";
  const aceita = proposta.status === "aceita";
  const mensagemErro = typeof erro === "string" ? ERROS[erro] : undefined;

  return (
    <>
      <PageHeader
        showTitleOnMobile
        title={proposta.titulo}
        description={`Para ${proposta.clienteNome} · ${proposta.clienteEmail}${
          proposta.clienteTelefone ? ` · ${maskPhone(proposta.clienteTelefone)}` : ""
        }`}
      />

      {mensagemErro && (
        <FormMessage tone="error" className="mb-6">
          {mensagemErro}
        </FormMessage>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={proposta.status} />
            {proposta.versoes.length > 1 && (
              <nav aria-label="Versões da proposta">
                <ul className="flex flex-wrap gap-2">
                  {proposta.versoes.map((v) => (
                    <li key={v.numero}>
                      <Link
                        href={`/propostas/${proposta.id}?versao=${v.numero}`}
                        aria-current={v.numero === versao.numero ? "true" : undefined}
                        className={cn(
                          "inline-flex min-h-11 items-center rounded-[var(--radius-pill)] border px-4 text-support font-semibold",
                          v.numero === versao.numero
                            ? "border-navy-800 bg-navy-800 text-white"
                            : "border-line-strong bg-surface text-navy-700 hover:bg-surface-2",
                        )}
                      >
                        Versão {v.numero}
                        {v.enviadaEm === null && " (rascunho)"}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>

          {!ehAtual && (
            <FormMessage tone="info">
              Você está vendo uma versão anterior. Ela continua guardada exatamente como foi
              enviada.
            </FormMessage>
          )}

          <div className="max-w-[var(--container-doc)]">
            <ProposalDocument
              titulo={versao.snapshot?.titulo || proposta.titulo}
              prestador={
                versao.snapshot
                  ? {
                      nome: versao.snapshot.prestador.nome,
                      empresa: versao.snapshot.prestador.empresa,
                    }
                  : { nome: profile.nome, empresa: profile.empresa_nome }
              }
              clienteNome={versao.snapshot?.cliente.nome ?? proposta.clienteNome}
              conteudo={versao.conteudo}
              validade={
                ehAtual && !rascunho && proposta.validadeEm
                  ? { ate: proposta.validadeEm }
                  : { dias: versao.conteudo.validade_dias }
              }
            />
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5">
            <h2 className="text-h3 text-navy-950">O que fazer agora</h2>
            <div className="mt-3 flex flex-col gap-3">
              {rascunho && (
                <>
                  <Button asChild>
                    <Link href={`/propostas/${proposta.id}/editar?etapa=4`}>Revisar e enviar</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href={`/propostas/${proposta.id}/editar?etapa=2`}>
                      Continuar editando
                    </Link>
                  </Button>
                  {proposta.versaoAtual === 1 && (
                    <ConfirmDialog
                      trigger={<Button variant="secondary">Excluir rascunho</Button>}
                      title="Excluir este rascunho?"
                      description={`O rascunho “${proposta.titulo}” será apagado de vez. Propostas que já foram enviadas não podem ser excluídas.`}
                      confirmLabel="Excluir rascunho"
                      onConfirm={excluirRascunho.bind(null, proposta.id)}
                    />
                  )}
                  {proposta.versaoAtual > 1 && (
                    <p className="text-support text-slate-600">
                      Esta é a versão {proposta.versaoAtual}. A versão anterior continua guardada
                      como foi enviada.
                    </p>
                  )}
                </>
              )}

              {(proposta.status === "enviada" || proposta.status === "visualizada") && (
                <div className="flex flex-col gap-2">
                  <GerarNovoLink propostaId={proposta.id} />
                  <p className="text-support text-slate-600">
                    O link só aparece quando é criado. Perdeu? Gere outro: o anterior deixa de
                    funcionar.
                  </p>
                </div>
              )}

              {proposta.status === "expirada" && (
                <p className="text-support text-slate-600">
                  Esta proposta venceu e o link não aceita mais respostas. Crie uma nova versão para
                  enviar de novo.
                </p>
              )}

              {!rascunho && !aceita && (
                <form
                  action={criarNovaVersao.bind(null, proposta.id)}
                  className="flex flex-col gap-2"
                >
                  <Button type="submit" variant="secondary">
                    Criar nova versão para editar
                  </Button>
                  <p className="text-support text-slate-600">
                    Uma proposta enviada não muda. A nova versão começa igual a esta e a atual fica
                    guardada, com o seu hash.
                  </p>
                </form>
              )}

              {aceita && (
                <p className="text-support text-slate-600">
                  Proposta aceita não pode ser alterada. Para mudanças depois do aceite, use um
                  aditivo.
                </p>
              )}
            </div>
          </section>

          <section
            aria-labelledby="integridade-titulo"
            className="rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5"
          >
            <h2 id="integridade-titulo" className="text-h3 text-navy-950">
              Integridade
            </h2>
            {versao.hashSha256 ? (
              <>
                <p className="mt-2 text-support text-slate-600">
                  Hash SHA-256 da versão {versao.numero}. Se qualquer letra do documento mudar, ele
                  muda.
                </p>
                <p className="mt-2 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2.5 font-mono text-xs leading-5 break-all text-navy-800">
                  {versao.hashSha256}
                </p>
                {versao.hashConfere ? (
                  <p className="mt-2 flex items-start gap-1.5 text-support text-success">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    Conteúdo conferido: o hash recalculado agora é igual ao gravado no envio.
                  </p>
                ) : (
                  <p
                    role="alert"
                    className="mt-2 flex items-start gap-1.5 text-support text-danger"
                  >
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />O conteúdo
                    guardado não bate com o hash gravado no envio.
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-support text-slate-600">
                    Enviada em {versao.enviadaEm ? formatDateTime(versao.enviadaEm) : "—"}
                  </p>
                  <CopyButton text={versao.hashSha256} label="Copiar" mensagem="Hash copiado." />
                </div>
              </>
            ) : (
              <p className="mt-2 text-support text-slate-600">
                O hash é calculado no momento do envio e trava esta versão. Até lá, ela pode ser
                editada.
              </p>
            )}
          </section>

          <section
            aria-labelledby="trilha-titulo"
            className="rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5"
          >
            <h2 id="trilha-titulo" className="mb-3 text-h3 text-navy-950">
              Trilha de auditoria
            </h2>
            {proposta.eventos.length === 0 ? (
              <p className="text-support text-slate-600">
                Nada registrado ainda. Quando a proposta for enviada, cada abertura e resposta do
                cliente aparece aqui, com data, hora e dispositivo.
              </p>
            ) : (
              <AuditTimeline events={proposta.eventos} />
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
