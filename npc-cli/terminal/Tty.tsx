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
    /** Show "CONT" and invoke this onclick  */
    continueInteractive: undefined as undefined | (() => void),
    fitDebounced: debounce(() => { state.base?.fitAddon.fit(); }, 300),
    inputOnFocus: undefined as undefined | { input: string; cursor: number },
    isTouchDevice: isTouchDevice(),
    pausedPids: {} as Record<number, true>,
    /** Should file be auto-re-sourced on hot-module-reload? */
    reSource: {} as Record<string, true>,

    handleExternalMsg({ msg }: ExternalMessage) {
      switch (msg.key) {
        case 'auto-re-source-file': {
          const basename = msg.absPath.slice('/etc/'.length);
          if (basename in props.shFiles) {
            delete state.reSource[basename];
            state.reSource[basename] = true;
          } else {
            warn(`${'handleExternalMsg'}: basename not found: ${basename}`);
          }
          break;
        }
        case 'interactive-finished':
          if (state.continueInteractive !== undefined) {
            state.continueInteractive = undefined;
            update();
          }
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
        || (p.status === ProcessStatus.Running && p.ptags?.[noPausePtag] !== true)
      ));
      
      const interactivePaused = processes[0]?.status === ProcessStatus.Running;

      for (const p of processes) {
        p.onSuspends = p.onSuspends.filter((onSuspend) => onSuspend(true));
        p.status = ProcessStatus.Suspended;
        state.pausedPids[p.key] = true;
      }

      if (interactivePaused) {
        state.continueInteractive = () => {
          state.continueInteractive = undefined;
          useSession.api.getProcesses(props.sessionKey, 0).forEach(p => {
            p.status = ProcessStatus.Running;
            p.onResumes = p.onResumes.filter(onResume => onResume());
          });
          update();
        };
        update();
      } else {// avoid resuming interactive process
        delete state.pausedPids[0];
      }
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
      const processes = Object.values(state.base?.session?.process ?? {}).filter(p =>
        state.pausedPids[p.key] === true
      );

      for (const p of processes) {
        if (p.status === ProcessStatus.Suspended) {
          p.status = ProcessStatus.Running;
          p.onResumes = p.onResumes.filter(onResume => onResume());
        }
        delete state.pausedPids[p.key];
      }

      if (state.continueInteractive) {
        state.continueInteractive = undefined;
        update();
      }
    },
    async storeAndSourceFuncs() {
      const session = state.base.session;

      Object.assign(session.etc, props.shFiles);

      // 🚧 only auto-re-source files that already have been sourced
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
    if (props.disabled && state.base.session) {
      state.pauseRunningProcesses();
      return () => state.resumeRunningProcesses();
    }
  }, [props.disabled, state.base.session])

  React.useEffect(() => {// Bind external events
    if (state.base.session) {
      const { xterm: { xterm }, session } = state.base;
      
      state.resize();
      const onKeyDispose = xterm.onKey((e) => props.onKey?.(e.domEvent));
      xterm.textarea?.addEventListener("focus", state.onFocus);
      
      const cleanupExternalMsgs = session.ttyShell.io.handleWriters(msg =>
        msg?.key === 'external' && state.handleExternalMsg(msg),
      );

      return () => {
        onKeyDispose.dispose();
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
    if (state.base.session?.ttyShell.initialized === true) {
      state.storeAndSourceFuncs();
    }
  }, [state.base.session, ...Object.entries(props.shFiles).flatMap(x => x)]);

  React.useEffect(() => {// sync ~/PROFILE
    if (state.base.session) {
      state.base.session.var.PROFILE = props.profile;
    }
  }, [state.base.session, props.profile]);

  React.useEffect(() => {// Boot profile
    if (state.base.session && !props.disabled && !state.booted) {
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
          session={state.base.session}
          continueInteractive={state.continueInteractive}
          disabled={props.disabled}
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
