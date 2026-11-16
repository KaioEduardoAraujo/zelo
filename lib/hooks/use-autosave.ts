"use client";

import { useEffect, useState } from "react";

import { AutosaveController, type AutosaveState, type SaveResult } from "@/lib/autosave";

/** Liga o AutosaveController ao React. `save` costuma ser uma Server Action. */
export function useAutosave<T>(save: (value: T) => Promise<SaveResult>, delayMs = 1500) {
  const [state, setState] = useState<AutosaveState>({ status: "idle", savedAt: null });
  const [controller] = useState(
    () => new AutosaveController<T>({ save, onChange: setState, delayMs }),
  );

  // O controlador é criado uma vez, mas sempre chama a versão mais recente de `save`.
  useEffect(() => {
    controller.setSave(save);
  }, [controller, save]);

  // Ao desmontar (navegar para outra tela), dispara o que estiver pendente.
  useEffect(() => () => controller.dispose(), [controller]);

  return { state, schedule: controller.schedule, flush: controller.flush, controller };
}
