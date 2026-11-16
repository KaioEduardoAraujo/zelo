import type { Metadata } from "next";
import Link from "next/link";

import { FormMessage } from "@/components/zelo/form-message";
import { createClient } from "@/lib/supabase/server";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPasswordPage() {
  // A sessão de recuperação foi criada em /auth/confirm a partir do link do e-mail.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <h1 className="text-h1 text-navy-950">Criar nova senha</h1>
      {user ? (
        <>
          <p className="mt-2 text-slate-600">Escolha uma senha que você não use em outros sites.</p>
          <ResetPasswordForm />
        </>
      ) : (
        <div className="mt-8 flex flex-col gap-5">
          <FormMessage tone="error">
            Este link expirou ou já foi usado. Peça um novo para continuar.
          </FormMessage>
          <Link
            href="/esqueci-senha"
            className="self-start text-support font-semibold text-teal-600 underline-offset-4 hover:underline"
          >
            Pedir um novo link
          </Link>
        </div>
      )}
    </>
  );
}
