import type { Enums } from "@/lib/supabase/database.types";

/*
 * Aditivo e aceite de entrega REUTILIZAM o fluxo da proposta (decisão D4): mesmas tabelas, mesmo
 * envio, mesma página do cliente, mesmo OTP, mesmo PDF. O que muda é o TEXTO ("aceitar a proposta"
 * vs. "confirmar a entrega"). Fica tudo aqui, num só lugar, para não espalhar `if (tipo === ...)`
 * pelas telas e e-mails. Os textos de "proposta" são exatamente os que já existiam.
 */
export type TipoDocumento = Enums<"proposta_tipo">;
export type AcaoResposta = "aceito" | "recusado" | "ajuste";

export type TextosTipo = {
  /** "proposta", "aditivo", "entrega" (minúsculo, sem artigo). */
  nome: string;
  /** "Proposta", "Aditivo", "Entrega" (rótulos e selos). */
  rotulo: string;
  /** "a proposta", "o aditivo", "a entrega". */
  artigo: string;
  /** "esta proposta", "este aditivo", "esta entrega". */
  este: string;
  /** "da proposta", "do aditivo", "da entrega". */
  de: string;
  /** Frase que completa "Seu código para ___" (e-mail do código). */
  paraCodigo: Record<AcaoResposta, string>;
  /** Botão principal da barra fixa e título da folha. */
  principal: string;
  recusar: string;
  ajuste: string;
  /** Título da folha de cada ação. */
  folha: Record<AcaoResposta, string>;
  confirmar: Record<AcaoResposta, string>;
  registrado: Record<AcaoResposta, string>;
  /** "Proposta enviada via Zelo" no cabeçalho da página do cliente. */
  enviadaVia: string;
  /** Verbo no e-mail e nas frases do comprovante. */
  acaoPositiva: { cliente: string; prestador: string };
  assuntoCliente: string;
  assuntoPrestador: string;
  /** Texto de aceite no detalhe e na página do cliente: "Aceita por X". */
  aceitaPor: string;
  /** Concordância: "aceita", "aceito", "confirmada" e "atualizada", "atualizado", "atualizada". */
  aceitaAdj: string;
  atualizadaAdj: string;
  /** Título do estado vazio de listas, tela "criada" e título da página de edição. */
  criada: string;
  emEdicao: string;
  enviarBotao: string;
  confirmarEnvioTitulo: string;
  /** Título do comprovante em PDF. */
  tituloPdf: string;
};

export const TEXTOS: Record<TipoDocumento, TextosTipo> = {
  proposta: {
    nome: "proposta",
    rotulo: "Proposta",
    artigo: "a proposta",
    este: "esta proposta",
    de: "da proposta",
    paraCodigo: {
      aceito: "aceitar a proposta",
      recusado: "recusar a proposta",
      ajuste: "pedir ajuste na proposta",
    },
    principal: "Aceitar proposta",
    recusar: "Recusar proposta",
    ajuste: "Pedir ajuste",
    folha: {
      aceito: "Confirmar aceite",
      recusado: "Recusar proposta",
      ajuste: "Pedir ajuste",
    },
    confirmar: {
      aceito: "Confirmar aceite",
      recusado: "Confirmar recusa",
      ajuste: "Enviar pedido de ajuste",
    },
    registrado: {
      aceito: "Aceite registrado",
      recusado: "Recusa registrada",
      ajuste: "Pedido de ajuste registrado",
    },
    enviadaVia: "Proposta enviada via",
    acaoPositiva: { cliente: "Você aceitou a proposta", prestador: "aceitou a proposta" },
    assuntoCliente: "Comprovante do seu aceite",
    assuntoPrestador: "Proposta aceita",
    aceitaPor: "Aceita por",
    aceitaAdj: "aceita",
    atualizadaAdj: "atualizada",
    criada: "Proposta criada",
    emEdicao: "Proposta em edição",
    enviarBotao: "Enviar proposta",
    confirmarEnvioTitulo: "Enviar esta proposta?",
    tituloPdf: "Comprovante de aceite",
  },
  aditivo: {
    nome: "aditivo",
    rotulo: "Aditivo",
    artigo: "o aditivo",
    este: "este aditivo",
    de: "do aditivo",
    paraCodigo: {
      aceito: "aceitar o aditivo",
      recusado: "recusar o aditivo",
      ajuste: "pedir ajuste no aditivo",
    },
    principal: "Aceitar aditivo",
    recusar: "Recusar aditivo",
    ajuste: "Pedir ajuste",
    folha: {
      aceito: "Confirmar aceite do aditivo",
      recusado: "Recusar aditivo",
      ajuste: "Pedir ajuste",
    },
    confirmar: {
      aceito: "Confirmar aceite",
      recusado: "Confirmar recusa",
      ajuste: "Enviar pedido de ajuste",
    },
    registrado: {
      aceito: "Aceite do aditivo registrado",
      recusado: "Recusa registrada",
      ajuste: "Pedido de ajuste registrado",
    },
    enviadaVia: "Aditivo enviado via",
    acaoPositiva: { cliente: "Você aceitou o aditivo", prestador: "aceitou o aditivo" },
    assuntoCliente: "Comprovante do seu aceite do aditivo",
    assuntoPrestador: "Aditivo aceito",
    aceitaPor: "Aceito por",
    aceitaAdj: "aceito",
    atualizadaAdj: "atualizado",
    criada: "Aditivo criado",
    emEdicao: "Aditivo em edição",
    enviarBotao: "Enviar aditivo",
    confirmarEnvioTitulo: "Enviar este aditivo?",
    tituloPdf: "Comprovante de aceite de aditivo",
  },
  entrega: {
    nome: "entrega",
    rotulo: "Entrega",
    artigo: "a entrega",
    este: "esta entrega",
    de: "da entrega",
    paraCodigo: {
      aceito: "confirmar o recebimento da entrega",
      recusado: "recusar a entrega",
      ajuste: "pedir correção na entrega",
    },
    principal: "Confirmar recebimento",
    recusar: "Recusar entrega",
    ajuste: "Pedir correção",
    folha: {
      aceito: "Confirmar recebimento",
      recusado: "Recusar entrega",
      ajuste: "Pedir correção",
    },
    confirmar: {
      aceito: "Confirmar recebimento",
      recusado: "Confirmar recusa",
      ajuste: "Enviar pedido de correção",
    },
    registrado: {
      aceito: "Recebimento confirmado",
      recusado: "Recusa registrada",
      ajuste: "Pedido de correção registrado",
    },
    enviadaVia: "Entrega registrada via",
    acaoPositiva: {
      cliente: "Você confirmou o recebimento da entrega",
      prestador: "confirmou o recebimento da entrega",
    },
    assuntoCliente: "Comprovante da confirmação de entrega",
    assuntoPrestador: "Entrega confirmada",
    aceitaPor: "Confirmada por",
    aceitaAdj: "confirmada",
    atualizadaAdj: "atualizada",
    criada: "Entrega criada",
    emEdicao: "Entrega em edição",
    enviarBotao: "Enviar entrega",
    confirmarEnvioTitulo: "Enviar esta entrega?",
    tituloPdf: "Comprovante de confirmação de entrega",
  },
};

export const textosDe = (tipo: TipoDocumento | null | undefined): TextosTipo =>
  TEXTOS[tipo ?? "proposta"];
