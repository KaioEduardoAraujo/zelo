import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

export type Db = SupabaseClient<Database>;

const cfg = () => inject("supabase");
const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;

// service_role: ignora o RLS, mas não os triggers.
export function serviceClient(): Db {
  return createClient<Database>(cfg().url, cfg().secretKey, opts);
}

export function anonClient(): Db {
  return createClient<Database>(cfg().url, cfg().publishableKey, opts);
}

export type Usuario = { id: string; email: string; client: Db };

export async function criarUsuario(
  nome: string,
  metadados: Record<string, string> = {},
): Promise<Usuario> {
  const email = `teste-${randomUUID().slice(0, 8)}@example.com`;
  const password = `Senha-${randomBytes(9).toString("base64url")}1`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome, ...metadados },
  });
  if (error || !data.user) throw error ?? new Error("usuário não criado");

  const client = anonClient();
  const { error: loginError } = await client.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;
  return { id: data.user.id, email, client };
}

export async function criarAdmin(): Promise<Usuario> {
  const admin = await criarUsuario("Admin de Teste");
  const { error } = await serviceClient()
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", admin.id);
  if (error) throw error;
  return admin;
}

export const hashAleatorio = () => createHash("sha256").update(randomBytes(16)).digest("hex");

const conteudo = {
  escopo: "Troca de tela do iPhone 12 com testes de touch e câmera.",
  itens: [{ descricao: "Tela OLED", unidade: "un", quantidade: 1, valor_unitario_centavos: 78000 }],
  exclusoes: ["Recuperação de dados"],
  valor_total_centavos: 78000,
  prazo: "2 dias úteis",
  pagamento: "Pix na retirada",
  garantia: "90 dias",
};

export async function criarRascunho(dono: Usuario) {
  const { data: proposta, error } = await dono.client
    .from("propostas")
    .insert({
      prestador_id: dono.id,
      cliente_nome: "Mariana Costa",
      cliente_email: "mariana@example.com",
      titulo: "Troca de tela iPhone 12",
    })
    .select()
    .single();
  if (error) throw error;

  const { data: versao, error: vErr } = await dono.client
    .from("proposta_versoes")
    .insert({ proposta_id: proposta.id, numero: 1, conteudo })
    .select()
    .single();
  if (vErr) throw vErr;
  return { proposta, versao };
}

export async function criarEnviada(dono: Usuario) {
  const { proposta, versao } = await criarRascunho(dono);
  const hash = hashAleatorio();

  const { error: e1 } = await dono.client
    .from("proposta_versoes")
    .update({ enviada_em: new Date().toISOString(), hash_sha256: hash })
    .eq("id", versao.id);
  if (e1) throw e1;

  const { error: e2 } = await dono.client
    .from("propostas")
    .update({
      status: "enviada",
      token_hash: hashAleatorio(),
      validade_em: new Date(Date.now() + 7 * 864e5).toISOString(),
    })
    .eq("id", proposta.id);
  if (e2) throw e2;

  return { propostaId: proposta.id, versaoId: versao.id, hash };
}

export async function criarAceita(dono: Usuario) {
  const enviada = await criarEnviada(dono);
  const svc = serviceClient();

  const { data: aceite, error } = await svc
    .from("aceites")
    .insert({
      versao_id: enviada.versaoId,
      resultado: "aceito",
      cliente_nome: "Mariana Costa",
      cliente_cpf: "12345678909",
      ip: "177.92.40.18",
      user_agent: "Mozilla/5.0 (Linux; Android 15) Chrome/131",
      otp_verificado_em: new Date().toISOString(),
      texto_consentimento: "Li a proposta e aceito os termos acima.",
      hash_documento: enviada.hash,
    })
    .select()
    .single();
  if (error) throw error;

  const { error: e2 } = await svc
    .from("propostas")
    .update({ status: "aceita" })
    .eq("id", enviada.propostaId);
  if (e2) throw e2;

  const { data: evento, error: e3 } = await svc
    .from("auditoria_eventos")
    .insert({ proposta_id: enviada.propostaId, versao_id: enviada.versaoId, tipo: "aceita" })
    .select()
    .single();
  if (e3) throw e3;

  return { ...enviada, aceiteId: aceite.id, eventoId: evento.id };
}

export function psql(sql: string) {
  return execFileSync(
    "docker",
    ["exec", "supabase_db_zelo", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).toString();
}
