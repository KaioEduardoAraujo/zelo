import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AutosaveController, type AutosaveState, type SaveResult } from "@/lib/autosave";

/** Salvamento controlável: cada chamada fica pendente até a resolvermos. */
function fakeServer() {
  const calls: { value: string; resolve: (r: SaveResult) => void }[] = [];
  const save = vi.fn(
    (value: string) => new Promise<SaveResult>((resolve) => calls.push({ value, resolve })),
  );
  return { save, calls };
}

function setup(delayMs = 1500) {
  const server = fakeServer();
  const states: AutosaveState[] = [];
  const controller = new AutosaveController<string>({
    save: server.save,
    onChange: (s) => states.push(s),
    delayMs,
    now: () => new Date("2026-11-16T12:00:00Z"),
  });
  return { ...server, controller, states, last: () => states.at(-1)! };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("AutosaveController", () => {
  it("junta uma rajada de edições em um único salvamento, com o último valor", async () => {
    const t = setup();
    t.controller.schedule("a");
    await vi.advanceTimersByTimeAsync(1000);
    t.controller.schedule("ab");
    await vi.advanceTimersByTimeAsync(1000);
    t.controller.schedule("abc");
    expect(t.save).not.toHaveBeenCalled(); // o relógio reinicia a cada edição
    expect(t.last().status).toBe("dirty");

    await vi.advanceTimersByTimeAsync(1500);
    expect(t.save).toHaveBeenCalledTimes(1);
    expect(t.save).toHaveBeenCalledWith("abc");
    expect(t.last().status).toBe("saving");

    t.calls[0].resolve({ ok: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(t.last()).toMatchObject({ status: "saved" });
    expect(t.last().savedAt).toBeInstanceOf(Date);
  });

  it("edição feita durante o salvamento não se perde nem salva em paralelo", async () => {
    const t = setup();
    t.controller.schedule("v1");
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.save).toHaveBeenCalledTimes(1);

    t.controller.schedule("v2"); // chega com o primeiro salvamento ainda em andamento
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.save).toHaveBeenCalledTimes(1); // não dispara um segundo ao mesmo tempo

    t.calls[0].resolve({ ok: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(t.save).toHaveBeenCalledTimes(2);
    expect(t.save).toHaveBeenLastCalledWith("v2");

    t.calls[1].resolve({ ok: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(t.last().status).toBe("saved");
    expect(t.controller.hasUnsavedChanges).toBe(false);
  });

  it("falha mantém o valor pendente e permite tentar de novo", async () => {
    const t = setup();
    t.controller.schedule("rascunho");
    await vi.advanceTimersByTimeAsync(1500);
    t.calls[0].resolve({ ok: false, message: "Sem conexão" });
    await vi.advanceTimersByTimeAsync(0);

    expect(t.last()).toMatchObject({ status: "error", message: "Sem conexão" });
    expect(t.controller.hasUnsavedChanges).toBe(true);

    const flushed = t.controller.flush(); // "Tentar de novo"
    await vi.advanceTimersByTimeAsync(0);
    expect(t.save).toHaveBeenCalledTimes(2);
    expect(t.save).toHaveBeenLastCalledWith("rascunho");
    t.calls[1].resolve({ ok: true });
    await expect(flushed).resolves.toBe(true);
    expect(t.last().status).toBe("saved");
  });

  it("exceção de rede é tratada como falha, sem perder o valor", async () => {
    const states: AutosaveState[] = [];
    const save = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValue({ ok: true });
    const c = new AutosaveController<string>({ save, onChange: (s) => states.push(s) });
    c.schedule("x");
    await vi.advanceTimersByTimeAsync(1500);
    expect(states.at(-1)?.status).toBe("error");
    await expect(c.flush()).resolves.toBe(true);
    expect(save).toHaveBeenLastCalledWith("x");
  });

  it("flush salva na hora e espera um salvamento em andamento terminar", async () => {
    const t = setup();
    t.controller.schedule("final");
    const flushed = t.controller.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.save).toHaveBeenCalledWith("final"); // sem esperar os 1500 ms
    t.calls[0].resolve({ ok: true });
    await expect(flushed).resolves.toBe(true);
  });

  it("flush sem nada pendente resolve na hora", async () => {
    const t = setup();
    await expect(t.controller.flush()).resolves.toBe(true);
    expect(t.save).not.toHaveBeenCalled();
  });

  it("dispose dispara o que estava pendente (ao sair da tela)", async () => {
    const t = setup();
    t.controller.schedule("a sair");
    t.controller.dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.save).toHaveBeenCalledWith("a sair");
  });
});
