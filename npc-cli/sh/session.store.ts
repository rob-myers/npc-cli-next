import { create } from "zustand";

import { ansi } from "./const";
import { addToLookup, deepClone, removeFromLookup, tryLocalStorageGet, tryLocalStorageSet, KeyedLookup, jsStringify, warn, pause } from "../service/generic";
import { computeNormalizedParts, formatMessage, killProcess, resolveNormalized, ShError, ttyError } from "./util";
import type { BaseMeta, FileWithMeta, NamedFunction } from "./parse";
import type { MessageFromShell, MessageFromXterm } from "./io";
import { type Device, type ShellIo, type VarDeviceMode, FifoDevice, makeShellIo, NullDevice, VarDevice, VoiceDevice } from "./io";
import { srcService } from "./parse";
import { ttyShellClass } from "./tty.shell";

export type State = {
  session: KeyedLookup<Session>;
  device: KeyedLookup<Device>;

  readonly api: {
    addFunc: (sessionKey: string, funcName: string, wrappedFile: FileWithMeta) => void;
    /** We assume `lineText` and `ctxts` have already been stripped of ansi codes. */
    addTtyLineCtxts: (sessionKey: string, lineText: string, ctxts: TtyLinkCtxt[]) => void;
    createSession: (sessionKey: string, env: Record<string, any>) => Session;
    createProcess: (def: {
      sessionKey: string;
      ppid: number;
      pgid: number;
      src: string;
      posPositionals?: string[];
      ptags: Meta;
    }) => ProcessMeta;
    createFifo: (fifoKey: string, size?: number) => FifoDevice;
    createVarDevice: (meta: BaseMeta, varPath: string, mode: VarDeviceMode) => VarDevice;
    getFunc: (sessionKey: string, funcName: string) => NamedFunction | undefined;
    getFuncs: (sessionKey: string) => NamedFunction[];
    getLastExitCode: (meta: BaseMeta) => number;
    getNextPid: (sessionKey: string) => number;
    getProcess: (meta: BaseMeta) => ProcessMeta;
    getProcesses: (sessionKey: string, pgid?: number) => ProcessMeta[];
    getPositional: (pid: number, sessionKey: string, varName: number) => string;
    getVar: <T = any>(meta: BaseMeta, varName: string) => T;
    getVarDeep: (meta: BaseMeta, varPath: string) => any | undefined;
    getSession: (sessionKey: string) => Session;
    kill(sessionKey: string, pids: number[], opts: {
      STOP?: boolean;
      CONT?: boolean;
      /** Ctrl-C, originating from pid 0 */
      SIGINT?: boolean;
      group?: boolean;
    }): void;
    killProcesses(processes: ProcessMeta[], opts: {
      STOP?: boolean;
      CONT?: boolean;
      SIGINT?: boolean;
      /** For STOP */
      global?: boolean;
    }): void;
    onTtyLink: (opts: {
      sessionKey: string;
      lineText: string;
      linkText: string;
      linkStartIndex: number;
      lineNumber: number;
    }) => void;
    persistHistory: (sessionKey: string) => void;
    persistHome: (sessionKey: string) => void;
    rehydrate: (sessionKey: string) => Rehydrated;
    removeDevice: (deviceKey: string) => void;
    removeProcess: (pid: number, sessionKey: string) => void;
    removeSession: (sessionKey: string) => void;
    /** Expect `line` to be stripped of ansi-codes. */
    removeTtyLineCtxts: (sessionKey: string, line: string) => void;
    resolve: (fd: number, meta: BaseMeta) => Device;
    setLastExitCode(meta: BaseMeta, exitCode?: number): void;
    setVar: (meta: BaseMeta, varName: string, varValue: any) => void;
    setVarDeep: (meta: BaseMeta, varPath: string, varValue: any) => void;
    writeMsg: (sessionKey: string, msg: string, level: "info" | "error") => void;
    writeMsgCleanly: (
      sessionKey: string,
      msg: string,
      opts?: {
        level?: "info" | "error";
        scrollToBottom?: boolean;
      }
    ) => Promise<void>;
  };
};

export interface Session {
  key: string;
  process: KeyedLookup<ProcessMeta>;
  func: KeyedLookup<NamedFunction>;

  /**
   * Currently only support one tty per session,
   * i.e. cannot have two terminals in same session.
   * This could be changed e.g. `ttys: { io, shell }[]`.
   */
  ttyIo: ShellIo<MessageFromXterm, MessageFromShell>;
  ttyShell: ttyShellClass;
  ttyLink: { [lineText: string]: TtyLinkCtxt[] };

  etc: Record<string, any>;
  var: {
    [varName: string]: any;
    PWD: string;
    OLDPWD: string;
    /** `processApi[key]` is `processApi.getCached(var[CACHE_SHORTCUTS[key]])` */
    CACHE_SHORTCUTS?: { [key: string]: string };
  };
  jsFunc: import('../terminal/TtyWithFunctions').TtyJsModules;

  nextPid: number;
  /** Last exit code: */
  lastExit: {
    /** Foreground */ fg: number;
    /** Background */ bg: number;
  };
  verbose: boolean;
}

interface Rehydrated {
  history: string[] | null;
  var: Record<string, any> | null;
}

/**
 * - `0` is suspended
 * - `1` is running
 * - `2` is killed
 */
export enum ProcessStatus {
  Suspended,
  Running,
  Killed,
}

export interface ProcessMeta {
  /** pid */
  key: number;
  ppid: number;
  pgid: number;
  sessionKey: string;
  /** `0` is suspended, `1` is running, `2` is killed */
  status: ProcessStatus;
  /** Source of code defining this process. */
  src: string;
  /**
   * Executed on Ctrl-C or `kill`.
   * May contain `() => reject(killError(meta))` ...
   */
  cleanups: ((SIGINT?: boolean) => void)[];
  /**
   * Executed on suspend, without clearing `true` returners.
   * The latter should be idempotent, e.g. unsubscribe, pause.
   * 
   * - `global` true iff the suspension was triggered by disabling the `<Tty>`.
   * - thus can distinguish global pause from process pause
   */
  onSuspends: ((global: boolean) => void | boolean)[];
  /**
   * Executed on resume, without clearing `true` returners.
   * The latter should be idempotent, e.g. reject, resolve.
   */
  onResumes: (() => void | boolean)[];
  positionals: string[];
  /**
   * Variables specified locally in this process.
   * Particularly helpful for background processes and subshells,
   * which have their own PWD and OLDPWD.
   */
  localVar: Record<string, any>;
  /** Inherited local variables. */
  inheritVar: Record<string, any>;
  /** Can specify via e.g. `ptags="always x=foo y=bar" echo baz` */
  ptags: Record<string, any>;
}

export interface TtyLinkCtxt {
  /** Line stripped of ansi-codes. */
  lineText: string;
  /** Label text stripped of ansi-codes e.g. `[ foo ]` has link text `foo` */
  linkText: string;
  /**
   * One character before the link text occurs,
   * or equivalently one character after the leading square bracket.
   */
  linkStartIndex: number;
  /**
   * Callback associated with link
   * @param callback Line we clicked on (possibly wrapped)
   */
  callback(lineNumber: number): void;
  /** Can refresh link e.g. `ps` on/off */
  refresh?(): void;
}

const useStore = create<State>()(
  
  (set, get): State => ({
    device: {},
    session: {},
    //@ts-ignore
    persist: {},

    api: {
      addFunc(sessionKey, funcName, file) {
        api.getSession(sessionKey).func[funcName] = {
          key: funcName,
          node: file,
          src: srcService.multilineSrc(file),
        };
      },

      addTtyLineCtxts(sessionKey, lineText, ctxts) {
        api.getSession(sessionKey).ttyLink[lineText] = ctxts;
      },

      createFifo(key, size) {
        const fifo = new FifoDevice(key, size);
        return (get().device[fifo.key] = fifo);
      },

      createProcess({ sessionKey, ppid, pgid, src, posPositionals, ptags }) {
        const pid = get().api.getNextPid(sessionKey);
        const processes = get().api.getSession(sessionKey).process;

        return processes[pid] = {
          key: pid,
          ppid,
          pgid,
          sessionKey,
          status: ProcessStatus.Running,
          src,
          positionals: ["jsh", ...(posPositionals ?? [])],
          cleanups: [],
          onSuspends: [],
          onResumes: [],
          localVar: {},
          inheritVar: {},
          ptags,
        };
      },

      createSession(sessionKey, env) {
        const persisted = api.rehydrate(sessionKey);
        const ttyIo = makeShellIo<MessageFromXterm, MessageFromShell>();
        const ttyShell = new ttyShellClass(sessionKey, ttyIo, persisted.history || []);
        get().device[ttyShell.key] = ttyShell;
        get().device["/dev/null"] = new NullDevice("/dev/null");
        get().device["/dev/voice"] = new VoiceDevice("/dev/voice");

        set(({ session }) => ({
          session: addToLookup(
            {
              key: sessionKey,
              func: {},
              ttyIo,
              ttyShell,
              ttyLink: {},
              etc: {},
              var: {
                PWD: "/home",
                OLDPWD: "",
                ...persisted.var,
                ...deepClone(env),
              },
              jsFunc: {} as any,
              nextPid: 0,
              process: {},
              lastExit: { fg: 0, bg: 0 },
              verbose: false,
            },
            session
          ),
        }));
        return get().session[sessionKey];
      },

      createVarDevice(meta, varPath, mode) {
        const device = new VarDevice(meta, varPath, mode);
        return (get().device[device.key] = device);
      },

      getFunc(sessionKey, funcName) {
        return get().session[sessionKey].func[funcName] || undefined;
      },

      getFuncs(sessionKey) {
        return Object.values(get().session[sessionKey].func);
      },

      getLastExitCode(meta) {
        return get().session[meta.sessionKey].lastExit[meta.background ? "bg" : "fg"];
      },

      getNextPid(sessionKey) {
        return get().session[sessionKey].nextPid++;
      },

      getPositional(pid, sessionKey, varName) {
        return get().session[sessionKey].process[pid].positionals[varName] || "";
      },

      getProcess({ pid, sessionKey }) {
        return get().session[sessionKey].process[pid];
      },

      getProcesses(sessionKey, pgid) {
        const session = get().session[sessionKey];
        if (session !== undefined) {
          const processes = Object.values(session.process);
          return pgid === undefined ? processes : processes.filter((x) => x.pgid === pgid);
        } else {
          warn(`getProcesses: session ${sessionKey} does not exist`);
          return [];
        }
      },

      getVar(meta, varName): any {
        const process = api.getProcess(meta);
        if (varName in process?.localVar) {
          // Got locally specified variable
          return process.localVar[varName];
        } else if (varName in process?.inheritVar) {
          // Got variable locally specified in ancestral process
          return process.inheritVar[varName];
        } else {
          // Got top-level variable in "file-system" e.g. /home/foo
          return get().session[meta.sessionKey].var[varName];
        }
      },

      getVarDeep(meta, varPath) {
        const session = get().session[meta.sessionKey];
        /**
         * Can deep get /home/* and /etc/*
         * TODO support deep get of local vars?
         */
        const root = { home: session.var, etc: session.etc };
        const parts = computeNormalizedParts(varPath, api.getVar(meta, "PWD") as string);
        return Function(
          "__",
          `return ${JSON.stringify(parts)}.reduce((agg, x) => agg[x], __)`
        )(root);
      },

      getSession(sessionKey) {
        return get().session[sessionKey];
      },

      kill(
        sessionKey: string,
        pids: number[],
        opts: {
          STOP?: boolean;
          CONT?: boolean;
          /** Ctrl-C, originating from pid 0 */
          SIGINT?: boolean;
          group?: boolean;
        }
      ) {
        const session = useSession.api.getSession(sessionKey);

        for (const pid of pids) {
          const { [pid]: process } = session.process;
          if (!process) {
            continue; // Already killed
          }
    
          const processes = process.pgid === pid || opts.group === true
            // Apply command to whole process group (in reverse)
            ? useSession.api.getProcesses(sessionKey, process.pgid).reverse()
            : [process] // Apply command to exactly one process
          ;
    
          useSession.api.killProcesses(processes, opts);
        }
      },

      killProcesses(
        processes: ProcessMeta[],
        opts: {
          STOP?: boolean;
          CONT?: boolean;
          SIGINT?: boolean;
          /** STOP can be global */
          global?: boolean;
        },
      ) {
        if (opts.SIGINT === true) {
          for (const p of processes) {
            killProcess(p, opts.SIGINT);
          }
        } else if (opts.STOP === true) {
          const global = !!opts.global;
          for (const p of processes) {
            p.onSuspends = p.onSuspends.filter((onSuspend) => onSuspend(global));
            p.status = ProcessStatus.Suspended;
          }
        } else if (opts.CONT === true) {
          for (const p of processes) {
            p.onResumes = p.onResumes.filter((onResume) => onResume());
            p.status = ProcessStatus.Running;
          }
        }
      },

      onTtyLink(opts) {
        // console.log('onTtyLink', opts,
        //   api.getSession(opts.sessionKey).ttyLink,
        //   api.getSession(opts.sessionKey).ttyLink[opts.lineText],
        // );

        try {
          // 🔔 HACK: permit toggle link (e.g. on/off) without leaving link first
          const { xterm } = api.getSession(opts.sessionKey).ttyShell.xterm;
          const linkifier = (xterm as any)._core.linkifier;
          // console.log(linkifier);
          setTimeout(() => {
            const position = linkifier._positionFromMouseEvent(
              linkifier._lastMouseEvent,
              linkifier._element,
              linkifier._mouseService!
            );
            position && linkifier._askForLink(position, false);
          });
        } catch (e) {
          console.warn("HACK: permit toggle link: failed", e);
        }


        api.getSession(opts.sessionKey).ttyLink[opts.lineText]?.find(
          x => x.linkStartIndex === opts.linkStartIndex && x.linkText === opts.linkText
        )?.callback(opts.lineNumber);
      },

      persistHistory(sessionKey) {
        const { ttyShell } = api.getSession(sessionKey);

        tryLocalStorageSet(
          `history@session-${sessionKey}`,
          JSON.stringify(ttyShell.getHistory())
        );
      },

      persistHome(sessionKey) {
        const {
          PWD, OLDPWD, CACHE_SHORTCUTS, ...persistedVarLookup
        } = api.getSession(sessionKey).var;

        tryLocalStorageSet(
          `var@session-${sessionKey}`,
          jsStringify(persistedVarLookup),
        );
        // console.log({persistedVarLookup})
      },

      rehydrate(sessionKey) {
        let storedHistory = null as null | string[];
        let storedVar = null as null | Record<string, any>;

        try {
          storedHistory = JSON.parse(
            tryLocalStorageGet(`history@session-${sessionKey}`) || "null"
          );
        } catch (e) {// Can fail in CodeSandbox in Chrome Incognito
          ttyError(`${sessionKey}: rehydrate history failed`);
          ttyError(e);
        }

        const prevValue = tryLocalStorageGet(`var@session-${sessionKey}`) || "null";
        try {
          // storedVar = JSON.parse(tryLocalStorageGet(`var@session-${sessionKey}`) || "null");
          // 🔔 must handle newlines generated by npm module "javascript-stringify"
          storedVar = Function(`return ${prevValue.replace(/\n/g, '\\n')}`)();
          // console.log({storedVar})
        } catch (e) {// Can fail in CodeSandbox in Chrome Incognito
          ttyError(`${sessionKey}: rehydrate variables failed: ${prevValue}`);
          ttyError(e);
        }

        return { history: storedHistory, var: storedVar };
      },

      removeDevice(deviceKey) {
        delete get().device[deviceKey];
      },

      removeProcess(pid, sessionKey) {
        const processes = get().session[sessionKey].process;
        delete processes[pid];
      },

      removeSession(sessionKey) {
        const session = get().session[sessionKey];
        if (session) {
          const { process, ttyShell } = session;
          session.verbose = false;
          ttyShell.dispose();
          Object.values(process).reverse().forEach((x) => killProcess(x));
          delete get().device[ttyShell.key];
          set(({ session }) => ({ session: removeFromLookup(sessionKey, session) }));
        } else {
          warn(`removeSession: ${sessionKey}: cannot remove non-existent session`);
        }
      },

      removeTtyLineCtxts(sessionKey, lineText) {
        delete api.getSession(sessionKey).ttyLink[lineText];
      },

      resolve(fd, meta) {
        return get().device[meta.fd[fd]];
      },

      setLastExitCode(meta, exitCode) {
        const session = api.getSession(meta.sessionKey);
        if (session === undefined) {
          warn(`session ${meta.sessionKey} no longer exists`);
        } else if (typeof exitCode === "number") {
          session.lastExit[meta.background ? "bg" : "fg"] = exitCode;
        } else {
          warn(`process ${meta.pid} had no exitCode`);
        }
      },

      setVar(meta, varName, varValue) {
        const session = api.getSession(meta.sessionKey);
        const process = session.process[meta.pid];
        if (varName in process?.localVar || varName in process?.inheritVar) {
          /**
           * One can set a local variable from an ancestral process,
           * but it will only change the value in current process.
           */
          process.localVar[varName] = varValue;
        } else {
          session.var[varName] = varValue;
        }
      },

      setVarDeep(meta, varPath, varValue) {
        const session = api.getSession(meta.sessionKey);
        const process = session.process[meta.pid];
        const parts = varPath.split("/");

        let root: Record<string, any>, normalParts: string[];

        /**
         * We support writing to local process variables,
         * e.g. `( cd && echo 'pwn3d!'>PWD && pwd )`
         */
        const localCtxt =
          parts[0] in process.localVar
            ? process.localVar
            : parts[0] in process.inheritVar
            ? process.inheritVar
            : null;
        if (localCtxt) {
          root = localCtxt;
          normalParts = parts;
        } else {
          root = { home: session.var };
          normalParts = computeNormalizedParts(varPath, api.getVar(meta, "PWD") as string);

          if (!(normalParts[0] === "home" && normalParts.length > 1)) {
            throw new ShError("only the home directory is writable", 1);
          }
        }

        try {
          const leafKey = normalParts.pop() as string;
          const parent = resolveNormalized(normalParts, root);
          parent[leafKey] = varValue;
        } catch (e) {
          throw new ShError(`cannot resolve /${normalParts.join("/")}`, 1);
        }
      },

      writeMsg(sessionKey, msg, level) {
        api.getSession(sessionKey).ttyIo.write({ key: level, msg });
      },

      async writeMsgCleanly(sessionKey, msg, opts = {}) {
        const { xterm } = api.getSession(sessionKey).ttyShell;
        xterm.prepareForCleanMsg();
        await new Promise<void>((resolve) =>
          xterm.queueCommands([
            { key: "line", line: opts.level ? formatMessage(msg, opts.level) : `${msg}${ansi.Reset}` },
            { key: "resolve", resolve },
          ])
        );
        await pause();
        xterm.showPendingInputImmediately();
        opts.scrollToBottom === true && xterm.xterm.scrollToBottom();
      },
    },
  }),
  
);

const api = useStore.getState().api;
const useSession = Object.assign(useStore, { api });

export default useSession;
