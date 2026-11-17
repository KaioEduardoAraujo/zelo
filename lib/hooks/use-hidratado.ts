"use client";

import { useSyncExternalStore } from "react";

const nadaParaOuvir = () => () => {};

// Botões que dependem de JS ficam desabilitados até a hidratação (no celular lento o toque se perdia).
export function useHidratado(): boolean {
  return useSyncExternalStore(
    nadaParaOuvir,
    () => true,
    () => false,
  );
}
