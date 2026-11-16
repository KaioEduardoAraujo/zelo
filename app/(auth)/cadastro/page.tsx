import type { Metadata } from "next";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-h1 text-navy-950">Criar sua conta</h1>
      <p className="mt-2 text-slate-600">
        Monte a primeira proposta em poucos minutos. Seus clientes não precisam criar conta.
      </p>
      <SignupForm />
    </>
  );
}
