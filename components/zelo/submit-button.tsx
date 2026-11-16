import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Botão de envio com estado de carregamento (feedback imediato, DESIGN.md 8). */
export function SubmitButton({
  pending,
  children,
  pendingLabel,
  className,
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={cn("w-full", className)}
    >
      {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
