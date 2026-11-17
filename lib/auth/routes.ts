export const PROTECTED_PREFIXES = ["/inicio", "/propostas", "/templates", "/conta", "/admin"];

export const GUEST_ONLY = ["/login", "/cadastro", "/esqueci-senha"];

export const HOME_PRESTADOR = "/inicio";
export const HOME_ADMIN = "/admin";

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isProtectedPath = (pathname: string) =>
  PROTECTED_PREFIXES.some((p) => matches(pathname, p));

export const isGuestOnlyPath = (pathname: string) => GUEST_ONLY.some((p) => matches(pathname, p));

// Só caminhos internos: evita redirecionamento aberto (//site.com, /\\site.com).
export function safeNextPath(next: unknown, fallback = HOME_PRESTADOR): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;

  try {
    // Se sair da base fictícia, o caminho tentou escapar para outro domínio.
    const url = new URL(next, "http://zelo.invalid");
    if (url.origin !== "http://zelo.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
