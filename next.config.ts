import type { NextConfig } from "next";

// cacheComponents desligado: o app é quase todo dinâmico (sessão em cookie).
const nextConfig: NextConfig = {
  // O botão do modo dev cobria o menu no canto inferior esquerdo.
  devIndicators: false,
  // O dev server imprimia os argumentos das Server Actions (e-mails e nomes).
  logging: { serverFunctions: false },
  // As fontes do PDF são lidas do disco em tempo de execução; sem isto faltariam na Vercel.
  outputFileTracingIncludes: {
    "/p/**": ["./lib/pdf/fonts/**"],
    "/propostas/**": ["./lib/pdf/fonts/**"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // CSP parcial: uma CSP de scripts exigiria nonce em todo o site.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
      {
        // O token está na URL: sem referrer, sem cache e sem indexação.
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
