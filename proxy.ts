import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isGuestOnlyPath, isProtectedPath } from "@/lib/auth/routes";

// Renova a sessão e redireciona de forma otimista. Não é a checagem de segurança: ela fica em
// lib/auth/dal.ts e no RLS.
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

  // getClaims() valida a assinatura do JWT.
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

// Leva os cookies renovados no redirecionamento.
function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  const cacheControl = from.headers.get("Cache-Control");
  if (cacheControl) redirect.headers.set("Cache-Control", cacheControl);
  return redirect;
}

export const config = {
  matcher: [
    // Fora: estáticos, marca e a página do cliente (/p), que não usa sessão.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|brand/|p/).*)",
  ],
};
