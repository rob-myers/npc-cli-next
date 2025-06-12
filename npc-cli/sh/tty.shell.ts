import type * as Sh from "./parse";
import { error, testNever } from "../service/generic";
import type { MessageFromShell, MessageFromXterm, ShellIo } from "./io";
import { Device, ReadResult, SigEnum } from "./io";

import { ansi } from "./const";
import { killError, ProcessError, ShError, ttyError } from "./util";
import { loadMvdanSh, parseService, srcService } from "./parse";
import useSession, { ProcessMeta, ProcessStatus } from "./session.store";
import { semanticsService } from "./semantics.service";
import { ttyXtermClass } from "./tty.xterm";

export class ttyShellClass implements Device {
  public key: string;
  public xterm!: ttyXtermClass;
  /** Lines received from a TtyXterm. */
  private inputs = [] as { line: string; resolve: () => void }[];
  private input = null as null | { line: string; resolve: () => void };
  /** Lines in current interactive parse */
  private buffer = [] as string[];
  private readonly maxLines = 500;
  private process!: ProcessMeta;
  private cleanups = [] as (() => void)[];
  /** Currently only non-interactive when running PROFILE. */
  private interactive = true;

  private oneTimeReaders = [] as {
    resolve: (msg: any) => void;
    reject: (e: any) => void;
  }[];

  constructor(
    public sessionKey: string,
    public io: ShellIo<MessageFromXterm, MessageFromShell>,
    /** Source code entered interactively, most recent last. */
    private history: string[]
  ) {
    this.key = `/dev/tty-${sessionKey}`;
  }

  dispose() {
    this.xterm.dispose();
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups.length = 0;
  }

  get initialized() {
    return !!this.process;
  }

  async initialise(xterm: ttyXtermClass) {
    await loadMvdanSh(); // ensure parser loaded

    this.xterm = xterm;
    this.cleanups.push(this.io.read(this.onMessage.bind(this)));

    // session corresponds to leading process where pid = ppid = pgid = 0
    this.process = useSession.api.createProcess({
      sessionKey: this.sessionKey,
      ppid: 0,
      pgid: 0,
      src: "",
    });
  }

  private onMessage(msg: MessageFromXterm) {
    switch (msg.key) {
      case "req-history-line": {
        const { line, nextIndex } = this.getHistoryLine(msg.historyIndex);
        this.io.write({
          key: "send-history-line",
          line,
          nextIndex,
        });
        break;
      }
      case "send-line": {
        if (this.oneTimeReaders.length > 0) {
          this.oneTimeReaders.shift()!.resolve(msg.line);
          this.io.write({ key: "tty-received-line" });
        } else {
          this.inputs.push({
            line: msg.line,
            // xterm won't send another line until resolved
            resolve: () => this.io.write({ key: "tty-received-line" }),
          });
          this.tryParse();
        }
        break;
      }
      case "send-kill-sig": {
        this.buffer.length = 0;
        this.oneTimeReaders.forEach(({ reject }) => reject(
          new ProcessError(SigEnum.SIGKILL, 0, this.sessionKey)
        ));
        this.oneTimeReaders.length = 0;

        // 🔔 can ctrl-c even when paused
        this.prompt('$');
        semanticsService.handleTopLevelProcessError(
          new ProcessError(SigEnum.SIGKILL, 0, this.sessionKey)
        );
        break;
      }
      default:
        throw testNever(msg, { suffix: "onMessage" });
    }
  }

  private getHistoryLine(lineIndex: number) {
    const maxIndex = this.history.length - 1;
    return {
      line: this.history[maxIndex - lineIndex] || "",
      nextIndex: lineIndex < 0 ? 0 : lineIndex > maxIndex ? maxIndex : lineIndex,
    };
  }

  getHistory() {
    return this.history.slice();
  }

  /** `prompt` must not contain non-readable characters e.g. ansi color codes */
  private prompt(prompt: string) {
    this.io.write({
      key: "send-xterm-prompt",
      prompt: `${prompt} `,
    });
  }

  private provideContextToParsed(parsed: Sh.FileWithMeta) {
    Object.assign<Sh.BaseMeta, Sh.BaseMeta>(parsed.meta, {
      sessionKey: this.sessionKey,
      pid: 0,
      ppid: 0,
      pgid: 0,
      fd: { 0: this.key, 1: this.key, 2: this.key },
      stack: [],
      verbose: false, // TODO runtime configurable
    });
  }

  /**
   * We run the profile by pasting it into the terminal.
   * This explicit approach can be avoided via `source`.
   */
  async runProfile() {
    const profile = useSession.api.getVar(
      { pid: 0, sessionKey: this.sessionKey } as Sh.BaseMeta,
      "PROFILE",
    ) || "";

    const session = useSession.api.getSession(this.sessionKey);

    try {
      this.xterm.historyEnabled = false;
      useSession.api.writeMsg(
        this.sessionKey,
        `${ansi.Blue}${this.sessionKey}${ansi.White} running ${ansi.Blue}/home/PROFILE${ansi.Reset}`,
        "info"
      );
      
      this.interactive = false;
      await this.xterm.pasteAndRunLines(profile.split("\n"), true);

    } catch {
      // see tryParse catch
    } finally {
      this.interactive = true;
      this.xterm.historyEnabled = true;
      this.prompt("$");
    }
  }

  async sourceEtcFile(filename: string) {
    const session = useSession.api.getSession(this.sessionKey);
    const src = session.etc[filename];
    const term = parseService.parse(src);
    this.provideContextToParsed(term);
    return this.spawn(term);
  }

  /**
   * Spawn a process, assigning:
   * - new pid
   * - ppid as term.meta.ppid
   * - pgid as term.meta.pgid
   */
  async spawn(
    term: Sh.FileWithMeta,
    opts: {
      cleanups?: (() => void)[];
      leading?: boolean;
      localVar?: boolean;
      posPositionals?: string[];
    } = {}
  ) {
    const { meta } = term;

    if (opts.leading === true && this.interactive === true) {
      // interactively specified commands should run while <Tty> paused
      this.process.status = ProcessStatus.Running;
    }

    if (this.process.status === ProcessStatus.Suspended) {
      // paused process should not spawn other, e.g. on pause profile
      await new Promise<void>((resolve, reject) => {
        this.process.cleanups.push(() => reject(killError(meta, 130)));
        this.process.onResumes.push(resolve);
      });
    }

    if (!opts.leading) {// create process
      const { ppid, pgid } = meta;
      const { positionals, ptags } = useSession.api.getProcess(meta); // parent
      const process = useSession.api.createProcess({
        ppid,
        pgid,
        sessionKey: meta.sessionKey,
        src: srcService.src(term),
        posPositionals: opts.posPositionals || positionals.slice(1),
        ptags,
      });
      meta.pid = process.key;
      opts.cleanups !== undefined && process.cleanups.push(...opts.cleanups);

      const session = useSession.api.getSession(meta.sessionKey);
      const parent = session.process[meta.ppid]; // Exists
      // Shallow clone avoids mutation by descendants
      process.inheritVar = { ...parent.inheritVar, ...parent.localVar };
      if (opts.localVar === true) {
        // Some processes need their own PWD e.g. background, subshell
        process.localVar.PWD = parent.inheritVar.PWD ?? session.var.PWD;
        process.localVar.OLDPWD = parent.inheritVar.OLDPWD ?? session.var.OLDPWD;
      }
    }

    try {
      for await (const _ of semanticsService.File(term)) {
        // Unreachable: yielded values already sent to devices (tty, fifo, null, var, voice)
      }
      term.meta.verbose === true &&
        console.warn(
          `${meta.sessionKey}${meta.background ? " (background)" : ""}: ${meta.pid}: exit ${
            term.exitCode
          }`
        );
    } catch (e) {
      if (e instanceof ProcessError) {
        // 🔔 possibly via preProcessWrite
        ttyError(`${meta.sessionKey}${meta.pgid ? " (background)" : ""}: ${meta.pid}: ${e.code}`);
        // Ctrl-C code is 130 unless overridden
        term.exitCode = e.exitCode ?? 130; // 🚧 or 137?
      } else if (e instanceof ShError) {
        term.exitCode = e.exitCode;
      }
      throw e;
    } finally {
      useSession.api.setLastExitCode(term.meta, term.exitCode);
      if (opts.leading === true) {
        this.io.write({ key: 'external', msg: { key: 'interactive-finished', exitCode: term.exitCode ?? 0 } })
      } else if (meta.pid !== 0) {
        useSession.api.removeProcess(meta.pid, this.sessionKey);
      }
    }
  }

  private storeSrcLine(srcLine: string) {
    const prev = this.history.pop();
    prev && this.history.push(prev);
    if (prev !== srcLine) {
      this.history.push(srcLine);
      while (this.history.length > this.maxLines) this.history.shift();
      useSession.api.persistHistory(this.sessionKey);
    }
  }

  private async tryParse() {
    this.input = this.inputs.pop() || null;
    if (!this.input) return;

    try {// Catch errors from `this.spawn`

      this.buffer.push(this.input.line);
      const result = parseService.tryParseBuffer(this.buffer.slice());

      switch (result.key) {
        case "failed": {
          const errMsg = `mvdan-sh: ${result.error.replace(/^src\.sh:/, "")}`;
          error(errMsg);
          this.io.write({ key: "error", msg: errMsg });
          this.buffer.length = 0;
          this.prompt("$");
          break;
        }
        case "complete": {
          this.buffer.length = 0;
          const singleLineSrc = srcService.src(result.parsed);
          if (singleLineSrc && this.xterm.historyEnabled) {
            this.storeSrcLine(singleLineSrc); // Store command in history
          }

          // Run command
          this.process.src = singleLineSrc;
          this.provideContextToParsed(result.parsed);
          await this.spawn(result.parsed, { leading: true });

          this.prompt("$");
          break;
        }
        case "incomplete": {
          this.prompt(">");
          break;
        }
      }
    } catch (e) {
      if (e instanceof ProcessError) {
        semanticsService.handleTopLevelProcessError(e);
      } else {
        error("unexpected error propagated to tty.shell", e);
      }
      this.prompt("$");
    } finally {
      this.input?.resolve();
      this.input = null;
      this.process.ptags = undefined;
      
      // 🔔 do not suspend leading process during PROFILE,
      // otherwise we'll pause before spawning each subprocess
      if (this.interactive === true) {
        this.process.status = ProcessStatus.Suspended;
      }
    }
  }

  //#region Device
  public async readData(): Promise<ReadResult> {
    return await new Promise((resolve, reject) => {
      this.oneTimeReaders.push({
        resolve: (msg: string) => resolve({ data: msg }),
        reject,
      });
      this.input?.resolve();
      this.input = null;
    });
  }
  public async writeData(data: any) {
    this.io.write(data);
  }
  public finishedWriting() {
    // NOOP
  }
  /**
   * Background processes are not allowed to read from TTY.
   * We further assume there is at most one interactive process reading it.
   */
  public finishedReading() {
    this.buffer.length = 0;
    // this.oneTimeReaders.forEach(({ reject }) => reject());
    this.oneTimeReaders.forEach(({ resolve }) => resolve(undefined));
    this.oneTimeReaders.length = 0;
  }
  //#endregion
}
