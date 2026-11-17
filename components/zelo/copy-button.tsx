"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CopyButton({
  text,
  label,
  mensagem = "Copiado.",
}: {
  text: string;
  label: string;
  mensagem?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success(mensagem);
        } catch {
          toast.error("Não conseguimos copiar.", {
            description: "Selecione o texto e copie manualmente.",
          });
        }
      }}
    >
      <Copy aria-hidden="true" />
      {label}
    </Button>
  );
}
