"use client";

import { FileCheck2, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/zelo/form-field";
import { FormMessage } from "@/components/zelo/form-message";
import { formatDateTime } from "@/lib/format";
import { useHidratado } from "@/lib/hooks/use-hidratado";
import { textosDe } from "@/lib/tipos";
import { verificarComprovante, type VerificacaoResultado } from "@/lib/verificar/actions";

const RESULTADO = {
  aceito: "Aceite",
  recusado: "Recusa",
  ajuste: "Pedido de ajuste",
} as const;

const LIMITE_ARQUIVO = 5 * 1024 * 1024;

// SHA-256 calculado no navegador: o PDF não é enviado.
async function sha256DoArquivo(arquivo: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await arquivo.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function FormVerificacao({ codigoInicial }: { codigoInicial: string }) {
  const hidratado = useHidratado();
  const [codigo, setCodigo] = useState(codigoInicial);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string>();
  const [resposta, setResposta] = useState<VerificacaoResultado | null>(null);
  const [pendente, iniciar] = useTransition();
  const inputArquivo = useRef<HTMLInputElement>(null);

  function escolherArquivo(f: File | null) {
    setErroArquivo(undefined);
    if (f && f.size > LIMITE_ARQUIVO) {
      setErroArquivo("O comprovante do Zelo tem bem menos de 5 MB. Confira o arquivo.");
      f = null;
      if (inputArquivo.current) inputArquivo.current.value = "";
    }
    setArquivo(f);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    iniciar(async () => {
      try {
        const arquivoSha256 = arquivo ? await sha256DoArquivo(arquivo) : null;
        setResposta(await verificarComprovante({ codigo, arquivoSha256 }));
      } catch {
        setResposta({
          estado: "erro",
          message: "Não conseguimos falar com o servidor. Confira sua conexão e tente de novo.",
        });
      }
    });
  }

  const erroCodigo = resposta?.estado === "erro" ? resposta.erros?.codigo : undefined;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <FormField
          id="codigo"
          label="Código do comprovante"
          hint="Está no topo do PDF e no e-mail. Ex.: ZL-4K7Q-92MD"
          error={erroCodigo}
        >
          {(a11y) => (
            <Input
              {...a11y}
              name="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              className="font-mono uppercase"
            />
          )}
        </FormField>

        <FormField
          id="arquivo"
          label="Arquivo do comprovante (PDF)"
          optional
          hint="Para conferir se o arquivo que você tem é o original. Ele não sai do seu aparelho: só a impressão digital (hash) é comparada."
          error={erroArquivo}
        >
          {(a11y) => (
            <Input
              {...a11y}
              ref={inputArquivo}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
              className="h-auto py-2.5"
            />
          )}
        </FormField>

        <Button type="submit" disabled={!hidratado || pendente} className="sm:self-start">
          {pendente ? "Conferindo…" : "Verificar"}
        </Button>
      </form>

      <div aria-live="polite">{resposta && !pendente && <Resultado r={resposta} />}</div>
    </div>
  );
}

function Resultado({ r }: { r: VerificacaoResultado }) {
  if (r.estado === "erro") {
    return r.erros?.codigo ? null : <FormMessage tone="error">{r.message}</FormMessage>;
  }
  if (r.estado === "nao_encontrado") {
    return (
      <section className="flex gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <ShieldQuestion className="size-6 shrink-0 text-slate-600" aria-hidden="true" />
        <div>
          <h2 className="text-h3 text-navy-950">Não encontrado</h2>
          <p className="mt-1 text-slate-600">
            Nenhum comprovante do Zelo tem este código. Confira se digitou igual ao do PDF.
          </p>
        </div>
      </section>
    );
  }

  const integro = r.estado === "integro";
  return (
    <section
      className={
        integro
          ? "rounded-[var(--radius-card)] border border-teal-600/25 bg-teal-50 p-5"
          : "rounded-[var(--radius-card)] border border-danger/30 bg-danger-bg p-5"
      }
    >
      <div className="flex gap-3">
        {integro ? (
          <ShieldCheck className="size-6 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <ShieldAlert className="size-6 shrink-0 text-danger" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <h2 className={integro ? "text-h3 text-success" : "text-h3 text-danger"}>
            {integro ? "Documento íntegro" : "Documento com divergência"}
          </h2>
          <p className="mt-1 text-navy-900">
            {integro
              ? "O conteúdo guardado pelo Zelo é exatamente o que foi enviado e respondido: o hash recalculado agora é igual ao registrado."
              : "O hash recalculado agora não bate com o registrado. Entre em contato com o prestador."}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Dado rotulo="Documento">{textosDe(r.tipo).rotulo}</Dado>
        <Dado rotulo="Registro">{RESULTADO[r.resultado]}</Dado>
        <Dado rotulo="Data e hora (Brasília)">{formatDateTime(r.registradoEm)}</Dado>
        <Dado rotulo="Prestador">{r.prestador}</Dado>
        <Dado rotulo="Versão do documento">{r.versao}</Dado>
        <div className="sm:col-span-2">
          <dt className="text-label text-slate-600">Hash SHA-256</dt>
          <dd className="mt-0.5 font-mono text-xs leading-5 break-all text-navy-800">{r.hash}</dd>
        </div>
      </dl>

      {r.arquivo !== "nao_enviado" && <Arquivo estado={r.arquivo} />}
    </section>
  );
}

function Arquivo({ estado }: { estado: "confere" | "diferente" | "sem_original" }) {
  if (estado === "confere") {
    return (
      <p className="mt-4 flex items-start gap-2 text-success">
        <FileCheck2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />O arquivo enviado é
        idêntico ao comprovante original emitido pelo Zelo.
      </p>
    );
  }
  return (
    <p role="alert" className="mt-4 flex items-start gap-2 text-danger">
      <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      {estado === "diferente"
        ? "O arquivo enviado NÃO é igual ao comprovante original: ele pode ter sido editado. Vale o que está registrado acima."
        : "Ainda não há um PDF guardado para este registro, então o arquivo não pôde ser comparado."}
    </p>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-label text-slate-600">{rotulo}</dt>
      <dd className="mt-0.5 text-navy-900">{children}</dd>
    </div>
  );
}
