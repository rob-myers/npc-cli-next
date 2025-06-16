import React from 'react';
import { css } from '@emotion/react';
import useMeasure from 'react-use-measure';
import debounce from 'debounce';

import { error, jsStringify, keys, warn } from '../service/generic';
import { isTouchDevice } from '../service/dom';
import type { Session } from "../sh/session.store";
import type { BaseTabProps } from '../tabs/tab-factory';
import type { ExternalMessage } from '../sh/io';

import useStateRef from '../hooks/use-state-ref';
import useUpdate from '../hooks/use-update';
import useSession, { ProcessStatus } from '../sh/session.store';
import TtyMenu from './TtyMenu';
import { BaseTty, type State as BaseTtyState } from './BaseTty';

/**
 * A `BaseTty` which can be:
 * - paused/resumed
 * - booted with a shell profile (~/PROFILE)
 * - sourced with externally provided shell functions (/etc/*)
 */
export default function Tty(props: Props) {

  const [rootRef, bounds] = useMeasure({ debounce: 0, scroll: false });

  const state = useStateRef(() => ({
    base: {} as BaseTtyState, // 🔔 hack to avoid excessive optional-chaining
    /**
     * Have we initiated the profile?
     * We don't want to re-run it on hmr.
     */
    booted: false,
    bounds,
    canContOrStop: null as null | 'CONT' | 'STOP',
    inputOnFocus: undefined as undefined | { input: string; cursor: number },
    isTouchDevice: isTouchDevice(),
    /** Should file be auto-re-sourced on hot-module-reload? */
    reSource: {} as Record<string, true>,

    fitDebounced: debounce(() => {
      // 🔔 fix scrollbar sync issue
      state.bounds.width > 0 && state.base.xterm.forceResize();
      state.base?.fitAddon.fit();
    }, 300),
    handleExternalMsg({ msg }: ExternalMessage) {
      switch (msg.key) {
        case 'auto-re-source-file': {
          const basename = msg.absPath.slice('/etc/'.length);
          if (basename in props.shFiles) {
            // 🔔 delete and assign _appends_ the key for non-integer keys
            delete state.reSource[basename];
            state.reSource[basename] = true;
          } else {
            warn(`${'handleExternalMsg'}: basename not found: ${basename}`);
          }
          break;
        }
        case 'interactive':
          if (msg.act === 'started' || msg.act == 'resumed') {
            state.canContOrStop = 'STOP';
          } else if (msg.act === 'paused') {
            state.canContOrStop = 'CONT';
          } else if (msg.act === 'ended') {
            state.canContOrStop = null;
          }
          update();
          break;
        default:
          warn(`${'handleExternalMsg'}: unexpected message: ${jsStringify(msg)}`);
          break;
      }
    },
    onFocus() {
      if (state.inputOnFocus !== undefined) {
        state.base.xterm.setInput(state.inputOnFocus.input);
        state.base.xterm.setCursor(state.inputOnFocus.cursor);
        state.inputOnFocus = undefined;
      }
    },
    pauseRunningProcesses() {
      const { session } = state.base;
      
      const processes = Object.values(session.process ?? {}).filter(p => (
        p.key === 0 // ensure leading process
        || (p.status === ProcessStatus.Running && !(noPausePtag in p.ptags))
      ));

      useSession.api.killProcesses(processes, { STOP: true, global: true });

      if (!session.ttyShell.isInteractive() && session.ttyShell.isProfileFinished()) {
        state.canContOrStop = 'CONT';
      } else {
        state.canContOrStop = null;
      }
      update();
    },
    reboot() {
      state.booted = false;
      update();
    },
    async resize() {
      if (state.isTouchDevice) {
        state.fitDebounced();
      } else {
        // Hide input to prevent issues when screen gets too small
        const input = state.base.xterm.getInput();
        const cursor = state.base.xterm.getCursor();
        if (input && state.base.xterm.isPromptReady()) {
          state.base.xterm.clearInput();
          state.inputOnFocus = { input, cursor };
          state.base.xterm.xterm.blur(); // Must blur
        }
        state.fitDebounced();
      }
    },
    resumeRunningProcesses() {
      const { session } = state.base;

      const processes = Object.values(session.process).filter(p =>
        p.key === 0
          // cannot resume running leading process
          ? !session.ttyShell.isInteractive()
          // cannot resume other unless suspended and lacks ptag
          : p.status === ProcessStatus.Suspended && !(noPausePtag in p.ptags)
      );

      useSession.api.killProcesses(processes, { CONT: true, global: true });

      if (!session.ttyShell.isInteractive() && session.ttyShell.isProfileFinished()) {
        state.canContOrStop = 'STOP';
      } else {
        state.canContOrStop = null;
      }
      update();
    },
    async storeAndSourceFuncs() {
      const session = state.base.session;

      Object.assign(session.etc, props.shFiles);

      // only auto-rex-source files that already have been sourced
      await Promise.all(keys(state.reSource).map(async filename => {
        try {
          await session.ttyShell.sourceEtcFile(filename);  
        } catch (e: any) {
          if (typeof e?.$type === 'string') {// mvdan.cc/sh/v3/syntax.ParseError
            const fileContents = props.shFiles[filename];
            const [line, column] = [e.Pos.Line(), e.Pos.Col()];
            const errorMsg = `${e.Error()}:\n${fileContents.split('\n')[line - 1]}` ;
            state.writeErrorToTty(session.key, `/etc/${filename}: ${e.$type}`, errorMsg);
          } else {
            state.writeErrorToTty(session.key, `/etc/${filename}: failed to run`, e)
          }
        }
      }));

      // store original functions too
      session.jsFunc = props.jsFunc;
    },
    writeErrorToTty(sessionKey: string, message: string, origError: any) {
      useSession.api.writeMsg(sessionKey, `${message} (see console)`, 'error');
      error(message);
      error(origError);
    },
  }), {
    deps: [props.shFiles],
  });

  React.useEffect(() => {// Pause/resume
    const { session } = state.base;
    if (!session) {
      return;
    }

    // if disabled, suspend spawned bg processes unless 'always' in ptags
    session.ttyShell.bgSuspendUnless = !!props.disabled ? noPausePtag : null;
    // avoid initial pause when props.disabled true
    const somethingSpawned = session.nextPid > 1;

    if (props.disabled === true) {
      if (somethingSpawned === true) {
        state.pauseRunningProcesses();
      }
      return () => state.base?.session && state.resumeRunningProcesses();
    }
  }, [props.disabled, state.base.session])

  React.useEffect(() => {// Bind external events
    if (state.base.session) {
      const { xterm: { xterm }, session } = state.base;
      
      xterm.attachCustomKeyEventHandler((e) => {
        // also send "Shift + Enter" so can resume Tabs from Tty
        e.type === 'keyup' && props.onKey?.(e);
        if (e.key === 'Enter' && e.shiftKey === true) {
          return false;
        } else {
          return true;
        }
      });

      state.resize();
      // const onKeyDispose = xterm.onKey((e) => props.onKey?.(e.domEvent));
      xterm.textarea?.addEventListener("focus", state.onFocus);
      
      const cleanupExternalMsgs = session.ttyShell.io.handleWriters(msg =>
        msg?.key === 'external' && state.handleExternalMsg(msg),
      );

      return () => {
        // onKeyDispose.dispose();
        xterm.textarea?.removeEventListener("focus", state.onFocus);
        cleanupExternalMsgs();
      };
    }
  }, [state.base.session, props.onKey]);

  React.useEffect(() => {// Handle resize
    state.bounds = bounds;
    state.base.session && state.resize();
  }, [bounds]);

  React.useEffect(() => {// sync shell functions
    if (state.base.session?.ttyShell.isInitialized()) {
      state.storeAndSourceFuncs();
    }
  }, [state.base.session, ...Object.entries(props.shFiles).flatMap(x => x)]);

  React.useEffect(() => {// sync ~/PROFILE
    if (state.base.session) {
      state.base.session.var.PROFILE = props.profile;
    }
  }, [state.base.session, props.profile]);

  React.useEffect(() => {// Boot profile (possibly while disabled)
    if (state.base.session && !state.booted) {
      const { xterm, session } = state.base;
      xterm.initialise();
      state.booted = true;
      
      session.ttyShell.initialise(xterm).then(async () => {
        await state.storeAndSourceFuncs();
        update();
        await session.ttyShell.runProfile();
      });
    }
  }, [state.base.session, props.disabled]);

  const update = useUpdate();

  return (
    <div css={rootCss} ref={rootRef}>
      <BaseTty
        ref={state.ref('base')}
        sessionKey={props.sessionKey}
        env={props.env}
        onUnmount={state.reboot}
      />
      {state.base.session && (
        <TtyMenu
          canContOrStop={state.canContOrStop}
          disabled={props.disabled}
          session={state.base.session}
          setTabsEnabled={props.setTabsEnabled}
        />
      )}
    </div>
  );
}

export interface Props extends BaseTabProps {
  sessionKey: `tty-${number}`;
  /** Can initialize variables */
  env: Partial<Session["var"]>;
  /**
   * All js functions which induce shell functions.
   * They are partitioned by "fileKey".
   */
  jsFunc: import('./TtyWithFunctions').TtyJsModules;
  /**
   * All shell files (*.sh and *.js.sh).
   * They are spread into `/etc`.
   */
  shFiles: Record<string, string>;
  /** Synced with e.g. profile-1.sh */
  profile: string;
  onKey?(e: KeyboardEvent): void;
}

const rootCss = css`
  height: 100%;
  padding: 4px;
`;

const noPausePtag = 'always';
