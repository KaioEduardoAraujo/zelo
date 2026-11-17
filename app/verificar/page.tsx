import type { Metadata } from "next";

import { FormVerificacao } from "@/components/verificar/form-verificacao";
import { Logo } from "@/components/zelo/logo";

export const metadata: Metadata = {
  title: "Verificar comprovante",
  description: "Confira a autenticidade de um comprovante emitido pelo Zelo.",
};

/**
 * Verificação pública (DESIGN.md 7.2.8): qualquer pessoa com o código do comprovante confere se
 * o documento registrado está íntegro e, opcionalmente, se o PDF que tem em mãos é o original.
 * O link do e-mail e do PDF já traz o código em `?codigo=`.
 */
export default async function VerificarPage(props: PageProps<"/verificar">) {
  const { codigo } = await props.searchParams;
  const codigoInicial = typeof codigo === "string" ? codigo.slice(0, 40) : "";

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 py-8 md:py-12">
      <Logo height={32} className="mb-8" />
      <h1 className="text-h1 text-navy-950">Verificar comprovante</h1>
      <p className="mt-2 mb-8 text-slate-600">
        Informe o código do comprovante para conferir se o documento registrado no Zelo continua
        exatamente como foi aceito.
      </p>
      <FormVerificacao codigoInicial={codigoInicial} />
    </main>
  );
}
