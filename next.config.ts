import type { NextConfig } from "next";

// Decisão (ver CLAUDE.md): cacheComponents/partialPrefetching desligados.
// O app é quase todo dinâmico (sessão do Supabase em cookie) e o modelo
// padrão do App Router é mais simples de explicar e depurar no MVP.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
