import React from "react";
import clsx from 'clsx';
import { create, useStore } from "zustand";
import { immer } from "zustand/middleware/immer";
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
    ui: /** @type {State['ui']} */ (create(immer(subscribeWithSelector((_get, _set) => ({ lookup: {} }))))),
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
      return ui.inputs.find(input => input.key === inputKey) ?? null;
    },
    remove(uiKey) {
      state.ui.setState(draft => { delete draft.lookup[uiKey]; });
    },
    update,
  }), { ignore: { ui: true } });

  useStore(state.ui); // subscribe to ui changes
  // console.log('Feedback');
  
  React.useEffect(() => {
    setCached([props.tabKey], state);
    return () => removeCached([props.tabKey]);
  }, []);
  
  return (
    <div
      className="font-sans text-sm text-white p-2 bg-slate-900 flex flex-col v-full overflow-auto"

      onChange={e => {
        const input = state.getInputByEvent(e.nativeEvent);
        if (input === null || !isOnChangeInput(input)) return;
        
        state.ui.setState(draft => {
          const ui = draft.lookup[input.uiKey];
          const index = ui.inputs.findIndex(x => x.key === input.key);

          switch (input.type) {
            case 'checkbox':
              (ui.inputs[index]).value = /** @type {HTMLInputElement} */ (e.target).checked;
              break;
            case 'number':
            case 'select':
            case 'text':
              (ui.inputs[index]).value = (/** @type {HTMLInputElement} */ (e.target)).value;
              break;
          }
        });
      }}
      onClick={e => {
        const input = state.getInputByEvent(e.nativeEvent);
        if (input?.type !== 'button') return;
        
        state.ui.setState(draft => {
          const ui = draft.lookup[input.uiKey];
          const index = ui.inputs.findIndex(x => x.key === input.key);
          /** @type {typeof input} */ (ui.inputs[index]).value = Date.now();
        });
      }}
    >
      {Object.values(state.ui.getState().lookup).map((ui) => (
        <div key={ui.key} className="flex gap-2 flex-wrap items-center p-1 border-t-2 last:border-b-2 border-gray-800">
          <div className="cursor-default" title={ui.label}>
            {ui.icon ?? ui.label}
          </div>
          {ui.inputs.map((input) => (
            <FeedbackUiInput key={input.key} ui={ui} input={input} />
          ))}
        </div>
      ))}
          
    </div>
  );
}

/**
 * @typedef State
 * @property {UiStore} ui
 * @property {((ui: NPC.FeedbackUiDef) => void)} add
 * @property {((e: Event) => null | NPC.FeedbackInput )} getInputByEvent
 * @property {((uiKey: string) => void)} remove
 * @property {(() => void)} update
 */

/**
 * @typedef {import("../tabs/tab-factory").BaseTabProps} Props
 */

/**
 * @param {{ ui: NPC.FeedbackUi; input: NPC.FeedbackInput }} props
 */
function FeedbackUiInput({ ui, input }) {
  switch (input.type) {
    case 'button':
      return (
        <button
          className="bg-gray-800 text-white font-thin hover:brightness-150 cursor-pointer rounded-md px-1 border-2 border-indigo-800/50"
          data-ui-key={input.uiKey}
          data-input-key={input.key}
        >
          {input.label ?? input.key}
        </button>
      );
    case 'checkbox':
      return (
        <label className="select-none flex gap-1">
          <div className={clsx("select-none font-normal hover:brightness-150 cursor-pointer rounded-sm px-1 border-2 border-gray-800", input.value ? 'text-white' : 'text-white/50')}>
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
  const { inputs, ...rest } = uiDef;
  return {
    ...rest,
    inputs: inputs.flatMap(input => {
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
    }),
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