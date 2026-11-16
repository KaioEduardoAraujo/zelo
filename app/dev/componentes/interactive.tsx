"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialog } from "@/components/zelo/confirm-dialog";
import { FormField } from "@/components/zelo/form-field";
import { CpfInput, MoneyInput, PhoneInput } from "@/components/zelo/masked-inputs";
import { formatCentavos } from "@/lib/format";

export function MaskedFields() {
  const [valor, setValor] = useState(840_000);
  return (
    <>
      <FormField id="demo-cpf" label="CPF">
        {(a) => <CpfInput {...a} name="cpf" defaultValue="12345678909" />}
      </FormField>
      <FormField id="demo-tel" label="WhatsApp do cliente" optional>
        {(a) => <PhoneInput {...a} name="telefone" />}
      </FormField>
      <FormField
        id="demo-valor"
        label="Valor unitário"
        hint={`Enviado ao servidor como ${valor} centavos (${formatCentavos(valor)}).`}
      >
        {(a) => <MoneyInput {...a} name="valor" defaultCentavos={valor} onValueChange={setValor} />}
      </FormField>
    </>
  );
}

export function Overlays() {
  return (
    <div className="flex flex-wrap gap-3">
      <ConfirmDialog
        trigger={<Button variant="destructive">Excluir rascunho</Button>}
        title="Excluir este rascunho?"
        description="O rascunho “Reforma do banheiro” será apagado. Propostas já enviadas não podem ser excluídas."
        confirmLabel="Excluir rascunho"
        onConfirm={() => {
          toast.success("Rascunho excluído.");
        }}
      />
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary">Ver como o cliente verá</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Confirmar aceite</SheetTitle>
            <SheetDescription>Reforma do banheiro · {formatCentavos(840_000)}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <p className="text-slate-600">
              Li a proposta e aceito os termos acima. Entendo que este aceite fica registrado com
              data, hora e dispositivo.
            </p>
          </SheetBody>
          <SheetFooter>
            <Button>Confirmar aceite</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Button
        variant="ghost"
        onClick={() =>
          toast.success("Link copiado.", { description: "Cole na conversa com o cliente." })
        }
      >
        Mostrar toast
      </Button>
      <Toaster />
    </div>
  );
}
