// Gera o .env.local da CI a partir do Supabase local (chaves de demonstração).
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".env.local") && !process.env.CI) {
  console.error("Já existe um .env.local. Este script é para a CI; nada foi alterado.");
  process.exit(1);
}

const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8" }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error("Só gera .env.local para o Supabase local.");
}

const linhas = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY,
  HASH_PEPPER: randomBytes(48).toString("base64"),
  EMAIL_PROVIDER: "smtp",
  EMAIL_FROM: "Zelo <nao-responda@zelo.local>",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "54325",
  SMTP_USER: "mailpit",
  SMTP_PASSWORD: "mailpit",
};

writeFileSync(
  ".env.local",
  Object.entries(linhas)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
);
console.log(".env.local gerado para o Supabase local.");
