import React from "react";
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
    ui: /** @type {State['ui']} */ (create(immer(subscribeWithSelector((get, set) => ({ lookup: {} }))))),
    add(item) {
      state.ui.setState(draft => {
        draft.lookup[item.key] = feedbackUiDefToUi(item);
      });
    },
    getInputByEvent(e) {
      const el = /** @type {HTMLElement} */ (e.target);
      const { uiKey, inputKey } = el.dataset;
      if (!(typeof uiKey === 'string' && typeof inputKey === 'string')) {
        return null;
      }
      const ui = state.ui.getState().lookup[uiKey];
      const input = ui.inputs.find(input => input.key === inputKey) ?? null;
      return input === null ? null : { uiKey, input };
    },
    remove(itemKey) {
      state.ui.setState(draft => { delete draft.lookup[itemKey]; });
    },
    update,
  }), { ignore: { ui: true } });

  console.log('Feedback', state.ui.getState());
  useStore(state.ui); // subscribe to ui changes
  
  React.useEffect(() => {
    setCached([props.tabKey], state);
    return () => removeCached([props.tabKey]);
  }, []);
  
  return (
    <div
      className="font-sans text-sm text-white p-2 bg-slate-900 flex flex-col v-full overflow-auto"

      // 🚧
      onChange={e => {
        const result = state.getInputByEvent(e.nativeEvent);
        if (!result) return;
        console.log('onChange', result);
        // 🚧 update store
      }}
      onClick={e => {
        const result = state.getInputByEvent(e.nativeEvent);
        const input = result?.input;
        if (!result || input?.type !== 'button') return;
        
        state.ui.setState(draft => {
          const ui = draft.lookup[result.uiKey];
          const index = ui.inputs.findIndex(x => x.key === input.key);
          /** @type {typeof input} */ (ui.inputs[index]).value = Date.now();
        });
      }}
    >
      {Object.values(state.ui.getState().lookup).map((ui) => (
        <div key={ui.key} className="flex gap-2 flex-wrap items-center p-1 border-t-2 last:border-b-2 border-gray-800">
          <div className="cursor-pointer" title={ui.label}>
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
 * @property {((e: Event) => null | { uiKey: string; input: NPC.FeedbackInput; })} getInputByEvent
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
          data-ui-key={ui.key}
          data-input-key={input.key}
        >
          {input.label ?? input.key}
        </button>
      );
    case 'checkbox':
      return (
        <label className="flex gap-1">
          <div>{input.label ?? input.key}</div>
          <input type="checkbox"
            data-ui-key={ui.key}
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
          data-ui-key={ui.key}
          data-input-key={input.key}
          defaultValue={input.default}
          value={input.value}
        />
      );
    case 'select':
      return (
        <select
          className="bg-gray-800 text-white font-thin hover:brightness-150 cursor-pointer rounded-md px-1 border-2 border-indigo-800/50"
          data-ui-key={ui.key}
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
          data-ui-key={ui.key}
          data-input-key={input.key}
          type="text"
          placeholder={input.placeholder}
          defaultValue={input.default}
          value={input.value}
        />
      );
  default:
    return null;
  }
}

/**
 * @param {NPC.FeedbackUiDef} uiDef 
 * @returns {NPC.FeedbackUi}
 */
function feedbackUiDefToUi(uiDef) {
  const { inputs, ...rest } = uiDef;
  return {
    ...rest,
    inputs: inputs.flatMap(input => {
      switch (input.type) {
        case 'button':
          return {...input, value: 0 }; // last clicked epochMs
        case 'checkbox':
          return {...input, value: Boolean(input.default) };
        case 'number':
          return {...input, value: Number(input.default) };
        case 'select':
          return {...input, value: input.default ?? input.options[0]?.value ?? '' };
        case 'text':
          return {...input, value: input.default ?? '' };
        default:
          warn(`Ignored feedback input with unknown type: ${jsStringify(input)}`);
          return [];
      }
    }),
  };
}

function emptyOnChange() {}
