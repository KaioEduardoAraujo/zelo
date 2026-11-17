"use server";

import { createHash } from "node:crypto";

import { hashConfere, iguais } from "@/lib/crypto/hash";
import { origemDaRequisicao } from "@/lib/http/origem";
import { lerSnapshot } from "@/lib/proposals/snapshot";
import { dentroDoLimite } from "@/lib/publico/limites";
import { createServiceClient } from "@/lib/supabase/service";
import type { TipoDocumento } from "@/lib/tipos";
import { verificacaoSchema } from "@/lib/verificar/schemas";

// Mostra só o necessário para a prova; nada do cliente (LGPD).

export type EstadoArquivo = "confere" | "diferente" | "sem_original" | "nao_enviado";

export type VerificacaoResultado =
  | {
      estado: "integro" | "divergente";
      tipo: TipoDocumento;
      resultado: "aceito" | "recusado" | "ajuste";
      registradoEm: string;
      prestador: string;
      versao: number;
      hash: string;
      arquivo: EstadoArquivo;
    }
  | { estado: "nao_encontrado" }
  | { estado: "erro"; message: string; erros?: Record<string, string> };

export async function verificarComprovante(entrada: unknown): Promise<VerificacaoResultado> {
  const origem = await origemDaRequisicao();
  // 32⁸ combinações + limite por IP: inviável sair testando códigos.
  if (!(await dentroDoLimite("verificar", origem.ip, 20, 600))) {
    return { estado: "erro", message: "Muitas consultas seguidas. Espere alguns minutos." };
  }

  const dados = verificacaoSchema.safeParse(entrada);
  if (!dados.success) {
    const msg =
      dados.error.issues.find((i) => i.path[0] === "codigo")?.message ??
      "Não conseguimos ler o arquivo. Tente de novo.";
    return { estado: "erro", message: msg, erros: { codigo: msg } };
  }

  const svc = createServiceClient();
  const { data: a } = await svc
    .from("aceites")
    .select("versao_id, resultado, criado_em, hash_documento, pdf_path")
    .eq("codigo_comprovante", dados.data.codigo)
    .maybeSingle();
  if (!a) return { estado: "nao_encontrado" };

  const { data: v } = await svc
    .from("proposta_versoes")
    .select("proposta_id, numero, conteudo, hash_sha256")
    .eq("id", a.versao_id)
    .single();
  if (!v?.hash_sha256) return { estado: "nao_encontrado" };
  const { data: proposta } = await svc
    .from("propostas")
    .select("tipo")
    .eq("id", v.proposta_id)
    .single();

  const integro = hashConfere(v.conteudo, v.hash_sha256) && iguais(a.hash_documento, v.hash_sha256);
  const snapshot = lerSnapshot(v.conteudo);

  let arquivo: EstadoArquivo = "nao_enviado";
  if (dados.data.arquivoSha256) {
    const { data: guardado } = a.pdf_path
      ? await svc.storage.from("comprovantes").download(a.pdf_path)
      : { data: null };
    if (!guardado) arquivo = "sem_original";
    else {
      const original = createHash("sha256")
        .update(Buffer.from(await guardado.arrayBuffer()))
        .digest("hex");
      arquivo = iguais(original, dados.data.arquivoSha256) ? "confere" : "diferente";
    }
  }

  return {
    estado: integro ? "integro" : "divergente",
    tipo: proposta?.tipo ?? "proposta",
    resultado: a.resultado,
    registradoEm: a.criado_em,
    prestador: snapshot ? snapshot.prestador.empresa || snapshot.prestador.nome : "—",
    versao: v.numero,
    hash: v.hash_sha256,
    arquivo,
  };
}
