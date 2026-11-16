import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";

import type { ProposalSummary } from "@/components/zelo/proposal-card";
import type { AuditEvent } from "@/components/zelo/audit-timeline";
import { hashConfere as confereHash } from "@/lib/crypto/hash";
import { atencao, type Attention } from "@/lib/proposals/attention";
import { normalizarConteudo } from "@/lib/proposals/draft";
import { lerSnapshot, type SnapshotDocumento } from "@/lib/proposals/snapshot";
import { PAGE_SIZE, type FiltrosListagem } from "@/lib/proposals/search";
import type { EventoTipo, PropostaStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import type { Nicho } from "@/lib/nichos";
import type { ConteudoRascunho } from "@/lib/validation/proposta";

/*
 * Consultas de leitura da Fase 4. Todas usam o cliente do USUÁRIO LOGADO (não a service_role):
 * o RLS do banco garante que cada prestador só enxerga as próprias propostas e modelos.
 */

const LISTA_COLUNAS =
  "id, titulo, cliente_nome, status_efetivo, valor_total_centavos, atualizado_em, validade_em";

type LinhaLista = {
  id: string | null;
  titulo: string | null;
  cliente_nome: string | null;
  status_efetivo: PropostaStatus | null;
  valor_total_centavos: number | null;
  atualizado_em: string | null;
  validade_em: string | null;
};

function paraResumo(l: LinhaLista): ProposalSummary {
  return {
    id: l.id ?? "",
    titulo: l.titulo ?? "",
    clienteNome: l.cliente_nome ?? "",
    valorCentavos: l.valor_total_centavos === null ? null : Number(l.valor_total_centavos),
    status: l.status_efetivo ?? "rascunho",
    atualizadoEm: l.atualizado_em ?? new Date().toISOString(),
  };
}

export async function listarPropostas(f: FiltrosListagem) {
  const supabase = await createClient();
  const de = (f.pagina - 1) * PAGE_SIZE;

  let consulta = supabase
    .from("propostas_situacao")
    .select(LISTA_COLUNAS, { count: "exact" })
    .order("atualizado_em", { ascending: false })
    .range(de, de + PAGE_SIZE - 1);

  if (f.status) consulta = consulta.eq("status_efetivo", f.status);
  // `q` já passou por limparBusca(): só letras, números, espaço e hífen.
  if (f.q) consulta = consulta.or(`titulo.ilike.%${f.q}%,cliente_nome.ilike.%${f.q}%`);

  const { data, count, error } = await consulta;

  // Página além do fim (link antigo, filtro novo): o PostgREST responde "intervalo não
  // satisfatível" (PGRST103). Não é falha: conta o total com os mesmos filtros e devolve a lista
  // vazia, para a tela redirecionar para a última página que existe.
  if (error?.code === "PGRST103") {
    let contagem = supabase.from("propostas_situacao").select("id", { count: "exact", head: true });
    if (f.status) contagem = contagem.eq("status_efetivo", f.status);
    if (f.q) contagem = contagem.or(`titulo.ilike.%${f.q}%,cliente_nome.ilike.%${f.q}%`);
    const { count: total } = await contagem;
    return {
      itens: [],
      total: total ?? 0,
      paginas: Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE)),
    };
  }
  if (error) throw new Error("Falha ao listar propostas");

  const total = count ?? 0;
  return {
    itens: (data ?? []).map(paraResumo),
    total,
    paginas: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Existe alguma proposta (de qualquer status)? Diferencia "nenhuma ainda" de "nenhum resultado". */
export async function temPropostas(): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase.from("propostas").select("id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}

export type ResumoPainel = {
  aguardando: number;
  aceitasMes: number;
  valorAceitoMesCentavos: number;
};

export async function resumoPainel(): Promise<ResumoPainel> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("resumo_painel").single();
  return {
    aguardando: Number(data?.aguardando ?? 0),
    aceitasMes: Number(data?.aceitas_mes ?? 0),
    valorAceitoMesCentavos: Number(data?.valor_aceito_mes_centavos ?? 0),
  };
}

export type ItemAtencao = { proposta: ProposalSummary; atencao: Attention };

/** Propostas que dependem de uma ação do prestador agora (mais urgentes primeiro). */
export async function precisaDeAtencao(agora = new Date()): Promise<ItemAtencao[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("propostas_situacao")
    .select(LISTA_COLUNAS)
    .in("status", ["enviada", "visualizada", "ajuste_solicitado"])
    .order("validade_em", { ascending: true })
    .limit(50);

  return (data ?? [])
    .map((l) => {
      const proposta = paraResumo(l);
      return {
        proposta,
        atencao: atencao({ status: proposta.status, validadeEm: l.validade_em }, agora),
      };
    })
    .filter((i): i is ItemAtencao => i.atencao !== null)
    .sort((a, b) => Number(b.atencao.urgencia === "alta") - Number(a.atencao.urgencia === "alta"))
    .slice(0, 5);
}

export async function propostasRecentes(limite = 5): Promise<ProposalSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("propostas_situacao")
    .select(LISTA_COLUNAS)
    .order("atualizado_em", { ascending: false })
    .limit(limite);
  return (data ?? []).map(paraResumo);
}

const idSchema = z.uuid();

export type VersaoDetalhe = {
  id: string;
  numero: number;
  conteudo: ConteudoRascunho;
  hashSha256: string | null;
  enviadaEm: string | null;
  criadoEm: string;
  /** Só versões enviadas têm. Mostra as partes como eram no envio. */
  snapshot: SnapshotDocumento | null;
  /**
   * Hash RECALCULADO agora, a partir do conteúdo guardado, comparado com o gravado no envio.
   * null = versão ainda em rascunho. false só aconteceria se o conteúdo tivesse sido adulterado.
   */
  hashConfere: boolean | null;
};

export type PropostaDetalhe = {
  id: string;
  titulo: string;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone: string | null;
  status: PropostaStatus;
  versaoAtual: number;
  validadeEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
  versoes: VersaoDetalhe[];
  eventos: AuditEvent[];
};

/** Proposta + versões + trilha de auditoria. Id inválido ou de outro prestador → 404. */
export async function carregarProposta(id: string): Promise<PropostaDetalhe> {
  if (!idSchema.safeParse(id).success) notFound();
  const supabase = await createClient();

  const [proposta, versoes, eventos] = await Promise.all([
    supabase.from("propostas_situacao").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("proposta_versoes")
      .select("id, numero, conteudo, hash_sha256, enviada_em, criado_em")
      .eq("proposta_id", id)
      .order("numero", { ascending: true }),
    supabase
      .from("auditoria_eventos")
      .select("id, tipo, ip, user_agent, criado_em")
      .eq("proposta_id", id)
      .order("criado_em", { ascending: true }),
  ]);

  const p = proposta.data;
  if (!p || !p.id) notFound(); // RLS: proposta de outro prestador aparece como inexistente

  return {
    id: p.id,
    titulo: p.titulo ?? "",
    clienteNome: p.cliente_nome ?? "",
    clienteEmail: p.cliente_email ?? "",
    clienteTelefone: p.cliente_telefone ?? null,
    status: p.status_efetivo ?? "rascunho",
    versaoAtual: p.versao_atual ?? 1,
    validadeEm: p.validade_em ?? null,
    criadoEm: p.criado_em ?? "",
    atualizadoEm: p.atualizado_em ?? "",
    versoes: (versoes.data ?? []).map((v) => ({
      id: v.id,
      numero: v.numero,
      conteudo: normalizarConteudo(v.conteudo),
      hashSha256: v.hash_sha256,
      enviadaEm: v.enviada_em,
      criadoEm: v.criado_em,
      snapshot: v.enviada_em ? lerSnapshot(v.conteudo) : null,
      hashConfere: v.hash_sha256 ? confereHash(v.conteudo, v.hash_sha256) : null,
    })),
    eventos: (eventos.data ?? []).map((e) => ({
      id: e.id,
      tipo: e.tipo as EventoTipo,
      criadoEm: e.criado_em,
      ip: e.ip === null ? null : String(e.ip),
      userAgent: e.user_agent,
    })),
  };
}

export type ModeloResumo = {
  id: string;
  nicho: Nicho;
  titulo: string;
  proprio: boolean;
  conteudo: ConteudoRascunho;
};

/** Modelos globais e do prestador (o RLS já filtra: globais ativos + os próprios). */
export async function listarModelos(): Promise<ModeloResumo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("templates")
    .select("id, nicho, titulo, conteudo, dono_id")
    .eq("ativo", true)
    .order("titulo", { ascending: true });
  return (data ?? []).map((t) => ({
    id: t.id,
    nicho: t.nicho,
    titulo: t.titulo,
    proprio: t.dono_id !== null,
    conteudo: normalizarConteudo(t.conteudo),
  }));
}

export async function carregarModelo(id: string): Promise<ModeloResumo> {
  if (!idSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("templates")
    .select("id, nicho, titulo, conteudo, dono_id")
    .eq("id", id)
    .eq("ativo", true)
    .maybeSingle();
  if (!data) notFound();
  return {
    id: data.id,
    nicho: data.nicho,
    titulo: data.titulo,
    proprio: data.dono_id !== null,
    conteudo: normalizarConteudo(data.conteudo),
  };
}
