import React from "react";
import clsx from 'clsx';
import debounce from "debounce";
import { motion, AnimatePresence } from "motion/react";
import { create, useStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import { devtools } from "zustand/middleware";
import { subscribeWithSelector } from "zustand/middleware";
import { jsStringify, warn } from "../service/generic";
import { removeCached, setCached } from "../service/query-client";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @template T
 * @typedef {import("zustand/middleware/immer").WithImmer<T>} WithImmer<T>
 */
/**
 * @template T
 * @typedef {import("zustand/middleware/subscribeWithSelector").WithSelectorSubscribe<T>} WithSelectorSubscribe<T>
 */
/**
 * @typedef {{ lookup: { [uiKey: string]: NPC.FeedbackUi } }} UiState
 * Lookup cannot be top-level because zustand delete doesn't work.
 * @typedef {import("zustand").UseBoundStore<WithImmer<WithSelectorSubscribe<import("zustand").StoreApi<UiState>>>>} UiStore
 */

/**
 * Provide feedback to a process.
 * @param {Props} props
 */
export default function Feedback(props) {

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    pending: new Map(),
    pendingMode: 'none',
    ui: /** @type {State['ui']} */ (create(devtools(immer(subscribeWithSelector((_get, _set) => ({ lookup: {} }))), { name: props.tabKey }))),
    add(ui) {
      state.ui.setState(draft => {
        draft.lookup[ui.key] = feedbackUiDefToUi(ui, ui.key);
      });
    },
    getInputByEvent(e) {
      const el = /** @type {HTMLElement} */ (e.target);
      const { uiKey, inputKey } = el.dataset;
      if (!(typeof uiKey === 'string' && typeof inputKey === 'string')) {
        return null;
      }
      const ui = state.ui.getState().lookup[uiKey];
      return ui.input[inputKey] ?? null;
    },
    registerPending: debounce(/** @param {PendingNotification} item */ (item) => {
      state.pending.set(item.pid, item);
      state.pendingMode = state.pendingMode === 'none' ? 'closed' : state.pendingMode;
      update();
    }, 300),
    removePending(pid) {
      state.pending.delete(pid);
      state.pendingMode = state.pending.size === 0 ? 'none' : state.pendingMode;
      update();
    },
    removeUi(uiKey) {
      state.ui.setState(draft => { delete draft.lookup[uiKey]; });
    },
    setPendingMode: (next) => {
      state.pendingMode = next;
      update();
    },
    togglePendingMode: () => {
      if (state.pendingMode === 'none') return;
      state.setPendingMode(state.pendingMode === 'closed' ? 'open' : 'closed');
    },
  }), { ignore: { ui: true }, reset: { pending: false } });

  useStore(state.ui); // subscribe to ui changes
  
  React.useEffect(() => {
    setCached([props.tabKey], state);
    return () => removeCached([props.tabKey]);
  }, []);

  return (
    <div
      className="font-sans text-xs text-white bg-slate-900 flex items-start flex-wrap h-full overflow-auto"

      onChange={e => {
        const input = state.getInputByEvent(e.nativeEvent);
        if (input === null || !isOnChangeInput(input)) return;
        
        state.ui.setState(draft => {
          const ui = draft.lookup[input.uiKey];
          const nextInput = ui.input[input.key];

          switch (input.type) {
            case 'checkbox':
              nextInput.value = /** @type {HTMLInputElement} */ (e.target).checked;
              break;
            case 'number':
            case 'select':
            case 'text':
              nextInput.value = (/** @type {HTMLInputElement} */ (e.target)).value;
              break;
          }
        });
      }}
      onClick={e => {
        const input = state.getInputByEvent(e.nativeEvent);
        if (input?.type !== 'button') return;
        
        state.ui.setState(draft => {
          const ui = draft.lookup[input.uiKey];
          ui.input[input.key].value = Date.now();
        });
      }}
    >
      {Object.values(state.ui.getState().lookup).map((ui) => (
        <div key={ui.key} className="flex gap-1 flex-wrap items-center p-2 border-[1px] border-white/50 rounded-md">
          <div className="cursor-default font-mono text-blue-200" title={ui.title}>
            {ui.key}
          </div>
          {Object.values(ui.input).map((input) => (
            <FeedbackUiInput key={input.key} input={input} />
          ))}
        </div>
      ))}

      <div
        className={clsx(
          "absolute bottom-2 rounded-l right-0 size-7 overflow-auto",
          "text-xs pl-2 py-1 bg-black border-[1px] border-r-0 border-gray-600 cursor-pointer select-none",
          "transition-[width,height,right] duration-300",
          state.pendingMode === 'open' && "w-[calc(100%-2*8px)] min-h-16",
          state.pendingMode === 'none' && "w-0 right-[-12px]",
        )}
        onClick={state.togglePendingMode}
      >
        <AnimatePresence initial>
          {state.pendingMode === 'open'
            ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.5, delay: 0.25 } }} key="pending">
                {Array.from(state.pending.values()).map(item =>
                  <div key={item.pid} className="flex justify-between gap-2 pl-1 w-full">
                    <div className="text-green-300">{item.pid}</div>
                    <div className="text-yellow-200 whitespace-nowrap">{item.message}</div>
                  </div>)}
              </motion.div>
              
            : <motion.div key="icon">⚠️</motion.div>
          }
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * @typedef State
 * @property {'none' | 'closed' | 'open'} pendingMode
 * @property {Map<number, PendingNotification>} pending Pending processes
 * @property {UiStore} ui
 * @property {((ui: NPC.FeedbackUiDef) => void)} add
 * @property {((e: Event) => null | NPC.FeedbackInput )} getInputByEvent
 * @property {((item: PendingNotification) => void)} registerPending
 * @property {((pid: number) => void)} removePending
 * @property {((uiKey: string) => void)} removeUi
 * @property {((next: State['pendingMode']) => void)} setPendingMode
 * @property {(() => void)} togglePendingMode
 */

/**
 * @typedef {{ pid: number; message: string }} PendingNotification
 */

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */

/**
 * @param {{ input: NPC.FeedbackInput }} props
 */
function FeedbackUiInput({ input }) {
  switch (input.type) {
    case 'button':
      return (
        <button
          className="bg-gray-800 text-white font-thin hover:brightness-150 hover:bg-green-900 cursor-pointer rounded-md px-1 border-2 border-indigo-500/50"
          data-ui-key={input.uiKey}
          data-input-key={input.key}
        >
          {input.label ?? input.key}
        </button>
      );
    case 'checkbox':
      return (
        <label className="select-none flex gap-1">
          <div className={clsx(
            "select-none font-normal bg-black hover:brightness-150 cursor-pointer rounded-sm px-1 border-2 border-gray-800",
            input.value ? 'text-white' : 'text-white/50')
          }>
            {input.label ?? input.key}
          </div>
          <input type="checkbox" className="hidden"
            data-ui-key={input.uiKey}
            data-input-key={input.key}
            defaultChecked={input.default}
            checked={input.value}
            onChange={emptyOnChange}
          />
        </label>
      );
    case 'number':
      return (
        <input type="number"
          data-ui-key={input.uiKey}
          data-input-key={input.key}
          defaultValue={input.default}
          value={input.value}
          onChange={emptyOnChange}
        />
      );
    case 'select':
      return (
        <select
          className="bg-gray-800 text-white font-thin hover:brightness-150 cursor-pointer rounded-md px-1 border-2 border-indigo-800/50"
          data-ui-key={input.uiKey}
          data-input-key={input.key}
          value={input.value}
          onChange={emptyOnChange}
        >
          {input.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case 'text':
      return (
        <input
          data-ui-key={input.uiKey}
          data-input-key={input.key}
          type="text"
          placeholder={input.placeholder}
          defaultValue={input.default}
          value={input.value}
          onChange={emptyOnChange}
        />
      );
  default:
    return null;
  }
}

/**
 * @param {NPC.FeedbackUiDef} uiDef 
 * @param {string} uiKey 
 * @returns {NPC.FeedbackUi}
 */
function feedbackUiDefToUi(uiDef, uiKey) {
  const { input: lookup, ...rest } = uiDef;

  return {
    ...rest,
    input: Object.fromEntries(Object.values(lookup).flatMap(input => {
      switch (input.type) {
        case 'button':
          return {...input, uiKey, value: 0 }; // last clicked epochMs
        case 'checkbox':
          return {...input, uiKey, value: Boolean(input.default) };
        case 'number':
          return {...input, uiKey, value: Number(input.default) };
        case 'select':
          return {...input, uiKey, value: input.default ?? input.options[0]?.value ?? '' };
        case 'text':
          return {...input, uiKey, value: input.default ?? '' };
        default:
          warn(`Ignored feedback input with unknown type: ${jsStringify(input)}`);
          return [];
      }
    }).map(input => [input.key, input])),
  };
}

function emptyOnChange() {}

/**
 * @param {NPC.FeedbackInput} input
 * @returns {input is NPC.FeedbackOnChangeInput}
 */
function isOnChangeInput(input) {
  return input.type in fromChangeInputType;
}

const fromChangeInputType = /** @type {const} */ ({
  checkbox: true,
  number: true,
  select: true,
  text: true,
});