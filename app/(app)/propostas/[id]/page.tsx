import type { Metadata } from "next";
import { Download, FilePlus2, ShieldAlert, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AcceptanceStamp } from "@/components/zelo/acceptance-stamp";
import { AuditTimeline } from "@/components/zelo/audit-timeline";
import { ConfirmDialog } from "@/components/zelo/confirm-dialog";
import { CopyButton } from "@/components/zelo/copy-button";
import { FormMessage } from "@/components/zelo/form-message";
import { PageHeader } from "@/components/zelo/page-header";
import { GerarNovoLink } from "@/components/zelo/proposal/gerar-novo-link";
import { EntregaDocument } from "@/components/zelo/proposal/entrega-document";
import { ProposalDocument } from "@/components/zelo/proposal/proposal-document";
import { StatusBadge } from "@/components/zelo/status-badge";
import { requirePrestador } from "@/lib/auth/dal";
import { formatDateTime, maskCpf } from "@/lib/format";
import { maskPhone } from "@/lib/masks";
import { urlsDasFotos } from "@/lib/entregas/urls";
import { criarNovaVersao, excluirRascunho } from "@/lib/proposals/actions";
import { criarAditivo, criarEntrega } from "@/lib/proposals/derivados";
import { STATUS } from "@/lib/status";
import { textosDe } from "@/lib/tipos";
import { createClient } from "@/lib/supabase/server";
import { carregarProposta } from "@/lib/proposals/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Proposta" };

const ERROS: Record<string, string> = {
  aceita:
    "Uma proposta aceita não pode ser alterada. Para mudanças depois do aceite, use um aditivo.",
  "nova-versao": "Não conseguimos criar a nova versão agora. Tente de novo.",
  excluir:
    "Não conseguimos excluir este rascunho. Só rascunhos que nunca foram enviados podem ser excluídos.",
  aditivo: "Não conseguimos criar o aditivo agora. Só uma proposta aceita pode ter aditivos.",
  entrega: "Não conseguimos criar a entrega agora. Só uma proposta aceita pode ter entrega.",
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

  const T = textosDe(proposta.tipo);
  const ehEntrega = proposta.tipo === "entrega";
  const fotoUrls =
    ehEntrega && versao.entrega
      ? await urlsDasFotos(await createClient(), versao.entrega.fotos, profile.id, proposta.id)
      : {};
  // Rascunho de entrega se edita numa tela só; proposta e aditivo, no assistente (etapas 2 e 4).
  const editarHref = (etapa: number) =>
    `/propostas/${proposta.id}/editar${ehEntrega ? "" : `?etapa=${etapa}`}`;

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

      {proposta.pai && (
        <FormMessage tone="info" className="mb-6">
          {T.rotulo} da proposta{" "}
          <Link href={`/propostas/${proposta.pai.id}`} className="font-semibold underline">
            “{proposta.pai.titulo}”
          </Link>
          .
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
            {ehEntrega && versao.entrega ? (
              <EntregaDocument
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
                referenciaTitulo={versao.snapshot?.referencia?.titulo ?? proposta.pai?.titulo}
                conteudo={versao.entrega}
                validade={
                  ehAtual && !rascunho && proposta.validadeEm
                    ? { ate: proposta.validadeEm }
                    : { dias: versao.entrega.validade_dias }
                }
                fotoUrls={fotoUrls}
              />
            ) : (
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
                referenciaTitulo={
                  proposta.tipo === "aditivo"
                    ? (versao.snapshot?.referencia?.titulo ?? proposta.pai?.titulo)
                    : null
                }
                validade={
                  ehAtual && !rascunho && proposta.validadeEm
                    ? { ate: proposta.validadeEm }
                    : { dias: versao.conteudo.validade_dias }
                }
              />
            )}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5">
            <h2 className="text-h3 text-navy-950">O que fazer agora</h2>
            <div className="mt-3 flex flex-col gap-3">
              {rascunho && (
                <>
                  <Button asChild>
                    <Link href={editarHref(4)}>
                      {ehEntrega ? "Continuar e enviar" : "Revisar e enviar"}
                    </Link>
                  </Button>
                  {!ehEntrega && (
                    <Button asChild variant="secondary">
                      <Link href={editarHref(2)}>Continuar editando</Link>
                    </Button>
                  )}
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

              {aceita && proposta.aceite && (
                <div className="flex flex-col gap-3">
                  <AcceptanceStamp
                    acceptedAt={formatDateTime(proposta.aceite.criadoEm)}
                    code={proposta.aceite.codigo}
                    className="self-start"
                  />
                  <p className="text-support text-slate-600">
                    {T.aceitaPor} {proposta.aceite.clienteNome}
                    {proposta.aceite.cpf ? ` (CPF ${maskCpf(proposta.aceite.cpf)})` : ""}.
                  </p>
                  {/* Link comum (não <Link>): é uma rota de download, não uma página. */}
                  <Button asChild>
                    <a href={`/propostas/${proposta.id}/comprovante`}>
                      <Download aria-hidden="true" />
                      Baixar comprovante (PDF)
                    </a>
                  </Button>
                </div>
              )}

              {aceita && proposta.tipo === "proposta" && (
                <>
                  <p className="text-support text-slate-600">
                    Proposta aceita não pode ser alterada. Para mudanças depois do aceite, use um
                    aditivo.
                  </p>
                  <form action={criarAditivo.bind(null, proposta.id)}>
                    <Button type="submit" variant="secondary" className="w-full">
                      <FilePlus2 aria-hidden="true" />
                      Novo aditivo
                    </Button>
                  </form>
                  <form
                    action={criarEntrega.bind(null, proposta.id)}
                    className="flex flex-col gap-2"
                  >
                    <Button type="submit" variant="secondary" className="w-full">
                      <Truck aria-hidden="true" />
                      Registrar entrega
                    </Button>
                    <p className="text-support text-slate-600">
                      Quando o serviço terminar: checklist e fotos para o cliente confirmar o
                      recebimento.
                    </p>
                  </form>
                </>
              )}

              {aceita && proposta.tipo !== "proposta" && (
                <p className="text-support text-slate-600">
                  {T.rotulo} aceito não pode ser alterado. Se algo mudar, crie um novo documento a
                  partir da proposta original.
                </p>
              )}
            </div>
          </section>

          {proposta.derivados.length > 0 && (
            <section
              aria-labelledby="derivados-titulo"
              className="rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5"
            >
              <h2 id="derivados-titulo" className="mb-3 text-h3 text-navy-950">
                Aditivos e entregas
              </h2>
              <ul className="divide-y divide-line">
                {proposta.derivados.map((d) => (
                  <li key={d.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      href={`/propostas/${d.id}`}
                      className="block rounded-sm text-support text-navy-900 hover:underline"
                    >
                      <span className="font-semibold">{textosDe(d.tipo).rotulo}:</span> {d.titulo}
                    </Link>
                    <p className="text-label text-slate-600">{STATUS[d.status].label}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
