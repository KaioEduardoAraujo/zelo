/*
 * Rotas e redirecionamentos de autenticação.
 * Arquivo sem dependências de servidor: é usado pelo proxy.ts, pelas Server Actions e pelos testes.
 */

/** Áreas que exigem login. A checagem de PAPEL é feita no servidor (lib/auth/dal.ts). */
export const PROTECTED_PREFIXES = ["/inicio", "/propostas", "/templates", "/conta", "/admin"];

/** Telas de quem ainda não entrou. Usuário logado é mandado para o painel. */
export const GUEST_ONLY = ["/login", "/cadastro", "/esqueci-senha"];

export const HOME_PRESTADOR = "/inicio";
export const HOME_ADMIN = "/admin";

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isProtectedPath = (pathname: string) =>
  PROTECTED_PREFIXES.some((p) => matches(pathname, p));

export const isGuestOnlyPath = (pathname: string) => GUEST_ONLY.some((p) => matches(pathname, p));

/**
 * Valida o parâmetro `next` antes de redirecionar.
 * Só aceita caminhos internos ("/propostas?x=1"). Bloqueia redirecionamento aberto
 * ("https://site-malicioso.com", "//site-malicioso.com", "/\\site-malicioso.com"), que poderia
 * ser usado em phishing: "entre no Zelo" → login real → cai num site falso.
 */
export function safeNextPath(next: unknown, fallback = HOME_PRESTADOR): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback; // quebras de linha e outros controles

  try {
    // Base fictícia: se o resultado sair dela, o caminho tentou escapar para outro domínio.
    const url = new URL(next, "http://zelo.invalid");
    if (url.origin !== "http://zelo.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
