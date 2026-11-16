/*
 * Controlador de autosave (sem React, para poder ser testado com relógio falso).
 *
 * Garantias:
 *  - Debounce: uma rajada de edições vira UM salvamento, `delayMs` depois da última.
 *  - Nunca dois salvamentos ao mesmo tempo (o último a terminar não pode sobrescrever o mais novo).
 *  - Edição feita DURANTE um salvamento não se perde: ao terminar, salva de novo o valor mais novo.
 *  - Falha de rede não descarta nada: o valor continua pendente e a pessoa pode tentar de novo.
 */

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type AutosaveState = {
  status: AutosaveStatus;
  savedAt: Date | null;
  message?: string;
};

export type SaveResult = { ok: true } | { ok: false; message?: string };

type Options<T> = {
  save: (value: T) => Promise<SaveResult>;
  onChange: (state: AutosaveState) => void;
  delayMs?: number;
  now?: () => Date;
};

export class AutosaveController<T> {
  private latest: T | undefined;
  private pending = false;
  private saving = false;
  private inflight: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private state: AutosaveState = { status: "idle", savedAt: null };

  constructor(private opts: Options<T>) {}

  /** Troca a função de salvamento (o hook mantém a versão mais recente da Server Action). */
  setSave = (save: Options<T>["save"]) => {
    this.opts = { ...this.opts, save };
  };

  /** Chame a cada edição, com o valor completo mais recente. */
  schedule = (value: T) => {
    this.latest = value;
    this.pending = true;
    if (!this.saving) this.emit({ status: "dirty" });
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null; // o timer já disparou: não pode ficar "armado" na memória
      void this.run();
    }, this.opts.delayMs ?? 1500);
  };

  /** Salva já. Resolve `true` se não sobrou nada pendente e a última tentativa deu certo. */
  flush = async (): Promise<boolean> => {
    this.clearTimer();
    while (this.saving || this.pending) {
      if (this.inflight) await this.inflight;
      else await this.run();
      if (this.state.status === "error") break;
    }
    return !this.pending && this.state.status !== "error";
  };

  /** Ao sair da tela: dispara o salvamento pendente sem esperar. */
  dispose = () => {
    this.clearTimer();
    if (this.pending && !this.saving) void this.run();
  };

  get hasUnsavedChanges() {
    return this.pending || this.saving || this.state.status === "error";
  }

  private async run(): Promise<void> {
    if (this.saving || !this.pending) return;
    this.clearTimer();
    this.saving = true;
    this.pending = false;
    const value = this.latest as T;
    this.emit({ status: "saving" });

    this.inflight = (async () => {
      let result: SaveResult;
      try {
        result = await this.opts.save(value);
      } catch {
        result = { ok: false };
      }
      this.saving = false;
      this.inflight = null;

      if (!result.ok) {
        this.pending = true; // o valor continua sem salvar
        this.emit({ status: "error", message: result.message });
        return;
      }
      if (this.pending) {
        // Houve edição durante o salvamento: o debounce já está armado (ou dispara agora).
        this.emit({ status: "dirty", savedAt: (this.opts.now ?? (() => new Date()))() });
        if (!this.timer) void this.run();
        return;
      }
      this.emit({ status: "saved", savedAt: (this.opts.now ?? (() => new Date()))() });
    })();
    await this.inflight;
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private emit(patch: Partial<AutosaveState> & Pick<AutosaveState, "status">) {
    this.state = {
      savedAt: patch.savedAt ?? this.state.savedAt,
      status: patch.status,
      message: patch.status === "error" ? patch.message : undefined,
    };
    this.opts.onChange(this.state);
  }
}
