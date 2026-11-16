import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProposalWizard } from "@/components/zelo/proposal/wizard";
import { requirePrestador } from "@/lib/auth/dal";
import type { Etapa } from "@/lib/proposals/draft";
import { carregarProposta } from "@/lib/proposals/queries";

export const metadata: Metadata = { title: "Editar proposta" };

export default async function EditarPropostaPage(props: PageProps<"/propostas/[id]/editar">) {
  const profile = await requirePrestador();
  const { id } = await props.params;
  const { etapa } = await props.searchParams;
  const proposta = await carregarProposta(id);

  // Só rascunho se edita. Proposta enviada gera uma NOVA versão pela página de detalhe.
  if (proposta.status !== "rascunho") redirect(`/propostas/${id}`);

  const versao = proposta.versoes.find((v) => v.numero === proposta.versaoAtual);
  if (!versao) redirect(`/propostas/${id}`);

  const n = Number(Array.isArray(etapa) ? etapa[0] : etapa);
  const etapaInicial: Etapa = n === 2 || n === 3 || n === 4 ? n : 1;

  return (
    <ProposalWizard
      propostaId={proposta.id}
      etapaInicial={etapaInicial}
      prestador={{ nome: profile.nome, empresa: profile.empresa_nome }}
      inicial={{
        clienteNome: proposta.clienteNome,
        clienteEmail: proposta.clienteEmail,
        clienteTelefone: proposta.clienteTelefone ?? "",
        titulo: proposta.titulo,
        conteudo: versao.conteudo,
      }}
    />
  );
}
