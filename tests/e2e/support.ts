import { execSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

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
