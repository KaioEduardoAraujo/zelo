import {
  Check,
  Clock,
  Eye,
  MessageSquareText,
  Pencil,
  Send,
  X,
  type LucideIcon,
} from "lucide-react";

import { STATUS, type PropostaStatus, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

const ICON: Record<PropostaStatus, LucideIcon> = {
  rascunho: Pencil,
  enviada: Send,
  visualizada: Eye,
  ajuste_solicitado: MessageSquareText,
  aceita: Check,
  recusada: X,
  expirada: Clock,
};

export const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  neutral: "bg-neutral-bg text-neutral",
};

/** Status sempre com ícone + texto + cor — nunca só cor (acessibilidade). */
export function StatusBadge({ status, className }: { status: PropostaStatus; className?: string }) {
  const { label, tone } = STATUS[status];
  const Icon = ICON[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-[var(--radius-pill)] pr-2.5 pl-2 text-label whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}
