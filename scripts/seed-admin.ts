// Cria ou promove o administrador. A senha vem do ambiente, não de um arquivo versionado.
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

// O trigger cria o perfil como prestador; só o servidor pode promovê-lo.
const { error } = await supabase
  .from("profiles")
  .update({ role: "admin", ativo: true })
  .eq("id", userId);
if (error) throw error;

console.log("Pronto: administrador configurado.");
