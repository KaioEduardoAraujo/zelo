"use client";

import { ArrowLeft, CircleCheck, Eye, ImagePlus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { EntregaDocument } from "@/components/zelo/proposal/entrega-document";
import { FormField } from "@/components/zelo/form-field";
import { FormMessage } from "@/components/zelo/form-message";
import { LinkEnvio } from "@/components/zelo/proposal/link-envio";
import { SaveIndicator } from "@/components/zelo/proposal/save-indicator";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { useHidratado } from "@/lib/hooks/use-hidratado";
import { ImagemInvalidaError, comprimirImagem } from "@/lib/imagem";
import { enviarProposta } from "@/lib/proposals/actions";
import { salvarEntrega, type SalvarEntregaEntrada } from "@/lib/proposals/derivados";
import type { ResumoEnvio } from "@/lib/proposals/envio";
import { createClient } from "@/lib/supabase/client";
import { textosDe } from "@/lib/tipos";
import {
  CHECKLIST_MAX,
  FOTOS_MAX,
  validarEntrega,
  type ConteudoEntrega,
} from "@/lib/validation/entrega";

type Props = {
  propostaId: string;
  prestadorId: string;
  inicial: ConteudoEntrega;
  /** URLs assinadas das fotos que já estão no rascunho. */
  fotoUrlsIniciais: Record<string, string>;
  titulo: string;
  clienteNome: string;
  referenciaTitulo: string;
  prestador: { nome: string; empresa: string | null };
};

const T = textosDe("entrega");

/**
 * Editor do aceite de entrega: o que foi entregue, checklist e fotos, numa tela só (o conteúdo é
 * curto), com autosave igual ao da proposta e a mesma confirmação de envio.
 *
 * As fotos sobem direto do navegador para o bucket privado `entregas` (a pasta é do prestador:
 * o RLS recusa qualquer outro caminho) depois de comprimidas. O que fica no rascunho é só o
 * caminho; o servidor confere o arquivo e calcula o hash no envio.
 */
export function EntregaEditor(props: Props) {
  const { propostaId, prestadorId } = props;
  const router = useRouter();
  const hidratado = useHidratado();
  const [conteudo, setConteudo] = useState(props.inicial);
  const conteudoRef = useRef(props.inicial);
  const [urls, setUrls] = useState(props.fotoUrlsIniciais);
  const [enviandoFotos, setEnviandoFotos] = useState(0);
  const [errosFoto, setErrosFoto] = useState<string[]>([]);
  const [tentou, setTentou] = useState(false);
  const [errosServidor, setErrosServidor] = useState<Record<string, string>>({});
  const [previewAberto, setPreviewAberto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<ResumoEnvio | null>(null);
  const inputFotos = useRef<HTMLInputElement>(null);

  const { state, schedule, flush } = useAutosave<SalvarEntregaEntrada>(salvarEntrega);

  const mudar = useCallback(
    (fn: (c: ConteudoEntrega) => ConteudoEntrega) => {
      const proximo = fn(conteudoRef.current);
      conteudoRef.current = proximo;
      setConteudo(proximo);
      setErrosServidor({});
      schedule({ id: propostaId, conteudo: proximo });
    },
    [propostaId, schedule],
  );

  const erros = useMemo(() => validarEntrega(conteudo), [conteudo]);
  const erro = (campo: string) =>
    tentou ? (erros[campo] ?? errosServidor[campo]) : errosServidor[campo];

  /* ------------------------------ Fotos ------------------------------ */

  async function adicionarFotos(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []);
    if (inputFotos.current) inputFotos.current.value = ""; // permite escolher o mesmo arquivo de novo
    if (arquivos.length === 0) return;

    const vagas = FOTOS_MAX - conteudoRef.current.fotos.length - enviandoFotos;
    if (vagas <= 0) {
      toast.error(`Você já anexou ${FOTOS_MAX} fotos.`, {
        description: "Remova uma para anexar outra.",
      });
      return;
    }
    const aceitas = arquivos.slice(0, vagas);
    if (arquivos.length > vagas) {
      toast.error(`Só cabem mais ${vagas} ${vagas === 1 ? "foto" : "fotos"}.`, {
        description: "As primeiras foram anexadas.",
      });
    }

    setErrosFoto([]);
    setEnviandoFotos((n) => n + aceitas.length);
    const supabase = createClient();
    const falhas: string[] = [];

    for (const arquivo of aceitas) {
      try {
        const { blob, nome } = await comprimirImagem(arquivo);
        const path = `${prestadorId}/${propostaId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from("entregas")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error("upload");

        const local = URL.createObjectURL(blob);
        setUrls((u) => ({ ...u, [path]: local }));
        mudar((c) => ({ ...c, fotos: [...c.fotos, { path, nome }] }));
      } catch (e) {
        falhas.push(
          e instanceof ImagemInvalidaError
            ? `${arquivo.name}: ${e.message}`
            : `${arquivo.name}: não conseguimos enviar esta foto. Confira a conexão e tente de novo.`,
        );
      } finally {
        setEnviandoFotos((n) => n - 1);
      }
    }
    setErrosFoto(falhas);
  }

  /* ------------------------------ Envio ------------------------------ */

  const concluirSemEnviar = async () => {
    setSaindo(true);
    if (!(await flush())) {
      setSaindo(false);
      toast.error("Não conseguimos salvar agora.", {
        description: "Seus dados continuam aqui. Tente de novo.",
      });
      return;
    }
    router.push(`/propostas/${propostaId}`);
  };

  const pedirEnvio = () => {
    // Linhas de checklist em branco não bloqueiam: somem sozinhas antes de validar.
    mudar((c) => ({ ...c, checklist: c.checklist.filter((i) => i.texto.trim() !== "") }));
    setTentou(true);
    if (Object.keys(validarEntrega(conteudoRef.current)).length > 0) {
      setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 60);
      return;
    }
    setErroEnvio(null);
    setConfirmando(true);
  };

  const enviar = async () => {
    setEnviando(true);
    setErroEnvio(null);
    // O servidor relê o rascunho do banco: garante que o que está na tela já foi salvo.
    if (!(await flush())) {
      setEnviando(false);
      setErroEnvio(
        "Não conseguimos salvar o rascunho agora. Seus dados continuam aqui, tente de novo.",
      );
      return;
    }
    let r: Awaited<ReturnType<typeof enviarProposta>>;
    try {
      r = await enviarProposta(propostaId);
    } catch {
      setEnviando(false);
      setErroEnvio("Não conseguimos enviar agora. Seus dados continuam aqui, tente de novo.");
      return;
    }
    setEnviando(false);
    if (r.ok) {
      setConfirmando(false);
      setEnviado(r.resumo);
      window.scrollTo({ top: 0 });
      return;
    }
    if (r.erros) {
      setConfirmando(false);
      setErrosServidor(r.erros);
      setTentou(true);
      toast.error(r.message);
      return;
    }
    setErroEnvio(r.message);
  };

  const preview = (
    <EntregaDocument
      titulo={props.titulo}
      prestador={props.prestador}
      clienteNome={props.clienteNome}
      referenciaTitulo={props.referenciaTitulo}
      conteudo={conteudo}
      validade={{ dias: conteudo.validade_dias }}
      fotoUrls={urls}
    />
  );

  if (enviado) {
    return (
      <div className="flex max-w-[var(--container-doc)] flex-col gap-6">
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-1.5 size-7 shrink-0 text-teal-600" aria-hidden="true" />
          <h1 className="text-h1 text-navy-950">{T.criada}</h1>
        </div>
        <LinkEnvio resumo={enviado} />
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href={`/propostas/${propostaId}`}>Ver entrega</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/propostas">Voltar para propostas</Link>
          </Button>
        </div>
      </div>
    );
  }

  const cheio = conteudo.fotos.length + enviandoFotos >= FOTOS_MAX;

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Link
            href={`/propostas/${propostaId}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] text-support font-semibold text-navy-700 hover:text-navy-950"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Sair do editor
          </Link>
          <SaveIndicator state={state} onRetry={() => void flush()} />
        </div>

        <h1 className="sr-only">{T.emEdicao}</h1>
        <div>
          <h2 className="text-h2 text-navy-950">Registrar entrega</h2>
          <p className="mt-1 text-support text-slate-600">
            Para {props.clienteNome} · refere-se à proposta “{props.referenciaTitulo}”
          </p>
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_26rem]">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              pedirEnvio();
            }}
            className="flex max-w-2xl min-w-0 flex-col gap-8"
          >
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto xl:hidden"
              onClick={() => setPreviewAberto(true)}
            >
              <Eye aria-hidden="true" />
              Ver como o cliente verá
            </Button>

            <FormField
              id="resumo"
              label="O que foi entregue"
              hint="Conte o que foi feito, como se explicasse ao cliente."
              error={erro("resumo")}
            >
              {(a11y) => (
                <Textarea
                  {...a11y}
                  rows={5}
                  value={conteudo.resumo}
                  onChange={(e) => mudar((c) => ({ ...c, resumo: e.target.value }))}
                />
              )}
            </FormField>

            <section aria-labelledby="checklist-titulo" className="flex flex-col gap-3">
              <div>
                <h2 id="checklist-titulo" className="text-h3 text-navy-950">
                  Checklist
                </h2>
                <p className="text-support text-slate-600">
                  Marque o que foi entregue. Item que não foi entregue deve ser removido antes de
                  enviar.
                </p>
              </div>
              {erro("checklist") && (
                <p role="alert" className="text-support text-danger">
                  {erro("checklist")}
                </p>
              )}
              <ul className="flex flex-col gap-2.5">
                {conteudo.checklist.map((item, i) => {
                  const msg = erro(`checklist.${i}.texto`) ?? erro(`checklist.${i}.feito`);
                  return (
                    <li key={i} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`feito-${i}`}
                          checked={item.feito}
                          aria-label={`Item ${i + 1} entregue`}
                          aria-invalid={erro(`checklist.${i}.feito`) ? true : undefined}
                          onChange={(e) =>
                            mudar((c) => ({
                              ...c,
                              checklist: c.checklist.map((x, j) =>
                                j === i ? { ...x, feito: e.target.checked } : x,
                              ),
                            }))
                          }
                          className="size-6 shrink-0 accent-[var(--color-teal-600)]"
                        />
                        <Input
                          aria-label={`Descrição do item ${i + 1}`}
                          aria-invalid={erro(`checklist.${i}.texto`) ? true : undefined}
                          maxLength={200}
                          value={item.texto}
                          onChange={(e) =>
                            mudar((c) => ({
                              ...c,
                              checklist: c.checklist.map((x, j) =>
                                j === i ? { ...x, texto: e.target.value } : x,
                              ),
                            }))
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover item ${i + 1}`}
                          onClick={() =>
                            mudar((c) => ({
                              ...c,
                              checklist: c.checklist.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                      {msg && <p className="pl-8 text-support text-danger">{msg}</p>}
                    </li>
                  );
                })}
              </ul>
              <Button
                type="button"
                variant="secondary"
                className="self-start"
                disabled={conteudo.checklist.length >= CHECKLIST_MAX}
                onClick={() =>
                  mudar((c) => ({ ...c, checklist: [...c.checklist, { texto: "", feito: true }] }))
                }
              >
                <Plus aria-hidden="true" />
                Adicionar item
              </Button>
            </section>

            <section aria-labelledby="fotos-titulo" className="flex flex-col gap-3">
              <div>
                <h2 id="fotos-titulo" className="text-h3 text-navy-950">
                  Fotos{" "}
                  <span className="text-support font-normal text-slate-600">
                    ({conteudo.fotos.length} de {FOTOS_MAX})
                  </span>
                </h2>
                <p className="text-support text-slate-600">
                  Mostre o resultado. As fotos são reduzidas no seu aparelho antes de enviar e ficam
                  guardadas de forma privada.
                </p>
              </div>
              {erro("fotos") && (
                <p role="alert" className="text-support text-danger">
                  {erro("fotos")}
                </p>
              )}
              {conteudo.fotos.length > 0 && (
                <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {conteudo.fotos.map((foto, i) => (
                    <li key={foto.path} className="min-w-0">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-control)] border border-line bg-surface-2">
                        {urls[foto.path] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={urls[foto.path]}
                            alt={`Foto ${i + 1}: ${foto.nome}`}
                            className="size-full object-cover"
                          />
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="absolute top-1.5 right-1.5"
                          aria-label={`Remover foto ${i + 1}`}
                          onClick={() =>
                            mudar((c) => ({
                              ...c,
                              fotos: c.fotos.filter((f) => f.path !== foto.path),
                            }))
                          }
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                      <p className="mt-1 truncate text-label text-slate-600">{foto.nome}</p>
                      {erro(`fotos.${i}.path`) && (
                        <p className="text-support text-danger">{erro(`fotos.${i}.path`)}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <input
                ref={inputFotos}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-label="Selecionar fotos"
                onChange={(e) => void adicionarFotos(e.target.files)}
              />
              <Button
                type="button"
                variant="secondary"
                className="self-start"
                disabled={!hidratado || cheio}
                onClick={() => inputFotos.current?.click()}
              >
                <ImagePlus aria-hidden="true" />
                {enviandoFotos > 0 ? "Enviando fotos…" : "Adicionar fotos"}
              </Button>
              <div aria-live="polite">
                {errosFoto.map((m) => (
                  <p key={m} className="text-support text-danger">
                    {m}
                  </p>
                ))}
              </div>
            </section>

            <FormField id="observacoes" label="Observações" optional error={erro("observacoes")}>
              {(a11y) => (
                <Textarea
                  {...a11y}
                  rows={3}
                  value={conteudo.observacoes ?? ""}
                  onChange={(e) => mudar((c) => ({ ...c, observacoes: e.target.value }))}
                />
              )}
            </FormField>

            <FormField
              id="validade"
              label="Prazo para o cliente confirmar (dias)"
              hint="Depois desse prazo o link deixa de aceitar resposta."
              error={erro("validade_dias")}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  inputMode="numeric"
                  className="max-w-32"
                  value={String(conteudo.validade_dias)}
                  onChange={(e) =>
                    mudar((c) => ({
                      ...c,
                      validade_dias: Number(e.target.value.replace(/\D/g, "")) || 0,
                    }))
                  }
                />
              )}
            </FormField>

            <div className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row md:-mx-8 md:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-0">
              <Button
                type="submit"
                disabled={!hidratado || saindo || enviando || enviandoFotos > 0}
                className="sm:min-w-44"
              >
                {T.enviarBotao}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!hidratado || saindo || enviando || enviandoFotos > 0}
                onClick={() => void concluirSemEnviar()}
              >
                {saindo ? "Salvando…" : "Salvar rascunho e sair"}
              </Button>
            </div>
          </form>

          <aside aria-label="Pré-visualização do documento" className="hidden xl:block">
            <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-[var(--radius-card)]">
              <p className="mb-2 text-support font-semibold text-slate-600">Como o cliente verá</p>
              {preview}
            </div>
          </aside>
        </div>
      </div>

      <Sheet open={previewAberto} onOpenChange={setPreviewAberto}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Como o cliente verá</SheetTitle>
            <SheetDescription>
              É assim que o registro aparece para quem recebe o link.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>{preview}</SheetBody>
        </SheetContent>
      </Sheet>

      <Dialog
        open={confirmando}
        onOpenChange={(aberto) => {
          if (!enviando) setConfirmando(aberto);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{T.confirmarEnvioTitulo}</DialogTitle>
            <DialogDescription>
              Depois de enviada, esta versão não pode mais ser editada, e as fotos passam a fazer
              parte do documento (qualquer mudança nelas alteraria o hash). Para corrigir algo, você
              cria uma nova versão.
            </DialogDescription>
          </DialogHeader>
          {erroEnvio && <FormMessage tone="error">{erroEnvio}</FormMessage>}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" disabled={enviando}>
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={() => void enviar()} disabled={enviando}>
              {enviando ? "Enviando…" : T.enviarBotao}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
