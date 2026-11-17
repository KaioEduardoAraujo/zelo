import type { NextConfig } from "next";

// Decisão (ver CLAUDE.md): cacheComponents/partialPrefetching desligados.
// O app é quase todo dinâmico (sessão do Supabase em cookie) e o modelo
// padrão do App Router é mais simples de explicar e depurar no MVP.
const nextConfig: NextConfig = {
  // O botão flutuante "N" do modo dev cobre o canto inferior esquerdo (onde ficam o "Sair"
  // da barra lateral e o "Início" da navegação inferior). Erros de build continuam aparecendo.
  devIndicators: false,
  // O Next, em desenvolvimento, imprime no terminal os ARGUMENTOS de cada Server Action. Nos
  // formulários isso inclui e-mails e nomes (dados pessoais): regra 9 do projeto, nunca logar.
  logging: { serverFunctions: false },
  // As fontes do comprovante em PDF são lidas do disco em tempo de execução (lib/pdf). O Next
  // não tem como descobrir isso sozinho; sem esta linha, elas faltariam no servidor da Vercel.
  // /p/** = aceite (gera o PDF logo depois) e download do cliente; /propostas/** = do prestador.
  outputFileTracingIncludes: {
    "/p/**": ["./lib/pdf/fonts/**"],
    "/propostas/**": ["./lib/pdf/fonts/**"],
  },

  // Cabeçalhos de segurança.
  async headers() {
    return [
      {
        // Em todo o site: não pode ser embutido em outro site (clickjacking) e o navegador
        // não "adivinha" tipos de arquivo.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // O app não usa câmera (a foto da entrega vem pelo seletor de arquivos), microfone
          // nem localização: o navegador nem oferece essas permissões a scripts do site.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // CSP parcial e segura: ninguém embute o site (frame-ancestors, reforça o X-Frame-Options),
          // <base> não pode desviar links e plugins (<object>) ficam proibidos. Uma CSP de scripts
          // com nonce exigiria renderização dinâmica em todo o site; fica como evolução (README).
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
      {
        // Página do cliente: o TOKEN está na URL. no-referrer impede que ele vaze para outro site
        // quando o cliente toca em "Tenho dúvidas"; no-store evita que fique em cache; e o link
        // pessoal nunca deve ser indexado por buscadores.
        source: "/p/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
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
