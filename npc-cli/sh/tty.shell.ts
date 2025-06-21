import type * as Sh from "./parse";
import { error, testNever, warn } from "../service/generic";
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
  /** Suspend background processes unless has this ptag */
  public bgSuspendUnless = null as null | string;

  /** Lines received from a TtyXterm. */
  private inputs = [] as { line: string; resolve: () => void }[];
  private input = null as null | { line: string; resolve: () => void };
  /** Lines in current interactive parse */
  private buffer = [] as string[];
  private cleanups = [] as (() => void)[];
  private readonly maxLines = 500;
  private process!: ProcessMeta;
  private profileFinished = false;

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
      ptags: {},
    });

    this.process.onSuspends.push(() => {
      this.profileFinished && this.io.write({ key: 'external', msg: { key: 'interactive', act: 'paused' } });
      return true;
    });
    this.process.onResumes.push(() => {
      this.profileFinished && this.io.write({ key: 'external', msg: { key: 'interactive', act: 'resumed' } });
      return true;
    });
  }

  isInitialized() {
    return !!this.process;
  }

  /**
   * The shell is interactive iff the profile has run and the prompt is ready.
   * This should happen exactly when the leading process is NOT running.
   */
  isInteractive() {
    return this.profileFinished === true && this.xterm.isPromptReady() === true;
  }

  isProfileFinished() {
    return this.profileFinished;
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
   * 
   * Importantly this sets `this.profileHasRun` as `true`.
   */
  async runProfile() {
    const profile = useSession.api.getVar(
      { pid: 0, sessionKey: this.sessionKey } as Sh.BaseMeta,
      "PROFILE",
    ) || "";

    try {
      this.xterm.historyEnabled = false;
      useSession.api.writeMsg(
        this.sessionKey,
        `${ansi.Blue}${this.sessionKey}${ansi.White} running ${ansi.Blue}/home/PROFILE${ansi.Reset}`,
        "info"
      );
      
      await this.xterm.pasteAndRunLines(profile.split("\n"), true);

    } catch {
      // see tryParse catch
    } finally {
      this.profileFinished = true;
      this.process.status = ProcessStatus.Suspended;
      this.xterm.historyEnabled = true;
      this.prompt("$");
    }
  }

  async sourceEtcFile(filename: string) {
    const session = useSession.api.getSession(this.sessionKey);
    const src = session.etc[filename];
    const term = parseService.parse(src);
    this.provideContextToParsed(term);
    await this.spawn(term, { internal: true });
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
      /**
       * A non-pausable process e.g. `source /etc/util.js.sh` which only defines
       * shell functions. These processes should not spawn others e.g. they should
       * only define shell functions and source other such files.
       * 
       * More generally they should only execute built-ins.
       */
      internal?: boolean;
      /** `term.meta.pid === 0`. */
      leading?: boolean;
      localVar?: boolean;
      posPositionals?: string[];
    } = {}
  ) {
    const { meta } = term;

    let process = this.process;

    if (this.profileFinished === true) {
      if (opts.leading === true) {
        // Only reachable by interactively specifying a command after profile has run
        // We ensure leading process has status Running
        process.status = ProcessStatus.Running;
        this.io.write({ key: 'external', msg: { key: 'interactive', act: 'started' } });
      }
    } else {
      if (process.status === ProcessStatus.Suspended && opts.internal !== true) {
        // Only reachable if leading process paused via <Tabs> during profile
        // We halt all subprocesses
        await new Promise<void>((resolve, reject) => {
          process.cleanups.push(() => reject(killError(meta, 130)));
          process.onResumes.push(resolve);
        });
      }
    }

    if (opts.leading !== true) {// create process
      const { ppid, pgid, sessionKey } = meta;
      const session = useSession.api.getSession(sessionKey);
      const parent = session.process[ppid]; // Exists
      process = useSession.api.createProcess({
        ppid,
        pgid,
        sessionKey,
        src: srcService.src(term),
        posPositionals: opts.posPositionals || parent.positionals.slice(1),
        ptags: { ...parent.ptags },
      });
      meta.pid = process.key;
      opts.cleanups !== undefined && process.cleanups.push(...opts.cleanups);

      if (
        process.pgid !== 0 
        && this.bgSuspendUnless !== null
        && !(this.bgSuspendUnless in process.ptags)
      ) {
        // If `bgSuspendUnless` non-null, suspend spawned background processes without this ptag.
        // This permits us to represent <Tabs> disabled.
        process.status = ProcessStatus.Suspended;
      }

      // Shallow clone avoids mutation by descendants
      process.inheritVar = { ...parent.inheritVar, ...parent.localVar };
      if (opts.localVar === true) {
        // Some processes need their own PWD e.g. background, subshell
        process.localVar.PWD = parent.inheritVar.PWD ?? session.var.PWD;
        process.localVar.OLDPWD = parent.inheritVar.OLDPWD ?? session.var.OLDPWD;
      }
    }

    if (meta.pid === meta.pgid) {// Process leaders emit external events
      this.io.write({ key: 'external', msg: {
        key: 'process-leader',
        pid: meta.pid,
        act: 'started',
        profileRunning: this.profileFinished === false ? true : undefined,
      }});

      process.onSuspends.push(() => {
        this.io.write({ key: 'external', msg: {
          key: 'process-leader',
          pid: meta.pid,
          act: 'paused',
          profileRunning: this.profileFinished === false ? true : undefined,
        }});
        return true;
      });

      process.onResumes.push(() => {
        this.io.write({ key: 'external', msg: {
          key: 'process-leader',
          pid: meta.pid,
          act: 'resumed',
          profileRunning: this.profileFinished === false ? true : undefined,
        }});
        return true;
      });
    }

    try {// Run process
      for await (const _ of semanticsService.File(term)) {
        // Unreachable: yielded values already sent to devices:
        // (tty, fifo, null, var, voice)
      }
      term.meta.verbose === true && warn(
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

      if (opts.leading !== true) {
        useSession.api.removeProcess(meta.pid, this.sessionKey);
      } else if (this.profileFinished === true) {
        this.io.write({ key: 'external', msg: { key: 'interactive', act: 'ended' } }); 
      }

      if (meta.pid === meta.pgid) {
        this.io.write({ key: 'external', msg: {
          key: 'process-leader',
          pid: meta.pid,
          act: 'ended',
          profileRunning: this.profileFinished === false ? true : undefined,
        }});

        // must clear in case of leading process (we reuse it)
        process.onResumes.length = 0;
        process.onSuspends.length = 0;
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
      this.process.ptags = {};
      
      // do not suspend leading process during profile,
      // otherwise we'll pause before spawning each subprocess
      if (this.profileFinished === true) {
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
