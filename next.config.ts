import type { NextConfig } from "next";

// Decisão (ver CLAUDE.md): cacheComponents/partialPrefetching desligados.
// O app é quase todo dinâmico (sessão do Supabase em cookie) e o modelo
// padrão do App Router é mais simples de explicar e depurar no MVP.
const nextConfig: NextConfig = {
  // O botão flutuante "N" do modo dev cobre o canto inferior esquerdo (onde ficam o "Sair"
  // da barra lateral e o "Início" da navegação inferior). Erros de build continuam aparecendo.
  devIndicators: false,
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
