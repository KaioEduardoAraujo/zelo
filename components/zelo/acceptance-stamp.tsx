import { cn } from "@/lib/utils";

type AcceptanceStampProps = {
  /** Data e hora já formatadas (dd/MM/yyyy HH:mm). */
  acceptedAt: string;
  /** Código curto do comprovante, ex.: ZL-4K7Q-92MD. */
  code: string;
  /** Desenha o check com a animação de marca (~400ms). Use só na confirmação do aceite. */
  animate?: boolean;
  /** md: dentro de documentos e listas · lg: tela de sucesso do cliente. */
  size?: "md" | "lg";
  className?: string;
};

/**
 * Selo de aceite: anel + check, data e código do comprovante.
 * É o elemento mais "da marca" do produto (DESIGN.md 5).
 */
export function AcceptanceStamp({
  acceptedAt,
  code,
  animate = false,
  size = "md",
  className,
}: AcceptanceStampProps) {
  const lg = size === "lg";
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-[var(--radius-card)] border border-teal-600/25 bg-teal-50",
        lg ? "gap-4 py-4 pr-6 pl-4" : "gap-3 py-2.5 pr-4 pl-2.5",
        className,
      )}
    >
      <svg
        viewBox="0 0 48 48"
        className={cn("shrink-0", lg ? "size-16" : "size-11")}
        aria-hidden="true"
      >
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
        <p className={cn("font-bold text-teal-600", lg ? "text-h3" : "text-support")}>
          Aceite registrado
        </p>
        <p
          className={cn(
            "font-mono text-navy-800",
            lg ? "mt-0.5 text-sm leading-6" : "text-xs leading-5",
          )}
        >
          {acceptedAt}
        </p>
        <p
          className={cn("font-mono text-slate-600", lg ? "text-sm leading-6" : "text-xs leading-5")}
        >
          Comprovante {code}
        </p>
      </div>
    </div>
  );
}
