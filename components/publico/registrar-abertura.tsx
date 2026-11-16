"use client";

import { useEffect } from "react";

import { registrarAbertura } from "@/lib/publico/actions";

/**
 * Registra "o cliente abriu a proposta" DEPOIS que a página carrega no navegador.
 * Não é feito na renderização do servidor de propósito: o WhatsApp (e outros apps) acessam o
 * link para montar a prévia, sem rodar JavaScript. Se a abertura fosse registrada no servidor,
 * a proposta apareceria como "visualizada" assim que o prestador colasse o link na conversa.
 */
export function RegistrarAbertura({ token }: { token: string }) {
  useEffect(() => {
    void registrarAbertura(token).catch(() => {});
  }, [token]);
  return null;
}
