import React from "react";
import clsx from 'clsx';
import debounce from "debounce";
import { create, useStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import { devtools } from "zustand/middleware";
import { subscribeWithSelector } from "zustand/middleware";
import { jsStringify, warn } from "../service/generic";
import { removeCached, setCached } from "../service/query-client";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import useTabs from "../tabs/tabs.store";

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
    change(uiKey, partial) {
      state.ui.setState(draft => {// assumes type correctness
        const inputLookup = draft.lookup[uiKey].input;
        Object.entries(partial).forEach(([inputKey, value]) => {
          inputLookup[inputKey].value = value;
        });
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
    getUi(uiKey) {
      return state.ui.getState().lookup[uiKey] ?? null;
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
    remove(uiKey) {
      state.ui.setState(draft => { delete draft.lookup[uiKey]; });
    },
    removeUiOnClose() {
      const closingTab = !useTabs.getState().tabset.tabs.some(tab => tab.id === props.tabKey);
      if (!closingTab) return;

      state.ui.setState(draft => {
        Object.keys(draft.lookup).forEach(uiKey => delete draft.lookup[uiKey]);
      });
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
    return () => {
      removeCached([props.tabKey]);
      state.removeUiOnClose();
    };
  }, []);

  return (
    <div
      className="font-sans text-xs text-white bg-gray-900/50 flex items-start flex-wrap h-full overflow-auto"

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
      <div className="flex flex-wrap p-2">
      {Object.values(state.ui.getState().lookup).map((ui) => (
        <>
          <div key={ui.key} className="flex items-center bg-slate-900 p-1 cursor-default font-[200 text-yellow-200" title={ui.title}>
            {ui.key}
          </div>
          {Object.values(ui.input).map((input) => (
            <div key={input.key} className="bg-slate-900 p-1">
              <FeedbackUiInput key={input.key} input={input} />
            </div>
          ))}
        </>
      ))}
      </div>

      <div
        className={clsx(
          "absolute bottom-2 rounded-l right-0 size-8 max-w-fit max-h-16 h-fit overflow-auto",
          "text-xs pl-2 py-1 bg-black border-[1px] border-r-0 border-gray-600 cursor-pointer select-none",
          // "transition-[width,height,right] duration-300",
          state.pendingMode === 'open' && "w-[calc(100%-2*8px)]",
          state.pendingMode === 'none' && "w-0 right-[-12px]",
        )}
        onClick={state.togglePendingMode}
      >
        {state.pendingMode === 'open'
          ? <div>
              {Array.from(state.pending.values()).map(item =>
                <div key={item.pid} className="flex gap-2 pl-1 w-full">
                  <div className="text-green-300">{item.pid}</div>
                  <div className="text-yellow-200 whitespace-nowrap">{item.message}</div>
                </div>)}
            </div>
            
          : <div className="mr-2">⚠️</div>
        }
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
 * @property {((uiKey: string, partial: { [inputKey: string]: string | number | boolean }) => void)} change
 * @property {(() => void)} removeUiOnClose
 * @property {((e: Event) => null | NPC.FeedbackInput )} getInputByEvent
 * @property {((uiKey: string) => null | NPC.FeedbackUi )} getUi
 * @property {((item: PendingNotification) => void)} registerPending
 * @property {((pid: number) => void)} removePending
 * @property {((uiKey: string) => void)} remove
 * @property {((next: State['pendingMode']) => void)} setPendingMode
 * @property {(() => void)} togglePendingMode
 */

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
          className="bg-gray-800 text-white font-thin hover:brightness-150 hover:bg-green-900 cursor-pointer rounded-md p-1 border-2 border-indigo-500/50"
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
            "select-none font-[500] rounded-lg bg-black cursor-pointer rounded-sm p-1 border-2 border-gray-600",
            input.value ? 'text-black bg-gray-400 hover:border-black' : 'text-white/50 hover:brightness-150')
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
          className="bg-gray-800 text-white font-thin hover:brightness-150 cursor-pointer rounded-md p-1 border-2 border-indigo-800/50"
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
