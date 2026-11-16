"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/*
 * Mostra o erro de um campo só no momento certo (DESIGN.md 8): depois que a pessoa SAIU do campo,
 * ou depois que tentou avançar (`mostrarTodos`). Assim ninguém vê "campo obrigatório" enquanto
 * ainda está digitando pela primeira vez.
 */
type Ctx = {
  erro: (campo: string) => string | undefined;
  tocar: (campo: string) => void;
};

const ErrosContext = createContext<Ctx>({ erro: () => undefined, tocar: () => {} });

export const useErros = () => useContext(ErrosContext);

export function ErrosProvider({
  erros,
  mostrarTodos,
  children,
}: {
  erros: Record<string, string>;
  mostrarTodos: boolean;
  children: React.ReactNode;
}) {
  const [tocados, setTocados] = useState<ReadonlySet<string>>(new Set());

  const tocar = useCallback((campo: string) => {
    setTocados((atual) => (atual.has(campo) ? atual : new Set(atual).add(campo)));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      erro: (campo) => (mostrarTodos || tocados.has(campo) ? erros[campo] : undefined),
      tocar,
    }),
    [erros, mostrarTodos, tocados, tocar],
  );

  return <ErrosContext value={value}>{children}</ErrosContext>;
}
