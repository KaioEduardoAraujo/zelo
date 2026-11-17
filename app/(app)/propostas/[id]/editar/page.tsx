import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EntregaEditor } from "@/components/zelo/proposal/entrega-editor";
import { ProposalWizard } from "@/components/zelo/proposal/wizard";
import { requirePrestador } from "@/lib/auth/dal";
import type { Etapa } from "@/lib/proposals/draft";
import { urlsDasFotos } from "@/lib/entregas/urls";
import { carregarProposta } from "@/lib/proposals/queries";
import { createClient } from "@/lib/supabase/server";
import { entregaVazia } from "@/lib/validation/entrega";

export const metadata: Metadata = { title: "Editar" };

export default async function EditarPropostaPage(props: PageProps<"/propostas/[id]/editar">) {
  const profile = await requirePrestador();
  const { id } = await props.params;
  const { etapa } = await props.searchParams;
  const proposta = await carregarProposta(id);

  if (proposta.status !== "rascunho") redirect(`/propostas/${id}`);

  const versao = proposta.versoes.find((v) => v.numero === proposta.versaoAtual);
  if (!versao) redirect(`/propostas/${id}`);

  if (proposta.tipo === "entrega") {
    const conteudo = versao.entrega ?? entregaVazia();
    const supabase = await createClient();
    return (
      <EntregaEditor
        propostaId={proposta.id}
        prestadorId={profile.id}
        inicial={conteudo}
        fotoUrlsIniciais={await urlsDasFotos(supabase, conteudo.fotos, profile.id, proposta.id)}
        titulo={proposta.titulo}
        clienteNome={proposta.clienteNome}
        referenciaTitulo={proposta.pai?.titulo ?? ""}
        prestador={{ nome: profile.nome, empresa: profile.empresa_nome }}
      />
    );
  }

  const n = Number(Array.isArray(etapa) ? etapa[0] : etapa);
  const etapaInicial: Etapa = n === 2 || n === 3 || n === 4 ? n : 1;

  return (
    <ProposalWizard
      tipo={proposta.tipo}
      referenciaTitulo={proposta.pai?.titulo ?? null}
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
