import Image from "next/image";

/**
 * Link inválido. Mesma resposta para token malformado, inexistente ou substituído por um link
 * novo: não revela se a proposta existe. Sem links para a área logada (é a página do cliente).
 */
export default function LinkInvalido() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Image src="/brand/symbol.svg" alt="" width={40} height={40} unoptimized className="mb-8" />
      <h1 className="text-h1 text-navy-950">Link inválido</h1>
      <p className="mt-3 text-slate-600">
        Este link não está valendo. Ele pode ter sido copiado pela metade, ou o prestador pode ter
        enviado um link novo para esta proposta.
      </p>
      <p className="mt-3 text-slate-600">Peça ao prestador para enviar o link de novo.</p>
    </main>
  );
}
