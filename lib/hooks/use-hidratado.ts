"use client";

import { useSyncExternalStore } from "react";

const nadaParaOuvir = () => () => {};

/**
 * true só depois que o React assumiu a página no navegador (hidratação).
 * Antes disso, um toque num botão que depende de JavaScript se perde (ou dispara o envio nativo
 * do formulário): em celular com rede ruim isso acontece de verdade. Os botões principais ficam
 * desabilitados até lá. Usa useSyncExternalStore: no servidor vale false, no navegador true.
 */
export function useHidratado(): boolean {
  return useSyncExternalStore(
    nadaParaOuvir,
    () => true,
    () => false,
  );
}
