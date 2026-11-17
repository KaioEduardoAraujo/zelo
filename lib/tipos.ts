import type { Enums } from "@/lib/supabase/database.types";

// Textos que mudam entre proposta, aditivo e entrega.
export type TipoDocumento = Enums<"proposta_tipo">;
export type AcaoResposta = "aceito" | "recusado" | "ajuste";

export type TextosTipo = {
  nome: string;
  rotulo: string;
  artigo: string;
  este: string;
  de: string;
  paraCodigo: Record<AcaoResposta, string>;
  principal: string;
  recusar: string;
  ajuste: string;
  folha: Record<AcaoResposta, string>;
  confirmar: Record<AcaoResposta, string>;
  registrado: Record<AcaoResposta, string>;
  enviadaVia: string;
  acaoPositiva: { cliente: string; prestador: string };
  assuntoCliente: string;
  assuntoPrestador: string;
  aceitaPor: string;
  aceitaAdj: string;
  atualizadaAdj: string;
  criada: string;
  emEdicao: string;
  enviarBotao: string;
  confirmarEnvioTitulo: string;
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
