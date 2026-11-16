/*
 * Cria (ou promove) o usuário administrador.
 *
 *   npm run db:seed-admin        → usa .env.local
 *
 * Variáveis: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *            SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (mín. 12 caracteres).
 *
 * Por que não no seed.sql? A senha ficaria em texto puro num arquivo versionado.
 * Aqui ela vem do ambiente e vai direto para o Supabase Auth, que guarda só o hash (bcrypt).
 * Idempotente: rodar de novo apenas garante role = admin e ativo = true.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;

if (!url || !serviceKey || !email || !password) {
  console.error(
    "Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD.",
  );
  process.exit(1);
}
if (password.length < 12) {
  console.error("SEED_ADMIN_PASSWORD precisa ter pelo menos 12 caracteres.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId(target: string): Promise<string | undefined> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === target);
    if (user) return user.id;
    if (data.users.length < 200) return undefined;
  }
}

let userId = await findUserId(email);

if (!userId) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: "Administrador" },
  });
  if (error) throw error;
  userId = data.user.id;
  console.log("Usuário administrador criado.");
} else {
  console.log("Usuário já existia; garantindo o papel de administrador.");
}

// O perfil foi criado pelo trigger como 'prestador'; só o servidor pode promovê-lo.
const { error } = await supabase
  .from("profiles")
  .update({ role: "admin", ativo: true })
  .eq("id", userId);
if (error) throw error;

console.log("Pronto: administrador configurado.");
