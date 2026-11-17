"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { AcceptanceStamp } from "@/components/zelo/acceptance-stamp";
import { FormField } from "@/components/zelo/form-field";
import { FormMessage } from "@/components/zelo/form-message";
import { CpfInput } from "@/components/zelo/masked-inputs";
import { formatCentavos, formatDateTime } from "@/lib/format";
import { useHidratado } from "@/lib/hooks/use-hidratado";
import { enviarCodigo, responderProposta, type ResponderResultado } from "@/lib/publico/actions";
import type { AcaoCliente } from "@/lib/publico/otp";
import { respostaSchema } from "@/lib/publico/schemas";
import { textosDe, type TipoDocumento } from "@/lib/tipos";
import { flattenIssues } from "@/lib/validation/errors";

type Props = {
  token: string;
  titulo: string;
  tipo: TipoDocumento;
  /** null na entrega (não tem valor). */
  valorCentavos: number | null;
  prestadorNome: string;
  clienteNome: string;
  emailMascarado: string;
  /** Textos exatos que serão gravados, montados no servidor. */
  consentimentos: Record<AcaoCliente, string>;
  /** WhatsApp (ou e-mail) do prestador para "Tenho dúvidas". */
  duvidasHref: string | null;
};

type Etapa = "dados" | "codigo" | "concluido";
type Sucesso = Extract<ResponderResultado, { ok: true }>;

const SEGUNDOS_REENVIO = 60;
const SEM_CONEXAO = "Não conseguimos falar com o servidor. Confira sua conexão e tente de novo.";

/**
 * Resposta do cliente (DESIGN.md 7.2.7): barra fixa no rodapé com "Aceitar proposta" e
 * "Tenho dúvidas"; bottom sheet com nome, CPF (só no aceite), consentimento e o código por e-mail.
 * Recusar e pedir ajuste usam o mesmo fluxo. Nada aqui é confiado: o servidor valida tudo de novo.
 */
export function RespostaCliente(props: Props) {
  const T = textosDe(props.tipo);
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [acao, setAcao] = useState<AcaoCliente>("aceito");
  const [etapa, setEtapa] = useState<Etapa>("dados");
  const [form, setForm] = useState({
    nome: props.clienteNome,
    cpf: "",
    comentario: "",
    consentimento: false,
  });
  const [tentou, setTentou] = useState(false);
  const [errosServidor, setErrosServidor] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState<{ tom: "error" | "info"; texto: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [reenviarEm, setReenviarEm] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());
  const [sucesso, setSucesso] = useState<Sucesso | null>(null);
  const [pendente, iniciar] = useTransition();
  const hidratado = useHidratado();

  // Relógio só para o "Reenviar em 42 s".
  useEffect(() => {
    if (etapa !== "codigo") return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [etapa]);

  const entrada = () => ({ acao, ...form });
  const errosCliente = tentou ? errosDe(respostaSchema.safeParse(entrada())) : {};
  const erro = (campo: string) => errosCliente[campo] ?? errosServidor[campo];
  const segundosParaReenviar = Math.max(0, Math.ceil((reenviarEm - agora) / 1000));

  function abrir(nova: AcaoCliente) {
    if (nova !== acao) {
      // Trocar de ação recomeça o fluxo: o código é amarrado à ação escolhida.
      setAcao(nova);
      setEtapa("dados");
      setCodigo("");
      setMensagem(null);
      setTentou(false);
      setErrosServidor({});
      setForm((f) => ({ ...f, consentimento: false }));
    }
    setAberto(true);
  }

  function mudarAberto(valor: boolean) {
    setAberto(valor);
    // Depois de concluir, ao fechar a página passa a mostrar a proposta já respondida.
    if (!valor && etapa === "concluido") router.refresh();
  }

  function focarErro() {
    setTimeout(
      () => document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.focus(),
      60,
    );
  }

  function pedirCodigo() {
    setTentou(true);
    setErrosServidor({});
    if (!respostaSchema.safeParse(entrada()).success) {
      focarErro();
      return;
    }
    iniciar(async () => {
      setMensagem(null);
      try {
        const r = await enviarCodigo(props.token, entrada());
        if (r.ok) {
          setEtapa("codigo");
          setCodigo("");
          setReenviarEm(Date.now() + SEGUNDOS_REENVIO * 1000);
          setAgora(Date.now());
          setMensagem({
            tom: "info",
            texto: `Enviamos um código para ${r.emailMascarado}. Ele vale por 10 minutos.`,
          });
          setTimeout(() => document.getElementById("codigo")?.focus(), 60);
        } else {
          setErrosServidor(r.erros ?? {});
          setMensagem({ tom: "error", texto: r.message });
          if (r.indisponivel) router.refresh();
        }
      } catch {
        setMensagem({ tom: "error", texto: SEM_CONEXAO });
      }
    });
  }

  function confirmar() {
    if (!/^\d{6}$/.test(codigo)) {
      setMensagem({ tom: "error", texto: "O código tem 6 números." });
      document.getElementById("codigo")?.focus();
      return;
    }
    iniciar(async () => {
      try {
        const r = await responderProposta(props.token, entrada(), codigo);
        if (r.ok) {
          setSucesso(r);
          setEtapa("concluido");
          setMensagem(null);
          return;
        }
        setMensagem({ tom: "error", texto: r.message });
        if (r.novoCodigo) setCodigo("");
        if (r.indisponivel) router.refresh();
        if (r.erros && !r.erros.codigo) {
          setErrosServidor(r.erros);
          setEtapa("dados");
        }
      } catch {
        setMensagem({ tom: "error", texto: SEM_CONEXAO });
      }
    });
  }

  const descricao =
    props.valorCentavos === null
      ? props.titulo
      : `${props.titulo} · ${formatCentavos(props.valorCentavos)}`;

  return (
    <>
      <section
        aria-labelledby="outras-respostas"
        className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5"
      >
        <h2 id="outras-respostas" className="text-h3 text-navy-950">
          Não é bem isso?
        </h2>
        <p className="mt-1 text-support text-slate-600">
          Você pode {T.ajuste.toLowerCase()} ou recusar. {props.prestadorNome} fica sabendo da sua
          resposta.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!hidratado} onClick={() => abrir("ajuste")}>
            {T.ajuste}
          </Button>
          <Button variant="ghost" disabled={!hidratado} onClick={() => abrir("recusado")}>
            {T.recusar}
          </Button>
        </div>
      </section>

      {/* Barra fixa no rodapé: a ação principal sempre no mesmo lugar (DESIGN.md 8). */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[var(--container-doc)] gap-3">
          {props.duvidasHref && (
            <Button asChild variant="secondary" className="flex-1">
              <a href={props.duvidasHref} target="_blank" rel="noopener noreferrer">
                Tenho dúvidas
              </a>
            </Button>
          )}
          <Button className="flex-[1.4]" disabled={!hidratado} onClick={() => abrir("aceito")}>
            {T.principal}
          </Button>
        </div>
      </div>

      <Sheet open={aberto} onOpenChange={mudarAberto}>
        <SheetContent>
          {etapa === "concluido" && sucesso ? (
            <>
              <SheetHeader>
                <SheetTitle>{T.registrado[sucesso.resultado]}</SheetTitle>
                <SheetDescription>{descricao}</SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-4">
                {sucesso.resultado === "aceito" ? (
                  <>
                    <AcceptanceStamp
                      size="lg"
                      animate
                      acceptedAt={formatDateTime(sucesso.criadoEm)}
                      code={sucesso.codigoComprovante}
                      className="self-start"
                    />
                    <p className="text-body text-navy-900">
                      {T.registrado.aceito}. Guarde o comprovante: enviamos uma cópia em PDF para{" "}
                      {props.emailMascarado}.
                    </p>
                  </>
                ) : (
                  <FormMessage tone="success">
                    {sucesso.resultado === "recusado"
                      ? `A recusa foi registrada. ${props.prestadorNome} fica sabendo da sua resposta.`
                      : `O pedido de ajuste foi registrado. ${props.prestadorNome} pode enviar uma nova versão d${props.tipo === "proposta" ? "a proposta" : props.tipo === "aditivo" ? "o aditivo" : "a entrega"}.`}
                  </FormMessage>
                )}
                {sucesso.resultado !== "aceito" && (
                  <div>
                    <p className="text-label text-slate-600">Código do registro</p>
                    <p className="font-mono text-sm text-navy-900">{sucesso.codigoComprovante}</p>
                  </div>
                )}
                <div>
                  <p className="text-label text-slate-600">Hash SHA-256 do documento respondido</p>
                  <p className="font-mono text-xs leading-5 break-all text-navy-800">
                    {sucesso.hash}
                  </p>
                </div>
              </SheetBody>
              <SheetFooter>
                {sucesso.resultado === "aceito" ? (
                  <>
                    {/* Link comum (não <Link>): é uma rota de download, não uma página. */}
                    <Button asChild>
                      <a href={`/p/${props.token}/comprovante`}>
                        <Download aria-hidden="true" />
                        Baixar comprovante
                      </a>
                    </Button>
                    <Button variant="secondary" onClick={() => mudarAberto(false)}>
                      Voltar para {T.artigo}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => mudarAberto(false)}>Voltar para {T.artigo}</Button>
                )}
              </SheetFooter>
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>{etapa === "codigo" ? "Digite o código" : T.folha[acao]}</SheetTitle>
                <SheetDescription>{descricao}</SheetDescription>
              </SheetHeader>

              <SheetBody className="flex flex-col gap-5">
                {mensagem && <FormMessage tone={mensagem.tom}>{mensagem.texto}</FormMessage>}

                {etapa === "dados" ? (
                  <>
                    <FormField id="cliente-nome" label="Seu nome completo" error={erro("nome")}>
                      {(a11y) => (
                        <Input
                          {...a11y}
                          autoComplete="name"
                          value={form.nome}
                          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                        />
                      )}
                    </FormField>

                    {acao === "aceito" && (
                      <FormField
                        id="cliente-cpf"
                        label="CPF"
                        hint="Aparece só mascarado e serve apenas para identificar quem aceitou."
                        error={erro("cpf")}
                      >
                        {(a11y) => (
                          <CpfInput
                            {...a11y}
                            defaultValue={form.cpf}
                            onValueChange={(cpf) => setForm((f) => ({ ...f, cpf }))}
                          />
                        )}
                      </FormField>
                    )}

                    {acao !== "aceito" && (
                      <FormField
                        id="cliente-comentario"
                        label={
                          acao === "ajuste"
                            ? "O que você gostaria de mudar?"
                            : "Quer contar o motivo?"
                        }
                        optional={acao === "recusado"}
                        error={erro("comentario")}
                      >
                        {(a11y) => (
                          <Textarea
                            {...a11y}
                            rows={4}
                            maxLength={2000}
                            value={form.comentario}
                            onChange={(e) => setForm((f) => ({ ...f, comentario: e.target.value }))}
                          />
                        )}
                      </FormField>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-line bg-surface-2 p-3.5">
                        <input
                          id="consentimento"
                          type="checkbox"
                          checked={form.consentimento}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, consentimento: e.target.checked }))
                          }
                          aria-invalid={erro("consentimento") ? true : undefined}
                          aria-describedby={
                            erro("consentimento") ? "consentimento-erro" : undefined
                          }
                          className="mt-0.5 size-5 shrink-0 accent-[var(--color-teal-600)]"
                        />
                        <label htmlFor="consentimento" className="text-support text-navy-900">
                          {props.consentimentos[acao]}
                        </label>
                      </div>
                      {erro("consentimento") && (
                        <p id="consentimento-erro" className="text-support text-danger">
                          {erro("consentimento")}
                        </p>
                      )}
                    </div>

                    <p className="text-support text-slate-600">
                      Para confirmar que é você, vamos enviar um código de 6 números para{" "}
                      <span className="font-semibold text-navy-900">{props.emailMascarado}</span>.
                    </p>
                  </>
                ) : (
                  <>
                    <FormField
                      id="codigo"
                      label="Código de 6 números"
                      hint="Confira também a caixa de spam."
                    >
                      {(a11y) => (
                        <Input
                          {...a11y}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={codigo}
                          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className="max-w-56 text-center font-mono text-2xl tracking-[0.4em]"
                        />
                      )}
                    </FormField>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pendente || segundosParaReenviar > 0}
                        onClick={pedirCodigo}
                      >
                        {segundosParaReenviar > 0
                          ? `Reenviar em ${segundosParaReenviar} s`
                          : "Reenviar código"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEtapa("dados")}
                      >
                        Corrigir meus dados
                      </Button>
                    </div>
                  </>
                )}
              </SheetBody>

              <SheetFooter>
                {etapa === "dados" ? (
                  <Button onClick={pedirCodigo} disabled={pendente}>
                    {pendente ? "Enviando código…" : "Enviar código"}
                  </Button>
                ) : (
                  <Button onClick={confirmar} disabled={pendente}>
                    {pendente ? "Confirmando…" : T.confirmar[acao]}
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function errosDe(r: ReturnType<typeof respostaSchema.safeParse>): Record<string, string> {
  return r.success ? {} : flattenIssues(r.error);
}
