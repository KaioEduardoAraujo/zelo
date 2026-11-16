import { z } from "zod";

/*
 * Variáveis de ambiente validadas com Zod.
 *
 * Separação proposital:
 * - `publicEnv`: só o que PODE ir para o navegador (prefixo NEXT_PUBLIC_).
 * - `serverEnv()`: segredos. Fica em `lib/env.server.ts`, que importa "server-only",
 *   então o build falha se algum componente de cliente tentar importá-lo.
 *
 * O Next.js só injeta NEXT_PUBLIC_* no bundle do cliente quando a variável é
 * referenciada literalmente (process.env.NEXT_PUBLIC_X), por isso a leitura abaixo
 * é feita campo a campo, e não com `process.env` inteiro.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    // Mostra apenas os NOMES das variáveis com problema, nunca os valores.
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente públicas inválidas: ${missing}. Veja .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
