import { CircleAlert, CircleCheck, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "error" | "success" | "info";

const ESTILO: Record<Tone, string> = {
  error: "bg-danger-bg text-danger",
  success: "bg-success-bg text-success",
  info: "bg-info-bg text-info",
};

const ICONE = { error: CircleAlert, success: CircleCheck, info: Info } as const;

/**
 * Mensagem geral da tela ou do formulário. Erro usa role="alert" (anunciado na hora);
 * sucesso e informação usam role="status" (anunciado com calma).
 */
export function FormMessage({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = ICONE[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-[var(--radius-control)] px-3.5 py-3 text-support",
        ESTILO[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
