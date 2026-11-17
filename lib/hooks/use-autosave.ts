"use client";

import { useEffect, useState } from "react";

import { AutosaveController, type AutosaveState, type SaveResult } from "@/lib/autosave";

export function useAutosave<T>(save: (value: T) => Promise<SaveResult>, delayMs = 1500) {
  const [state, setState] = useState<AutosaveState>({ status: "idle", savedAt: null });
  const [controller] = useState(
    () => new AutosaveController<T>({ save, onChange: setState, delayMs }),
  );

  useEffect(() => {
    controller.setSave(save);
  }, [controller, save]);

  useEffect(() => () => controller.dispose(), [controller]);

  return { state, schedule: controller.schedule, flush: controller.flush, controller };
}
