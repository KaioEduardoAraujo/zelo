import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

// token_hash em vez de PKCE: o PKCE só funciona no mesmo navegador que pediu o link.
const querySchema = z.object({
  token_hash: z.string().min(10).max(512),
  type: z.enum(["recovery", "signup", "email", "email_change", "invite", "magiclink"]),
  next: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  const fail = new URL("/login?erro=link-invalido", request.url);

  if (!parsed.success) return NextResponse.redirect(fail);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: parsed.data.type as EmailOtpType,
    token_hash: parsed.data.token_hash,
  });
  if (error) return NextResponse.redirect(fail);

  const fallback = parsed.data.type === "recovery" ? "/redefinir-senha" : "/inicio";
  return NextResponse.redirect(new URL(safeNextPath(parsed.data.next, fallback), request.url));
}
