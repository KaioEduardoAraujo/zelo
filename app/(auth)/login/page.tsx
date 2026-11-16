import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  "link-invalido": "Este link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, erro } = await props.searchParams;
  const notice = typeof erro === "string" ? NOTICES[erro] : undefined;

  return (
    <>
      <h1 className="text-h1 text-navy-950">Entrar no Zelo</h1>
      <p className="mt-2 text-slate-600">
        Acompanhe suas propostas e os aceites dos seus clientes.
      </p>
      <LoginForm next={typeof next === "string" ? next : undefined} notice={notice} />
    </>
  );
}
