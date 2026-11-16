import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isGuestOnlyPath, isProtectedPath } from "@/lib/auth/routes";

/*
 * Proxy (antigo "middleware" — renomeado no Next 16). Roda antes de cada requisição e faz
 * duas coisas:
 *
 *  1. Renova a sessão do Supabase (o access token expira em 1h; aqui ele é trocado usando o
 *     refresh token e os cookies novos voltam na resposta).
 *  2. Redirecionamento OTIMISTA: sem login → /login; logado nas telas de visitante → /inicio.
 *
 * Isto NÃO é a checagem de segurança. Papel (admin/prestador) e conta suspensa são verificados
 * no servidor em lib/auth/dal.ts, e o banco ainda aplica RLS. O proxy só evita mostrar
 * uma tela que, de qualquer forma, não carregaria dados.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Respostas que gravam cookie de sessão não podem ficar em cache de CDN.
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  // getClaims() valida a assinatura do JWT (não confia cegamente no cookie).
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!isLoggedIn && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return redirectKeepingCookies(url, response);
  }

  if (isLoggedIn && isGuestOnlyPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    url.search = "";
    return redirectKeepingCookies(url, response);
  }

  return response;
}

/** Ao redirecionar, leva junto os cookies renovados (senão a sessão se perderia). */
function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  const cacheControl = from.headers.get("Cache-Control");
  if (cacheControl) redirect.headers.set("Cache-Control", cacheControl);
  return redirect;
}

export const config = {
  matcher: [
    // Tudo, exceto: arquivos estáticos, ícones, marca e a página pública do cliente (/p/...),
    // que não usa sessão e precisa ser o mais leve possível.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|brand/|p/).*)",
  ],
};
