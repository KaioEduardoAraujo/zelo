import { Check } from "lucide-react";

import { AcceptanceStamp } from "@/components/zelo/acceptance-stamp";
import { formatCentavos, formatDateTime, maskCpf } from "@/lib/format";
import { cn } from "@/lib/utils";

// Dados de exemplo realistas (DESIGN.md 9): nada de "John Doe".
const sample = {
  code: "ZL-4K7Q-92MD",
  title: "Reforma do banheiro",
  provider: "Andrade Reformas",
  client: "Mariana Costa",
  totalCentavos: 840_000,
  acceptedAt: formatDateTime("2026-11-12T17:32:00Z"),
  ip: "177.92.40.18",
  device: "Android 15, Chrome 131",
  cpf: maskCpf("123.456.789-09"),
  hash: "3ef347c9e2d8a87969909bdcdb03290b7481db6a936731f798db08d1c7b4013b",
};

/** Comprovante de exemplo: o documento é o herói da página (DESIGN.md 1.1). */
export function ReceiptPreview({ className }: { className?: string }) {
  return (
    <figure
      aria-label="Exemplo de comprovante de aceite"
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-hairline)]",
        className,
      )}
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
          <p className="tabular mt-1 text-h1 text-navy-950">
            {formatCentavos(sample.totalCentavos)}
          </p>
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
