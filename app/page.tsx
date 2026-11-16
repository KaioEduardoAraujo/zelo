import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/zelo/logo";
import { ReceiptPreview } from "@/components/zelo/receipt-preview";

const steps = [
  {
    title: "Monte a proposta",
    text: "Comece por um modelo do seu ramo: escopo, itens, o que não está incluso, prazo e garantia.",
  },
  {
    title: "Envie pelo WhatsApp",
    text: "Um link único, pronto para colar na conversa que você já tem com o cliente.",
  },
  {
    title: "O cliente aceita no celular",
    text: "Sem criar conta. A identidade é confirmada por um código enviado por e-mail.",
  },
  {
    title: "Os dois ficam com o comprovante",
    text: "PDF com data, hora, dispositivo e o hash do documento aceito.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-8 md:py-6">
        <Link
          href="/"
          aria-label="Zelo, página inicial"
          className="rounded-[var(--radius-control)]"
        >
          <Logo height={32} />
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 md:px-8">
        <section className="grid items-center gap-10 pt-6 pb-16 md:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-16 lg:pb-24">
          <div className="max-w-xl">
            <h1 className="text-display text-navy-950 md:text-[3.5rem] md:leading-[3.75rem]">
              Combinou? Registrou.
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Envie propostas, escopos e entregas por link. Seu cliente lê e aceita pelo celular, e
              você fica com um comprovante que mostra exatamente o que foi combinado.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/cadastro">Criar minha conta</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/login">Já tenho conta</Link>
              </Button>
            </div>
            <p className="mt-4 text-support text-slate-600">
              Para reformas, assistência técnica, instalação, design e agências.
            </p>
          </div>

          <ReceiptPreview />
        </section>

        <section aria-labelledby="como-funciona" className="border-t border-line py-12 md:py-16">
          <h2 id="como-funciona" className="text-h2 text-navy-900">
            Como funciona
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-4 md:gap-6">
            {steps.map((step, i) => (
              <li key={step.title} className="relative md:pt-8">
                <span
                  aria-hidden="true"
                  className="absolute top-3 right-0 left-8 hidden h-px bg-line md:block"
                />
                <span className="flex size-7 items-center justify-center rounded-full border border-navy-800 font-mono text-xs font-medium text-navy-800 md:absolute md:top-0">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-h3 text-navy-900 md:mt-0">{step.title}</h3>
                <p className="mt-1 text-support text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-6 text-support text-slate-600 md:flex-row md:justify-between md:px-8">
          <p>Zelo, aceite digital para prestadores de serviço.</p>
          <p>Projeto acadêmico de Análise e Desenvolvimento de Sistemas.</p>
        </div>
      </footer>
    </div>
  );
}
