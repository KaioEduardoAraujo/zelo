import { execSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

import { hashDocumento } from "@/lib/crypto/hash";
import type { Database } from "@/lib/supabase/database.types";

/* Apoio dos testes e2e: só roda contra o Supabase LOCAL. */
const status = JSON.parse(
  execSync("npx supabase status -o json", { stdio: ["ignore", "pipe", "ignore"] }).toString(),
) as Record<string, string>;
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error("Os testes e2e só rodam contra o Supabase local.");
}

export const service = createClient<Database>(status.API_URL, status.SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAILPIT = status.MAILPIT_URL ?? "http://127.0.0.1:54324";

export const novoEmail = () => `e2e-${randomUUID().slice(0, 8)}@example.com`;
export const novaSenha = () => `Senha${randomBytes(6).toString("hex")}9`;

/** Cria usuário confirmado direto pela Admin API (mais rápido que pela tela). */
export async function criarConta(
  opts: { nome?: string; admin?: boolean; suspensa?: boolean } = {},
) {
  const email = novoEmail();
  const password = novaSenha();
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: opts.nome ?? "Carlos Instalações" },
  });
  if (error) throw error;
  if (opts.admin || opts.suspensa) {
    const { error: e } = await service
      .from("profiles")
      .update({
        ...(opts.admin && { role: "admin" as const }),
        ...(opts.suspensa && { ativo: false }),
      })
      .eq("id", data.user.id);
    if (e) throw e;
  }
  return { id: data.user.id, email, password };
}

export async function entrar(page: Page, email: string, password: string, path = "/login") {
  await page.goto(path);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** Espera o e-mail chegar no Mailpit e devolve o HTML. */
export async function ultimoEmailPara(email: string): Promise<{ subject: string; html: string }> {
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const r = await fetch(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
        );
        const json = (await r.json()) as { messages: { ID: string }[] };
        id = json.messages[0]?.ID;
        return id;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
  const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as {
    Subject: string;
    HTML: string;
  };
  return { subject: msg.Subject, html: msg.HTML };
}

/** Sair da conta: no desktop pela barra lateral; no celular pela tela Conta. */
export async function sair(page: Page) {
  const lateral = page.getByRole("complementary").getByRole("button", { name: "Sair" });
  if (await lateral.isVisible()) {
    await lateral.click();
  } else {
    await page.goto("/conta");
    await page.getByRole("button", { name: "Sair da conta" }).click();
  }
  await expect(page).toHaveURL(/\/login$/);
}

const hashAleatorio = () => createHash("sha256").update(randomBytes(16)).digest("hex");

export type StatusSemeado = "rascunho" | "enviada" | "visualizada" | "ajuste_solicitado" | "aceita";

/**
 * Cria uma proposta já no status pedido, direto pela service_role (só no Supabase local).
 * Os triggers do banco continuam valendo: o status só avança se o registro do cliente existir.
 */
export async function semearProposta(
  prestadorId: string,
  opts: {
    titulo?: string;
    cliente?: string;
    status?: StatusSemeado;
    valorCentavos?: number;
    validadeDias?: number;
  } = {},
) {
  const valor = opts.valorCentavos ?? 97_000;
  const conteudo = {
    escopo: "Troca da tela do aparelho, com testes de touch, câmera e Face ID depois do reparo.",
    itens: [
      {
        descricao: "Tela compatível com o modelo",
        unidade: "un",
        quantidade: 1,
        valor_unitario_centavos: valor,
      },
    ],
    exclusoes: ["Recuperação de dados"],
    valor_total_centavos: valor,
    prazo: "2 dias úteis",
    pagamento: "Pix na retirada do aparelho",
    garantia: "90 dias para peça e serviço",
    validade_dias: opts.validadeDias ?? 7,
  };
  const status = opts.status ?? "rascunho";

  const { data: p, error } = await service
    .from("propostas")
    .insert({
      prestador_id: prestadorId,
      cliente_nome: opts.cliente ?? "Rafael Lima",
      cliente_email: "rafael@example.com",
      titulo: opts.titulo ?? "Troca de tela iPhone 12",
    })
    .select("id")
    .single();
  if (error) throw error;

  const { data: v, error: e2 } = await service
    .from("proposta_versoes")
    .insert({ proposta_id: p.id, numero: 1, conteudo })
    .select("id")
    .single();
  if (e2) throw e2;
  if (status === "rascunho") return { id: p.id, versaoId: v.id, hash: null };

  const hash = hashDocumento(conteudo); // hash REAL do conteúdo: a página de detalhe o confere
  const { error: e3 } = await service
    .from("proposta_versoes")
    .update({ enviada_em: new Date().toISOString(), hash_sha256: hash })
    .eq("id", v.id);
  if (e3) throw e3;

  const { error: e4 } = await service
    .from("propostas")
    .update({
      status: "enviada",
      token_hash: hashAleatorio(),
      validade_em: new Date(Date.now() + (opts.validadeDias ?? 7) * 864e5).toISOString(),
    })
    .eq("id", p.id);
  if (e4) throw e4;

  if (status === "aceita" || status === "ajuste_solicitado") {
    const { error: e5 } = await service.from("aceites").insert({
      versao_id: v.id,
      resultado: status === "aceita" ? "aceito" : "ajuste",
      comentario: status === "ajuste_solicitado" ? "Pode incluir a película?" : null,
      cliente_nome: opts.cliente ?? "Rafael Lima",
      cliente_cpf: status === "aceita" ? "52998224725" : null,
      otp_verificado_em: new Date().toISOString(),
      texto_consentimento: "Li a proposta e aceito os termos acima.",
      hash_documento: hash,
    });
    if (e5) throw e5;
  }
  if (status !== "enviada") {
    const { error: e6 } = await service.from("propostas").update({ status }).eq("id", p.id);
    if (e6) throw e6;
  }
  return { id: p.id, versaoId: v.id, hash };
}

/** Nenhuma rolagem horizontal (DESIGN.md: funciona em 375px). */
export async function semRolagemHorizontal(page: Page) {
  const { scroll, viewport } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(scroll, `largura do conteúdo em ${page.url()}`).toBeLessThanOrEqual(viewport);
}
