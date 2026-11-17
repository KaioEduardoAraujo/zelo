import { CircleAlert, CircleCheck, LoaderCircle, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AutosaveState } from "@/lib/autosave";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SaveIndicator({
  state,
  onRetry,
  className,
}: {
  state: AutosaveState;
  onRetry: () => void;
  className?: string;
}) {
  const { status, savedAt } = state;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 text-support", className)}
    >
      {status === "saving" && (
        <>
          <LoaderCircle className="size-4 animate-spin text-slate-600" aria-hidden="true" />
          <span className="text-slate-600">Salvando…</span>
        </>
      )}
      {status === "dirty" && (
        <>
          <Pencil className="size-4 text-slate-600" aria-hidden="true" />
          <span className="text-slate-600">Alterações ainda não salvas</span>
        </>
      )}
      {(status === "saved" || status === "idle") && (
        <>
          <CircleCheck className="size-4 text-success" aria-hidden="true" />
          <span className="text-slate-600">
            {savedAt
              ? `Rascunho salvo às ${formatTime(savedAt)}`
              : "Rascunho salvo automaticamente"}
          </span>
        </>
      )}
      {status === "error" && (
        <>
          <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
          <span className="text-danger">
            {state.message ?? "Não conseguimos salvar agora. Seus dados continuam aqui."}
          </span>
          <Button type="button" variant="link" size="sm" onClick={onRetry} className="h-auto">
            Tentar de novo
          </Button>
        </>
      )}
    </div>
  );
}
