"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormMessage } from "@/components/zelo/form-message";
import { LinkEnvio } from "@/components/zelo/proposal/link-envio";
import { gerarNovoLink } from "@/lib/proposals/actions";
import type { ResumoEnvio } from "@/lib/proposals/envio";

/**
 * "Gerar novo link": o banco guarda só o hash do token, então o link já enviado não pode ser
 * mostrado de novo. Gerar outro invalida o anterior na hora, por isso pede confirmação.
 * Ao fechar o diálogo o link some da memória do navegador.
 */
export function GerarNovoLink({ propostaId }: { propostaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [resumo, setResumo] = useState<ResumoEnvio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const mudarAberto = (valor: boolean) => {
    setAberto(valor);
    if (!valor) {
      setResumo(null);
      setErro(null);
    }
  };

  const gerar = () =>
    iniciar(async () => {
      setErro(null);
      const r = await gerarNovoLink(propostaId);
      if (r.ok) setResumo(r.resumo);
      else setErro(r.message);
    });

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogTrigger asChild>
        <Button variant="secondary">Gerar novo link</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {resumo ? (
          <>
            <DialogHeader>
              <DialogTitle>Novo link gerado</DialogTitle>
              <DialogDescription>O link anterior já não funciona mais.</DialogDescription>
            </DialogHeader>
            <LinkEnvio resumo={resumo} />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Gerar um novo link?</DialogTitle>
              <DialogDescription>
                O link atual deixa de funcionar na hora: quem o recebeu não consegue mais abrir a
                proposta. O conteúdo e a validade continuam os mesmos.
              </DialogDescription>
            </DialogHeader>
            {erro && <FormMessage tone="error">{erro}</FormMessage>}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button onClick={gerar} disabled={pendente}>
                {pendente ? "Gerando…" : "Gerar novo link"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
