import { cn } from "@/lib/utils";

type AcceptanceStampProps = {
  /** Data e hora já formatadas (dd/MM/yyyy HH:mm). */
  acceptedAt: string;
  /** Código curto do comprovante, ex.: ZL-4K7Q-92MD. */
  code: string;
  /** Desenha o check com a animação de marca (~400ms). Use só na confirmação. */
  animate?: boolean;
  className?: string;
};

/**
 * Selo de aceite: anel + check, data e código do comprovante.
 * É o elemento mais "da marca" do produto (DESIGN.md 5). Versão inicial da Fase 0;
 * a Fase 3 completa as variações.
 */
export function AcceptanceStamp({
  acceptedAt,
  code,
  animate = false,
  className,
}: AcceptanceStampProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-[var(--radius-card)] border border-teal-600/25 bg-teal-50 py-2.5 pr-4 pl-2.5",
        className,
      )}
    >
      <svg viewBox="0 0 48 48" className="size-11 shrink-0" aria-hidden="true">
        <circle
          cx="24"
          cy="24"
          r="21"
          fill="none"
          stroke="var(--color-teal-600)"
          strokeWidth="2.5"
        />
        <circle
          cx="24"
          cy="24"
          r="17"
          fill="none"
          stroke="var(--color-teal-600)"
          strokeWidth="1"
          strokeDasharray="2 2.6"
        />
        <path
          d="M15.5 24.5 L21.5 30.5 L33 18"
          pathLength={1}
          fill="none"
          stroke="var(--color-teal-600)"
          strokeWidth="3.5"
          strokeLinecap="square"
          className={animate ? "animate-draw-check" : undefined}
          style={{ strokeDasharray: 1 }}
        />
      </svg>
      <div className="min-w-0">
        <p className="text-support font-bold text-teal-600">Aceite registrado</p>
        <p className="font-mono text-xs leading-5 text-navy-800">
          {acceptedAt} <span className="text-slate-600">{code}</span>
        </p>
      </div>
    </div>
  );
}
