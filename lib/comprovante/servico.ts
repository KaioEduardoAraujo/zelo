import "server-only";

import { carregarDadosComprovante, type DadosComprovante } from "@/lib/comprovante/dados";
import { sha256Bytes } from "@/lib/crypto/hash";
import { enviarEmail } from "@/lib/email";
import { emailComprovante } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { renderizarComprovante, type ImagensPdf } from "@/lib/pdf/comprovante";
import { createServiceClient } from "@/lib/supabase/service";
import { caminhoFotoValido } from "@/lib/validation/entrega";

/*
 * Ciclo do comprovante: gerar o PDF, guardar no bucket privado `comprovantes` e mandar por
 * e-mail aos dois lados. Tudo com a service_role, sempre no servidor.
 *
 * O PDF é gerado UMA vez e guardado no caminho que o próprio aceite já traz (`pdf_path`, D21).
 * `garantirComprovante` é idempotente: se o arquivo já existe, devolve o guardado; se não existe
 * (o download chegou antes da geração em segundo plano, ou ela falhou), gera agora. Assim o
 * cliente que toca em "Baixar comprovante" logo depois do aceite sempre recebe o arquivo.
 */

const BUCKET = "comprovantes";

export const urlVerificacao = () => `${publicEnv().NEXT_PUBLIC_APP_URL}/verificar`;

export const nomeArquivo = (codigo: string) => `comprovante-${codigo}.pdf`;

type Garantido = { pdf: Buffer; dados: DadosComprovante; caminho: string };

async function baixarGuardado(caminho: string): Promise<Buffer | null> {
  const { data } = await createServiceClient().storage.from(BUCKET).download(caminho);
  return data ? Buffer.from(await data.arrayBuffer()) : null;
}

/**
 * Baixa as fotos de uma entrega para embutir no PDF. Só entram JPEG e PNG (o react-pdf não desenha
 * WebP; essas aparecem só na lista, com o hash) e só se o SHA-256 dos bytes bater com o que foi
 * selado no envio: o PDF nunca mostra uma imagem diferente da que o hash do documento cobre.
 */
async function carregarImagens(dados: DadosComprovante): Promise<ImagensPdf> {
  const imagens: ImagensPdf = {};
  const bucket = createServiceClient().storage.from("entregas");
  for (const f of dados.entrega?.fotos ?? []) {
    if (!f.sha256 || (f.tipo !== "image/jpeg" && f.tipo !== "image/png")) continue;
    if (!caminhoFotoValido(f.path, dados.proposta.prestadorId, dados.proposta.id)) continue;
    const { data } = await bucket.download(f.path);
    if (!data) continue;
    const bytes = Buffer.from(await data.arrayBuffer());
    if (sha256Bytes(bytes) !== f.sha256) continue;
    imagens[f.path] = { data: bytes, formato: f.tipo === "image/png" ? "png" : "jpg" };
  }
  return imagens;
}

/** Devolve o PDF do aceite (gerando e guardando, se ainda não existir). Só aceites com pdf_path. */
export async function garantirComprovante(aceiteId: string): Promise<Garantido | null> {
  const dados = await carregarDadosComprovante(aceiteId);
  const caminho = dados?.aceite.pdfPath;
  if (!dados || !caminho) return null;

  const guardado = await baixarGuardado(caminho);
  if (guardado) return { pdf: guardado, dados, caminho };

  const pdf = await renderizarComprovante({
    dados,
    urlVerificacao: urlVerificacao(),
    imagens: await carregarImagens(dados),
  });

  const svc = createServiceClient();
  // upsert: false → o arquivo nunca é sobrescrito. Se duas gerações correrem ao mesmo tempo, a
  // segunda falha aqui e passa a usar o arquivo que a primeira guardou (o mesmo para todos).
  const { error } = await svc.storage
    .from(BUCKET)
    .upload(caminho, pdf, { contentType: "application/pdf", upsert: false });

  if (error) {
    const existente = await baixarGuardado(caminho);
    if (existente) return { pdf: existente, dados, caminho };
    throw new Error("Falha ao guardar o comprovante.");
  }

  await svc.from("auditoria_eventos").insert({
    proposta_id: dados.proposta.id,
    versao_id: dados.versao.id,
    tipo: "pdf_gerado",
    metadados: { aceite_id: aceiteId },
  });

  return { pdf, dados, caminho };
}

/** URL assinada de curta duração (60 s) para baixar o PDF guardado (regra 7). null se não existe. */
async function urlAssinada(caminho: string, codigo: string): Promise<string | null> {
  const { data, error } = await createServiceClient()
    .storage.from(BUCKET)
    .createSignedUrl(caminho, 60, { download: nomeArquivo(codigo) });
  return error ? null : (data?.signedUrl ?? null);
}

/**
 * Link de download do comprovante. Quem chama JÁ conferiu a permissão (token do link ou sessão +
 * RLS). Se o PDF ainda não foi guardado, gera agora e então assina.
 */
export async function linkDoComprovante(aceite: {
  id: string;
  pdfPath: string | null;
  codigo: string;
}): Promise<string | null> {
  if (!aceite.pdfPath) return null;
  const pronto = await urlAssinada(aceite.pdfPath, aceite.codigo);
  if (pronto) return pronto;
  const garantido = await garantirComprovante(aceite.id);
  return garantido ? urlAssinada(garantido.caminho, aceite.codigo) : null;
}

/**
 * Executado em segundo plano logo depois do aceite (`after()`): o cliente já recebeu a resposta
 * e o aceite já vale. Falha aqui não desfaz nada; o download gera o PDF de novo se preciso.
 * Sem dados pessoais no log: só o id do aceite.
 */
export async function processarAceite(aceiteId: string): Promise<void> {
  let garantido: Garantido | null;
  try {
    garantido = await garantirComprovante(aceiteId);
  } catch {
    console.error(`[comprovante] falha ao gerar o PDF do aceite ${aceiteId}`);
    return;
  }
  if (!garantido) return;

  const { dados, pdf } = garantido;
  const anexo = { nome: nomeArquivo(dados.aceite.codigo), conteudo: pdf, tipo: "application/pdf" };
  const base = {
    tipo: dados.proposta.tipo,
    titulo: dados.partes.titulo,
    prestador: dados.partes.prestador.empresa || dados.partes.prestador.nome,
    clienteNome: dados.partes.cliente.nome,
    codigo: dados.aceite.codigo,
    registradoEm: dados.aceite.criadoEm,
    urlVerificacao: urlVerificacao(),
  };

  const destinos = [
    { papel: "cliente" as const, email: dados.partes.cliente.email },
    { papel: "prestador" as const, email: dados.prestadorEmail },
  ].filter((d) => d.email);

  const enviados: string[] = [];
  for (const d of destinos) {
    try {
      await enviarEmail({
        para: d.email,
        ...emailComprovante({
          ...base,
          para: d.papel,
          urlPainel: `${publicEnv().NEXT_PUBLIC_APP_URL}/propostas/${dados.proposta.id}`,
        }),
        anexos: [anexo],
      });
      enviados.push(d.papel);
    } catch {
      console.error(`[comprovante] falha ao enviar o e-mail (${d.papel}) do aceite ${aceiteId}`);
    }
  }

  if (enviados.length > 0) {
    // Só o PAPEL de quem recebeu, nunca o endereço (LGPD).
    await createServiceClient()
      .from("auditoria_eventos")
      .insert({
        proposta_id: dados.proposta.id,
        versao_id: dados.versao.id,
        tipo: "email_enviado",
        metadados: { aceite_id: aceiteId, destinatarios: enviados },
      });
  }
}
