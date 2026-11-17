import { Check } from "lucide-react";

import { ETAPAS, type Etapa } from "@/lib/proposals/draft";
import { cn } from "@/lib/utils";

export function Stepper({
  atual,
  onIr,
  className,
}: {
  atual: Etapa;
  onIr?: (etapa: Etapa) => void;
  className?: string;
}) {
  const info = ETAPAS[atual - 1];
  return (
    <nav aria-label="Etapas da proposta" className={className}>
      <div className="md:hidden">
        <p className="text-support text-slate-600">
          Etapa {atual} de {ETAPAS.length}
        </p>
        <p className="text-h3 text-navy-950">{info.titulo}</p>
        <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
          {ETAPAS.map((e) => (
            <span
              key={e.numero}
              className={cn(
                "h-1.5 rounded-full",
                e.numero <= atual ? "bg-teal-600" : "bg-line-strong",
              )}
            />
          ))}
        </div>
      </div>

      <ol className="hidden items-center gap-2 md:flex">
        {ETAPAS.map((e, i) => {
          const concluida = e.numero < atual;
          const corrente = e.numero === atual;
          const conteudo = (
            <>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-medium",
                  corrente && "border-teal-600 bg-teal-600 text-white",
                  concluida && "border-teal-600 bg-teal-50 text-teal-600",
                  !corrente && !concluida && "border-line-strong text-slate-600",
                )}
              >
                {concluida ? (
                  <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  e.numero
                )}
              </span>
              <span
                className={cn(
                  "text-support font-semibold whitespace-nowrap",
                  corrente ? "text-navy-950" : "text-slate-600",
                )}
              >
                {e.curto}
              </span>
            </>
          );
          return (
            <li
              key={e.numero}
              className="flex items-center gap-2"
              aria-current={corrente ? "step" : undefined}
            >
              {concluida && onIr ? (
                <button
                  type="button"
                  onClick={() => onIr(e.numero)}
                  className="flex items-center gap-2 rounded-[var(--radius-control)] py-1 pr-1 hover:opacity-80"
                >
                  {conteudo}
                  <span className="sr-only"> (voltar para esta etapa)</span>
                </button>
              ) : (
                <span className="flex items-center gap-2 py-1">{conteudo}</span>
              )}
              {i < ETAPAS.length - 1 && (
                <span aria-hidden="true" className="mx-1 h-px w-8 bg-line-strong" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
