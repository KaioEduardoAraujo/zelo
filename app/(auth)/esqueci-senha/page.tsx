import type { Metadata } from "next";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-h1 text-navy-950">Esqueci minha senha</h1>
      <p className="mt-2 text-slate-600">
        Informe o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
