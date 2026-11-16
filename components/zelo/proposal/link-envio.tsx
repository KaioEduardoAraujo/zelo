"use client";

import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/zelo/copy-button";
import { FormMessage } from "@/components/zelo/form-message";
import { formatDateTime } from "@/lib/format";
import {
  mensagemWhatsApp,
  primeiroNome,
  urlWhatsApp,
  type ResumoEnvio,
} from "@/lib/proposals/envio";

/**
 * Corpo da tela "Proposta criada" (DESIGN.md 7.2.5): a ação principal é "Enviar por WhatsApp",
 * a secundária é "Copiar link", e a mensagem que vai ser enviada fica à vista.
 *
 * O título fica por conta de quem usa (h1 na página, título do diálogo no novo link).
 * O link com o token só existe neste estado do navegador: nada vai para a URL nem para o histórico.
 */
export function LinkEnvio({ resumo }: { resumo: ResumoEnvio }) {
  const mensagem = mensagemWhatsApp(resumo);
  const whatsapp = urlWhatsApp(resumo.clienteTelefone, mensagem);

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(resumo.link);
      toast.success("Link copiado.", { description: "Cole na conversa com o cliente." });
    } catch {
      toast.error("Não conseguimos copiar.", {
        description: "Selecione o link na mensagem e copie manualmente.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-slate-600">
        Falta só mandar o link. {primeiroNome(resumo.clienteNome)} abre no celular, lê e responde,
        sem criar conta.
      </p>

      <section aria-labelledby="mensagem-envio">
        <h3 id="mensagem-envio" className="mb-1.5 text-support font-semibold text-navy-900">
          Mensagem que será enviada
        </h3>
        <p className="rounded-[var(--radius-control)] border border-line bg-surface-2 px-3.5 py-3 text-support leading-6 [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-navy-900">
          {mensagem}
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild className="sm:flex-1">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" />
            Enviar por WhatsApp
          </a>
        </Button>
        <Button type="button" variant="secondary" onClick={copiarLink} className="sm:flex-1">
          <Copy aria-hidden="true" />
          Copiar link
        </Button>
      </div>

      {!resumo.clienteTelefone && (
        <p className="-mt-2 text-support text-slate-600">
          Você não informou o WhatsApp do cliente: o WhatsApp abre para você escolher o contato.
        </p>
      )}

      <FormMessage tone="info">
        Este link só aparece agora. Se perdê-lo, gere outro na página da proposta: o anterior deixa
        de funcionar.
      </FormMessage>

      <dl className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
        <div className="px-4 py-3">
          <dt className="text-label text-slate-600">Vale até</dt>
          <dd className="text-support text-navy-900">{formatDateTime(resumo.validadeEm)}</dd>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-label text-slate-600">Hash SHA-256 da versão {resumo.versao}</dt>
            <dd>
              <CopyButton text={resumo.hash} label="Copiar" mensagem="Hash copiado." />
            </dd>
          </div>
          <dd className="mt-1 font-mono text-xs leading-5 break-all text-navy-800">
            {resumo.hash}
          </dd>
        </div>
      </dl>
    </div>
  );
}
