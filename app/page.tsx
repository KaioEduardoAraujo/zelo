import { Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AcceptanceStamp } from "@/components/zelo/acceptance-stamp";
import { Logo } from "@/components/zelo/logo";
import { formatCurrency, formatDateTime, maskCpf } from "@/lib/format";

// Dados de exemplo realistas (DESIGN.md 9): nada de "John Doe".
const sample = {
  code: "ZL-4K7Q-92MD",
  title: "Reforma do banheiro",
  provider: "Andrade Reformas",
  client: "Mariana Costa",
  total: 8400,
  acceptedAt: formatDateTime("2026-11-12T17:32:00Z"),
  ip: "177.92.40.18",
  device: "Android 15, Chrome 131",
  cpf: maskCpf("123.456.789-09"),
  hash: "3ef347c9e2d8a87969909bdcdb03290b7481db6a936731f798db08d1c7b4013b",
};

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

/** Comprovante de exemplo: o documento é o herói da página (DESIGN.md 1.1). */
function ReceiptPreview() {
  return (
    <figure
      aria-label="Exemplo de comprovante de aceite"
      className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-hairline)]"
    >
      {/* Corte diagonal: motivo gráfico derivado da diagonal do símbolo (45°). */}
      <span
        aria-hidden="true"
        className="absolute top-0 right-0 size-24 bg-teal-500 [clip-path:polygon(55%_0,100%_0,100%_45%)]"
      />

      <div className="border-b border-line px-4 pt-5 pb-4 md:px-6">
        <div className="flex items-center gap-2 pr-12">
          <p className="text-support text-slate-600">Comprovante de aceite</p>
          <span className="font-mono text-xs text-slate-600">{sample.code}</span>
        </div>
        <p className="mt-3 text-h2 text-navy-900">{sample.title}</p>
        <p className="mt-1 text-support text-slate-600">
          {sample.provider} para {sample.client}
        </p>
      </div>

      <div className="flex items-end justify-between gap-4 px-4 py-4 md:px-6">
        <div>
          <p className="text-label text-slate-600">Valor aceito</p>
          <p className="tabular mt-1 text-h1 text-navy-950">{formatCurrency(sample.total)}</p>
        </div>
        <span className="mb-1 inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-success-bg px-2.5 py-1 text-label text-success">
          <Check className="size-4" strokeWidth={2.25} aria-hidden="true" />
          Aceita
        </span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-dashed border-line-strong px-4 py-4 text-support md:px-6">
        <dt className="text-slate-600">Aceito em</dt>
        <dd className="font-mono text-[0.8125rem] text-navy-900">{sample.acceptedAt}</dd>
        <dt className="text-slate-600">CPF</dt>
        <dd className="font-mono text-[0.8125rem] text-navy-900">{sample.cpf}</dd>
        <dt className="text-slate-600">IP</dt>
        <dd className="font-mono text-[0.8125rem] text-navy-900">{sample.ip}</dd>
        <dt className="text-slate-600">Dispositivo</dt>
        <dd className="text-navy-900">{sample.device}</dd>
      </dl>

      <div className="border-t border-line bg-surface-2 px-4 py-4 md:px-6">
        <p className="text-label text-slate-600">Hash SHA-256 do documento</p>
        <p className="mt-1 font-mono text-xs leading-5 break-all text-navy-800">{sample.hash}</p>
        <AcceptanceStamp
          acceptedAt={sample.acceptedAt}
          code={sample.code}
          animate
          className="mt-4"
        />
      </div>
    </figure>
  );
}
